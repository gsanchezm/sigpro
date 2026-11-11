import { expect, test, type Page, type Request } from '@playwright/test';
import { openAs, resetTenant } from '../support/auth';

// Spec de humo de la búsqueda global agrupada de la cabecera (catálogo de componentes): popover con grupos (programas,
// requisitos, casos de prueba, NC y documentos), debounce de 250 ms con petición al servidor, mínimo de 2 caracteres,
// máximo de 5 ítems por grupo, teclado y clic, documentos restringidos por rol y comportamiento de la fase 1 en
// `/programs` (filtra la tabla, sin popover). Tenant propio: alumno15.
// Seed: «disponibilidad» → 5 requisitos y 4 casos; «sistema» → 24 programas y 40 requisitos; PRG-005 = «Centro de control de misión CCM».

const TENANT = 'alumno15';
test.describe.configure({ mode: 'serial' });

test.beforeAll(async ({ request }) => {
  await resetTenant(request, TENANT);
});
test.afterAll(async ({ request }) => {
  await resetTenant(request, TENANT);
});

const searchbox = (page: Page) => page.getByRole('combobox', { name: 'Búsqueda global' });
const results = (page: Page) => page.getByTestId('global-search-results');
const status = (page: Page) => page.getByTestId('global-search-status');
const searchResponse = (page: Page, q: string) =>
  page.waitForResponse((response) => {
    const url = new URL(response.url());
    return url.pathname.endsWith('/api/search') && url.searchParams.get('q') === q;
  });
const trackSearches = (page: Page): string[] => {
  const queries: string[] = [];
  page.on('request', (request: Request) => {
    const url = new URL(request.url());
    if (url.pathname.endsWith('/api/search')) queries.push(url.searchParams.get('q') ?? '');
  });
  return queries;
};

test('mínimo de caracteres: con 1 solo avisa y no hay petición; con 2 ya busca', async ({ page }) => {
  await openAs(page, 'admin', '/nc', { tenant: TENANT });
  const queries = trackSearches(page);
  await searchbox(page).fill('c');
  await expect(results(page)).toBeVisible();
  await expect(status(page)).toHaveText('Escribe al menos 2 caracteres');
  await page.waitForTimeout(500); // más que el debounce: no debe salir ninguna petición
  expect(queries).toEqual([]);

  const answered = searchResponse(page, 'cc');
  await searchbox(page).fill('cc');
  await answered;
  await expect(results(page).getByRole('option').first()).toBeVisible();
});

test('resultados agrupados: espera el debounce, una sola petición, grupos con encabezado y recuento', async ({ page }) => {
  await openAs(page, 'admin', '/verification', { tenant: TENANT });
  const queries = trackSearches(page);
  const answered = searchResponse(page, 'disponibilidad');
  await searchbox(page).pressSequentially('disponibilidad', { delay: 35 });
  await answered;

  await expect(searchbox(page)).toHaveAttribute('aria-expanded', 'true');
  const listbox = results(page).getByRole('listbox', { name: 'Resultados de la búsqueda' });
  await expect(listbox).toBeVisible();
  await expect(listbox.getByRole('group')).toHaveCount(2);
  const requirements = listbox.getByRole('group', { name: /Requisitos/ });
  const testCases = listbox.getByRole('group', { name: /Casos de prueba/ });
  await expect(requirements.getByRole('option')).toHaveCount(5);
  await expect(testCases.getByRole('option')).toHaveCount(4);
  await expect(requirements.getByRole('option').first()).toContainText('REQ-001');
  await expect(requirements.getByRole('option').first()).toContainText('Disponibilidad del subsistema 001');
  await expect(testCases.getByRole('option').first()).toContainText('TC-001');
  await expect(status(page)).toHaveText('9 resultados en 2 grupos');
  // El debounce descarta las pulsaciones intermedias: una sola petición con el texto final
  expect(queries).toEqual(['disponibilidad']);
  // Orden fijo: requisitos antes que casos de prueba, y los grupos sin resultados no aparecen
  await expect(listbox.getByRole('group').first()).toContainText('Requisitos');
  await expect(listbox.getByRole('group', { name: /Programas|No conformidades|Documentos/ })).toHaveCount(0);
});

test('máximo de 5 ítems por grupo: el encabezado muestra «5 / total» y el resumen cuenta todo', async ({ page }) => {
  await openAs(page, 'admin', '/documents', { tenant: TENANT });
  const answered = searchResponse(page, 'sistema');
  await searchbox(page).fill('sistema');
  await answered;
  const programs = results(page).getByRole('group', { name: /Programas/ });
  await expect(programs.getByRole('option')).toHaveCount(5);
  await expect(page.getByTestId('global-search-group-total-program')).toHaveText('5 / 24');
  await expect(page.getByTestId('global-search-group-total-requirement')).toHaveText('5 / 40');
  await expect(programs.getByRole('option').last()).toContainText('PRG-005');
  await expect(status(page)).toHaveText('64 resultados en 2 grupos');
});

test('teclado: ↓ ↑ recorren los resultados a través de los grupos e Intro abre el resultado activo', async ({ page }) => {
  await openAs(page, 'admin', '/documents', { tenant: TENANT });
  const input = searchbox(page);
  const answered = searchResponse(page, 'disponibilidad');
  await input.fill('disponibilidad');
  await answered;
  const options = results(page).getByRole('option');
  await expect(options).toHaveCount(9);
  const activeId = () => input.getAttribute('aria-activedescendant');
  const idOf = (n: number) => options.nth(n).getAttribute('id');

  expect(await activeId()).toBe(await idOf(0));
  await expect(options.first()).toHaveAttribute('aria-selected', 'true');
  for (let i = 0; i < 5; i += 1) await input.press('ArrowDown'); // pasa del último requisito al primer caso de prueba
  expect(await activeId()).toBe(await idOf(5));
  await expect(options.nth(5)).toContainText('TC-001');
  await expect(options.nth(5)).toHaveAttribute('aria-selected', 'true');
  await input.press('ArrowUp');
  expect(await activeId()).toBe(await idOf(4));
  for (let i = 0; i < 12; i += 1) await input.press('ArrowDown'); // no se sale por abajo
  expect(await activeId()).toBe(await idOf(8));
  for (let i = 0; i < 4; i += 1) await input.press('ArrowUp');
  await input.press('ArrowDown');
  await input.press('ArrowDown'); // 8 − 4 + 2 = 6 → el segundo caso de prueba (TC-009)
  await expect(options.nth(6)).toContainText('TC-009');
  await input.press('Enter');

  await expect(page).toHaveURL(/\/verification\/TC-009$/);
  await expect(results(page)).toHaveCount(0);
  await expect(page.getByRole('combobox', { name: 'Búsqueda global' })).toHaveValue('');
});

test('clic en un resultado navega a su pantalla y cierra el popover', async ({ page }) => {
  await openAs(page, 'admin', '/audit', { tenant: TENANT });
  const answered = searchResponse(page, 'ccm');
  await searchbox(page).fill('ccm');
  await answered;
  const option = results(page).getByRole('option', { name: /PRG-005/ });
  await expect(option).toContainText('Centro de control de misión CCM');
  await option.click();
  await expect(page).toHaveURL(/\/programs\/PRG-005$/);
  await expect(results(page)).toHaveCount(0);

  // Un requisito enlaza a su árbol con el detalle abierto (misma ruta, otro `?select=`: también cierra)
  const requirement = searchResponse(page, 'REQ-017');
  await searchbox(page).fill('REQ-017');
  await requirement;
  await results(page).getByTestId('global-search-item-requirement-REQ-017').click();
  // El árbol consume `?select=` en cuanto carga la lista y lo quita de la URL (replace): en un equipo rápido esa URL
  // intermedia dura menos que un sondeo de Playwright. Se afirma el estado final, que sí es estable.
  await expect(page).toHaveURL(/\/programs\/PRG-002\/requirements(\?select=REQ-017)?$/);
  await expect(results(page)).toHaveCount(0);
  await expect(page.getByTestId('requirement-detail')).toBeVisible();
  await expect(page.getByTestId('requirement-code')).toHaveText('REQ-017');
});

test('Esc y salir del campo cierran el popover; ↓ lo reabre; cerrado no intercepta clics', async ({ page }) => {
  await openAs(page, 'admin', '/documents', { tenant: TENANT });
  const input = searchbox(page);
  const answered = searchResponse(page, 'ccm');
  await input.fill('ccm');
  await answered;
  await expect(results(page)).toBeVisible();

  await input.press('Escape');
  await expect(results(page)).toHaveCount(0);
  await expect(input).toHaveAttribute('aria-expanded', 'false');
  await input.press('ArrowDown');
  await expect(results(page).getByRole('option')).toHaveCount(1);

  // Sale del campo pulsando el borde izquierdo del título (el centro del h1, que ocupa todo el ancho, cae bajo el popover)
  await page.getByRole('heading', { name: 'Documentos', level: 1 }).click({ position: { x: 6, y: 6 } });
  await expect(results(page)).toHaveCount(0);
  // Con el popover cerrado los controles de la cabecera siguen siendo clicables (el tema cambia)
  await page.getByRole('button', { name: 'Cambiar tema' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.getByRole('button', { name: 'Cambiar tema' }).click();
});

test('sin resultados: aviso con el texto buscado y sin lista', async ({ page }) => {
  await openAs(page, 'admin', '/nc', { tenant: TENANT });
  const answered = searchResponse(page, 'zzzzz');
  await searchbox(page).fill('zzzzz');
  await answered;
  await expect(page.getByTestId('global-search-empty')).toHaveText('Sin resultados para «zzzzz»');
  await expect(page.getByRole('listbox')).toHaveCount(0);
  await expect(searchbox(page)).toHaveAttribute('aria-expanded', 'false');
  await searchbox(page).press('Enter'); // sin resultados no navega
  await expect(page).toHaveURL(/\/nc$/);
});

test('carga y error: «Buscando…» con aria-busy, 503 con aviso y recuperación al reescribir', async ({ page }) => {
  await openAs(page, 'admin', '/nc', { tenant: TENANT });
  await page.route(/\/api\/search\?q=radar/, async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 700));
    await route.continue();
  });
  await searchbox(page).fill('radar');
  await expect(page.getByTestId('global-search-loading')).toHaveText('Buscando…');
  await expect(searchbox(page)).toHaveAttribute('aria-busy', 'true');
  await expect(searchbox(page)).toHaveAttribute('aria-busy', 'false');
  await page.unroute(/\/api\/search\?q=radar/);

  await page.route(/\/api\/search\?q=fallo/, (route) => route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ statusCode: 503, error: 'Service Unavailable', message: 'down' }) }));
  await searchbox(page).fill('fallo');
  await expect(page.getByTestId('global-search-error')).toHaveText('No se pudo buscar');
  await expect(page.getByRole('listbox')).toHaveCount(0);
  await page.unroute(/\/api\/search\?q=fallo/);
  await searchbox(page).fill('ccm');
  await expect(results(page).getByRole('option')).toHaveCount(1);
});

test('documentos restringidos: el consultor no los ve (ni el recuento) y el admin sí', async ({ page }) => {
  await openAs(page, 'consultant', '/nc', { tenant: TENANT });
  let answered = searchResponse(page, 'especificación');
  await searchbox(page).fill('especificación');
  await answered;
  await expect(page.getByTestId('global-search-group-total-document')).toHaveText('4');
  await expect(results(page).getByRole('option')).toHaveCount(4);
  await expect(page.getByTestId('global-search-item-document-DOC-006')).toHaveCount(0);

  await openAs(page, 'admin', '/nc', { tenant: TENANT });
  answered = searchResponse(page, 'especificación');
  await searchbox(page).fill('especificación');
  await answered;
  await expect(page.getByTestId('global-search-group-total-document')).toHaveText('5 / 6');
  await expect(page.getByTestId('global-search-item-document-DOC-006')).toBeVisible(); // restringido
});

test('/programs sigue como en la fase 1: la búsqueda filtra la tabla (?q=) y no abre popover', async ({ page }) => {
  await openAs(page, 'admin', '/programs', { tenant: TENANT });
  const queries = trackSearches(page);
  await expect(page.getByRole('combobox', { name: 'Búsqueda global' })).toHaveCount(0);
  const box = page.getByRole('searchbox', { name: 'Búsqueda global' });
  const filtered = page.waitForResponse((response) => response.url().includes('/api/programs?') && response.url().includes('q=radar'));
  await box.fill('radar');
  await filtered;
  await expect(page.getByTestId('programs-count')).toHaveText('1–1 de 1');
  await expect(page.getByTestId('programs-row-PRG-002')).toBeVisible();
  await expect(page).toHaveURL(/\/programs\?q=radar$/);
  await expect(results(page)).toHaveCount(0);
  expect(queries).toEqual([]); // ninguna petición a /api/search

  // Al salir de /programs el campo se vacía y pasa a ser el combobox del popover
  await page.getByTestId('nav-nc').click();
  await expect(page.getByRole('combobox', { name: 'Búsqueda global' })).toHaveValue('');
  await expect(page.getByRole('searchbox', { name: 'Búsqueda global' })).toHaveCount(0);
});

test('móvil (390 px): el icono abre la búsqueda a todo el ancho y el popover cabe en pantalla', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openAs(page, 'admin', '/documents', { tenant: TENANT });
  await expect(page.getByRole('combobox', { name: 'Búsqueda global' })).toHaveCount(0); // cerrada: solo el icono
  await page.getByRole('button', { name: 'Búsqueda global' }).click();
  await expect(searchbox(page)).toBeFocused();
  await expect(page.getByRole('button', { name: 'Cambiar tema' })).toHaveCount(0); // la cabecera cede el sitio al campo

  const answered = searchResponse(page, 'ccm');
  await searchbox(page).fill('ccm');
  await answered;
  const box = await results(page).boundingBox();
  expect(box?.x).toBeGreaterThanOrEqual(0);
  expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(390);
  await results(page).getByRole('option', { name: /PRG-005/ }).click();
  await expect(page).toHaveURL(/\/programs\/PRG-005$/);
  // Tras navegar la cabecera vuelve a la normalidad y en /programs la página trae su propio buscador (sin icono)
  await expect(page.getByRole('button', { name: 'Cambiar tema' })).toBeVisible();
  await page.goto('/programs');
  await expect(page.getByTestId('layout-search-toggle')).toHaveCount(0);
});
