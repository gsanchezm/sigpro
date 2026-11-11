import { defineConfig, devices } from '@playwright/test';
import { WEB_URL } from './support/env';

const CI = Boolean(process.env.CI);
const desktop = { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } };

export default defineConfig({
  testDir: './tests',
  timeout: 60_000,
  // En Render la primera petición tras un rato de inactividad puede tardar: más margen en CI
  expect: { timeout: CI ? 15_000 : 7_000 },
  forbidOnly: CI,
  // Los archivos se reparten entre workers; dentro de un archivo, los tests van en orden.
  // Cada spec toca datos DISTINTOS del tenant (ver README), por eso pueden convivir 2 workers en local.
  fullyParallel: false,
  workers: CI ? 1 : 2,
  retries: CI ? 1 : 0,
  // En CI cada shard escribe un informe «blob»; el job final los une en un único informe HTML (ver .github/workflows)
  reporter: CI ? [['list'], ['blob']] : [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: WEB_URL,
    locale: 'es-ES',
    timezoneId: 'Europe/Madrid',
    // El service worker de la PWA interferiría con page.route() y con la caché
    serviceWorkers: 'block',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    // 1) Inicia sesión una vez por rol y guarda .auth/*.json
    { name: 'setup', testMatch: /auth\.setup\.ts/ },
    // 2) Los specs de las sesiones, ya autenticados. Sin los tests `@visual`: necesitan líneas base que dependen del
    //    sistema operativo y no existen en un clon recién hecho (ver «Pruebas visuales» en el README)
    { name: 'chromium', testIgnore: /auth\.setup\.ts/, grepInvert: /@visual/, dependencies: ['setup'], use: desktop },
    // 3) Solo los tests `@visual` (`npm run test:visual`): comparan capturas con tus líneas base
    { name: 'visual', testIgnore: /auth\.setup\.ts/, grep: /@visual/, dependencies: ['setup'], use: desktop },
  ],
});
