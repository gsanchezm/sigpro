import { test, expect } from '../fixtures';
import { LoginPage } from '../pages/LoginPage';
import { API_URL, ROLES, TENANT } from '../support/env';

// SESIÓN 2 · Locators (`getByRole`, `getByLabel`, `data-testid`) y autenticación
// Ejercicio tipo: login válido, inválido y bloqueo tras 5 intentos.
//
// Estos tests NO usan la sesión guardada: `role: 'anonymous'` abre el navegador sin iniciar sesión.
// Orden de preferencia de locators que se practica aquí: getByRole → getByLabel → getByPlaceholder → getByAltText → getByTestId.

test.use({ role: 'anonymous' });

test.describe('locators de la pantalla de acceso', () => {
  test.beforeEach(async ({ page }) => {
    await new LoginPage(page).goto();
  });

  test('getByRole, getByLabel y getByAltText describen lo que ve el usuario', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Iniciar sesión' })).toBeVisible();
    await expect(page.getByAltText('SIGPRO').first()).toBeVisible(); // el logo es un <img alt>, no un <div>
    await expect(page.getByLabel('Correo electrónico')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Entrar' })).toBeEnabled();
    await expect(page.getByRole('link', { name: '¿Olvidaste la contraseña?' }).or(page.getByRole('button', { name: '¿Olvidaste la contraseña?' }))).toBeVisible();
  });

  test('`exact` desambigua «Contraseña» de «Mostrar contraseña»', async ({ page }) => {
    // Sin `exact`, getByLabel('Contraseña') casa con el campo Y con el botón de icono «Mostrar contraseña»
    await expect(page.getByLabel(/contraseña/i)).toHaveCount(2);
    await expect(page.getByLabel('Contraseña', { exact: true })).toHaveCount(1);
    await page.getByRole('button', { name: 'Mostrar contraseña' }).click();
    await expect(page.getByLabel('Contraseña', { exact: true })).toHaveAttribute('type', 'text');
  });

  test('data-testid es la red de seguridad, no el locator por defecto', async ({ page }) => {
    // Mismo botón, dos formas de localizarlo: la primera sobrevive a un cambio de texto; la segunda, también,
    // pero no comprueba que el botón sea accesible para un lector de pantalla.
    const byRole = page.getByRole('button', { name: 'Entrar' });
    const byTestId = page.getByTestId('login-submit');
    await expect(byRole).toHaveCount(1);
    await expect(byRole.and(byTestId)).toHaveCount(1); // and(): el mismo elemento cumple las dos condiciones
  });

  test('validación en el cliente: campos obligatorios y formato de correo', async ({ page }) => {
    const login = new LoginPage(page);
    await login.submit.click();
    await expect(page.getByTestId('login-email-error')).toHaveText('Campo obligatorio');
    await expect(page.getByTestId('login-password-error')).toHaveText('Campo obligatorio');
    await expect(login.email).toHaveAttribute('aria-invalid', 'true');

    await login.email.fill('no-es-un-correo');
    await login.submit.click();
    await expect(page.getByTestId('login-email-error')).toHaveText('Introduce un correo válido');
  });
});

test.describe('login válido', () => {
  test('gestor: entra en Programas', async ({ page }) => {
    const login = new LoginPage(page);
    await login.goto();
    await login.signIn(ROLES.program_manager);
    await expect(page).toHaveURL(/\/programs$/);
    await expect(page.getByRole('heading', { name: 'Programas', level: 1 })).toBeVisible();
  });

  test('tu usuario alumnoNN@sigpro.lab también entra (sin MFA)', async ({ page }) => {
    const student = process.env.SIGPRO_STUDENT ?? 'alumno01';
    const login = new LoginPage(page);
    await login.goto();
    await login.signIn({ email: `${student}@sigpro.lab`, password: process.env.SIGPRO_STUDENT_PASSWORD ?? 'Alumno1234!' });
    await expect(page).toHaveURL(/\/programs$/);
  });

  test('admin: segundo paso MFA, primero con un código incorrecto y luego con el bueno', async ({ page }) => {
    const login = new LoginPage(page);
    await login.goto();
    await login.fill(ROLES.admin);
    await login.submit.click();

    await expect(page.getByRole('heading', { name: 'Verificación en dos pasos' })).toBeVisible();
    // El placeholder («000000») es distinto de la etiqueta: se pueden usar los dos locators
    await expect(page.getByPlaceholder('000000')).toBeVisible();
    await login.mfaCode.fill('000000');
    await login.mfaSubmit.click();
    await expect(page.getByTestId('mfa-error')).toContainText('POST /api/auth/mfa → 401 Unauthorized');

    await login.mfaCode.fill(ROLES.admin.mfa);
    await login.mfaSubmit.click();
    await expect(page).toHaveURL(/\/programs$/);
  });
});

test.describe('login inválido', () => {
  test('401: correo desconocido y contador de intentos', async ({ page }) => {
    const login = new LoginPage(page);
    await login.goto();
    // Un correo único por ejecución: el contador de intentos es por cuenta y no debe arrastrar otras ejecuciones
    await login.fill({ email: `nadie-${Date.now()}@sigpro.test`, password: 'incorrecta' });
    await login.submit.click();
    await expect(login.error).toContainText('Correo o contraseña incorrectos');
    await expect(login.error).toContainText('POST /api/auth/login → 401 Unauthorized · attempts=1');

    await login.submit.click();
    await expect(login.error).toContainText('attempts=2');
  });

  test('423: la cuenta bloqueada de antemano', async ({ page }) => {
    const login = new LoginPage(page);
    await login.goto();
    await login.fill({ email: 'bloqueado@sigpro.test', password: 'Block1234!' });
    await login.submit.click();
    await expect(login.error).toContainText('Cuenta bloqueada tras varios intentos fallidos');
    await expect(login.error).toContainText('423 Locked');
  });

  test('403: la cuenta pendiente de aprobación', async ({ page }) => {
    const login = new LoginPage(page);
    await login.goto();
    await login.fill({ email: 'pendiente@sigpro.test', password: 'Pend1234!' });
    await login.submit.click();
    await expect(login.error).toContainText('Cuenta pendiente de aprobación');
    await expect(login.error).toContainText('reason=pending_approval');
  });
});

test.describe('bloqueo tras 5 intentos', () => {
  test('el 5.º intento fallido bloquea la cuenta, incluso con la contraseña correcta después', async ({ page, request }) => {
    // Para no bloquear a ningún usuario compartido (admin@, gestor@…), el propio test crea una cuenta desechable por API.
    // Queda «pendiente de aprobación», pero el contador de intentos se aplica igual; el reset del tenant la elimina.
    const email = `bloqueo-${Date.now()}@sigpro.lab`;
    const password = 'Prueba1234!';
    const registered = await request.post(`${API_URL}/auth/register`, {
      headers: { 'x-tenant': TENANT },
      data: { first: 'Cuenta', last: 'Desechable', email, org: 'Isdefe', role: 'consultant', password, confirm: password, terms: true },
    });
    expect(registered.status()).toBe(201);

    const login = new LoginPage(page);
    await login.goto();
    await login.fill({ email, password: 'incorrecta-1' });
    for (const attempt of [1, 2, 3, 4]) {
      await login.submit.click();
      await expect(login.error).toContainText(`attempts=${attempt}`);
    }

    await login.submit.click(); // 5.º intento
    await expect(login.error).toContainText('423 Locked');

    // Ya con la contraseña buena: sigue bloqueada
    await login.password.fill(password);
    await login.submit.click();
    await expect(login.error).toContainText('423 Locked');
  });
});
