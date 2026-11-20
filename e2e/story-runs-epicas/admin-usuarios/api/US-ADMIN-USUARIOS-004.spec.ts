import { sessionOf } from '../../../story-runs/support/api';
import { TENANT_A, TENANT_B, resetTenants } from '../../../story-runs/support/prepare';
import { cell, check, conclude, errorsOf, preparationFailed, strict, type Check } from '../../support/checks';
import { defineApiRows, type ApiRowHandler } from '../../core/framework';
import {
  ADMIN_A,
  ADMIN_B,
  auditTotal,
  listUsers,
  listUsersWith,
  patchUser,
  requestOrFail,
  signIn,
  snapshotOf,
  statusCheck,
  stateOf,
  userById,
  userByEmail,
  usersOf,
  type Expect,
} from './common';

// US-ADMIN-USUARIOS-004 — Validar el cuerpo y el id de un cambio de usuario (API).
// Preparación de cada fila: reinicio de alumno01 y su accessToken (alumno01@sigpro.lab). El Esquema 2 también reinicia alumno02 y crea en
// él la cuenta solicitada, para leer su id con su propio administrador.

/** Motivo esperado de un 422: el campo que lo lleva (`''` si no va ligado a ningún campo) y su texto (`undefined` = cualquier texto no vacío). */
interface Motive {
  readonly field: string;
  readonly reason: string | undefined;
}

// --- Esquema 1: un cuerpo no válido responde 422 con su motivo y no cambia nada ----------------------------------------------

const INVALID_BODY: ReadonlyMap<string, unknown> = new Map<string, unknown>([
  ['{"role": "dios"}', { role: 'dios' }],
  ['{"role": ""}', { role: '' }],
  ['{"active": "si"}', { active: 'si' }],
  ['{}', {}],
  ['{"name": "Otra persona"}', { name: 'Otra persona' }],
]);

const MOTIVE_CELLS: ReadonlyMap<string, Motive> = new Map<string, Motive>([
  ['roleInvalid en role', { field: 'role', reason: 'roleInvalid' }],
  ['un motivo en active', { field: 'active', reason: undefined }],
  ['nothingToUpdate sin campo', { field: '', reason: 'nothingToUpdate' }],
]);

/** Comprobación del mapa de motivos: el único campo que trae el `errors` es el de la historia, con su texto (o cualquiera si la historia no lo fija). */
const motiveCheck = (errors: Readonly<Record<string, unknown>>, motive: Motive, expected: string): Check => {
  const keys = Object.keys(errors);
  const value = errors[motive.field];
  const onlyField = keys.length === 1 && keys[0] === motive.field;
  const textOk = motive.reason === undefined ? typeof value === 'string' && value !== '' : value === motive.reason;
  return check(onlyField && textOk, expected, `errores: ${JSON.stringify(errors)}`);
};

const invalidBodyNoChange: ApiRowHandler = async (row) => {
  const body = strict('cuerpo', INVALID_BODY, cell(row, 'cuerpo'));
  const motive = strict('motivo', MOTIVE_CELLS, cell(row, 'motivo'));
  const motiveText = motive.reason === undefined ? `un motivo en «${motive.field}»` : motive.field === '' ? `${motive.reason} sin campo` : `${motive.reason} en ${motive.field}`;
  const expected = `422 validation_failed con el motivo ${motiveText}; auditor@sigpro.test sigue con el rol auditor y activa; el total de GET /api/audit sigue igual`;
  await resetTenants([TENANT_A]);
  const admin = await signIn(ADMIN_A, TENANT_A);
  const token = sessionOf(admin)?.accessToken;
  if (token === undefined) return preparationFailed(expected, 'alumno01@sigpro.lab inicia sesión', admin);
  const totalBefore = await auditTotal(token);
  if (totalBefore === undefined) return preparationFailed(expected, 'leer el total de GET /api/audit', admin);
  const rejected = await patchUser(token, 'u4', body);
  const totalAfter = await auditTotal(token);
  const auditor = userById(usersOf(await listUsers(token)), 'u4');
  return conclude([
    statusCheck(rejected, { status: 422, code: 'validation_failed' }),
    motiveCheck(errorsOf(rejected), motive, `el motivo ${motiveText}`),
    check(auditor?.role === 'auditor' && auditor?.active === true, 'auditor@sigpro.test sigue con el rol auditor y activa', `auditor@sigpro.test: ${stateOf(auditor)}`),
    check(totalAfter === totalBefore, `el total de GET /api/audit sigue en ${String(totalBefore)}`, `el total de GET /api/audit pasa de ${String(totalBefore)} a ${String(totalAfter)}`),
  ]);
};

// --- Esquema 2: un id que no existe en el tenant responde 404 y no cambia nada -----------------------------------------------

type IdCell = { readonly requested: true } | { readonly requested: false; readonly id: string };

const UNKNOWN_IDS: ReadonlyMap<string, IdCell> = new Map<string, IdCell>([
  ['u99', { requested: false, id: 'u99' }],
  ['(id de la cuenta recién solicitada en alumno02)', { requested: true }],
]);

const unknownIdNoChange: ApiRowHandler = async (row) => {
  const idCell = strict('id', UNKNOWN_IDS, cell(row, 'id'));
  const expected = '404 user_not_found; la lista de usuarios de alumno01 sigue con sus siete cuentas, sin cambios';
  await resetTenants([TENANT_A, TENANT_B]);
  const adminA = await signIn(ADMIN_A, TENANT_A);
  const tokenA = sessionOf(adminA)?.accessToken;
  if (tokenA === undefined) return preparationFailed(expected, 'alumno01@sigpro.lab inicia sesión', adminA);
  // La cuenta recién solicitada en alumno02 existe en la fila (Dado del Esquema)
  const requested = await requestOrFail(TENANT_B);
  if (requested.failed !== undefined || requested.account === undefined) return requested.failed ?? preparationFailed(expected, 'solicitar una cuenta en alumno02', adminA);
  const adminB = await signIn(ADMIN_B, TENANT_B);
  const tokenB = sessionOf(adminB)?.accessToken;
  if (tokenB === undefined) return preparationFailed(expected, 'alumno02@sigpro.lab inicia sesión', adminB);
  const requestedId = userByEmail(usersOf(await listUsersWith(tokenB, TENANT_B)), requested.account.email)?.id;
  const id = idCell.requested ? (typeof requestedId === 'string' ? requestedId : undefined) : idCell.id;
  if (id === undefined) return preparationFailed(expected, 'leer el id de la cuenta recién solicitada en alumno02', adminB);
  const before = snapshotOf(usersOf(await listUsers(tokenA)));
  const auditBefore = await auditTotal(tokenA);
  const otherBefore = snapshotOf(usersOf(await listUsersWith(tokenB, TENANT_B)));
  const rejected = await patchUser(tokenA, id, { active: false });
  const after = usersOf(await listUsers(tokenA));
  const auditAfter = await auditTotal(tokenA);
  const otherAfter = snapshotOf(usersOf(await listUsersWith(tokenB, TENANT_B)));
  return conclude(
    [
      statusCheck(rejected, { status: 404, code: 'user_not_found' }),
      check(snapshotOf(after) === before && after.length === 7, 'la lista de alumno01 sigue con sus siete cuentas, sin cambios', `la lista de alumno01 tiene ${after.length} cuentas${snapshotOf(after) === before ? ', sin cambios' : ', con cambios'}`),
      // Regla: una petición rechazada no cambia nada ni deja registro de auditoría (también en la otra cuenta del tenant de alumno02)
      check(auditAfter === auditBefore, `el total de GET /api/audit sigue en ${String(auditBefore)}`, `el total de GET /api/audit pasa de ${String(auditBefore)} a ${String(auditAfter)}`),
      check(otherAfter === otherBefore, 'la lista de alumno02 no cambia', otherAfter === otherBefore ? 'la lista de alumno02 no cambia' : 'la lista de alumno02 cambia'),
    ],
    { evidence: { idProbado: idCell.requested ? '(id de alumno02)' : idCell.id } },
  );
};

// --- Esquema 3: la validación del cuerpo va antes que la búsqueda de la cuenta -------------------------------------------------

const ID_BEFORE_LOOKUP: ReadonlyMap<string, string> = new Map<string, string>([
  ['u99', 'u99'],
  ['u7', 'u7'],
]);

const BODY_BEFORE_LOOKUP: ReadonlyMap<string, unknown> = new Map<string, unknown>([
  ['{}', {}],
  ['{"active": false}', { active: false }],
  ['{"role": "dios"}', { role: 'dios' }],
]);

interface ResultBeforeLookup {
  readonly expect: Expect;
  readonly motive?: Motive;
}

const RESULT_BEFORE_LOOKUP: ReadonlyMap<string, ResultBeforeLookup> = new Map<string, ResultBeforeLookup>([
  ['422 validation_failed con el motivo nothingToUpdate sin campo', { expect: { status: 422, code: 'validation_failed' }, motive: { field: '', reason: 'nothingToUpdate' } }],
  ['404 user_not_found', { expect: { status: 404, code: 'user_not_found' } }],
  ['422 validation_failed con el motivo roleInvalid en role', { expect: { status: 422, code: 'validation_failed' }, motive: { field: 'role', reason: 'roleInvalid' } }],
]);

const bodyBeforeLookup: ApiRowHandler = async (row) => {
  const id = strict('id', ID_BEFORE_LOOKUP, cell(row, 'id'));
  const body = strict('cuerpo', BODY_BEFORE_LOOKUP, cell(row, 'cuerpo'));
  const outcome = strict('respuesta', RESULT_BEFORE_LOOKUP, cell(row, 'respuesta'));
  const expected = cell(row, 'respuesta');
  await resetTenants([TENANT_A]);
  const admin = await signIn(ADMIN_A, TENANT_A);
  const token = sessionOf(admin)?.accessToken;
  if (token === undefined) return preparationFailed(expected, 'alumno01@sigpro.lab inicia sesión', admin);
  const auditBefore = await auditTotal(token);
  const listBefore = snapshotOf(usersOf(await listUsers(token)));
  const sent = await patchUser(token, id, body);
  const auditAfter = await auditTotal(token);
  const listAfter = snapshotOf(usersOf(await listUsers(token)));
  // Regla: una petición rechazada no cambia nada ni deja registro de auditoría
  const extra: Check[] = [
    check(auditAfter === auditBefore, `el total de GET /api/audit sigue en ${String(auditBefore)}`, `el total de GET /api/audit pasa de ${String(auditBefore)} a ${String(auditAfter)}`),
    check(listAfter === listBefore, 'la lista de usuarios de alumno01 no cambia', listAfter === listBefore ? 'la lista de usuarios de alumno01 no cambia' : 'la lista de usuarios de alumno01 cambia'),
    ...(outcome.motive === undefined ? [] : [motiveCheck(errorsOf(sent), outcome.motive, `el motivo ${outcome.motive.reason ?? ''}`)]),
  ];
  return conclude([statusCheck(sent, outcome.expect), ...extra], { evidence: { cuerpoEnviado: JSON.stringify(body) } });
};

defineApiRows({
  story: 'US-ADMIN-USUARIOS-004',
  surface: 'api',
  tenants: [TENANT_A, TENANT_B],
  handlers: new Map<number, ApiRowHandler>([
    [1, invalidBodyNoChange],
    [2, unknownIdNoChange],
    [3, bodyBeforeLookup],
  ]),
});
