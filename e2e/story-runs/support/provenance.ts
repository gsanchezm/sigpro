import type { TestInfo } from '@playwright/test';
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { createConnection } from 'node:net';
import { join, resolve } from 'node:path';
import { RESULTS_ROOT } from './evidence';

// PROCEDENCIA DE LA EJECUCIÓN. Qué ajustes tuvo (los EFECTIVOS, con las opciones de la línea de comandos ya aplicadas), en qué
// entorno corrió (medido en ese momento, no una foto hecha a mano) y qué builds sirvió. El commit del ARNÉS y el de las HISTORIAS
// son una cosa; la procedencia de los builds (`dist`) es otra: ningún `dist` guarda de qué commit salió, así que aquí solo se
// registra su HUELLA y su fecha, y nunca se afirma que correspondan a un commit.

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

/** Ajustes efectivos de la ejecución en curso: lo que Playwright aplica de verdad (`--workers`, `--retries`, `--repeat-each`…). */
export const effectiveSettings = (info: TestInfo): RunSettings => ({
  workers: info.config.workers,
  retries: info.project.retries,
  // `--repeat-each` no llega a `project.repeatEach` dentro del worker: el índice de repetición de esta prueba sí lo delata
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

/** Huella de un directorio de build: nº de archivos, bytes, el archivo más reciente y un sha256 sobre rutas y contenidos. */
export interface BuildFingerprint {
  readonly path: string;
  readonly exists: boolean;
  readonly files: number;
  readonly bytes: number;
  readonly newestMtime: string | null;
  readonly sha256: string | null;
}

const filesUnder = (dir: string): readonly string[] =>
  readdirSync(dir, { withFileTypes: true })
    .flatMap((entry) => (entry.isDirectory() ? filesUnder(join(dir, entry.name)) : [join(dir, entry.name)]))
    .sort();

export const fingerprintBuild = (relativeDir: string): BuildFingerprint => {
  const root = resolve(REPO_ROOT, relativeDir);
  try {
    const files = filesUnder(root);
    const digest = createHash('sha256');
    let bytes = 0;
    let newest = 0;
    for (const file of files) {
      const stat = statSync(file);
      bytes += stat.size;
      newest = Math.max(newest, stat.mtimeMs);
      const relative = file.slice(root.length + 1).replaceAll('\\', '/');
      digest.update(`${relative}\t${createHash('sha256').update(readFileSync(file)).digest('hex')}\n`);
    }
    return { path: relativeDir, exists: true, files: files.length, bytes, newestMtime: files.length > 0 ? new Date(newest).toISOString() : null, sha256: digest.digest('hex') };
  } catch {
    return { path: relativeDir, exists: false, files: 0, bytes: 0, newestMtime: null, sha256: null };
  }
};

/** Los builds que se sirven en la ejecución: la API, la web, la app móvil y el paquete compartido que leen las tres. */
export const BUILD_DIRS = { api: 'apps/api/dist', web: 'apps/web/dist', mobile: 'apps/mobile/dist', shared: 'packages/shared/dist' } as const;

/** Puerto de la base de datos aislada (PostgreSQL propio) y puerto de la base de Docker del usuario, que NO debe estar accesible. */
export const ISOLATED_PG_PORT = Number(process.env.SIGPRO_STORIES_PG_PORT ?? '5433');
export const DOCKER_PG_PORT = 5432;

export interface RuntimeEnvironment {
  readonly capturedAt: string;
  readonly node: string;
  readonly platform: string;
  /** Puerto → ¿accesible en el momento de la puerta? */
  readonly ports: Readonly<Record<string, boolean>>;
  readonly builds: Readonly<Record<keyof typeof BUILD_DIRS, BuildFingerprint>>;
  readonly settings: RunSettings;
}

/** Foto del entorno tomada por la puerta DENTRO de la ejecución (no antes ni a mano). */
export const captureEnvironment = async (info: TestInfo): Promise<RuntimeEnvironment> => {
  const watched = [3000, 5173, DOCKER_PG_PORT, ISOLATED_PG_PORT, 8081];
  const ports = Object.fromEntries(await Promise.all(watched.map(async (port) => [String(port), await portOpen(port)] as const)));
  return {
    capturedAt: new Date().toISOString(),
    node: process.version,
    platform: process.platform,
    ports,
    builds: Object.fromEntries(Object.entries(BUILD_DIRS).map(([name, dir]) => [name, fingerprintBuild(dir)])) as RuntimeEnvironment['builds'],
    settings: effectiveSettings(info),
  };
};

/** Por qué el entorno no es el aislado esperado (vacío si lo es). */
export const environmentProblems = (environment: RuntimeEnvironment): readonly string[] => [
  ...(environment.ports[String(DOCKER_PG_PORT)] ? [`El puerto ${DOCKER_PG_PORT} (la base de datos de Docker del usuario) está accesible: no se puede demostrar que la API no hable con ella`] : []),
  ...(environment.ports[String(ISOLATED_PG_PORT)] ? [] : [`El puerto ${ISOLATED_PG_PORT} (PostgreSQL aislado) no está accesible`]),
  ...settingsProblems(environment.settings).map((problem) => `Ajuste de ejecución no admitido: ${problem}`),
];
