import { defineConfig, devices } from '@playwright/test';

// Specs de humo y capturas de la app móvil (Expo web a 390 px). Configuración aparte para no tocar la suite web.
//
// Cómo se sirve la app (variable MOBILE_SERVER):
//  - `static` (por defecto): `expo export` (pnpm --filter mobile build) y un servidor estático en :8081. Es lo robusto: no
//    depende de que Metro termine de compilar dentro del tiempo del `webServer`. En CI el build ya lo hizo `pnpm build`.
//  - `expo`: `expo start --web` (pnpm --filter mobile dev) en :8081, el modo de desarrollo. La primera carga compila el
//    bundle y puede tardar; el spec funciona igual.
// Si ya hay algo escuchando en :8081 se reutiliza (reuseExistingServer).

const CI = Boolean(process.env.CI);
const MOBILE_URL = process.env.E2E_MOBILE_URL ?? 'http://localhost:8081';
const API_URL = process.env.E2E_API_URL ?? 'http://localhost:3000/api';
const MODE = process.env.MOBILE_SERVER ?? 'static';
const PORT = new URL(MOBILE_URL).port || '8081';

const mobileServer =
  MODE === 'expo'
    ? { command: 'pnpm --filter mobile dev', timeout: 300_000 }
    : { command: `${CI ? '' : 'pnpm --filter mobile build && '}node support/serve-static.mjs ../apps/mobile/dist ${PORT}`, timeout: 300_000 };

const phone = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true };

export default defineConfig({
  testDir: './tests/mobile',
  fullyParallel: false,
  workers: 1,
  retries: CI ? 1 : 0,
  reporter: CI ? [['list'], ['html', { open: 'never', outputFolder: 'playwright-report-mobile' }]] : [['list']],
  globalSetup: './global-setup.ts',
  use: {
    baseURL: MOBILE_URL,
    locale: 'es-ES',
    timezoneId: 'Europe/Madrid',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'mobile', testIgnore: '**/capture*.spec.ts', use: { ...devices['Desktop Chrome'], ...phone } },
    // Capturas claro/oscuro a 390 px → docs/screens/mobile-*
    { name: 'mobile-screens', testMatch: '**/capture*.spec.ts', use: { ...devices['Desktop Chrome'], ...phone } },
  ],
  webServer: [
    {
      command: CI ? 'pnpm --filter api start' : 'pnpm --filter api build && pnpm --filter api start',
      url: `${API_URL}/health`,
      reuseExistingServer: !CI,
      timeout: 120_000,
      stdout: 'ignore',
    },
    { ...mobileServer, url: MOBILE_URL, reuseExistingServer: !CI, stdout: 'ignore' },
  ],
});
