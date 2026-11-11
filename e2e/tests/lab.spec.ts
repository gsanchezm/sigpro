import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { readZip } from '../../apps/web/scripts/zip.mjs';
import { chaosOff, setChaosByApi } from '../support/admin';
import { API_URL, loginByApi, openAs, resetTenant, seedStorage } from '../support/auth';

// Spec de humo de /lab: credenciales, tenants, reset con confirm() nativo, modo caos, endpoints de la API, contraejemplos
// (XPath frágil, pares que se solapan, textos que cambian con el caos), material del curso (zip) y FAQ.

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

  test('credenciales por rol: los cuatro roles, MFA del admin y el usuario personal del alumno', async ({ page }) => {
    for (const [role, password] of [['admin', 'Admin1234!'], ['program_manager', 'Gestor1234!'], ['consultant', 'Consul1234!'], ['auditor', 'Audit1234!']] as const) {
      await expect(page.getByTestId(`lab-credential-${role}`)).toContainText(password);
    }
    // alumno05 es el tenant activo: el usuario personal sale con su nombre
    await expect(page.getByTestId('lab-student-user')).toContainText('alumno05@sigpro.lab · Alumno1234!');
  });

  test('endpoints: tabla con método, ruta, acceso y descripción; enlaces a Swagger y al OpenAPI', async ({ page, request }) => {
    const section = page.getByRole('region', { name: 'Endpoints de la API' });
    await expect(section.getByRole('link', { name: 'Abrir Swagger UI' })).toHaveAttribute('href', '/api/docs');
    await expect(section.getByRole('link', { name: 'Descargar OpenAPI (JSON)' })).toHaveAttribute('href', '/api/docs-json');
    await expect(section.getByRole('link', { name: 'Abrir Swagger UI' })).toHaveAttribute('target', '_blank');

    const table = section.getByRole('table', { name: 'Endpoints de la API' });
    await expect(table.getByRole('columnheader')).toHaveText(['Método', 'Ruta', 'Acceso', 'Qué hace']);
    const reset = table.getByTestId('lab-endpoint-admin-reset');
    await expect(reset).toContainText('POST');
    await expect(reset).toContainText('/admin/reset');
    await expect(reset.locator('[data-access]')).toHaveAttribute('data-access', 'admin');
    await expect(table.getByTestId('lab-endpoint-health').locator('[data-access]')).toHaveText('Público');
    // filter({ has }): las filas cuyo acceso es «Público»
    await expect(table.getByRole('row').filter({ has: page.locator('[data-access="public"]') })).toHaveCount(5);

    // Cada fila de la lista existe de verdad en el OpenAPI de la API (la lista no puede mentir)
    const openapi = (await (await request.get(`${API_URL}/docs-json`)).json()) as { paths: Record<string, Record<string, unknown>> };
    const rows = await table.locator('tbody tr').evaluateAll((trs) =>
      trs.map((tr) => ({ method: tr.getAttribute('data-method') ?? '', path: tr.querySelectorAll('td')[1]?.textContent ?? '' })),
    );
    expect(rows.length).toBeGreaterThanOrEqual(20);
    for (const { method, path } of rows) {
      const documented = `/api${(path.split('?')[0] ?? '').replace(/:(\w+)/g, '{$1}')}`;
      expect(openapi.paths[documented]?.[method.toLowerCase()], `${method} ${path} → ${documented}`).toBeDefined();
    }
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
    const pair = page.getByRole('group', { name: 'Textos que se solapan a propósito' });
    await expect(pair.getByRole('button', { name: 'Guardar', exact: true })).toHaveCount(1);
    await expect(pair.getByRole('button', { name: 'Guardar' })).toHaveCount(2);
    await expect(pair.getByText('Activo', { exact: true })).toHaveCount(1);
    await expect(pair.getByText('Activo', { exact: false })).toHaveCount(2);
    await expect(page.locator('//tr[contains(., "PRG-004")]')).toHaveCount(1);
    // El contraejemplo explica por qué falla y cuál es la alternativa
    await expect(page.getByText("getByRole('row').filter({ hasText: 'PRG-004' })")).toBeVisible();
  });

  test('contraejemplo del caos sin sesión: el texto no cambia', async ({ page }) => {
    const group = page.getByRole('group', { name: 'Textos que cambian con el modo caos' });
    await expect(group.getByTestId('lab-flaky-state')).toHaveAttribute('data-state', 'off');
    await expect(group.getByRole('button', { name: 'Guardar', exact: true })).toBeVisible();
  });

  test('material del curso: enlace de descarga del zip', async ({ page }) => {
    const material = page.getByRole('region', { name: 'Material del curso' });
    const link = material.getByRole('link', { name: 'Descargar sigpro-examples.zip' });
    await expect(link).toHaveAttribute('href', '/downloads/sigpro-examples.zip');
    await expect(link).toHaveAttribute('download', 'sigpro-examples.zip');
    await expect(material.getByRole('listitem')).toHaveCount(3);

    const [download] = await Promise.all([page.waitForEvent('download'), link.click()]);
    expect(download.suggestedFilename()).toBe('sigpro-examples.zip');
    const entries = readZip(await readFile(await download.path()));
    const names = entries.map((entry) => entry.name);
    expect(names).toContain('sigpro-examples/package.json');
    expect(names).toContain('sigpro-examples/playwright.config.ts');
    expect(names).toContain('sigpro-examples/fixtures/index.ts');
    expect(names).toContain('sigpro-examples/pages/ProgramsPage.ts');
    expect(names.some((name) => name.includes('/node_modules/') || name.includes('/.auth/'))).toBe(false);
    // El workflow de la sesión 12 viaja con el proyecto, que en el repo del alumno queda en la raíz
    const workflow = entries.find((entry) => entry.name === 'sigpro-examples/.github/workflows/students-e2e.yml');
    expect(workflow?.data.toString('utf8')).toMatch(/PROJECT_DIR: \./);
  });

  test('FAQ ampliada: ocho preguntas y solo una abierta a la vez', async ({ page }) => {
    await expect(page.getByTestId(/^lab-faq-toggle-/)).toHaveCount(8);
    await page.getByRole('button', { name: '¿Qué código MFA uso?' }).click();
    await expect(page.getByRole('region', { name: '¿Qué código MFA uso?' })).toContainText('123456');
    await page.getByRole('button', { name: '¿Cómo descargo el proyecto de ejemplo?' }).click();
    await expect(page.getByRole('region', { name: '¿Qué código MFA uso?' })).toBeHidden();
    await expect(page.getByRole('region', { name: '¿Cómo descargo el proyecto de ejemplo?' })).toContainText('Material del curso');
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

  test('textos que cambian con el caos: con sesión el botón alterna entre «Guardar» y «Guardar cambios»', async ({ page, request }) => {
    try {
      await setChaosByApi(request, TENANT, { latencyMs: 0, errorRate: 0, flakyLabels: true });
      await openAs(page, 'admin', '/lab', { tenant: TENANT });
      const group = page.getByRole('group', { name: 'Textos que cambian con el modo caos' });
      await expect(group.getByTestId('lab-flaky-state')).toHaveAttribute('data-state', 'on');

      // El locator frágil (texto exacto) solo acierta una de las dos fases; el resiliente, siempre
      const resilient = group.getByRole('button', { name: /^Guardar( cambios)?$/ });
      await expect(resilient).toHaveCount(1);
      await expect(group.getByRole('button', { name: 'Guardar cambios', exact: true })).toBeVisible({ timeout: 6000 });
      await expect(group.getByRole('button', { name: 'Guardar', exact: true })).toBeVisible({ timeout: 6000 });
      await expect(resilient).toBeVisible();
    } finally {
      await chaosOff(request, TENANT);
    }
  });

  test('dentro del shell: el menú marca Lab como página actual', async ({ page }) => {
    await openAs(page, 'admin', '/lab', { tenant: TENANT });
    await expect(page.getByTestId('nav-lab')).toHaveAttribute('aria-current', 'page');
    await expect(page.getByTestId('layout-breadcrumbs')).toContainText('Lab');
  });
});
