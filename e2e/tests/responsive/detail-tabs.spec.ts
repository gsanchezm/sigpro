import { expect, test } from '@playwright/test';
import { openAs } from '../../support/auth';
import { isResponsive } from '../../support/responsive';

// Familia 8 · Pestañas del detalle de programa: tablist (escritorio) → <select> nativo (responsive).

test.describe('Familia 8 · pestañas del detalle de programa', () => {
  test.beforeEach(async ({ page }) => {
    await openAs(page, 'admin', '/programs/PRG-001');
    await expect(page.getByTestId('program-detail')).toBeVisible();
  });

  test('solo existe la variante esperada', async ({ page }) => {
    const responsive = isResponsive(page);
    await expect(page.getByTestId('program-detail-tabs')).toHaveCount(responsive ? 0 : 1);
    await expect(page.getByTestId('program-detail-tabs-mobile')).toHaveCount(responsive ? 1 : 0);
    await expect(page.getByTestId(responsive ? 'program-detail-panel-summary-mobile' : 'program-detail-panel-summary')).toBeVisible();
    await expect(page.getByTestId(responsive ? 'program-detail-panel-summary' : 'program-detail-panel-summary-mobile')).toHaveCount(0);
  });

  test('el rol cambia: tablist en escritorio, combobox (select nativo) en responsive', async ({ page }) => {
    const responsive = isResponsive(page);
    await expect(page.getByRole('tablist')).toHaveCount(responsive ? 0 : 1);
    await expect(page.getByRole('tab')).toHaveCount(responsive ? 0 : 3);
    // El mismo nombre accesible, «Detalle del programa», en las dos variantes
    await expect(page.getByLabel('Detalle del programa')).toBeVisible();
    await expect(page.getByRole(responsive ? 'combobox' : 'tablist', { name: 'Detalle del programa' })).toBeVisible();
  });

  test('cambiar a «Hitos» se hace con el mismo texto visible en las dos variantes', async ({ page }) => {
    const responsive = isResponsive(page);
    if (responsive) await page.getByLabel('Detalle del programa').selectOption({ label: 'Hitos' });
    else await page.getByRole('tab', { name: 'Hitos' }).click();
    await expect(page.getByTestId(responsive ? 'program-detail-panel-milestones-mobile' : 'program-detail-panel-milestones')).toBeVisible();
    await expect(page.getByTestId('milestones-panel')).toBeVisible();
    // El panel anterior ya no está
    await expect(page.getByTestId(responsive ? 'program-detail-panel-summary-mobile' : 'program-detail-panel-summary')).toHaveCount(0);
  });

  test('responsive: las opciones del select llevan su id con sufijo', async ({ page }) => {
    test.skip(!isResponsive(page), 'El select solo existe en el diseño responsive');
    const options = page.getByTestId('program-detail-tabs-mobile').getByRole('option');
    await expect(options).toHaveText(['Resumen', 'Hitos', 'Requisitos']);
    await expect(page.getByTestId('program-detail-tab-milestones-mobile')).toHaveAttribute('value', 'milestones');
    await expect(page.getByTestId('program-detail-tab-milestones')).toHaveCount(0);
  });

  test('«Requisitos» lleva al módulo desde las dos variantes', async ({ page }) => {
    const responsive = isResponsive(page);
    if (responsive) await page.getByLabel('Detalle del programa').selectOption({ label: 'Requisitos' });
    else await page.getByRole('tab', { name: 'Requisitos' }).click();
    await page.getByTestId('program-detail-open-requirements').click();
    await expect(page).toHaveURL(/\/programs\/PRG-001\/requirements$/);
  });
});
