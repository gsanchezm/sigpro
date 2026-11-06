import { expect, test, type APIRequestContext, type Page } from '@playwright/test';
import { API_URL, loginByApi, openAs, resetTenant, type RoleName } from '../support/auth';

// Spec de humo de Auditoría (fase 2): feed con scroll infinito (role="feed", contenedor de altura fija, centinela con
// IntersectionObserver y cursor), filtros por entidad, fecha y texto, y permisos por rol. Tenant propio: alumno22.
// El seed trae 130 eventos (AL-001 … AL-130; el más reciente es AL-130).

const TENANT = 'alumno22';
test.describe.configure({ mode: 'serial' });

test.beforeAll(async ({ request }) => {
  await resetTenant(request, TENANT);
});

test.afterAll(async ({ request }) => {
  await resetTenant(request, TENANT);
});

interface AuditItem {
  id: string;
  at: string;
  actorName: string | null;
  action: string;
  entity: string;
  entityId: string;
}
interface AuditPage {
  items: AuditItem[];
  nextCursor: string | null;
  total: number;
}

const auditApi = async (request: APIRequestContext, query: string, role: RoleName = 'admin'): Promise<AuditPage> => {
  const { accessToken } = await loginByApi(request, role, TENANT);
  const response = await request.get(`${API_URL}/audit${query}`, { headers: { Authorization: `Bearer ${accessToken}`, 'x-tenant': TENANT } });
  expect(response.status()).toBe(200);
  return (await response.json()) as AuditPage;
};

const feed = (page: Page) => page.getByRole('feed', { name: 'Registro de auditoría' });
const articles = (page: Page) => feed(page).getByRole('article');
const count = (page: Page) => page.getByTestId('audit-count');
const ids = (page: Page) => articles(page).evaluateAll((items) => items.map((item) => item.getAttribute('data-testid')?.replace('audit-row-', '') ?? ''));

test('permisos: solo admin y auditor ven Auditoría (menú, ruta y API)', async ({ page, request }) => {
  for (const role of ['consultant', 'program_manager'] as const) {
    await openAs(page, role, '/programs', { tenant: TENANT });
    await expect(page.getByRole('complementary', { name: 'Navegación principal' }).getByRole('link', { name: 'Auditoría' })).toHaveCount(0);
    await page.goto('/audit');
    const forbidden = page.getByTestId('audit-forbidden');
    await expect(forbidden).toContainText('Tu rol no permite ver la auditoría');
    await expect(forbidden).toContainText('Solo admin y auditor pueden consultar el registro.');
    await expect(feed(page)).toHaveCount(0);
    const { accessToken } = await loginByApi(request, role, TENANT);
    expect((await request.get(`${API_URL}/audit`, { headers: { Authorization: `Bearer ${accessToken}`, 'x-tenant': TENANT } })).status()).toBe(403);
  }

  for (const role of ['admin', 'auditor'] as const) {
    await openAs(page, role, '/programs', { tenant: TENANT });
    await page.getByRole('complementary', { name: 'Navegación principal' }).getByRole('link', { name: 'Auditoría' }).click();
    await expect(page).toHaveURL(/\/audit$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Auditoría' })).toBeVisible();
    await expect(articles(page)).toHaveCount(20);
  }
});

test('primera página: 20 eventos de más reciente a más antiguo, con su posición y total en ARIA', async ({ page, request }) => {
  const first = await auditApi(request, '');
  await openAs(page, 'auditor', '/audit', { tenant: TENANT });
  await expect(articles(page)).toHaveCount(20);
  await expect(count(page)).toHaveText('Mostrando 20 de 130 eventos');
  await expect(ids(page)).resolves.toEqual(first.items.map((item) => item.id));
  await expect(page.getByTestId('audit-row-AL-130')).toBeVisible();

  // Orden temporal descendente
  const times = await feed(page).locator('time').evaluateAll((nodes) => nodes.map((node) => Date.parse(node.getAttribute('datetime') ?? '')));
  expect(times).toEqual([...times].sort((a, b) => b - a));

  // feed + article: posición y tamaño del conjunto
  await expect(articles(page).first()).toHaveAttribute('aria-posinset', '1');
  await expect(articles(page).first()).toHaveAttribute('aria-setsize', '130');
  await expect(articles(page).nth(19)).toHaveAttribute('aria-posinset', '20');

  // Cada fila: fecha, actor (avatar con alt), acción (texto y código), entidad y código, resumen
  const newest = page.getByTestId('audit-row-AL-130');
  const expected = first.items[0] as AuditItem;
  await expect(newest.locator('code')).toHaveText(expected.action);
  await expect(newest.getByAltText(expected.actorName ?? '')).toBeVisible();
  await expect(newest).toContainText(expected.entityId);
  await expect(newest).toHaveAttribute('data-entity', expected.entity);

  // El feed tiene altura fija y scroll propio (no carga todo de golpe aunque haya más eventos)
  const box = await feed(page).evaluate((element) => ({ client: element.clientHeight, scroll: element.scrollHeight }));
  expect(box.scroll).toBeGreaterThan(box.client);
  await page.waitForTimeout(600);
  await expect(articles(page)).toHaveCount(20);
});

test('scroll infinito: cada vez que el centinela entra en el contenedor llega la página siguiente hasta agotar los 130 eventos', async ({ page }) => {
  await openAs(page, 'admin', '/audit', { tenant: TENANT });
  await expect(articles(page)).toHaveCount(20);

  for (const expected of [40, 60, 80, 100, 120, 130]) {
    await articles(page).last().scrollIntoViewIfNeeded();
    await expect.poll(() => articles(page).count(), { message: `eventos cargados tras el scroll hasta ${expected}` }).toBe(expected);
    await expect(count(page)).toHaveText(`Mostrando ${expected} de 130 eventos`);
  }

  await expect(page.getByTestId('audit-end')).toHaveText('No hay más eventos');
  const all = await ids(page);
  expect(new Set(all).size).toBe(130); // sin duplicados
  expect(all[0]).toBe('AL-130');
  expect(all[129]).toBe('AL-001');
  await expect(articles(page).last()).toHaveAttribute('aria-posinset', '130');

  // Ya no hay más: seguir bajando no pide nada
  await feed(page).evaluate((element) => element.scrollTo({ top: element.scrollHeight }));
  await page.waitForTimeout(500);
  await expect(articles(page)).toHaveCount(130);
});

test('filtros: entidad, rango de fechas, texto y combinados; cambiar un filtro reinicia el feed', async ({ page, request }) => {
  const entityTotal = (await auditApi(request, '?entity=requirement&limit=1')).total;
  const search = await auditApi(request, '?q=state_changed&limit=100');
  const full = await auditApi(request, '?limit=100');
  const day = (full.items[60] as AuditItem).at.slice(0, 10);
  const dayItems = full.items.filter((item) => item.at.slice(0, 10) === day);
  expect(dayItems.length).toBeGreaterThan(5);

  await openAs(page, 'admin', '/audit', { tenant: TENANT });
  await expect(articles(page)).toHaveCount(20);

  // Tras desplazarse, cambiar un filtro vuelve a la primera página
  await articles(page).last().scrollIntoViewIfNeeded();
  await expect.poll(() => articles(page).count()).toBe(40);
  await page.getByLabel('Entidad').selectOption('requirement');
  await expect(count(page)).toHaveText(`Mostrando 20 de ${entityTotal} eventos`);
  expect(await feed(page).evaluate((element) => element.scrollTop)).toBe(0);
  await expect(articles(page)).toHaveCount(20);
  const entities = await articles(page).evaluateAll((items) => items.map((item) => item.getAttribute('data-entity')));
  expect(entities.every((entity) => entity === 'requirement')).toBe(true);

  await page.getByRole('button', { name: 'Limpiar filtros' }).click();
  await expect(count(page)).toHaveText('Mostrando 20 de 130 eventos');

  // Rango de fechas (date pickers: por teclado, con fill)
  await page.getByLabel('Desde').fill(day);
  await page.getByLabel('Hasta').fill(day);
  await expect(count(page)).toHaveText(`Mostrando ${Math.min(20, dayItems.length)} de ${dayItems.length} eventos`);
  await expect(page.getByTestId('audit-end')).toHaveCount(dayItems.length <= 20 ? 1 : 0);

  // Texto (debounce) sobre la acción: «state_changed»
  await page.getByLabel('Desde').fill('');
  await page.getByLabel('Hasta').fill('');
  await page.getByPlaceholder('Acción o código…').fill('state_changed');
  await expect(count(page)).toHaveText(`Mostrando ${Math.min(20, search.total)} de ${search.total} eventos`);
  await expect(articles(page).first()).toHaveAttribute('data-action', 'requirement.state_changed');

  // Combinado y vacío
  await page.getByLabel('Entidad').selectOption('document');
  await expect(page.getByTestId('audit-empty')).toContainText('Ningún evento coincide con los filtros aplicados.');
  await expect(count(page)).toHaveText('Mostrando 0 de 0 eventos');
  await page.getByRole('button', { name: 'Limpiar filtros' }).click();
  await expect(articles(page)).toHaveCount(20);
});

test('los cambios nuevos aparecen arriba del registro, con su actor', async ({ page, request }) => {
  const { accessToken } = await loginByApi(request, 'admin', TENANT);
  const created = await request.post(`${API_URL}/requirements`, {
    headers: { Authorization: `Bearer ${accessToken}`, 'x-tenant': TENANT },
    data: { programCode: 'PRG-001', title: 'Requisito creado para la auditoría' },
  });
  expect(created.status()).toBe(201);

  await openAs(page, 'admin', '/audit', { tenant: TENANT });
  await expect(count(page)).toHaveText('Mostrando 20 de 131 eventos');
  const newest = articles(page).first();
  await expect(newest).toHaveAttribute('data-action', 'requirement.created');
  await expect(newest).toContainText('Requisito creado');
  await expect(newest).toContainText('REQ-041');
  await expect(newest.getByAltText('Marta Ruiz')).toBeVisible();
  await expect(newest).toContainText('title: Requisito creado para la auditoría');
});

test('errores: carga lenta (skeleton + aria-busy), 503 con reintento y fallo al pedir la página siguiente con «Cargar más»', async ({ page }) => {
  await openAs(page, 'admin', '/programs', { tenant: TENANT });

  await page.route(/\/api\/audit(\?(?!.*cursor=).*)?$/, async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 1500));
    await route.continue().catch(() => undefined);
  });
  await page.goto('/audit');
  await expect(page.getByTestId('skeleton-row').first()).toBeVisible();
  await expect(feed(page)).toHaveAttribute('aria-busy', 'true');
  await expect(articles(page)).toHaveCount(20, { timeout: 8000 });
  await expect(feed(page)).toHaveAttribute('aria-busy', 'false');
  await page.unroute(/\/api\/audit(\?(?!.*cursor=).*)?$/);

  await page.route(/\/api\/audit(\?.*)?$/, (route) => route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ statusCode: 503, error: 'Service Unavailable', message: 'down' }) }));
  await page.goto('/audit');
  const alert = page.getByTestId('audit-error');
  await expect(alert).toContainText('No se pudo cargar la auditoría');
  await expect(alert).toContainText('503');
  await page.unroute(/\/api\/audit(\?.*)?$/);
  await alert.getByRole('button', { name: 'Reintentar' }).click();
  await expect(articles(page)).toHaveCount(20);

  // La página 2 falla: se conserva lo cargado, aparece el aviso con «Cargar más» y no se reintenta solo
  let failures = 0;
  await page.route(/\/api\/audit\?.*cursor=/, (route) => {
    failures += 1;
    return route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ statusCode: 500, error: 'Internal Server Error', message: 'boom' }) });
  });
  await articles(page).last().scrollIntoViewIfNeeded();
  const more = page.getByTestId('audit-load-more');
  await expect(more).toBeVisible();
  await expect(articles(page)).toHaveCount(20);
  await page.waitForTimeout(600);
  expect(failures).toBe(1);
  await page.unroute(/\/api\/audit\?.*cursor=/);
  await more.click();
  await expect(articles(page)).toHaveCount(40);
  await expect(more).toBeHidden();
});

test('móvil (390 px): el feed también carga más al desplazarse', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openAs(page, 'auditor', '/audit', { tenant: TENANT });
  await expect(articles(page)).toHaveCount(20);
  await articles(page).last().scrollIntoViewIfNeeded();
  await expect.poll(() => articles(page).count()).toBeGreaterThanOrEqual(40);
});
