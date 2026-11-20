import { execFileSync, spawn, type ChildProcess } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createServer, type Server } from 'node:net';
import { dirname, resolve } from 'node:path';
import { adminCredentials, field, NO_CHAOS } from '../../../story-runs/support/api';
import { RESULTS_ROOT } from '../../../story-runs/support/evidence';
import { TENANT_A } from '../../../story-runs/support/prepare';
import { sleep } from '../../support/checks';
import { notExecutable, type Outcome } from '../../core/framework';
import { bodyOf, raw, sameChaos, type Raw, type RawOptions } from './common';

// INSTANCIAS AUXILIARES arrancadas por el manejador (la pila principal no se toca). Una fila que necesita otra configuración de la API
// (APP_ENV, DOCS_BASIC_AUTH) arranca su propia instancia del mismo dist, contra la misma base aislada, en un puerto libre; y las filas
// de la web (007 E6) arrancan además `vite preview` del build de la web apuntando a esa instancia. Todo se mata en `finally`, con un
// respaldo al salir del proceso y un registro (git-ignorado) que limpia lo que quedara si el trabajo de Playwright muere a mitad.
//
// Lo que no se puede hacer aquí: cambiar la configuración de la pila principal, ni la de un build ya compilado (p. ej. EXPO_PUBLIC_API_URL
// de la app móvil, fijada en el bundle). Si una instancia no arranca o no responde con la configuración pedida, la fila es
// `notExecutable` con el motivo: nunca un veredicto sobre la app.

/** Raíz del repositorio: docs/story-runs está dentro de ella (RESULTS_ROOT = <repo>/docs/story-runs). */
const REPO = resolve(RESULTS_ROOT, '..', '..');
const API_CWD = resolve(REPO, 'apps', 'api');
const API_MAIN = resolve(API_CWD, 'dist', 'main.js');
const WEB_CWD = resolve(REPO, 'apps', 'web');
const VITE_BIN = resolve(WEB_CWD, 'node_modules', 'vite', 'bin', 'vite.js');
const WEB_INDEX = resolve(WEB_CWD, 'dist', 'index.html');
/** Registro de procesos auxiliares vivos (docs/story-runs es git-ignorado). */
const REGISTRY = resolve(RESULTS_ROOT, 'entorno', 'trabajo', 'aux-procesos.json');

/** Puertos que nunca se dan a una instancia auxiliar: la pila principal (API, web, Expo) y las bases de datos. */
const RESERVED_PORTS: ReadonlySet<number> = new Set([3000, 5173, 5432, 5433, 8081]);
const DATABASE_PORT = '5433';
const READY_MS = 40_000;

/** Variables que la evidencia puede mostrar sin secretos (las de docs/story-runs/entorno/env.sh). */
const PUBLIC_VARIABLES: Readonly<Record<string, string>> = {
  PLANTED_BUGS: 'false',
  SEED_ON_BOOT: 'false',
  SEED_STUDENT_TENANTS: '25',
  SIMULATOR_MS: '0',
  APP_ENV: 'dev',
  CORS_ORIGIN: 'http://localhost:5173,http://localhost:8081',
};

/** Variables de docs/story-runs/entorno/env.sh copiadas como constantes. DOCS_BASIC_AUTH no está aquí: env.sh no la define. */
const STACK_ENV: Readonly<Record<string, string>> = {
  ...PUBLIC_VARIABLES,
  DATABASE_URL: 'postgresql://sigpro:sigpro@localhost:5433/sigpro?schema=public',
  JWT_SECRET: 'dev-only-change-me',
  ADMIN_KEY: 'dev-admin-key',
};

export interface AuxSpec {
  readonly label: string;
  /** Lo que la fila fija en la instancia auxiliar (APP_ENV, DOCS_BASIC_AUTH); el resto es el de env.sh. */
  readonly env: Readonly<Record<string, string>>;
  /** Lo que la historia espera: es el texto de `notExecutable` si la instancia no arranca. */
  readonly expected: string;
}

/** Cliente ligado a UNA instancia auxiliar: una fila no puede llegar a la principal por error desde aquí. */
export interface AuxClient {
  readonly origin: string;
  readonly port: number;
  readonly http: (method: string, route: string, options?: Omit<RawOptions, 'origin'>) => Promise<Raw>;
}

export interface AuxWeb {
  readonly origin: string;
  readonly port: number;
}

export interface AuxStack {
  readonly api: AuxClient;
  readonly web: AuxWeb;
  /** `APP_ENV` que la API auxiliar reportó en su `GET /api/config` (evidencia). */
  readonly envReportada: string;
}

interface Started {
  readonly api: AuxClient;
  readonly envReportada: string;
  readonly web?: AuxWeb;
}

interface Managed {
  readonly child: ChildProcess;
  readonly label: string;
  readonly tail: () => string;
}

const live = new Set<Managed>();

const scrub = (text: string): string => text.replace(/postgresql:\/\/[^@\s]*@/g, 'postgresql://***@');

const portOf = (server: Server): number => {
  const address = server.address();
  return typeof address === 'object' && address !== null ? address.port : 0;
};

/** Dos puertos medidos con los dos sockets abiertos a la vez: así no pueden coincidir. */
const pickTwoPorts = (): Promise<readonly [number, number]> =>
  new Promise((done, fail) => {
    const first = createServer();
    const second = createServer();
    first.once('error', fail);
    second.once('error', fail);
    first.listen(0, 'localhost', () => {
      second.listen(0, 'localhost', () => {
        const ports = [portOf(first), portOf(second)] as const;
        first.close(() => second.close(() => done(ports)));
      });
    });
  });

const freePorts = async (): Promise<readonly [number, number]> => {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const ports = await pickTwoPorts();
    if (ports[0] !== ports[1] && ports.every((port) => !RESERVED_PORTS.has(port))) return ports;
  }
  throw new Error('no se consiguieron dos puertos libres fuera de los reservados');
};

const writeRegistry = (): void => {
  mkdirSync(dirname(REGISTRY), { recursive: true });
  const entries = [...live].flatMap((managed) => (managed.child.pid === undefined ? [] : [{ pid: managed.child.pid, label: managed.label }]));
  writeFileSync(REGISTRY, JSON.stringify(entries, null, 2));
};

/** Mata el árbol del proceso (en Windows, `taskkill /T /F`). Un proceso ya terminado no es un error. */
const killTree = (pid: number): void => {
  try {
    if (process.platform === 'win32') execFileSync('taskkill', ['/pid', String(pid), '/T', '/F'], { stdio: 'ignore', windowsHide: true });
    else process.kill(pid, 'SIGKILL');
  } catch {
    // ya terminado o sin permiso: no hay nada más que hacer
  }
};

const stopManaged = (managed: Managed): void => {
  live.delete(managed);
  if (managed.child.pid !== undefined) killTree(managed.child.pid);
  writeRegistry();
};

// Respaldo sincrónico: si el proceso termina con instancias vivas, se matan antes de salir.
process.once('exit', () => {
  for (const managed of [...live]) {
    if (managed.child.pid !== undefined) killTree(managed.child.pid);
  }
});

/** Antes de arrancar una instancia: mata lo que quedara registrado de una ejecución que murió a mitad y vacía el registro. */
const sweepLeftovers = (): void => {
  if (!existsSync(REGISTRY)) return;
  try {
    const entries = JSON.parse(readFileSync(REGISTRY, 'utf8')) as readonly { readonly pid: number }[];
    for (const entry of entries) killTree(entry.pid);
  } catch {
    // registro ilegible: se descarta
  }
  writeFileSync(REGISTRY, '[]');
};

/** Entorno del hijo: el del proceso sin DOCS_BASIC_AUTH ni NODE_OPTIONS (flags del cargador de Playwright), más lo que la fila fija. */
const childEnv = (extra: Readonly<Record<string, string>>): NodeJS.ProcessEnv => {
  const env: NodeJS.ProcessEnv = { ...process.env };
  delete env.DOCS_BASIC_AUTH;
  delete env.NODE_OPTIONS;
  return { ...env, ...extra };
};

const spawnManaged = (label: string, script: string, args: readonly string[], cwd: string, env: NodeJS.ProcessEnv): Managed => {
  const child = spawn(process.execPath, [script, ...args], { cwd, env, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
  let output = '';
  const keep = (chunk: Buffer): void => {
    output = `${output}${chunk.toString('utf8')}`.slice(-2000);
  };
  child.stdout?.on('data', keep);
  child.stderr?.on('data', keep);
  child.on('error', (error: Error) => {
    output = `${output}\n${error.message}`;
  });
  const managed: Managed = { child, label, tail: () => scrub(output).trim().slice(-400) };
  live.add(managed);
  writeRegistry();
  return managed;
};

const exited = (managed: Managed): boolean => managed.child.exitCode !== null || managed.child.signalCode !== null;

/** Espera con techo a que `attempt` dé por bueno el arranque; devuelve el motivo si el proceso muere o no responde a tiempo. */
const pollUntil = async (managed: Managed, what: string, attempt: () => Promise<boolean>): Promise<string | undefined> => {
  const deadline = Date.now() + READY_MS;
  while (Date.now() < deadline) {
    if (exited(managed)) return `${what} terminó antes de estar lista (código ${String(managed.child.exitCode)}): ${managed.tail()}`;
    if (await attempt()) return undefined;
    await sleep(500);
  }
  return `${what} no respondió en ${READY_MS / 1000} s: ${managed.tail()}`;
};

const clientOf = (origin: string, port: number): AuxClient => ({
  origin,
  port,
  http: (method, route, options = {}) => raw(method, route, { ...options, origin }),
});

const launchedEnv = (spec: AuxSpec): string => spec.env.APP_ENV ?? STACK_ENV.APP_ENV;

/** Arranca la API (y, si `withWeb`, la web apuntando a ella) y comprueba que responden con la configuración pedida. */
const startStack = async (spec: AuxSpec, withWeb: boolean, processes: Managed[]): Promise<Started | { readonly motivo: string }> => {
  const databasePort = new URL(STACK_ENV.DATABASE_URL).port;
  if (databasePort !== DATABASE_PORT) return { motivo: `DATABASE_URL apunta al puerto ${databasePort || '(ninguno)'}, no al ${DATABASE_PORT}: no se arranca` };
  if (!existsSync(API_MAIN)) return { motivo: 'no existe apps/api/dist/main.js (hace falta el build de la API)' };
  if (withWeb && (!existsSync(VITE_BIN) || !existsSync(WEB_INDEX))) return { motivo: 'falta el build de la web (apps/web/dist) o el binario de vite' };
  sweepLeftovers();
  const [apiPort, webPort] = await freePorts();

  const api = spawnManaged(`API ${spec.label}`, API_MAIN, [], API_CWD, childEnv({ ...STACK_ENV, ...spec.env, PORT: String(apiPort) }));
  processes.push(api);
  const client = clientOf(`http://localhost:${apiPort}`, apiPort);
  // Lo que responde la instancia se guarda en un objeto (no en variables `let` asignadas dentro de la espera: TS las estrecharía mal)
  const observed: { env: string; planted: unknown } = { env: '', planted: undefined };
  const apiMotivo = await pollUntil(api, 'la API auxiliar', async () => {
    const res = await client.http('GET', '/api/config', { headers: { 'x-tenant': TENANT_A } }).catch(() => undefined);
    if (res?.status !== 200) return false;
    observed.env = String(field(res.body, 'env'));
    observed.planted = field(res.body, 'plantedBugs');
    return true;
  });
  if (apiMotivo !== undefined) return { motivo: apiMotivo };
  if (observed.planted !== false) return { motivo: `la instancia auxiliar responde con plantedBugs ${String(observed.planted)}: no se ejecuta con los defectos activos` };
  if (observed.env !== launchedEnv(spec)) return { motivo: `la instancia auxiliar reporta APP_ENV ${observed.env}, no ${launchedEnv(spec)}` };
  if (!withWeb) return { api: client, envReportada: observed.env };

  const webOrigin = `http://localhost:${webPort}`;
  const web = spawnManaged(
    `WEB ${spec.label}`,
    VITE_BIN,
    ['preview'],
    WEB_CWD,
    childEnv({ WEB_PORT: String(webPort), API_PROXY_TARGET: client.origin }),
  );
  processes.push(web);
  const webClient = clientOf(webOrigin, webPort);
  const webObserved: { env: string } = { env: '' };
  const webMotivo = await pollUntil(web, 'la web auxiliar', async () => {
    const login = await webClient.http('GET', '/login').catch(() => undefined);
    if (login?.status !== 200) return false;
    // Cableado: la web auxiliar debe llegar a la API auxiliar (y no a otra). Sin esto, un proxy roto parecería producción.
    const config = await webClient.http('GET', '/api/config', { headers: { 'x-tenant': TENANT_A } }).catch(() => undefined);
    if (config?.status !== 200) return false;
    webObserved.env = String(field(config.body, 'env'));
    return true;
  });
  if (webMotivo !== undefined) return { motivo: webMotivo };
  if (webObserved.env !== launchedEnv(spec)) {
    return { motivo: `el cableado de la web auxiliar no llega a la API auxiliar: /api/config a través de la web responde env ${webObserved.env}, no ${launchedEnv(spec)}` };
  }
  return { api: client, envReportada: observed.env, web: { origin: webOrigin, port: webPort } };
};

const describeEnv = (env: Readonly<Record<string, string>>): string =>
  Object.entries(env)
    .map(([key, value]) => `${key}=${value}`)
    .join(', ');

const apiNote = (spec: AuxSpec): string =>
  `La fila se ejecutó contra una segunda instancia de la API arrancada por el manejador (mismo dist y misma base aislada) con ${describeEnv(spec.env)}; la pila principal no se modificó.`;

const stackNote = (spec: AuxSpec): string =>
  `Pila auxiliar: web y API arrancadas por el manejador con ${describeEnv(spec.env)}; la principal no se modificó.`;

/** Añade a la fila la nota de la instancia y la evidencia de lo que se arrancó (puertos, variables y `APP_ENV` reportado). */
const decorated = (result: Outcome, spec: AuxSpec, started: Started): Outcome => {
  const notes = [result.note, started.web === undefined ? apiNote(spec) : stackNote(spec)].filter((part): part is string => part !== undefined);
  return {
    ...result,
    note: notes.join(' '),
    evidence: {
      ...result.evidence,
      instanciaAuxiliar: { puerto: started.api.port, variables: { ...PUBLIC_VARIABLES, ...spec.env }, envReportada: started.envReportada },
      ...(started.web === undefined ? {} : { webAuxiliar: { puerto: started.web.port } }),
    },
  };
};

/** Fila contra una segunda instancia de la API. Si no arranca, `notExecutable` con el motivo. Siempre mata lo arrancado al terminar. */
export const withAuxApi = async (spec: AuxSpec, run: (api: AuxClient) => Promise<Outcome>): Promise<Outcome> => {
  const processes: Managed[] = [];
  try {
    const started = await startStack(spec, false, processes);
    if ('motivo' in started) return notExecutable(spec.expected, `no arrancó la segunda instancia de la API (${spec.label}): ${started.motivo}`);
    return decorated(await run(started.api), spec, started);
  } finally {
    for (const managed of processes) stopManaged(managed);
  }
};

/** Fila contra una pila auxiliar: API y web (`vite preview` del build) apuntando a esa API. Mismo criterio que `withAuxApi`. */
export const withAuxStack = async (spec: AuxSpec, run: (stack: AuxStack) => Promise<Outcome>): Promise<Outcome> => {
  const processes: Managed[] = [];
  try {
    const started = await startStack(spec, true, processes);
    if ('motivo' in started) return notExecutable(spec.expected, `no arrancó la pila auxiliar (${spec.label}): ${started.motivo}`);
    if (started.web === undefined) return notExecutable(spec.expected, `no arrancó la web auxiliar (${spec.label})`);
    const stack: AuxStack = { api: started.api, web: started.web, envReportada: started.envReportada };
    return decorated(await run(stack), spec, started);
  } finally {
    for (const managed of processes) stopManaged(managed);
  }
};

/**
 * Prepara alumno01 en la instancia auxiliar, con SU cliente: inicio de sesión del administrador, reinicio y caos apagado. Devuelve
 * el motivo si no se consigue (la fila es entonces una preparación fallida, no un `notExecutable`).
 */
export const prepareAux = async (aux: AuxClient): Promise<string | undefined> => {
  const credentials = adminCredentials(TENANT_A);
  const login = await aux.http('POST', '/api/auth/login', {
    headers: { 'x-tenant': TENANT_A },
    body: { email: credentials.email, password: credentials.password, remember: false },
  });
  const token = field(login.body, 'accessToken');
  if (typeof token !== 'string') return `inicio de sesión de ${credentials.email} en la instancia auxiliar: respuesta ${login.status}`;
  const auth = { authorization: `Bearer ${token}` };
  const reset = await aux.http('POST', '/api/admin/reset', { headers: auth });
  if (reset.status !== 200) return `reinicio de ${TENANT_A} en la instancia auxiliar: respuesta ${reset.status}`;
  const config = await aux.http('GET', '/api/config', { headers: { 'x-tenant': TENANT_A } });
  if (sameChaos(bodyOf(config).chaos, NO_CHAOS)) return undefined;
  const off = await aux.http('PATCH', '/api/admin/chaos', { headers: auth, body: NO_CHAOS });
  return off.status === 200 ? undefined : `apagado del caos de ${TENANT_A} en la instancia auxiliar: respuesta ${off.status}`;
};
