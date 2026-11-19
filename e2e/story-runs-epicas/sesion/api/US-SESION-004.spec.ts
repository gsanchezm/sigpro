import { field, sessionOf, type ApiResult } from '../../../story-runs/support/api';
import { DEMO, TENANT_A, resetTenants } from '../../../story-runs/support/prepare';
import { cell, check, conclude, preparationFailed, responseCheck, sleep, strict, type Check } from '../../support/checks';
import { defineApiRows, type ApiRowHandler } from '../../support/framework';
import { ACCESS_TTL_S, accessAge, agedNotExecutable, hasTokens, iatOf, issuedAgo, lifetimeOf, loadAged, loginAs, me, meUserOf, refresh, shortText, tokensRecent, type AgedSet } from './common';

/** Antigüedad máxima (segundos) de los tokens que devuelve una renovación para contar como «emitidos ahora». */
const FRESH_MAX_S = 5;
/** Espera antes de renovar: `iat` va en segundos, y sin ella la renovación podría llevar el mismo `iat` que el inicio de sesión. */
const RENEW_AFTER_MS = 1_100;
const RENEW_PREP_NOTE = `Preparación: se espera ${RENEW_AFTER_MS / 1000} s entre el inicio de sesión y la renovación, porque el iat va en segundos.`;

// US-SESION-004 — Duración de los tokens (API). Esquemas 1 y 2: los plazos se leen de las propias reclamaciones (`exp - iat`) del token
// recién emitido; no hace falta esperar nada. Esquema 3 (catorce y dieciséis minutos): NO espera dentro de la prueba. Los tokens salen
// de `aged-tokens.json` (los escribe emitir-tokens-sesion.mjs) y la fila mide su antigüedad REAL con `iat` justo antes y después de
// la petición. Si la antigüedad no es la que la historia da por hecho, la preparación no se cumple (no es un hallazgo de la app).

/** Modo de inicio de sesión, igual que en US-SESION-001: `undefined` es el campo `remember` ausente. */
const LOGIN_MODES: ReadonlyMap<string, boolean | undefined> = new Map<string, boolean | undefined>([
  ['con remember true', true],
  ['con remember false', false],
  ['sin el campo remember', undefined],
]);

const DURATIONS: ReadonlyMap<string, number> = new Map<string, number>([
  ['604800', 604_800],
  ['43200', 43_200],
]);

const REMEMBER: ReadonlyMap<string, boolean> = new Map<string, boolean>([
  ['true', true],
  ['false', false],
]);

/** Texto de un campo de la respuesta si es de texto (sin mostrar nada más). */
const textOf = (body: unknown, key: string): string | undefined => {
  const value = field(body, key);
  return typeof value === 'string' ? value : undefined;
};

// --- Esquema 1: el inicio de sesión emite los plazos del producto ------------------------------------------------------------

const loginLifetimes: ApiRowHandler = async (row) => {
  const duration = strict('duracion', DURATIONS, cell(row, 'duracion'));
  const mode = cell(row, 'inicio');
  const expected = `accessToken ${ACCESS_TTL_S} s; refreshToken ${duration} s; expiresIn ${ACCESS_TTL_S}`;
  await resetTenants([TENANT_A]);
  const started = await loginAs(DEMO.gestor, strict('inicio', LOGIN_MODES, mode));
  const session = sessionOf(started);
  if (!session) return preparationFailed(expected, `gestor@sigpro.test inicia sesión ${mode}`, started);
  const accessLife = lifetimeOf(session.accessToken);
  const refreshLife = lifetimeOf(session.refreshToken);
  return conclude([
    check(accessLife === ACCESS_TTL_S, `el accessToken dura ${ACCESS_TTL_S} s desde su emisión`, `el accessToken dura ${shortText(accessLife)} s`),
    check(refreshLife === duration, `el refreshToken dura ${duration} s desde su emisión`, `el refreshToken dura ${shortText(refreshLife)} s`),
    check(field(started.body, 'expiresIn') === ACCESS_TTL_S, `la respuesta trae expiresIn ${ACCESS_TTL_S}`, `expiresIn ${shortText(field(started.body, 'expiresIn'))}`),
  ]);
};

// --- Esquema 2: cada renovación emite un refreshToken con el plazo completo --------------------------------------------------

const renewalLifetimes: ApiRowHandler = async (row) => {
  const remember = strict('remember', REMEMBER, cell(row, 'remember'));
  const duration = strict('duracion', DURATIONS, cell(row, 'duracion'));
  const expected = `refreshToken de la renovación ${duration} s; accessToken ${ACCESS_TTL_S} s`;
  await resetTenants([TENANT_A]);
  const started = await loginAs(DEMO.gestor, remember);
  const session = sessionOf(started);
  if (!session) return preparationFailed(expected, `gestor@sigpro.test inicia sesión con remember ${String(remember)}`, started);
  await sleep(RENEW_AFTER_MS);
  const renewed = await refresh(session.refreshToken, TENANT_A);
  const newAccess = textOf(renewed.body, 'accessToken');
  const newRefresh = textOf(renewed.body, 'refreshToken');
  // «El plazo cuenta desde esa renovación»: el refreshToken devuelto es posterior al del inicio de sesión y se emitió ahora
  const loginIat = iatOf(session.refreshToken);
  const renewedIat = iatOf(newRefresh);
  const countsFromRenewal = loginIat !== undefined && renewedIat !== undefined && renewedIat > loginIat;
  return conclude(
    [
      responseCheck(renewed, { status: 200 }),
      check(lifetimeOf(newRefresh) === duration, `el refreshToken de la renovación dura ${duration} s desde su emisión`, `el refreshToken de la renovación dura ${shortText(lifetimeOf(newRefresh))} s`),
      check(lifetimeOf(newAccess) === ACCESS_TTL_S, `su accessToken dura ${ACCESS_TTL_S} s desde su emisión`, `su accessToken dura ${shortText(lifetimeOf(newAccess))} s`),
      check(
        countsFromRenewal,
        'el refreshToken renovado se emitió después del inicio de sesión (el plazo cuenta desde esta renovación)',
        countsFromRenewal ? `iat ${String(renewedIat)} > ${String(loginIat)}` : `iat ${shortText(renewedIat)}; inicio de sesión ${shortText(loginIat)}`,
      ),
      check(
        tokensRecent(renewed.body, FRESH_MAX_S),
        `los tokens devueltos se emitieron ahora (hace como mucho ${FRESH_MAX_S} s)`,
        `accessToken emitido hace ${shortText(issuedAgo(newAccess))} s; refreshToken emitido hace ${shortText(issuedAgo(newRefresh))} s`,
      ),
    ],
    { note: RENEW_PREP_NOTE },
  );
};

// --- Esquema 3: el accessToken caduca a los 900 segundos y el refreshToken sigue renovando -----------------------------------

interface AgeRule {
  /** Juego de `aged-tokens.json` que usa la fila. */
  readonly slot: 'sixteen' | 'fourteen';
  readonly holds: (seconds: number) => boolean;
  readonly requirement: string;
}

/** «catorce minutos» exige 840 ≤ edad < 900 s; «dieciséis minutos» exige 960 s o más (la historia dice 14 y 16 minutos de antigüedad). */
const AGES: ReadonlyMap<string, AgeRule> = new Map<string, AgeRule>([
  ['catorce minutos', { slot: 'fourteen', holds: (seconds) => seconds >= 840 && seconds < 900, requirement: 'entre 840 y 899 s de antigüedad' }],
  ['dieciséis minutos', { slot: 'sixteen', holds: (seconds) => seconds >= 960, requirement: 'al menos 960 s de antigüedad' }],
]);

/** Petición de la fila con el juego de tokens de su antigüedad. */
const REQUESTS: ReadonlyMap<string, (set: AgedSet) => Promise<ApiResult>> = new Map<string, (set: AgedSet) => Promise<ApiResult>>([
  ['GET /api/auth/me con el accessToken de ese inicio de sesión', (set) => me(set.accessToken, TENANT_A)],
  ['POST /api/auth/refresh con el refreshToken de ese inicio de sesión', (set) => refresh(set.refreshToken, TENANT_A)],
]);

/** Lo que la historia espera de la petición, según la celda «respuesta». */
const RESPONSES: ReadonlyMap<string, (result: ApiResult) => readonly Check[]> = new Map<string, (result: ApiResult) => readonly Check[]>([
  [
    '200 con el correo gestor@sigpro.test',
    (result) => [responseCheck(result, { status: 200 }), check(meUserOf(result.body).email === DEMO.gestor.email, 'el correo gestor@sigpro.test', `el correo ${shortText(meUserOf(result.body).email)}`)],
  ],
  ['401 invalid_token', (result) => [responseCheck(result, { status: 401, code: 'invalid_token' })]],
  [
    '200 con un accessToken y un refreshToken',
    (result) => [
      responseCheck(result, { status: 200 }),
      check(hasTokens(result.body), 'trae un accessToken y un refreshToken', hasTokens(result.body) ? 'trae accessToken y refreshToken' : 'falta accessToken o refreshToken'),
      // La renovación con el token de dieciséis minutos devuelve tokens emitidos ahora (no los del archivo)
      check(
        tokensRecent(result.body, FRESH_MAX_S),
        `los tokens devueltos se emitieron ahora (hace como mucho ${FRESH_MAX_S} s)`,
        `accessToken emitido hace ${shortText(issuedAgo(field(result.body, 'accessToken')))} s; refreshToken emitido hace ${shortText(issuedAgo(field(result.body, 'refreshToken')))} s`,
      ),
    ],
  ],
]);

const round = (seconds: number | undefined): number | undefined => (seconds === undefined || !Number.isFinite(seconds) ? undefined : Math.round(seconds));

/** Desviación declarada del Esquema 3: la historia pide obtener el token en la propia fila; la espera de 14 a 16 minutos no cabe en la prueba. */
const AGED_NOTE = 'Desviación del arnés declarada: la historia pide obtener el token en la propia fila, y aquí se usan tokens emitidos antes (aged-tokens.json, emitidos con gestor@sigpro.test y remember true) para no esperar 16 minutos. Los tokens son sin estado y la antigüedad se mide con su iat, justo antes y después de la petición.';

const agedToken: ApiRowHandler = async (row) => {
  const rule = strict('antiguedad', AGES, cell(row, 'antiguedad'));
  const send = strict('peticion', REQUESTS, cell(row, 'peticion'));
  const expected = `${cell(row, 'respuesta')}; el accessToken tiene ${rule.requirement}`;
  // Reinicio de alumno01 antes de la fila (la historia lo pide); los tokens son sin estado y siguen valiendo tras él
  await resetTenants([TENANT_A]);
  const loaded = loadAged();
  if (loaded.file === undefined) return agedNotExecutable(expected, loaded.reason ?? 'archivo de tokens no disponible', {});
  const set = loaded.file[rule.slot];
  const ageBefore = accessAge(set.accessToken);
  const evidence = { juego: rule.slot, emitidoEl: set.issuedAt, edadAntesSegundos: round(ageBefore) };
  if (ageBefore === undefined || !rule.holds(ageBefore)) {
    return agedNotExecutable(expected, `la edad medida del accessToken es ${shortText(round(ageBefore))} s antes de la petición; la historia exige ${rule.requirement}`, evidence);
  }
  const result = await send(set);
  const ageAfter = accessAge(set.accessToken);
  const measured = { ...evidence, edadDespuesSegundos: round(ageAfter) };
  // La edad se mide también después de la petición: si el token ya no tenía la edad exigida cuando se usó, la fila no es válida
  if (ageAfter === undefined || !rule.holds(ageAfter)) {
    return agedNotExecutable(expected, `la edad medida del accessToken es ${shortText(round(ageAfter))} s después de la petición; la historia exige ${rule.requirement}`, measured);
  }
  return conclude(strict('respuesta', RESPONSES, cell(row, 'respuesta'))(result), { evidence: measured, note: AGED_NOTE });
};

defineApiRows({
  story: 'US-SESION-004',
  surface: 'api',
  tenants: [TENANT_A],
  handlers: new Map<number, ApiRowHandler>([
    [1, loginLifetimes],
    [2, renewalLifetimes],
    [3, agedToken],
  ]),
});
