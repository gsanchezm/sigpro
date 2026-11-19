import { adminCredentials, errorCode, sessionOf, type ApiResult, type Session } from '../../../story-runs/support/api';
import { DEMO, TENANT_A, TENANT_B, resetTenants, type Credentials } from '../../../story-runs/support/prepare';
import { cell, check, conclude, preparationFailed, responseCheck, strict, type Check } from '../../support/checks';
import { defineApiRows, type ApiRowHandler } from '../../support/framework';
import { alteredLast, failGestor, loginAs, me, mfaTokenOfAdmin, patchUser, rawGet, redeemMfa, refresh, shortText, userOf } from './common';

// US-SESION-005 — Identificar la sesión en GET /api/auth/me y rechazar las peticiones sin token válido (API). Preparación de cada fila:
// reinicio de alumno01; cada cuenta inicia sesión en la propia fila con x-tenant alumno01 y su contraseña (admin@sigpro.test completa el
// segundo paso con 123456). Las comprobaciones de permiso por rol no son de esta historia.

const ACCOUNTS: ReadonlyMap<string, Credentials> = new Map<string, Credentials>([
  ['gestor@sigpro.test', DEMO.gestor],
  ['consultor@sigpro.test', DEMO.consultor],
  ['auditor@sigpro.test', DEMO.auditor],
  ['alumno01@sigpro.lab', adminCredentials(TENANT_A)],
  ['admin@sigpro.test', DEMO.admin],
]);

/** Roles de la celda «rol» de la fila (los del seed de la historia). */
const ROLES: ReadonlyMap<string, string> = new Map<string, string>([
  ['program_manager', 'program_manager'],
  ['consultant', 'consultant'],
  ['auditor', 'auditor'],
  ['admin', 'admin'],
]);

const STEPS: ReadonlyMap<string, 'password' | 'mfa'> = new Map<string, 'password' | 'mfa'>([
  ['con su contraseña', 'password'],
  ['con el segundo paso completado con el código 123456', 'mfa'],
]);

const MFA_FLAGS: ReadonlyMap<string, boolean> = new Map<string, boolean>([
  ['false', false],
  ['true', true],
]);

/** Cabecera `x-tenant` de la fila: el valor, o `undefined` para «(sin cabecera)». */
const HEADER_TENANTS: ReadonlyMap<string, string | undefined> = new Map<string, string | undefined>([
  ['x-tenant alumno01', TENANT_A],
  ['x-tenant alumno02', TENANT_B],
  ['(sin cabecera)', undefined],
]);

/** Sesión de una cuenta por contraseña, o por el segundo paso de admin@sigpro.test (la única cuenta que lo tiene). */
const sessionOfStep = async (account: string, step: 'password' | 'mfa'): Promise<{ readonly session: Session | undefined; readonly last: ApiResult }> => {
  const credentials = strict('cuenta', ACCOUNTS, account);
  if (step === 'mfa') {
    if (credentials.email !== DEMO.admin.email) throw new Error(`celda sin interpretación: el segundo paso no corresponde a «${account}»`);
    const mfa = await mfaTokenOfAdmin();
    if (mfa.mfaToken === undefined) return { session: undefined, last: mfa.result };
    const redeemed = await redeemMfa(mfa.mfaToken);
    return { session: sessionOf(redeemed), last: redeemed };
  }
  const started = await loginAs(credentials);
  return { session: sessionOf(started), last: started };
};

// --- Esquema 1: un accessToken vigente identifica la cuenta de la sesión -----------------------------------------------------

const identifiesAccount: ApiRowHandler = async (row) => {
  const account = cell(row, 'cuenta');
  const name = cell(row, 'nombre');
  const role = strict('rol', ROLES, cell(row, 'rol'));
  const mfaFlag = strict('mfa', MFA_FLAGS, cell(row, 'mfa'));
  const step = strict('paso', STEPS, cell(row, 'paso'));
  const expected = `200 con el usuario ${account}, el nombre ${name}, el rol ${role} y mfa ${String(mfaFlag)}; tenant alumno01`;
  await resetTenants([TENANT_A]);
  const started = await sessionOfStep(account, step);
  if (started.session === undefined) return preparationFailed(expected, `${account} tiene una sesión iniciada ${cell(row, 'paso')}`, started.last);
  const profile = await me(started.session.accessToken, TENANT_A);
  const user = userOf(profile.body);
  return conclude([
    responseCheck(profile, { status: 200 }),
    check(user.email === account, `el usuario ${account}`, `el usuario ${shortText(user.email)}`),
    check(user.name === name, `el nombre ${name}`, `el nombre ${shortText(user.name)}`),
    check(user.role === role, `el rol ${role}`, `el rol ${shortText(user.role)}`),
    check(user.mfa === mfaFlag, `mfa ${String(mfaFlag)}`, `mfa ${shortText(user.mfa)}`),
    check(user.tenant === TENANT_A, 'el tenant del usuario es alumno01', `el tenant del usuario es ${shortText(user.tenant)}`),
  ]);
};

// --- Esquema 2: sin accessToken válido en la cabecera Authorization la respuesta es missing_token -----------------------------

/** Cabecera Authorization que envía la fila; el accessToken de gestor se pasa como argumento. */
const MISSING_HEADERS: ReadonlyMap<string, (accessToken: string) => Readonly<Record<string, string>>> = new Map<string, (accessToken: string) => Readonly<Record<string, string>>>([
  ['(sin cabecera Authorization)', () => ({})],
  ['Authorization con solo la palabra Bearer', () => ({ authorization: 'Bearer' })],
  ['Authorization con el esquema Basic y el accessToken de gestor@sigpro.test', (accessToken) => ({ authorization: `Basic ${accessToken}` })],
]);

const missingToken: ApiRowHandler = async (row) => {
  const expected = '401 missing_token';
  await resetTenants([TENANT_A]);
  const started = await loginAs(DEMO.gestor);
  const session = sessionOf(started);
  if (!session) return preparationFailed(expected, 'gestor@sigpro.test ha iniciado sesión', started);
  const headers = strict('cabecera', MISSING_HEADERS, cell(row, 'cabecera'))(session.accessToken);
  const result = await rawGet('/auth/me', { 'x-tenant': TENANT_A, ...headers });
  return conclude([responseCheck(result, { status: 401, code: 'missing_token' })]);
};

// --- Esquema 3: un token que no es un accessToken válido responde invalid_token -----------------------------------------------

interface Tokens {
  readonly accessToken: string;
  readonly refreshToken: string;
  readonly mfaToken: string;
}

/** Valor enviado como Bearer en cada fila de la celda «token». */
const BEARERS: ReadonlyMap<string, (tokens: Tokens) => string> = new Map<string, (tokens: Tokens) => string>([
  ['un texto que no es un token', () => 'un texto que no es un token'],
  ['el accessToken de gestor@sigpro.test con su última letra cambiada', (tokens) => alteredLast(tokens.accessToken)],
  ['el refreshToken de gestor@sigpro.test', (tokens) => tokens.refreshToken],
  ['el mfaToken de admin@sigpro.test', (tokens) => tokens.mfaToken],
]);

const notAnAccessToken: ApiRowHandler = async (row) => {
  const expected = '401 invalid_token';
  await resetTenants([TENANT_A]);
  const started = await loginAs(DEMO.gestor);
  const session = sessionOf(started);
  if (!session) return preparationFailed(expected, 'gestor@sigpro.test ha iniciado sesión', started);
  const mfa = await mfaTokenOfAdmin();
  if (mfa.mfaToken === undefined) return preparationFailed(expected, 'admin@sigpro.test ha recibido un mfaToken', mfa.result);
  const bearer = strict('token', BEARERS, cell(row, 'token'))({ accessToken: session.accessToken, refreshToken: session.refreshToken, mfaToken: mfa.mfaToken });
  const result = await me(bearer, TENANT_A);
  return conclude([responseCheck(result, { status: 401, code: 'invalid_token' })]);
};

// --- Esquema 4: un accessToken sigue dando acceso hasta caducar aunque la cuenta cambie de estado --------------------------

type ChangeOutcome = { readonly done: true } | { readonly done: false; readonly step: string; readonly result: ApiResult };

/** Cambio de estado de la fila; «hecho» solo si la API responde lo que la historia da por hecho. */
const CHANGES: ReadonlyMap<string, () => Promise<ChangeOutcome>> = new Map<string, () => Promise<ChangeOutcome>>([
  [
    'alumno01@sigpro.lab la desactiva con PATCH /api/admin/users/u2 y active false',
    async () => {
      const changed = await patchUser('u2', { active: false });
      return changed.status === 200 ? { done: true } : { done: false, step: 'alumno01@sigpro.lab desactiva a gestor@sigpro.test con PATCH /api/admin/users/u2 (200)', result: changed };
    },
  ],
  [
    'falla cinco veces seguidas con x-tenant alumno01 y la contraseña incorrecta, y la cuenta queda bloqueada',
    async () => {
      // `failGestor(5)` devuelve siempre cinco respuestas: la quinta es la que decide si la cuenta quedó bloqueada
      const fifth = (await failGestor(5))[4];
      return fifth?.status === 423 && errorCode(fifth) === 'account_locked'
        ? { done: true }
        : { done: false, step: 'cinco contraseñas incorrectas bloquean la cuenta (423 en la quinta)', result: fifth };
    },
  ],
]);

const stillAccepted: ApiRowHandler = async (row) => {
  const expected = '200 con el usuario gestor@sigpro.test; la renovación con ese refreshToken responde 401 invalid_token';
  await resetTenants([TENANT_A]);
  const started = await loginAs(DEMO.gestor, true);
  const session = sessionOf(started);
  if (!session) return preparationFailed(expected, 'gestor@sigpro.test obtiene su accessToken y su refreshToken con remember true', started);
  const changed = await strict('cambio', CHANGES, cell(row, 'cambio'))();
  if (!changed.done) return preparationFailed(expected, changed.step, changed.result);
  const profile = await me(session.accessToken, TENANT_A);
  const renewed = await refresh(session.refreshToken, TENANT_A);
  return conclude([
    responseCheck(profile, { status: 200 }),
    check(userOf(profile.body).email === DEMO.gestor.email, 'el usuario gestor@sigpro.test', `el usuario ${shortText(userOf(profile.body).email)}`),
    responseCheck(renewed, { status: 401, code: 'invalid_token' }),
  ]);
};

// --- Esquema 5: el tenant de la identidad lo fija el accessToken -------------------------------------------------------------

const tenantFromToken: ApiRowHandler = async (row) => {
  const header = cell(row, 'cabecera');
  const tenant = strict('cabecera', HEADER_TENANTS, header);
  const expected = '200 con el usuario gestor@sigpro.test del tenant alumno01';
  await resetTenants([TENANT_A]);
  const started = await loginAs(DEMO.gestor, true);
  const session = sessionOf(started);
  if (!session) return preparationFailed(expected, 'gestor@sigpro.test obtiene su accessToken con remember true', started);
  const profile = await me(session.accessToken, tenant);
  const user = userOf(profile.body);
  const sameTenant: Check = check(user.tenant === TENANT_A && user.email === DEMO.gestor.email, 'el usuario gestor@sigpro.test del tenant alumno01', `usuario ${shortText(user.email)} del tenant ${shortText(user.tenant)}`);
  return conclude([responseCheck(profile, { status: 200 }), sameTenant]);
};

defineApiRows({
  story: 'US-SESION-005',
  surface: 'api',
  tenants: [TENANT_A, TENANT_B],
  handlers: new Map<number, ApiRowHandler>([
    [1, identifiesAccount],
    [2, missingToken],
    [3, notAnAccessToken],
    [4, stillAccepted],
    [5, tenantFromToken],
  ]),
});
