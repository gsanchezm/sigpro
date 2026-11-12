import { devices, type Locator, type Page } from '@playwright/test';
import { test, expect } from '../fixtures';
import { MissionPage } from '../pages/MissionPage';
import { NcBoardPage } from '../pages/NcBoardPage';
import { emitMissionEvent } from '../support/mission-api';
import { SCREENSHOT_OPTIONS, SNAPSHOT_OPTIONS, forceTheme, horizontalOverflow, settle } from '../support/visual';

// SESIÓN 11 · Pruebas visuales y emulación móvil
// Ejercicio tipo: una captura con máscara del Panel de misión y el kanban de No conformidades en un iPhone 14.
//
// Política de líneas base (importante):
//   - `toHaveScreenshot` compara contra una imagen de referencia por plataforma. Las referencias se generan en tu
//     máquina con `npx playwright test tests/s11 --update-snapshots` y se versionan en `s11-visual-mobile.spec.ts-snapshots/`.
//   - Cada test con `toHaveScreenshot` lleva la etiqueta `@visual`. El CI la excluye (`--grep-invert @visual`) y se
//     ejecuta solo cuando se pide (`--grep @visual`), porque su referencia de Linux aún no existe.
//   - Las referencias asumen el seed limpio: ejecútalas con `npm run reset` antes y sin otros specs que escriban en el
//     tenant (`--workers=1`). Por eso enmascaramos las zonas con datos vivos (feed, KPIs, gráficas, cabecera).
//   - Los demás tests no tienen línea base y comprueban algo determinista: máscaras, tema, breakpoints y comportamiento.
//
// Emulación móvil. `devices['iPhone 14']` trae `defaultBrowserType: 'webkit'`. Playwright no permite cambiar de
// navegador dentro de un `describe`, así que se quita ese campo y se usa Chromium, el único instalado.

const iphoneDevice = devices['iPhone 14'];
if (!iphoneDevice) throw new Error('Playwright no trae el descriptor «iPhone 14»');
const { defaultBrowserType: _browser, ...iphone14 } = iphoneDevice;

/**
 * Zonas que cambian solas (eventos del simulador, contadores, NC) y se enmascaran en las capturas. La cabecera se
 * enmascara entera porque la campana crece al llegar avisos y desplazaría el perfil del usuario.
 */
const liveZones = (page: Page, mission: MissionPage): Locator[] => [
  page.getByRole('banner'),
  mission.feedSection,
  mission.kpiValues,
  mission.charts,
  mission.connection,
];

/**
 * Fija la altura del feed. Sin ella, cada evento nuevo alarga la tarjeta del feed y mueve píxeles fuera de la máscara,
 * y las dos capturas tendrían tamaños o bordes distintos aunque la máscara esté bien puesta.
 */
const fixFeedHeight = async (page: Page): Promise<void> => {
  await page.addStyleTag({ content: '[data-testid="mission-feed"] { min-height: 360px; }' });
};

test.describe('panel de misión en escritorio', () => {
  test('máscara: dos capturas con un evento nuevo entre ellas son idénticas si se enmascara lo que cambia', async ({ page, apiAs }) => {
    // Comparar bytes de PNG es exacto: si la máscara cubre lo que cambia, la captura no cambia. Y el contraste:
    // sin máscara, el mismo evento sí debe alterar la captura. Así sabemos que la máscara es la que iguala.
    const mission = new MissionPage(page);
    await mission.goto();
    await mission.waitUntilLive();
    await fixFeedHeight(page);
    const api = await apiAs('admin');

    const beforeRaw = await page.screenshot(SCREENSHOT_OPTIONS);
    const beforeMasked = await page.screenshot({ ...SCREENSHOT_OPTIONS, mask: liveZones(page, mission) });

    const emitted = await emitMissionEvent(api);
    await expect(mission.event(emitted.seq)).toBeVisible();

    const afterRaw = await page.screenshot(SCREENSHOT_OPTIONS);
    const afterMasked = await page.screenshot({ ...SCREENSHOT_OPTIONS, mask: liveZones(page, mission) });

    expect(afterMasked.equals(beforeMasked), 'con la máscara, el evento nuevo no debe alterar la captura').toBe(true);
    expect(afterRaw.equals(beforeRaw), 'sin máscara, el evento nuevo sí debe alterar la captura').toBe(false);
  });

  test('tema: sigpro.theme decide el atributo data-theme y el fondo al recargar', async ({ page }) => {
    // El tema se guarda en localStorage y `index.html` lo aplica antes de pintar: basta cambiarlo y recargar.
    // Cada test arranca con un contexto nuevo, así que no hace falta devolver el tema al terminar.
    const mission = new MissionPage(page);
    await mission.goto();

    await page.evaluate(() => localStorage.setItem('sigpro.theme', 'light'));
    await page.reload();
    await mission.waitUntilLive();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
    const lightBackground = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);

    await page.evaluate(() => localStorage.setItem('sigpro.theme', 'dark'));
    await page.reload();
    await mission.waitUntilLive();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    const darkBackground = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);

    expect(darkBackground).not.toBe(lightBackground);
  });

  test('breakpoint de escritorio (1440 px): la lateral de navegación está visible y no hay barra inferior', async ({ page }) => {
    // Mismo código, distinto DOM según el ancho: el breakpoint decide qué se renderiza, no solo cómo se ve.
    const mission = new MissionPage(page);
    await mission.goto();

    await expect(page.getByRole('complementary', { name: 'Navegación principal' })).toBeVisible();
    await expect(page.getByTestId('mobile-tabbar')).toHaveCount(0);
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(1);
  });

  test('panel en claro (1440 px): página completa con las zonas vivas enmascaradas', { tag: '@visual' }, async ({ page }) => {
    await forceTheme(page, 'light');
    const mission = new MissionPage(page);
    await mission.goto();
    await mission.waitUntilLive();
    await fixFeedHeight(page);
    await settle(page);

    await expect(page).toHaveScreenshot('mision-claro-1440.png', { fullPage: true, mask: liveZones(page, mission), ...SNAPSHOT_OPTIONS });
  });

  test('indicadores en oscuro (1440 px): captura del bloque de KPIs con los valores enmascarados', { tag: '@visual' }, async ({ page }) => {
    // Captura de un elemento, no de la página: si el bloque de KPIs cambia de estilo, este test lo señala aunque el resto no.
    await forceTheme(page, 'dark');
    const mission = new MissionPage(page);
    await mission.goto();
    await mission.waitUntilLive();
    await settle(page);

    await expect(mission.kpis).toHaveScreenshot('mision-kpis-oscuro-1440.png', { mask: [mission.kpiValues], ...SNAPSHOT_OPTIONS });
  });
});

test.describe('emulación móvil: iPhone 14 (390 px)', () => {
  test.use(iphone14);

  test('diseño responsive (< 1024 px): sin barra lateral, el menú «Menú» abre el cajón y no hay scroll horizontal', async ({ page }) => {
    const mission = new MissionPage(page);
    await mission.goto();
    await mission.waitUntilLive();

    // Un solo corte a 1024 px: por debajo SIGPRO monta el cajón (drawer) en lugar de la barra lateral, y no hay barra inferior.
    // El cajón cerrado ni siquiera se renderiza; la hamburguesa es la variante responsive: `layout-sidebar-toggle-mobile`
    await expect(page.getByTestId('mobile-tabbar')).toHaveCount(0);
    await expect(page.getByTestId('layout-sidebar')).toHaveCount(0);
    await expect(page.getByTestId('layout-sidebar-mobile')).toHaveCount(0);
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(1);

    // «Menú» exacto: sin `exact`, también casaría con «Menú de usuario»
    const menu = page.getByRole('button', { name: 'Menú', exact: true });
    const drawer = page.getByRole('complementary', { name: 'Navegación principal' });
    await menu.click();
    await expect(menu).toHaveAttribute('aria-expanded', 'true');
    await expect(drawer).toBeVisible();

    // El velo cierra el cajón al pulsar fuera de él (a la derecha, donde no hay cajón)
    await page.getByTestId('layout-drawer-scrim').click({ position: { x: 350, y: 400 } });
    await expect(drawer).toHaveCount(0);
    await expect(menu).toHaveAttribute('aria-expanded', 'false');
  });

  test.describe('kanban de No conformidades', () => {
    test('tablero de NC en 390 px: una pestaña por estado y solo se monta la lista del estado elegido', async ({ page }) => {
      // Por debajo de 1024 px no hay columnas ni arrastre: el tablero son pestañas (`role="tab"`) y un panel con las tarjetas del
      // estado elegido. Las demás listas no existen en el DOM, así que la ventana no se desplaza en horizontal.
      const board = new NcBoardPage(page, true);
      await board.goto();

      await expect(page.getByRole('tab')).toHaveCount(5);
      await expect(board.column('rejected')).toHaveCount(0); // «Rechazada» no está montada: la pestaña activa es «Abierta»
      expect(await board.codesIn('open')).toContain('NC-001');

      await board.tab('rejected').click();
      await expect(board.column('rejected')).toBeVisible();
      await expect(board.column('open')).toHaveCount(0);
      expect(await horizontalOverflow(page)).toBeLessThanOrEqual(1);
      expect(await page.evaluate(() => window.scrollX)).toBe(0);
    });

    test('«Mover a…» de NC-001: muestra los destinos, se cierra con Escape y la tarjeta no se mueve', async ({ page }) => {
      // La alternativa al arrastre en responsive. Es solo lectura: se abre la hoja, se mira y se cierra sin elegir nada.
      const board = new NcBoardPage(page, true);
      await board.goto();
      const stateBefore = await board.card('NC-001').getAttribute('data-state');
      expect(stateBefore).not.toBeNull();

      const menu = await board.openMenu('NC-001');
      // Solo los estados a los que la máquina permite pasar desde «Abierta»
      await expect(menu.getByRole('button', { name: 'Mover a «En análisis»' })).toBeVisible();
      await expect(menu.getByRole('button', { name: 'Mover a «Cerrada»' })).toHaveCount(0);
      await page.keyboard.press('Escape');
      await expect(menu).toBeHidden();

      await expect(board.card('NC-001')).toHaveAttribute('data-state', stateBefore ?? '');
    });

    test('captura del kanban en iPhone 14 (claro): tablero con los contadores de comentarios enmascarados', { tag: '@visual' }, async ({ page }) => {
      await forceTheme(page, 'light');
      const board = new NcBoardPage(page, true);
      await board.goto();
      await settle(page);

      await expect(board.board).toHaveScreenshot('nc-kanban-iphone14-claro.png', { mask: [board.commentBadges], ...SNAPSHOT_OPTIONS });
    });
  });
});
