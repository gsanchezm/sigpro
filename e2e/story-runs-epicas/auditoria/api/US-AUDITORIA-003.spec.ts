import { call, field, type ApiResult } from '../../../story-runs/support/api';
import { DEMO, TENANT_A, TENANT_B, resetTenants } from '../../../story-runs/support/prepare';
import { cell, check, errorsOf, parseResponse, preparationFailed, responseCheck, strict, type Check } from '../../support/checks';
import { defineApiRows, type ApiRowHandler } from '../../core/framework';
import { intCell, itemsOf, loginAs, readAudit, totalOf, type AuditEvent, type Login } from './common';
import { verdictOf, shownTotal } from '../verdict';

// US-AUDITORIA-003 — Permiso de auditoría y aislamiento por tenant (API). Preparación de cada fila: se reinician alumno01 y alumno02
// con el token de sus administradores (la historia lo pide para ambos) antes de actuar; iniciar sesión no deja evento.

/** Reinicio de los dos tenants de la historia, en cada fila. */
const resetBoth = (): Promise<void> => resetTenants([TENANT_A, TENANT_B]);

/** Esquema 1, columna «respuesta»: lo que se comprueba de cada respuesta de lectura del registro. */
const READ_RESPONSES: ReadonlyMap<string, (result: ApiResult) => readonly Check[]> = new Map<string, (result: ApiResult) => readonly Check[]>([
  ['200 con items', (result) => [responseCheck(result, { status: 200 }), check(itemsOf(result) !== undefined, 'trae items', itemsOf(result) === undefined ? 'sin items' : 'trae items')]],
  ['403 forbidden', (result) => [responseCheck(result, parseResponse('403 forbidden'))]],
]);

/** Esquema 1: solo admin y auditor leen el registro. */
const onlyAuditAdmins: ApiRowHandler = async (row) => {
  const cuenta = cell(row, 'cuenta');
  const contrasena = cell(row, 'contraseña');
  const respuesta = cell(row, 'respuesta');
  const expected = `${cuenta} recibe ${respuesta}`;
  await resetBoth();
  const login = await loginAs(TENANT_A, { email: cuenta, password: contrasena });
  if (login.token === undefined) return preparationFailed(expected, `${cuenta} inicia sesión con la contraseña indicada`, login.result);
  const result = await readAudit(login.token);
  return verdictOf(strict('respuesta', READ_RESPONSES, respuesta)(result));
};

/** Esquema 2, columna «cabecera»: qué credencial envía la fila (sin cabecera, un texto, o el refreshToken del auditor). */
type Credential = 'sin cabecera' | 'texto' | 'refreshToken';

const CREDENTIALS: ReadonlyMap<string, Credential> = new Map<string, Credential>([
  ['(sin cabecera Authorization)', 'sin cabecera'],
  ['Authorization: Bearer (un texto que no es un token)', 'texto'],
  ['Authorization: Bearer el refreshToken de auditor@sigpro.test', 'refreshToken'],
]);

/** Esquema 2: sin un accessToken válido no se lee el registro. */
const withoutValidToken: ApiRowHandler = async (row) => {
  const cabecera = cell(row, 'cabecera');
  const respuesta = cell(row, 'respuesta');
  const expected = `${cabecera}: ${respuesta}`;
  await resetBoth();
  const login: Login = await loginAs(TENANT_A, DEMO.auditor);
  if (login.token === undefined || login.refreshToken === undefined) return preparationFailed(expected, 'auditor@sigpro.test ha iniciado sesión (accessToken y refreshToken)', login.result);
  const credential = strict('cabecera', CREDENTIALS, cabecera);
  const token = credential === 'sin cabecera' ? undefined : credential === 'texto' ? 'un texto que no es un token' : login.refreshToken;
  const result = await readAudit(token);
  return verdictOf([responseCheck(result, parseResponse(respuesta))]);
};

/** Esquema 3, columna «respuesta»: el permiso se comprueba antes que el cursor. */
const PERMISSION_FIRST: ReadonlyMap<string, (result: ApiResult) => readonly Check[]> = new Map<string, (result: ApiResult) => readonly Check[]>([
  ['403 forbidden', (result) => [responseCheck(result, parseResponse('403 forbidden'))]],
  [
    '422 validation_failed con errors.cursor igual a badCursor',
    (result) => [responseCheck(result, { status: 422, code: 'validation_failed' }), check(errorsOf(result).cursor === 'badCursor', 'errors.cursor igual a badCursor', `errors.cursor vale ${String(errorsOf(result).cursor)}`)],
  ],
]);

/** Esquema 3: el permiso se comprueba antes que el cursor (con `cursor=xyz`). */
const permissionBeforeCursor: ApiRowHandler = async (row) => {
  const cuenta = cell(row, 'cuenta');
  const contrasena = cell(row, 'contraseña');
  const respuesta = cell(row, 'respuesta');
  const expected = `${cuenta} con cursor=xyz recibe ${respuesta}`;
  await resetBoth();
  const login = await loginAs(TENANT_A, { email: cuenta, password: contrasena });
  if (login.token === undefined) return preparationFailed(expected, `${cuenta} inicia sesión con la contraseña indicada`, login.result);
  const result = await readAudit(login.token, 'cursor=xyz');
  return verdictOf(strict('respuesta', PERMISSION_FIRST, respuesta)(result));
};

/** Esquema 4, columnas de la fila: el tenant del token, la cabecera x-tenant de la petición y lo que se espera leer. */
const TOKEN_TENANT: ReadonlyMap<string, string> = new Map([
  ['alumno01', TENANT_A],
  ['alumno02', TENANT_B],
]);
const HEADER_TENANT: ReadonlyMap<string, string | undefined> = new Map<string, string | undefined>([
  ['x-tenant: alumno02', TENANT_B],
  ['x-tenant: alumno01', TENANT_A],
  ['(sin cabecera x-tenant)', undefined],
]);
const FIRST_EVENT: ReadonlyMap<string, (event: AuditEvent) => boolean> = new Map<string, (event: AuditEvent) => boolean>([
  ['program.created', (event) => event.action === 'program.created'],
  ['AL-130', (event) => event.id === 'AL-130'],
]);

/** Esquema 4: cada token lee los eventos de su propio tenant (la cabecera x-tenant no cambia nada). */
const ownTenant: ApiRowHandler = async (row) => {
  const tokenTenant = strict('tenant_del_token', TOKEN_TENANT, cell(row, 'tenant_del_token'));
  const headerTenant = strict('cabecera', HEADER_TENANT, cell(row, 'cabecera'));
  const total = intCell(cell(row, 'total'));
  const primero = cell(row, 'primero');
  const expected = `total ${total}; primero ${primero}`;
  await resetBoth();
  const created = await call('POST', '/programs', {
    tenant: TENANT_A,
    token: (await loginAs(TENANT_A, DEMO.gestor)).token,
    body: { name: 'Programa de aislamiento', ownerId: 'u2', startDate: '2026-03-01', endDate: '2026-12-31', budget: 150000 },
  });
  if (created.status !== 201) return preparationFailed(expected, 'gestor@sigpro.test crea «Programa de aislamiento» en alumno01 (POST /api/programs)', created);
  const login = await loginAs(tokenTenant, DEMO.auditor);
  if (login.token === undefined) return preparationFailed(expected, `auditor@sigpro.test inicia sesión en ${tokenTenant}`, login.result);
  const result = await readAudit(login.token, undefined, headerTenant);
  const first = itemsOf(result)?.[0];
  const sameFirst = first === undefined ? false : strict('primero', FIRST_EVENT, primero)(first);
  return verdictOf([
    responseCheck(result, { status: 200 }),
    check(totalOf(result) === total, `total vale ${total}`, `total vale ${shownTotal(totalOf(result))}`),
    check(sameFirst, `el primer evento es ${primero}`, `el primer evento es ${first?.action ?? '(ninguno)'} con id ${first?.id ?? '(ninguno)'}`),
  ], { evidence: { tokenTenant, headerTenant: headerTenant ?? '(sin cabecera)', programa: field(created.body, 'code') } });
};

defineApiRows({
  story: 'US-AUDITORIA-003',
  surface: 'api',
  tenants: [TENANT_A, TENANT_B],
  handlers: new Map<number, ApiRowHandler>([
    [1, onlyAuditAdmins],
    [2, withoutValidToken],
    [3, permissionBeforeCursor],
    [4, ownTenant],
  ]),
});
