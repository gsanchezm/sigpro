import { call, errorCode, field, login, type ApiResult } from '../../../story-runs/support/api';
import { DEMO, TENANT_A, WRONG_PASSWORD, failedLogins } from '../../../story-runs/support/prepare';
import { cell, check, preparationFailed, strict } from '../../support/checks';
import { defineApiRows, type ApiRowHandler } from '../../core/framework';
import { GESTOR, adminAccess, expectCheck, prepareTenant, rowOutcome, sessionOfAccount, shown, withRestore, withToken, type Expect } from './common';

// US-CAOS-RESET-002 — Tras el reinicio, las cuentas vuelven al estado del seed (API). Cada fila reinicia alumno01 antes de fabricar
// su estado previo (bloqueo, desactivación, intentos, rol) y al terminar vuelve a reiniciarlo y apaga el caos (`withRestore`).

/** Estado previo del Esquema 1 de gestor@sigpro.test. */
type PreviousState = 'bloqueada' | 'desactivada';
const PREVIOUS_STATES: ReadonlyMap<string, PreviousState> = new Map<string, PreviousState>([
  ['ha acumulado 5 intentos fallidos consecutivos, su cuenta está bloqueada y entrar con la contraseña correcta responde 423 account_locked', 'bloqueada'],
  ['ha sido desactivada por un administrador y entrar con la contraseña correcta responde 403 account_disabled', 'desactivada'],
]);

/** Respuesta de la cuenta del seed bloqueada o pendiente (Esquema 3). */
const SEED_RESPONSES: ReadonlyMap<string, Expect> = new Map<string, Expect>([
  ['423 account_locked', { status: 423, code: 'account_locked' }],
  ['403 pending_approval', { status: 403, code: 'pending_approval' }],
]);

/** Cuentas del seed que conservan su estado tras el reinicio (Esquema 3). */
const SEED_ACCOUNTS: ReadonlyMap<string, string> = new Map<string, string>([
  ['bloqueado@sigpro.test', DEMO.bloqueado.email],
  ['pendiente@sigpro.test', DEMO.pendiente.email],
]);

/** Número de fallos previos de gestor@sigpro.test (Esquema 2). */
const FAILURES: ReadonlyMap<string, number> = new Map<string, number>([
  ['4', 4],
  ['5', 5],
]);

/** Rol que la prueba asigna a gestor@sigpro.test antes del reinicio (Esquema 4). */
const ASSIGNED_ROLES: ReadonlyMap<string, string> = new Map<string, string>([
  ['consultant', 'consultant'],
  ['auditor', 'auditor'],
]);

/** Rol que debe tener tras el reinicio: el del seed, `program_manager`. */
const SEED_ROLES: ReadonlyMap<string, string> = new Map<string, string>([['program_manager', 'program_manager']]);

/** Rol del usuario de un cuerpo de inicio de sesión (`user.role`), o `undefined` si no se lee. */
const loginRoleOf = (result: ApiResult): string | undefined => {
  const user = field(result.body, 'user');
  const role = typeof user === 'object' && user !== null ? field(user, 'role') : undefined;
  return typeof role === 'string' ? role : undefined;
};

// --- Esquema 1: el reinicio devuelve la cuenta bloqueada o desactivada a su estado del seed ----------------------------------

const restoresBlockedOrDisabled: ApiRowHandler = async (row) => {
  const state = strict('estado_previo', PREVIOUS_STATES, cell(row, 'estado_previo'));
  const expected = 'la respuesta es 200 con accessToken (gestor@sigpro.test entra con la contraseña correcta tras el reinicio)';
  return withRestore([TENANT_A], async () => {
    await prepareTenant(TENANT_A);
    const admin = await adminAccess(TENANT_A);
    if (state === 'bloqueada') {
      await failedLogins(TENANT_A, GESTOR.email, 5);
      const locked = await sessionOfAccount(TENANT_A, GESTOR);
      if (locked.result.status !== 423 || errorCode(locked.result) !== 'account_locked') {
        return preparationFailed(expected, 'gestor@sigpro.test tiene 5 intentos fallidos y entra con la contraseña correcta', locked.result);
      }
    } else {
      const disabled = await withToken('PATCH', '/admin/users/u2', TENANT_A, admin, { active: false });
      if (disabled.status !== 200) return preparationFailed(expected, 'alumno01@sigpro.lab desactiva a gestor@sigpro.test con PATCH /api/admin/users/u2', disabled);
      const blocked = await sessionOfAccount(TENANT_A, GESTOR);
      if (blocked.result.status !== 403 || errorCode(blocked.result) !== 'account_disabled') {
        return preparationFailed(expected, 'gestor@sigpro.test desactivado entra con la contraseña correcta', blocked.result);
      }
    }
    const reset = await call('POST', '/admin/reset', { tenant: TENANT_A, token: admin });
    const after = await sessionOfAccount(TENANT_A, GESTOR);
    return rowOutcome([
      expectCheck(reset, 'la respuesta del reinicio es 200', { status: 200 }),
      expectCheck(after.result, expected, { status: 200, accessToken: true }),
    ]);
  });
};

// --- Esquema 2: tras el reinicio, un fallo cuenta desde cero -----------------------------------------------------------------

const failureCountsFromZero: ApiRowHandler = async (row) => {
  const previous = strict('fallos_previos', FAILURES, cell(row, 'fallos_previos'));
  const expected = 'la respuesta es 401 invalid_credentials con attempts 1';
  return withRestore([TENANT_A], async () => {
    await prepareTenant(TENANT_A);
    const admin = await adminAccess(TENANT_A);
    const attempts = await failedLogins(TENANT_A, GESTOR.email, previous);
    // Antes del reinicio: cada fallo previo responde 401 con su número; el último (5.º) bloquea. Si no es así, no hay estado previo.
    const last = attempts[attempts.length - 1];
    const lastOk = previous === 5 ? last?.status === 423 : last?.status === 401 && field(last.body, 'attempts') === previous;
    if (last === undefined || !lastOk) {
      return preparationFailed(expected, `gestor@sigpro.test acumula ${previous} intentos fallidos consecutivos`, last ?? { status: 0, body: null, ms: 0 });
    }
    const reset = await call('POST', '/admin/reset', { tenant: TENANT_A, token: admin });
    const wrong = await login({ tenant: TENANT_A, email: GESTOR.email, password: WRONG_PASSWORD });
    return rowOutcome([
      expectCheck(reset, 'la respuesta del reinicio es 200', { status: 200 }),
      expectCheck(wrong, expected, { status: 401, code: 'invalid_credentials', attempts: 1 }),
    ]);
  });
};

// --- Esquema 3: las cuentas bloqueada y pendiente del seed conservan su estado ----------------------------------------------

const seedAccountsKeepState: ApiRowHandler = async (row) => {
  const email = strict('cuenta', SEED_ACCOUNTS, cell(row, 'cuenta'));
  const password = cell(row, 'contraseña');
  const expected = cell(row, 'respuesta');
  const expect = strict('respuesta', SEED_RESPONSES, expected);
  return withRestore([TENANT_A], async () => {
    await prepareTenant(TENANT_A);
    const result = await login({ tenant: TENANT_A, email, password });
    return rowOutcome([expectCheck(result, `la respuesta es ${expected}`, expect)]);
  });
};

// --- Esquema 4: el reinicio devuelve el rol que da el seed ------------------------------------------------------------------

const restoresSeedRole: ApiRowHandler = async (row) => {
  const assigned = strict('rol_asignado', ASSIGNED_ROLES, cell(row, 'rol_asignado'));
  const seedRole = strict('rol_tras_reinicio', SEED_ROLES, cell(row, 'rol_tras_reinicio'));
  const expected = `el usuario de la respuesta tiene el rol ${seedRole}`;
  return withRestore([TENANT_A], async () => {
    await prepareTenant(TENANT_A);
    const admin = await adminAccess(TENANT_A);
    const changed = await withToken('PATCH', '/admin/users/u2', TENANT_A, admin, { role: assigned });
    if (changed.status !== 200) return preparationFailed(expected, `alumno01@sigpro.lab cambia el rol de gestor@sigpro.test a ${assigned} con PATCH /api/admin/users/u2`, changed);
    const reset = await call('POST', '/admin/reset', { tenant: TENANT_A, token: admin });
    const after = await login({ tenant: TENANT_A, email: GESTOR.email, password: GESTOR.password });
    const role = loginRoleOf(after);
    return rowOutcome([
      expectCheck(reset, 'la respuesta del reinicio es 200', { status: 200 }),
      expectCheck(after, 'la respuesta del inicio de sesión es 200', { status: 200 }),
      check(role === seedRole, `el usuario de la respuesta tiene el rol ${seedRole}`, `el usuario de la respuesta tiene el rol ${shown(role)}`),
    ]);
  });
};

defineApiRows({
  story: 'US-CAOS-RESET-002',
  surface: 'api',
  tenants: [TENANT_A],
  handlers: new Map<number, ApiRowHandler>([
    [1, restoresBlockedOrDisabled],
    [2, failureCountsFromZero],
    [3, seedAccountsKeepState],
    [4, restoresSeedRole],
  ]),
});
