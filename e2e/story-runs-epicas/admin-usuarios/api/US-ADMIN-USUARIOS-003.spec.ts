import { call, field, sessionOf } from '../../../story-runs/support/api';
import { DEMO, TENANT_A, resetTenants } from '../../../story-runs/support/prepare';
import { cell, check, conclude, preparationFailed, strict } from '../../support/checks';
import { defineApiRows, type ApiRowHandler } from '../../core/framework';
import {
  ACCOUNTS,
  ADMIN_A,
  BOOLEANS,
  LIST_RESPONSES,
  ROLE_VALUES,
  SEED_IDS,
  auditTotal,
  diffOf,
  hasUserShape,
  latestAudit,
  listUsers,
  loginRoleOf,
  noSessionTokens,
  patchUser,
  recordOf,
  sameObject,
  sessionTokens,
  signIn,
  statusCheck,
  userByEmail,
  userById,
  usersOf,
  type Expect,
} from './common';

// US-ADMIN-USUARIOS-003 — Cambiar el rol o el estado de un usuario del tenant (API).
// Preparación de cada fila: reinicio de alumno01; alumno01@sigpro.lab inicia sesión y usa su accessToken en PATCH /api/admin/users/<id>
// con x-tenant alumno01. Las filas que necesitan un estado previo lo fabrican con otros PATCH antes de la petición de la fila.

// --- Esquema 1: un rol válido se aplica a la cuenta --------------------------------------------------------------------------

const roleApplied: ApiRowHandler = async (row) => {
  const id = strict('id', SEED_IDS, cell(row, 'id'));
  const credentials = strict('correo', ACCOUNTS, cell(row, 'correo'));
  const email = credentials.email;
  const role = strict('rol_nuevo', ROLE_VALUES, cell(row, 'rol_nuevo'));
  const expected = `200 con el usuario ${email} y el rol ${role}; GET /api/admin/users muestra el rol ${role} para ${email}`;
  await resetTenants([TENANT_A]);
  const admin = await signIn(ADMIN_A, TENANT_A);
  const token = sessionOf(admin)?.accessToken;
  if (token === undefined) return preparationFailed(expected, 'alumno01@sigpro.lab inicia sesión', admin);
  const before = userById(usersOf(await listUsers(token)), id);
  const changed = await patchUser(token, id, { role });
  const body = recordOf(changed.body);
  const after = userByEmail(usersOf(await listUsers(token)), email);
  // Regla: cambiar el rol no toca la contraseña. Con la de siempre la cuenta sigue «aceptada»: 200, o 403 pending_approval si la pendencia lo corta después
  const login = await signIn(credentials, TENANT_A);
  const passwordKept = login.status === 200 || field(login.body, 'code') === 'pending_approval';
  return conclude([
    statusCheck(changed, { status: 200 }),
    check(body?.email === email && body?.role === role, `el usuario ${email} con el rol ${role}`, `el usuario ${String(body?.email)} con el rol ${String(body?.role)}`),
    check(hasUserShape(body), 'el usuario con los campos del listado (id, name, email, role, active, locked, pending y org)', `claves: ${Object.keys(body ?? {}).sort().join(', ') || '(ninguna)'}`),
    check(after?.role === role, `GET /api/admin/users muestra el rol ${role} para ${email}`, `GET /api/admin/users muestra el rol ${String(after?.role)} para ${email}`),
    // Regla: cambiar el rol no toca el estado (activo, bloqueo y pendencia siguen igual)
    check(
      before !== undefined && body?.active === before.active && body?.locked === before.locked && body?.pending === before.pending,
      'active, locked y pending siguen como estaban',
      `antes active ${String(before?.active)}, locked ${String(before?.locked)}, pending ${String(before?.pending)}; después active ${String(body?.active)}, locked ${String(body?.locked)}, pending ${String(body?.pending)}`,
    ),
    check(passwordKept, 'la contraseña de siempre sigue sirviendo', `inicio de sesión con la contraseña de siempre: ${login.status}${typeof field(login.body, 'code') === 'string' ? ` ${String(field(login.body, 'code'))}` : ''}`),
  ]);
};

// --- Esquema 2: un valor igual al que la cuenta tiene no cambia nada ---------------------------------------------------------

const sameValueNoChange: ApiRowHandler = async (row) => {
  const id = strict('id', SEED_IDS, cell(row, 'id'));
  const email = strict('correo', ACCOUNTS, cell(row, 'correo')).email;
  const role = strict('rol', ROLE_VALUES, cell(row, 'rol'));
  const expected = `200 con el usuario ${email} tal como estaba, con el rol ${role}; el total de GET /api/audit sigue igual`;
  await resetTenants([TENANT_A]);
  const admin = await signIn(ADMIN_A, TENANT_A);
  const token = sessionOf(admin)?.accessToken;
  if (token === undefined) return preparationFailed(expected, 'alumno01@sigpro.lab inicia sesión', admin);
  const totalBefore = await auditTotal(token);
  if (totalBefore === undefined) return preparationFailed(expected, 'leer el total de GET /api/audit', admin);
  const before = userById(usersOf(await listUsers(token)), id);
  const changed = await patchUser(token, id, { role });
  const body = recordOf(changed.body);
  const totalAfter = await auditTotal(token);
  return conclude([
    statusCheck(changed, { status: 200 }),
    check(body?.email === email && body?.role === role, `el usuario ${email} con el rol ${role}`, `el usuario ${String(body?.email)} con el rol ${String(body?.role)}`),
    check(sameObject(body, before), 'el usuario tal como estaba en el listado', `tras el cambio ${JSON.stringify(body ?? null)}; en el listado de antes ${JSON.stringify(before ?? null)}`),
    check(totalAfter === totalBefore, `el total de GET /api/audit sigue en ${String(totalBefore)}`, `el total de GET /api/audit pasa de ${String(totalBefore)} a ${String(totalAfter)}`),
  ]);
};

// --- Esquema 3: la cuenta desactivada vuelve a abrir sesión solo cuando queda activa -------------------------------------------

const LOGIN_OUTCOME: ReadonlyMap<string, { readonly expect: Expect; readonly session: boolean }> = new Map<string, { readonly expect: Expect; readonly session: boolean }>([
  ['200 con accessToken, refreshToken y el usuario con el rol auditor', { expect: { status: 200 }, session: true }],
  ['403 account_disabled sin ningún token', { expect: { status: 403, code: 'account_disabled' }, session: false }],
]);

const reactivatedLogin: ApiRowHandler = async (row) => {
  const active = strict('activa', BOOLEANS, cell(row, 'activa'));
  const outcome = strict('respuesta_login', LOGIN_OUTCOME, cell(row, 'respuesta_login'));
  const expected = `PATCH u4 con active ${String(active)} responde 200; auditor@sigpro.test inicia sesión: ${cell(row, 'respuesta_login')}`;
  await resetTenants([TENANT_A]);
  const admin = await signIn(ADMIN_A, TENANT_A);
  const token = sessionOf(admin)?.accessToken;
  if (token === undefined) return preparationFailed(expected, 'alumno01@sigpro.lab inicia sesión', admin);
  // Regla: el refreshToken de la cuenta, emitido mientras estaba activa, deja de renovar al desactivarla
  const earlier = await signIn(DEMO.auditor, TENANT_A);
  const refreshToken = sessionOf(earlier)?.refreshToken;
  if (refreshToken === undefined) return preparationFailed(expected, 'auditor@sigpro.test inicia sesión antes de desactivarla', earlier);
  // La fila parte de «ha desactivado la cuenta auditor@sigpro.test» (preparación del Esquema)
  const disabled = await patchUser(token, 'u4', { active: false });
  if (disabled.status !== 200) return preparationFailed(expected, 'desactivar auditor@sigpro.test con PATCH /api/admin/users/u4', disabled);
  const changed = await patchUser(token, 'u4', { active });
  const login = await signIn(DEMO.auditor, TENANT_A);
  // Solo cuando la cuenta queda desactivada, su refreshToken previo debe responder 401 invalid_token
  const renewed = outcome.session ? undefined : await call('POST', '/auth/refresh', { tenant: TENANT_A, body: { refreshToken } });
  return conclude([
    statusCheck(changed, { status: 200 }),
    check(recordOf(changed.body)?.active === active, `la cuenta u4 queda con active ${String(active)}`, `la cuenta u4 queda con active ${String(recordOf(changed.body)?.active)}`),
    statusCheck(login, outcome.expect),
    outcome.session ? sessionTokens(login) : noSessionTokens(login),
    ...(outcome.session ? [check(loginRoleOf(login) === 'auditor', 'el usuario con el rol auditor', `el usuario con el rol ${loginRoleOf(login) ?? '(ausente)'}`)] : []),
    ...(renewed === undefined ? [] : [statusCheck(renewed, { status: 401, code: 'invalid_token' })]),
  ]);
};

// --- Esquema 4: reactivar no quita el bloqueo ni aprueba una cuenta pendiente de aprobación -----------------------------------

const PASSWORDS: ReadonlyMap<string, string> = new Map<string, string>([
  ['Block1234!', DEMO.bloqueado.password],
  ['Pend1234!', DEMO.pendiente.password],
]);

const LOCK_OUTCOME: ReadonlyMap<string, Expect> = new Map<string, Expect>([
  ['423 account_locked', { status: 423, code: 'account_locked' }],
  ['403 pending_approval', { status: 403, code: 'pending_approval' }],
]);

const reactivationKeepsBlock: ApiRowHandler = async (row) => {
  const id = strict('id', SEED_IDS, cell(row, 'id'));
  const email = strict('correo', ACCOUNTS, cell(row, 'correo')).email;
  const password = strict('contraseña', PASSWORDS, cell(row, 'contraseña'));
  const expectedResponse = strict('respuesta', LOCK_OUTCOME, cell(row, 'respuesta'));
  const expected = `${email} inicia sesión con ${cell(row, 'contraseña')}: ${cell(row, 'respuesta')}`;
  await resetTenants([TENANT_A]);
  const admin = await signIn(ADMIN_A, TENANT_A);
  const token = sessionOf(admin)?.accessToken;
  if (token === undefined) return preparationFailed(expected, 'alumno01@sigpro.lab inicia sesión', admin);
  const off = await patchUser(token, id, { active: false });
  if (off.status !== 200) return preparationFailed(expected, `desactivar ${email} con PATCH /api/admin/users/${id}`, off);
  const on = await patchUser(token, id, { active: true });
  if (on.status !== 200) return preparationFailed(expected, `reactivar ${email} con PATCH /api/admin/users/${id}`, on);
  const login = await signIn({ email, password }, TENANT_A);
  return conclude([statusCheck(login, expectedResponse)]);
};

// --- Esquema 5: cada cambio aplicado deja su registro de auditoría ------------------------------------------------------------

const DIFF_CELLS: ReadonlyMap<string, Readonly<Record<string, unknown>>> = new Map<string, Readonly<Record<string, unknown>>>([
  ['active false', { active: false }],
  ['role auditor', { role: 'auditor' }],
  ['active false y role auditor', { active: false, role: 'auditor' }],
]);

const BODY_CELLS: ReadonlyMap<string, Readonly<Record<string, unknown>>> = new Map<string, Readonly<Record<string, unknown>>>([
  ['{"active": false}', { active: false }],
  ['{"role": "auditor"}', { role: 'auditor' }],
  ['{"active": false, "role": "auditor"}', { active: false, role: 'auditor' }],
]);

const auditRecorded: ApiRowHandler = async (row) => {
  const id = strict('id', SEED_IDS, cell(row, 'id'));
  const body = strict('cuerpo', BODY_CELLS, cell(row, 'cuerpo'));
  const diff = strict('diff', DIFF_CELLS, cell(row, 'diff'));
  const expected = `200; el registro más reciente de GET /api/audit: user.updated, entidad user, id ${id}, actor u7, diff ${JSON.stringify(diff)}`;
  await resetTenants([TENANT_A]);
  const admin = await signIn(ADMIN_A, TENANT_A);
  const token = sessionOf(admin)?.accessToken;
  if (token === undefined) return preparationFailed(expected, 'alumno01@sigpro.lab inicia sesión', admin);
  const changed = await patchUser(token, id, body);
  const latest = await latestAudit(token);
  const observedDiff = diffOf(latest);
  return conclude([
    statusCheck(changed, { status: 200 }),
    check(latest?.action === 'user.updated', 'la acción del registro es user.updated', `la acción del registro es ${String(latest?.action)}`),
    check(latest?.entity === 'user', 'la entidad del registro es user', `la entidad del registro es ${String(latest?.entity)}`),
    check(latest?.entityId === id, `el id del registro es ${id}`, `el id del registro es ${String(latest?.entityId)}`),
    check(latest?.actorId === 'u7', 'el actor del registro es u7', `el actor del registro es ${String(latest?.actorId)}`),
    check(sameObject(observedDiff, diff), `el diff solo trae ${JSON.stringify(diff)}`, `el diff trae ${JSON.stringify(observedDiff ?? null)}`),
  ]);
};

// --- Esquema 6: el rol nuevo solo llega con un inicio de sesión nuevo --------------------------------------------------------

const roleNeedsNewLogin: ApiRowHandler = async (row) => {
  const role = strict('rol_nuevo', ROLE_VALUES, cell(row, 'rol_nuevo'));
  const expectedNew = strict('respuesta_nueva', LIST_RESPONSES, cell(row, 'respuesta_nueva'));
  const expected = `consultor@sigpro.test con el accessToken anterior: 403 forbidden; tras volver a iniciar sesión: ${cell(row, 'respuesta_nueva')}`;
  await resetTenants([TENANT_A]);
  const first = await signIn(DEMO.consultor, TENANT_A);
  const oldToken = sessionOf(first)?.accessToken;
  if (oldToken === undefined) return preparationFailed(expected, 'consultor@sigpro.test inicia sesión', first);
  const admin = await signIn(ADMIN_A, TENANT_A);
  const token = sessionOf(admin)?.accessToken;
  if (token === undefined) return preparationFailed(expected, 'alumno01@sigpro.lab inicia sesión', admin);
  const changed = await patchUser(token, 'u3', { role });
  if (changed.status !== 200) return preparationFailed(expected, `cambiar el rol de consultor@sigpro.test a ${role} con PATCH /api/admin/users/u3`, changed);
  const withOld = await listUsers(oldToken);
  const again = await signIn(DEMO.consultor, TENANT_A);
  const newToken = sessionOf(again)?.accessToken;
  const withNew = newToken === undefined ? undefined : await listUsers(newToken);
  return conclude([
    statusCheck(withOld, { status: 403, code: 'forbidden' }),
    check(newToken !== undefined, 'consultor@sigpro.test vuelve a iniciar sesión', newToken !== undefined ? 'vuelve a iniciar sesión' : `no inicia sesión (respuesta ${again.status})`),
    ...(withNew === undefined ? [check(false, `respuesta ${expectedNew.status} con la nueva sesión`, 'sin nueva sesión, no se pide la lista')] : [statusCheck(withNew, expectedNew)]),
  ]);
};

defineApiRows({
  story: 'US-ADMIN-USUARIOS-003',
  surface: 'api',
  tenants: [TENANT_A],
  handlers: new Map<number, ApiRowHandler>([
    [1, roleApplied],
    [2, sameValueNoChange],
    [3, reactivatedLogin],
    [4, reactivationKeepsBlock],
    [5, auditRecorded],
    [6, roleNeedsNewLogin],
  ]),
});
