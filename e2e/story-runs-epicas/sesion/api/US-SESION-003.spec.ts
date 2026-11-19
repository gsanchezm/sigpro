import { call, sessionOf } from '../../../story-runs/support/api';
import { DEMO, TENANT_A, resetTenants } from '../../../story-runs/support/prepare';
import { cell, check, conclude, errorsOf, noTokensCheck, preparationFailed, responseCheck, strict, type Check } from '../../support/checks';
import { defineApiRows, type ApiRowHandler } from '../../support/framework';
import { alteredLast, loginAs, mfaTokenOfAdmin, refresh, shortText } from './common';

// US-SESION-003 — Rechazar la renovación con un token que no sirve o con un cuerpo inválido (API). Preparación de cada fila: reinicio de
// alumno01; gestor@sigpro.test inicia sesión con remember verdadero (guarda su refreshToken y su accessToken) y admin@sigpro.test
// recibe su mfaToken sin completar el segundo paso. Todas las peticiones llevan x-tenant alumno01.

/** Lo que se envía como refreshToken en la fila; los tokens se calculan con la sesión de la fila. */
interface Prepared {
  readonly refreshToken: string;
  readonly accessToken: string;
  readonly mfaToken: string;
}

/** Cada texto de la celda «token» da el valor que se envía como refreshToken. */
const TOKENS: ReadonlyMap<string, (prepared: Prepared) => string> = new Map<string, (prepared: Prepared) => string>([
  ['un texto que no es un token', () => 'un texto que no es un token'],
  ['la letra x', () => 'x'],
  ['el refreshToken de gestor@sigpro.test con su última letra cambiada', (prepared) => alteredLast(prepared.refreshToken)],
  ['el accessToken de gestor@sigpro.test', (prepared) => prepared.accessToken],
  ['el mfaToken de admin@sigpro.test', (prepared) => prepared.mfaToken],
]);

const notAToken: ApiRowHandler = async (row) => {
  const expected = '401 invalid_token; sin tokens de sesión';
  await resetTenants([TENANT_A]);
  const started = await loginAs(DEMO.gestor, true);
  const session = sessionOf(started);
  if (!session) return preparationFailed(expected, 'gestor@sigpro.test inicia sesión con remember true', started);
  const mfa = await mfaTokenOfAdmin();
  if (mfa.mfaToken === undefined) return preparationFailed(expected, 'admin@sigpro.test recibe su mfaToken sin completar el segundo paso', mfa.result);
  const prepared: Prepared = { refreshToken: session.refreshToken, accessToken: session.accessToken, mfaToken: mfa.mfaToken };
  const sent = strict('token', TOKENS, cell(row, 'token'))(prepared);
  const renewed = await refresh(sent, TENANT_A);
  return conclude([responseCheck(renewed, { status: 401, code: 'invalid_token' }), noTokensCheck(renewed)]);
};

// --- Esquema 2: un cuerpo sin refreshToken válido responde 422 y no renueva -------------------------------------------------

/** Cuerpo que envía la fila: `undefined` es «sin cuerpo» (la petición no lleva nada). */
const BODIES: ReadonlyMap<string, () => unknown> = new Map<string, () => unknown>([
  ['(sin cuerpo)', () => undefined],
  ['(sin el campo refreshToken)', () => ({})],
  ['refreshToken igual a (vacío)', () => ({ refreshToken: '' })],
  ['refreshToken igual a null', () => ({ refreshToken: null })],
  ['refreshToken igual al número 123', () => ({ refreshToken: 123 })],
]);

const invalidBody: ApiRowHandler = async (row) => {
  const expected = '422 validation_failed con un motivo para refreshToken; sin tokens de sesión';
  await resetTenants([TENANT_A]);
  const started = await loginAs(DEMO.gestor, true);
  if (!sessionOf(started)) return preparationFailed(expected, 'gestor@sigpro.test inicia sesión con remember true', started);
  const body = strict('cuerpo', BODIES, cell(row, 'cuerpo'))();
  const sent = await call('POST', '/auth/refresh', { tenant: TENANT_A, ...(body === undefined ? {} : { body }) });
  const reason = errorsOf(sent).refreshToken;
  const hasReason = typeof reason === 'string' && reason.length > 0;
  const reasonCheck: Check = check(hasReason, 'un motivo para refreshToken', hasReason ? `motivo para refreshToken: ${shortText(reason)}` : `sin motivo para refreshToken (errors: ${JSON.stringify(errorsOf(sent))})`);
  return conclude([responseCheck(sent, { status: 422, code: 'validation_failed' }), reasonCheck, noTokensCheck(sent)], {
    evidence: { errors: errorsOf(sent) },
  });
};

defineApiRows({
  story: 'US-SESION-003',
  surface: 'api',
  tenants: [TENANT_A],
  handlers: new Map<number, ApiRowHandler>([
    [1, notAToken],
    [2, invalidBody],
  ]),
});
