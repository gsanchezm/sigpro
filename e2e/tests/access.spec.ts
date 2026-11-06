import { expect, test, type Page } from '@playwright/test';

// Spec de humo del módulo Acceso. Locators por rol/label primero; data-testid como respaldo.

const fillLogin = async (page: Page, email: string, password: string) => {
  await page.getByLabel('Correo electrónico').fill(email);
  // "Contraseña" convive con "Mostrar contraseña" (aria-label del botón): exact evita la ambigüedad
  await page.getByLabel('Contraseña', { exact: true }).fill(password);
};

test.describe('Acceso · login', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
  });

  test('muestra el logo con alt, el formulario y los usuarios de prueba', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Iniciar sesión' })).toBeVisible();
    await expect(page.getByAltText('SIGPRO').first()).toBeVisible();
    await expect(page.getByTestId('login-form')).toHaveAttribute('aria-busy', 'false');
    await expect(page.getByTestId('test-users')).toBeVisible();
    await expect(page.getByTestId('test-user-admin')).toBeVisible();
    await expect(page.getByTestId('test-user-consultant-locked')).toBeVisible();
    await expect(page.getByTestId('test-user-consultant-pending')).toBeVisible();
  });

  test('un usuario de prueba rellena correo y contraseña', async ({ page }) => {
    await page.getByTestId('test-user-program_manager').click();
    await expect(page.getByLabel('Correo electrónico')).toHaveValue('gestor@sigpro.test');
    await expect(page.getByLabel('Contraseña', { exact: true })).toHaveValue('Gestor1234!');
    await expect(page.getByLabel('Correo electrónico')).toBeFocused();
  });

  test('valida campos obligatorios y formato de correo en el cliente', async ({ page }) => {
    await page.getByRole('button', { name: 'Entrar' }).click();
    await expect(page.getByTestId('login-email-error')).toHaveText('Campo obligatorio');
    await expect(page.getByTestId('login-password-error')).toHaveText('Campo obligatorio');
    await expect(page.getByLabel('Correo electrónico')).toHaveAttribute('aria-invalid', 'true');

    await page.getByLabel('Correo electrónico').fill('no-es-un-correo');
    await page.getByRole('button', { name: 'Entrar' }).click();
    await expect(page.getByTestId('login-email-error')).toHaveText('Introduce un correo válido');
  });

  test('401: credenciales incorrectas muestran la traza HTTP con el nº de intentos', async ({ page }) => {
    const email = `nadie-${Date.now()}@sigpro.test`;
    await fillLogin(page, email, 'incorrecta');
    await page.getByRole('button', { name: 'Entrar' }).click();
    const alert = page.getByRole('alert');
    await expect(alert).toContainText('Correo o contraseña incorrectos');
    await expect(alert).toContainText('POST /api/auth/login → 401 Unauthorized · attempts=1');

    await page.getByRole('button', { name: 'Entrar' }).click();
    await expect(alert).toContainText('attempts=2');
  });

  test('423: cuenta bloqueada', async ({ page }) => {
    await fillLogin(page, 'bloqueado@sigpro.test', 'Block1234!');
    await page.getByRole('button', { name: 'Entrar' }).click();
    await expect(page.getByTestId('login-error')).toContainText('Cuenta bloqueada tras varios intentos fallidos');
    await expect(page.getByTestId('login-error')).toContainText('423 Locked');
  });

  test('403: cuenta pendiente de aprobación', async ({ page }) => {
    await fillLogin(page, 'pendiente@sigpro.test', 'Pend1234!');
    await page.getByRole('button', { name: 'Entrar' }).click();
    await expect(page.getByTestId('login-error')).toContainText('Cuenta pendiente de aprobación');
    await expect(page.getByTestId('login-error')).toContainText('reason=pending_approval');
  });

  test('login correcto sin MFA: overlay de redirección y entrada en Programas', async ({ page }) => {
    await fillLogin(page, 'gestor@sigpro.test', 'Gestor1234!');
    await page.getByRole('button', { name: 'Entrar' }).click();
    const overlay = page.getByTestId('auth-redirecting');
    await expect(overlay).toContainText('Sesión iniciada. Redirigiendo a Programas…');
    await expect(overlay).toContainText('POST /api/auth/login → 200 · role=program_manager');
    await expect(page).toHaveURL(/\/programs$/);
  });

  test('botón mostrar/ocultar contraseña', async ({ page }) => {
    const password = page.getByLabel('Contraseña', { exact: true });
    await password.fill('secreto');
    await expect(password).toHaveAttribute('type', 'password');
    await page.getByRole('button', { name: 'Mostrar contraseña' }).click();
    await expect(password).toHaveAttribute('type', 'text');
    await expect(page.getByRole('button', { name: 'Ocultar contraseña' })).toHaveAttribute('aria-pressed', 'true');
  });

  test('SSO no está disponible: toast informativo con 501', async ({ page }) => {
    await page.getByRole('button', { name: /certificado digital/ }).click();
    const toast = page.getByTestId('toast-info');
    await expect(toast).toContainText('SSO no disponible en el prototipo');
    await expect(toast).toContainText('GET /api/auth/sso → 501');
    // Los toasts se cierran solos a los 3 s
    await expect(toast).toBeHidden({ timeout: 5000 });
  });

  test('cambia idioma y tema desde la cabecera', async ({ page }) => {
    await page.getByTestId('auth-lang').selectOption('en');
    await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
    await expect(page.getByLabel('Email')).toBeVisible();

    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
    await page.getByRole('button', { name: 'Toggle theme' }).click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  });
});

test.describe('Acceso · MFA', () => {
  test('el admin pasa por el segundo paso (código 123456)', async ({ page }) => {
    await page.goto('/login');
    await fillLogin(page, 'admin@sigpro.test', 'Admin1234!');
    await page.getByRole('button', { name: 'Entrar' }).click();

    await expect(page.getByRole('heading', { name: 'Verificación en dos pasos' })).toBeVisible();
    await expect(page.getByTestId('mfa-code')).toBeFocused();
    await expect(page.getByRole('button', { name: 'Verificar' })).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Verificar' })).toHaveAttribute('title', 'Introduce los 6 dígitos del código');

    await page.getByLabel('Código de verificación').fill('00000a');
    // Solo admite dígitos
    await expect(page.getByLabel('Código de verificación')).toHaveValue('00000');
    await page.getByLabel('Código de verificación').fill('000000');
    await page.getByRole('button', { name: 'Verificar' }).click();
    await expect(page.getByTestId('mfa-error')).toContainText('Código incorrecto o caducado');
    await expect(page.getByTestId('mfa-error')).toContainText('POST /api/auth/mfa → 401 Unauthorized');

    await page.getByLabel('Código de verificación').fill('123456');
    await page.getByRole('button', { name: 'Verificar' }).click();
    await expect(page.getByTestId('auth-redirecting')).toContainText('role=admin');
    await expect(page).toHaveURL(/\/programs$/);
  });

  test('Esc y "Volver" regresan al login', async ({ page }) => {
    await page.goto('/login');
    await fillLogin(page, 'admin@sigpro.test', 'Admin1234!');
    await page.getByRole('button', { name: 'Entrar' }).click();
    await expect(page.getByTestId('mfa-form')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('login-form')).toBeVisible();
  });
});

test.describe('Acceso · recuperar contraseña', () => {
  test('responde siempre con el mismo aviso', async ({ page }) => {
    await page.goto('/login');
    await page.getByRole('button', { name: '¿Olvidaste la contraseña?' }).click();
    await expect(page.getByRole('heading', { name: 'Recuperar contraseña' })).toBeVisible();

    await page.getByRole('button', { name: 'Enviar enlace' }).click();
    await expect(page.getByTestId('forgot-email-error')).toHaveText('Campo obligatorio');

    await page.getByLabel('Correo electrónico').fill('cualquiera@sigpro.test');
    await page.getByRole('button', { name: 'Enviar enlace' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Si el correo existe' })).toBeVisible();

    await page.getByRole('button', { name: 'Volver al inicio de sesión' }).click();
    await expect(page.getByTestId('login-form')).toBeVisible();
  });
});

test.describe('Acceso · registro', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.getByRole('button', { name: 'Solicitar acceso' }).click();
    await expect(page.getByRole('heading', { name: 'Solicitar acceso' })).toBeVisible();
  });

  test('valida todos los campos y enfoca el primero con error', async ({ page }) => {
    await page.getByRole('button', { name: 'Enviar solicitud' }).click();
    await expect(page.getByTestId('register-first-name-error')).toHaveText('Campo obligatorio');
    await expect(page.getByTestId('register-terms-error')).toHaveText('Debes aceptar las condiciones');
    await expect(page.getByLabel('Nombre')).toBeFocused();
  });

  test('el medidor de contraseña refleja las cuatro reglas', async ({ page }) => {
    const meter = page.getByTestId('register-password-meter');
    await expect(meter).toHaveAttribute('data-strength', 'none');
    await page.getByLabel('Contraseña', { exact: true }).fill('abcdefghij');
    await expect(meter).toHaveAttribute('data-strength', 'weak');
    await page.getByLabel('Contraseña', { exact: true }).fill('Abcdefghij1!');
    await expect(meter).toHaveAttribute('data-strength', 'strong');
    await expect(meter.locator('li[data-ok="true"]')).toHaveCount(4);
  });

  test('409: el correo ya existe', async ({ page }) => {
    await completeRegistration(page, 'admin@sigpro.test');
    await expect(page.getByTestId('register-error')).toContainText('Ya existe una cuenta con ese correo.');
    await expect(page.getByTestId('register-error')).toContainText('409 Conflict · field=email');
  });

  test('201: solicitud enviada → panel de verificación y reenvío', async ({ page }) => {
    const email = `nueva-${Date.now()}@organizacion.es`;
    await completeRegistration(page, email);

    const panel = page.getByTestId('verify-panel');
    await expect(panel).toContainText('Solicitud enviada');
    await expect(panel).toContainText(email);
    await expect(page.getByTestId('verify-status-badge')).toHaveText('Pendiente de aprobación');
    await expect(page.getByTestId('toast-ok').first()).toContainText('POST /api/auth/register → 201 Created');

    await page.getByRole('button', { name: 'Reenviar correo de verificación' }).click();
    await expect(page.getByTestId('toast-ok').filter({ hasText: 'Correo reenviado' })).toContainText('202');
  });
});

async function completeRegistration(page: Page, email: string) {
  await page.getByLabel('Nombre').fill('Ana');
  await page.getByLabel('Apellidos').fill('Prueba');
  await page.getByLabel('Correo corporativo').fill(email);
  await page.getByLabel('Organización / Unidad').fill('Unidad de pruebas');
  await page.getByLabel('Rol solicitado').selectOption('auditor');
  await page.getByLabel('Contraseña', { exact: true }).fill('Abcdefghij1!');
  await page.getByLabel('Confirmar contraseña').fill('Abcdefghij1!');
  await page.getByRole('checkbox', { name: /He leído y acepto/ }).check();
  await page.getByRole('button', { name: 'Enviar solicitud' }).click();
}
