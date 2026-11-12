import { expect, test, type Page } from '@playwright/test';
import { API_URL, openAs, resetTenant } from '../support/auth';
import { authHeaders } from '../support/admin';

// Rediseño «1a Ciruela», fase 3 — Programas: tarjetas de métricas, filtros como chips (el control nativo con forma de chip),
// panel lateral de detalle y densidad. Tenant: alumno21 (solo lectura; se reinicia antes y después).

const TENANT = 'alumno21';
test.describe.configure({ mode: 'serial' });
test.beforeAll(async ({ request }) => resetTenant(request, TENANT));
test.afterAll(async ({ request }) => resetTenant(request, TENANT));

const open = (page: Page, path = '/programs') => openAs(page, 'admin', path, { tenant: TENANT });
const row = (page: Page, code: string) => page.getByTestId(`programs-row-${code}`);
/** Clic en la celda del nombre: un clic en la fila, no en un control (enlace, casilla, menú). */
const clickRow = (page: Page, code: string) => row(page, code).getByRole('cell').nth(2).click();

test.describe('tarjetas de métricas', () => {
  test('cuatro tarjetas con las cifras del tenant, independientes de los filtros', async ({ page, request }) => {
    const headers = await authHeaders(request, 'admin', TENANT);
    const list = (await (await request.get(`${API_URL}/programs?pageSize=100`, { headers })).json()) as { items: { progress: number }[]; totalAll: number };
    const average = Math.round(list.items.reduce((sum, program) => sum + program.progress, 0) / list.items.length);

    await open(page);
    const metrics = page.getByTestId('programs-metrics');
    await expect(metrics.getByRole('group')).toHaveCount(4);
    await expect(page.getByTestId('programs-metric-total')).toContainText(String(list.totalAll));
    await expect(page.getByTestId('programs-metric-total')).toContainText('activos: 12');
    // La tarjeta no debe repetir «12 activo»: el spec de cobertura de locators localiza el resumen de la tabla por ese texto
    await expect(page.getByText('12 activo', { exact: false })).toHaveCount(1);
    await expect(page.getByTestId('programs-metric-active')).toContainText('50 % del total');
    await expect(page.getByTestId('programs-metric-progress')).toContainText(`${average} %`);
    await expect(page.getByTestId('programs-metric-nc')).toContainText(/\d+\s*de \d+ registradas/);

    // La barra de progreso de la tarjeta de avance cumple la regla de testabilidad: title y aria-valuenow
    const bar = page.getByTestId('programs-metric-progress').getByRole('progressbar');
    await expect(bar).toHaveAttribute('aria-valuenow', String(average));
    await expect(bar).toHaveAttribute('title', `${average} %`);

    // Filtrar la tabla no cambia las cifras
    await page.getByLabel('Estado').selectOption('closed');
    await expect(page.getByTestId('programs-count')).toContainText('1–3 de 3');
    await expect(page.getByTestId('programs-metric-total')).toContainText(String(list.totalAll));
  });

  test('si el resumen falla, las tarjetas muestran «—» y la tabla sigue funcionando', async ({ page }) => {
    await page.route('**/api/mission/summary', (route) => route.fulfill({ status: 503, contentType: 'application/json', body: '{"statusCode":503,"message":"x"}' }));
    await open(page);
    await expect(page.getByTestId('programs-metric-total')).toContainText('—');
    await expect(page.getByTestId('programs-count')).toContainText('1–10 de 24');
  });
});

test.describe('filtros como chips', () => {
  test('el chip de estado vacío es «+ Estado»; al elegir un valor se activa y su «×» lo quita', async ({ page }) => {
    await open(page);
    const status = page.getByLabel('Estado');
    await expect(status).toHaveValue('');
    await expect(status.locator('option:checked')).toHaveText('+ Estado');
    const chip = page.locator('.chip').filter({ has: status });
    await expect(chip).toHaveAttribute('data-active', 'false');

    await status.selectOption('on_hold');
    await expect(chip).toHaveAttribute('data-active', 'true');
    await expect(page.getByTestId('programs-count')).toContainText('de 3');
    // El «×» nombra el valor, no la etiqueta: getByLabel('Estado') sigue siendo único
    await expect(page.getByLabel('Estado')).toHaveCount(1);
    await page.getByRole('button', { name: 'Quitar «En pausa»' }).click();
    await expect(status).toHaveValue('');
    await expect(chip).toHaveAttribute('data-active', 'false');
    await expect(page.getByTestId('programs-count')).toContainText('de 24');
  });

  test('los chips de fecha se rellenan con fill() aunque estén vacíos y se quitan con su «×»', async ({ page }) => {
    await open(page);
    await page.getByLabel('Inicio desde').fill('2025-01-01');
    await page.getByLabel('Fin hasta').fill('2027-12-31');
    await expect(page.getByTestId('programs-filters-clear')).toBeVisible();
    await expect(page.getByTestId('programs-filter-date-from')).toHaveValue('2025-01-01');
    await page.getByTestId('programs-filter-date-from-clear').click();
    await expect(page.getByTestId('programs-filter-date-from')).toHaveValue('');
    await expect(page.getByTestId('programs-filter-date-to')).toHaveValue('2027-12-31');
    await page.getByTestId('programs-filters-clear').click();
    await expect(page.getByTestId('programs-filter-date-to')).toHaveValue('');
  });

  test('el chip de responsable es el combobox ARIA de siempre (placeholder «+ Responsable»)', async ({ page }) => {
    await open(page);
    const owner = page.getByRole('combobox', { name: 'Responsable' });
    await expect(owner).toHaveAttribute('placeholder', '+ Responsable');
    await owner.click();
    await page.getByTestId('programs-filter-owner-option-u2').click();
    await expect(owner).toHaveValue('Javier Ortega');
    await expect(page.locator('.chip').filter({ has: owner })).toHaveAttribute('data-active', 'true');
  });
});

test.describe('panel lateral de detalle', () => {
  test('un clic en la fila lo abre con los datos de la fila y la resalta; × y Esc lo cierran', async ({ page }) => {
    await open(page);
    await expect(page.getByTestId('programs-panel')).toHaveCount(0);

    await clickRow(page, 'PRG-004');
    const panel = page.getByRole('complementary', { name: 'Detalle de PRG-004' });
    await expect(panel).toBeVisible();
    await expect(page.getByTestId('programs-panel-code')).toHaveText('PRG-004');
    await expect(page.getByTestId('programs-panel-name')).toHaveText('Plataforma UAV Cóndor');
    await expect(page.getByTestId('programs-panel-status')).toHaveAttribute('data-state', 'on_hold');
    await expect(page.getByTestId('programs-panel-owner')).toContainText('Andrés Molina');
    await expect(page.getByTestId('programs-panel-budget')).toContainText('4.335.000');
    await expect(panel.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '22');
    await expect(row(page, 'PRG-004')).toHaveAttribute('data-open', 'true');

    // Dentro de la rejilla (no modal): la tabla sigue operativa y el panel mide 380 px
    expect((await panel.boundingBox())?.width).toBe(380);

    await clickRow(page, 'PRG-001');
    await page.getByTestId('programs-panel-close').click();
    await expect(page.getByTestId('programs-panel')).toHaveCount(0);

    await clickRow(page, 'PRG-002');
    await expect(page.getByTestId('programs-panel-code')).toHaveText('PRG-002');
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('programs-panel')).toHaveCount(0);

    // Cambiar el orden (o de página o de filtro) cierra el panel: la fila abierta puede dejar de estar a la vista
    await clickRow(page, 'PRG-003');
    await expect(page.getByTestId('programs-panel')).toBeVisible();
    await page.getByTestId('programs-sort-name').click();
    await expect(page.getByTestId('programs-panel')).toHaveCount(0);
  });

  test('los controles de la fila no abren el panel: enlace, casilla y menú ⋯', async ({ page }) => {
    await open(page);
    await page.getByTestId('programs-select-PRG-003').check();
    await page.getByTestId('programs-row-menu-PRG-003').click();
    await expect(page.getByTestId('programs-row-menu-edit')).toBeVisible();
    await expect(page.getByTestId('programs-panel')).toHaveCount(0);
    // Esc con el menú abierto cierra el menú, no un panel que no existe; el menú no deja panel tras cerrarse
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('programs-panel')).toHaveCount(0);

    await page.getByTestId('programs-link-PRG-003').click();
    await expect(page).toHaveURL(/\/programs\/PRG-003$/);
  });

  test('«Abrir ficha completa» lleva a la página de detalle del programa', async ({ page }) => {
    await open(page);
    await clickRow(page, 'PRG-005');
    await page.getByTestId('programs-panel-open-full').click();
    await expect(page).toHaveURL(/\/programs\/PRG-005$/);
  });

  test('Esc cierra antes el menú de usuario de la cabecera (que no detiene el Esc) y el panel sigue abierto', async ({ page }) => {
    await open(page);
    await clickRow(page, 'PRG-006');
    await page.getByTestId('layout-user-menu').click();
    await expect(page.getByTestId('layout-user-menu-popover')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('layout-user-menu-popover')).toHaveCount(0);
    await expect(page.getByTestId('programs-panel-code')).toHaveText('PRG-006');
    // un segundo Esc, ya sin menú, sí cierra el panel
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('programs-panel')).toHaveCount(0);
  });

  test('con el panel abierto el menú ⋯ de otra fila se abre y sigue abierto (la tabla no desborda)', async ({ page }) => {
    await open(page);
    await clickRow(page, 'PRG-006');
    await page.getByTestId('programs-row-menu-PRG-007').click();
    await expect(page.getByTestId('programs-row-menu-edit')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('programs-row-menu-edit')).toHaveCount(0);
    await expect(page.getByTestId('programs-panel-code')).toHaveText('PRG-006');
  });

  test('por debajo de 1024 px el panel es un drawer a ancho completo', async ({ page }) => {
    await page.setViewportSize({ width: 900, height: 800 });
    await open(page);
    await clickRow(page, 'PRG-004');
    const box = await page.getByTestId('programs-panel').boundingBox();
    expect(box?.x).toBe(0);
    expect(box?.width).toBe(900);
    await page.getByTestId('programs-panel-close').click();
    await expect(page.getByTestId('programs-panel')).toHaveCount(0);
  });
});

test('densidad: data-density="media" compacta la fila (48 → 38 px)', async ({ page }) => {
  await open(page);
  const height = async () => (await row(page, 'PRG-001').boundingBox())?.height;
  expect(await height()).toBeGreaterThanOrEqual(48);
  await page.evaluate(() => document.documentElement.setAttribute('data-density', 'media'));
  await expect.poll(height).toBeLessThanOrEqual(40);
});
