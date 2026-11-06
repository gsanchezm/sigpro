import { expect, test, type Page } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import type { Server } from 'node:http';
import { join } from 'node:path';
import pixelmatch from 'pixelmatch';
import { PNG } from 'pngjs';
import { startHandoffServer } from '../support/handoff-server';

// Compara cada pantalla con su prototipo del handoff (servido por HTTP) y deja las imágenes en e2e/.compare/.
// No es una prueba de regresión estricta: informa del % de píxeles distintos y falla solo por encima de un umbral laxo.

const PORT = 4173;
const PROTO = `http://127.0.0.1:${PORT}`;
const OUT = join(import.meta.dirname, '..', '.compare');
const MAX_DIFF_RATIO = Number(process.env.COMPARE_MAX_DIFF ?? 0.25);

interface Scenario {
  readonly name: string;
  readonly width: number;
  readonly height: number;
  readonly theme: 'light' | 'dark';
  readonly protoFile: string;
  readonly protoLabel: string;
  readonly protoSetup?: (page: Page) => Promise<void>;
  readonly appPath: string;
  readonly appSetup?: (page: Page) => Promise<void>;
}

const ACCESO = 'SIGPRO Acceso.dc.html';
const protoView = (view: string) => async (page: Page) => {
  await page.getByTestId('proto-view').selectOption(view);
};

const SCENARIOS: readonly Scenario[] = [
  ...(['light', 'dark'] as const).flatMap((theme) =>
    ([1440, 390] as const).flatMap((width) => {
      const height = width === 1440 ? 900 : 844;
      const base = { width, height, theme, protoFile: ACCESO, protoLabel: 'Acceso' } as const;
      return [
        { ...base, name: `login-${theme}-${width}`, appPath: '/login' },
        { ...base, name: `register-${theme}-${width}`, protoSetup: protoView('register'), appPath: '/register' },
        { ...base, name: `forgot-${theme}-${width}`, protoSetup: protoView('forgot'), appPath: '/forgot' },
      ] satisfies Scenario[];
    }),
  ),
];

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
    test(scenario.name, async ({ browser }) => {
      const context = await browser.newContext({ viewport: { width: scenario.width, height: scenario.height }, locale: 'es-ES', serviceWorkers: 'block' });
      await context.addInitScript(() => localStorage.setItem('sigpro.cookies', 'seen'));

      // 1) Prototipo
      const proto = await context.newPage();
      await proto.goto(`${PROTO}/${encodeURIComponent(scenario.protoFile)}`);
      const root = proto.locator(`[data-screen-label="${scenario.protoLabel}"]`);
      await root.waitFor();
      await proto.evaluate(() => document.fonts.ready);
      await scenario.protoSetup?.(proto);
      if (scenario.theme === 'dark') await proto.getByTestId('auth-theme').click();
      await proto.waitForTimeout(250);
      const protoShot = await root.screenshot();

      // 2) Aplicación real (mismo recorte que el prototipo)
      const app = await context.newPage();
      // El prototipo reserva 37 px para su barra de controles: se iguala la altura del contenedor
      await app.setViewportSize({ width: scenario.width, height: scenario.height - 37 });
      await app.addInitScript((theme) => localStorage.setItem('sigpro.theme', theme), scenario.theme);
      await app.goto(scenario.appPath);
      await app.evaluate(() => document.fonts.ready);
      await scenario.appSetup?.(app);
      await app.waitForTimeout(400);
            const appShot = await app.screenshot({ fullPage: true });

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
