import { test } from '@playwright/test';
import { capture, prepareStorage, THEMES, VIEWPORTS } from '../support/screens';

// Capturas de cada pantalla en claro/oscuro a 1440 y 390 px → docs/screens/ (se ejecuta con `pnpm e2e:screens`).

for (const theme of THEMES) {
  for (const viewport of VIEWPORTS) {
    test.describe(`capturas ${theme} ${viewport.width}`, () => {
      test.use({ viewport });

      test.beforeEach(async ({ page }) => {
        await prepareStorage(page, theme);
      });

      test('acceso: login, registro, recuperar, MFA y verificación', async ({ page }) => {
        await page.goto('/login');
        await page.getByTestId('test-users').waitFor();
        await capture(page, 'acceso-login', theme);

        // Error 401 del servidor
        await page.getByLabel('Correo electrónico').fill(`nadie-${theme}-${viewport.width}@sigpro.test`);
        await page.getByLabel('Contraseña', { exact: true }).fill('incorrecta');
        await page.getByRole('button', { name: 'Entrar' }).click();
        await page.getByRole('alert').waitFor();
        await capture(page, 'acceso-login-error', theme);

        await page.goto('/forgot');
        await page.getByLabel('Correo electrónico').fill('cualquiera@sigpro.test');
        await page.getByRole('button', { name: 'Enviar enlace' }).click();
        await page.getByTestId('forgot-sent').waitFor();
        await capture(page, 'acceso-recuperar', theme);

        await page.goto('/login');
        await page.getByTestId('test-user-admin').click();
        await page.getByRole('button', { name: 'Entrar' }).click();
        await page.getByTestId('mfa-form').waitFor();
        await page.getByLabel('Código de verificación').fill('123456');
        await capture(page, 'acceso-mfa', theme);

        await page.goto('/register');
        await page.getByRole('button', { name: 'Enviar solicitud' }).click();
        await page.getByTestId('register-first-name-error').waitFor();
        await capture(page, 'acceso-registro-errores', theme);

        await page.getByLabel('Nombre').fill('Ana');
        await page.getByLabel('Apellidos').fill('Prueba');
        await page.getByLabel('Correo corporativo').fill(`ana-${theme}-${viewport.width}-${Date.now()}@organizacion.es`);
        await page.getByLabel('Organización / Unidad').fill('Unidad de pruebas');
        await page.getByLabel('Contraseña', { exact: true }).fill('Abcdefghij1!');
        await page.getByLabel('Confirmar contraseña').fill('Abcdefghij1!');
        await page.getByRole('checkbox', { name: /He leído y acepto/ }).check();
        await capture(page, 'acceso-registro', theme);
        await page.getByRole('button', { name: 'Enviar solicitud' }).click();
        await page.getByTestId('verify-panel').waitFor();
        await capture(page, 'acceso-verificacion', theme);
      });
    });
  }
}
