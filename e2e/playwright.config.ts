import { defineConfig, devices } from '@playwright/test';

const CI = Boolean(process.env.CI);
const WEB_URL = process.env.E2E_WEB_URL ?? 'http://localhost:5173';
const API_URL = process.env.E2E_API_URL ?? 'http://localhost:3000/api';
// Segunda API con basic auth en /api/docs (support/start-docs-api.mjs); el spec api-docs la usa
const DOCS_URL = process.env.E2E_DOCS_URL ?? 'http://localhost:3100/api';
// Despliegue «endurecido» del curso (tests/hardened): tercera API (support/start-hardened-api.mjs, schema propio de Postgres) y
// un servidor de desarrollo de la web compilado con VITE_LAB_PUBLIC=false. La API (:3000) y la web (:5173) normales no cambian.
const HARDENED_API_URL = process.env.E2E_HARDENED_API_URL ?? 'http://localhost:3200/api';
const HARDENED_WEB_URL = process.env.E2E_HARDENED_WEB_URL ?? 'http://localhost:5199';

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
      testIgnore: ['**/screens*.spec.ts', '**/mobile/**', '**/hardened/**'],
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
    },
    // Despliegue endurecido: solo los specs de tests/hardened, contra la web y la API de la pila endurecida
    { name: 'hardened', testMatch: '**/hardened/**/*.spec.ts', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 }, baseURL: HARDENED_WEB_URL } },
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
    {
      // Despliegue endurecido: la API con las variables de endurecimiento y su propio schema de Postgres (ver el encabezado del script)
      command: 'node support/start-hardened-api.mjs',
      url: `${HARDENED_API_URL}/health`,
      reuseExistingServer: !CI,
      timeout: 180_000,
      stdout: 'ignore',
    },
    {
      // Web «cerrada» (VITE_LAB_PUBLIC=false) en modo desarrollo, apuntando a la API endurecida. Se lanza `vite` directamente y no
      // `pnpm --filter web dev`: así no pasa por zip-examples, que con esta variable borraría el zip que usan los demás specs.
      // VITE_API_URL se fija a `/api` (proxy) para que ninguna variable del entorno pueda apuntar esta web a otra API.
      command: 'pnpm --filter web exec vite',
      url: HARDENED_WEB_URL,
      reuseExistingServer: !CI,
      timeout: 120_000,
      stdout: 'ignore',
      env: { WEB_PORT: new URL(HARDENED_WEB_URL).port, VITE_LAB_PUBLIC: 'false', VITE_NOINDEX: 'true', VITE_API_URL: '/api', API_PROXY_TARGET: new URL(HARDENED_API_URL).origin },
    },
  ],
});
