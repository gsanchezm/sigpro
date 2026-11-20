import { execFileSync, spawn, type ChildProcess } from 'node:child_process';
import { closeSync, existsSync, mkdirSync, openSync } from 'node:fs';
import { createServer } from 'node:net';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { adminCredentials, field, type ApiResult } from '../../../story-runs/support/api';
import { DEMO, TENANT_A, type Credentials } from '../../../story-runs/support/prepare';
import { sleep } from '../../support/checks';
import { notExecutable, type Outcome } from '../../core/framework';

// SEGUNDA INSTANCIA DE LA API, arrancada por el propio manejador de una fila, para las filas que necesitan otro valor de configuración
// (SIMULATOR_MS 4000) que la pila principal no tiene. Usa el mismo `apps/api/dist/main.js` y la misma base aislada (puerto 5433), en un
// puerto libre elegido al azar. La pila principal no se toca. Toda la comunicación de la fila va contra la URL de esta instancia.
// Nunca debe quedar viva: se mata el árbol de procesos en `finally` (y en `exit` como respaldo), tenga éxito o no la fila.

/** Raíz del repositorio: este fichero está en `e2e/story-runs-epicas/mision-feed/api`, cuatro niveles por debajo. */
const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');

/** Configuración de `docs/story-runs/entorno/env.sh` copiada como constantes. SEED_ON_BOOT va a false: la instancia auxiliar no vuelve a
 * sembrar la base compartida con la pila principal (env.sh tiene true, que solo vale para la pila principal). */
export const AUX_ENV: Readonly<Record<string, string>> = {
  DATABASE_URL: 'postgresql://sigpro:sigpro@localhost:5433/sigpro?schema=public',
  PLANTED_BUGS: 'false',
  SEED_ON_BOOT: 'false',
  SEED_STUDENT_TENANTS: '25',
  SIMULATOR_MS: '0',
  APP_ENV: 'dev',
  JWT_SECRET: 'dev-only-change-me',
  ADMIN_KEY: 'dev-admin-key',
  CORS_ORIGIN: 'http://localhost:5173,http://localhost:8081',
};

/** Puerto de la base aislada: la instancia auxiliar se niega a arrancar contra cualquier otra. */
const BASE_AISLADA_PUERTO = '5433';
/** Plazo para que la instancia auxiliar responda a GET /api/config. */
const READY_MS = 40_000;
const POLL_MS = 500;

/** Nota que lleva toda fila ejecutada contra la instancia auxiliar. */
const AUX_NOTE = (simulatorMs: number): string =>
  `La fila se ejecutó contra una segunda instancia de la API arrancada por el manejador (mismo dist y misma base aislada) con SIMULATOR_MS=${simulatorMs}; la pila principal no se modificó.`;

/** Instancias vivas (para matarlas al salir del proceso si algo falla sin pasar por `finally`). */
const live = new Set<ChildProcess>();
process.once('exit', () => {
  for (const child of live) killTree(child);
});

/** Mata el proceso y su árbol. Los errores se ignoran: el proceso puede haber terminado ya. */
const killTree = (child: ChildProcess): void => {
  if (process.platform === 'win32' && child.pid !== undefined) {
    try {
      execFileSync('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore', windowsHide: true });
    } catch {
      // ya terminado
    }
  }
  if (child.exitCode === null && child.signalCode === null) {
    try {
      child.kill('SIGKILL');
    } catch {
      // ya terminado
    }
  }
};

/** Puerto libre en 127.0.0.1 (lo reserva un servidor efímero y lo suelta). */
const freePort = (): Promise<number> =>
  new Promise((resolvePort, reject) => {
    const server = createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      const port = typeof address === 'object' && address !== null ? address.port : 0;
      server.close(() => resolvePort(port));
    });
  });

/** Puerto de la URL de la base de datos, o `undefined` si la URL no se entiende. */
const databasePort = (url: string): string | undefined => {
  try {
    return new URL(url).port;
  } catch {
    return undefined;
  }
};

/** Una petición a la instancia auxiliar. `base` incluye el prefijo `/api`. Un fallo de conexión lanza (lo capturan quien espera). */
export const callAt = async (
  base: string,
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
  path: string,
  options: { readonly tenant?: string; readonly token?: string; readonly body?: unknown } = {},
): Promise<ApiResult> => {
  const headers: Record<string, string> = {
    ...(options.body === undefined ? {} : { 'content-type': 'application/json' }),
    ...(options.tenant ? { 'x-tenant': options.tenant } : {}),
    ...(options.token ? { authorization: `Bearer ${options.token}` } : {}),
  };
  const started = performance.now();
  const response = await fetch(`${base}${path}`, { method, headers, ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }) });
  const text = await response.text();
  let body: unknown = null;
  if (text.length > 0) {
    try {
      body = JSON.parse(text) as unknown;
    } catch {
      body = text;
    }
  }
  return { status: response.status, body, ms: Math.round(performance.now() - started) };
};

/** Inicio de sesión de una cuenta en la instancia auxiliar: el `accessToken` si el login lo da. */
export const sessionAt = async (base: string, tenant: string, credentials: Credentials): Promise<{ readonly accessToken?: string; readonly result: ApiResult }> => {
  const result = await callAt(base, 'POST', '/auth/login', { tenant, body: { email: credentials.email, password: credentials.password, remember: true } });
  const token = field(result.body, 'accessToken');
  return { accessToken: typeof token === 'string' ? token : undefined, result };
};

/** Reinicio del tenant en la instancia auxiliar, con el token de su administrador (como en la pila principal). */
export const resetAt = async (base: string, tenant: string): Promise<{ readonly login: ApiResult; readonly adminToken?: string; readonly reset?: ApiResult }> => {
  const login = await callAt(base, 'POST', '/auth/login', { tenant, body: { ...adminCredentials(tenant), remember: false } });
  const token = field(login.body, 'accessToken');
  if (typeof token !== 'string') return { login };
  const reset = await callAt(base, 'POST', '/admin/reset', { tenant, token });
  return { login, adminToken: token, reset };
};

/** Resumen de misión en la instancia auxiliar (con el token que se dé). */
export const summaryAt = (base: string, tenant: string, token: string): Promise<ApiResult> => callAt(base, 'GET', '/mission/summary', { tenant, token });

/** Espera a que la instancia auxiliar responda a GET /api/config con PLANTED_BUGS=false. Devuelve el fallo si no llega a estar lista. */
const waitForApi = async (child: ChildProcess, base: string, expected: string, logPath: string, spawnError: () => Error | undefined): Promise<Outcome | undefined> => {
  const started = Date.now();
  while (Date.now() - started < READY_MS) {
    const error = spawnError();
    if (error !== undefined) return notExecutable(expected, `no se pudo lanzar la API auxiliar: ${error.message}`);
    if (child.exitCode !== null) return notExecutable(expected, `la API auxiliar terminó al arrancar (código ${child.exitCode}); registro en ${logPath}`);
    try {
      const config = await callAt(base, 'GET', '/config', { tenant: TENANT_A });
      if (config.status === 200) {
        if (field(config.body, 'plantedBugs') !== false) return notExecutable(expected, 'la API auxiliar arranca con los defectos del curso activos (PLANTED_BUGS distinto de false)');
        return undefined;
      }
    } catch {
      // todavía no escucha
    }
    await sleep(POLL_MS);
  }
  return notExecutable(expected, `la API auxiliar no respondió a GET /api/config en ${READY_MS / 1000} s; registro en ${logPath}`);
};

/** Opciones de la instancia auxiliar: un nombre para el registro, los valores que sobrescriben la configuración común y la fila. */
export interface AuxOptions {
  readonly label: string;
  readonly env: Readonly<Record<string, string>>;
  readonly expected: string;
}

/** Lo que recibe la fila cuando la instancia auxiliar está lista y comprobada. */
export interface AuxApi {
  /** URL base con el prefijo `/api` (p. ej. `http://127.0.0.1:52001/api`). */
  readonly base: string;
  readonly port: number;
  readonly simulatorMs: number;
}

/**
 * Arranca una segunda instancia de la API con `env` sobre la configuración común, comprueba que responde, que PLANTED_BUGS es false y que
 * SIMULATOR_MS es el de `env`, ejecuta la fila (`run`) y mata la instancia SIEMPRE al terminar. Si la instancia no arranca o no es la que
 * la fila necesita, devuelve `notExecutable` (nunca `discrepa`). La evidencia y la nota de la instancia se añaden al resultado de la fila.
 */
export const withAuxApi = async (options: AuxOptions, run: (aux: AuxApi) => Promise<Outcome>): Promise<Outcome> => {
  const { label, expected } = options;
  const env: Record<string, string> = { ...AUX_ENV, ...options.env };
  const want = Number(env.SIMULATOR_MS);
  const dbPort = databasePort(env.DATABASE_URL ?? '');
  if (dbPort !== BASE_AISLADA_PUERTO) {
    return notExecutable(expected, `DATABASE_URL no apunta al puerto ${BASE_AISLADA_PUERTO} (apunta a ${dbPort ?? '(desconocido)'}); no se arranca la instancia auxiliar`);
  }
  const dist = join(REPO_ROOT, 'apps', 'api', 'dist', 'main.js');
  if (!existsSync(dist)) return notExecutable(expected, `no existe ${dist}: hay que compilar la API antes de usar la instancia auxiliar`);

  const port = await freePort();
  const base = `http://127.0.0.1:${port}/api`;
  const logDir = join(REPO_ROOT, 'docs', 'story-runs', 'entorno', 'trabajo');
  mkdirSync(logDir, { recursive: true });
  const logPath = join(logDir, `aux-api-${label}-${port}.log`);
  const logFd = openSync(logPath, 'w');
  let child: ChildProcess | undefined;
  let spawnFailure: Error | undefined;
  try {
    child = spawn(process.execPath, [dist], {
      cwd: join(REPO_ROOT, 'apps', 'api'),
      env: { ...process.env, ...env, PORT: String(port) },
      windowsHide: true,
      stdio: ['ignore', logFd, logFd],
    });
    const started = child;
    live.add(started);
    started.once('error', (error) => {
      spawnFailure = error;
    });

    const notReady = await waitForApi(started, base, expected, logPath, () => spawnFailure);
    if (notReady !== undefined) return notReady;

    // SIMULATOR_MS: se lee del resumen con el token del gestor; debe ser el de la fila, o la fila no es ejecutable
    const session = await sessionAt(base, TENANT_A, DEMO.gestor);
    if (session.accessToken === undefined) return notExecutable(expected, `el gestor no inicia sesión en la instancia auxiliar (${session.result.status})`);
    const summary = await summaryAt(base, TENANT_A, session.accessToken);
    const got = field(summary.body, 'simulatorMs');
    if (got !== want) return notExecutable(expected, `requiere una instancia con SIMULATOR_MS=${want}; la instancia auxiliar usa ${String(got ?? '(sin leer)')}`);

    const outcome = await run({ base, port, simulatorMs: want });
    return {
      ...outcome,
      note: outcome.note === undefined ? AUX_NOTE(want) : `${outcome.note} ${AUX_NOTE(want)}`,
      evidence: { ...(outcome.evidence ?? {}), instanciaAuxiliar: { puerto: port, SIMULATOR_MS: want } },
    };
  } finally {
    if (child !== undefined) {
      killTree(child);
      live.delete(child);
    }
    closeSync(logFd);
  }
};
