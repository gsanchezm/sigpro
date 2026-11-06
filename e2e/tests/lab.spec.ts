import { expect, test } from '@playwright/test';
import { API_URL, loginByApi, openAs, resetTenant, seedStorage } from '../support/auth';

// Spec de humo de /lab: credenciales, tenants, reset con confirm() nativo, modo caos, contraejemplos y FAQ.

const TENANT = 'alumno05';
test.describe.configure({ mode: 'serial' });

test.beforeAll(async ({ request }) => {
  await resetTenant(request, TENANT);
});

test.describe('/lab sin sesión', () => {
  test.beforeEach(async ({ page }) => {
    await seedStorage(page.context(), { tenant: TENANT });
    await page.goto('/lab');
    await expect(page.getByTestId('lab-page')).toBeVisible();
  });

  test('muestra credenciales de demo, tenants y estado de la API', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Laboratorio', level: 1 })).toBeVisible();
    await expect(page.getByTestId('lab-tenant-info')).toHaveText('Tenant activo: alumno05');

    const credentials = page.getByRole('table').filter({ hasText: 'admin@sigpro.test' });
    await expect(credentials.getByRole('row')).toHaveCount(7); // cabecera + 6 usuarios
    await expect(page.getByTestId('lab-credential-admin')).toContainText('Admin1234!');
    await expect(page.getByTestId('lab-credential-admin')).toContainText('MFA: 123456');
    await expect(page.getByTestId('lab-credential-consultant-locked')).toContainText('Cuenta bloqueada (423)');
    await expect(page.getByTestId('lab-credential-consultant-pending')).toContainText('Pendiente de aprobación (403)');

    await expect(page.getByLabel('Tenant de trabajo').getByRole('option')).toHaveCount(26); // demo + alumno01…25
    await expect(page.getByTestId('lab-health')).toHaveText('API operativa');
    await expect(page.getByRole('link', { name: 'Documentación de la API' })).toHaveAttribute('href', '/api/docs');
  });

  test('reset y caos están deshabilitados sin sesión de admin, con title explicativo', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'Reiniciar datos' })).toBeDisabled();
    await expect(page.getByTitle('Inicia sesión como admin para reiniciar el tenant.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Aplicar caos' })).toBeDisabled();
    await expect(page.getByLabel('Latencia máxima (ms)')).toBeDisabled();
  });

  test('cambiar de tenant lo guarda para el acceso', async ({ page }) => {
    await page.getByLabel('Tenant de trabajo').selectOption('alumno07');
    await page.getByRole('button', { name: 'Usar este tenant' }).click();
    await expect(page.getByTestId('toast-info')).toContainText('Tenant activo: alumno07');
    expect(await page.evaluate(() => localStorage.getItem('sigpro.tenant'))).toBe('alumno07');
  });

  test('contraejemplos: pares de textos que se solapan y XPath frágil', async ({ page }) => {
    // exact distingue "Guardar" de "Guardar y cerrar" y "Activo" de "Activo (3)"
    const section = page.locator('section').filter({ has: page.getByRole('heading', { name: 'Contraejemplos' }) });
    await expect(section.getByRole('button', { name: 'Guardar', exact: true })).toHaveCount(1);
    await expect(section.getByRole('button', { name: 'Guardar' })).toHaveCount(2);
    await expect(section.getByText('Activo', { exact: true })).toHaveCount(1);
    await expect(section.getByText('Activo', { exact: false })).toHaveCount(2);
    await expect(page.locator('//tr[contains(., "PRG-004")]')).toHaveCount(1);
  });

  test('FAQ: acordeón accesible', async ({ page }) => {
    const first = page.getByRole('button', { name: '¿Cómo reinicio mis datos?' });
    await expect(first).toHaveAttribute('aria-expanded', 'false');
    await first.click();
    await expect(first).toHaveAttribute('aria-expanded', 'true');
    await expect(page.getByTestId('lab-faq-toggle-1')).toHaveAttribute('aria-expanded', 'true'); // respaldo por testid
    await expect(page.getByRole('region', { name: '¿Cómo reinicio mis datos?' })).toContainText('POST /api/admin/reset');
    await page.getByRole('button', { name: '¿Cómo cambio de tenant?' }).click();
    await expect(first).toHaveAttribute('aria-expanded', 'false');
  });

  test('el acceso desde /lab lleva a la pantalla de login', async ({ page }) => {
    await page.getByTestId('lab-login-link').click();
    await expect(page).toHaveURL(/\/login$/);
  });
});

test.describe('/lab como admin', () => {
  test('reset con confirm() nativo: cancelar no hace nada y aceptar restaura el seed', async ({ page, request }) => {
    const { accessToken } = await loginByApi(request, 'admin', TENANT);
    const auth = { Authorization: `Bearer ${accessToken}`, 'x-tenant': TENANT };
    await request.post(`${API_URL}/programs/PRG-001/archive`, { headers: auth }); // ensucia el tenant
    const status = async () => ((await (await request.get(`${API_URL}/programs/PRG-001`, { headers: auth })).json()) as { status: string }).status;
    expect(await status()).toBe('closed');

    await openAs(page, 'admin', '/lab', { tenant: TENANT });
    await expect(page.getByRole('button', { name: 'Reiniciar datos' })).toBeEnabled();

    // Diálogo nativo: se cancela primero
    // (el click no termina hasta que se atiende el diálogo, así que el manejador se registra antes)
    const seen: { type: string; message: string }[] = [];
    page.once('dialog', (dialog) => {
      seen.push({ type: dialog.type(), message: dialog.message() });
      void dialog.dismiss();
    });
    await page.getByRole('button', { name: 'Reiniciar datos' }).click();
    expect(seen).toHaveLength(1);
    expect(seen[0]?.type).toBe('confirm');
    expect(seen[0]?.message).toContain('¿Reiniciar todos los datos del tenant');
    expect(await status()).toBe('closed');

    // …y luego se acepta
    page.once('dialog', (d) => void d.accept());
    await page.getByRole('button', { name: 'Reiniciar datos' }).click();
    await expect(page.getByTestId('toast-ok')).toContainText('Datos reiniciados');
    await expect(page.getByTestId('toast-ok')).toContainText(TENANT);
    expect(await status()).toBe('active');
  });

  test('modo caos desde la UI: se aplica y se apaga', async ({ page, request }) => {
    await openAs(page, 'admin', '/lab', { tenant: TENANT });
    await page.getByLabel('Tasa de errores 500 en escrituras (0–1)').fill('1');
    await page.getByRole('button', { name: 'Aplicar caos' }).click();
    await expect(page.getByTestId('toast-ok')).toContainText('Configuración de caos aplicada');

    const { accessToken } = await loginByApi(request, 'admin', TENANT);
    const auth = { Authorization: `Bearer ${accessToken}`, 'x-tenant': TENANT };
    const failed = await request.post(`${API_URL}/programs/PRG-002/duplicate`, { headers: auth });
    expect(failed.status()).toBe(500);

    await page.getByRole('button', { name: 'Desactivar caos' }).click();
    await expect(page.getByLabel('Tasa de errores 500 en escrituras (0–1)')).toHaveValue('0');
    const ok = await request.get(`${API_URL}/programs`, { headers: auth });
    expect(ok.ok()).toBe(true);
  });

  test('dentro del shell: el menú marca Lab como página actual', async ({ page }) => {
    await openAs(page, 'admin', '/lab', { tenant: TENANT });
    await expect(page.getByTestId('nav-lab')).toHaveAttribute('aria-current', 'page');
    await expect(page.getByTestId('layout-breadcrumbs')).toContainText('Lab');
  });
});
