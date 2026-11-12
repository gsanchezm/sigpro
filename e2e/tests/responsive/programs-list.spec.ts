import { expect, test } from '@playwright/test';
import { openAs } from '../../support/auth';
import { isResponsive } from '../../support/responsive';

// Familia 4 · Lista de Programas: fila de tabla (escritorio) → tarjeta (responsive, rol listitem).

test.describe('Familia 4 · lista de programas', () => {
  test.beforeEach(async ({ page }) => {
    await openAs(page, 'admin', '/programs');
  });

  test('solo existe la variante esperada', async ({ page }) => {
    const responsive = isResponsive(page);
    await expect(page.getByTestId(responsive ? 'programs-table-mobile' : 'programs-table')).toBeVisible();
    await expect(page.getByTestId(responsive ? 'programs-table' : 'programs-table-mobile')).toHaveCount(0);
    await expect(page.getByTestId(responsive ? 'programs-row-PRG-001-mobile' : 'programs-row-PRG-001')).toBeVisible();
    await expect(page.getByTestId(responsive ? 'programs-row-PRG-001' : 'programs-row-PRG-001-mobile')).toHaveCount(0);
    await expect(page.getByTestId(responsive ? 'programs-link-PRG-001-mobile' : 'programs-link-PRG-001')).toBeVisible();
    await expect(page.getByTestId(responsive ? 'programs-link-PRG-001' : 'programs-link-PRG-001-mobile')).toHaveCount(0);
  });

  test('el rol cambia con la variante: row en la tabla, listitem en la tarjeta', async ({ page }) => {
    const responsive = isResponsive(page);
    // Una sola tabla en escritorio y ninguna en responsive
    await expect(page.getByRole('table')).toHaveCount(responsive ? 0 : 1);
    const row = page.getByRole(responsive ? 'listitem' : 'row').filter({ hasText: 'PRG-001' });
    await expect(row).toHaveCount(1);
    // Hay tantas filas/tarjetas como programas de la página (10) en las dos variantes
    await expect(page.getByRole(responsive ? 'listitem' : 'row').filter({ has: page.locator('[data-testid="programs-state-badge"]') })).toHaveCount(10);
  });

  test('el nombre accesible del enlace es el mismo y abre el detalle', async ({ page }) => {
    await page.getByRole('link', { name: /PRG-001/ }).first().click();
    await expect(page).toHaveURL(/\/programs\/PRG-001$/);
  });

  test('la tarjeta repite los datos de la fila: estado, avance y responsable', async ({ page }) => {
    const responsive = isResponsive(page);
    const row = page.getByTestId(responsive ? 'programs-row-PRG-001-mobile' : 'programs-row-PRG-001');
    await expect(row.getByTestId('programs-state-badge')).toHaveAttribute('data-state', /^(draft|active|on_hold|closed|cancelled)$/);
    await expect(row.getByRole('progressbar')).toHaveAttribute('aria-valuenow', /^\d+$/);
  });
});
