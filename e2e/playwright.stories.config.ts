import { defineConfig, devices } from '@playwright/test';

// Ejecución de los ejemplos de las historias de usuario (docs/user-stories/) contra una pila local AISLADA.
//
// A propósito NO hay `webServer` ni `globalSetup`: la pila (PostgreSQL propio, API con PLANTED_BUGS=false, web y Expo web)
// la levanta quien ejecuta, y el spec de `gate/` se niega a seguir si la pila no es la esperada. Así ningún reinicio global
// ni ningún arranque automático toca otra base de datos. Pasos para levantarla y repetir la ejecución: docs/story-runs/LEEME.md
// (carpeta local del instructor, fuera de git).
//
// Proyectos: `api` (sin navegador), `web` (escritorio 1440 px) y `mobile` (Expo web a 390 px; NO es nativo).

// Una ejecución completa = un identificador: el config se carga en el proceso principal y los workers (que Playwright
// reinicia tras un fallo) lo heredan, así los resultados guardados fila a fila se distinguen de los de otra ejecución.
process.env.SIGPRO_STORIES_RUN_ID ??= new Date().toISOString();

const WEB_URL = process.env.E2E_WEB_URL ?? 'http://localhost:5173';
const MOBILE_URL = process.env.E2E_MOBILE_URL ?? 'http://localhost:8081';
const phone = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true };

export default defineConfig({
  testDir: './story-runs',
  // En serie y con un solo worker: las filas comparten la base y cada una reinicia su tenant
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 120_000,
  reporter: [['list']],
  outputDir: './test-results-stories',
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
