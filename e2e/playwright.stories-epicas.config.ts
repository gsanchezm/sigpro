import { defineConfig, devices } from '@playwright/test';

// Ejecución de los ejemplos de las historias de usuario (docs/user-stories/) contra una pila local AISLADA.
//
// A propósito NO hay `webServer` ni `globalSetup`: la pila (PostgreSQL propio, API con PLANTED_BUGS=false, web y Expo web)
// la levanta quien ejecuta, y el spec de `gate/` se niega a seguir si la pila no es la esperada. Así ningún reinicio global
// ni ningún arranque automático toca otra base de datos. Pasos para levantarla y repetir la ejecución: docs/story-runs/LEEME.md y docs/story-runs/epicas/LEEME.md
// (carpeta local del instructor, fuera de git).
//
// Proyectos: `api` (sin navegador), `web` (escritorio 1440 px) y `mobile` (Expo web a 390 px; NO es nativo).

// Esta suite NO admite, y se niega a cargar con ellos:
//  - el modo UI, el modo vigilancia (`PWTEST_WATCH`), el servidor de pruebas y el servidor MCP (lo que usa, p. ej., la extensión de
//    VS Code): se saltan la puerta de aislamiento y cargan este archivo en un proceso que dura toda la sesión, así que mezclarían
//    resultados de estados distintos de la pila;
//  - `--workers`/`-j`, `--retries`, `--repeat-each`, `--fully-parallel` y `--shard`: el aislamiento entre filas depende de la
//    ejecución en serie (un worker, sin reintentos ni repeticiones ni fragmentos);
//  - `--no-deps`: quita la puerta de aislamiento.
// Es la defensa de la línea de comandos. Como segunda defensa, la puerta y cada historia leen los valores EFECTIVOS y se niegan a
// ejecutar si no son los de la serie (por ejemplo, si alguien edita este archivo), y el informe lo vuelve a comprobar.
const REJECTED_FLAGS = ['--ui', '--ui-host', '--ui-port', 'test-server', 'run-test-mcp-server', '--workers', '--retries', '--repeat-each', '--fully-parallel', '--shard', '--no-deps'];
const rejected = process.argv.filter((arg) => REJECTED_FLAGS.some((flag) => arg === flag || arg.startsWith(`${flag}=`)) || /^-j\d*$/.test(arg));
if (process.env.PWTEST_WATCH) rejected.push('PWTEST_WATCH');
if (rejected.length > 0) {
  throw new Error(`Esta suite no admite ${rejected.join(', ')}: usa «npx playwright test -c playwright.stories-epicas.config.ts --project=<api|web|mobile>» desde la línea de comandos, sin opciones de paralelismo, repetición ni UI (ver docs/story-runs/LEEME.md y docs/story-runs/epicas/LEEME.md).`);
}

// Una ejecución completa = un identificador propio: el config se carga en el proceso principal Y en cada worker (que Playwright
// reinicia tras un fallo), así que los workers deben conservar el del principal, y los resultados guardados fila a fila se
// distinguen de los de otra ejecución. El identificador lleva el PID del proceso principal: uno exportado de antemano por
// alguien no lo lleva (ni el del padre de un worker) y se sustituye por uno nuevo, así no se puede reutilizar un `runId`.
const ownedRunId = (id: string | undefined): boolean => id !== undefined && (id.endsWith(`_${process.pid}`) || id.endsWith(`_${process.ppid}`));
if (!ownedRunId(process.env.SIGPRO_STORIES_RUN_ID)) process.env.SIGPRO_STORIES_RUN_ID = `${new Date().toISOString()}_${process.pid}`;

const WEB_URL = process.env.E2E_WEB_URL ?? 'http://localhost:5173';
const MOBILE_URL = process.env.E2E_MOBILE_URL ?? 'http://localhost:8081';
const phone = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true };

export default defineConfig({
  testDir: './story-runs-epicas',
  // En serie y con un solo worker: las filas comparten la base y cada una reinicia su tenant
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 120_000,
  reporter: [['list']],
  outputDir: './test-results-stories-epicas',
  use: {
    locale: 'es-ES',
    timezoneId: 'Europe/Madrid',
    // El service worker de la PWA interferiría con la sesión y la caché
    serviceWorkers: 'block',
    trace: 'off',
    screenshot: 'off',
  },
  projects: [
    // La puerta de aislamiento es un proyecto aparte y los demás DEPENDEN de él: si no pasa, no se ejecuta ninguna fila
    { name: 'gate', testMatch: '**/gate/**/*.spec.ts' },
    { name: 'api', testMatch: '**/api/**/*.spec.ts', dependencies: ['gate'] },
    { name: 'web', testMatch: '**/web/**/*.spec.ts', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 }, baseURL: WEB_URL }, dependencies: ['gate'] },
    { name: 'mobile', testMatch: '**/mobile/**/*.spec.ts', use: { ...devices['Desktop Chrome'], ...phone, baseURL: MOBILE_URL }, dependencies: ['gate'] },
  ],
});
