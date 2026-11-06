import { expect, test } from '@playwright/test';
import { openAs, seedStorage } from '../support/auth';

// Páginas públicas: términos, privacidad y ayuda (enlaces del pie de Acceso y del formulario de registro).

test.describe('páginas legales y ayuda', () => {
  test.beforeEach(async ({ context }) => {
    await seedStorage(context);
  });

  test('el pie de Acceso lleva a Privacidad, Condiciones y Ayuda y se vuelve con el enlace de retorno', async ({ page }) => {
    await page.goto('/login');
    const footer = page.getByRole('contentinfo');

    await footer.getByRole('link', { name: 'Privacidad' }).click();
    await expect(page).toHaveURL(/\/legal\/privacy$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Política de privacidad' })).toBeVisible();
    await expect(page.getByRole('heading', { level: 2 })).toHaveCount(3);

    await page.getByRole('link', { name: 'Volver al acceso' }).click();
    await expect(page).toHaveURL(/\/login$/);

    await footer.getByRole('link', { name: 'Condiciones' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Términos de uso' })).toBeVisible();
    await expect(page.getByText('Última actualización')).toBeVisible();

    await page.goBack();
    await footer.getByRole('link', { name: 'Ayuda' }).click();
    await expect(page).toHaveURL(/\/help$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Ayuda' })).toBeVisible();
    await expect(page.getByRole('heading', { level: 2 })).toHaveCount(4);
  });

  test('la ayuda enlaza con /lab', async ({ page }) => {
    await page.goto('/help');
    await page.getByRole('link', { name: 'Ir a /lab' }).click();
    await expect(page).toHaveURL(/\/lab$/);
  });

  test('cambian de idioma y de tema sin recargar', async ({ page }) => {
    await page.goto('/legal/terms');
    await page.getByRole('combobox', { name: 'Idioma' }).selectOption('en');
    await expect(page.getByRole('heading', { level: 1, name: 'Terms of use' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Back to sign in' })).toBeVisible();

    const toggle = page.getByRole('button', { name: 'Toggle theme' });
    await expect(toggle).toHaveAttribute('aria-pressed', 'false');
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  });

  test('en el registro, los enlaces de condiciones y privacidad abren una pestaña nueva y no pierden el formulario', async ({ page, context }) => {
    await page.goto('/register');
    await page.getByLabel('Nombre', { exact: true }).fill('Ana');

    const [terms] = await Promise.all([context.waitForEvent('page'), page.getByRole('link', { name: 'condiciones de uso' }).click()]);
    await terms.waitForLoadState();
    await expect(terms).toHaveURL(/\/legal\/terms$/);
    await expect(terms.getByRole('heading', { level: 1, name: 'Términos de uso' })).toBeVisible();
    await terms.close();

    const [privacy] = await Promise.all([context.waitForEvent('page'), page.getByRole('link', { name: 'política de privacidad' }).click()]);
    await privacy.waitForLoadState();
    await expect(privacy.getByRole('heading', { level: 1, name: 'Política de privacidad' })).toBeVisible();
    await privacy.close();

    await expect(page.getByLabel('Nombre', { exact: true })).toHaveValue('Ana');
  });

  test('con sesión iniciada, el enlace de retorno vuelve a Programas', async ({ page }) => {
    await openAs(page, 'consultant', '/help');
    await expect(page.getByRole('heading', { level: 1, name: 'Ayuda' })).toBeVisible();
    await page.getByRole('link', { name: 'Volver', exact: true }).click();
    await expect(page).toHaveURL(/\/programs$/);
  });
});
