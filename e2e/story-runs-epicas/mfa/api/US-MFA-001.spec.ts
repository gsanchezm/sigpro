import { call, decodeJwt, field, resetTenant, sessionOf, type ApiResult, type Session } from '../../../story-runs/support/api';
import { DEMO, TENANT_A, resetTenants, startSession } from '../../../story-runs/support/prepare';
import { cell, check, conclude, errorsOf, noTokensCheck, preparationFailed, responseCheck, sleep, strict, type Check, type ExpectedResponse } from '../../support/checks';
import { defineApiRows, outcome, type ApiRowHandler, type Outcome } from '../../support/framework';

// US-MFA-001 — Canjear el token temporal y el código por una sesión. Preparación de cada fila: reinicio del tenant alumno01 y
// POST /api/auth/login de admin@sigpro.test con x-tenant: alumno01, que da el mfaToken de la fila (no se reutiliza entre filas).
// Las filas de antigüedad (Esquema 5) usan dos tokens obtenidos al empezar la historia: la antigüedad se mide con el `iat` de
// cada token (segundos desde su emisión), no desde que se obtuvieron, y el tenant se reinicia justo antes de canjear.

const MFA_PATH = '/auth/mfa';
const CODE = '123456';
const MINUTE_MS = 60_000;

/** Datos del seed de la cuenta admin@sigpro.test en cada tenant (`apps/api/src/seed/data.ts:72`): la historia pide id, name, email… sin valores. */
const MARTA = { id: 'u1', name: 'Marta Ruiz' } as const;

const NOT_PREPARED = 'No se pudo reproducir el estado inicial que da por hecha la historia; la app no hace lo que la preparación describe.';
const SEED_NOTE = 'El id (u1) y el nombre («Marta Ruiz») son los del seed (apps/api/src/seed/data.ts:72); la Regla de la historia pide id, name, email, role, mfa y tenant, pero no sus valores.';
const FOREIGN_NOTE =
  'La Regla de preparación de la historia dice gestor@sigpro.test para «otro tipo de token»; su Ejemplo pide el token de admin@sigpro.test canjeado con 123456: la fila sigue el Ejemplo.';
const EXPIRY_NOTE =
  'La antigüedad se mide con el iat del token justo antes de canjear (el de cuatro minutos debe tener menos de 290 s). Los dos tokens se obtienen al empezar la historia; el tenant se reinicia justo antes de canjear, con comprobación 2xx, porque otras filas lo reinician entre medias.';

interface MfaStart {
  readonly token: string;
  readonly login: ApiResult;
}

/** Reinicia el tenant y deja a admin@sigpro.test con un mfaToken nuevo (la respuesta del login queda para quien necesite comprobarla). */
const freshMfaToken = async (): Promise<MfaStart | { readonly failed: ApiResult }> => {
  await resetTenants([TENANT_A]);
  const started = await startSession(TENANT_A, DEMO.admin);
  const token = field(started.result.body, 'mfaToken');
  const hasTokens = started.session !== undefined;
  return typeof token === 'string' && field(started.result.body, 'mfaRequired') === true && !hasTokens ? { token, login: started.result } : { failed: started.result };
};

const redeem = (mfaToken: string | undefined, code: string | undefined): Promise<ApiResult> =>
  call('POST', MFA_PATH, { tenant: TENANT_A, body: { ...(mfaToken === undefined ? {} : { mfaToken }), ...(code === undefined ? {} : { code }) } });

const userOf = (result: ApiResult): Readonly<Record<string, unknown>> => {
  const user = field(result.body, 'user');
  return typeof user === 'object' && user !== null ? (user as Record<string, unknown>) : {};
};

interface AgedTokens {
  readonly four: MfaStart | { readonly failed: ApiResult };
  readonly six: MfaStart | { readonly failed: ApiResult };
}

let aged: Promise<AgedTokens> | undefined;

/** Obtiene (una sola vez, al empezar la historia) los dos tokens cuya antigüedad se mide después. */
const agedTokens = (): Promise<AgedTokens> => {
  aged ??= (async () => {
    const four = await freshMfaToken();
    const six = await freshMfaToken();
    return { four, six };
  })();
  return aged;
};

/** Mensaje de un token no válido para la fila: la preparación no dio lo que la historia da por hecho (no es un fallo del arnés). */
const notPrepared = (expected: string, reason: string): Outcome => outcome(false, expected, `la preparación no se cumplió: ${reason}`, { note: NOT_PREPARED });

const describeTokens = (result: ApiResult): string =>
  `${typeof field(result.body, 'accessToken') === 'string' ? 'trae' : 'no trae'} accessToken y ${typeof field(result.body, 'refreshToken') === 'string' ? 'trae' : 'no trae'} refreshToken`;

// --- Esquema 1: el código correcto completa la sesión ----------------------------------------------------------------------

/** Respuestas que la columna «respuesta» admite. */
const RESPONSES: ReadonlyMap<string, ExpectedResponse> = new Map<string, ExpectedResponse>([
  ['200', { status: 200 }],
  ['401 invalid_mfa', { status: 401, code: 'invalid_mfa' }],
]);

/** Códigos de la columna «codigo» del Esquema 1 (el texto tal cual). */
const CODES: ReadonlyMap<string, string> = new Map<string, string>([
  ['123456', '123456'],
  ['000000', '000000'],
  ['123457', '123457'],
]);

/** Lo que la columna «sesion» pide comprobar en la respuesta. */
const SESSIONS: ReadonlyMap<string, (result: ApiResult) => readonly Check[]> = new Map<string, (result: ApiResult) => readonly Check[]>([
  [
    'trae accessToken, refreshToken, expiresIn 900 y el usuario admin del tenant alumno01 con mfa verdadero',
    (result) => {
      const user = userOf(result);
      return [
        check(typeof field(result.body, 'accessToken') === 'string', 'trae accessToken', typeof field(result.body, 'accessToken') === 'string' ? 'trae accessToken' : 'no trae accessToken'),
        check(typeof field(result.body, 'refreshToken') === 'string', 'trae refreshToken', typeof field(result.body, 'refreshToken') === 'string' ? 'trae refreshToken' : 'no trae refreshToken'),
        check(field(result.body, 'expiresIn') === 900, 'expiresIn 900', `expiresIn ${String(field(result.body, 'expiresIn'))}`),
        check(
          user.id === MARTA.id && user.name === MARTA.name && user.email === DEMO.admin.email,
          `usuario ${MARTA.id}, «${MARTA.name}» y ${DEMO.admin.email}`,
          `usuario ${String(user.id)}, «${String(user.name)}» y ${String(user.email)}`,
        ),
        check(
          user.role === 'admin' && user.mfa === true && user.tenant === TENANT_A,
          'usuario con rol admin, mfa verdadero y tenant alumno01',
          `usuario con rol ${String(user.role)}, mfa ${String(user.mfa)} y tenant ${String(user.tenant)}`,
        ),
      ];
    },
  ],
  ['no trae tokens de sesión', (result) => [noTokensCheck(result)]],
]);

const correctCode: ApiRowHandler = async (row) => {
  const expectedResponse = strict('respuesta', RESPONSES, cell(row, 'respuesta'));
  const sessionChecks = strict('sesion', SESSIONS, cell(row, 'sesion'));
  const code = strict('codigo', CODES, cell(row, 'codigo'));
  // Al empezar la historia se obtienen los dos tokens cuya antigüedad medirá el Esquema 5
  await agedTokens();
  const expected = `${cell(row, 'respuesta')}; ${cell(row, 'sesion')}`;
  const start = await freshMfaToken();
  if ('failed' in start) return preparationFailed(expected, 'admin@sigpro.test inicia sesión y recibe mfaToken', start.failed);
  const result = await redeem(start.token, code);
  // La nota de semilla solo aplica a la fila que comprueba el usuario (la de 200)
  return conclude([responseCheck(result, expectedResponse), ...sessionChecks(result)], expectedResponse.status === 200 ? { note: SEED_NOTE } : {});
};

// --- Esquema 2: un cuerpo con formato inválido no se canjea ----------------------------------------------------------------

const MFA_TOKENS_SENT: ReadonlyMap<string, (token: string) => string | undefined> = new Map<string, (token: string) => string | undefined>([
  ['ese mfaToken', (token: string) => token],
  ['(vacío)', () => ''],
  ['(sin el campo)', () => undefined],
]);

/** Código enviado: el texto tal cual, `(vacío)` como cadena vacía y `(sin el campo)` como ausencia del campo. */
const CODES_SENT: ReadonlyMap<string, string | undefined> = new Map<string, string | undefined>([
  ['12345', '12345'],
  ['1234567', '1234567'],
  ['123456', '123456'],
  ['12345a', '12345a'],
  ['(vacío)', ''],
  ['(sin el campo)', undefined],
]);

/** Campos del 422 que la columna «campo» nombra. */
const FIELDS: ReadonlyMap<string, string> = new Map<string, string>([
  ['code', 'code'],
  ['mfaToken', 'mfaToken'],
]);

const invalidFormat: ApiRowHandler = async (row) => {
  const sentToken = strict('mfaToken_enviado', MFA_TOKENS_SENT, cell(row, 'mfaToken_enviado'));
  const sentCode = strict('codigo', CODES_SENT, cell(row, 'codigo'));
  const fieldName = strict('campo', FIELDS, cell(row, 'campo'));
  const expected = `422 validation_failed con un motivo para ${fieldName}; sin tokens de sesión`;
  const start = await freshMfaToken();
  if ('failed' in start) return preparationFailed(expected, 'admin@sigpro.test inicia sesión y recibe mfaToken', start.failed);
  const result = await redeem(sentToken(start.token), sentCode);
  // El motivo es el texto que la API da en `errors[campo]`; la historia solo pide que exista, así que se registra tal cual
  const reason = errorsOf(result)[fieldName];
  const hasReason = typeof reason === 'string' && reason.length > 0;
  return conclude(
    [
      responseCheck(result, { status: 422, code: 'validation_failed' }),
      check(hasReason, `motivo para ${fieldName}`, hasReason ? `motivo para ${fieldName}: ${String(reason)}` : `sin motivo para ${fieldName}`),
      noTokensCheck(result),
    ],
    { evidence: { campo: fieldName, motivo: typeof reason === 'string' ? reason : null, errors: errorsOf(result) } },
  );
};

// --- Esquema 3: un token distinto del segundo paso no abre sesión ----------------------------------------------------------

/** De dónde sale el token de la fila: un texto fijo (no necesita sesión) o un token de la sesión de admin canjeada. */
type ForeignSource = { readonly fixed: string } | { readonly fromSession: (session: Session) => string };

const FOREIGN_TOKENS: ReadonlyMap<string, ForeignSource> = new Map<string, ForeignSource>([
  ['un texto que no es JWT', { fixed: 'esto-no-es-un-jwt' }],
  ['el accessToken de admin@sigpro.test, obtenido al canjear su mfaToken con 123456', { fromSession: (session: Session) => session.accessToken }],
  ['el refreshToken de admin@sigpro.test, obtenido al canjear su mfaToken con 123456', { fromSession: (session: Session) => session.refreshToken }],
]);

const foreignToken: ApiRowHandler = async (row) => {
  const expected = '401 invalid_mfa; sin tokens de sesión';
  const source = strict('token', FOREIGN_TOKENS, cell(row, 'token'));
  // Texto que no es JWT: no necesita sesión, solo el tenant recién reiniciado de la Dado
  if ('fixed' in source) {
    await resetTenants([TENANT_A]);
    const fixedResult = await redeem(source.fixed, CODE);
    return conclude([responseCheck(fixedResult, { status: 401, code: 'invalid_mfa' }), noTokensCheck(fixedResult)]);
  }
  const start = await freshMfaToken();
  if ('failed' in start) return preparationFailed(expected, 'admin@sigpro.test inicia sesión y recibe mfaToken', start.failed);
  // Los tokens de sesión salen de canjear el mfaToken de admin con su código: la fila necesita un accessToken y un refreshToken reales
  const redeemed = await redeem(start.token, CODE);
  const session = sessionOf(redeemed);
  if (session === undefined) return preparationFailed(expected, 'admin@sigpro.test canjea su mfaToken con 123456 y recibe tokens', redeemed);
  const result = await redeem(source.fromSession(session), CODE);
  return conclude([responseCheck(result, { status: 401, code: 'invalid_mfa' }), noTokensCheck(result)], { note: FOREIGN_NOTE });
};

// --- Esquema 4: el token temporal no es una sesión y la sesión canjeada sí lo es -------------------------------------------

interface Credential {
  readonly bearer: string | undefined;
  readonly redeemed?: ApiResult;
}

const ME_CREDENTIALS: ReadonlyMap<string, (token: string) => Promise<Credential>> = new Map<string, (token: string) => Promise<Credential>>([
  ['ese mfaToken', async (token: string): Promise<Credential> => ({ bearer: token })],
  [
    'el accessToken obtenido al canjear ese mfaToken con 123456',
    async (token: string): Promise<Credential> => {
      const redeemed = await redeem(token, CODE);
      const access = field(redeemed.body, 'accessToken');
      return { bearer: typeof access === 'string' ? access : undefined, redeemed };
    },
  ],
]);

const ME_EXPECTED: ReadonlyMap<string, (result: ApiResult) => readonly Check[]> = new Map<string, (result: ApiResult) => readonly Check[]>([
  ['401 invalid_token', (result) => [responseCheck(result, { status: 401, code: 'invalid_token' })]],
  [
    '200 con el correo admin@sigpro.test',
    (result) => [responseCheck(result, { status: 200 }), check(field(result.body, 'email') === DEMO.admin.email, 'el correo admin@sigpro.test', `el correo ${String(field(result.body, 'email'))}`)],
  ],
]);

const sessionProbe: ApiRowHandler = async (row) => {
  const expected = cell(row, 'respuesta');
  const expectation = strict('respuesta', ME_EXPECTED, expected);
  const credentialOf = strict('credencial', ME_CREDENTIALS, cell(row, 'credencial'));
  const start = await freshMfaToken();
  if ('failed' in start) return preparationFailed(expected, 'admin@sigpro.test inicia sesión y recibe mfaToken', start.failed);
  const credential = await credentialOf(start.token);
  if (credential.bearer === undefined) return preparationFailed(expected, 'canjear el mfaToken con 123456', credential.redeemed ?? start.login);
  const result = await call('GET', '/auth/me', { tenant: TENANT_A, token: credential.bearer });
  return conclude(expectation(result));
};

// --- Esquema 5: el token temporal caduca a los cinco minutos ---------------------------------------------------------------

interface AgeRule {
  readonly minutes: number;
  /** Antigüedad mínima al canjear (la espera de la fila la garantiza). */
  readonly minAgeMs: number;
  /** Antigüedad máxima al canjear: si la fila llega tarde, la antigüedad ya no es la de la historia (preparación, no hallazgo). */
  readonly maxAgeMs: number;
  readonly pick: (tokens: AgedTokens) => MfaStart | { readonly failed: ApiResult };
}

const AGES: ReadonlyMap<string, AgeRule> = new Map<string, AgeRule>([
  ['cuatro minutos', { minutes: 4, minAgeMs: 4 * MINUTE_MS, maxAgeMs: 290_000, pick: (tokens: AgedTokens) => tokens.four }],
  ['seis minutos', { minutes: 6, minAgeMs: 6 * MINUTE_MS, maxAgeMs: Number.POSITIVE_INFINITY, pick: (tokens: AgedTokens) => tokens.six }],
]);

const EXPIRY: ReadonlyMap<string, (result: ApiResult) => readonly Check[]> = new Map<string, (result: ApiResult) => readonly Check[]>([
  [
    '200 con accessToken y refreshToken',
    (result) => [
      responseCheck(result, { status: 200 }),
      check(typeof field(result.body, 'accessToken') === 'string' && typeof field(result.body, 'refreshToken') === 'string', 'trae accessToken y refreshToken', describeTokens(result)),
    ],
  ],
  ['401 invalid_mfa sin tokens de sesión', (result) => [responseCheck(result, { status: 401, code: 'invalid_mfa' }), noTokensCheck(result)]],
]);

const expiry: ApiRowHandler = async (row) => {
  const age = strict('antiguedad', AGES, cell(row, 'antiguedad'));
  const expectation = strict('respuesta', EXPIRY, cell(row, 'respuesta'));
  const expected = cell(row, 'respuesta');
  const tokens = await agedTokens();
  const start = age.pick(tokens);
  if ('failed' in start) return preparationFailed(expected, 'admin@sigpro.test inicia sesión y recibe mfaToken', start.failed);
  // La antigüedad se mide con el `iat` del token (segundos desde su emisión): se espera hasta que el token tenga la de la fila
  const issuedAt = decodeJwt(start.token).iat * 1000;
  const wait = issuedAt + age.minutes * MINUTE_MS - Date.now();
  if (wait > 0) await sleep(wait);
  // Otras filas reinician el tenant entre medias: la historia pide un tenant recién reiniciado, así que se reinicia aquí y se comprueba el 2xx
  const reset = await resetTenant(TENANT_A);
  if (reset.status < 200 || reset.status > 299) return preparationFailed(expected, 'reiniciar alumno01 antes de canjear', reset);
  // Antigüedad medida justo antes de canjear; fuera de la ventana de la fila, la preparación no dio lo que la historia da por hecho
  const ageMsAtRedeem = Date.now() - issuedAt;
  if (ageMsAtRedeem < age.minAgeMs || ageMsAtRedeem > age.maxAgeMs) return notPrepared(expected, `el token tiene ${String(ageMsAtRedeem)} ms de antigüedad al canjear (ventana de ${String(age.minAgeMs)} a ${String(age.maxAgeMs)} ms)`);
  const result = await redeem(start.token, CODE);
  return conclude(expectation(result), { note: EXPIRY_NOTE, evidence: { ageMsAtRedeem } });
};

defineApiRows({
  story: 'US-MFA-001',
  surface: 'api',
  tenants: [TENANT_A],
  // Las filas de antigüedad esperan hasta seis minutos: el resto usa el tiempo del config
  rowTimeoutMs: (row) => (row.esquemaIndex === 5 ? 8 * MINUTE_MS : 120_000),
  handlers: new Map<number, ApiRowHandler>([
    [1, correctCode],
    [2, invalidFormat],
    [3, foreignToken],
    [4, sessionProbe],
    [5, expiry],
  ]),
});
