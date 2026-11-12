import { expect, test, type Page } from '@playwright/test';
import { openAs } from '../../support/auth';
import { BREAKPOINT_PX, isResponsive } from '../../support/responsive';

// El corte único (< 1024 px) y el remontaje: al cruzarlo a mitad de test React cambia de componente y nunca deja los dos.

const HEIGHT = 900;

const resize = async (page: Page, width: number): Promise<void> => {
  await page.setViewportSize({ width, height: HEIGHT });
};

/** Cuenta cuántas de las dos variantes de cada pareja hay en el DOM: siempre una (nunca 0 ni 2). */
const expectExactlyOnePerPair = async (page: Page, pairs: readonly (readonly [string, string])[]): Promise<void> => {
  for (const [desktop, responsive] of pairs) {
    const total = (await page.getByTestId(desktop).count()) + (await page.getByTestId(responsive).count());
    expect(total, `${desktop} / ${responsive}: debe haber exactamente una variante`).toBe(1);
  }
};

test.describe('<html data-layout> y el corte de 1024 px', () => {
  test('el atributo sigue al ancho: 390 y 810 y 1023 → mobile; 1024 y 1440 → desktop', async ({ page }) => {
    await openAs(page, 'admin', '/programs');
    for (const [width, layout] of [
      [390, 'mobile'],
      [810, 'mobile'],
      [BREAKPOINT_PX - 1, 'mobile'],
      [BREAKPOINT_PX, 'desktop'],
      [1440, 'desktop'],
      [BREAKPOINT_PX - 1, 'mobile'],
    ] as const) {
      await resize(page, width);
      await expect(page.locator('html'), `a ${width} px`).toHaveAttribute('data-layout', layout);
    }
  });

  test('la pantalla de acceso también lo lleva (no pasa por el AppShell)', async ({ page }) => {
    await page.goto('/login');
    await expect(page.locator('html')).toHaveAttribute('data-layout', isResponsive(page) ? 'mobile' : 'desktop');
    await resize(page, 1440);
    await expect(page.locator('html')).toHaveAttribute('data-layout', 'desktop');
    await resize(page, 390);
    await expect(page.locator('html')).toHaveAttribute('data-layout', 'mobile');
  });
});

test.describe('cambiar el viewport a mitad de test remonta la variante', () => {
  test('Programas: tabla y barra lateral ↔ tarjetas y drawer, sin perder el filtro de la URL', async ({ page }) => {
    await openAs(page, 'admin', '/programs?status=on_hold');
    const pairs = [
      ['programs-table', 'programs-table-mobile'],
      ['programs-new', 'programs-new-mobile'],
      ['programs-filters', 'programs-filters-mobile'],
      ['layout-sidebar-toggle', 'layout-sidebar-toggle-mobile'],
    ] as const;

    for (const width of [1440, 390, 1024, 1023, 810, 1440]) {
      await resize(page, width);
      const responsive = width < BREAKPOINT_PX;
      // Primero se espera a que la variante esperada esté pintada (la página carga datos); luego, que no haya restos de la otra
      await expect(page.getByTestId(responsive ? 'programs-table-mobile' : 'programs-table'), `a ${width} px`).toBeVisible();
      await expectExactlyOnePerPair(page, pairs);
      // La barra lateral de escritorio solo existe en escritorio; el drawer, en responsive y abierto
      await expect(page.getByTestId('layout-sidebar')).toHaveCount(responsive ? 0 : 1);
      await expect(page).toHaveURL(/status=on_hold/);
    }
  });

  test('el drawer abierto se cierra al pasar a escritorio y no deja restos', async ({ page }) => {
    await resize(page, 390);
    await openAs(page, 'admin', '/programs');
    await page.getByTestId('layout-sidebar-toggle-mobile').click();
    await expect(page.getByTestId('layout-sidebar-mobile')).toBeVisible();
    await resize(page, 1440);
    await expect(page.getByTestId('layout-sidebar-mobile')).toHaveCount(0);
    await expect(page.getByTestId('layout-drawer-scrim')).toHaveCount(0);
    await expect(page.getByTestId('layout-sidebar')).toBeVisible();
    await resize(page, 390);
    await expect(page.getByTestId('layout-sidebar')).toHaveCount(0);
    await expect(page.getByTestId('layout-sidebar-mobile')).toHaveCount(0);
  });

  test('Programas: el panel de filtros y la hoja de acciones desaparecen al cruzar el corte', async ({ page }) => {
    await resize(page, 390);
    await openAs(page, 'admin', '/programs');
    await page.getByTestId('programs-row-menu-PRG-001-mobile').click();
    await expect(page.getByTestId('programs-row-menu-mobile')).toBeVisible();
    await resize(page, 1440);
    await expect(page.getByTestId('programs-row-menu-mobile')).toHaveCount(0);
    await expect(page.getByTestId('programs-row-PRG-001')).toBeVisible();
    // Y la variante de escritorio sigue funcionando tras el remontaje
    await page.getByTestId('programs-row-menu-PRG-001').click();
    await expect(page.getByTestId('programs-row-menu')).toBeVisible();
  });

  test('Detalle de programa: el select y las pestañas se turnan y conservan la pestaña elegida si se puede', async ({ page }) => {
    await resize(page, 1440);
    await openAs(page, 'admin', '/programs/PRG-001');
    await expect(page.getByTestId('program-detail-tabs')).toBeVisible();
    await resize(page, 390);
    await expect(page.getByTestId('program-detail-tabs')).toHaveCount(0);
    await expect(page.getByTestId('program-detail-tabs-mobile')).toBeVisible();
    await page.getByTestId('program-detail-tabs-mobile').selectOption('milestones');
    await expect(page.getByTestId('program-detail-panel-milestones-mobile')).toBeVisible();
    await resize(page, 1440);
    await expect(page.getByTestId('program-detail-tabs-mobile')).toHaveCount(0);
    await expect(page.getByTestId('program-detail-tabs')).toBeVisible();
  });

  test('Requisitos: abrir el detalle en escritorio y reducir la ventana lo convierte en pantalla completa', async ({ page }) => {
    await resize(page, 1440);
    await openAs(page, 'admin', '/programs/PRG-001/requirements');
    await page.getByTestId('requirement-open-REQ-001').click();
    await expect(page.getByTestId('requirement-detail')).toBeVisible();
    await resize(page, 390);
    await expect(page.getByTestId('requirement-detail')).toHaveCount(0);
    await expect(page.getByTestId('requirement-detail-mobile')).toBeVisible();
    await page.getByTestId('requirement-detail-close-mobile').click();
    await expect(page.getByTestId('requirement-detail-mobile')).toHaveCount(0);
  });

  test('No conformidades: columnas ↔ pestañas', async ({ page }) => {
    await resize(page, 1440);
    await openAs(page, 'admin', '/nc');
    await expect(page.getByTestId('nc-column-open')).toBeVisible();
    await resize(page, 390);
    await expect(page.getByTestId('nc-column-open')).toHaveCount(0);
    await expect(page.getByTestId('nc-board-tabs-mobile')).toBeVisible();
    await resize(page, 1440);
    await expect(page.getByTestId('nc-board-tabs-mobile')).toHaveCount(0);
    await expect(page.getByTestId('nc-column-in_analysis')).toBeVisible();
  });

  test('Búsqueda: la pantalla completa se cierra al volver a escritorio y aparece el campo de la cabecera', async ({ page }) => {
    await resize(page, 390);
    await openAs(page, 'admin', '/nc');
    await page.getByTestId('layout-search-toggle').click();
    await expect(page.getByTestId('layout-search-screen-mobile')).toBeVisible();
    await resize(page, 1440);
    await expect(page.getByTestId('layout-search-screen-mobile')).toHaveCount(0);
    await expect(page.getByTestId('layout-search')).toBeVisible();
    await expect(page.getByTestId('layout-search-toggle')).toHaveCount(0);
  });
});
