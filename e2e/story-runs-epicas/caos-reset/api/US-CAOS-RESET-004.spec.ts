import { call, errorCode, field, login, uniqueEmail, type ApiResult } from '../../../story-runs/support/api';
import { TENANT_A } from '../../../story-runs/support/prepare';
import { cell, check, preparationFailed, sleep, strict, type Check } from '../../support/checks';
import { defineApiRows, type ApiRowHandler } from '../../core/framework';
import { GESTOR, adminAccess, chaosIs, expectCheck, prepareTenant, rowOutcome, sessionOfAccount, shown, withRestore, withToken } from './common';

// US-CAOS-RESET-004 — El reinicio conserva el caos, las sesiones y los contadores de correos sin cuenta (API). Cada fila reinicia
// alumno01 antes de actuar y, al terminar, `withRestore` lo vuelve a reiniciar y le apaga el caos (el reinicio NO lo apaga).

/** Espera entre el inicio de sesión y la renovación: `iat` va en segundos; sin ella el token renovado podría tener el mismo `iat`. */
const LOGIN_TO_RENEWAL_MS = 1_100;

/** Valores de la latencia, la tasa y los textos variables que fija la fila (Esquema 1). */
const LATENCIES: ReadonlyMap<string, number> = new Map<string, number>([
  ['400', 400],
  ['0', 0],
]);
const RATES: ReadonlyMap<string, number> = new Map<string, number>([
  ['0.5', 0.5],
  ['1', 1],
]);
const FLAKY: ReadonlyMap<string, boolean> = new Map<string, boolean>([
  ['true', true],
  ['false', false],
]);

/** Petición de sesión del Esquema 2 y la respuesta que la historia da por hecha. */
type SessionKind = 'me' | 'refresh';
const SESSION_REQUESTS: ReadonlyMap<string, SessionKind> = new Map<string, SessionKind>([
  ['GET /api/auth/me con su token de acceso', 'me'],
  ['POST /api/auth/refresh con su refreshToken en el cuerpo', 'refresh'],
]);
const SESSION_RESPONSES: ReadonlyMap<string, SessionKind> = new Map<string, SessionKind>([
  ['200 con el correo gestor@sigpro.test', 'me'],
  ['200 con un accessToken nuevo', 'refresh'],
]);

/** Fallos previos y número del intento tras el reinicio (Esquema 3). */
const PREVIOUS_FAILURES: ReadonlyMap<string, number> = new Map<string, number>([
  ['0', 0],
  ['2', 2],
]);
const ATTEMPTS: ReadonlyMap<string, number> = new Map<string, number>([
  ['1', 1],
  ['3', 3],
]);

// --- Esquema 1: el reinicio conserva la configuración del modo caos -----------------------------------------------------------

const keepsChaos: ApiRowHandler = async (row) => {
  const latencyMs = strict('latencia', LATENCIES, cell(row, 'latencia'));
  const errorRate = strict('tasa', RATES, cell(row, 'tasa'));
  const flakyLabels = strict('textos', FLAKY, cell(row, 'textos'));
  const expected = `el reinicio responde 200 y GET /api/admin/chaos devuelve latencyMs ${latencyMs}, errorRate ${errorRate} y flakyLabels ${String(flakyLabels)}`;
  return withRestore([TENANT_A], async () => {
    await prepareTenant(TENANT_A);
    const token = await adminAccess(TENANT_A);
    const fixed = await withToken('PATCH', '/admin/chaos', TENANT_A, token, { latencyMs, errorRate, flakyLabels });
    if (fixed.status !== 200) return preparationFailed(expected, `alumno01@sigpro.lab fija el caos con PATCH /api/admin/chaos (${latencyMs}, ${errorRate}, ${String(flakyLabels)})`, fixed);
    const reset = await call('POST', '/admin/reset', { tenant: TENANT_A, token });
    const read = await withToken('GET', '/admin/chaos', TENANT_A, token);
    return rowOutcome([
      expectCheck(reset, 'la respuesta es 200', { status: 200 }),
      expectCheck(read, 'GET /api/admin/chaos responde 200', { status: 200 }),
      chaosIs(read.body, { latencyMs, errorRate, flakyLabels }, 'GET /api/admin/chaos devuelve'),
    ]);
  });
};

// --- Esquema 2: el reinicio no cierra las sesiones abiertas --------------------------------------------------------------------

const keepsSessions: ApiRowHandler = async (row) => {
  const request = strict('peticion', SESSION_REQUESTS, cell(row, 'peticion'));
  const responseKind = strict('respuesta', SESSION_RESPONSES, cell(row, 'respuesta'));
  // Cada petición de la historia lleva su respuesta: si no casan, la tabla está mal (no es un hallazgo sobre la app)
  if (responseKind !== request) throw new Error(`celdas incoherentes en la fila: ${cell(row, 'peticion')} / ${cell(row, 'respuesta')}`);
  const expected = cell(row, 'respuesta');
  return withRestore([TENANT_A], async () => {
    await prepareTenant(TENANT_A);
    const gestor = await sessionOfAccount(TENANT_A, GESTOR, true);
    if (gestor.token === undefined || gestor.refreshToken === undefined) {
      return preparationFailed(expected, 'gestor@sigpro.test inicia sesión con x-tenant alumno01 y remember true (token de acceso y refreshToken)', gestor.result);
    }
    // El refresco necesita un `iat` posterior al del inicio de sesión: se espera antes del reinicio, como en EP-SESION.
    await sleep(LOGIN_TO_RENEWAL_MS);
    const admin = await adminAccess(TENANT_A);
    const reset = await call('POST', '/admin/reset', { tenant: TENANT_A, token: admin });
    const sessionCheck = request === 'me' ? await meCheck(gestor.token, expected) : await refreshCheck(gestor.refreshToken, gestor.token, expected);
    return rowOutcome([expectCheck(reset, 'la respuesta del reinicio es 200', { status: 200 }), sessionCheck]);
  });
};

/** `GET /api/auth/me` con el token de la sesión abierta antes del reinicio: 200 y el correo de gestor@sigpro.test. */
const meCheck = async (token: string, expected: string): Promise<Check> => {
  const me = await withToken('GET', '/auth/me', TENANT_A, token);
  const email = field(me.body, 'email');
  return check(me.status === 200 && email === GESTOR.email, expected, `respuesta ${me.status} con el correo ${shown(email)}`);
};

/** `POST /api/auth/refresh` con el refreshToken de la sesión abierta: 200 con un accessToken distinto del anterior. */
const refreshCheck = async (refreshToken: string, previousToken: string, expected: string): Promise<Check> => {
  const refreshed = await call('POST', '/auth/refresh', { tenant: TENANT_A, body: { refreshToken } });
  const fresh = field(refreshed.body, 'accessToken');
  const ok = refreshed.status === 200 && typeof fresh === 'string' && fresh !== previousToken;
  return check(ok, expected, `respuesta ${describeRefresh(refreshed)}`);
};

const describeRefresh = (result: ApiResult): string => {
  const code = errorCode(result);
  const hasNew = typeof field(result.body, 'accessToken') === 'string';
  return `${result.status}${code ? ` ${code}` : ''}${hasNew ? ' con un accessToken' : ''}`;
};

// --- Esquema 3: el reinicio no reinicia el contador de un correo sin cuenta -----------------------------------------------------

const keepsUnknownEmailCounter: ApiRowHandler = async (row) => {
  const previous = strict('fallos_previos', PREVIOUS_FAILURES, cell(row, 'fallos_previos'));
  const attempts = strict('intentos', ATTEMPTS, cell(row, 'intentos'));
  const expected = `la respuesta es 401 invalid_credentials con attempts ${attempts}`;
  // Correo nuevo en cada fila y en cada ejecución: «(correo sin cuenta)» es `nadie-` + marca de tiempo + `@sigpro.test`
  const email = uniqueEmail('nadie');
  return withRestore([TENANT_A], async () => {
    await prepareTenant(TENANT_A);
    for (let failure = 1; failure <= previous; failure += 1) {
      const failed = await login({ tenant: TENANT_A, email, password: 'x' });
      const shouldBe = failed.status === 401 && errorCode(failed) === 'invalid_credentials' && field(failed.body, 'attempts') === failure;
      if (!shouldBe) return preparationFailed(expected, `(correo sin cuenta) falla ${previous} veces al entrar con x-tenant alumno01 y la contraseña x`, failed);
    }
    const admin = await adminAccess(TENANT_A);
    const reset = await call('POST', '/admin/reset', { tenant: TENANT_A, token: admin });
    const after = await login({ tenant: TENANT_A, email, password: 'x' });
    return rowOutcome([
      expectCheck(reset, 'la respuesta del reinicio es 200', { status: 200 }),
      expectCheck(after, expected, { status: 401, code: 'invalid_credentials', attempts }),
    ]);
  });
};

defineApiRows({
  story: 'US-CAOS-RESET-004',
  surface: 'api',
  tenants: [TENANT_A],
  handlers: new Map<number, ApiRowHandler>([
    [1, keepsChaos],
    [2, keepsSessions],
    [3, keepsUnknownEmailCounter],
  ]),
});
