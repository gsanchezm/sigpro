import { sessionOf } from '../../../story-runs/support/api';
import { TENANT_A, resetTenants } from '../../../story-runs/support/prepare';
import { cell, check, conclude, preparationFailed, strict, type Check } from '../../support/checks';
import { defineApiRows, type ApiRowHandler, type Outcome } from '../../core/framework';
import { ADMIN_A, adminMfaSession, listUsers, patchUser, recordOf, signIn, statusCheck, stateOf, userById, usersOf, type Expect } from './common';

// US-ADMIN-USUARIOS-005 — Impedir quitarse el acceso o dejar el tenant sin admin activo (API).
// Preparación de cada fila: reinicio de alumno01 y su accessToken (alumno01@sigpro.lab, u7). En el seed hay dos admins activos: admin@sigpro.test
// (u1) y alumno01 (u7). Las filas que necesitan un segundo admin activo lo fabrican con PATCH antes de la petición de la fila.

/** Token de alumno01 tras reiniciar el tenant, o el resultado de preparación si el inicio de sesión no responde. */
const adminTokenAfterReset = async (expected: string): Promise<string | Outcome> => {
  await resetTenants([TENANT_A]);
  const admin = await signIn(ADMIN_A, TENANT_A);
  const token = sessionOf(admin)?.accessToken;
  return token ?? preparationFailed(expected, 'alumno01@sigpro.lab inicia sesión tras el reinicio', admin);
};

/** La cuenta alumno01 sigue activa con el rol admin (lo mira un administrador ya autenticado). */
const selfStillAdmin = async (token: string): Promise<Check> => {
  const self = userById(usersOf(await listUsers(token)), 'u7');
  const ok = self?.active === true && self?.role === 'admin';
  return check(ok, 'la cuenta alumno01@sigpro.lab sigue activa con el rol admin', `la cuenta alumno01@sigpro.lab tiene ${stateOf(self)}`);
};

// --- Esquema 1: quien se pide a sí mismo un cambio que lo quita del acceso recibe 409 self_change ------------------------------

const SELF_BODY: ReadonlyMap<string, unknown> = new Map<string, unknown>([
  ['{"active": false}', { active: false }],
  ['{"role": "consultant"}', { role: 'consultant' }],
  ['{"role": "admin"}', { role: 'admin' }],
  ['{"active": true}', { active: true }],
]);

const SELF_OUTCOME: ReadonlyMap<string, { readonly expect: Expect; readonly unchanged: boolean }> = new Map<string, { readonly expect: Expect; readonly unchanged: boolean }>([
  ['409 self_change', { expect: { status: 409, code: 'self_change' }, unchanged: false }],
  ['200 sin cambios', { expect: { status: 200 }, unchanged: true }],
]);

const selfChange: ApiRowHandler = async (row) => {
  const body = strict('cuerpo', SELF_BODY, cell(row, 'cuerpo'));
  const outcome = strict('respuesta', SELF_OUTCOME, cell(row, 'respuesta'));
  const expected = `${cell(row, 'respuesta')}; la cuenta alumno01@sigpro.lab sigue activa con el rol admin`;
  const token = await adminTokenAfterReset(expected);
  if (typeof token !== 'string') return token;
  const sent = await patchUser(token, 'u7', body);
  const sentBody = recordOf(sent.body);
  const unchanged = check(sentBody?.role === 'admin' && sentBody?.active === true, 'la respuesta trae la cuenta tal como estaba: rol admin y activa', `la respuesta trae rol ${String(sentBody?.role)} y active ${String(sentBody?.active)}`);
  return conclude([statusCheck(sent, outcome.expect), ...(outcome.unchanged ? [unchanged] : []), await selfStillAdmin(token)]);
};

// --- Esquema 2: con varios admins activos, un cambio que deja al menos uno se permite ----------------------------------------

const PREPARATION_TWO: ReadonlyMap<string, 'ninguna' | 'gestor-admin'> = new Map<string, 'ninguna' | 'gestor-admin'>([
  ['admin@sigpro.test es admin activo (dos admins activos en total)', 'ninguna'],
  ['ha dado el rol admin a gestor@sigpro.test (tres admins activos en total)', 'gestor-admin'],
]);

const ID_TWO: ReadonlyMap<string, string> = new Map<string, string>([
  ['u1', 'u1'],
  ['u2', 'u2'],
]);

const BODY_TWO: ReadonlyMap<string, unknown> = new Map<string, unknown>([
  ['{"role": "consultant"}', { role: 'consultant' }],
  ['{"active": false}', { active: false }],
]);

/** Lo que debe traer la respuesta: un campo con su valor. */
interface Shown {
  readonly field: 'role' | 'active';
  readonly value: string | boolean;
}

const RESULT_TWO: ReadonlyMap<string, Shown> = new Map<string, Shown>([
  ['el rol consultant', { field: 'role', value: 'consultant' }],
  ['active false', { field: 'active', value: false }],
]);

const severalAdmins: ApiRowHandler = async (row) => {
  const preparation = strict('preparacion', PREPARATION_TWO, cell(row, 'preparacion'));
  const id = strict('id', ID_TWO, cell(row, 'id'));
  const body = strict('cuerpo', BODY_TWO, cell(row, 'cuerpo'));
  const shown = strict('resultado', RESULT_TWO, cell(row, 'resultado'));
  const expected = `200 con ${cell(row, 'resultado')} en el usuario ${id}`;
  const token = await adminTokenAfterReset(expected);
  if (typeof token !== 'string') return token;
  if (preparation === 'gestor-admin') {
    const promoted = await patchUser(token, 'u2', { role: 'admin' });
    if (promoted.status !== 200) return preparationFailed(expected, 'dar el rol admin a gestor@sigpro.test con PATCH /api/admin/users/u2', promoted);
  }
  const sent = await patchUser(token, id, body);
  const sentBody = recordOf(sent.body);
  return conclude([
    statusCheck(sent, { status: 200 }),
    check(sentBody?.id === id && sentBody?.[shown.field] === shown.value, `la respuesta trae el usuario ${id} con ${shown.field} ${String(shown.value)}`, `la respuesta trae el usuario ${String(sentBody?.id)} con ${shown.field} ${String(sentBody?.[shown.field])}`),
  ]);
};

// --- Esquemas 3, 4 y 5: admin@sigpro.test desactivado conserva su accessToken ----------------------------------------------

/**
 * Deja alumno01 como único admin activo: admin@sigpro.test inicia sesión con su segundo factor (y conserva el accessToken) y después
 * alumno01 la desactiva. Devuelve los dos tokens, o el resultado de preparación si algo no se produce.
 */
const onlyOneActiveAdmin = async (expected: string): Promise<{ readonly tokenA: string; readonly tokenU1: string } | Outcome> => {
  const token = await adminTokenAfterReset(expected);
  if (typeof token !== 'string') return token;
  const second = await adminMfaSession();
  if (second.token === undefined) return preparationFailed(expected, 'admin@sigpro.test inicia sesión con su segundo factor', second.result);
  const disabled = await patchUser(token, 'u1', { active: false });
  if (disabled.status !== 200) return preparationFailed(expected, 'desactivar admin@sigpro.test con PATCH /api/admin/users/u1', disabled);
  return { tokenA: token, tokenU1: second.token };
};

const LAST_ADMIN_OUTCOME: ReadonlyMap<string, Expect> = new Map<string, Expect>([
  ['409 last_admin', { status: 409, code: 'last_admin' }],
  ['200 sin cambios', { status: 200 }],
]);

const LAST_BODY: ReadonlyMap<string, unknown> = new Map<string, unknown>([
  ['{"active": false}', { active: false }],
  ['{"role": "consultant"}', { role: 'consultant' }],
  ['{"active": true}', { active: true }],
  ['{"role": "admin"}', { role: 'admin' }],
]);

const lastAdminBlocked: ApiRowHandler = async (row) => {
  const body = strict('cuerpo', LAST_BODY, cell(row, 'cuerpo'));
  const expectedResponse = strict('respuesta', LAST_ADMIN_OUTCOME, cell(row, 'respuesta'));
  const expected = `${cell(row, 'respuesta')}; la cuenta alumno01@sigpro.lab sigue activa con el rol admin`;
  const setup = await onlyOneActiveAdmin(expected);
  if (!('tokenA' in setup)) return setup;
  // El accessToken de admin@sigpro.test (desactivado) sigue valiendo: el permiso lo da el rol del token
  const sent = await patchUser(setup.tokenU1, 'u7', body);
  return conclude([statusCheck(sent, expectedResponse), await selfStillAdmin(setup.tokenA)]);
};

const SELF_LAST_BODY: ReadonlyMap<string, unknown> = new Map<string, unknown>([
  ['{"active": false}', { active: false }],
  ['{"role": "auditor"}', { role: 'auditor' }],
]);

const selfWithOneAdmin: ApiRowHandler = async (row) => {
  const body = strict('cuerpo', SELF_LAST_BODY, cell(row, 'cuerpo'));
  const expected = '409 self_change (no last_admin)';
  const setup = await onlyOneActiveAdmin(expected);
  if (!('tokenA' in setup)) return setup;
  const sent = await patchUser(setup.tokenA, 'u7', body);
  return conclude([statusCheck(sent, { status: 409, code: 'self_change' })]);
};

/** Cambio de una cuenta que no es admin activo: el cuerpo que pide y el campo que debe reflejar la respuesta. */
interface OtherChange {
  readonly body: Readonly<Record<string, unknown>>;
  readonly field: 'active' | 'role';
  readonly value: string | boolean;
}

const OTHER_BODY: ReadonlyMap<string, OtherChange> = new Map<string, OtherChange>([
  ['{"active": false}', { body: { active: false }, field: 'active', value: false }],
  ['{"role": "auditor"}', { body: { role: 'auditor' }, field: 'role', value: 'auditor' }],
]);

const OTHER_ID: ReadonlyMap<string, string> = new Map<string, string>([
  ['u3', 'u3'],
  ['u6', 'u6'],
]);

const nonAdminNeverLast: ApiRowHandler = async (row) => {
  const id = strict('id', OTHER_ID, cell(row, 'id'));
  const change = strict('cuerpo', OTHER_BODY, cell(row, 'cuerpo'));
  const expected = `200 al cambiar ${id} con ${cell(row, 'cuerpo')}, aunque admin@sigpro.test ya no esté activo`;
  const setup = await onlyOneActiveAdmin(expected);
  if (!('tokenA' in setup)) return setup;
  const sent = await patchUser(setup.tokenU1, id, change.body);
  const sentBody = recordOf(sent.body);
  return conclude([
    statusCheck(sent, { status: 200 }),
    check(sentBody?.[change.field] === change.value, `la respuesta trae ${change.field} ${String(change.value)}`, `la respuesta trae ${change.field} ${String(sentBody?.[change.field])}`),
  ]);
};

defineApiRows({
  story: 'US-ADMIN-USUARIOS-005',
  surface: 'api',
  tenants: [TENANT_A],
  handlers: new Map<number, ApiRowHandler>([
    [1, selfChange],
    [2, severalAdmins],
    [3, lastAdminBlocked],
    [4, selfWithOneAdmin],
    [5, nonAdminNeverLast],
  ]),
});
