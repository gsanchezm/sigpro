import { defineApiRows, type ApiRowHandler } from '../../core/framework';
import { cell, conclude, preparationFailed, strict } from '../../support/checks';
import { ACCOUNT_OF, TENANT_A, act, answerChecks, resetTenants, sessionFor, totalCheck, totalOf } from './common';

// US-PROG-GESTION-003 — Eliminar un programa por la API. Preparación de cada fila: reinicio de alumno01 con el token de su
// administrador y, según la fila, inicio de sesión de la cuenta en alumno01 (el administrador completa el segundo factor).
// Las consultas posteriores al borrado se hacen con la sesión del administrador, que es quien borra.

// Consultas de la historia (texto de la celda → ruta de la API sin el prefijo /api)
const CONSULTAS: ReadonlyMap<string, string> = new Map<string, string>([
  ['GET /api/programs/PRG-001', '/programs/PRG-001'],
  ['GET /api/requirements/REQ-001', '/requirements/REQ-001'],
  ['GET /api/test-cases/TC-001', '/test-cases/TC-001'],
  ['GET /api/nc/NC-001', '/nc/NC-001'],
  ['GET /api/documents/DOC-001', '/documents/DOC-001'],
  ['GET /api/programs/PRG-002', '/programs/PRG-002'],
  ['GET /api/requirements/REQ-015', '/requirements/REQ-015'],
]);

// Preparación de la celda «preparacion»: ningún borrado previo, o un borrado previo de PRG-001 con DELETE
const PREVIOUS_DELETE: ReadonlyMap<string, string | undefined> = new Map<string, string | undefined>([
  ['no se ha borrado ningún programa antes', undefined],
  ['PRG-001 se ha borrado antes con DELETE /api/programs/PRG-001', 'PRG-001'],
]);

// --- Esquema 1: solo el administrador puede eliminar un programa --------------------------------------------------------------

const onlyAdmin: ApiRowHandler = async (row) => {
  await resetTenants([TENANT_A]);
  const expected = `${cell(row, 'respuesta')}; el tenant tiene ${cell(row, 'total')} programas`;
  const actor = await sessionFor(strict('cuenta', ACCOUNT_OF, cell(row, 'cuenta')));
  if (actor.token === undefined) return preparationFailed(expected, `${cell(row, 'cuenta')} inicia sesión y recibe accessToken`, actor.last);
  const before = await totalOf(actor.token);
  if (before !== 24) return preparationFailed(expected, `el tenant tiene 24 programas (lectura: ${String(before)})`, actor.last);
  const result = await act('DELETE', `/programs/${cell(row, 'codigo')}`, actor.token);
  const total = await totalOf(actor.token);
  return conclude([...answerChecks(cell(row, 'respuesta'), result), totalCheck(total, Number(cell(row, 'total')))]);
};

// --- Esquema 2: tras borrar PRG-001 no se encuentran sus datos y sí los de los demás programas ----------------------------

const afterDeleteOfPrg001: ApiRowHandler = async (row) => {
  await resetTenants([TENANT_A]);
  const expected = `tras borrar PRG-001, GET ${cell(row, 'consulta').replace(/^GET \/api/, '')} responde ${cell(row, 'respuesta')}`;
  const admin = await sessionFor('admin');
  if (admin.token === undefined) return preparationFailed(expected, 'admin@sigpro.test completa el segundo factor y recibe accessToken', admin.last);
  const deleted = await act('DELETE', '/programs/PRG-001', admin.token);
  if (deleted.status !== 204) return preparationFailed(expected, 'admin@sigpro.test borra PRG-001 con DELETE /api/programs/PRG-001', deleted);
  const path = strict('consulta', CONSULTAS, cell(row, 'consulta'));
  const result = await act('GET', path, admin.token);
  return conclude(answerChecks(cell(row, 'respuesta'), result));
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
