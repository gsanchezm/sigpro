import { expect, test } from '@playwright/test';
import { openAs } from '../../support/auth';
import { expectOnlyIn, isResponsive } from '../../support/responsive';

// Familia 2 · Búsqueda global: campo en la cabecera (escritorio) → icono que abre la búsqueda a pantalla completa (responsive).
// Se prueba en /nc: en /programs la cabecera no ofrece buscador responsive (la página trae el suyo, `programs-search`).

test.describe('Familia 2 · búsqueda global', () => {
  test.beforeEach(async ({ page }) => {
    await openAs(page, 'admin', '/nc');
  });

  test('solo existe la variante esperada', async ({ page }) => {
    const responsive = isResponsive(page);
    await expectOnlyIn(page, ['layout-search'], 'desktop');
    await expectOnlyIn(page, ['layout-search-toggle'], 'responsive');
    // El campo de la pantalla completa (`layout-search-mobile`) y la propia pantalla no existen hasta abrirla
    await expect(page.getByTestId('layout-search-mobile')).toHaveCount(0);
    await expect(page.getByTestId('layout-search-screen-mobile')).toHaveCount(0);
    expect(responsive || (await page.getByTestId('layout-search-toggle').count()) === 0).toBe(true);
  });

  test('el mismo nombre accesible: «Búsqueda global» es un combobox en las dos variantes', async ({ page }) => {
    if (isResponsive(page)) await page.getByRole('button', { name: 'Búsqueda global' }).click();
    const search = page.getByRole('combobox', { name: 'Búsqueda global' });
    await expect(search).toBeVisible();
    await search.fill('PRG-001');
    // Los resultados agrupados llevan el id de su variante
    const result = page.getByRole('listbox', { name: 'Resultados de la búsqueda' }).getByRole('option').filter({ hasText: 'PRG-001' }).first();
    await expect(result).toBeVisible();
    await expect(page.getByTestId(isResponsive(page) ? 'global-search-item-program-PRG-001-mobile' : 'global-search-item-program-PRG-001')).toBeVisible();
    await expect(page.getByTestId(isResponsive(page) ? 'global-search-item-program-PRG-001' : 'global-search-item-program-PRG-001-mobile')).toHaveCount(0);
    await result.click();
    await expect(page).toHaveURL(/\/programs\/PRG-001$/);
  });

  test('responsive: el icono abre una pantalla completa y desaparece mientras está abierta', async ({ page }) => {
    test.skip(!isResponsive(page), 'La pantalla completa solo existe en el diseño responsive');
    await page.getByTestId('layout-search-toggle').click();
    const screen = page.getByTestId('layout-search-screen-mobile');
    await expect(screen).toBeVisible();
    const viewport = page.viewportSize();
    const box = await screen.boundingBox();
    expect(Math.round(box?.width ?? 0)).toBe(viewport?.width);
    expect(Math.round(box?.height ?? 0)).toBe(viewport?.height);
    // No hay dos «Búsqueda global»: el icono se desmonta y el campo recibe el foco
    await expect(page.getByTestId('layout-search-toggle')).toHaveCount(0);
    await expect(page.getByTestId('layout-search-mobile')).toBeFocused();
    await expect(page.getByTestId('layout-search')).toHaveCount(0);
    await expect(page.getByTestId('global-search-results-mobile')).toBeVisible();
    await expect(page.getByTestId('global-search-results')).toHaveCount(0);

    await page.getByTestId('layout-search-close-mobile').click();
    await expect(screen).toHaveCount(0);
    await expect(page.getByTestId('layout-search-toggle')).toBeVisible();
  });

  test('escritorio: el campo de la cabecera abre un popover, no una pantalla', async ({ page }) => {
    test.skip(isResponsive(page), 'En responsive la búsqueda ocupa la pantalla');
    await page.getByTestId('layout-search').fill('PRG-001');
    await expect(page.getByTestId('global-search-results')).toBeVisible();
    await expect(page.getByTestId('layout-search-screen-mobile')).toHaveCount(0);
  });
});
