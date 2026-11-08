import { expect, test, type APIRequestContext, type Page } from '@playwright/test';
import { API_URL, loginByApi, resetTenant, type RoleName } from '../support/auth';
import { authHeaders } from '../support/admin';

// Spec de humo del Perfil (fase 3): datos de la sesión, permisos por rol y preferencias (idioma, tema con radios, interruptor
// de avisos en tiempo real y casilla del resumen semanal) con borrador + «Guardar», persistencia y cierre de sesión.
// Tenant propio: alumno08. No se usa `openAs`: su script de inicio reescribe tema e idioma en cada carga y taparía la persistencia.

const TENANT = 'alumno08';
test.describe.configure({ mode: 'serial' });

test.beforeAll(async ({ request }) => {
  await resetTenant(request, TENANT);
});

test.afterAll(async ({ request }) => {
  await resetTenant(request, TENANT);
});

/** Sesión por API y solo tenant, sesión y aviso de cookies en el almacenamiento (el tema y el idioma los decide la app). */
const signIn = async (page: Page, request: APIRequestContext, role: RoleName = 'admin'): Promise<void> => {
  const { refreshToken } = await loginByApi(request, role, TENANT);
  await page.context().addInitScript(
    ({ token, tenant }) => {
      localStorage.setItem('sigpro.tenant', tenant);
      localStorage.setItem('sigpro.session', JSON.stringify({ refreshToken: token, remember: true }));
      localStorage.setItem('sigpro.cookies', 'accepted');
    },
    { token: refreshToken, tenant: TENANT },
  );
};

const saveButton = (page: Page) => page.getByRole('button', { name: /^(Guardar|Save)( cambios| changes)?$/ });
const liveSwitch = (page: Page) => page.getByRole('switch', { name: /Notificaciones en tiempo real|Real-time notifications/ });
const storage = (page: Page, key: string) => page.evaluate((name) => localStorage.getItem(name), key);

test('se abre desde el menú de usuario y muestra la cuenta (avatar con alt, nombre, correo, rol y tenant)', async ({ page, request }) => {
  await signIn(page, request);
  await page.goto('/programs');
  await page.getByRole('button', { name: 'Menú de usuario' }).click();
  await page.getByRole('menuitem', { name: 'Perfil' }).click();
  await expect(page).toHaveURL(/\/profile$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Perfil' })).toBeVisible();
  await expect(page.getByTestId('layout-breadcrumbs')).toContainText('Perfil');

  await expect(page.getByTestId('profile-avatar').getByAltText('Marta Ruiz')).toBeVisible();
  await expect(page.getByTestId('profile-name')).toHaveText('Marta Ruiz');
  await expect(page.getByTestId('profile-email')).toHaveText('admin@sigpro.test');
  await expect(page.getByTestId('profile-role')).toHaveText('Admin');
  await expect(page.getByTestId('profile-tenant')).toHaveText(TENANT);

  // estructura accesible: la zona de tema es un grupo con su leyenda y las preferencias un formulario con su botón
  await expect(page.getByRole('group', { name: 'Tema' })).toBeVisible();
  await expect(page.getByRole('radio')).toHaveCount(2);
});

test('permisos del rol: la lista marca lo que se puede hacer (✓ / —) y lo anuncia a los lectores de pantalla', async ({ page, request }) => {
  const allowed = async (): Promise<string[]> => page.getByTestId('profile-permissions').getByRole('listitem').evaluateAll((items) => items.map((item) => item.getAttribute('data-allowed') ?? ''));
  const expected: Readonly<Record<RoleName, string[]>> = {
    // nc.create · nc.transition · nc.close · milestone.edit · users.manage · audit.view
    admin: ['true', 'true', 'true', 'true', 'true', 'true'],
    program_manager: ['true', 'true', 'true', 'true', 'false', 'false'],
    consultant: ['true', 'true', 'false', 'false', 'false', 'false'],
    auditor: ['true', 'false', 'false', 'false', 'false', 'true'],
  };
  const roleLabel: Readonly<Record<RoleName, string>> = { admin: 'Admin', program_manager: 'Gestor de programas', consultant: 'Consultor', auditor: 'Auditor' };

  for (const role of ['admin', 'program_manager', 'consultant', 'auditor'] as const) {
    await signIn(page, request, role);
    await page.goto('/profile');
    await expect(page.getByTestId('profile-role')).toHaveText(roleLabel[role]);
    await expect(page.getByTestId('profile-permissions').getByRole('listitem')).toHaveCount(6);
    expect(await allowed(), `permisos de ${role}`).toEqual(expected[role]);
  }

  // el consultor no puede cerrar NC: la fila lo dice con texto accesible
  await signIn(page, request, 'consultant');
  await page.goto('/profile');
  const close = page.getByRole('listitem').filter({ hasText: 'Cerrar no conformidades' });
  await expect(close).toContainText('No permitido');
  await expect(close).toHaveAttribute('data-allowed', 'false');
  await expect(page.getByRole('listitem').filter({ hasText: 'Mover no conformidades' })).toContainText('Permitido');
});

test('preferencias: son un borrador, «Guardar» las aplica todas y persisten al recargar', async ({ page, request }) => {
  await signIn(page, request);
  await page.goto('/profile');
  await expect(saveButton(page)).toBeDisabled();
  await expect(saveButton(page)).toHaveAttribute('title', 'No hay cambios que guardar');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await expect(page.getByLabel('Idioma de la interfaz')).toHaveValue('es');
  await expect(liveSwitch(page)).toHaveAttribute('aria-checked', 'true');
  await expect(page.getByRole('checkbox', { name: /resumen semanal/i })).not.toBeChecked();

  // cambios en el borrador: nada se aplica todavía
  await page.getByLabel('Idioma de la interfaz').selectOption('en');
  await page.getByRole('radio', { name: 'Oscuro' }).check();
  await liveSwitch(page).click();
  await page.getByRole('checkbox', { name: /resumen semanal/i }).check();
  await expect(saveButton(page)).toBeEnabled();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await expect(page.getByRole('heading', { level: 1, name: 'Perfil' })).toBeVisible();
  expect(await storage(page, 'sigpro.live')).toBeNull();

  await saveButton(page).click();
  await expect(page.getByTestId('toast-ok')).toContainText('Preferencias guardadas');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(page.getByRole('heading', { level: 1, name: 'Profile' })).toBeVisible();
  await expect(page.getByLabel('Interface language')).toHaveValue('en');
  await expect(saveButton(page)).toBeDisabled();
  await expect(saveButton(page)).toHaveAttribute('title', 'There are no changes to save');

  // persisten: localStorage y estado tras recargar
  expect(await storage(page, 'sigpro.live')).toBe('off');
  expect(await storage(page, 'sigpro.digest')).toBe('on');
  expect(await storage(page, 'sigpro.theme')).toBe('dark');
  expect(await storage(page, 'sigpro.lang')).toBe('en');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(page.getByRole('heading', { level: 1, name: 'Profile' })).toBeVisible();
  await expect(page.getByRole('radio', { name: 'Dark' })).toBeChecked();
  await expect(liveSwitch(page)).toHaveAttribute('aria-checked', 'false');
  await expect(page.getByRole('checkbox', { name: /weekly summary/i })).toBeChecked();
});

test('interruptor y casilla con el teclado; volver al valor guardado desactiva «Guardar»', async ({ page, request }) => {
  await signIn(page, request);
  await page.goto('/profile');
  const live = liveSwitch(page);
  await live.focus();
  await page.keyboard.press('Space');
  await expect(live).toHaveAttribute('aria-checked', 'false');
  await expect(saveButton(page)).toBeEnabled();
  await page.keyboard.press('Enter');
  await expect(live).toHaveAttribute('aria-checked', 'true');
  await expect(saveButton(page)).toBeDisabled();

  const digest = page.getByRole('checkbox', { name: /resumen semanal/i });
  await digest.focus();
  await page.keyboard.press('Space');
  await expect(digest).toBeChecked();
  await expect(saveButton(page)).toBeEnabled();
  await page.keyboard.press('Space');
  await expect(digest).not.toBeChecked();
  await expect(saveButton(page)).toBeDisabled();

  // un cambio de idioma y su vuelta atrás también dejan el borrador igual que lo guardado
  await page.getByLabel('Idioma de la interfaz').selectOption('en');
  await expect(saveButton(page)).toBeEnabled();
  await page.getByLabel('Idioma de la interfaz').selectOption('es');
  await expect(saveButton(page)).toBeDisabled();
});

test('el interruptor de tiempo real decide si la campana cuenta los avisos que llegan por WebSocket', async ({ page, request }) => {
  await signIn(page, request);
  await page.goto('/profile');
  const headers = await authHeaders(request, 'admin', TENANT);
  const tick = async (times: number): Promise<void> => {
    for (let i = 0; i < times; i += 1) expect((await request.post(`${API_URL}/mission/tick`, { headers })).status()).toBe(200);
  };
  const bell = page.getByRole('button', { name: /Notificaciones/ });
  const badge = page.getByTestId('layout-notifications-count');

  // con el interruptor activo, un ciclo completo del simulador (8 eventos) incluye avisos y aparece el contador
  await expect(page.getByTestId('profile-live')).toHaveAttribute('aria-checked', 'true');
  await tick(8);
  await expect(badge).toBeVisible();
  await expect(bell).toHaveAttribute('aria-label', /Notificaciones, \d+ sin leer/);

  // se apaga y se guarda: los avisos nuevos ya no suman
  await liveSwitch(page).click();
  await saveButton(page).click();
  await expect(page.getByTestId('toast-ok')).toContainText('Preferencias guardadas');
  const before = await badge.innerText();
  await tick(8);
  await page.waitForTimeout(1200); // da tiempo a que lleguen los eventos por el socket
  await expect(badge).toHaveText(before);
});

test('cerrar sesión desde el perfil vuelve a Acceso con el aviso verde', async ({ page, request }) => {
  await signIn(page, request, 'consultant');
  await page.goto('/profile');
  await expect(page.getByTestId('profile-name')).toHaveText('Lucía Fernández');
  await page.getByRole('button', { name: 'Cerrar sesión' }).click();
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByTestId('login-info')).toHaveText('Sesión cerrada correctamente.');
});

test('sin sesión, /profile redirige a Acceso', async ({ page }) => {
  await page.context().addInitScript(() => localStorage.setItem('sigpro.cookies', 'accepted'));
  await page.goto('/profile');
  await expect(page).toHaveURL(/\/login$/);
});
