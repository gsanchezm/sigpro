import { call, decodeJwt, field, usersByEmail, type ApiResult, type Session } from '../../support/api';
import { DEMO, TENANT_A, failedLogins, patchAccountById, resetTenants, startSession } from '../../support/prepare';
import type { Check } from '../../support/response';
import { defineApiRows, type ApiRowHandler } from '../../support/rows';
import { blocked, cell, expectationOf, finish, premise, statuses, strict, type Premise } from './common';

// US-LOGIN-004 — Cerrar sesión sin revocar los tokens ya emitidos. Las expectativas salen de los pasos «Entonces» de cada fila.
// Las duraciones (900 s del accessToken; 7 días o 12 horas del refreshToken) se miden con `exp - iat` de los tokens reales de la
// sesión de la fila; no se toca la configuración del servidor.

/** `POST /api/auth/logout` (público: sin Authorization). `undefined` significa «sin cuerpo». */
const logout = (body: unknown): Promise<ApiResult> => call('POST', '/auth/logout', { tenant: TENANT_A, ...(body === undefined ? {} : { body }) });

interface Situation {
  readonly session: Session | undefined;
  readonly premises: readonly Premise[];
}

const signedIn = async (): Promise<Situation> => {
  const started = await startSession(TENANT_A, DEMO.gestor);
  return { session: started.session, premises: [premise('gestor@sigpro.test inicia sesión y recibe sus tokens', started.session !== undefined, `HTTP ${started.result.status}`)] };
};

const signedInAndOut = async (): Promise<Situation> => {
  const before = await signedIn();
  if (!before.session) return before;
  const out = await logout({ refreshToken: before.session.refreshToken });
  return { session: before.session, premises: [...before.premises, premise('ya envió POST /api/auth/logout con su refreshToken y recibió 204', out.status === 204, `HTTP ${out.status}`)] };
};

const SITUATIONS: ReadonlyMap<string, () => Promise<Situation>> = new Map<string, () => Promise<Situation>>([
  ['gestor@sigpro.test acaba de iniciar sesión', signedIn],
  ['gestor@sigpro.test acaba de iniciar sesión y ya envió POST /api/auth/logout con su refreshToken', signedInAndOut],
  ['el cliente no ha iniciado sesión', async () => ({ session: undefined, premises: [] })],
]);

const sessionFor = (text: string, session: Session | undefined): Session => {
  if (!session) throw new Error(`celda sin interpretación: «${text}» exige una sesión iniciada y la situación de la fila no la tiene`);
  return session;
};

/** Cuerpo de la petición de cierre de sesión; `undefined` es «sin cuerpo» (lo que la historia llama «(vacío)»). */
const BODIES: ReadonlyMap<string, (session: Session | undefined) => unknown> = new Map<string, (session: Session | undefined) => unknown>([
  ['refreshToken igual a su refreshToken', (session) => ({ refreshToken: sessionFor('refreshToken igual a su refreshToken', session).refreshToken })],
  ['refreshToken igual al mismo refreshToken', (session) => ({ refreshToken: sessionFor('refreshToken igual al mismo refreshToken', session).refreshToken })],
  ['refreshToken null', () => ({ refreshToken: null })],
  ['(vacío)', () => undefined],
  ['refreshToken igual al texto no-es-un-token', () => ({ refreshToken: 'no-es-un-token' })],
  ['refreshToken igual al número 123', () => ({ refreshToken: 123 })],
]);

/** Esquema 1: el cierre de sesión responde 204 sin cuerpo (o 422 si el refreshToken no es texto ni null). */
const logoutResponds: ApiRowHandler = async (row) => {
  await resetTenants([TENANT_A]);
  const situation = await strict('situacion', SITUATIONS, cell(row, 'situacion'))();
  if (situation.premises.some((item) => !item.ok)) return blocked(row, situation.premises);
  const result = await logout(strict('cuerpo', BODIES, cell(row, 'cuerpo'))(situation.session));
  return finish(row, result, { premises: situation.premises });
};

const REMEMBER: ReadonlyMap<string, boolean> = new Map<string, boolean>([
  ['true', true],
  ['false', false],
]);

const CHANGE_NONE = 'nadie cambia la cuenta';
const CHANGE_DISABLE = 'alumno01@sigpro.lab desactiva la cuenta gestor@sigpro.test con PATCH /api/admin/users/u2 y active false';
const CHANGE_LOCK = 'se envían 5 POST /api/auth/login con gestor@sigpro.test y una contraseña incorrecta, y la cuenta queda bloqueada';

/** Lo que ocurre con la cuenta después del cierre de sesión; devuelve lo que la historia da por hecho en ese paso. */
const CHANGES: ReadonlyMap<string, () => Promise<readonly Premise[]>> = new Map<string, () => Promise<readonly Premise[]>>([
  [CHANGE_NONE, async () => []],
  [
    CHANGE_DISABLE,
    async () => {
      const id = (await usersByEmail(TENANT_A)).get(DEMO.gestor.email)?.id;
      const patch = await patchAccountById(TENANT_A, 'u2', false);
      return [
        premise('u2 es la cuenta gestor@sigpro.test', id === 'u2', `el id de gestor@sigpro.test en el listado es ${String(id)}`),
        premise('alumno01@sigpro.lab desactiva la cuenta con PATCH /api/admin/users/u2 y active false', patch.status === 200, `HTTP ${patch.status}`),
      ];
    },
  ],
  [
    CHANGE_LOCK,
    async () => {
      const attempts = await failedLogins(TENANT_A, DEMO.gestor.email, 5);
      return [premise('5 POST /api/auth/login con una contraseña incorrecta dejan la cuenta bloqueada', attempts.at(-1)?.status === 423, `HTTP ${statuses(attempts)}`)];
    },
  ],
]);

/** Lo que se envía a la API con los tokens que ya emitió: la renovación, la sesión del usuario y una lista protegida. */
const REQUESTS: ReadonlyMap<string, (session: Session) => Promise<ApiResult>> = new Map<string, (session: Session) => Promise<ApiResult>>([
  ['POST /api/auth/refresh con ese refreshToken', (session) => call('POST', '/auth/refresh', { tenant: TENANT_A, body: { refreshToken: session.refreshToken } })],
  ['GET /api/auth/me con ese accessToken', (session) => call('GET', '/auth/me', { tenant: TENANT_A, token: session.accessToken })],
  ['GET /api/programs con ese accessToken', (session) => call('GET', '/programs', { tenant: TENANT_A, token: session.accessToken })],
]);

/** Duraciones reales de la sesión de la fila (`exp - iat`) frente a lo que dicen las Reglas: 900 s, y 7 días o 12 horas según `remember`. */
const lifetime = (session: Session): { readonly accessSeconds: number; readonly refreshSeconds: number } => {
  const access = decodeJwt(session.accessToken);
  const refresh = decodeJwt(session.refreshToken);
  return { accessSeconds: access.exp - access.iat, refreshSeconds: refresh.exp - refresh.iat };
};

const lifetimeChecks = (session: Session, remember: boolean): readonly Check[] => {
  const measured = lifetime(session);
  const refreshExpected = remember ? 7 * 24 * 3600 : 12 * 3600;
  return [
    { label: 'la vida del accessToken inicial es 900 s', verify: () => (measured.accessSeconds === 900 ? undefined : `vida del accessToken inicial ${measured.accessSeconds} s`) },
    {
      label: `la vida del refreshToken inicial es ${refreshExpected} s (${remember ? '7 días' : '12 horas'} con remember ${remember})`,
      verify: () => (measured.refreshSeconds === refreshExpected ? undefined : `vida del refreshToken inicial ${measured.refreshSeconds} s`),
    },
  ];
};

/** Los tokens llevan la hora de emisión en segundos: dos emisiones del mismo segundo son idénticas, así que se espera al siguiente. */
const untilNextSecond = (issuedAt: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, Math.max(0, (issuedAt + 1) * 1000 - Date.now()) + 50));

/** Esquema 2: cerrar sesión no revoca los tokens; solo los invalida un cambio de la cuenta (desactivarla o bloquearla). */
const tokensSurviveLogout: ApiRowHandler = async (row) => {
  await resetTenants([TENANT_A]);
  const remember = strict('remember', REMEMBER, cell(row, 'remember'));
  const started = await startSession(TENANT_A, DEMO.gestor, remember);
  if (!started.session) return blocked(row, [premise(`gestor@sigpro.test acaba de iniciar sesión con remember ${remember}`, false, `HTTP ${started.result.status}`)]);
  const session = started.session;
  const out = await logout({ refreshToken: session.refreshToken });
  const change = await strict('cambio_de_cuenta', CHANGES, cell(row, 'cambio_de_cuenta'))();
  const premises = [premise('envía POST /api/auth/logout con su refreshToken y recibe 204', out.status === 204, `HTTP ${out.status}`), ...change];
  const expectation = expectationOf(row);
  // «nuevos» solo es comprobable si la emisión nueva cae en otro segundo que la inicial: se espera y se dice en la nota
  const comparesWithPrevious = expectation.checks.some((check) => check.requiresPrevious);
  if (comparesWithPrevious) await untilNextSecond(decodeJwt(session.accessToken).iat);
  const result = await strict('peticion', REQUESTS, cell(row, 'peticion'))(session);
  const measured = lifetime(session);
  const renewed = {
    accessToken: field(result.body, 'accessToken') === session.accessToken,
    refreshToken: field(result.body, 'refreshToken') === session.refreshToken,
  };
  return finish(row, result, {
    expectation,
    premises,
    context: { previous: session },
    extraChecks: lifetimeChecks(session, remember),
    history: `Vida medida de la sesión inicial (exp - iat): accessToken ${measured.accessSeconds} s, refreshToken ${measured.refreshSeconds} s${comparesWithPrevious ? `; tokens devueltos idénticos a los iniciales: accessToken ${renewed.accessToken}, refreshToken ${renewed.refreshToken}` : ''}`,
    ...(comparesWithPrevious
      ? { note: 'Los tokens llevan la hora de emisión en segundos: se esperó al segundo siguiente a la emisión inicial para que «nuevos» (distintos de los iniciales) sea comprobable.' }
      : {}),
  });
};

defineApiRows({
  story: 'US-LOGIN-004',
  surface: 'api',
  tenants: [TENANT_A],
  handlers: new Map<number, ApiRowHandler>([
    [1, logoutResponds],
    [2, tokensSurviveLogout],
  ]),
});
