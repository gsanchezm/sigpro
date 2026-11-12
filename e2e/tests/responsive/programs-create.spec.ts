import { expect, test } from '@playwright/test';
import { openAs } from '../../support/auth';
import { expectOnlyExpectedVariant, isResponsive } from '../../support/responsive';

// Familia 5 · Crear programa: botón en la cabecera de la página (escritorio) → botón flotante (responsive).
// El asistente (diálogo) y sus botones internos conservan sus ids: no cambian con el diseño.

test.describe('Familia 5 · crear programa', () => {
  test.beforeEach(async ({ page }) => {
    await openAs(page, 'admin', '/programs');
  });

  test('solo existe la variante esperada', async ({ page }) => {
    await expectOnlyExpectedVariant(page, ['programs-new']);
  });

  test('«+ Nuevo programa» es el mismo nombre accesible y abre el asistente', async ({ page }) => {
    const button = page.getByRole('button', { name: '+ Nuevo programa', exact: true });
    await expect(button).toHaveCount(1);
    await button.click();
    // Diálogo y botones internos del asistente: mismos ids en las dos variantes
    await expect(page.getByTestId('programs-wizard')).toBeVisible();
    await expect(page.getByTestId('programs-wizard-next')).toBeVisible();
    await expect(page.getByTestId('programs-wizard-cancel')).toBeVisible();
    await page.getByTestId('programs-wizard-cancel').click();
    await expect(page.getByTestId('programs-wizard')).toHaveCount(0);
  });

  test('responsive: el botón es flotante (fijo en la esquina) y escritorio lo tiene en la cabecera', async ({ page }) => {
    const button = page.getByTestId(isResponsive(page) ? 'programs-new-mobile' : 'programs-new');
    const position = await button.evaluate((element) => getComputedStyle(element).position);
    expect(position).toBe(isResponsive(page) ? 'fixed' : 'static');
  });

  test('un rol sin permiso no ve el botón flotante y en escritorio lo ve deshabilitado con su motivo', async ({ page }) => {
    await openAs(page, 'auditor', '/programs');
    if (isResponsive(page)) {
      await expect(page.getByTestId('programs-new-mobile')).toHaveCount(0);
    } else {
      await expect(page.getByTestId('programs-new')).toBeDisabled();
      await expect(page.getByTestId('programs-new')).toHaveAttribute('title', /rol no permite/i);
    }
  });
});
