import { call, decodeJwt, field, usersByEmail, type ApiResult, type Session } from '../../support/api';
import { DEMO, TENANT_A, failedLogins, patchAccountById, resetTenants, startSession } from '../../support/prepare';
import { defineApiRows, type ApiRowHandler } from '../../support/rows';
import { cell, expectationOf, failPreparation, finish, premise, reasonOf, requirePreparation, statuses, strict, type Premise } from './common';

// US-LOGIN-004 — Cerrar sesión sin revocar los tokens ya emitidos. El veredicto de cada fila sale SOLO de sus pasos «Entonces/Y».
// La preparación (sesión, cierre de sesión previo, desactivar o bloquear la cuenta) lanza si no deja el estado de partida que dan
// por hecho los pasos «Dado»: no es una discrepancia de la app. Las duraciones de los tokens (900 s; 7 días o 12 horas) se miden
// con `exp - iat` de los tokens reales de la sesión de la fila, pero solo como dato (observed, nota y evidencia): la historia
// deja la duración de los tokens fuera de alcance, así que no deciden el veredicto.

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

/** Cómo se ejecutó una celda ambigua del cuerpo: la historia no distingue las lecturas, así que se anota la que se probó. */
const BODY_NOTES: ReadonlyMap<string, string> = new Map<string, string>([
  ['(vacío)', '«cuerpo (vacío)» se ejecutó como una petición sin cuerpo; no se probó el cuerpo {}'],
]);

/** Esquema 1: el cierre de sesión responde 204 sin cuerpo (o 422 si el refreshToken no es texto ni null). */
const logoutResponds: ApiRowHandler = async (row) => {
  await resetTenants([TENANT_A]);
  const situation = await strict('situacion', SITUATIONS, cell(row, 'situacion'))();
  const premises = requirePreparation(row, situation.premises);
  const bodyText = cell(row, 'cuerpo');
  const result = await logout(strict('cuerpo', BODIES, bodyText)(situation.session));
  // La fila de 422 solo pide «validation_failed»: se anota el motivo que da la app, que la historia no fija
  const reason = reasonOf(result, 'refreshToken');
  const notes = [BODY_NOTES.get(bodyText), reason === undefined ? undefined : `El motivo observado para refreshToken es «${reason}»; la historia no fija el motivo, solo 422 validation_failed`].filter((text): text is string => text !== undefined);
  return finish(row, result, { premises, ...(notes.length === 0 ? {} : { note: notes.join('. ') }) });
};

const REMEMBER: ReadonlyMap<string, boolean> = new Map<string, boolean>([
  ['true', true],
  ['false', false],
]);

const CHANGE_NONE = 'nadie cambia la cuenta';
const CHANGE_DISABLE = 'alumno01@sigpro.lab desactiva la cuenta gestor@sigpro.test con PATCH /api/admin/users/u2 y active false';
const CHANGE_LOCK = 'se envían 5 POST /api/auth/login con gestor@sigpro.test y una contraseña incorrecta, y la cuenta queda bloqueada';

/** Lo que ocurre con la cuenta después del cierre de sesión; devuelve lo que la historia da por hecho en ese paso (preparación). */
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

const PROGRAMS = 'GET /api/programs con ese accessToken';

/** Lo que se envía a la API con los tokens que ya emitió: la renovación, la sesión del usuario y una lista protegida. */
const REQUESTS: ReadonlyMap<string, (session: Session) => Promise<ApiResult>> = new Map<string, (session: Session) => Promise<ApiResult>>([
  ['POST /api/auth/refresh con ese refreshToken', (session) => call('POST', '/auth/refresh', { tenant: TENANT_A, body: { refreshToken: session.refreshToken } })],
  ['GET /api/auth/me con ese accessToken', (session) => call('GET', '/auth/me', { tenant: TENANT_A, token: session.accessToken })],
  [PROGRAMS, (session) => call('GET', '/programs', { tenant: TENANT_A, token: session.accessToken })],
]);

/** Vidas reales de la sesión de la fila (`exp - iat`): solo dato; las Reglas dicen 900 s y 7 días (remember true) o 12 horas (false). */
const lifetimeOf = (session: Session, remember: boolean) => {
  const access = decodeJwt(session.accessToken);
  const refresh = decodeJwt(session.refreshToken);
  return {
    accessSeconds: access.exp - access.iat,
    refreshSeconds: refresh.exp - refresh.iat,
    rulesAccessSeconds: 900,
    rulesRefreshSeconds: remember ? 7 * 24 * 3600 : 12 * 3600,
  };
};

/** Qué devolvió una renovación frente a los tokens de la sesión inicial. */
const renewalOf = (result: ApiResult, session: Session) => {
  const access = field(result.body, 'accessToken');
  const refresh = field(result.body, 'refreshToken');
  return {
    status: result.status,
    hasBothTokens: typeof access === 'string' && access.length > 0 && typeof refresh === 'string' && refresh.length > 0,
    accessTokenIdenticalToInitial: access === session.accessToken,
    refreshTokenIdenticalToInitial: refresh === session.refreshToken,
  };
};

type Renewal = ReturnType<typeof renewalOf>;

const describeRenewal = (label: string, renewal: Renewal): string =>
  `${label}: HTTP ${renewal.status}; ${renewal.hasBothTokens ? 'trae accessToken y refreshToken' : 'no trae los dos tokens'}; idénticos a los iniciales: accessToken ${renewal.accessTokenIdenticalToInitial}, refreshToken ${renewal.refreshTokenIdenticalToInitial}`;

/** Los tokens llevan la hora de emisión en segundos: dos emisiones del mismo segundo son idénticas. Espera al segundo siguiente. */
const untilNextSecond = (issuedAt: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, Math.max(0, (issuedAt + 1) * 1000 - Date.now()) + 50));

const NEW_TOKENS_UNDEFINED = '«nuevos» no está definido en la historia';

/** Esquema 2: cerrar sesión no revoca los tokens; solo los invalida un cambio de la cuenta (desactivarla o bloquearla). */
const tokensSurviveLogout: ApiRowHandler = async (row) => {
  await resetTenants([TENANT_A]);
  const remember = strict('remember', REMEMBER, cell(row, 'remember'));
  const started = await startSession(TENANT_A, DEMO.gestor, remember);
  const session = started.session ?? failPreparation(row, `gestor@sigpro.test acaba de iniciar sesión con remember ${remember}`, `HTTP ${started.result.status}`);
  const out = await logout({ refreshToken: session.refreshToken });
  const change = await strict('cambio_de_cuenta', CHANGES, cell(row, 'cambio_de_cuenta'))();
  const premises = requirePreparation(row, [premise('envía POST /api/auth/logout con su refreshToken y recibe 204', out.status === 204, `HTTP ${out.status}`), ...change]);
  const expectation = expectationOf(row);
  const send = strict('peticion', REQUESTS, cell(row, 'peticion'));
  const comparesWithPrevious = expectation.checks.some((check) => check.requiresPrevious);

  // Primero la petición tal cual la dice la historia (inmediata). Si pide tokens «nuevos» y salen idénticos a los iniciales
  // (la emisión se marca en segundos), se espera al segundo siguiente a la emisión y se repite: la renovación no tiene estado.
  const immediate = await send(session);
  const immediateRenewal = renewalOf(immediate, session);
  const mustRetry = comparesWithPrevious && immediateRenewal.hasBothTokens && (immediateRenewal.accessTokenIdenticalToInitial || immediateRenewal.refreshTokenIdenticalToInitial);
  if (mustRetry) await untilNextSecond(decodeJwt(session.accessToken).iat);
  const delayed = mustRetry ? await send(session) : undefined;
  const result = delayed ?? immediate;
  const delayedRenewal = delayed === undefined ? undefined : renewalOf(delayed, session);

  const lifetime = lifetimeOf(session, remember);
  const lifetimeMatches = lifetime.accessSeconds === lifetime.rulesAccessSeconds && lifetime.refreshSeconds === lifetime.rulesRefreshSeconds;
  const lifetimeText = `Vida medida de la sesión inicial (exp - iat): accessToken ${lifetime.accessSeconds} s, refreshToken ${lifetime.refreshSeconds} s`;
  const items = field(result.body, 'items');
  const programsCarryTenant = (Array.isArray(items) ? items : []).some((item: unknown) => typeof item === 'object' && item !== null && ('tenant' in item || 'tenantId' in item));

  const history = [
    lifetimeText,
    ...(comparesWithPrevious ? [describeRenewal('Renovación inmediata', immediateRenewal)] : []),
    ...(delayedRenewal === undefined ? [] : [describeRenewal('Renovación tras esperar al segundo siguiente a la emisión', delayedRenewal)]),
  ].join('; ');

  const notes = [
    `${lifetimeText}; las Reglas dicen ${lifetime.rulesAccessSeconds} s y ${lifetime.rulesRefreshSeconds} s con remember ${remember} (${lifetimeMatches ? 'coincide' : 'NO coincide: hallazgo aparte'}); la historia deja la duración fuera de alcance, así que no decide el veredicto de esta fila`,
    ...(comparesWithPrevious
      ? [
          mustRetry
            ? `${NEW_TOKENS_UNDEFINED}; con la renovación en el mismo segundo que la emisión los tokens salen idénticos (la emisión se marca en segundos). Se esperó al segundo siguiente a la emisión y se renovó otra vez; el veredicto se toma de esa segunda renovación`
            : `${NEW_TOKENS_UNDEFINED}; la renovación inmediata ${immediateRenewal.hasBothTokens ? 'ya devolvió tokens distintos de los iniciales, así que no se esperó' : 'no devolvió los dos tokens, así que no se esperó'}`,
        ]
      : []),
    ...(cell(row, 'peticion') === PROGRAMS
      ? [programsCarryTenant ? 'Los elementos de la lista traen su tenant y se comprobó' : `Los elementos de la lista no traen campo de tenant, así que la pertenencia a ${TENANT_A} no es comprobable con la lista (el accessToken lleva el tenant ${String(decodeJwt(session.accessToken).tenant)}); solo se exige una lista con al menos un programa`]
      : []),
  ];

  return finish(row, result, {
    expectation,
    premises,
    context: { previous: session },
    history,
    note: notes.join('. '),
    evidence: {
      lifetime,
      ...(comparesWithPrevious ? { renewals: [{ moment: 'inmediata', ...immediateRenewal }, ...(delayedRenewal === undefined ? [] : [{ moment: 'tras esperar al segundo siguiente', ...delayedRenewal }])] } : {}),
    },
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
