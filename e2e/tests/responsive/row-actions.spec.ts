import { expect, test } from '@playwright/test';
import { openAs } from '../../support/auth';
import { isResponsive } from '../../support/responsive';

// Familia 7 · Acciones por fila: menú ⋯ con menuitem (escritorio) → hoja inferior, un dialog con botones (responsive).

test.describe('Familia 7 · acciones por fila', () => {
  test.beforeEach(async ({ page }) => {
    await openAs(page, 'admin', '/programs');
  });

  test('solo existe la variante esperada al abrir el menú de PRG-001', async ({ page }) => {
    const responsive = isResponsive(page);
    // El disparador ⋯ es el mismo botón accesible («Acciones para PRG-001») con otro id
    await expect(page.getByTestId(responsive ? 'programs-row-menu-PRG-001-mobile' : 'programs-row-menu-PRG-001')).toBeVisible();
    await expect(page.getByTestId(responsive ? 'programs-row-menu-PRG-001' : 'programs-row-menu-PRG-001-mobile')).toHaveCount(0);

    await page.getByRole('button', { name: 'Acciones para PRG-001' }).click();
    await expect(page.getByTestId(responsive ? 'programs-row-menu-mobile' : 'programs-row-menu')).toBeVisible();
    await expect(page.getByTestId(responsive ? 'programs-row-menu' : 'programs-row-menu-mobile')).toHaveCount(0);
  });

  test('el rol cambia: menu con menuitem en escritorio, dialog con botones en responsive', async ({ page }) => {
    const responsive = isResponsive(page);
    await page.getByRole('button', { name: 'Acciones para PRG-001' }).click();
    await expect(page.getByRole(responsive ? 'dialog' : 'menu', { name: 'Acciones para PRG-001' })).toBeVisible();
    await expect(page.getByRole(responsive ? 'menu' : 'dialog', { name: 'Acciones para PRG-001' })).toHaveCount(0);
    // Las mismas acciones con los mismos nombres
    const kind = responsive ? 'button' : 'menuitem';
    for (const name of ['Editar', 'Duplicar', 'Archivar', 'Eliminar']) {
      await expect(page.getByRole(kind, { name, exact: true })).toBeVisible();
    }
    await expect(page.getByRole(responsive ? 'link' : 'menuitem', { name: 'Ver detalle' })).toBeVisible();
    await expect(page.getByRole('menuitem')).toHaveCount(responsive ? 0 : 5);
  });

  test('«Ver detalle» abre el programa y «Editar» lleva a su formulario', async ({ page }) => {
    const responsive = isResponsive(page);
    await page.getByRole('button', { name: 'Acciones para PRG-001' }).click();
    await page.getByTestId(responsive ? 'programs-row-menu-edit-mobile' : 'programs-row-menu-edit').click();
    await expect(page).toHaveURL(/\/programs\/PRG-001\/edit$/);
    await page.goBack();
    await page.getByRole('button', { name: 'Acciones para PRG-001' }).click();
    await page.getByTestId(responsive ? 'programs-row-menu-view-mobile' : 'programs-row-menu-view').click();
    await expect(page).toHaveURL(/\/programs\/PRG-001$/);
  });

  test('responsive: la hoja se cierra con su botón, con Escape y con el scrim', async ({ page }) => {
    test.skip(!isResponsive(page), 'La hoja inferior solo existe en el diseño responsive');
    const sheet = page.getByTestId('programs-row-menu-mobile');
    for (const close of [
      () => page.getByTestId('programs-row-menu-close-mobile').click(),
      () => page.keyboard.press('Escape'),
      () => page.mouse.click(5, 5),
    ]) {
      await page.getByTestId('programs-row-menu-PRG-001-mobile').click();
      await expect(sheet).toBeVisible();
      await close();
      await expect(sheet).toHaveCount(0);
    }
  });

  test('un rol sin permiso ve las acciones deshabilitadas con su motivo (title) en las dos variantes', async ({ page }) => {
    const responsive = isResponsive(page);
    await openAs(page, 'consultant', '/programs');
    await page.getByRole('button', { name: 'Acciones para PRG-001' }).click();
    const archive = page.getByTestId(responsive ? 'programs-row-menu-archive-mobile' : 'programs-row-menu-archive');
    await expect(archive).toBeDisabled();
    await expect(archive).toHaveAttribute('title', /rol no permite/i);
  });
});
