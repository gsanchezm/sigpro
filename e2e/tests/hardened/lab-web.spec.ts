import { expect, test, type Page } from '@playwright/test';
import { STUDENT_PASSWORD, studentTenants } from '../../support/hardened';

// Despliegue endurecido · la web «cerrada» (VITE_LAB_PUBLIC=false) contra la API endurecida:
//  - /lab exige sesión; la pantalla de acceso no enseña los usuarios de prueba;
//  - con sesión, /lab muestra las credenciales (que llegan de la API con el bearer), el reinicio y el modo caos, pero ni la lista de
//    tenants, ni la contraseña del alumno, ni el enlace al zip del material (llevan secretos que un sitio estático no puede proteger);
//  - un correo real en «Solicitar acceso» o «Recuperar contraseña» se rechaza con un mensaje claro junto al campo.
// Que lo oculto no viaja en el JavaScript publicado se comprueba sobre el build real: `pnpm check:bundle`.

test.describe.configure({ mode: 'serial' });

let tenant = '';
test.beforeAll(async ({ request }) => {
  [tenant = ''] = await studentTenants(request);
});

const signIn = async (page: Page) => {
  await page.goto(`/login?tenant=${tenant}`);
  await page.getByLabel('Correo electrónico').fill(`${tenant}@sigpro.lab`);
  await page.getByLabel('Contraseña', { exact: true }).fill(STUDENT_PASSWORD);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page).toHaveURL(/\/programs$/);
};

test.describe('sin sesión', () => {
  test('/lab no se muestra: vuelve a la pantalla de acceso', async ({ page }) => {
    await page.goto(`/lab?tenant=${tenant}`);
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByTestId('login-form')).toBeVisible();
    await expect(page.getByTestId('lab-page')).toHaveCount(0);
  });

  test('la pantalla de acceso no enseña los usuarios de prueba', async ({ page }) => {
    const answered = page.waitForResponse((response) => response.url().includes('/api/config/test-users'));
    await page.goto('/login');
    expect(await (await answered).json()).toEqual([]);
    await expect(page.getByTestId('login-form')).toBeVisible();
    await expect(page.getByTestId('test-users')).toHaveCount(0);
    await expect(page.locator('body')).not.toContainText('Admin1234!');
  });

  test('la pista de «Solicitar acceso» no cita ningún correo de prueba', async ({ page }) => {
    await page.goto('/login');
    await page.getByRole('button', { name: 'Solicitar acceso' }).click();
    await expect(page.getByRole('heading', { name: 'Solicitar acceso' })).toBeVisible();
    await expect(page.locator('body')).not.toContainText('admin@sigpro.test');
    await expect(page.locator('body')).toContainText('un correo ya registrado devuelve 409');
  });
});

test.describe('con sesión', () => {
  test('/lab enseña credenciales, reinicio y caos, pero no tenants, ni la contraseña del alumno, ni el zip', async ({ page }) => {
    await signIn(page);
    const credentials = page.waitForResponse((response) => response.url().includes('/api/config/test-users') && response.request().headers()['authorization'] !== undefined);
    await page.goto('/lab');
    expect((await (await credentials).json()) as unknown[]).toHaveLength(6);

    await expect(page.getByTestId('lab-page')).toBeVisible();
    await expect(page.getByTestId('lab-credential-admin')).toContainText('Admin1234!');
    await expect(page.getByTestId('lab-credential-admin')).toContainText('MFA: código fijo del curso');
    await expect(page.getByTestId('lab-reset')).toBeEnabled();
    await expect(page.getByTestId('lab-chaos-apply')).toBeEnabled();

    await expect(page.getByTestId('lab-tenant-select')).toHaveCount(0);
    await expect(page.getByTestId('lab-student-user')).toHaveCount(0);
    await expect(page.getByTestId('lab-download-examples')).toHaveCount(0);
    await expect(page.locator('body')).not.toContainText(STUDENT_PASSWORD);
  });

  test('la web no pide nunca la lista de tenants', async ({ page }) => {
    const requested: string[] = [];
    page.on('request', (request) => requested.push(request.url()));
    await signIn(page);
    await page.goto('/lab');
    await expect(page.getByTestId('lab-page')).toBeVisible();
    expect(requested.filter((url) => url.includes('/config/tenants'))).toEqual([]);
  });

  test('las preguntas frecuentes no citan el código MFA ni los correos de prueba', async ({ page }) => {
    await signIn(page);
    await page.goto('/lab');
    await page.getByTestId('lab-faq-toggle-4').click();
    await expect(page.getByTestId('lab-faq-item-4')).toContainText('Lo tienes en la guía del curso');
    await expect(page.getByTestId('lab-faq')).not.toContainText('123456');
    await expect(page.getByTestId('lab-faq')).not.toContainText('@sigpro.test');
  });
});

test.describe('correos reales en la interfaz', () => {
  const REAL_EMAIL = 'persona.real@gmail.com';
  const MESSAGE = 'En este entorno solo se admiten correos ficticios (por ejemplo, nombre@example.com).';

  test('«Recuperar contraseña» muestra el mensaje junto al campo y no repite la dirección', async ({ page }) => {
    await page.goto(`/login?tenant=${tenant}`);
    await page.getByRole('button', { name: '¿Olvidaste la contraseña?' }).click();
    await page.getByLabel('Correo electrónico').fill(REAL_EMAIL);
    await page.getByRole('button', { name: 'Enviar enlace' }).click();
    await expect(page.getByTestId('forgot-email-error')).toHaveText(MESSAGE);
    await expect(page.getByTestId('forgot-sent')).toHaveCount(0);
  });

  test('«Solicitar acceso» muestra el mensaje junto al campo de correo y no crea la solicitud', async ({ page }) => {
    await page.goto(`/login?tenant=${tenant}`);
    await page.getByRole('button', { name: 'Solicitar acceso' }).click();
    await page.getByLabel('Nombre').fill('Ana');
    await page.getByLabel('Apellidos').fill('Prueba');
    await page.getByLabel('Correo corporativo').fill(REAL_EMAIL);
    await page.getByLabel('Organización / Unidad').fill('Unidad de pruebas');
    await page.getByLabel('Rol solicitado').selectOption('auditor');
    await page.getByLabel('Contraseña', { exact: true }).fill('Abcdefghij1!');
    await page.getByLabel('Confirmar contraseña').fill('Abcdefghij1!');
    await page.getByRole('checkbox', { name: /He leído y acepto/ }).check();
    await page.getByRole('button', { name: 'Enviar solicitud' }).click();
    await expect(page.getByTestId('register-email-error')).toHaveText(MESSAGE);
    await expect(page.getByTestId('toast-ok')).toHaveCount(0);
  });

  test('con un correo de example.com la solicitud sigue funcionando', async ({ page }) => {
    await page.goto(`/login?tenant=${tenant}`);
    await page.getByRole('button', { name: 'Solicitar acceso' }).click();
    await page.getByLabel('Nombre').fill('Ana');
    await page.getByLabel('Apellidos').fill('Prueba');
    await page.getByLabel('Correo corporativo').fill(`ui.${Date.now()}@example.com`);
    await page.getByLabel('Organización / Unidad').fill('Unidad de pruebas');
    await page.getByLabel('Rol solicitado').selectOption('auditor');
    await page.getByLabel('Contraseña', { exact: true }).fill('Abcdefghij1!');
    await page.getByLabel('Confirmar contraseña').fill('Abcdefghij1!');
    await page.getByRole('checkbox', { name: /He leído y acepto/ }).check();
    await page.getByRole('button', { name: 'Enviar solicitud' }).click();
    await expect(page.getByTestId('toast-ok').first()).toContainText('POST /api/auth/register → 201 Created');
  });
});
