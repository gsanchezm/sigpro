import type { TestInfo } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { createConnection } from 'node:net';
import { join, resolve } from 'node:path';
import { API_URL } from './api';
import { RESULTS_ROOT } from './evidence';

// PROCEDENCIA DE LA EJECUCIÓN. Qué ajustes tuvo (los EFECTIVOS, con las opciones de la línea de comandos ya aplicadas), en qué
// entorno corrió (medido en ese momento, no una foto hecha a mano) y contra qué builds. El commit del ARNÉS y el de las HISTORIAS
// son una cosa; la procedencia de los builds (`dist`) es otra: ningún `dist` guarda de qué commit salió, así que aquí solo se
// registra su HUELLA y su fecha y se comprueba que lo que sirven los puertos es lo que hay en disco, y nunca se afirma que
// correspondan a un commit.

const REPO_ROOT = resolve(RESULTS_ROOT, '..', '..');

/** Ajustes de ejecución de los que depende el aislamiento entre filas. */
export interface RunSettings {
  readonly workers: number;
  readonly retries: number;
  readonly repeatEach: number;
  readonly fullyParallel: boolean;
  readonly shard: string | null;
}

/** Los únicos ajustes admitidos: en serie, un worker, sin reintentos ni repeticiones ni fragmentos. */
export const REQUIRED_SETTINGS: RunSettings = { workers: 1, retries: 0, repeatEach: 1, fullyParallel: false, shard: null };

/**
 * Ajustes efectivos de la ejecución en curso: lo que Playwright aplica de verdad (`--workers`, `--retries`…). `--repeat-each` no
 * llega a `project.repeatEach` dentro del worker: el índice de repetición de esta prueba sí lo delata (en la repetición 0 vale 1).
 */
export const effectiveSettings = (info: TestInfo): RunSettings => ({
  workers: info.config.workers,
  retries: info.project.retries,
  repeatEach: Math.max(info.project.repeatEach, info.repeatEachIndex + 1),
  fullyParallel: info.config.fullyParallel,
  shard: info.config.shard ? `${info.config.shard.current}/${info.config.shard.total}` : null,
});

/** Diferencias con los ajustes admitidos (vacío si son los correctos). */
export const settingsProblems = (settings: RunSettings): readonly string[] =>
  (Object.keys(REQUIRED_SETTINGS) as ReadonlyArray<keyof RunSettings>)
    .filter((key) => settings[key] !== REQUIRED_SETTINGS[key])
    .map((key) => `${key}=${String(settings[key])} (se exige ${String(REQUIRED_SETTINGS[key])})`);

const probe = (host: string, port: number): Promise<boolean> =>
  new Promise((done) => {
    const socket = createConnection({ host, port, timeout: 1500 });
    socket.once('connect', () => {
      socket.destroy();
      done(true);
    });
    socket.once('error', () => done(false));
    socket.once('timeout', () => {
      socket.destroy();
      done(false);
    });
  });

/** ¿Hay algo escuchando en el puerto? Se prueban IPv4 e IPv6 (Docker y Vite no escuchan siempre en la misma). */
export const portOpen = async (port: number): Promise<boolean> => (await Promise.all([probe('127.0.0.1', port), probe('::1', port)])).some(Boolean);

const git = (args: readonly string[]): string => {
  try {
    return execFileSync('git', [...args], { encoding: 'utf8', cwd: REPO_ROOT }).trim();
  } catch {
    return '';
  }
};

/** Commit del arnés (HEAD) y si el arnés tenía cambios sin confirmar: el resultado debe poder asociarse a un commit. */
export const harnessCommit = (): string => git(['rev-parse', 'HEAD']);
export const harnessDirty = (): boolean => git(['status', '--porcelain', '--', 'e2e/story-runs', 'e2e/playwright.stories.config.ts']) !== '';

const sha256 = (data: Uint8Array): string => createHash('sha256').update(data).digest('hex');

/** Huella de un directorio de build: nº de archivos, bytes, el archivo más reciente y un sha256 sobre rutas relativas y contenidos. */
export interface BuildFingerprint {
  readonly path: string;
  readonly exists: boolean;
  readonly files: number;
  readonly bytes: number;
  readonly newestMtime: string | null;
  readonly sha256: string | null;
  /** Si no se pudo leer, el motivo (no se confunde con «no existe»). */
  readonly error: string | null;
}

const filesUnder = (dir: string): readonly string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) => (entry.isDirectory() ? filesUnder(join(dir, entry.name)) : [join(dir, entry.name)]));

export const fingerprintBuild = (relativeDir: string): BuildFingerprint => {
  const root = resolve(REPO_ROOT, relativeDir);
  try {
    // Se ordena por la ruta RELATIVA normalizada (con `/`): así la huella no depende del sistema ni de dónde esté el repositorio
    const entries = filesUnder(root)
      .map((file) => ({ file, relative: file.slice(root.length + 1).replaceAll('\\', '/') }))
      .sort((a, b) => (a.relative < b.relative ? -1 : a.relative > b.relative ? 1 : 0));
    const digest = createHash('sha256');
    let bytes = 0;
    let newest = 0;
    for (const { file, relative } of entries) {
      const stat = statSync(file);
      bytes += stat.size;
      newest = Math.max(newest, stat.mtimeMs);
      digest.update(`${relative}\t${sha256(readFileSync(file))}\n`);
    }
    return { path: relativeDir, exists: true, files: entries.length, bytes, newestMtime: entries.length > 0 ? new Date(newest).toISOString() : null, sha256: digest.digest('hex'), error: null };
  } catch (error) {
    const missing = error instanceof Error && 'code' in error && error.code === 'ENOENT';
    return { path: relativeDir, exists: false, files: 0, bytes: 0, newestMtime: null, sha256: null, error: missing ? null : String(error) };
  }
};

/** Los builds en disco que sirven la API, la web y la app móvil, y el paquete compartido que leen los tres. */
export const BUILD_DIRS = { api: 'apps/api/dist', web: 'apps/web/dist', mobile: 'apps/mobile/dist', shared: 'packages/shared/dist' } as const;

/** Puerto de la base de datos de Docker del usuario, que NO debe estar accesible, y puerto de la aislada (PostgreSQL propio). */
export const DOCKER_PG_PORT = 5432;
export const ISOLATED_PG_PORT = Number(process.env.SIGPRO_STORIES_PG_PORT ?? '5433');
const APP_PORTS = [3000, 5173, 8081];

export const WEB_URL = process.env.E2E_WEB_URL ?? 'http://localhost:5173';
export const MOBILE_URL = process.env.E2E_MOBILE_URL ?? 'http://localhost:8081';

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]', '::1']);
const isLocal = (url: string): boolean => {
  try {
    return LOCAL_HOSTS.has(new URL(url).hostname);
  } catch {
    return false;
  }
};

const servedHash = async (url: string): Promise<string | null> => {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(4000) });
    return response.ok ? sha256(Buffer.from(await response.arrayBuffer())) : null;
  } catch {
    return null;
  }
};

const fileHash = (relativePath: string): string | null => {
  try {
    return sha256(readFileSync(resolve(REPO_ROOT, relativePath)));
  } catch {
    return null;
  }
};

/** Lo que sirve un puerto frente al `index.html` del `dist`: `null` = no se pudo comprobar (no hay servidor o no responde). */
export interface ServedPage {
  readonly url: string;
  readonly reachable: boolean;
  readonly matchesDist: boolean | null;
}

export interface ServedCheck {
  readonly urls: { readonly api: string; readonly web: string; readonly mobile: string };
  readonly web: ServedPage;
  readonly mobile: ServedPage;
  /** Cuándo arrancó la API (ahora − `uptime`) y si fue DESPUÉS de construir su `dist` y el del paquete compartido que carga al arrancar. */
  readonly apiStartedAt: string | null;
  readonly apiStartedAfterBuild: boolean | null;
}

const servedPage = async (url: string, distIndex: string): Promise<ServedPage> => {
  const served = await servedHash(url);
  const onDisk = fileHash(distIndex);
  return { url, reachable: served !== null, matchesDist: served === null || onDisk === null ? null : served === onDisk };
};

const newest = (build: BuildFingerprint): number => (build.newestMtime ? Date.parse(build.newestMtime) : Number.NaN);

export interface RuntimeEnvironment {
  readonly capturedAt: string;
  /** Node que ejecuta las pruebas (el de Playwright), NO el de la API. */
  readonly node: string;
  readonly platform: string;
  /** Puerto → ¿accesible en el momento de la puerta? */
  readonly ports: Readonly<Record<string, boolean>>;
  readonly isolatedPgPort: number;
  readonly builds: Readonly<Record<keyof typeof BUILD_DIRS, BuildFingerprint>>;
  readonly served: ServedCheck;
  readonly settings: RunSettings;
}

/** Foto del entorno tomada por la puerta DENTRO de la ejecución (no antes ni a mano). */
export const captureEnvironment = async (info: TestInfo): Promise<RuntimeEnvironment> => {
  const watched = [...new Set([...APP_PORTS, DOCKER_PG_PORT, ISOLATED_PG_PORT])];
  const ports = Object.fromEntries(await Promise.all(watched.map(async (port) => [String(port), await portOpen(port)] as const)));
  const builds = Object.fromEntries(Object.entries(BUILD_DIRS).map(([name, dir]) => [name, fingerprintBuild(dir)])) as RuntimeEnvironment['builds'];
  const health = await fetch(`${API_URL}/health`, { signal: AbortSignal.timeout(4000) }).then((r) => r.json() as Promise<{ uptime?: number }>).catch(() => undefined);
  const apiStartedMs = typeof health?.uptime === 'number' ? Date.now() - health.uptime * 1000 : Number.NaN;
  const lastBuildMs = Math.max(newest(builds.api), newest(builds.shared));
  return {
    capturedAt: new Date().toISOString(),
    node: process.version,
    platform: process.platform,
    ports,
    isolatedPgPort: ISOLATED_PG_PORT,
    builds,
    served: {
      urls: { api: API_URL, web: WEB_URL, mobile: MOBILE_URL },
      web: await servedPage(WEB_URL, `${BUILD_DIRS.web}/index.html`),
      mobile: await servedPage(MOBILE_URL, `${BUILD_DIRS.mobile}/index.html`),
      apiStartedAt: Number.isNaN(apiStartedMs) ? null : new Date(apiStartedMs).toISOString(),
      apiStartedAfterBuild: Number.isNaN(apiStartedMs) || Number.isNaN(lastBuildMs) ? null : apiStartedMs >= lastBuildMs,
    },
    settings: effectiveSettings(info),
  };
};

/** Por qué el entorno no es el aislado esperado (vacío si lo es). */
export const environmentProblems = (environment: RuntimeEnvironment): readonly string[] => [
  ...(environment.ports[String(DOCKER_PG_PORT)] ? [`El puerto ${DOCKER_PG_PORT} (la base de datos de Docker del usuario) está accesible: no se puede demostrar que la API no hable con ella`] : []),
  ...(environment.isolatedPgPort === DOCKER_PG_PORT || APP_PORTS.includes(environment.isolatedPgPort) ? [`El puerto de PostgreSQL aislado (${environment.isolatedPgPort}) no puede ser el de Docker ni el de una aplicación`] : []),
  ...(environment.ports[String(environment.isolatedPgPort)] ? [] : [`El puerto ${environment.isolatedPgPort} (PostgreSQL aislado) no está accesible`]),
  ...Object.entries(environment.served.urls).flatMap(([name, url]) => (isLocal(url) ? [] : [`La URL de ${name} (${url}) no es local: no se ejecuta contra servidores remotos`])),
  ...(environment.served.web.matchesDist === false ? [`Lo que sirve ${environment.served.web.url} no es el index.html de ${BUILD_DIRS.web} (¿servidor de desarrollo u otro build?)`] : []),
  ...(environment.served.mobile.matchesDist === false ? [`Lo que sirve ${environment.served.mobile.url} no es el index.html de ${BUILD_DIRS.mobile} (¿servidor de desarrollo u otro build?)`] : []),
  ...(environment.served.apiStartedAfterBuild === false ? ['La API arrancó ANTES de que se construyera su dist (o el del paquete compartido): no está sirviendo el build que hay en disco'] : []),
  ...Object.values(environment.builds).flatMap((build) => (build.error ? [`No se pudo leer el build ${build.path}: ${build.error}`] : [])),
  ...settingsProblems(environment.settings).map((problem) => `Ajuste de ejecución no admitido: ${problem}`),
];
