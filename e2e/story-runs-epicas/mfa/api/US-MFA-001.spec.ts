import { call, field, type ApiResult } from '../../../story-runs/support/api';
import { DEMO, TENANT_A, resetTenants, startSession } from '../../../story-runs/support/prepare';
import { cell, check, conclude, errorsOf, noTokensCheck, parseResponse, preparationFailed, responseCheck, sleep, strict, type Check } from '../../support/checks';
import { defineApiRows, type ApiRowHandler } from '../../support/framework';

// US-MFA-001 — Canjear el token temporal y el código por una sesión. Preparación de cada fila: reinicio del tenant alumno01 y
// POST /api/auth/login de admin@sigpro.test con x-tenant: alumno01, que da el mfaToken de la fila (no se reutiliza entre filas).
// Las filas de antigüedad (Esquema 5) usan dos tokens obtenidos juntos al empezar la historia: así la espera de seis minutos no se
// suma a la de cuatro. El reinicio posterior de otras filas no afecta a esos tokens (llevan el id de la cuenta y el tenant).

const MFA_PATH = '/auth/mfa';
const CODE = '123456';
const MINUTE_MS = 60_000;

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
  readonly obtainedAt: number;
  readonly four: MfaStart | { readonly failed: ApiResult };
  readonly six: MfaStart | { readonly failed: ApiResult };
}

let aged: Promise<AgedTokens> | undefined;

/** Obtiene (una sola vez, al empezar la historia) los dos tokens cuya antigüedad se mide después. */
const agedTokens = (): Promise<AgedTokens> => {
  aged ??= (async () => {
    const four = await freshMfaToken();
    const six = await freshMfaToken();
    return { obtainedAt: Date.now(), four, six };
  })();
  return aged;
};

// --- Esquema 1: el código correcto completa la sesión ----------------------------------------------------------------------

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
        check(user.role === 'admin' && user.tenant === TENANT_A && user.mfa === true, 'usuario con rol admin, tenant alumno01 y mfa verdadero', `usuario con rol ${String(user.role)}, tenant ${String(user.tenant)} y mfa ${String(user.mfa)}`),
      ];
    },
  ],
  ['no trae tokens de sesión', (result) => [noTokensCheck(result)]],
]);

const correctCode: ApiRowHandler = async (row) => {
  // Al empezar la historia se obtienen los dos tokens cuya antigüedad medirá el Esquema 5
  await agedTokens();
  const start = await freshMfaToken();
  const expected = `${cell(row, 'respuesta')}; ${cell(row, 'sesion')}`;
  if ('failed' in start) return preparationFailed(expected, 'admin@sigpro.test inicia sesión y recibe mfaToken', start.failed);
  const result = await redeem(start.token, cell(row, 'codigo'));
  return conclude([responseCheck(result, parseResponse(cell(row, 'respuesta'))), ...strict('sesion', SESSIONS, cell(row, 'sesion'))(result)]);
};

// --- Esquema 2: un cuerpo con formato inválido no se canjea ----------------------------------------------------------------

const MFA_TOKENS_SENT: ReadonlyMap<string, (token: string) => string | undefined> = new Map<string, (token: string) => string | undefined>([
  ['ese mfaToken', (token) => token],
  ['(vacío)', () => ''],
  ['(sin el campo)', () => undefined],
]);

const CODES_SENT: ReadonlyMap<string, string | undefined> = new Map<string, string | undefined>([
  ['(vacío)', ''],
  ['(sin el campo)', undefined],
]);

/** Un código escrito tal cual, o el valor de un marcador entre paréntesis; cualquier otro paréntesis lanza. */
const codeSent = (text: string): string | undefined => {
  if (CODES_SENT.has(text)) return CODES_SENT.get(text);
  if (text.startsWith('(')) throw new Error(`celda sin interpretación: código «${text}»`);
  return text;
};

const invalidFormat: ApiRowHandler = async (row) => {
  const start = await freshMfaToken();
  const fieldName = cell(row, 'campo');
  const expected = `422 validation_failed con un motivo para ${fieldName}; sin tokens de sesión`;
  if ('failed' in start) return preparationFailed(expected, 'admin@sigpro.test inicia sesión y recibe mfaToken', start.failed);
  const sentToken = strict('mfaToken_enviado', MFA_TOKENS_SENT, cell(row, 'mfaToken_enviado'))(start.token);
  const result = await redeem(sentToken, codeSent(cell(row, 'codigo')));
  const reason = errorsOf(result)[fieldName];
  const hasReason = typeof reason === 'string' && reason.length > 0;
  return conclude(
    [responseCheck(result, { status: 422, code: 'validation_failed' }), check(hasReason, `motivo para ${fieldName}`, hasReason ? `motivo para ${fieldName}: ${String(reason)}` : `sin motivo para ${fieldName} (errors: ${JSON.stringify(errorsOf(result))})`), noTokensCheck(result)],
    { evidence: { errors: errorsOf(result) } },
  );
};

// --- Esquema 3: un token distinto del segundo paso no abre sesión ----------------------------------------------------------

const FOREIGN_TOKENS: ReadonlyMap<string, () => Promise<string | undefined>> = new Map<string, () => Promise<string | undefined>>([
  ['un texto que no es JWT', async () => 'esto-no-es-un-jwt'],
  ['el accessToken de gestor@sigpro.test', async () => (await startSession(TENANT_A, DEMO.gestor)).session?.accessToken],
  ['el refreshToken de gestor@sigpro.test', async () => (await startSession(TENANT_A, DEMO.gestor)).session?.refreshToken],
]);

const foreignToken: ApiRowHandler = async (row) => {
  await resetTenants([TENANT_A]);
  const expected = '401 invalid_mfa; sin tokens de sesión';
  const token = await strict('token', FOREIGN_TOKENS, cell(row, 'token'))();
  if (token === undefined) return preparationFailed(expected, 'gestor@sigpro.test inicia sesión y recibe sus tokens', (await startSession(TENANT_A, DEMO.gestor)).result);
  const result = await redeem(token, CODE);
  return conclude([responseCheck(result, { status: 401, code: 'invalid_mfa' }), noTokensCheck(result)]);
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
  const start = await freshMfaToken();
  const expected = cell(row, 'respuesta');
  if ('failed' in start) return preparationFailed(expected, 'admin@sigpro.test inicia sesión y recibe mfaToken', start.failed);
  const credential = await strict('credencial', ME_CREDENTIALS, cell(row, 'credencial'))(start.token);
  if (credential.bearer === undefined) return preparationFailed(expected, 'canjear el mfaToken con 123456', credential.redeemed ?? start.login);
  const result = await call('GET', '/auth/me', { tenant: TENANT_A, token: credential.bearer });
  return conclude(strict('respuesta', ME_EXPECTED, expected)(result));
};

// --- Esquema 5: el token temporal caduca a los cinco minutos ---------------------------------------------------------------

const AGES: ReadonlyMap<string, { readonly minutes: number; readonly pick: (tokens: AgedTokens) => MfaStart | { readonly failed: ApiResult } }> = new Map([
  ['cuatro minutos', { minutes: 4, pick: (tokens: AgedTokens) => tokens.four }],
  ['seis minutos', { minutes: 6, pick: (tokens: AgedTokens) => tokens.six }],
]);

const hasBoth = (result: ApiResult): string => `${typeof field(result.body, 'accessToken') === 'string' ? 'trae' : 'no trae'} accessToken y ${typeof field(result.body, 'refreshToken') === 'string' ? 'trae' : 'no trae'} refreshToken`;

const expiry: ApiRowHandler = async (row) => {
  const age = strict('antiguedad', AGES, cell(row, 'antiguedad'));
  const tokens = await agedTokens();
  const start = age.pick(tokens);
  const expected = cell(row, 'respuesta');
  if ('failed' in start) return preparationFailed(expected, 'admin@sigpro.test inicia sesión y recibe mfaToken', start.failed);
  // Se espera hasta que el token tenga la antigüedad de la fila, medida desde que se obtuvo (la historia no fija esta espera: es la de la fila)
  const wait = tokens.obtainedAt + age.minutes * MINUTE_MS - Date.now();
  if (wait > 0) await sleep(wait);
  const result = await redeem(start.token, CODE);
  const expectedCheck: ReadonlyMap<string, () => readonly Check[]> = new Map<string, () => readonly Check[]>([
    ['200 con accessToken y refreshToken', () => [responseCheck(result, { status: 200 }), check(typeof field(result.body, 'accessToken') === 'string' && typeof field(result.body, 'refreshToken') === 'string', 'trae accessToken y refreshToken', hasBoth(result))]],
    ['401 invalid_mfa sin tokens de sesión', () => [responseCheck(result, { status: 401, code: 'invalid_mfa' }), noTokensCheck(result)]],
  ]);
  return conclude(strict('respuesta', expectedCheck, expected)(), {
    note: 'Los dos tokens se obtuvieron al empezar la historia; la antigüedad se midió al canjear (cuatro minutos y seis minutos después). Los reinicios del tenant de otras filas no afectan a un token.',
    evidence: { ageMsAtRedeem: Date.now() - tokens.obtainedAt },
  });
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
