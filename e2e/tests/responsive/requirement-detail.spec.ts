import { expect, test } from '@playwright/test';
import { openAs } from '../../support/auth';
import { isResponsive } from '../../support/responsive';

// Familia 9 · Detalle de requisito: panel junto al árbol (escritorio) → pantalla completa con «Volver» (responsive).
// Los campos del detalle (título, prioridad, etiquetas, editor) y sus acciones conservan su id en las dos variantes.

test.describe('Familia 9 · detalle de requisito', () => {
  test.beforeEach(async ({ page }) => {
    await openAs(page, 'admin', '/programs/PRG-001/requirements');
    await expect(page.getByTestId('requirements-tree')).toBeVisible();
    await page.getByTestId('requirement-open-REQ-001').click();
  });

  test('solo existe la variante esperada', async ({ page }) => {
    const responsive = isResponsive(page);
    await expect(page.getByTestId(responsive ? 'requirement-detail-mobile' : 'requirement-detail')).toBeVisible();
    await expect(page.getByTestId(responsive ? 'requirement-detail' : 'requirement-detail-mobile')).toHaveCount(0);
    await expect(page.getByTestId(responsive ? 'requirement-detail-close-mobile' : 'requirement-detail-close')).toBeVisible();
    await expect(page.getByTestId(responsive ? 'requirement-detail-close' : 'requirement-detail-close-mobile')).toHaveCount(0);
    // Los campos son los mismos (no cambian de id) y solo hay uno de cada
    await expect(page.getByTestId('requirement-title')).toHaveCount(1);
    await expect(page.getByTestId('requirement-save')).toHaveCount(1);
  });

  test('el rol cambia: complementary junto al árbol, dialog a pantalla completa en responsive', async ({ page }) => {
    const responsive = isResponsive(page);
    await expect(page.getByRole(responsive ? 'dialog' : 'complementary', { name: 'Detalle del requisito' })).toBeVisible();
    await expect(page.getByRole(responsive ? 'complementary' : 'dialog', { name: 'Detalle del requisito' })).toHaveCount(0);
  });

  test('escritorio: el árbol sigue visible junto al panel; responsive: el panel ocupa toda la pantalla', async ({ page }) => {
    const responsive = isResponsive(page);
    const viewport = page.viewportSize();
    const detail = page.getByTestId(responsive ? 'requirement-detail-mobile' : 'requirement-detail');
    const box = await detail.boundingBox();
    if (responsive) {
      expect(Math.round(box?.width ?? 0)).toBe(viewport?.width);
      expect(Math.round(box?.height ?? 0)).toBe(viewport?.height);
    } else {
      expect(box?.width ?? 0).toBeLessThan((viewport?.width ?? 0) / 2);
      await expect(page.getByTestId('requirements-tree')).toBeVisible();
    }
  });

  test('cerrar el detalle: «Cerrar» en escritorio, «Volver» en responsive', async ({ page }) => {
    const responsive = isResponsive(page);
    const close = page.getByRole('button', { name: responsive ? 'Volver' : /Cerrar detalle de REQ-001/, exact: responsive });
    await expect(close).toBeVisible();
    await close.click();
    await expect(page.getByTestId(responsive ? 'requirement-detail-mobile' : 'requirement-detail')).toHaveCount(0);
    await expect(page.getByTestId('requirements-tree')).toBeVisible();
  });

  test('el detalle se edita igual: el título se cambia por su etiqueta y «Guardar» sigue su id', async ({ page }) => {
    // Solo se comprueba que el campo es editable y que el botón reacciona (sin guardar: este spec no escribe datos)
    const title = page.getByLabel('Título');
    await expect(title).toBeVisible();
    await title.fill('Título provisional');
    await expect(page.getByTestId('requirement-save')).toBeEnabled();
  });
});
