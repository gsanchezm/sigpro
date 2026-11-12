import { expect, test, type APIRequestContext, type Page } from '@playwright/test';
import { loginByApi, openAs, resetTenant, type RoleName } from '../../support/auth';

// Perfil (cuenta, permisos del rol y preferencias con «Guardar») y búsqueda global en el móvil: paridad con `profile.spec.ts` y
// `search.spec.ts` de la web. Mismos textos, ids y reglas. Tenant propio (alumno24), restaurado antes y después.
// Locators por rol y nombre primero; el `testID` (que React Native Web pinta como `data-testid`) como respaldo, p. ej. en los
// interruptores, cuyo nodo con `role=switch` repite el nombre en un input interno.

const TENANT = 'alumno24';
test.describe.configure({ mode: 'serial' });

test.beforeAll(async ({ request }) => {
  await resetTenant(request, TENANT);
});

test.afterAll(async ({ request }) => {
  await resetTenant(request, TENANT);
});

const h1 = (page: Page, name: string) => page.getByRole('heading', { level: 1, name, exact: true });
const toast = (page: Page, tone: 'ok' | 'info' | 'danger', text: string) => page.getByTestId(`toast-${tone}`).filter({ hasText: text });
const tab = (page: Page, name: string) => page.getByRole('tab', { name, exact: true });
const storage = (page: Page, key: string) => page.evaluate((name) => localStorage.getItem(name), key);

/** Elige una opción de un selector (`combobox` → hoja con opciones `radio`). */
const choose = async (page: Page, field: string, option: string) => {
  await page.getByRole('combobox', { name: field, exact: true }).click();
  await page.getByRole('dialog', { name: field, exact: true }).getByRole('radio', { name: option, exact: true }).click();
  await expect(page.getByRole('dialog', { name: field, exact: true })).toBeHidden();
};

/**
 * Sesión por API y solo tenant y sesión en el almacenamiento: el tema y el idioma los decide la app. No se usa `openAs`: su
 * script de inicio reescribe tema e idioma en cada carga y taparía la persistencia de las preferencias.
 */
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

// --- Perfil ----------------------------------------------------------------------------------------------------------

const saveButton = (page: Page) => page.getByRole('button', { name: /^(Guardar|Save)$/ });
const liveSwitch = (page: Page) => page.getByTestId('profile-live');
const digestBox = (page: Page) => page.getByRole('checkbox', { name: /resumen semanal|weekly summary/i });

test.describe('Móvil · Perfil', () => {
  test('se abre desde «Más» y muestra la cuenta: avatar con nombre, nombre, correo, rol traducido y tenant', async ({ page, request }) => {
    await signIn(page, request);
    await page.goto('/programs');
    await tab(page, 'Más').click();
    await page.getByRole('link', { name: 'Perfil', exact: true }).click();
    await expect(page).toHaveURL(/\/profile$/);
    await expect(h1(page, 'Perfil')).toBeVisible();
    await expect(page.getByText('Tu cuenta y tus preferencias en este navegador.')).toBeVisible();

    await expect(page.getByTestId('profile-avatar').getByRole('img', { name: 'Marta Ruiz' })).toBeVisible();
    await expect(page.getByTestId('profile-name')).toHaveText('Marta Ruiz');
    await expect(page.getByTestId('profile-email')).toHaveText('admin@sigpro.test');
    await expect(page.getByTestId('profile-role')).toHaveText('Admin');
    await expect(page.getByTestId('profile-tenant')).toHaveText(TENANT);

    // Estructura accesible: la zona de tema es un grupo con su nombre y las secciones tienen su encabezado
    const theme = page.getByRole('radiogroup', { name: 'Tema', exact: true });
    await expect(theme).toBeVisible();
    await expect(theme.getByRole('radio')).toHaveText(['Claro', 'Oscuro']);
    for (const name of ['Cuenta', 'Qué puedes hacer con tu rol', 'Preferencias']) await expect(page.getByRole('heading', { level: 2, name, exact: true })).toBeVisible();
  });

  test('permisos del rol: la lista marca lo que se puede hacer (✓ / —) y lo anuncia con texto', async ({ page }) => {
    const allowed = (): Promise<string[]> =>
      page
        .getByTestId('profile-permissions')
        .getByRole('listitem')
        .evaluateAll((items) => items.map((item) => item.getAttribute('data-allowed') ?? ''));
    const expected: Readonly<Record<RoleName, string[]>> = {
      // nc.create · nc.transition · nc.close · milestone.edit · users.manage · audit.view
      admin: ['true', 'true', 'true', 'true', 'true', 'true'],
      program_manager: ['true', 'true', 'true', 'true', 'false', 'false'],
      consultant: ['true', 'true', 'false', 'false', 'false', 'false'],
      auditor: ['true', 'false', 'false', 'false', 'false', 'true'],
    };
    const roleLabel: Readonly<Record<RoleName, string>> = { admin: 'Admin', program_manager: 'Gestor de programas', consultant: 'Consultor', auditor: 'Auditor' };

    for (const role of ['admin', 'program_manager', 'consultant', 'auditor'] as const) {
      await openAs(page, role, '/profile', { tenant: TENANT });
      await expect(page.getByTestId('profile-role')).toHaveText(roleLabel[role]);
      await expect(page.getByTestId('profile-permissions').getByRole('listitem')).toHaveCount(6);
      expect(await allowed(), `permisos de ${role}`).toEqual(expected[role]);
    }

    // El consultor no puede cerrar NC: la fila lo dice con texto
    await openAs(page, 'consultant', '/profile', { tenant: TENANT });
    const close = page.getByRole('listitem').filter({ hasText: 'Cerrar no conformidades' });
    await expect(close).toContainText('No permitido');
    await expect(close).toHaveAttribute('data-allowed', 'false');
    await expect(page.getByRole('listitem').filter({ hasText: 'Mover no conformidades' })).toContainText('Permitido');
  });

  test('preferencias: son un borrador, «Guardar» las aplica todas y persisten al recargar', async ({ page, request }) => {
    await signIn(page, request);
    await page.goto('/profile');
    await expect(saveButton(page)).toBeDisabled();
    await expect(page.getByTestId('profile-page').getByText('No hay cambios que guardar')).toBeVisible(); // el motivo, a la vista
    await expect(page.getByRole('combobox', { name: 'Idioma de la interfaz', exact: true })).toContainText('Español');
    await expect(page.getByRole('radio', { name: 'Claro', exact: true })).toHaveAttribute('aria-checked', 'true');
    await expect(liveSwitch(page)).toHaveAttribute('aria-checked', 'true');
    await expect(digestBox(page)).toHaveAttribute('aria-checked', 'false');

    // Cambios en el borrador: nada se aplica todavía
    await choose(page, 'Idioma de la interfaz', 'English');
    await page.getByRole('radio', { name: 'Oscuro', exact: true }).click();
    await liveSwitch(page).click();
    await digestBox(page).click();
    await expect(saveButton(page)).toBeEnabled();
    await expect(h1(page, 'Perfil')).toBeVisible();
    await expect(tab(page, 'Más')).toBeVisible();
    expect(await storage(page, 'sigpro.live')).toBeNull();
    expect(await storage(page, 'sigpro.theme')).toBeNull();
    expect(await storage(page, 'sigpro.lang')).toBeNull();

    await saveButton(page).click();
    // El aviso sale en el idioma anterior (como la web) y todo se aplica a la vez
    await expect(toast(page, 'ok', 'Preferencias guardadas')).toBeVisible();
    await expect(h1(page, 'Profile')).toBeVisible();
    await expect(page.getByRole('combobox', { name: 'Interface language', exact: true })).toContainText('English');
    await expect(saveButton(page)).toBeDisabled();
    await expect(page.getByTestId('profile-page').getByText('There are no changes to save')).toBeVisible();

    // Persisten: mismas claves y valores que la web, y el estado tras recargar
    expect(await storage(page, 'sigpro.live')).toBe('off');
    expect(await storage(page, 'sigpro.digest')).toBe('on');
    expect(await storage(page, 'sigpro.theme')).toBe('dark');
    expect(await storage(page, 'sigpro.lang')).toBe('en');
    await page.reload();
    await expect(h1(page, 'Profile')).toBeVisible();
    await expect(page.getByRole('radio', { name: 'Dark', exact: true })).toHaveAttribute('aria-checked', 'true');
    await expect(liveSwitch(page)).toHaveAttribute('aria-checked', 'false');
    await expect(digestBox(page)).toHaveAttribute('aria-checked', 'true');
    await expect(saveButton(page)).toBeDisabled(); // sin parpadeo: lo guardado ya es lo aplicado
  });

  test('volver al valor guardado desactiva «Guardar» (interruptor, casilla, idioma y tema)', async ({ page, request }) => {
    await signIn(page, request);
    await page.goto('/profile');
    await liveSwitch(page).click();
    await expect(liveSwitch(page)).toHaveAttribute('aria-checked', 'false');
    await expect(saveButton(page)).toBeEnabled();
    await liveSwitch(page).click();
    await expect(liveSwitch(page)).toHaveAttribute('aria-checked', 'true');
    await expect(saveButton(page)).toBeDisabled();

    await digestBox(page).click();
    await expect(digestBox(page)).toHaveAttribute('aria-checked', 'true');
    await expect(saveButton(page)).toBeEnabled();
    await digestBox(page).click();
    await expect(saveButton(page)).toBeDisabled();

    await choose(page, 'Idioma de la interfaz', 'English');
    await expect(saveButton(page)).toBeEnabled();
    await choose(page, 'Idioma de la interfaz', 'Español');
    await expect(saveButton(page)).toBeDisabled();

    await page.getByRole('radio', { name: 'Oscuro', exact: true }).click();
    await expect(saveButton(page)).toBeEnabled();
    await page.getByRole('radio', { name: 'Claro', exact: true }).click();
    await expect(saveButton(page)).toBeDisabled();
  });

  test('cerrar sesión desde el perfil vuelve a Acceso y borra la sesión guardada', async ({ page, request }) => {
    await signIn(page, request, 'consultant');
    await page.goto('/profile');
    await expect(page.getByTestId('profile-name')).toHaveText('Lucía Fernández');
    await page.getByRole('button', { name: 'Cerrar sesión', exact: true }).click();
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByTestId('login-form')).toBeVisible();
    expect(await storage(page, 'sigpro.session')).toBeNull();
  });

  test('sin sesión, /profile redirige a Acceso', async ({ page }) => {
    await page.context().addInitScript(() => localStorage.setItem('sigpro.cookies', 'accepted'));
    await page.goto('/profile');
    await expect(page).toHaveURL(/\/login$/);
  });
});
