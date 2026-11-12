import { expect, test, type APIRequestContext, type Page, type Route } from '@playwright/test';
import { API_URL, openAs, resetTenant, seedStorage, type RoleName } from '../../support/auth';
import { authHeaders, chaosOff, readConfig } from '../../support/admin';

// Auditoría y Administración en el móvil (paridad funcional con la web): el feed con filtros y carga continua, las fechas
// escritas a mano con su validación, los permisos por rol, los usuarios (rol y activo, con la regla del último admin), el modo
// caos y el reinicio de los datos del tenant con un diálogo de la app (la web usa confirm()). Mismos textos, ids y reglas que
// `audit.spec.ts` y `admin.spec.ts` de la web. Tenant propio (alumno24), restaurado antes de cada prueba y al terminar, y con el
// caos apagado: el caos sobrevive al reinicio. Locators por rol y nombre primero; el `testID` (que React Native Web pinta como
// `data-testid`) como respaldo, p. ej. en los interruptores, cuyo nodo con `role=switch` repite el nombre en un input interno.

const TENANT = 'alumno24';
test.describe.configure({ mode: 'serial' });

test.beforeAll(async ({ request }) => {
  await chaosOff(request, TENANT);
});

test.beforeEach(async ({ request }) => {
  await resetTenant(request, TENANT);
});

test.afterAll(async ({ request }) => {
  await chaosOff(request, TENANT);
  await resetTenant(request, TENANT);
});

const open = async (page: Page, role: RoleName, path: string) => {
  await openAs(page, role, path, { tenant: TENANT });
};
const tab = (page: Page, name: string) => page.getByRole('tab', { name, exact: true });
const dialog = (page: Page, name: string) => page.getByRole('dialog', { name, exact: true });
const toast = (page: Page, tone: 'ok' | 'info' | 'danger', text: string) => page.getByTestId(`toast-${tone}`).filter({ hasText: text });
const noHorizontalOverflow = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);

const failWith = (status: number, error: string, body: Record<string, unknown> = {}) => (route: Route) =>
  route.fulfill({ status, contentType: 'application/json', body: JSON.stringify({ statusCode: status, error, message: error.toLowerCase(), ...body }) });

/** Elige una opción de un selector (`combobox` → hoja con opciones `radio`). */
const choose = async (page: Page, field: string, option: string) => {
  await page.getByRole('combobox', { name: field, exact: true }).click();
  await dialog(page, field).getByRole('radio', { name: option, exact: true }).click();
  await expect(dialog(page, field)).toBeHidden();
};

// --- Auditoría -------------------------------------------------------------------------------------------------------

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
  const response = await request.get(`${API_URL}/audit${query}`, { headers: await authHeaders(request, role, TENANT) });
  expect(response.status()).toBe(200);
  return (await response.json()) as AuditPage;
};

const feed = (page: Page) => page.getByRole('feed', { name: 'Registro de auditoría' });
const articles = (page: Page) => feed(page).getByRole('article');
const count = (page: Page) => page.getByTestId('audit-count');
const shown = (n: number, total: number) => `Mostrando ${n} de ${total} eventos`;
const ids = (page: Page) => articles(page).evaluateAll((items) => items.map((item) => item.getAttribute('data-testid')?.replace('audit-row-', '') ?? ''));

test.describe('Móvil · Auditoría', () => {
  test('permisos: solo admin y auditor la ven (menú «Más», ruta directa y API); los demás, el aviso y sin pedir nada', async ({ page, request }) => {
    const audits: string[] = [];
    page.on('request', (call) => call.url().includes('/api/audit') && audits.push(call.url()));

    for (const role of ['consultant', 'program_manager'] as const) {
      await open(page, role, '/programs');
      await tab(page, 'Más').click();
      await expect(page.getByTestId('more-item-documents')).toBeVisible();
      await expect(page.getByTestId('more-item-audit')).toHaveCount(0);

      await page.goto('/audit');
      const forbidden = page.getByTestId('audit-forbidden');
      await expect(forbidden).toContainText('Tu rol no permite ver la auditoría');
      await expect(forbidden).toContainText('Solo admin y auditor pueden consultar el registro.');
      await expect(page.getByTestId('audit-page')).toHaveCount(0);
      await expect(feed(page)).toHaveCount(0);
      expect(audits).toEqual([]); // sin permiso ni se monta el feed: no hay petición

      const response = await request.get(`${API_URL}/audit`, { headers: await authHeaders(request, role, TENANT) });
      expect(response.status()).toBe(403);

      await page.getByRole('link', { name: 'Volver a Programas', exact: true }).click();
      await expect(page).toHaveURL(/\/programs$/);
    }

    for (const role of ['admin', 'auditor'] as const) {
      await open(page, role, '/programs');
      await tab(page, 'Más').click();
      await page.getByRole('link', { name: 'Auditoría', exact: true }).click();
      await expect(page).toHaveURL(/\/audit$/);
      await expect(page.getByRole('heading', { level: 1, name: 'Auditoría' })).toBeVisible();
      await expect(page.getByTestId('audit-forbidden')).toHaveCount(0);
      await expect(articles(page)).toHaveCount(20);
    }
  });

  test('primera página: 20 eventos de más reciente a más antiguo, con su posición y el total en ARIA', async ({ page, request }) => {
    const first = await auditApi(request, '');
    await open(page, 'auditor', '/audit');
    await expect(articles(page)).toHaveCount(20);
    await expect(count(page)).toHaveText(shown(20, first.total));
    await expect(ids(page)).resolves.toEqual(first.items.map((item) => item.id));
    await expect(page.getByTestId('audit-row-AL-130')).toBeVisible();
    await expect(page.getByTestId('audit-load-more')).toBeVisible(); // quedan más: el botón es el respaldo de la carga continua
    await expect(page.getByTestId('audit-end')).toHaveCount(0);
    expect(await noHorizontalOverflow(page)).toBe(true);

    await expect(articles(page).first()).toHaveAttribute('aria-posinset', '1');
    await expect(articles(page).first()).toHaveAttribute('aria-setsize', String(first.total));
    await expect(articles(page).nth(19)).toHaveAttribute('aria-posinset', '20');

    // Cada fila: fecha, actor (avatar con nombre), acción (texto y código), entidad y código, resumen del cambio
    const newest = page.getByTestId('audit-row-AL-130');
    const expected = first.items[0] as AuditItem;
    await expect(newest).toHaveAttribute('data-action', expected.action);
    await expect(newest).toHaveAttribute('data-entity', expected.entity);
    await expect(newest).toContainText(expected.action);
    await expect(newest).toContainText(expected.entityId);
    await expect(newest.getByRole('img', { name: expected.actorName ?? '' })).toBeVisible();

    // Sin desplazarse no se pide la página siguiente
    await page.waitForTimeout(600);
    await expect(articles(page)).toHaveCount(20);
  });

  test('carga continua: al llegar al final del scroll llega la página siguiente hasta agotar los eventos', async ({ page, request }) => {
    const { total } = await auditApi(request, '?limit=1');
    await open(page, 'admin', '/audit');
    await expect(articles(page)).toHaveCount(20);

    const steps = Array.from({ length: Math.ceil(total / 20) - 1 }, (_, index) => Math.min(total, 20 * (index + 2)));
    for (const expected of steps) {
      await articles(page).last().scrollIntoViewIfNeeded();
      await expect.poll(() => articles(page).count(), { message: `eventos cargados tras el scroll hasta ${expected}` }).toBe(expected);
      await expect(count(page)).toHaveText(shown(expected, total));
    }

    await expect(page.getByTestId('audit-end')).toHaveText('No hay más eventos');
    await expect(page.getByTestId('audit-load-more')).toHaveCount(0);
    const all = await ids(page);
    expect(new Set(all).size).toBe(total); // sin duplicados
    expect(all[0]).toBe('AL-130');
    expect(all[129]).toBe('AL-001');
    await expect(articles(page).last()).toHaveAttribute('aria-posinset', String(total));

    // Ya no hay más: seguir bajando no pide nada
    await page.waitForTimeout(500);
    await expect(articles(page)).toHaveCount(total);
  });

  test('«Cargar más» pide la página siguiente sin necesidad de desplazarse', async ({ page }) => {
    await open(page, 'admin', '/audit');
    await expect(articles(page)).toHaveCount(20);
    await page.getByRole('button', { name: 'Cargar más', exact: true }).click();
    await expect(articles(page)).toHaveCount(40);
    await expect(count(page)).toHaveText(/^Mostrando 40 de \d+ eventos$/);
  });

  test('filtros: entidad, rango de fechas, texto y combinados; cambiar un filtro reinicia el feed', async ({ page, request }) => {
    const entityTotal = (await auditApi(request, '?entity=requirement&limit=1')).total;
    const search = await auditApi(request, '?q=state_changed&limit=100');
    const full = await auditApi(request, '?limit=100');
    const day = (full.items[60] as AuditItem).at.slice(0, 10);
    const dayItems = full.items.filter((item) => item.at.slice(0, 10) === day);
    expect(dayItems.length).toBeGreaterThan(5);

    await open(page, 'admin', '/audit');
    await expect(articles(page)).toHaveCount(20);
    await expect(page.getByTestId('audit-filters-clear')).toHaveCount(0);
    await expect(page.getByLabel('Buscar en la auditoría', { exact: true })).toHaveAttribute('placeholder', 'Acción o código…');
    await expect(page.getByLabel('Desde', { exact: true })).toHaveAttribute('placeholder', 'AAAA-MM-DD');

    // Tras cargar más, cambiar un filtro vuelve a la primera página
    await page.getByRole('button', { name: 'Cargar más', exact: true }).click();
    await expect(articles(page)).toHaveCount(40);
    await choose(page, 'Entidad', 'Requisito');
    await expect(count(page)).toHaveText(shown(20, entityTotal));
    await expect(articles(page)).toHaveCount(20);
    const entities = await articles(page).evaluateAll((items) => items.map((item) => item.getAttribute('data-entity')));
    expect(entities.every((entity) => entity === 'requirement')).toBe(true);

    await page.getByRole('button', { name: 'Limpiar filtros', exact: true }).click();
    await expect(count(page)).toHaveText(shown(20, full.total));
    await expect(page.getByTestId('audit-filters-clear')).toHaveCount(0);
    await expect(page.getByRole('combobox', { name: 'Entidad', exact: true })).toContainText('Todas las entidades');

    // Rango de fechas escrito a mano
    await page.getByLabel('Desde', { exact: true }).fill(day);
    await page.getByLabel('Hasta', { exact: true }).fill(day);
    await expect(count(page)).toHaveText(shown(Math.min(20, dayItems.length), dayItems.length));
    await expect(page.getByTestId('audit-end')).toHaveCount(dayItems.length <= 20 ? 1 : 0);
    const days = await articles(page).evaluateAll((items) => items.length);
    expect(days).toBe(Math.min(20, dayItems.length));

    // Texto (con retraso) sobre la acción: «state_changed»
    await page.getByLabel('Desde', { exact: true }).fill('');
    await page.getByLabel('Hasta', { exact: true }).fill('');
    await page.getByLabel('Buscar en la auditoría', { exact: true }).fill('state_changed');
    await expect(count(page)).toHaveText(shown(Math.min(20, search.total), search.total));
    await expect(articles(page).first()).toHaveAttribute('data-action', 'requirement.state_changed');

    // Combinado y vacío
    await choose(page, 'Entidad', 'Documento');
    await expect(page.getByTestId('audit-empty')).toContainText('Ningún evento coincide con los filtros aplicados.');
    await expect(count(page)).toHaveText(shown(0, 0));
    await page.getByRole('button', { name: 'Limpiar filtros', exact: true }).click();
    await expect(articles(page)).toHaveCount(20);
  });

  test('fechas: solo se aplican las completas y reales, y «Hasta» no puede ser anterior a «Desde»', async ({ page, request }) => {
    const full = await auditApi(request, '?limit=100');
    const day = (full.items[60] as AuditItem).at.slice(0, 10);
    const expectedDay = (await auditApi(request, `?from=${day}&to=${day}&limit=1`)).total;

    const calls: string[] = [];
    page.on('request', (call) => call.url().includes('/api/audit') && calls.push(call.url()));
    await open(page, 'admin', '/audit');
    await expect(articles(page)).toHaveCount(20);
    expect(calls).toHaveLength(1);
    const from = page.getByLabel('Desde', { exact: true });
    const to = page.getByLabel('Hasta', { exact: true });
    const fromError = page.getByTestId('audit-filter-from-error');
    const toError = page.getByTestId('audit-filter-to-error');

    // A medio escribir, con mes o día imposibles o con otro formato: error al instante y la API no se toca
    for (const bad of ['2026-0', '2026-13-45', '2026-02-30', '06/01/2026', 'ayer']) {
      await from.fill(bad);
      await expect(fromError).toHaveText('Indica una fecha válida');
      await expect(from).toHaveAttribute('aria-invalid', 'true');
    }
    await to.fill('2026-99-99');
    await expect(toError).toHaveText('Indica una fecha válida');
    await expect(page.getByRole('button', { name: 'Limpiar filtros', exact: true })).toBeVisible(); // hay algo escrito
    await page.waitForTimeout(600);
    expect(calls).toHaveLength(1);
    await expect(count(page)).toHaveText(shown(20, full.total));
    await expect(articles(page)).toHaveCount(20);

    // «Hasta» anterior a «Desde»: se avisa bajo «Hasta» y no se aplica ninguna de las dos
    await from.fill(day);
    await expect(fromError).toHaveCount(0);
    await to.fill('2000-01-01');
    await expect(toError).toHaveText('La fecha «Hasta» no puede ser anterior a «Desde»');
    await page.waitForTimeout(600);
    expect(calls.filter((url) => url.includes('from='))).toEqual([]);
    await expect(count(page)).toHaveText(shown(20, full.total));

    // Corregido el rango, se aplica y los errores desaparecen
    await to.fill(day);
    await expect(toError).toHaveCount(0);
    await expect(count(page)).toHaveText(shown(Math.min(20, expectedDay), expectedDay));
    expect(calls.some((url) => url.includes(`from=${day}`) && url.includes(`to=${day}`))).toBe(true);

    // Un rango sin eventos muestra el estado vacío; «Limpiar filtros» lo deja todo como estaba
    await from.fill('2030-01-01');
    await to.fill('2030-01-31');
    await expect(page.getByTestId('audit-empty')).toContainText('Ningún evento coincide con los filtros aplicados.');
    await page.getByRole('button', { name: 'Limpiar filtros', exact: true }).click();
    await expect(count(page)).toHaveText(shown(20, full.total));
    await expect(from).toHaveValue('');
    await expect(to).toHaveValue('');
  });

  test('los cambios nuevos aparecen arriba del registro, con su actor', async ({ page, request }) => {
    const before = (await auditApi(request, '?limit=1')).total;
    const created = await request.post(`${API_URL}/requirements`, { headers: await authHeaders(request, 'admin', TENANT), data: { programCode: 'PRG-001', title: 'Requisito creado para la auditoría' } });
    expect(created.status()).toBe(201);

    await open(page, 'admin', '/audit');
    await expect(count(page)).toHaveText(shown(20, before + 1));
    const newest = articles(page).first();
    await expect(newest).toHaveAttribute('data-action', 'requirement.created');
    await expect(newest).toContainText('Requisito creado');
    await expect(newest).toContainText('title: Requisito creado para la auditoría');
    await expect(newest.getByRole('img', { name: 'Marta Ruiz' })).toBeVisible();
  });

  test('errores: carga lenta (aria-busy), 503 con reintento y fallo de la página siguiente con «Cargar más»', async ({ page }) => {
    await open(page, 'admin', '/programs');

    const slow = /\/api\/audit(\?(?!.*cursor=).*)?$/;
    await page.route(slow, async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 1500));
      await route.continue().catch(() => undefined);
    });
    await page.goto('/audit');
    await expect(page.getByTestId('audit-loading')).toBeVisible();
    await expect(feed(page)).toHaveAttribute('aria-busy', 'true');
    await expect(articles(page)).toHaveCount(20, { timeout: 8000 });
    await expect(feed(page)).toHaveAttribute('aria-busy', 'false');
    await page.unroute(slow);

    const any = /\/api\/audit(\?.*)?$/;
    await page.route(any, failWith(503, 'Service Unavailable', { traceId: '7f3a-c21d' }));
    await page.goto('/audit');
    const alert = page.getByTestId('audit-error');
    await expect(alert).toContainText('No se pudo cargar la auditoría');
    await expect(alert).toContainText('GET /api/audit');
    await expect(alert).toContainText('503');
    await expect(alert).toContainText('trace 7f3a-c21d');
    await page.unroute(any);
    await alert.getByRole('button', { name: 'Reintentar', exact: true }).click();
    await expect(articles(page)).toHaveCount(20);

    // La página 2 falla: se conserva lo cargado, aparece el aviso con «Cargar más» y no se reintenta solo
    let failures = 0;
    const second = /\/api\/audit\?.*cursor=/;
    await page.route(second, (route) => {
      failures += 1;
      return failWith(500, 'Internal Server Error')(route);
    });
    await articles(page).last().scrollIntoViewIfNeeded();
    const more = page.getByTestId('audit-load-more');
    await expect(page.getByTestId('audit-more-error')).toContainText('500');
    await expect(more).toBeVisible();
    await expect(articles(page)).toHaveCount(20);
    await page.waitForTimeout(600);
    await articles(page).last().scrollIntoViewIfNeeded();
    await page.waitForTimeout(400);
    expect(failures).toBe(1);
    await page.unroute(second);
    await more.click();
    await expect(articles(page)).toHaveCount(40);
    await expect(page.getByTestId('audit-more-error')).toHaveCount(0);
  });
});

// --- Administración --------------------------------------------------------------------------------------------------

const row = (page: Page, id: string) => page.getByTestId(`admin-user-row-${id}`);
const roleField = (page: Page, name: string) => page.getByRole('combobox', { name: `Rol de ${name}`, exact: true });

/** Cambia el rol de un usuario por la API (el admin del seed). */
const setRoleByApi = async (request: APIRequestContext, id: string, role: string) => {
  const response = await request.patch(`${API_URL}/admin/users/${id}`, { headers: await authHeaders(request, 'admin', TENANT), data: { role } });
  expect(response.status()).toBe(200);
};
const roleOfApi = async (request: APIRequestContext, id: string): Promise<string> => {
  const users = (await (await request.get(`${API_URL}/admin/users`, { headers: await authHeaders(request, 'admin', TENANT) })).json()) as { id: string; role: string }[];
  return users.find((user) => user.id === id)?.role ?? '';
};

test.describe('Móvil · Administración', () => {
  test('permisos: solo admin la ve (menú «Más», ruta directa y pestañas); los demás, el aviso y sin pedir nada', async ({ page }) => {
    const admin: string[] = [];
    page.on('request', (call) => call.url().includes('/api/admin/') && admin.push(call.url()));

    for (const role of ['consultant', 'program_manager', 'auditor'] as const) {
      await open(page, role, '/programs');
      await tab(page, 'Más').click();
      await expect(page.getByTestId('more-item-admin')).toHaveCount(0);
      await page.goto('/admin');
      const forbidden = page.getByTestId('admin-forbidden');
      await expect(forbidden).toContainText('Tu rol no permite administrar el tenant');
      await expect(forbidden).toContainText('Solo admin puede entrar en Administración.');
      await expect(page.getByTestId('admin-page')).toHaveCount(0);
      await expect(page.getByRole('tablist', { name: 'Secciones de administración' })).toHaveCount(0); // la barra inferior sigue siendo un tablist
      expect(admin).toEqual([]);
    }
    await page.getByRole('link', { name: 'Volver a Programas', exact: true }).click();
    await expect(page).toHaveURL(/\/programs$/);

    await open(page, 'admin', '/programs');
    await tab(page, 'Más').click();
    await page.getByRole('link', { name: 'Administración', exact: true }).click();
    await expect(page).toHaveURL(/\/admin$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Administración' })).toBeVisible();
    await expect(page.getByRole('tablist', { name: 'Secciones de administración' }).getByRole('tab')).toHaveText(['Usuarios', 'Auditoría', 'Modo caos', 'Datos']);
    await expect(tab(page, 'Usuarios')).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByRole('tabpanel', { name: 'Usuarios' })).toBeVisible();
  });

  test('pestañas: cada una abre su panel y la URL guarda la sección', async ({ page }) => {
    await open(page, 'admin', '/admin');
    await expect(page.getByRole('tabpanel', { name: 'Usuarios' })).toBeVisible();

    await tab(page, 'Auditoría').click();
    await expect(tab(page, 'Auditoría')).toHaveAttribute('aria-selected', 'true');
    await expect(tab(page, 'Usuarios')).toHaveAttribute('aria-selected', 'false');
    await expect(page).toHaveURL(/tab=audit/);
    await expect(page.getByRole('tabpanel', { name: 'Auditoría' })).toBeVisible();
    await expect(page.getByRole('heading', { level: 2, name: 'Registro de auditoría' })).toBeVisible();
    await expect(articles(page)).toHaveCount(20);

    await tab(page, 'Datos').click();
    await expect(page).toHaveURL(/tab=data/);
    await expect(page.getByRole('button', { name: 'Restaurar datos del tenant', exact: true })).toBeVisible();
    await tab(page, 'Modo caos').click();
    await expect(page.getByTestId('admin-chaos-panel')).toBeVisible();
    await tab(page, 'Usuarios').click();
    await expect(page).not.toHaveURL(/tab=/);
    await expect(page.getByTestId('admin-users-table')).toBeVisible();

    // La sección sobrevive a recargar y una sección desconocida cae en «Usuarios»
    await page.goto('/admin?tab=chaos');
    await expect(tab(page, 'Modo caos')).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByTestId('admin-chaos-panel')).toBeVisible();
    await page.goto('/admin?tab=nada');
    await expect(tab(page, 'Usuarios')).toHaveAttribute('aria-selected', 'true');
    expect(await noHorizontalOverflow(page)).toBe(true);
  });

  test('usuarios: lista, búsqueda, estados y la propia cuenta protegida con su motivo a la vista', async ({ page }) => {
    await open(page, 'admin', '/admin');
    const list = page.getByTestId('admin-users-table');
    await expect(list).toHaveAttribute('aria-busy', 'false');
    await expect(page.getByTestId('admin-users-count')).toHaveText('7 de 7 usuarios');
    await expect(list.getByRole('listitem')).toHaveCount(7);
    await expect(page.getByTestId('admin-users-note')).toContainText('siempre debe quedar al menos un admin activo');

    // Estados: Normal ×5, Bloqueado (Carmen Vidal) y Pendiente (Pablo Serrano)
    await expect(page.getByTestId('admin-user-status-u5')).toHaveText('Bloqueado');
    await expect(page.getByTestId('admin-user-status-u5')).toHaveAttribute('data-state', 'locked');
    await expect(page.getByTestId('admin-user-status-u6')).toHaveText('Pendiente');
    await expect(page.getByTestId('admin-user-status-u6')).toHaveAttribute('data-state', 'pending');
    await expect(page.locator('[data-testid^="admin-user-status-"][data-state="ok"]')).toHaveCount(5);
    await expect(row(page, 'u4')).toHaveAttribute('data-role', 'auditor');
    await expect(row(page, 'u4')).toHaveAttribute('data-active', 'true');

    // Avatar con nombre accesible en cada fila y marca «tú» en la propia
    await expect(row(page, 'u1').getByRole('img', { name: 'Marta Ruiz' })).toBeVisible();
    await expect(row(page, 'u1')).toContainText('tú');
    await expect(row(page, 'u4')).not.toContainText('tú');

    // La propia cuenta: controles deshabilitados y el motivo en texto
    await expect(roleField(page, 'Marta Ruiz')).toBeDisabled();
    await expect(page.getByTestId('admin-user-active-u1')).toBeDisabled();
    await expect(page.getByTestId('admin-user-reason-u1')).toHaveText('No puedes modificar tu propia cuenta');
    await expect(page.getByTestId('admin-user-reason-u4')).toHaveCount(0);
    await expect(roleField(page, 'Andrés Molina')).toBeEnabled();

    // Búsqueda por nombre y por correo
    const search = page.getByLabel('Buscar usuarios', { exact: true });
    await expect(search).toHaveAttribute('placeholder', 'Nombre o correo…');
    await search.fill('molina');
    await expect(page.getByTestId('admin-users-count')).toHaveText('1 de 7 usuarios');
    await expect(list.getByRole('listitem')).toHaveCount(1);
    await search.fill('@sigpro.lab');
    await expect(list.getByRole('listitem')).toContainText('Alumno 24');
    await search.fill('nadie-se-llama-asi');
    await expect(page.getByTestId('admin-users-empty')).toContainText('Ningún usuario coincide con la búsqueda.');
    await search.fill('');
    await expect(page.getByTestId('admin-users-count')).toHaveText('7 de 7 usuarios');
    expect(await noHorizontalOverflow(page)).toBe(true);
  });

  test('usuarios: el rol (selector) y el interruptor de activo persisten y avisan', async ({ page, request }) => {
    await open(page, 'admin', '/admin');

    // Rol: las cuatro opciones y el aviso con el cambio
    const roleOfAndres = roleField(page, 'Andrés Molina');
    await expect(roleOfAndres).toContainText('Auditor');
    await roleOfAndres.click();
    await expect(dialog(page, 'Rol de Andrés Molina').getByRole('radio')).toHaveText(['Admin', 'Gestor de programas', 'Consultor', 'Auditor']);
    await dialog(page, 'Rol de Andrés Molina').getByRole('radio', { name: 'Consultor', exact: true }).click();
    await expect(toast(page, 'ok', 'Usuario actualizado')).toContainText('Andrés Molina: rol = Consultor');
    await expect(row(page, 'u4')).toHaveAttribute('data-role', 'consultant');
    await expect(roleOfAndres).toContainText('Consultor');
    expect(await roleOfApi(request, 'u4')).toBe('consultant');
    await choose(page, 'Rol de Andrés Molina', 'Gestor de programas');
    await expect(row(page, 'u4')).toHaveAttribute('data-role', 'program_manager');

    // Activo: el interruptor cambia, el estado pasa a «Desactivado» y persiste tras recargar
    const active = page.getByTestId('admin-user-active-u4');
    await expect(active).toHaveAttribute('aria-checked', 'true');
    await active.click();
    await expect(active).toHaveAttribute('aria-checked', 'false');
    await expect(toast(page, 'ok', 'activo = no')).toContainText('Andrés Molina: activo = no');
    await expect(page.getByTestId('admin-user-status-u4')).toHaveText('Desactivado');
    await expect(page.getByTestId('admin-user-status-u4')).toHaveAttribute('data-state', 'inactive');
    await expect(row(page, 'u4')).toHaveAttribute('data-active', 'false');

    await page.reload();
    await expect(roleField(page, 'Andrés Molina')).toContainText('Gestor de programas');
    await expect(page.getByTestId('admin-user-active-u4')).toHaveAttribute('aria-checked', 'false');
    await page.getByTestId('admin-user-active-u4').click();
    await expect(page.getByTestId('admin-user-active-u4')).toHaveAttribute('aria-checked', 'true');
    await expect(page.getByTestId('admin-user-status-u4')).toHaveText('Normal');
  });

  test('usuarios: error de carga con reintento y reversión si la API rechaza el cambio', async ({ page }) => {
    await open(page, 'admin', '/programs');
    await page.route('**/api/admin/users', failWith(503, 'Service Unavailable', { traceId: 'ab12-cd34' }));
    await page.goto('/admin');
    const error = page.getByTestId('admin-users-error');
    await expect(error).toContainText('No se pudieron cargar los usuarios');
    await expect(error).toContainText('GET /api/admin/users → 503');
    await expect(error).toContainText('trace ab12-cd34');
    await page.unroute('**/api/admin/users');
    await error.getByRole('button', { name: 'Reintentar', exact: true }).click();
    await expect(page.getByTestId('admin-users-table')).toHaveAttribute('aria-busy', 'false');
    await expect(page.getByTestId('admin-users-count')).toHaveText('7 de 7 usuarios');

    // PATCH rechazado (500): el selector y el interruptor vuelven a su valor y sale el aviso de error
    await page.route('**/api/admin/users/u3', (route) => (route.request().method() === 'PATCH' ? failWith(500, 'Internal Server Error')(route) : route.fallback()));
    const role = roleField(page, 'Lucía Fernández');
    await expect(role).toContainText('Consultor');
    await choose(page, 'Rol de Lucía Fernández', 'Auditor');
    await expect(toast(page, 'danger', 'No se pudo guardar el cambio')).toContainText('PATCH /api/admin/users/u3 → 500');
    await expect(role).toContainText('Consultor');
    await expect(row(page, 'u3')).toHaveAttribute('data-role', 'consultant');
    await page.getByTestId('admin-user-active-u3').click();
    await expect(page.getByTestId('admin-user-active-u3')).toHaveAttribute('aria-checked', 'true');
    await page.unroute('**/api/admin/users/u3');

    // Los códigos de la API que la web traduce: self_change, last_admin y user_not_found
    const codes = [
      { status: 409, error: 'Conflict', code: 'self_change', text: 'No puedes desactivarte ni cambiar tu propio rol' },
      { status: 409, error: 'Conflict', code: 'last_admin', text: 'Debe quedar al menos un admin activo en el tenant' },
      { status: 404, error: 'Not Found', code: 'user_not_found', text: 'El usuario ya no existe' },
    ];
    for (const item of codes) {
      await page.route('**/api/admin/users/u3', (route) => (route.request().method() === 'PATCH' ? failWith(item.status, item.error, { code: item.code })(route) : route.fallback()));
      await page.getByTestId('admin-user-active-u3').click();
      await expect(toast(page, 'danger', item.text)).toBeVisible();
      await expect(page.getByTestId('admin-user-active-u3')).toHaveAttribute('aria-checked', 'true');
      await page.unroute('**/api/admin/users/u3');
    }
  });

  test('usuarios: no se puede dejar el tenant sin admin activo (409 last_admin) y el cambio se revierte', async ({ page, request }) => {
    // Dos admins: u1 (admin@sigpro.test) y u7 (el del alumno). Se entra como u7 y, con su sesión abierta, u1 lo desactiva por API:
    // su JWT sigue vigente, así que desde la pantalla intenta desactivar y degradar a u1, que ya es el último admin activo.
    const login = await request.post(`${API_URL}/auth/login`, { headers: { 'x-tenant': TENANT }, data: { email: `${TENANT}@sigpro.lab`, password: 'Alumno1234!', remember: true } });
    expect(login.status()).toBe(200);
    const { refreshToken } = (await login.json()) as { refreshToken: string };
    await seedStorage(page.context(), { tenant: TENANT, refreshToken });
    await page.goto('/admin');
    await expect(row(page, 'u7')).toContainText('tú');
    await expect(row(page, 'u1')).toHaveAttribute('data-role', 'admin');

    const deactivate = await request.patch(`${API_URL}/admin/users/u7`, { headers: await authHeaders(request, 'admin', TENANT), data: { active: false } });
    expect(deactivate.status()).toBe(200);

    const message = 'Debe quedar al menos un admin activo en el tenant';
    await page.getByTestId('admin-user-active-u1').click();
    await expect(toast(page, 'danger', 'No se pudo guardar el cambio')).toContainText(message);
    await expect(page.getByTestId('admin-user-active-u1')).toHaveAttribute('aria-checked', 'true');
    await expect(row(page, 'u1')).toHaveAttribute('data-active', 'true');

    await choose(page, 'Rol de Marta Ruiz', 'Auditor');
    await expect(toast(page, 'danger', message).first()).toBeVisible();
    await expect(roleField(page, 'Marta Ruiz')).toContainText('Admin');
    await expect(row(page, 'u1')).toHaveAttribute('data-role', 'admin');
    expect(await roleOfApi(request, 'u1')).toBe('admin');
  });

  test('auditoría de Administración: mismo feed, con el rango de fechas y los cambios de usuario', async ({ page, request }) => {
    await setRoleByApi(request, 'u4', 'consultant');
    const total = (await auditApi(request, '?limit=1')).total;
    const users = (await auditApi(request, '?entity=user&limit=1')).total;
    expect(users).toBeGreaterThan(0);

    await open(page, 'admin', '/admin?tab=audit');
    await expect(count(page)).toHaveText(shown(20, total));
    await expect(page.getByLabel('Desde', { exact: true })).toBeVisible();

    const today = new Date().toISOString().slice(0, 10);
    await page.getByLabel('Desde', { exact: true }).fill(today);
    await page.getByLabel('Hasta', { exact: true }).fill(today);
    const expectedToday = (await auditApi(request, `?from=${today}&to=${today}&limit=1`)).total;
    expect(expectedToday).toBeGreaterThan(0); // el cambio de rol de esta prueba es de hoy
    await expect(count(page)).toHaveText(shown(Math.min(20, expectedToday), expectedToday));
    await page.getByRole('button', { name: 'Limpiar filtros', exact: true }).click();

    await choose(page, 'Entidad', 'Usuario');
    await expect(count(page)).toHaveText(shown(users, users));
    await expect(articles(page).first()).toHaveAttribute('data-action', 'user.updated');
    await expect(articles(page).first()).toContainText('Usuario modificado');
  });
});

// --- Administración: modo caos y datos del tenant ----------------------------------------------------------------------

/** Pulsa `+` de un deslizador de pasos `times` veces. */
const step = async (page: Page, label: string, increment: number, times: number) => {
  for (let index = 0; index < times; index += 1) await page.getByRole('button', { name: `${label} +${increment}`, exact: true }).click();
};

test.describe('Móvil · Administración: modo caos', () => {
  // El caos sobrevive al reinicio del tenant: se apaga al terminar cada prueba, falle o no
  test.afterEach(async ({ request }) => {
    await chaosOff(request, TENANT);
  });

  test('deslizadores, textos alternos y persistencia por tenant', async ({ page, request }) => {
    await open(page, 'admin', '/admin?tab=chaos');
    const panel = page.getByTestId('admin-chaos-panel');
    const apply = page.getByRole('button', { name: 'Aplicar', exact: true });
    const off = page.getByRole('button', { name: 'Apagar caos', exact: true });
    await expect(panel.getByTestId('admin-chaos-status')).toHaveAttribute('data-active', 'false');
    await expect(panel.getByTestId('admin-chaos-status')).toHaveText('Caos apagado');
    await expect(apply).toBeDisabled();
    await expect(apply).toHaveAttribute('data-reason', 'No hay cambios que guardar');
    await expect(page.getByTestId('admin-chaos-apply-reason')).toHaveText('No hay cambios que guardar');
    await expect(off).toBeDisabled();
    await expect(page.getByTestId('admin-chaos-off-reason')).toHaveText('Caos apagado');
    await expect(page.getByRole('slider', { name: 'Latencia máxima' })).toHaveAttribute('aria-valuemax', '5000');

    await step(page, 'Latencia máxima', 100, 15);
    const latency = page.getByRole('slider', { name: 'Latencia máxima' });
    await expect(latency).toHaveAttribute('aria-valuenow', '1500');
    await expect(latency).toHaveAttribute('aria-valuetext', '1500 ms');
    await expect(panel.getByTestId('admin-chaos-latency-value')).toHaveText('1500 ms');
    await step(page, 'Errores 500 en escrituras', 5, 10);
    const errors = page.getByRole('slider', { name: 'Errores 500 en escrituras' });
    await expect(errors).toHaveAttribute('aria-valuenow', '50');
    await expect(panel.getByTestId('admin-chaos-errors-value')).toHaveText('50 %');
    const flaky = page.getByTestId('admin-chaos-flaky');
    await expect(flaky).toHaveAttribute('aria-checked', 'false');
    await flaky.click();
    await expect(flaky).toHaveAttribute('aria-checked', 'true');
    await expect(page.getByTestId('admin-chaos-unsaved')).toHaveText('Cambios sin aplicar');
    // Todavía no se ha guardado nada: la configuración pública sigue limpia
    expect((await readConfig(request, TENANT)).chaos).toEqual({ latencyMs: 0, errorRate: 0, flakyLabels: false });

    await expect(apply).toBeEnabled();
    await expect(page.getByTestId('admin-chaos-apply-reason')).toHaveCount(0);
    await apply.click();
    await expect(toast(page, 'ok', 'Modo caos actualizado')).toContainText('Latencia 1500 ms · errores 50 % · textos alternos sí');
    await expect(panel.getByTestId('admin-chaos-status')).toHaveAttribute('data-active', 'true');
    await expect(panel.getByTestId('admin-chaos-status')).toHaveText('Caos activo');
    await expect(apply).toBeDisabled();
    await expect(off).toBeEnabled();
    await expect(page.getByTestId('admin-chaos-unsaved')).toHaveCount(0);
    // Persistido por tenant: lo ve GET /api/config y sobrevive a recargar
    expect((await readConfig(request, TENANT)).chaos).toEqual({ latencyMs: 1500, errorRate: 0.5, flakyLabels: true });
    await page.reload();
    await expect(page.getByRole('slider', { name: 'Latencia máxima' })).toHaveAttribute('aria-valuenow', '1500');
    await expect(page.getByRole('slider', { name: 'Errores 500 en escrituras' })).toHaveAttribute('aria-valuenow', '50');
    await expect(page.getByTestId('admin-chaos-flaky')).toHaveAttribute('aria-checked', 'true');
    // Otro tenant no se ve afectado
    expect((await readConfig(request, 'alumno06')).chaos).toEqual({ latencyMs: 0, errorRate: 0, flakyLabels: false });

    // Textos alternos: el botón de ejemplo cambia entre «Guardar» y «Guardar cambios»
    const preview = page.getByTestId('admin-chaos-preview');
    await expect(preview).toHaveText(/^Guardar( cambios)?$/);
    await expect(preview).toHaveText('Guardar cambios', { timeout: 8000 });
    await expect(preview).toHaveText('Guardar', { timeout: 8000 });
    await preview.click();
    await expect(toast(page, 'info', 'Has pulsado')).toContainText(/«Guardar( cambios)?»/);

    // Los límites de los deslizadores: no pasan de 0 ni del máximo
    await page.getByRole('button', { name: 'Apagar caos', exact: true }).click();
    await expect(toast(page, 'ok', 'Modo caos actualizado').last()).toContainText('Latencia 0 ms · errores 0 % · textos alternos no');
    await expect(page.getByRole('button', { name: 'Latencia máxima −100', exact: true })).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Errores 500 en escrituras −5', exact: true })).toBeDisabled();
    await expect(preview).toHaveText('Guardar');
  });

  test('con el 100 % de errores una escritura falla y «Apagar caos» lo deja todo limpio', async ({ page, request }) => {
    await open(page, 'admin', '/admin?tab=chaos');
    await step(page, 'Errores 500 en escrituras', 5, 20);
    await expect(page.getByTestId('admin-chaos-errors-value')).toHaveText('100 %');
    await expect(page.getByRole('button', { name: 'Errores 500 en escrituras +5', exact: true })).toBeDisabled();
    await page.getByRole('button', { name: 'Aplicar', exact: true }).click();
    await expect(toast(page, 'ok', 'Modo caos actualizado')).toBeVisible();
    expect((await readConfig(request, TENANT)).chaos).toEqual({ latencyMs: 0, errorRate: 1, flakyLabels: false });

    // Una escritura de otra pantalla (editar un programa) recibe el 500 simulado
    await page.goto('/programs/PRG-001/edit');
    await page.getByLabel('Descripción', { exact: true }).fill('Descripción cambiada con el caos activo');
    await page.getByRole('button', { name: 'Guardar', exact: true }).click();
    await expect(page.getByTestId('program-edit-server-error')).toBeVisible();

    // Los endpoints de administración están exentos: el instructor siempre puede apagarlo
    await page.goto('/admin?tab=chaos');
    await expect(page.getByTestId('admin-chaos-status')).toHaveAttribute('data-active', 'true');
    await page.getByRole('button', { name: 'Apagar caos', exact: true }).click();
    await expect(toast(page, 'ok', 'Modo caos actualizado')).toBeVisible();
    await expect(page.getByTestId('admin-chaos-status')).toHaveAttribute('data-active', 'false');
    await expect(page.getByRole('button', { name: 'Apagar caos', exact: true })).toBeDisabled();
    await expect(page.getByTestId('admin-chaos-off-reason')).toHaveText('Caos apagado');
    expect((await readConfig(request, TENANT)).chaos).toEqual({ latencyMs: 0, errorRate: 0, flakyLabels: false });
  });

  test('errores: la lectura que falla se reintenta y «Aplicar» rechazado avisa sin cambiar lo guardado', async ({ page, request }) => {
    await open(page, 'admin', '/programs');
    await page.route('**/api/admin/chaos', failWith(503, 'Service Unavailable', { traceId: 'ee55-ff66' }));
    await page.goto('/admin?tab=chaos');
    const error = page.getByTestId('admin-chaos-error');
    await expect(error).toContainText('No se pudo leer el modo caos');
    await expect(error).toContainText('GET /api/admin/chaos → 503');
    await page.unroute('**/api/admin/chaos');
    await error.getByRole('button', { name: 'Reintentar', exact: true }).click();
    await expect(page.getByTestId('admin-chaos-panel')).toBeVisible();

    await page.route('**/api/admin/chaos', (route) => (route.request().method() === 'PATCH' ? failWith(500, 'Internal Server Error')(route) : route.fallback()));
    await page.getByTestId('admin-chaos-flaky').click();
    await page.getByRole('button', { name: 'Aplicar', exact: true }).click();
    await expect(toast(page, 'danger', 'Ha ocurrido un error inesperado')).toContainText('PATCH /api/admin/chaos → 500');
    await expect(page.getByTestId('admin-chaos-unsaved')).toBeVisible(); // el borrador se conserva para reintentar
    await expect(page.getByTestId('admin-chaos-status')).toHaveAttribute('data-active', 'false');
    expect((await readConfig(request, TENANT)).chaos).toEqual({ latencyMs: 0, errorRate: 0, flakyLabels: false });
  });
});

test.describe('Móvil · Administración: datos del tenant', () => {
  test('«Restaurar datos del tenant» pide confirmación en un diálogo de la app: cancelar y confirmar', async ({ page, request }) => {
    await setRoleByApi(request, 'u4', 'consultant');
    expect(await roleOfApi(request, 'u4')).toBe('consultant');

    await open(page, 'admin', '/admin?tab=data');
    await expect(page.getByTestId('admin-data-panel')).toBeVisible();
    await expect(page.getByTestId('admin-data-tenant')).toHaveText(`Tenant: ${TENANT}`);
    const reset = page.getByTestId('admin-reset');
    const confirm = dialog(page, 'Restaurar datos del tenant');

    // Cancelar: nada cambia y no hay aviso
    await reset.click();
    await expect(confirm).toBeVisible();
    await expect(confirm).toContainText('¿Restaurar los datos del tenant al estado inicial? Se perderán los cambios que hayas hecho.');
    await confirm.getByRole('button', { name: 'Cancelar', exact: true }).click();
    await expect(confirm).toBeHidden();
    await expect(page.getByTestId('toast-ok')).toHaveCount(0);
    expect(await roleOfApi(request, 'u4')).toBe('consultant');

    // Confirmar: se restaura el seed y aparece el aviso con el tenant
    await reset.click();
    await confirm.getByRole('button', { name: 'Restaurar datos del tenant', exact: true }).click();
    await expect(toast(page, 'ok', 'Datos restaurados')).toContainText(TENANT);
    await expect(confirm).toBeHidden();
    await expect.poll(() => roleOfApi(request, 'u4')).toBe('auditor');
    await expect(reset).toBeEnabled();
  });

  test('el reinicio que falla avisa con la traza y deja los datos como estaban', async ({ page, request }) => {
    await setRoleByApi(request, 'u4', 'consultant');
    await open(page, 'admin', '/admin?tab=data');
    await page.route('**/api/admin/reset', failWith(500, 'Internal Server Error', { traceId: '9a8b-7c6d' }));
    await page.getByTestId('admin-reset').click();
    await dialog(page, 'Restaurar datos del tenant').getByRole('button', { name: 'Restaurar datos del tenant', exact: true }).click();
    await expect(toast(page, 'danger', 'Ha ocurrido un error inesperado')).toContainText('POST /api/admin/reset → 500');
    await expect(dialog(page, 'Restaurar datos del tenant')).toBeHidden();
    expect(await roleOfApi(request, 'u4')).toBe('consultant');
  });

  test('«Información del tenant» muestra el tenant y los usuarios en un diálogo', async ({ page, request }) => {
    const users = (await (await request.get(`${API_URL}/admin/users`, { headers: await authHeaders(request, 'admin', TENANT) })).json()) as { active: boolean }[];
    const active = users.filter((user) => user.active).length;

    await open(page, 'admin', '/admin?tab=data');
    await page.getByRole('button', { name: 'Información del tenant', exact: true }).click();
    const info = dialog(page, 'Información del tenant');
    await expect(info).toBeVisible();
    await expect(info).toContainText(`Tenant: ${TENANT}`);
    await expect(info).toContainText(`Usuarios: ${users.length} (${active} activos)`);
    await info.getByRole('button', { name: 'Cerrar', exact: true }).click();
    await expect(info).toBeHidden();
    // Un diálogo solo tiene «Cerrar»: la pantalla sigue operativa después
    await expect(page.getByRole('button', { name: 'Restaurar datos del tenant', exact: true })).toBeEnabled();
    expect(await noHorizontalOverflow(page)).toBe(true);
  });
});
