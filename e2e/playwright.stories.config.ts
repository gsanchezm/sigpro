import { defineConfig, devices } from '@playwright/test';

// Ejecución de los ejemplos de las historias de usuario (docs/user-stories/) contra una pila local AISLADA.
//
// A propósito NO hay `webServer` ni `globalSetup`: la pila (PostgreSQL propio, API con PLANTED_BUGS=false, web y Expo web)
// la levanta quien ejecuta, y el spec de `gate/` se niega a seguir si la pila no es la esperada. Así ningún reinicio global
// ni ningún arranque automático toca otra base de datos. Ver docs/user-stories/README.md («Cómo se ejecutan los ejemplos»).
//
// Proyectos: `api` (sin navegador), `web` (escritorio 1440 px) y `mobile` (Expo web a 390 px; NO es nativo).

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
    { name: 'api', testMatch: ['**/gate/**/*.spec.ts', '**/api/**/*.spec.ts'] },
    { name: 'web', testMatch: '**/web/**/*.spec.ts', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 }, baseURL: WEB_URL } },
    { name: 'mobile', testMatch: '**/mobile/**/*.spec.ts', use: { ...devices['Desktop Chrome'], ...phone, baseURL: MOBILE_URL } },
  ],
});
