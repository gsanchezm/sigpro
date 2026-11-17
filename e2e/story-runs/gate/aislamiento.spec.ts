import { expect, test } from '@playwright/test';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  NO_CHAOS,
  adminToken,
  call,
  decodeJwt,
  errorCode,
  field,
  login,
  readConfig,
  resetTenant,
  sessionOf,
  setChaos,
  uniqueEmail,
  usersByEmail,
  type ApiResult,
} from '../support/api';
import { RESULTS_ROOT, writeJsonResult } from '../support/evidence';

// PUERTA DE AISLAMIENTO. Demuestra, con salida registrada, que las filas de las historias se pueden repetir sin
// interferencias: qué restablece el reinicio de un tenant y qué NO, cómo se comporta el caos, las sesiones y los correos
// únicos. Si algo de esto cambia, las líneas «Preparación» de las historias y del README dejan de ser ciertas.
// Falla si la pila no es la esperada (defectos del curso activos, caos encendido o tenants sin su seed).

const T1 = 'alumno01';
const T2 = 'alumno02';
const GESTOR = { email: 'gestor@sigpro.test', password: 'Gestor1234!' } as const;
const CONSULTOR = { email: 'consultor@sigpro.test', password: 'Consul1234!' } as const;
const PENDIENTE = { email: 'pendiente@sigpro.test', password: 'Pend1234!' } as const;
const BAD_PASSWORD = 'Contraseña-incorrecta-1';

/** Lo observable de una respuesta, sin campos volátiles (`traceId`, tokens, fechas). */
interface Signature {
  readonly status: number;
  readonly code?: string;
  readonly attempts?: number;
  readonly mfaRequired?: boolean;
}

const sig = (result: ApiResult): Signature => {
  const code = errorCode(result);
  const attempts = field(result.body, 'attempts');
  const mfaRequired = field(result.body, 'mfaRequired');
  return {
    status: result.status,
    ...(code === undefined ? {} : { code }),
    ...(typeof attempts === 'number' ? { attempts } : {}),
    ...(typeof mfaRequired === 'boolean' ? { mfaRequired } : {}),
  };
};

interface EvidenceEntry {
  readonly check: string;
  readonly observed: unknown;
  readonly conclusion: string;
}

const evidence: EvidenceEntry[] = [];
const record = (check: string, observed: unknown, conclusion: string): void => {
  evidence.push({ check, observed, conclusion });
};

const wrongLogin = (tenant: string, email: string): Promise<ApiResult> => login({ tenant, email, password: BAD_PASSWORD });

// --- Escenarios repetibles (cada uno empieza reiniciando su tenant y devuelve solo firmas estables) -----------------------

const scenarioLock = async (tenant: string): Promise<unknown> => {
  await resetTenant(tenant);
  const failures: Signature[] = [];
  for (let attempt = 1; attempt <= 5; attempt += 1) failures.push(sig(await wrongLogin(tenant, GESTOR.email)));
  const correctWhileLocked = sig(await login({ tenant, ...GESTOR }));
  await resetTenant(tenant);
  const correctAfterReset = sig(await login({ tenant, ...GESTOR }));
  return { failures, correctWhileLocked, correctAfterReset };
};

const scenarioDisabled = async (tenant: string): Promise<unknown> => {
  await resetTenant(tenant);
  const consultor = (await usersByEmail(tenant)).get(CONSULTOR.email);
  const patch = await call('PATCH', `/admin/users/${String(consultor?.id)}`, { tenant, token: await adminToken(tenant), body: { active: false } });
  const whileDisabled = sig(await login({ tenant, ...CONSULTOR }));
  await resetTenant(tenant);
  const afterReset = sig(await login({ tenant, ...CONSULTOR }));
  return { patch: patch.status, whileDisabled, afterReset };
};

const scenarioRegister = async (tenant: string): Promise<unknown> => {
  await resetTenant(tenant);
  const email = uniqueEmail('solicitud');
  const register = await call('POST', '/auth/register', {
    tenant,
    body: { first: 'Ana', last: 'Prueba', email, org: 'Laboratorio', role: 'consultant', password: 'Abcdefghij1!', confirm: 'Abcdefghij1!', terms: true },
  });
  const pending = sig(await login({ tenant, email, password: 'Abcdefghij1!' }));
  const seededPending = sig(await login({ tenant, ...PENDIENTE }));
  await resetTenant(tenant);
  const afterReset = sig(await login({ tenant, email, password: 'Abcdefghij1!' }));
  return { register: register.status, pending, seededPending, afterReset };
};

const scenarioUnknownEmail = async (tenant: string): Promise<unknown> => {
  const email = uniqueEmail('nadie');
  const before: Signature[] = [];
  for (let attempt = 1; attempt <= 2; attempt += 1) before.push(sig(await wrongLogin(tenant, email)));
  await resetTenant(tenant);
  // Tras el reinicio del tenant el contador sigue donde estaba: el siguiente intento es el 3.º, no el 1.º. Se queda por debajo
  // del umbral de bloqueo a propósito: la puerta prueba el aislamiento, no cómo trata la app el umbral de un correo sin cuenta.
  const afterReset = sig(await wrongLogin(tenant, email));
  const otherEmail = sig(await wrongLogin(tenant, uniqueEmail('otro')));
  return { before, afterReset, otherEmail };
};

const scenarioDurations = async (tenant: string): Promise<unknown> => {
  await resetTenant(tenant);
  const durations = async (remember: boolean) => {
    const session = sessionOf(await login({ tenant, ...GESTOR, remember }));
    if (!session) return undefined;
    const access = decodeJwt(session.accessToken);
    const refresh = decodeJwt(session.refreshToken);
    return { accessSeconds: access.exp - access.iat, refreshSeconds: refresh.exp - refresh.iat };
  };
  return { remember: await durations(true), noRemember: await durations(false) };
};

const scenarioTokensAcrossReset = async (tenant: string): Promise<unknown> => {
  await resetTenant(tenant);
  const session = sessionOf(await login({ tenant, ...GESTOR }));
  if (!session) throw new Error('login de gestor sin sesión');
  await resetTenant(tenant);
  const me = await call('GET', '/auth/me', { tenant, token: session.accessToken });
  const refresh = await call('POST', '/auth/refresh', { tenant, body: { refreshToken: session.refreshToken } });
  return { meWithOldAccessToken: me.status, refreshWithOldRefreshToken: refresh.status };
};

const SCENARIOS = [
  ['bloqueo', scenarioLock],
  ['desactivada', scenarioDisabled],
  ['solicitud', scenarioRegister],
  ['correo-sin-cuenta', scenarioUnknownEmail],
  ['duraciones', scenarioDurations],
  ['tokens-tras-reinicio', scenarioTokensAcrossReset],
] as const;

type Observations = Readonly<Record<string, unknown>>;

const runPass = async (tenants: readonly string[], scenarios: typeof SCENARIOS): Promise<Observations> => {
  const observed: Record<string, unknown> = {};
  for (const tenant of tenants) {
    for (const [name, run] of scenarios) observed[`${tenant}/${name}`] = await run(tenant);
  }
  return observed;
};

test.describe.configure({ mode: 'serial' });

// La puerta cuenta sus propias pruebas: solo «pasó» si las 8 corrieron y ninguna falló (en serie, un fallo salta las demás).
const EXPECTED_TESTS = 8;
let ran = 0;
let failed = 0;
const RUN_ID = process.env.SIGPRO_STORIES_RUN_ID ?? 'sin-id';

interface GateRun {
  readonly runId: string;
  readonly passed: boolean;
}

/** Ejecuciones anteriores de la puerta (una por cada `playwright test` completo): el informe exige que la de cada historia pasara. */
const previousGateRuns = (): readonly GateRun[] => {
  const path = resolve(RESULTS_ROOT, 'aislamiento.json');
  if (!existsSync(path)) return [];
  const saved = JSON.parse(readFileSync(path, 'utf8')) as { readonly runs?: readonly GateRun[] };
  return saved.runs ?? [];
};

// Playwright exige el patrón de desestructuración en el primer argumento de un hook, aunque no se use ninguna fixture
// eslint-disable-next-line no-empty-pattern
test.afterEach(({}, testInfo) => {
  ran += 1;
  if (testInfo.status !== testInfo.expectedStatus) failed += 1;
});

test.afterAll(async () => {
  // Deja el tenant sin caos y con su seed, pase lo que pase
  await setChaos(T1, NO_CHAOS);
  await resetTenant(T1);
  await resetTenant(T2);
  const passed = failed === 0 && ran === EXPECTED_TESTS;
  writeJsonResult('aislamiento.json', {
    generatedAt: new Date().toISOString(),
    runId: RUN_ID,
    passed,
    ran,
    failed,
    runs: [...previousGateRuns().filter((run) => run.runId !== RUN_ID), { runId: RUN_ID, passed }],
    entries: evidence,
  });
});

test('0. la pila es la esperada: defectos del curso apagados y caos apagado', async () => {
  const config = await readConfig(T1);
  const health = await call('GET', '/health');
  record('Configuración pública de alumno01', { status: config.status, body: config.body }, 'plantedBugs debe ser false y el caos, cero');
  record('Salud de la API', { status: health.status, body: health.body }, 'La API responde');
  expect(config.status).toBe(200);
  expect(field(config.body, 'plantedBugs'), 'PLANTED_BUGS debe estar en false').toBe(false);
  expect(field(config.body, 'chaos')).toEqual(NO_CHAOS);
  // Los dos tenants de la prueba existen con su seed
  expect((await usersByEmail(T1)).has('alumno01@sigpro.lab')).toBe(true);
  expect((await usersByEmail(T2)).has('alumno02@sigpro.lab')).toBe(true);
});

test('1. el reinicio restablece bloqueos y desactivaciones de UN tenant (el del token) y deja intacto el otro', async () => {
  await resetTenant(T1);
  await resetTenant(T2);
  // Se ensucian los dos: alumno01 con gestor bloqueado y consultor desactivado; alumno02 con 4 intentos fallidos de gestor
  for (let attempt = 1; attempt <= 5; attempt += 1) await wrongLogin(T1, GESTOR.email);
  const lockedBefore = sig(await login({ tenant: T1, ...GESTOR }));
  const consultorT1 = (await usersByEmail(T1)).get(CONSULTOR.email);
  await call('PATCH', `/admin/users/${String(consultorT1?.id)}`, { tenant: T1, token: await adminToken(T1), body: { active: false } });
  const disabledBefore = sig(await login({ tenant: T1, ...CONSULTOR }));
  const dirty: Signature[] = [];
  for (let attempt = 1; attempt <= 4; attempt += 1) dirty.push(sig(await wrongLogin(T2, GESTOR.email)));
  // Se reinicia alumno01 con SU token y la cabecera de alumno02: manda el tenant del token
  const resetT1 = await call('POST', '/admin/reset', { tenant: T2, token: await adminToken(T1) });
  const gestorAfter = sig(await login({ tenant: T1, ...GESTOR }));
  const consultorAfter = sig(await login({ tenant: T1, ...CONSULTOR }));
  // Si el reinicio de alumno01 tocara alumno02, el 5.º intento sería el 1.º (401); intacto, alumno02 conserva sus 4 intentos
  const fifth = sig(await wrongLogin(T2, GESTOR.email));
  record(
    'Reinicio de alumno01 (token de alumno01 + cabecera x-tenant: alumno02), con alumno01 sucio y alumno02 a 4 intentos',
    { lockedBefore, disabledBefore, dirty, resetStatus: resetT1.status, gestorAfter, consultorAfter, fifthAttemptInAlumno02: fifth },
    'Restablece alumno01 (cuenta bloqueada y desactivada vuelven a entrar); alumno02 conserva sus 4 intentos',
  );
  expect(lockedBefore).toEqual({ status: 423, code: 'account_locked' });
  expect(disabledBefore).toEqual({ status: 403, code: 'account_disabled' });
  expect(dirty.map((s) => s.attempts)).toEqual([1, 2, 3, 4]);
  expect(resetT1.status).toBe(200);
  expect(gestorAfter.status).toBe(200);
  expect(consultorAfter.status).toBe(200);
  expect(fifth).toEqual({ status: 423, code: 'account_locked' });
  await resetTenant(T2);
  const afterOwnReset = sig(await login({ tenant: T2, ...GESTOR }));
  record('Reinicio de alumno02 con su propio token', afterOwnReset, 'La cuenta bloqueada de alumno02 vuelve a entrar');
  expect(afterOwnReset.status).toBe(200);
});

test('2. el caos NO se restablece con el reinicio: cada fila debe fijarlo y comprobarlo', async () => {
  await setChaos(T1, { latencyMs: 50, errorRate: 0, flakyLabels: true });
  await resetTenant(T1);
  const afterReset = await readConfig(T1);
  record('Caos de alumno01 tras reiniciar el tenant', field(afterReset.body, 'chaos'), 'Si sigue encendido, el reinicio NO lo apaga');
  expect(field(afterReset.body, 'chaos')).toEqual({ latencyMs: 50, errorRate: 0, flakyLabels: true });
  await setChaos(T1, NO_CHAOS);
  const off = await readConfig(T1);
  record('Caos de alumno01 tras apagarlo explícitamente', field(off.body, 'chaos'), 'Apagado con PATCH /api/admin/chaos');
  expect(field(off.body, 'chaos')).toEqual(NO_CHAOS);
  // El caos de un tenant no afecta a otro
  expect(field((await readConfig(T2)).body, 'chaos')).toEqual(NO_CHAOS);
});

test('3. las sesiones emitidas antes de un reinicio SIGUEN valiendo después: ninguna fila reutiliza tokens', async () => {
  const observed = await scenarioTokensAcrossReset(T1);
  record('Tokens emitidos antes del reinicio, usados después', observed, 'Los ids del seed son fijos y los tokens son sin estado');
  expect(observed).toEqual({ meWithOldAccessToken: 200, refreshWithOldRefreshToken: 200 });
});

test('4. el reinicio del tenant no reinicia el contador de un correo sin cuenta: cada fila usa un correo único', async () => {
  const observed = (await scenarioUnknownEmail(T1)) as { before: Signature[]; afterReset: Signature; otherEmail: Signature };
  record('Intentos con un correo sin cuenta antes y después del reinicio del tenant, y con otro correo', observed, 'El contador continúa tras el reinicio (3.º intento); un correo nuevo empieza en 1');
  expect(observed.before.map((s) => s.attempts)).toEqual([1, 2]);
  expect(observed.afterReset.attempts).toBe(3);
  expect(observed.otherEmail.attempts).toBe(1);
});

test('5. las duraciones de los tokens son las que declaran las historias (900 s, 7 d con remember, 12 h sin él)', async () => {
  const observed = await scenarioDurations(T1);
  record('Vida de los tokens medida con exp - iat', observed, 'Se mide la duración real; no se cambia ACCESS_TOKEN_TTL_S');
  expect(observed).toEqual({
    remember: { accessSeconds: 900, refreshSeconds: 7 * 24 * 3600 },
    noRemember: { accessSeconds: 900, refreshSeconds: 12 * 3600 },
  });
});

test('6. REPETIBILIDAD: los mismos escenarios, dos veces seguidas y luego en orden inverso, dan las mismas observaciones', async () => {
  const first = await runPass([T1, T2], SCENARIOS);
  const second = await runPass([T1, T2], SCENARIOS);
  const reversed = await runPass([T2, T1], [...SCENARIOS].reverse() as unknown as typeof SCENARIOS);
  record('Escenarios y observaciones', { scenarios: SCENARIOS.map(([name]) => name), pass1: first, pass2: second, pass3Reversed: reversed }, 'Idénticas entre pasadas');
  expect(second).toEqual(first);
  // El orden de las claves cambia en la pasada inversa; se compara por clave
  expect(Object.fromEntries(Object.entries(reversed).sort())).toEqual(Object.fromEntries(Object.entries(first).sort()));
  // Repetir no basta: el reinicio debe además RESTABLECER de verdad (un reinicio que no restaurara nada daría pasadas iguales)
  for (const tenant of [T1, T2]) {
    expect((first[`${tenant}/bloqueo`] as { failures: Signature[] }).failures.map((s) => s.status)).toEqual([401, 401, 401, 401, 423]);
    expect((first[`${tenant}/bloqueo`] as { correctWhileLocked: Signature }).correctWhileLocked.status).toBe(423);
    expect((first[`${tenant}/bloqueo`] as { correctAfterReset: Signature }).correctAfterReset.status).toBe(200);
    expect((first[`${tenant}/desactivada`] as { whileDisabled: Signature }).whileDisabled.status).toBe(403);
    expect((first[`${tenant}/desactivada`] as { afterReset: Signature }).afterReset.status).toBe(200);
    expect((first[`${tenant}/solicitud`] as { pending: Signature }).pending.status).toBe(403);
    expect((first[`${tenant}/solicitud`] as { afterReset: Signature }).afterReset.status).toBe(401);
  }
});

test('7. tras todo lo anterior, alumno01 queda con su seed y una sesión nueva funciona', async () => {
  await resetTenant(T1);
  await resetTenant(T2);
  expect((await login({ tenant: T1, ...GESTOR })).status).toBe(200);
  const users = await usersByEmail(T1);
  const flags = [...users.values()].map((u) => ({ email: u.email, active: u.active, locked: u.locked, pending: u.pending }));
  record('Estado de las cuentas de alumno01 tras reiniciar', flags, 'Todas activas y sin bloqueo, salvo bloqueado@ (bloqueada) y pendiente@ (pendiente)');
  const clean = flags.filter((u) => u.email !== 'bloqueado@sigpro.test' && u.email !== 'pendiente@sigpro.test');
  expect(clean.every((u) => u.active === true && u.locked === false && u.pending === false)).toBe(true);
  expect(flags.find((u) => u.email === 'bloqueado@sigpro.test')).toMatchObject({ locked: true });
  expect(flags.find((u) => u.email === 'pendiente@sigpro.test')).toMatchObject({ pending: true });
});
