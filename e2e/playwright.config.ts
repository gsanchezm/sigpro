import { defineConfig, devices } from '@playwright/test';

const CI = Boolean(process.env.CI);
const WEB_URL = process.env.E2E_WEB_URL ?? 'http://localhost:5173';
const API_URL = process.env.E2E_API_URL ?? 'http://localhost:3000/api';
// Segunda API con basic auth en /api/docs (support/start-docs-api.mjs); el spec api-docs la usa
const DOCS_URL = process.env.E2E_DOCS_URL ?? 'http://localhost:3100/api';

export default defineConfig({
  testDir: './tests',
  // Los specs comparten la base: se ejecutan en serie y cada archivo usa su propio tenant
  fullyParallel: false,
  workers: 1,
  retries: CI ? 1 : 0,
  reporter: CI ? [['list'], ['html', { open: 'never' }]] : [['list']],
  globalSetup: './global-setup.ts',
  use: {
    baseURL: WEB_URL,
    // El service worker de la PWA interferiría con page.route() y con la caché
    serviceWorkers: 'block',
    locale: 'es-ES',
    timezoneId: 'Europe/Madrid',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      testIgnore: ['**/screens.spec.ts', '**/compare.spec.ts'],
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
    },
    // Capturas en claro/oscuro a 1440 y 390 px → docs/screens/
    { name: 'screens', testMatch: '**/screens.spec.ts', use: { ...devices['Desktop Chrome'] } },
    // Comparación visual con los prototipos del handoff (servidos por HTTP)
    { name: 'compare', testMatch: '**/compare.spec.ts', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: [
    {
      command: 'node support/start-docs-api.mjs',
      url: `${DOCS_URL}/health`,
      reuseExistingServer: !CI,
      timeout: 180_000,
      stdout: 'ignore',
    },
    {
      // En local se recompila para no probar un dist obsoleto; en CI el build ya se hizo en un paso previo
      command: CI ? 'pnpm --filter api start' : 'pnpm --filter api build && pnpm --filter api start',
      url: `${API_URL}/health`,
      reuseExistingServer: !CI,
      timeout: 120_000,
      stdout: 'ignore',
    },
    {
      // En CI se sirve el build de producción; en local, el servidor de desarrollo
      command: CI ? 'pnpm --filter web preview' : 'pnpm --filter web dev',
      url: WEB_URL,
      reuseExistingServer: !CI,
      timeout: 120_000,
      stdout: 'ignore',
    },
  ],
});
