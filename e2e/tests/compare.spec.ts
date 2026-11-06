import { expect, test, type Page } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import type { Server } from 'node:http';
import { join } from 'node:path';
import pixelmatch from 'pixelmatch';
import { PNG } from 'pngjs';
import { loginByApi, seedStorage } from '../support/auth';
import { startHandoffServer } from '../support/handoff-server';

// Compara cada pantalla con su prototipo del handoff (servido por HTTP) y deja las imágenes en e2e/.compare/.
// No es una prueba de regresión estricta: informa del % de píxeles distintos y falla solo por encima de un umbral laxo.

const PORT = 4173;
const PROTO = `http://127.0.0.1:${PORT}`;
const OUT = join(import.meta.dirname, '..', '.compare');
const MAX_DIFF_RATIO = Number(process.env.COMPARE_MAX_DIFF ?? 0.25);
const ONLY = process.env.COMPARE_ONLY;

type Setup = (page: Page) => Promise<void>;

interface Scenario {
  readonly name: string;
  readonly width: number;
  readonly height: number;
  readonly theme: 'light' | 'dark';
  readonly protoFile: string;
  readonly protoLabel: string;
  /** Prepara el prototipo (vista, rol, estado de datos…) antes de capturar. */
  readonly protoSetup?: Setup;
  readonly appPath: string;
  /** Prepara la app (abrir diálogo, rellenar…) antes de capturar. */
  readonly appSetup?: Setup;
  /** Se ejecuta antes de abrir la app (p. ej. registrar rutas simuladas). */
  readonly appBefore?: Setup;
  /** Si es true la app se abre con sesión de admin. */
  readonly authenticated?: boolean;
  /** No esperar a que aparezca la primera fila (estados de carga o error). */
  readonly skipRowWait?: boolean;
}

const ACCESO = 'SIGPRO Acceso.dc.html';
const PROGRAMAS = 'SIGPRO Programas.dc.html';

const protoView =
  (view: string): Setup =>
  async (page) => {
    await page.getByTestId('proto-view').selectOption(view);
  };

// El prototipo simula 900 ms de carga inicial
const protoReady: Setup = async (page) => {
  await page.getByTestId('programs-row-PRG-001').waitFor({ timeout: 5000 }).catch(() => undefined);
};

/** Acciones comunes (mismos data-testid en prototipo y app). */
const openWizard: Setup = async (page) => {
  await page.getByTestId('programs-new').click();
  await page.getByTestId('programs-wizard').waitFor();
};
const wizardStep1: Setup = async (page) => {
  await openWizard(page);
  await page.getByTestId('programs-wizard-name').fill('Radar de vigilancia costera RVC-3');
  await page.getByTestId('programs-wizard-owner').click();
  await page.getByTestId('programs-wizard-owner-option-u2').click();
};
const wizardStep2: Setup = async (page) => {
  await wizardStep1(page);
  await page.getByTestId('programs-wizard-next').click();
  await page.getByTestId('programs-wizard-start').fill('2026-03-01');
  await page.getByTestId('programs-wizard-end').fill('2027-09-30');
  await page.getByTestId('programs-wizard-budget').fill('1500000');
};
const wizardStep3: Setup = async (page) => {
  await wizardStep2(page);
  await page.getByTestId('programs-wizard-next').click();
  await page.getByTestId('programs-wizard-summary').waitFor();
};
const wizardErrors: Setup = async (page) => {
  await openWizard(page);
  await page.getByTestId('programs-wizard-name').fill('ab');
  await page.getByTestId('programs-wizard-next').click();
};
const rowMenu: Setup = async (page) => {
  await page.getByTestId('programs-row-menu-PRG-002').click();
  await page.getByTestId('programs-row-menu').waitFor();
};
const deleteDialog: Setup = async (page) => {
  await rowMenu(page);
  await page.getByTestId('programs-row-menu-delete').click();
  await page.getByTestId('programs-delete-dialog').waitFor();
};
const bulkSelection: Setup = async (page) => {
  await page.getByTestId('programs-select-PRG-002').check();
  await page.getByTestId('programs-select-PRG-003').check();
  await page.getByTestId('programs-bulk-bar').waitFor();
};

const protoData =
  (state: 'empty' | 'error' | 'loading'): Setup =>
  async (page) => {
    await page.getByTestId('proto-data-state').selectOption(state);
    await page.waitForTimeout(1300);
  };
const searchNothing: Setup = async (page) => {
  const search = page.getByTestId('layout-search').or(page.getByTestId('programs-search')).first();
  await search.fill('zzzz-no-existe');
  await page.getByTestId('programs-empty').waitFor();
};
const failList: Setup = async (page) => {
  await page.route('**/api/programs?*', (route) =>
    route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ statusCode: 503, error: 'Service Unavailable', message: 'down', traceId: '7f3a-c21d' }) }),
  );
};
const slowList: Setup = async (page) => {
  await page.route('**/api/programs?*', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 8000));
    await route.continue().catch(() => undefined);
  });
};

const after =
  (...steps: Setup[]): Setup =>
  async (page) => {
    for (const step of steps) await step(page);
  };

const authScreens = (theme: 'light' | 'dark', width: number, height: number): readonly Scenario[] => {
  const base = { width, height, theme, protoFile: PROGRAMAS, protoLabel: 'Programas', authenticated: true, appPath: '/programs' } as const;
  const desktopOnly: readonly Scenario[] =
    width >= 1100
      ? [
          { ...base, name: `programas-row-menu-${theme}-${width}`, protoSetup: after(protoReady, rowMenu), appSetup: rowMenu },
          { ...base, name: `programas-bulk-${theme}-${width}`, protoSetup: after(protoReady, bulkSelection), appSetup: bulkSelection },
          { ...base, name: `programas-delete-${theme}-${width}`, protoSetup: after(protoReady, deleteDialog), appSetup: deleteDialog },
        ]
      : [];
  return [
    { ...base, name: `programas-list-${theme}-${width}`, protoSetup: protoReady },
    { ...base, name: `programas-wizard-1-${theme}-${width}`, protoSetup: after(protoReady, wizardStep1), appSetup: wizardStep1 },
    { ...base, name: `programas-wizard-2-${theme}-${width}`, protoSetup: after(protoReady, wizardStep2), appSetup: wizardStep2 },
    { ...base, name: `programas-wizard-3-${theme}-${width}`, protoSetup: after(protoReady, wizardStep3), appSetup: wizardStep3 },
    { ...base, name: `programas-wizard-errors-${theme}-${width}`, protoSetup: after(protoReady, wizardErrors), appSetup: wizardErrors },
    { ...base, name: `programas-empty-${theme}-${width}`, protoSetup: after(protoReady, protoData('empty')), appSetup: searchNothing },
    { ...base, name: `programas-error-${theme}-${width}`, protoSetup: protoData('error'), appBefore: failList, skipRowWait: true },
    { ...base, name: `programas-loading-${theme}-${width}`, protoSetup: protoData('loading'), appBefore: slowList, appSetup: async (page) => { await page.getByTestId('skeleton-row').first().waitFor(); }, skipRowWait: true },
    ...desktopOnly,
  ];
};

const SCENARIOS: readonly Scenario[] = (['light', 'dark'] as const)
  .flatMap((theme) =>
    ([1440, 390] as const).flatMap((width) => {
      const height = width === 1440 ? 900 : 844;
      const acceso = { width, height, theme, protoFile: ACCESO, protoLabel: 'Acceso' } as const;
      return [
        { ...acceso, name: `login-${theme}-${width}`, appPath: '/login' },
        { ...acceso, name: `register-${theme}-${width}`, protoSetup: protoView('register'), appPath: '/register' },
        { ...acceso, name: `forgot-${theme}-${width}`, protoSetup: protoView('forgot'), appPath: '/forgot' },
        ...authScreens(theme, width, height),
      ] satisfies Scenario[];
    }),
  )
  .filter((scenario) => !ONLY || scenario.name.includes(ONLY));

const toPng = (buffer: Buffer): PNG => PNG.sync.read(buffer);

/** Recorta un PNG a w×h (esquina superior izquierda). */
const crop = (png: PNG, width: number, height: number): PNG => {
  const out = new PNG({ width, height });
  PNG.bitblt(png, out, 0, 0, width, height, 0, 0);
  return out;
};

test.describe('Comparación visual con el handoff', () => {
  let server: Server;
  test.beforeAll(async () => {
    mkdirSync(OUT, { recursive: true });
    server = await startHandoffServer(PORT);
  });
  test.afterAll(() => {
    server.close();
  });

  for (const scenario of SCENARIOS) {
    test(scenario.name, async ({ browser, request }) => {
      const context = await browser.newContext({ viewport: { width: scenario.width, height: scenario.height }, locale: 'es-ES', serviceWorkers: 'block' });
      // El prototipo guarda "cookies vistas" con otra clave que la app
      await context.addInitScript(() => localStorage.setItem('sigpro_cookies', 'accepted'));

      // 1) Prototipo
      const proto = await context.newPage();
      await proto.goto(`${PROTO}/${encodeURIComponent(scenario.protoFile)}`);
      const root = proto.locator(`[data-screen-label="${scenario.protoLabel}"]`);
      await root.waitFor();
      await proto.evaluate(() => document.fonts.ready);
      if (scenario.theme === 'dark') await proto.getByTestId(scenario.protoLabel === 'Acceso' ? 'auth-theme' : 'layout-theme').click();
      await scenario.protoSetup?.(proto);
      await proto.waitForTimeout(300);
      const protoShot = await root.screenshot();

      // 2) Aplicación real
      const app = await context.newPage();
      const tokens = scenario.authenticated ? await loginByApi(request, 'admin', 'demo') : null;
      await seedStorage(context, { theme: scenario.theme, refreshToken: tokens?.refreshToken });
      // El prototipo reserva 37 px para su barra de controles: se iguala la altura del contenedor
      await app.setViewportSize({ width: scenario.width, height: scenario.height - 37 });
      await scenario.appBefore?.(app);
      await app.goto(scenario.appPath);
      await app.evaluate(() => document.fonts.ready);
      if (scenario.authenticated && !scenario.skipRowWait) await app.getByTestId('programs-row-PRG-001').first().waitFor();
      await scenario.appSetup?.(app);
      await app.waitForTimeout(400);
      // Para que los elementos fixed/sticky (tabbar, botón flotante) queden al final como en el prototipo, el viewport se iguala a la altura del contenido
      const contentHeight = await app.evaluate(() => document.documentElement.scrollHeight);
      await app.setViewportSize({ width: scenario.width, height: contentHeight });
      await app.waitForTimeout(200);
      const appShot = await app.screenshot();

      // 3) Diferencias
      const rawA = toPng(protoShot);
      const rawB = toPng(appShot);
      const width = Math.min(rawA.width, rawB.width);
      const height = Math.min(rawA.height, rawB.height);
      const a = crop(rawA, width, height);
      const b = crop(rawB, width, height);
      const diff = new PNG({ width: a.width, height: a.height });
      const different = pixelmatch(a.data, b.data, diff.data, a.width, a.height, { threshold: 0.12 });
      const ratio = different / (a.width * a.height);
      writeFileSync(join(OUT, `${scenario.name}.proto.png`), protoShot);
      writeFileSync(join(OUT, `${scenario.name}.app.png`), appShot);
      writeFileSync(join(OUT, `${scenario.name}.diff.png`), PNG.sync.write(diff));
      console.log(`[compare] ${scenario.name}: ${(ratio * 100).toFixed(2)} % distintos · proto ${rawA.width}x${rawA.height} · app ${rawB.width}x${rawB.height}`);
      expect(ratio, `${scenario.name} difiere demasiado del handoff`).toBeLessThan(MAX_DIFF_RATIO);
      await context.close();
    });
  }
});
