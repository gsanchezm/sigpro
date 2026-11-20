import { sessionOf } from '../../../story-runs/support/api';
import { DEMO, TENANT_A, resetTenants } from '../../../story-runs/support/prepare';
import { cell, check, conclude, preparationFailed, responseCheck, strict } from '../../support/checks';
import { defineApiRows, type ApiRowHandler } from '../../core/framework';
import {
  ACCOUNTS,
  ADMIN_A,
  EXPECT_BY_CELL,
  alteredLast,
  listUsers,
  loginRoleOf,
  patchUser,
  rawCall,
  signIn,
  statusCheck,
  stateOf,
  userById,
  usersOf,
  type Expect,
} from './common';

// US-ADMIN-USUARIOS-002 — Permiso de administración de usuarios solo para el rol admin (API).
// Preparación de cada fila: reinicio de alumno01; cada cuenta de la fila inicia sesión con su contraseña del seed y usa el accessToken
// que recibe. La fila sin token (Esquema 4) solo reinicia alumno01 y envía la cabecera que dice su celda.

// --- Esquema 1: solo el rol admin recibe la lista de usuarios -----------------------------------------------------------------

/** Clave de administración del entorno (la misma que usa el arnés); no sustituye al token en estos endpoints. */
const ADMIN_KEY = process.env.ADMIN_KEY ?? 'dev-admin-key';

const LIST_EXPECT: ReadonlyMap<string, Expect> = new Map<string, Expect>([
  ['200 con la lista de usuarios', { status: 200 }],
  ['403 forbidden', { status: 403, code: 'forbidden' }],
]);

const onlyAdminLists: ApiRowHandler = async (row) => {
  const credentials = strict('correo', ACCOUNTS, cell(row, 'correo'));
  const role = strict('rol', new Map<string, string>([['admin', 'admin'], ['program_manager', 'program_manager'], ['consultant', 'consultant'], ['auditor', 'auditor']]), cell(row, 'rol'));
  const answer = cell(row, 'respuesta');
  const expectedResponse = strict('respuesta', LIST_EXPECT, answer);
  const expected = `${answer}; la cuenta ${cell(row, 'correo')} con el rol ${role}`;
  await resetTenants([TENANT_A]);
  const login = await signIn(credentials, TENANT_A);
  const token = sessionOf(login)?.accessToken;
  if (token === undefined) return preparationFailed(expected, `${cell(row, 'correo')} inicia sesión en alumno01`, login);
  const list = await listUsers(token);
  const users = usersOf(list);
  return conclude([
    responseCheck(list, expectedResponse),
    check(loginRoleOf(login) === role, `inicia sesión con el rol ${role}`, `inicia sesión con el rol ${loginRoleOf(login) ?? '(ausente)'}`),
    ...(expectedResponse.status === 200 ? [check(Array.isArray(list.body) && users.length > 0, 'responde con la lista de usuarios', Array.isArray(list.body) ? `responde con una lista de ${users.length} usuarios` : 'no responde con una lista')] : []),
  ]);
};

// --- Esquema 2: un rol sin el permiso no cambia ninguna cuenta ---------------------------------------------------------------

const roleCannotChange: ApiRowHandler = async (row) => {
  const credentials = strict('correo', ACCOUNTS, cell(row, 'correo'));
  const role = cell(row, 'rol');
  const expected = `403 forbidden; ${DEMO.auditor.email} sigue pudiendo iniciar sesión en alumno01 con Audit1234!`;
  await resetTenants([TENANT_A]);
  const actor = await signIn(credentials, TENANT_A);
  const token = sessionOf(actor)?.accessToken;
  if (token === undefined) return preparationFailed(expected, `${cell(row, 'correo')} inicia sesión en alumno01`, actor);
  const patched = await patchUser(token, 'u4', { active: false });
  const auditorLogin = await signIn(DEMO.auditor, TENANT_A);
  const adminToken = sessionOf(await signIn(ADMIN_A, TENANT_A))?.accessToken;
  const auditor = adminToken === undefined ? undefined : userById(usersOf(await listUsers(adminToken)), 'u4');
  const loginOk = auditorLogin.status === 200 && sessionOf(auditorLogin) !== undefined;
  return conclude([
    statusCheck(patched, { status: 403, code: 'forbidden' }),
    check(loginOk, `${DEMO.auditor.email} sigue pudiendo iniciar sesión en alumno01 con Audit1234!`, loginOk ? `${DEMO.auditor.email} inicia sesión` : `${DEMO.auditor.email} no inicia sesión (respuesta ${auditorLogin.status})`),
    // Regla: un 403 no cambia ninguna cuenta: la del auditor sigue igual en el listado
    check(auditor?.active === true && auditor?.role === 'auditor', 'la cuenta u4 sigue con el rol auditor y activa', `la cuenta u4: ${stateOf(auditor)}`),
    check(loginRoleOf(actor) === role, `la fila actúa con el rol ${role}`, `la fila actúa con el rol ${loginRoleOf(actor) ?? '(ausente)'}`),
  ]);
};

// --- Esquema 3: el permiso se comprueba antes que el cuerpo y que el id -------------------------------------------------------

const ID_CELLS: ReadonlyMap<string, string> = new Map<string, string>([
  ['u99', 'u99'],
  ['u1', 'u1'],
]);

const BODY_CELLS: ReadonlyMap<string, unknown> = new Map<string, unknown>([
  ['{"active": false}', { active: false }],
  ['{"role": "dios"}', { role: 'dios' }],
  ['{}', {}],
]);

const permissionBeforeBody: ApiRowHandler = async (row) => {
  const id = strict('id', ID_CELLS, cell(row, 'id'));
  const body = strict('cuerpo', BODY_CELLS, cell(row, 'cuerpo'));
  await resetTenants([TENANT_A]);
  const consultor = await signIn(DEMO.consultor, TENANT_A);
  const token = sessionOf(consultor)?.accessToken;
  if (token === undefined) return preparationFailed('403 forbidden y no 422 ni 404', 'consultor@sigpro.test inicia sesión en alumno01', consultor);
  const patched = await patchUser(token, id, body);
  return conclude([
    statusCheck(patched, { status: 403, code: 'forbidden' }),
    check(patched.status !== 422 && patched.status !== 404, 'no responde 422 ni 404', `responde ${patched.status}`),
  ]);
};

// --- Esquema 4: sin un token válido la respuesta es 401 -----------------------------------------------------------------------

const METHODS: ReadonlyMap<string, 'GET' | 'PATCH'> = new Map<string, 'GET' | 'PATCH'>([
  ['GET', 'GET'],
  ['PATCH', 'PATCH'],
]);

const PATHS: ReadonlyMap<string, string> = new Map<string, string>([
  ['/api/admin/users', '/admin/users'],
  ['/api/admin/users/u4', '/admin/users/u4'],
]);

/** Cabecera `Authorization` de la celda: ninguna, un token inventado o el de alumno01 con su última letra cambiada. */
const AUTHORIZATIONS: ReadonlyMap<string, (token: string | undefined) => string | undefined> = new Map<string, (token: string | undefined) => string | undefined>([
  ['(sin cabecera)', () => undefined],
  ['Bearer token-inventado', () => 'Bearer token-inventado'],
  ['Bearer (token de alumno01 con una letra cambiada)', (token) => (token === undefined ? undefined : `Bearer ${alteredLast(token)}`)],
]);

const withoutValidToken: ApiRowHandler = async (row) => {
  const method = strict('metodo', METHODS, cell(row, 'metodo'));
  const path = strict('ruta', PATHS, cell(row, 'ruta'));
  const authorization = strict('autorizacion', AUTHORIZATIONS, cell(row, 'autorizacion'));
  const expectedResponse = strict('respuesta', EXPECT_BY_CELL, cell(row, 'respuesta'));
  const expected = `${cell(row, 'respuesta')} (${method} ${cell(row, 'ruta')})`;
  await resetTenants([TENANT_A]);
  const admin = await signIn(ADMIN_A, TENANT_A);
  const token = sessionOf(admin)?.accessToken;
  // La fila con el token de alumno01 alterado necesita ese token: sin él no hay petición que juzgar
  if (token === undefined && cell(row, 'autorizacion').includes('alumno01')) return preparationFailed(expected, 'alumno01@sigpro.lab inicia sesión para alterar su accessToken', admin);
  const header = authorization(token);
  const headers: Record<string, string> = { 'x-tenant': TENANT_A, ...(header === undefined ? {} : { authorization: header }) };
  const sent = await rawCall(method, path, headers, method === 'PATCH' ? { active: false } : undefined);
  // Regla: la clave de administración (X-Admin-Key) no sustituye al token en estos dos endpoints: también con la clave, 401 missing_token
  const keyed = await rawCall('GET', '/admin/users', { 'x-tenant': TENANT_A, 'x-admin-key': ADMIN_KEY });
  const keyedPatch = await rawCall('PATCH', '/admin/users/u4', { 'x-tenant': TENANT_A, 'x-admin-key': ADMIN_KEY }, { active: false });
  return conclude([
    statusCheck(sent, expectedResponse),
    statusCheck(keyed, { status: 401, code: 'missing_token' }),
    statusCheck(keyedPatch, { status: 401, code: 'missing_token' }),
  ]);
};

defineApiRows({
  story: 'US-ADMIN-USUARIOS-002',
  surface: 'api',
  tenants: [TENANT_A],
  handlers: new Map<number, ApiRowHandler>([
    [1, onlyAdminLists],
    [2, roleCannotChange],
    [3, permissionBeforeBody],
    [4, withoutValidToken],
  ]),
});
