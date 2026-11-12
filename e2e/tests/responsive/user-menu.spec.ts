import { expect, test } from '@playwright/test';
import { openAs } from '../../support/auth';
import { isResponsive, openNavigation } from '../../support/responsive';

// Familia 3 · Menú de usuario: popover de la cabecera (escritorio) → sección al pie del drawer (responsive).

test.describe('Familia 3 · menú de usuario', () => {
  test.beforeEach(async ({ page }) => {
    await openAs(page, 'admin', '/programs');
  });

  test('solo existe la variante esperada', async ({ page }) => {
    const responsive = isResponsive(page);
    // Escritorio: el botón de la cabecera; responsive: nada en la cabecera, la sección vive en el drawer (cerrado → no está)
    await expect(page.getByTestId('layout-user-menu')).toHaveCount(responsive ? 0 : 1);
    await expect(page.getByTestId('layout-user-menu-mobile')).toHaveCount(0);
    await openNavigation(page);
    await expect(page.getByTestId('layout-user-menu-mobile')).toHaveCount(responsive ? 1 : 0);
    await expect(page.getByTestId('layout-user-menu-popover')).toHaveCount(0);
  });

  test('«Perfil» tiene el mismo nombre: menuitem en el popover, enlace en el drawer', async ({ page }) => {
    const responsive = isResponsive(page);
    if (responsive) await openNavigation(page);
    else await page.getByRole('button', { name: 'Menú de usuario' }).click();

    const profile = responsive ? page.getByRole('link', { name: 'Perfil' }) : page.getByRole('menuitem', { name: 'Perfil' });
    await expect(profile).toBeVisible();
    await expect(page.getByTestId(responsive ? 'layout-user-profile-mobile' : 'layout-user-profile')).toBeVisible();
    await expect(page.getByTestId(responsive ? 'layout-user-profile' : 'layout-user-profile-mobile')).toHaveCount(0);
    await profile.click();
    await expect(page).toHaveURL(/\/profile$/);
  });

  test('«Cerrar sesión» sale a /login desde cualquiera de las dos variantes', async ({ page }) => {
    const responsive = isResponsive(page);
    if (responsive) {
      await openNavigation(page);
      await page.getByTestId('layout-user-logout-mobile').click();
    } else {
      await page.getByTestId('layout-user-menu').click();
      await page.getByTestId('layout-user-logout').click();
    }
    await expect(page).toHaveURL(/\/login/);
  });

  test('responsive: la sección muestra a la persona y su rol', async ({ page }) => {
    test.skip(!isResponsive(page), 'La sección del drawer solo existe en el diseño responsive');
    await openNavigation(page);
    const section = page.getByRole('group', { name: 'Menú de usuario' });
    await expect(section).toBeVisible();
    await expect(section.getByText('admin', { exact: true })).toBeVisible();
    await expect(section.getByRole('button', { name: 'Atajos' })).toBeVisible();
  });
});
