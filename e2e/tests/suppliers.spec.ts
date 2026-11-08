import { expect, test, type Page, type Request } from '@playwright/test';
import { openAs, resetTenant } from '../support/auth';

// Spec de humo de Proveedores (catálogo de componentes): sección «Proveedores» en el Resumen del programa con la lista de
// contratados y el combobox ARIA con autocompletar «Buscar proveedor…» (debounce de 250 ms, petición al servidor, máximo
// 5 opciones, teclado y ratón, vacío, carga y error). Tenant propio: alumno16.
// Seed: 6 proveedores y 2 contratos cada uno (s1: PRG-001/002 … s6: PRG-011/012); Cibertáctica Norte (s5) no está aprobado.
// Orden por nombre: Aeronáutica Levante, Cibertáctica Norte, Electrónica del Cantábrico, Logística Marítima Atlas,
// Optrónica Meseta, Sistemas Ibéricos.

const TENANT = 'alumno16';
test.describe.configure({ mode: 'serial' });

test.beforeAll(async ({ request }) => {
  await resetTenant(request, TENANT);
});
test.afterAll(async ({ request }) => {
  await resetTenant(request, TENANT);
});

const combobox = (page: Page) => page.getByRole('combobox', { name: 'Proveedor del tenant' });
const status = (page: Page) => page.getByTestId('supplier-search-status');
const options = (page: Page) => page.getByRole('listbox', { name: 'Proveedores encontrados' }).getByRole('option');
/** Respuesta de la búsqueda del combobox (la de la tabla de contratados lleva `program=`). */
const searchResponse = (page: Page, q?: string) =>
  page.waitForResponse((response) => {
    const url = new URL(response.url());
    return url.pathname.endsWith('/api/suppliers') && !url.searchParams.has('program') && (q === undefined || (url.searchParams.get('q') ?? '') === q);
  });

const openSummary = async (page: Page, code = 'PRG-001', role: 'admin' | 'consultant' | 'auditor' = 'admin') => {
  await openAs(page, role, `/programs/${code}`, { tenant: TENANT });
  await expect(page.getByTestId('suppliers-panel')).toBeVisible();
};

test('contratados: PRG-001 lista a Aeronáutica Levante con su NIF, importe y badge «Aprobado»', async ({ page }) => {
  await openSummary(page);
  const table = page.getByRole('table', { name: 'Contratados en este programa' });
  await expect(page.getByTestId('suppliers-count')).toHaveText('1 proveedor contratado');
  await expect(table.getByRole('row')).toHaveCount(2); // cabecera + 1
  const row = table.getByRole('row').filter({ hasText: 'Aeronáutica Levante S.L.' });
  await expect(row).toContainText('B11111111');
  await expect(row).toContainText(/150\.000/);
  await expect(row.getByTestId('supplier-badge-s1')).toHaveText('Aprobado');
  await expect(row.getByTestId('supplier-badge-s1')).toHaveAttribute('data-state', 'approved');
});

test('contratados: un proveedor no aprobado lleva el badge «No aprobado» (CSS por data-state)', async ({ page }) => {
  await openSummary(page, 'PRG-009');
  await expect(page.locator('tr[data-state="not_approved"]')).toHaveCount(1);
  await expect(page.getByTestId('supplier-row-s5')).toContainText('Cibertáctica Norte');
  await expect(page.getByTestId('supplier-badge-s5')).toHaveText('No aprobado');
});

test('contratados: un programa sin contratos muestra el estado vacío', async ({ page }) => {
  await openSummary(page, 'PRG-013');
  await expect(page.getByTestId('suppliers-empty')).toHaveText('Este programa no tiene proveedores contratados.');
  await expect(page.getByRole('table', { name: 'Contratados en este programa' })).toHaveCount(0);
});

test('contratados: error 503 con traza y reintento', async ({ page }) => {
  let failing = true;
  await page.route(/\/api\/suppliers\?program=PRG-001/, (route) => (failing ? route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ statusCode: 503, error: 'Service Unavailable', message: 'down' }) }) : route.continue()));
  await openAs(page, 'admin', '/programs/PRG-001', { tenant: TENANT });
  const alert = page.getByRole('alert').filter({ hasText: 'No se pudieron cargar los proveedores' });
  await expect(alert).toBeVisible();
  await expect(alert).toContainText('GET /api/suppliers → 503');
  failing = false;
  await page.getByRole('button', { name: 'Reintentar' }).click();
  await expect(alert).toBeHidden();
  await expect(page.getByTestId('supplier-row-s1')).toBeVisible();
});

test('combobox: al enfocar pide todos al servidor, enseña como mucho 5 y avisa de que hay más', async ({ page }) => {
  await openSummary(page);
  const input = combobox(page);
  await expect(input).toHaveAttribute('aria-expanded', 'false');
  await expect(page.getByRole('listbox')).toHaveCount(0);

  const answered = searchResponse(page, '');
  await input.click();
  await answered;
  await expect(input).toHaveAttribute('aria-expanded', 'true');
  await expect(options(page)).toHaveCount(5);
  await expect(options(page).first()).toContainText('Aeronáutica Levante S.L.');
  await expect(options(page).nth(1)).toContainText('Cibertáctica Norte');
  await expect(options(page).last()).toContainText('Optrónica Meseta S.L.');
  await expect(status(page)).toHaveText('6 proveedores encontrados · 1 más: afina la búsqueda');
  // La opción 6 (Sistemas Ibéricos) no está: solo aparece afinando la búsqueda
  await expect(page.getByTestId('supplier-option-s2')).toHaveCount(0);
  const listbox = page.getByRole('listbox', { name: 'Proveedores encontrados' });
  await expect(input).toHaveAttribute('aria-controls', (await listbox.getAttribute('id')) ?? '');
  await expect(input).toHaveAttribute('placeholder', 'Buscar proveedor…');
  await expect(page.getByPlaceholder('Buscar proveedor…')).toBeVisible();
});

test('combobox: escribir espera 250 ms (una sola petición con el texto final) y filtra en el servidor', async ({ page }) => {
  await openSummary(page);
  const queries: string[] = [];
  page.on('request', (request: Request) => {
    const url = new URL(request.url());
    if (url.pathname.endsWith('/api/suppliers') && !url.searchParams.has('program')) queries.push(url.searchParams.get('q') ?? '');
  });
  const input = combobox(page);
  await input.click();
  await expect(options(page)).toHaveCount(5);

  const answered = searchResponse(page, 'ibér');
  await input.pressSequentially('ibér', { delay: 40 });
  await answered;
  await expect(options(page)).toHaveCount(1);
  await expect(options(page).first()).toContainText('Sistemas Ibéricos S.A.');
  await expect(options(page).first()).toContainText('B12222222');
  await expect(status(page)).toHaveText('1 proveedor encontrado');
  // El debounce descarta «i», «ib» e «ibé»: solo el vacío del foco y el texto final
  expect(queries).toEqual(['', 'ibér']);
});

test('combobox: también busca por NIF sin distinguir mayúsculas', async ({ page }) => {
  await openSummary(page);
  const answered = searchResponse(page, 'B1666');
  await combobox(page).fill('B1666');
  await answered;
  await expect(options(page)).toHaveCount(1);
  await expect(options(page).first()).toContainText('Logística Marítima Atlas');
});

test('teclado: ↓ ↑ mueven la opción activa (aria-activedescendant) e Intro elige y muestra la ficha', async ({ page }) => {
  await openSummary(page);
  const input = combobox(page);
  await input.click();
  await expect(options(page)).toHaveCount(5);
  const activeId = async () => input.getAttribute('aria-activedescendant');
  const idOf = async (n: number) => options(page).nth(n).getAttribute('id');

  expect(await activeId()).toBe(await idOf(0)); // la primera opción nace activa
  await input.press('ArrowDown');
  await input.press('ArrowDown');
  expect(await activeId()).toBe(await idOf(2));
  await input.press('ArrowUp');
  expect(await activeId()).toBe(await idOf(1));
  await input.press('ArrowUp');
  await input.press('ArrowUp'); // no se sale por arriba
  expect(await activeId()).toBe(await idOf(0));
  for (let i = 0; i < 8; i += 1) await input.press('ArrowDown'); // ni por abajo
  expect(await activeId()).toBe(await idOf(4));

  await input.press('ArrowUp'); // opción 3 → Logística Marítima Atlas
  await input.press('ArrowUp'); // opción 2 → Electrónica del Cantábrico
  await input.press('ArrowUp'); // opción 1 → Cibertáctica Norte
  await input.press('Enter');
  await expect(input).toHaveValue('Cibertáctica Norte');
  await expect(page.getByRole('listbox')).toHaveCount(0);

  const detail = page.getByRole('article', { name: /Ficha de proveedor/ });
  await expect(detail).toBeVisible();
  await expect(detail.getByTestId('supplier-detail-nif')).toHaveText('B15555555');
  await expect(detail.getByTestId('supplier-detail-email')).toHaveText('contacto@proveedor5.example');
  await expect(detail.getByTestId('supplier-detail-badge')).toHaveText('No aprobado');
  await expect(detail.getByTestId('supplier-detail-badge')).toHaveAttribute('data-state', 'not_approved');
  const contracts = detail.getByRole('listitem');
  await expect(contracts).toHaveCount(2);
  await expect(contracts.first()).toContainText('PRG-009');
  await expect(contracts.first()).toContainText(/350\.000/);
  await expect(contracts.first()).toContainText('Firmado el 15/05/2025');
  await expect(contracts.last()).toContainText('PRG-010');
});

test('ratón: elegir una opción con clic, abrir el programa desde la ficha y quitar la selección', async ({ page }) => {
  await openSummary(page);
  const input = combobox(page);
  const answered = searchResponse(page, 'logís');
  await input.fill('logís');
  await answered;
  await page.getByRole('option', { name: /Logística Marítima Atlas/ }).click();
  await expect(input).toHaveValue('Logística Marítima Atlas');
  const detail = page.getByTestId('supplier-detail');
  await expect(detail).toContainText('B16666666');
  await expect(detail.getByTestId('supplier-contract-PRG-011')).toContainText('400.000');

  // El enlace del contrato lleva al programa
  await detail.getByRole('link', { name: 'PRG-012' }).click();
  await expect(page).toHaveURL(/\/programs\/PRG-012$/);
  await expect(page.getByTestId('supplier-row-s6')).toBeVisible();

  // Quitar la selección: la ficha desaparece y el campo vuelve a escribirse
  await combobox(page).fill('mar');
  await page.getByRole('option', { name: /Logística/ }).click();
  await page.getByRole('button', { name: 'Quitar proveedor seleccionado' }).click();
  await expect(page.getByTestId('supplier-detail')).toHaveCount(0);
  await expect(combobox(page)).toHaveValue('');
});

test('Esc cierra la lista sin elegir y ↓ la vuelve a abrir; salir del campo también la cierra', async ({ page }) => {
  await openSummary(page);
  const input = combobox(page);
  await input.click();
  await expect(options(page)).toHaveCount(5);
  await input.press('Escape');
  await expect(page.getByRole('listbox')).toHaveCount(0);
  await expect(input).toHaveAttribute('aria-expanded', 'false');
  await expect(page.getByTestId('supplier-detail')).toHaveCount(0);
  await input.press('ArrowDown');
  await expect(options(page)).toHaveCount(5);
  await page.getByRole('heading', { name: 'Proveedores', level: 3 }).click();
  await expect(page.getByRole('listbox')).toHaveCount(0);
});

test('sin coincidencias: aviso «Sin coincidencias» y sin lista de opciones', async ({ page }) => {
  await openSummary(page);
  const input = combobox(page);
  const answered = searchResponse(page, 'zzzzz');
  await input.fill('zzzzz');
  await answered;
  await expect(status(page)).toHaveText('Sin coincidencias');
  await expect(page.getByRole('listbox')).toHaveCount(0);
  await expect(input).toHaveAttribute('aria-expanded', 'false');
  // Intro sin opciones no elige nada
  await input.press('Enter');
  await expect(page.getByTestId('supplier-detail')).toHaveCount(0);
});

test('carga y error: «Buscando proveedores…» con aria-busy, 503 con aviso y recuperación al reescribir', async ({ page }) => {
  await openSummary(page);
  const input = combobox(page);
  await page.route(/\/api\/suppliers\?q=lev/, async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 700));
    await route.continue();
  });
  await input.fill('lev');
  await expect(status(page)).toHaveText('Buscando proveedores…');
  await expect(input).toHaveAttribute('aria-busy', 'true');
  await expect(options(page)).toHaveCount(1);
  await expect(input).toHaveAttribute('aria-busy', 'false');
  await page.unroute(/\/api\/suppliers\?q=lev/);

  await page.route(/\/api\/suppliers\?q=fall/, (route) => route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ statusCode: 503, error: 'Service Unavailable', message: 'down' }) }));
  await input.fill('fall');
  await expect(status(page)).toHaveText('No se pudo buscar proveedores');
  await expect(page.getByRole('listbox')).toHaveCount(0);
  await page.unroute(/\/api\/suppliers\?q=fall/);
  await input.fill('norte');
  await expect(options(page)).toHaveCount(1);
});

test('permisos: consultor y auditor ven la sección y buscan igual (solo lectura)', async ({ page }) => {
  for (const role of ['consultant', 'auditor'] as const) {
    await openSummary(page, 'PRG-003', role);
    await expect(page.getByTestId('supplier-row-s2')).toContainText('Sistemas Ibéricos S.A.');
    const answered = searchResponse(page, 'atlas');
    await combobox(page).fill('atlas');
    await answered;
    await expect(options(page)).toHaveCount(1);
  }
});
