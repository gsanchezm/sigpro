import { expect, test } from '@playwright/test';
import { openAs } from '../../support/auth';
import { expectOnlyIn, isResponsive, openNavigation } from '../../support/responsive';

// Familia 1 · Navegación principal: barra lateral (escritorio) → drawer con hamburguesa (responsive).
// Solo se lee: corre en los tres proyectos (desktop, tablet y mobile) sobre `demo`.

test.describe('Familia 1 · navegación principal', () => {
  test.beforeEach(async ({ page }) => {
    await openAs(page, 'admin', '/programs');
  });

  test('solo existe la variante esperada: barra lateral en escritorio, drawer cerrado en responsive', async ({ page }) => {
    const responsive = isResponsive(page);
    // El drawer es otro componente: cerrado, no está en el DOM; la barra lateral de escritorio tampoco
    await expect(page.getByTestId('layout-sidebar')).toHaveCount(responsive ? 0 : 1);
    await expect(page.getByTestId('layout-sidebar-mobile')).toHaveCount(0);
    await expectOnlyIn(page, ['layout-sidebar-toggle'], 'desktop');
    await expectOnlyIn(page, ['layout-sidebar-toggle-mobile'], 'responsive');
    // Los enlaces de navegación tampoco están a la vez: nav-programs (escritorio) o nav-programs-mobile (drawer abierto)
    await expect(page.getByTestId('nav-programs-mobile')).toHaveCount(0);
    await expect(page.getByTestId('nav-programs')).toHaveCount(responsive ? 0 : 1);
  });

  test('el nombre accesible es el mismo: «Navegación principal» con enlaces a las secciones', async ({ page }) => {
    await openNavigation(page);
    const navigation = page.getByRole('complementary', { name: 'Navegación principal' });
    await expect(navigation).toBeVisible();
    await expect(navigation.getByRole('link', { name: 'Programas' })).toHaveAttribute('aria-current', 'page');
    // La misma localización por rol sirve en los tres anchos; los ids son otra cosa
    const hamburger = page.getByRole('button', { name: 'Menú', exact: true });
    await expect(hamburger).toBeVisible();
  });

  test('responsive: la hamburguesa abre el drawer (con scrim) y navegar lo cierra', async ({ page }) => {
    test.skip(!isResponsive(page), 'El drawer solo existe en el diseño responsive');
    await expect(page.getByTestId('layout-sidebar-toggle-mobile')).toHaveAttribute('aria-expanded', 'false');
    await openNavigation(page);
    await expect(page.getByTestId('layout-sidebar-toggle-mobile')).toHaveAttribute('aria-expanded', 'true');
    // Barra lateral de escritorio y sus enlaces siguen sin existir con el drawer abierto
    await expect(page.getByTestId('layout-sidebar')).toHaveCount(0);
    await expect(page.getByTestId('nav-programs')).toHaveCount(0);
    await expect(page.getByTestId('layout-drawer-scrim')).toBeVisible();

    await page.getByTestId('nav-verification-mobile').click();
    await expect(page).toHaveURL(/\/verification$/);
    await expect(page.getByTestId('layout-sidebar-mobile')).toHaveCount(0);
  });

  test('responsive: Escape y el botón de cierre cierran el drawer', async ({ page }) => {
    test.skip(!isResponsive(page), 'El drawer solo existe en el diseño responsive');
    await openNavigation(page);
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('layout-sidebar-mobile')).toHaveCount(0);

    await openNavigation(page);
    await page.getByTestId('layout-sidebar-collapse-mobile').click();
    await expect(page.getByTestId('layout-sidebar-mobile')).toHaveCount(0);
  });

  test('escritorio: la hamburguesa pliega la barra lateral a solo iconos', async ({ page }) => {
    test.skip(isResponsive(page), 'En responsive la hamburguesa abre el drawer');
    const toggle = page.getByTestId('layout-sidebar-toggle');
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await expect(page.getByTestId('layout-sidebar')).toBeVisible();
  });
});
