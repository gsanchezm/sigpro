import { expect, test, type Page, type Route } from '@playwright/test';
import { openAs, resetTenant, seedStorage } from '../../support/auth';

// Acceso (registro, recuperar contraseña y reenvío de la verificación) y páginas legales y ayuda en el móvil: paridad con
// `access.spec.ts` y `legal.spec.ts` de la web. Mismos textos, ids, validaciones y avisos de error (409, 422, 429, 5xx, red).
// El registro crea usuarios: tenant propio (alumno24), restaurado antes y después, y correos únicos por prueba.
// Locators por rol y nombre primero; el `testID` (que React Native Web pinta como `data-testid`) como respaldo.

const TENANT = 'alumno24';
test.describe.configure({ mode: 'serial' });

test.beforeAll(async ({ request }) => {
  await resetTenant(request, TENANT);
});

test.afterAll(async ({ request }) => {
  await resetTenant(request, TENANT);
});

test.beforeEach(async ({ context }) => {
  await seedStorage(context, { tenant: TENANT });
});

const h1 = (page: Page, name: string) => page.getByRole('heading', { level: 1, name, exact: true });
const toast = (page: Page, tone: 'ok' | 'info' | 'danger', text: string) => page.getByTestId(`toast-${tone}`).filter({ hasText: text });
const uniqueEmail = () => `nueva-${Date.now()}-${Math.floor(Math.random() * 1000)}@organizacion.es`;
const PASSWORD = 'Abcdefghij1!';

const failWith = (status: number, error: string) => (route: Route) =>
  route.fulfill({ status, contentType: 'application/json', body: JSON.stringify({ statusCode: status, error, message: error.toLowerCase() }) });

/** Elige una opción de un selector (`combobox` → hoja con opciones `radio`). */
const choose = async (page: Page, field: string, option: string) => {
  await page.getByRole('combobox', { name: field, exact: true }).click();
  await page.getByRole('dialog', { name: field, exact: true }).getByRole('radio', { name: option, exact: true }).click();
  await expect(page.getByRole('dialog', { name: field, exact: true })).toBeHidden();
};

const termsBox = (page: Page) => page.getByRole('checkbox', { name: /He leído y acepto/ });

const fillRegistration = async (page: Page, email: string, role = 'auditor') => {
  await page.getByLabel('Nombre', { exact: true }).fill('Ana');
  await page.getByLabel('Apellidos', { exact: true }).fill('Prueba');
  await page.getByLabel('Correo corporativo', { exact: true }).fill(email);
  await page.getByLabel('Organización / Unidad', { exact: true }).fill('Unidad de pruebas');
  await choose(page, 'Rol solicitado', role);
  await page.getByLabel('Contraseña', { exact: true }).fill(PASSWORD);
  await page.getByLabel('Confirmar contraseña', { exact: true }).fill(PASSWORD);
  await termsBox(page).click();
};

const submitRegistration = (page: Page) => page.getByRole('button', { name: 'Enviar solicitud', exact: true }).click();

test.describe('Móvil · Acceso: enlaces entre pantallas', () => {
  test('el login enlaza con recuperar contraseña, solicitar acceso y el pie legal', async ({ page }) => {
    await page.goto('/login');
    await expect(h1(page, 'Iniciar sesión')).toBeVisible();

    await page.getByRole('button', { name: '¿Olvidaste la contraseña?', exact: true }).click();
    await expect(page).toHaveURL(/\/forgot$/);
    await expect(h1(page, 'Recuperar contraseña')).toBeVisible();
    await page.getByRole('button', { name: 'Volver al inicio de sesión', exact: true }).click();
    await expect(page.getByTestId('login-form')).toBeVisible();
    await expect(page).toHaveURL(/\/login$/);

    await page.getByRole('button', { name: 'Solicitar acceso', exact: true }).click();
    await expect(page).toHaveURL(/\/register$/);
    await expect(h1(page, 'Solicitar acceso')).toBeVisible();
    await page.getByRole('button', { name: 'Volver al inicio de sesión', exact: true }).click();
    await expect(page.getByTestId('login-form')).toBeVisible();

    const footer = page.getByRole('contentinfo');
    for (const name of ['Privacidad', 'Condiciones', 'Ayuda']) await expect(footer.getByRole('link', { name, exact: true })).toBeVisible();
  });

  test('el correo escrito en el login viaja a «Recuperar contraseña»', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Correo electrónico', { exact: true }).fill('lucia@sigpro.test');
    await page.getByRole('button', { name: '¿Olvidaste la contraseña?', exact: true }).click();
    await expect(page.getByLabel('Correo electrónico', { exact: true })).toHaveValue('lucia@sigpro.test');
  });

  test('con sesión iniciada, /register y /forgot llevan a Programas', async ({ page }) => {
    await openAs(page, 'consultant', '/register', { tenant: TENANT });
    await expect(page).toHaveURL(/\/programs$/);
    await page.goto('/forgot');
    await expect(page).toHaveURL(/\/programs$/);
  });

  test('el idioma y el tema se cambian desde la cabecera de Acceso, sin sesión', async ({ page }) => {
    await page.goto('/register');
    await choose(page, 'Idioma', 'EN');
    await expect(h1(page, 'Request access')).toBeVisible();
    await expect(page.getByLabel('First name', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: /^Toggle theme/ }).click();
    expect(await page.evaluate(() => localStorage.getItem('sigpro.theme'))).toBe('dark');
    expect(await page.evaluate(() => localStorage.getItem('sigpro.lang'))).toBe('en');
  });
});

test.describe('Móvil · Acceso: recuperar contraseña', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/forgot');
    await expect(h1(page, 'Recuperar contraseña')).toBeVisible();
  });

  test('valida el correo y responde siempre con el mismo aviso', async ({ page }) => {
    await page.getByRole('button', { name: 'Enviar enlace', exact: true }).click();
    await expect(page.getByTestId('forgot-email-error')).toHaveText('Campo obligatorio');
    await page.getByLabel('Correo electrónico', { exact: true }).fill('no-es-un-correo');
    await page.getByRole('button', { name: 'Enviar enlace', exact: true }).click();
    await expect(page.getByTestId('forgot-email-error')).toHaveText('Introduce un correo válido');
    await page.getByLabel('Correo electrónico', { exact: true }).fill('x');
    await expect(page.getByTestId('forgot-email-error')).toHaveCount(0); // escribir borra el aviso

    const posted = page.waitForRequest((request) => request.method() === 'POST' && request.url().endsWith('/api/auth/forgot'));
    await page.getByLabel('Correo electrónico', { exact: true }).fill('cualquiera@sigpro.test');
    await page.getByRole('button', { name: 'Enviar enlace', exact: true }).click();
    expect((await posted).postDataJSON()).toEqual({ email: 'cualquiera@sigpro.test' });
    await expect(page.getByRole('status').filter({ hasText: 'Si el correo existe, recibirás un enlace en breve.' })).toBeVisible();
    await expect(page.getByTestId('forgot-sent')).toBeVisible();

    await page.getByRole('button', { name: 'Volver al inicio de sesión', exact: true }).click();
    await expect(page.getByTestId('login-form')).toBeVisible();
  });

  test('un fallo del servidor no pasa por éxito: toast de peligro con la traza (la web no lo muestra)', async ({ page }) => {
    await page.route('**/api/auth/forgot', failWith(500, 'Internal Server Error'));
    await page.getByLabel('Correo electrónico', { exact: true }).fill('cualquiera@sigpro.test');
    await page.getByRole('button', { name: 'Enviar enlace', exact: true }).click();
    const failure = toast(page, 'danger', 'Ha ocurrido un error inesperado');
    await expect(failure).toContainText('POST /api/auth/forgot → 500 Internal Server Error');
    await expect(page.getByTestId('forgot-sent')).toHaveCount(0);
    await expect(failure).toBeHidden({ timeout: 5000 }); // se cierra solo a los 3 s
  });

  test('sin conexión: «No se pudo contactar con el servidor»', async ({ page }) => {
    await page.route('**/api/auth/forgot', (route) => route.abort());
    await page.getByLabel('Correo electrónico', { exact: true }).fill('cualquiera@sigpro.test');
    await page.getByRole('button', { name: 'Enviar enlace', exact: true }).click();
    await expect(toast(page, 'danger', 'No se pudo contactar con el servidor')).toContainText('network error');
  });
});

test.describe('Móvil · Acceso: registro', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/register');
    await expect(h1(page, 'Solicitar acceso')).toBeVisible();
  });

  test('valida todos los campos y la aceptación de las condiciones; editar borra los avisos', async ({ page }) => {
    await submitRegistration(page);
    for (const id of ['register-first-name-error', 'register-last-name-error', 'register-email-error', 'register-org-error', 'register-password-error']) {
      await expect(page.getByTestId(id)).toHaveText('Campo obligatorio');
    }
    await expect(page.getByTestId('register-terms-error')).toHaveText('Debes aceptar las condiciones');
    await expect(page.getByLabel('Nombre', { exact: true })).toHaveAttribute('aria-invalid', 'true');
    await expect(termsBox(page)).toHaveAttribute('aria-invalid', 'true');

    await page.getByLabel('Nombre', { exact: true }).fill('Ana');
    await expect(page.getByTestId('register-first-name-error')).toHaveCount(0);
    await expect(page.getByTestId('register-terms-error')).toHaveCount(0);
  });

  test('formato del correo, contraseña corta y confirmación distinta', async ({ page }) => {
    await fillRegistration(page, 'no-es-un-correo');
    await submitRegistration(page);
    await expect(page.getByTestId('register-email-error')).toHaveText('Introduce un correo válido');

    await page.getByLabel('Correo corporativo', { exact: true }).fill(uniqueEmail());
    await page.getByLabel('Contraseña', { exact: true }).fill('corta');
    await page.getByLabel('Confirmar contraseña', { exact: true }).fill('corta');
    await submitRegistration(page);
    await expect(page.getByTestId('register-password-error')).toHaveText('Mínimo 10 caracteres');

    await page.getByLabel('Contraseña', { exact: true }).fill(PASSWORD);
    await page.getByLabel('Confirmar contraseña', { exact: true }).fill('Otra-clave-1!');
    await submitRegistration(page);
    await expect(page.getByTestId('register-password-confirm-error')).toHaveText('Las contraseñas no coinciden');
  });

  test('el medidor de contraseña refleja las cuatro reglas', async ({ page }) => {
    const meter = page.getByTestId('register-password-meter');
    await expect(meter).toHaveAttribute('data-strength', 'none');
    await page.getByLabel('Contraseña', { exact: true }).fill('abcdefghij');
    await expect(meter).toHaveAttribute('data-strength', 'weak');
    await expect(meter.locator('[data-ok="true"]')).toHaveCount(1);
    await page.getByLabel('Contraseña', { exact: true }).fill('Abcdefghij1!');
    await expect(meter).toHaveAttribute('data-strength', 'strong');
    await expect(meter.locator('[data-ok="true"]')).toHaveCount(4);
    await expect(meter).toContainText('Fuerte');
  });

  test('mostrar / ocultar contraseña (los dos campos) y el rol solicitado no ofrece admin', async ({ page }) => {
    const password = page.getByLabel('Contraseña', { exact: true });
    const confirm = page.getByLabel('Confirmar contraseña', { exact: true });
    await expect(password).toHaveAttribute('type', 'password');
    await page.getByRole('button', { name: 'Mostrar contraseña', exact: true }).click();
    // Visible: el campo deja de ser `type=password` (React Native Web no pone `type` en un campo de texto normal)
    await expect(password).not.toHaveAttribute('type', 'password');
    await expect(confirm).not.toHaveAttribute('type', 'password');
    await expect(page.getByRole('button', { name: 'Ocultar contraseña', exact: true })).toHaveAttribute('aria-pressed', 'true');

    await page.getByRole('combobox', { name: 'Rol solicitado', exact: true }).click();
    const roles = page.getByRole('dialog', { name: 'Rol solicitado', exact: true }).getByRole('radio');
    await expect(roles).toHaveText(['consultant', 'program_manager', 'auditor']);
    await expect(page.getByText('El rol admin solo se asigna manualmente.')).toBeVisible();
  });

  test('409: el correo ya existe', async ({ page }) => {
    await fillRegistration(page, 'admin@sigpro.test');
    await submitRegistration(page);
    const alert = page.getByTestId('register-error');
    await expect(alert).toContainText('Ya existe una cuenta con ese correo.');
    await expect(alert).toContainText('POST /api/auth/register → 409 Conflict · field=email');
    await expect(page.getByTestId('verify-panel')).toHaveCount(0);
  });

  test('422, 429 y 503 del servidor: mensaje genérico con su traza; sin conexión, el aviso de red', async ({ page }) => {
    await fillRegistration(page, uniqueEmail());
    const alert = page.getByTestId('register-error');
    for (const [status, reason, trace] of [
      [422, 'Unprocessable Entity', 'POST /api/auth/register → 422 Unprocessable Entity'],
      [429, 'Too Many Requests', 'POST /api/auth/register → 429'],
      [503, 'Service Unavailable', 'POST /api/auth/register → 503'],
    ] as const) {
      await page.route('**/api/auth/register', failWith(status, reason));
      await submitRegistration(page);
      await expect(alert).toContainText('Ha ocurrido un error inesperado');
      await expect(alert).toContainText(trace);
      await expect(page.getByTestId('verify-panel')).toHaveCount(0);
      await page.unroute('**/api/auth/register');
    }
    await page.route('**/api/auth/register', (route) => route.abort());
    await submitRegistration(page);
    await expect(alert).toContainText('No se pudo contactar con el servidor');
  });

  test('201: solicitud enviada → panel de verificación, reenvío (aunque falle) y la cuenta queda pendiente', async ({ page }) => {
    const email = uniqueEmail();
    const posted = page.waitForRequest((request) => request.method() === 'POST' && request.url().endsWith('/api/auth/register'));
    await fillRegistration(page, email, 'program_manager');
    await submitRegistration(page);
    expect((await posted).postDataJSON()).toMatchObject({ first: 'Ana', last: 'Prueba', email, org: 'Unidad de pruebas', role: 'program_manager', terms: true });

    const panel = page.getByTestId('verify-panel');
    await expect(panel).toContainText('Solicitud enviada');
    await expect(panel).toContainText(`Hemos enviado un correo de verificación a ${email}.`);
    await expect(page.getByTestId('verify-status-badge')).toHaveText('Pendiente de aprobación');
    await expect(page.getByTestId('verify-status-badge')).toHaveAttribute('data-state', 'pending_approval');
    await expect(panel).toContainText('program_manager');
    await expect(panel).toContainText('ID');
    await expect(toast(page, 'ok', 'Solicitud enviada')).toContainText('POST /api/auth/register → 201 Created');

    await page.getByRole('button', { name: 'Reenviar correo de verificación', exact: true }).click();
    const resent = toast(page, 'ok', 'Correo reenviado');
    await expect(resent).toContainText('POST /api/auth/resend → 202');
    await expect(resent).toBeHidden({ timeout: 5000 });
    // La web avisa igual aunque el reenvío falle: se mantiene
    await page.route('**/api/auth/resend', failWith(500, 'Internal Server Error'));
    await page.getByRole('button', { name: 'Reenviar correo de verificación', exact: true }).click();
    await expect(resent).toBeVisible();
    await expect(page.getByTestId('toast-danger')).toHaveCount(0);
    await page.unroute('**/api/auth/resend');

    await page.getByRole('button', { name: 'Volver al inicio de sesión', exact: true }).click();
    await expect(page.getByTestId('login-form')).toBeVisible();
    await page.getByLabel('Correo electrónico', { exact: true }).fill(email);
    await page.getByLabel('Contraseña', { exact: true }).fill(PASSWORD);
    await page.getByRole('button', { name: 'Entrar', exact: true }).click();
    await expect(page.getByTestId('login-error')).toContainText('Cuenta pendiente de aprobación');
  });

  test('los enlaces de condiciones y privacidad abren las páginas legales y no pierden el formulario', async ({ page }) => {
    await page.getByLabel('Nombre', { exact: true }).fill('Ana');
    await page.getByRole('link', { name: 'condiciones de uso', exact: true }).click();
    await expect(page).toHaveURL(/\/legal\/terms$/);
    await expect(h1(page, 'Términos de uso')).toBeVisible();
    await page.getByRole('link', { name: 'Volver al acceso', exact: true }).click();
    await expect(page).toHaveURL(/\/register$/);
    await expect(page.getByLabel('Nombre', { exact: true })).toHaveValue('Ana');

    await page.getByRole('link', { name: 'política de privacidad', exact: true }).click();
    await expect(h1(page, 'Política de privacidad')).toBeVisible();
    await page.getByRole('link', { name: 'Volver al acceso', exact: true }).click();
    await expect(page.getByLabel('Nombre', { exact: true })).toHaveValue('Ana');
  });
});

test.describe('Móvil · páginas legales y ayuda', () => {
  test('el pie de Acceso lleva a Privacidad, Condiciones y Ayuda y se vuelve con el enlace de retorno', async ({ page }) => {
    await page.goto('/login');
    const footer = page.getByRole('contentinfo');

    await footer.getByRole('link', { name: 'Privacidad', exact: true }).click();
    await expect(page).toHaveURL(/\/legal\/privacy$/);
    await expect(h1(page, 'Política de privacidad')).toBeVisible();
    await expect(page.getByRole('heading', { level: 2 })).toHaveCount(3);
    await expect(page.getByTestId('legal-page')).toBeVisible();
    await page.getByRole('link', { name: 'Volver al acceso', exact: true }).click();
    await expect(page).toHaveURL(/\/login$/);

    await footer.getByRole('link', { name: 'Condiciones', exact: true }).click();
    await expect(h1(page, 'Términos de uso')).toBeVisible();
    await expect(page.getByText('Última actualización')).toBeVisible();
    await expect(page.getByRole('heading', { level: 2 })).toHaveCount(3);
    await page.getByRole('link', { name: 'Volver al acceso', exact: true }).click();

    await footer.getByRole('link', { name: 'Ayuda', exact: true }).click();
    await expect(page).toHaveURL(/\/help$/);
    await expect(h1(page, 'Ayuda')).toBeVisible();
    await expect(page.getByRole('heading', { level: 2 })).toHaveCount(4);
    await expect(page.getByTestId('help-page')).toBeVisible();
    // /lab es de la web (la pantalla del instructor): el móvil no enlaza a ella
    await expect(page.getByRole('link', { name: 'Ir a /lab' })).toHaveCount(0);
  });

  test('un enlace directo sin historial vuelve al acceso con «Volver al acceso»', async ({ page }) => {
    await page.goto('/help');
    await expect(h1(page, 'Ayuda')).toBeVisible();
    await page.getByRole('link', { name: 'Volver al acceso', exact: true }).click();
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByTestId('login-form')).toBeVisible();
  });

  test('cambian de idioma y de tema sin recargar', async ({ page }) => {
    await page.goto('/legal/terms');
    await choose(page, 'Idioma', 'EN');
    await expect(h1(page, 'Terms of use')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Back to sign in', exact: true })).toBeVisible();

    await page.getByRole('button', { name: /^Toggle theme/ }).click();
    await expect(page.getByRole('button', { name: 'Toggle theme (dark)' })).toBeVisible();
    expect(await page.evaluate(() => localStorage.getItem('sigpro.theme'))).toBe('dark');
  });

  test('con sesión iniciada: «Más» ofrece Ayuda, Condiciones y Privacidad y «Volver» regresa al menú', async ({ page }) => {
    await openAs(page, 'consultant', '/programs', { tenant: TENANT });
    await page.getByRole('tab', { name: 'Más', exact: true }).click();
    for (const key of ['help', 'terms', 'privacy']) await expect(page.getByTestId(`more-item-${key}`)).toBeVisible();

    await page.getByRole('link', { name: 'Ayuda', exact: true }).click();
    await expect(page).toHaveURL(/\/help$/);
    await expect(h1(page, 'Ayuda')).toBeVisible();
    await page.getByRole('link', { name: 'Volver', exact: true }).click();
    await expect(page.getByTestId('more-page')).toBeVisible();
  });

  test('con sesión iniciada y sin historial, «Volver» lleva a Programas', async ({ page }) => {
    await openAs(page, 'consultant', '/help', { tenant: TENANT });
    await expect(h1(page, 'Ayuda')).toBeVisible();
    await page.getByRole('link', { name: 'Volver', exact: true }).click();
    await expect(page).toHaveURL(/\/programs$/);
  });
});
