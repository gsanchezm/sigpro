import { defineConfig, devices } from '@playwright/test';

const CI = Boolean(process.env.CI);
const WEB_URL = process.env.E2E_WEB_URL ?? 'http://localhost:5173';
const API_URL = process.env.E2E_API_URL ?? 'http://localhost:3000/api';
// Segunda API con basic auth en /api/docs (support/start-docs-api.mjs); el spec api-docs la usa
const DOCS_URL = process.env.E2E_DOCS_URL ?? 'http://localhost:3100/api';

// Un solo corte de diseño: < 1024 px es responsive (móvil y tablet), ≥ 1024 px escritorio. Las descripciones de dispositivo
// de Playwright traen WebKit por defecto; aquí se emulan con Chromium (viewport, agente, táctil y densidad) porque es el
// único navegador que instala el CI: lo que se prueba es el DISEÑO, no el motor.
const emulate = (device: string) => ({ ...devices[device], defaultBrowserType: 'chromium' as const });

export default defineConfig({
  testDir: './tests',
  // Los specs comparten la base: se ejecutan en serie y cada archivo usa su propio tenant
  fullyParallel: false,
  // En serie: los specs comparten tenants entre archivos (las capturas, p. ej., resetean alumno13 y alumno14). Solo la suite
  // responsive, que no escribe datos compartidos, pide 2 workers (`pnpm e2e:responsive`; ver docs/DECISIONS.md).
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
      name: 'desktop',
      // La app móvil tiene su propia configuración (playwright.mobile.config.ts)
      testIgnore: ['**/screens*.spec.ts', '**/mobile/**'],
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
    },
    // Diseño responsive de la web: tablet (iPad, 810 px) y móvil (iPhone 14, 390 px). Solo corren los specs de tests/responsive
    { name: 'tablet', testMatch: '**/responsive/**/*.spec.ts', use: emulate('iPad (gen 7)') },
    { name: 'mobile', testMatch: '**/responsive/**/*.spec.ts', use: emulate('iPhone 14') },
    // Capturas en claro/oscuro a 1440 y 390 px → docs/screens/
    { name: 'screens', testMatch: '**/screens*.spec.ts', use: { ...devices['Desktop Chrome'] } },
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
