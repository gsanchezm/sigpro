import { defineApiRows, type ApiRowHandler } from '../../core/framework';
import { cell, check, conclude, preparationFailed, strict, type Check } from '../../support/checks';
import { ACCOUNT_OF, TENANT_A, act, answerChecks, auditCount, childrenCheck, childrenOf, resetTenants, sessionFor, suppliersTotal, totalCheck, totalOf, usersTotal } from './common';

// US-PROG-GESTION-003 — Eliminar un programa por la API. Preparación de cada fila: reinicio de alumno01 con el token de su
// administrador y, según la fila, inicio de sesión de la cuenta en alumno01 (el administrador completa el segundo factor). Se
// cuentan los hijos del programa (requisitos, casos, NC, documentos, proveedores con contrato) antes y después, y se comprueba que
// proveedores y usuarios no cambian y que la auditoría program.deleted se añade. Las consultas posteriores se hacen con el admin.

/** Auditoría `program.deleted` de `code`: crece en `delta` (1 si se borró, 0 si no). */
const deletedAudit = (before: number | undefined, after: number | undefined, delta: number, code: string): Check =>
  check(
    before !== undefined && after !== undefined && after - before === delta,
    `auditoría program.deleted de ${code} +${delta}`,
    before === undefined || after === undefined ? `auditoría de ${code} no legible` : `auditoría program.deleted de ${code} +${after - before}`,
  );

/** Proveedores y usuarios del tenant no cambian por el borrado. */
const othersUnchanged = (suppliers: [number | undefined, number | undefined], users: [number | undefined, number | undefined]): Check => {
  const ok = suppliers[0] !== undefined && suppliers[0] === suppliers[1] && users[0] !== undefined && users[0] === users[1];
  return check(ok, 'proveedores y usuarios del tenant no cambian', `proveedores ${String(suppliers[0])} → ${String(suppliers[1])}, usuarios ${String(users[0])} → ${String(users[1])}`);
};

/** Consultas de la historia (texto de la celda → ruta de la API sin el prefijo /api). */
const CONSULTAS: ReadonlyMap<string, string> = new Map<string, string>([
  ['GET /api/programs/PRG-001', '/programs/PRG-001'],
  ['GET /api/requirements/REQ-001', '/requirements/REQ-001'],
  ['GET /api/test-cases/TC-001', '/test-cases/TC-001'],
  ['GET /api/nc/NC-001', '/nc/NC-001'],
  ['GET /api/documents/DOC-001', '/documents/DOC-001'],
  ['GET /api/programs/PRG-002', '/programs/PRG-002'],
  ['GET /api/requirements/REQ-015', '/requirements/REQ-015'],
]);

/** Preparación de la celda «preparacion»: ningún borrado previo, o un borrado previo de PRG-001 con DELETE. */
const PREVIOUS_DELETE: ReadonlyMap<string, string | undefined> = new Map<string, string | undefined>([
  ['no se ha borrado ningún programa antes', undefined],
  ['PRG-001 se ha borrado antes con DELETE /api/programs/PRG-001', 'PRG-001'],
]);

// --- Esquema 1: solo el administrador puede eliminar un programa --------------------------------------------------------------

const onlyAdmin: ApiRowHandler = async (row) => {
  await resetTenants([TENANT_A]);
  const expected = `${cell(row, 'respuesta')}; el tenant tiene ${cell(row, 'total')} programas; si no se borra, ningún hijo ni proveedor ni usuario cambia`;
  const code = cell(row, 'codigo');
  const actor = await sessionFor(strict('cuenta', ACCOUNT_OF, cell(row, 'cuenta')));
  if (actor.token === undefined) return preparationFailed(expected, `${cell(row, 'cuenta')} inicia sesión y recibe accessToken`, actor.last);
  const admin = await sessionFor('admin');
  if (admin.token === undefined) return preparationFailed(expected, 'admin@sigpro.test completa el segundo factor (lectura de hijos y auditoría)', admin.last);
  const before = await totalOf(actor.token);
  if (before !== 24) return preparationFailed(expected, `el tenant tiene 24 programas (lectura: ${String(before)})`, actor.last);
  const childrenBefore = await childrenOf(admin.token, code);
  const suppliersBefore = await suppliersTotal(admin.token);
  const usersBefore = await usersTotal(admin.token);
  const auditBefore = await auditCount(admin.token, code, 'program.deleted');
  const result = await act('DELETE', `/programs/${code}`, actor.token);
  const total = await totalOf(actor.token);
  const childrenAfter = await childrenOf(admin.token, code);
  const auditAfter = await auditCount(admin.token, code, 'program.deleted');
  const deleted = result.status === 204;
  const sameChildren = (Object.keys(childrenBefore) as (keyof typeof childrenBefore)[]).every((key) => childrenBefore[key] === childrenAfter[key]);
  const hijos: Check = deleted
    ? check(childrenAfter.requisitos === undefined && childrenAfter.casos === 0 && childrenAfter.nc === 0 && childrenAfter.documentos === 0, `${code} sin hijos tras borrarlo`, `${code} con ${String(childrenAfter.requisitos)} requisitos, ${childrenAfter.casos} casos, ${childrenAfter.nc} NC, ${childrenAfter.documentos} documentos`)
    : childrenCheck(childrenBefore, childrenAfter);
  return conclude([
    ...answerChecks(cell(row, 'respuesta'), result),
    totalCheck(total, Number(cell(row, 'total'))),
    hijos,
    deletedAudit(auditBefore, auditAfter, deleted ? 1 : 0, code),
    othersUnchanged([suppliersBefore, await suppliersTotal(admin.token)], [usersBefore, await usersTotal(admin.token)]),
  ], { evidence: { hijosAntes: childrenBefore, hijosDespues: childrenAfter, sinCambioDeHijos: sameChildren } });
};

// --- Esquema 2: tras borrar PRG-001 no se encuentran sus datos y sí los de los demás programas ----------------------------

const afterDeleteOfPrg001: ApiRowHandler = async (row) => {
  await resetTenants([TENANT_A]);
  const expected = `tras borrar PRG-001, GET ${cell(row, 'consulta').replace(/^GET \/api/, '')} responde ${cell(row, 'respuesta')}; PRG-001 sin hijos ni proveedores con contrato; proveedores y usuarios no cambian`;
  const admin = await sessionFor('admin');
  if (admin.token === undefined) return preparationFailed(expected, 'admin@sigpro.test completa el segundo factor y recibe accessToken', admin.last);
  const childrenBefore = await childrenOf(admin.token, 'PRG-001');
  const suppliersBefore = await suppliersTotal(admin.token);
  const usersBefore = await usersTotal(admin.token);
  const deleted = await act('DELETE', '/programs/PRG-001', admin.token);
  if (deleted.status !== 204) return preparationFailed(expected, 'admin@sigpro.test borra PRG-001 con DELETE /api/programs/PRG-001', deleted);
  const path = strict('consulta', CONSULTAS, cell(row, 'consulta'));
  const result = await act('GET', path, admin.token);
  const childrenAfter = await childrenOf(admin.token, 'PRG-001');
  return conclude(
    [
      ...answerChecks(cell(row, 'respuesta'), result),
      check(childrenAfter.requisitos === undefined && childrenAfter.casos === 0 && childrenAfter.nc === 0 && childrenAfter.documentos === 0 && childrenAfter.proveedoresConContrato === 0, 'PRG-001 sin requisitos, casos, NC, documentos ni proveedores con contrato', `PRG-001: requisitos ${String(childrenAfter.requisitos)}, casos ${childrenAfter.casos}, NC ${childrenAfter.nc}, documentos ${childrenAfter.documentos}, proveedores con contrato ${childrenAfter.proveedoresConContrato}`),
      othersUnchanged([suppliersBefore, await suppliersTotal(admin.token)], [usersBefore, await usersTotal(admin.token)]),
    ],
    {
      evidence: { proveedoresConContratoAntesDelBorrado: childrenBefore.proveedoresConContrato },
      ...(childrenBefore.proveedoresConContrato === 0 ? { note: 'PRG-001 no tenía proveedores con contrato antes del borrado: esa parte de la cascada no se distingue en esta fila.' } : {}),
    },
  );
};

// --- Esquema 3: un código inexistente o ya borrado responde 404 y no borra nada ----------------------------------------------

const missingOrDeleted: ApiRowHandler = async (row) => {
  await resetTenants([TENANT_A]);
  const expected = `${cell(row, 'respuesta')}; el tenant tiene ${cell(row, 'total')} programas`;
  const admin = await sessionFor('admin');
  if (admin.token === undefined) return preparationFailed(expected, 'admin@sigpro.test completa el segundo factor y recibe accessToken', admin.last);
  const previous = strict('preparacion', PREVIOUS_DELETE, cell(row, 'preparacion'));
  if (previous !== undefined) {
    const deleted = await act('DELETE', `/programs/${previous}`, admin.token);
    if (deleted.status !== 204) return preparationFailed(expected, `borrar ${previous} antes con DELETE /api/programs/${previous}`, deleted);
  }
  const result = await act('DELETE', `/programs/${cell(row, 'codigo')}`, admin.token);
  const total = await totalOf(admin.token);
  return conclude([...answerChecks(cell(row, 'respuesta'), result), totalCheck(total, Number(cell(row, 'total')))]);
};

defineApiRows({
  story: 'US-PROG-GESTION-003',
  surface: 'api',
  tenants: [TENANT_A],
  handlers: new Map<number, ApiRowHandler>([
    [1, onlyAdmin],
    [2, afterDeleteOfPrg001],
    [3, missingOrDeleted],
  ]),
});

