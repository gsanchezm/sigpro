import { expect, test } from '@playwright/test';
import { openAs } from '../../support/auth';
import { isResponsive } from '../../support/responsive';

// Familia 6 · Filtros de Programas: barra de chips en línea (escritorio) → botón «Filtros» + panel inferior (responsive).
// Los campos (estado, fechas, responsable) son campos de formulario: conservan su id en las dos variantes.

test.describe('Familia 6 · filtros de programas', () => {
  test.beforeEach(async ({ page }) => {
    await openAs(page, 'admin', '/programs');
  });

  test('solo existe la variante esperada', async ({ page }) => {
    const responsive = isResponsive(page);
    await expect(page.getByTestId('programs-filters')).toHaveCount(responsive ? 0 : 1);
    await expect(page.getByTestId('programs-filters-mobile')).toHaveCount(responsive ? 1 : 0);
    // El panel inferior no existe hasta pulsar «Filtros»; el campo de estado solo está en línea en escritorio
    await expect(page.getByTestId('programs-filters-panel-mobile')).toHaveCount(0);
    await expect(page.getByTestId('programs-filter-status')).toHaveCount(responsive ? 0 : 1);
    // El buscador propio de la página solo existe en responsive (en escritorio busca la cabecera)
    await expect(page.getByTestId('programs-search')).toHaveCount(responsive ? 1 : 0);
  });

  test('el rol cambia con la variante pero el nombre es «Filtros»', async ({ page }) => {
    const responsive = isResponsive(page);
    const filters = responsive ? page.getByRole('button', { name: 'Filtros' }) : page.getByRole('search', { name: 'Filtros' });
    await expect(filters).toBeVisible();
    if (responsive) {
      await filters.click();
      await expect(page.getByRole('dialog', { name: 'Filtros' })).toBeVisible();
      await expect(page.getByTestId('programs-filters')).toHaveCount(0);
    }
  });

  test('filtrar por estado funciona igual: se localiza por la etiqueta «Estado» en las dos variantes', async ({ page }) => {
    if (isResponsive(page)) await page.getByTestId('programs-filters-mobile').click();
    await page.getByLabel('Estado').selectOption('on_hold');
    await expect(page).toHaveURL(/status=on_hold/);
    if (isResponsive(page)) {
      await expect(page.getByTestId('programs-filters-mobile')).toHaveAttribute('data-count', '1');
      await page.getByTestId('programs-filters-apply-mobile').click();
      await expect(page.getByTestId('programs-filters-panel-mobile')).toHaveCount(0);
    }
    // Todo lo que queda en la lista está «En pausa»: el badge usa el mismo id y data-state en tarjeta y fila
    const badges = page.getByTestId('programs-state-badge');
    await expect(badges.first()).toHaveAttribute('data-state', 'on_hold');
    for (const badge of await badges.all()) await expect(badge).toHaveAttribute('data-state', 'on_hold');
  });

  test('responsive: «Limpiar filtros» dentro del panel quita el filtro', async ({ page }) => {
    test.skip(!isResponsive(page), 'El panel inferior solo existe en el diseño responsive');
    await page.goto('/programs?status=on_hold');
    await expect(page.getByTestId('programs-filters-mobile')).toHaveAttribute('data-count', '1');
    await page.getByTestId('programs-filters-mobile').click();
    await page.getByTestId('programs-filters-clear-mobile').click();
    await expect(page).not.toHaveURL(/status=/);
    await expect(page.getByTestId('programs-filters-mobile')).toHaveAttribute('data-count', '0');
  });
});
