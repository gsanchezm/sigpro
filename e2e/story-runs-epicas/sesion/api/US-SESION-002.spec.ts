import { errorCode, sessionOf, type ApiResult } from '../../../story-runs/support/api';
import { DEMO, TENANT_A, resetTenants } from '../../../story-runs/support/prepare';
import { cell, check, conclude, preparationFailed, responseCheck, strict, type Check } from '../../support/checks';
import { defineApiRows, type ApiRowHandler } from '../../core/framework';
import { attemptText, failGestor, hasTokens, loginAs, patchUser, refresh, shortText, userOf } from './common';

// US-SESION-002 — Rechazar la renovación de una cuenta bloqueada o desactivada (API). Preparación de cada fila: reinicio de alumno01,
// gestor@sigpro.test inicia sesión con remember verdadero y guarda su refreshToken; después, el cambio de estado de la fila
// (PATCH /api/admin/users/u2 con alumno01@sigpro.lab, o los fallos de inicio de sesión con contraseña incorrecta). Si el cambio no se
// produce como dice la historia, la preparación no se cumple.

/** Cambios de estado de la fila: cada valor es el `active` que se envía, en orden. */
const CHANGES: ReadonlyMap<string, readonly boolean[]> = new Map<string, readonly boolean[]>([
  ['active false', [false]],
  ['active false y después active true', [false, true]],
]);

/** El 423 account_locked lo fija US-LOGIN-002 (EP-LOGIN): aquí se comprueba como parte de la cadena de fallos que la fila da por hecha. */
const LOCK_NOTE = 'El código 423 account_locked lo fija US-LOGIN-002 (EP-LOGIN); aquí se comprueba como parte de la cadena de fallos que da por hecha esta fila, no como el Esquema de bloqueo de EP-LOGIN.';

const FAILURES: ReadonlyMap<string, number> = new Map<string, number>([
  ['4', 4],
  ['5', 5],
]);

/** Lo que la historia espera de la renovación, según el texto de la celda «respuesta». */
const RESPONSES: ReadonlyMap<string, (result: ApiResult) => readonly Check[]> = new Map<string, (result: ApiResult) => readonly Check[]>([
  ['401 invalid_token', (result) => [responseCheck(result, { status: 401, code: 'invalid_token' })]],
  [
    '200 con un accessToken, un refreshToken y el usuario gestor@sigpro.test',
    (result) => {
      const user = userOf(result.body);
      return [
        responseCheck(result, { status: 200 }),
        check(hasTokens(result.body), 'trae un accessToken y un refreshToken', hasTokens(result.body) ? 'trae accessToken y refreshToken' : 'falta accessToken o refreshToken'),
        check(user.email === DEMO.gestor.email, 'el usuario gestor@sigpro.test', `el usuario ${shortText(user.email)}`),
      ];
    },
  ],
]);

// --- Esquema 1: una cuenta desactivada no renueva hasta que se vuelve a activar ----------------------------------------------

const deactivation: ApiRowHandler = async (row) => {
  const expected = cell(row, 'respuesta');
  await resetTenants([TENANT_A]);
  const started = await loginAs(DEMO.gestor, true);
  const session = sessionOf(started);
  if (!session) return preparationFailed(expected, 'gestor@sigpro.test inicia sesión con remember true', started);
  for (const active of strict('cambio', CHANGES, cell(row, 'cambio'))) {
    const changed = await patchUser('u2', { active });
    if (changed.status !== 200) return preparationFailed(expected, `alumno01@sigpro.lab envía PATCH /api/admin/users/u2 con active ${String(active)}`, changed);
  }
  const renewed = await refresh(session.refreshToken, TENANT_A);
  return conclude(strict('respuesta', RESPONSES, expected)(renewed));
};

// --- Esquema 2: una cuenta bloqueada no renueva con el quinto fallo consecutivo ----------------------------------------------

const lockedByFailures: ApiRowHandler = async (row) => {
  const count = strict('fallos', FAILURES, cell(row, 'fallos'));
  const expected = cell(row, 'respuesta');
  await resetTenants([TENANT_A]);
  const started = await loginAs(DEMO.gestor, true);
  const session = sessionOf(started);
  if (!session) return preparationFailed(expected, 'gestor@sigpro.test inicia sesión con remember true y guarda su refreshToken', started);
  const attempts = await failGestor(count);
  // Cada fallo anterior al último responde 401 invalid_credentials (la cuenta sigue activa); el último, el 5.º, bloquea con 423
  const earlier = attempts.slice(0, count - 1);
  const earlierCheck = check(
    earlier.every((result) => result.status === 401 && errorCode(result) === 'invalid_credentials'),
    `los fallos 1 a ${count - 1} responden 401 invalid_credentials`,
    `los fallos 1 a ${count - 1} responden ${earlier.map((result) => attemptText(result)).join(', ')}`,
  );
  const last = attempts[count - 1];
  const lastCheck =
    count === 5
      ? check(last?.status === 423 && errorCode(last) === 'account_locked', 'el 5.º fallo responde 423 account_locked (la cuenta queda bloqueada)', `el 5.º fallo responde ${attemptText(last)}`)
      : check(last?.status === 401 && errorCode(last) === 'invalid_credentials', 'el 4.º fallo responde 401 invalid_credentials (la cuenta sigue activa)', `el 4.º fallo responde ${attemptText(last)}`);
  // La renovación se comprueba según su celda («respuesta»): con 4 fallos, 200; con 5, 401 invalid_token
  const renewed = await refresh(session.refreshToken, TENANT_A);
  return conclude([earlierCheck, lastCheck, ...strict('respuesta', RESPONSES, expected)(renewed)], {
    note: LOCK_NOTE,
    evidence: { fallos: count, respuestasDeFallo: attempts.map((result) => attemptText(result)) },
  });
};

defineApiRows({
  story: 'US-SESION-002',
  surface: 'api',
  tenants: [TENANT_A],
  handlers: new Map<number, ApiRowHandler>([
    [1, deactivation],
    [2, lockedByFailures],
  ]),
});
