import { expect, test, type APIRequestContext, type Page } from '@playwright/test';
import { API_URL, loginByApi, openAs, resetTenant, type RoleName } from '../support/auth';

// Spec de humo del Panel de misión (fase 3): KPIs, gráficas, feed en tiempo real por Socket.IO, campana con contador y
// tooltips. Tenant propio: alumno09. El simulador de la API emite un evento cada pocos segundos a los tenants con un
// cliente conectado, así que NUNCA se asierta un número exacto de eventos: se espera «llega alguno nuevo» (`expect.poll`).
// Nota (defectos plantados): no se asierta el valor del KPI «NC abiertas» tras un cambio en vivo ni el contador de la
// campana tras «Marcar leídas»; eso lo cubre planted-bugs.spec.ts.

const TENANT = 'alumno09';
test.describe.configure({ mode: 'serial' });

test.beforeAll(async ({ request }) => {
  await resetTenant(request, TENANT);
});
test.afterAll(async ({ request }) => {
  await resetTenant(request, TENANT);
});

interface Summary {
  kpis: { activePrograms: number; programsTotal: number; milestonesDone: number; milestonesTotal: number; ncOpen: number; ncTotal: number; verificationPass: number; casesWithRuns: number };
  milestonesByProgram: { programCode: string; done: number; total: number }[];
  ncBySeverity: { minor: number; major: number; critical: number };
}
interface TickedEvent {
  event: { seq: number; severity: 'info' | 'ok' | 'warn' | 'danger'; type: string };
}

const authHeaders = async (request: APIRequestContext, role: RoleName) => {
  const { accessToken } = await loginByApi(request, role, TENANT);
  return { Authorization: `Bearer ${accessToken}`, 'x-tenant': TENANT };
};

const summaryOf = async (request: APIRequestContext): Promise<Summary> => {
  const response = await request.get(`${API_URL}/mission/summary`, { headers: await authHeaders(request, 'admin') });
  expect(response.status()).toBe(200);
  return (await response.json()) as Summary;
};

const tick = async (request: APIRequestContext): Promise<TickedEvent['event']> => {
  const response = await request.post(`${API_URL}/mission/tick`, { headers: await authHeaders(request, 'admin') });
  expect(response.status()).toBe(200);
  return ((await response.json()) as TickedEvent).event;
};

const events = (page: Page) => page.getByRole('list', { name: 'Eventos de misión en directo' }).getByRole('listitem');
const latestSeq = (page: Page): Promise<number> =>
  page.getByTestId(/^mission-event-\d+$/).evaluateAll((nodes) => Math.max(0, ...nodes.map((node) => Number(node.getAttribute('data-testid')?.replace('mission-event-', '')))));
const kpi = (page: Page, name: string) => page.getByRole('article', { name });

test('estructura: título, 4 KPIs con los valores de la API, gráficas y feed', async ({ page, request }) => {
  const summary = await summaryOf(request);
  await openAs(page, 'admin', '/mission', { tenant: TENANT });

  await expect(page.getByRole('heading', { level: 1, name: 'Panel de misión' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Indicadores clave' }).getByRole('article')).toHaveCount(4);
  await expect(page.getByTestId('mission-kpis')).toHaveAttribute('aria-busy', 'false');

  await expect(kpi(page, 'Programas activos').getByTestId('mission-kpi-value-programs')).toHaveText(String(summary.kpis.activePrograms));
  await expect(kpi(page, 'Programas activos')).toContainText(`de ${summary.kpis.programsTotal} programas`);
  const milestonesPct = Math.round((summary.kpis.milestonesDone / summary.kpis.milestonesTotal) * 100);
  await expect(kpi(page, 'Hitos cumplidos').getByTestId('mission-kpi-value-milestones')).toHaveText(`${milestonesPct} %`);
  await expect(kpi(page, 'NC abiertas').getByTestId('mission-kpi-value-nc')).toHaveText('8');
  await expect(kpi(page, 'Verificación superada').getByTestId('mission-kpi-value-verification')).toHaveText(`${summary.kpis.verificationPass} %`);

  // El feed arranca con la historia del simulador (6 eventos) y el menú muestra las NC abiertas en vivo
  await expect.poll(() => events(page).count()).toBeGreaterThanOrEqual(6);
  await expect(page.getByTestId('nav-badge-nc')).toHaveText('8');
  await expect(page.getByTestId('mission-feed-count')).toContainText('eventos');
});

test('gráficas: hitos cumplidos por programa y NC abiertas por severidad, con vista de tabla', async ({ page, request }) => {
  const summary = await summaryOf(request);
  await openAs(page, 'admin', '/mission', { tenant: TENANT });

  const milestones = page.getByRole('figure', { name: 'Hitos cumplidos por programa' });
  const rows = milestones.getByRole('listitem');
  await expect(rows).toHaveCount(summary.milestonesByProgram.length);
  const first = summary.milestonesByProgram[0];
  if (!first) throw new Error('el seed trae programas activos con hitos');
  const firstRow = page.getByTestId(`mission-bar-milestones-${first.programCode}`);
  await expect(firstRow).toHaveAttribute('data-done', String(first.done));
  await expect(firstRow).toHaveAttribute('data-total', String(first.total));
  await expect(milestones.getByRole('button', { name: `${first.programCode}: ${first.done} de ${first.total} hitos cumplidos` })).toBeVisible();

  const nc = page.getByRole('figure', { name: 'NC abiertas por severidad' });
  for (const severity of ['minor', 'major', 'critical'] as const) {
    await expect(page.getByTestId(`mission-bar-nc-${severity}`)).toHaveAttribute('data-value', String(summary.ncBySeverity[severity]));
    await expect(page.getByTestId(`mission-bar-nc-${severity}`)).toHaveAttribute('data-severity', severity);
  }

  // Vista de tabla: los mismos datos sin depender del color ni del hover
  await nc.getByRole('button', { name: 'Ver como tabla' }).click();
  const table = nc.getByRole('table');
  await expect(table.getByRole('row')).toHaveCount(4);
  await expect(table.getByRole('row', { name: /Crítica/ })).toContainText(String(summary.ncBySeverity.critical));
  await nc.getByRole('button', { name: 'Ver como gráfica' }).click();
  await expect(page.getByTestId('mission-bar-nc-critical')).toBeVisible();
});

test('tooltips: icono de información de cada KPI, barras y estado de la conexión', async ({ page }) => {
  await openAs(page, 'admin', '/mission', { tenant: TENANT });
  await expect(page.getByTestId('mission-kpis')).toHaveAttribute('aria-busy', 'false');

  await expect(page.getByRole('tooltip')).toHaveCount(0);
  const info = page.getByRole('button', { name: 'Qué mide NC abiertas' });
  await info.hover();
  const tooltip = page.getByRole('tooltip');
  await expect(tooltip).toBeVisible();
  await expect(tooltip).toContainText('no están cerradas ni rechazadas');
  await expect(info).toHaveAttribute('aria-describedby', (await tooltip.getAttribute('id')) ?? '');
  await page.keyboard.press('Escape');
  await expect(tooltip).toBeHidden();

  // También con el teclado
  await page.getByRole('button', { name: 'Qué mide Verificación superada' }).focus();
  await expect(page.getByRole('tooltip')).toContainText('último resultado es «Superado»');

  await page.getByTestId('mission-bar-nc-critical').getByRole('button').hover();
  await expect(page.getByRole('tooltip')).toContainText('Crítica: ');

  const connection = page.getByRole('status').filter({ hasText: 'En vivo' });
  await expect(connection).toHaveAttribute('data-state', 'live');
  await connection.getByRole('button').hover();
  await expect(page.getByRole('tooltip')).toContainText('Conectado por WebSocket');
});

test('tiempo real: el socket entrega eventos del simulador sin acción del usuario', async ({ page, request }) => {
  const socketOpened = page.waitForEvent('websocket', (ws) => ws.url().includes('/socket.io/'));
  await openAs(page, 'admin', '/mission', { tenant: TENANT });
  const socket = await socketOpened;
  await expect(page.getByRole('status').filter({ hasText: 'En vivo' })).toHaveAttribute('data-state', 'live');

  const before = await latestSeq(page);
  const frame = socket.waitForEvent('framereceived', (data) => String(data.payload).includes('mission:event'));
  const emitted = await tick(request);
  expect((await frame).payload.toString()).toContain('mission:event');

  await expect.poll(() => latestSeq(page), { message: 'llega el evento emitido' }).toBeGreaterThanOrEqual(emitted.seq);
  expect(emitted.seq).toBeGreaterThan(before);
  const arrived = page.getByTestId(`mission-event-${emitted.seq}`);
  await expect(arrived).toHaveAttribute('data-origin', 'simulator');
  await expect(arrived).toHaveAttribute('data-severity', emitted.severity);
});

test('«Simular evento»: solo admin; emite uno más y el feed lo muestra', async ({ page, browser }) => {
  await openAs(page, 'admin', '/mission', { tenant: TENANT });
  await expect(page.getByRole('status').filter({ hasText: 'En vivo' })).toHaveAttribute('data-state', 'live');
  const before = await latestSeq(page);
  await page.getByRole('button', { name: 'Simular evento' }).click();
  await expect.poll(() => latestSeq(page)).toBeGreaterThan(before);

  const consultant = await browser.newPage();
  await openAs(consultant, 'consultant', '/mission', { tenant: TENANT });
  const denied = consultant.getByRole('button', { name: 'Simular evento' });
  await expect(denied).toBeDisabled();
  await expect(denied).toHaveAttribute('title', 'Solo admin puede emitir eventos de prueba');
  await consultant.close();
});

test('pausa: el feed se congela, cuenta lo que queda en espera y al reanudar lo muestra', async ({ page, request }) => {
  await openAs(page, 'admin', '/mission', { tenant: TENANT });
  await expect(page.getByRole('status').filter({ hasText: 'En vivo' })).toHaveAttribute('data-state', 'live');

  const pause = page.getByRole('button', { name: 'Pausar feed' });
  await pause.click();
  await expect(page.getByRole('button', { name: 'Reanudar feed' })).toHaveAttribute('aria-pressed', 'true');
  const frozen = await latestSeq(page);
  const emitted = await tick(request);
  await tick(request);
  await expect(page.getByTestId('mission-feed-paused-note')).toContainText('eventos nuevos en espera');
  expect(await latestSeq(page)).toBe(frozen);

  await page.getByRole('button', { name: 'Reanudar feed' }).click();
  await expect(page.getByTestId('mission-feed-paused-note')).toBeHidden();
  await expect.poll(() => latestSeq(page)).toBeGreaterThanOrEqual(emitted.seq + 1);
});

test('campana: los avisos llegan en vivo con contador, popover y marcar leídas', async ({ page, request }) => {
  await openAs(page, 'admin', '/mission', { tenant: TENANT });
  await expect(page.getByRole('status').filter({ hasText: 'En vivo' })).toHaveAttribute('data-state', 'live');
  const bell = page.getByRole('button', { name: /^Notificaciones/ });
  await expect(page.getByTestId('layout-notifications-count')).toHaveCount(0);

  // El catálogo del simulador intercala un aviso (térmica o pérdida de enlace) cada ocho eventos: se emiten hasta que llegue uno
  let warning: TickedEvent['event'] | undefined;
  for (let i = 0; i < 9 && !warning; i += 1) {
    const emitted = await tick(request);
    warning = emitted.severity === 'warn' || emitted.severity === 'danger' ? emitted : undefined;
  }
  if (!warning) throw new Error('el simulador debería haber emitido un aviso');
  await expect(page.getByTestId('layout-notifications-count')).toBeVisible();
  await expect(bell).toHaveAccessibleName(/sin leer/);

  await bell.click();
  const popover = page.getByRole('dialog', { name: 'Notificaciones' });
  const notification = popover.getByTestId(`layout-notification-${warning.seq}`);
  await expect(notification).toBeVisible();
  await expect(notification).toHaveAttribute('data-severity', warning.severity);
  await popover.getByRole('button', { name: 'Marcar leídas' }).click();
  await expect(popover).toBeHidden();
});

test('eventos reales: abrir y mover una NC por API aparece en el feed, la insignia del menú y la gráfica', async ({ page, request }) => {
  await openAs(page, 'admin', '/mission', { tenant: TENANT });
  await expect(page.getByRole('status').filter({ hasText: 'En vivo' })).toHaveAttribute('data-state', 'live');
  const headers = await authHeaders(request, 'admin');
  const majorBefore = Number(await page.getByTestId('mission-bar-nc-major').getAttribute('data-value'));

  const created = await request.post(`${API_URL}/nc`, { headers, data: { programCode: 'PRG-002', severity: 'major', description: '<p>Desviación detectada en el enlace de datos del programa</p>' } });
  expect(created.status()).toBe(201);
  const { code } = (await created.json()) as { code: string };

  await expect(page.getByTestId('nav-badge-nc')).toHaveText('9');
  await expect(page.getByTestId('mission-bar-nc-major')).toHaveAttribute('data-value', String(majorBefore + 1));
  await expect(events(page).filter({ hasText: `${code} abierta (Mayor)` })).toHaveCount(1);
  await expect(events(page).filter({ hasText: `${code} abierta` })).toHaveAttribute('data-severity', 'warn');

  const moved = await request.post(`${API_URL}/nc/${code}/transition`, { headers, data: { to: 'in_analysis' } });
  expect(moved.status()).toBe(200);
  await expect(events(page).filter({ hasText: `${code} pasó de «Abierta» a «En análisis»` })).toHaveCount(1);
});

test('restaurar el tenant olvida los eventos de datos que ya no existen y devuelve las NC abiertas a 8', async ({ page, request }) => {
  await resetTenant(request, TENANT);
  await openAs(page, 'admin', '/mission', { tenant: TENANT });
  await expect(kpi(page, 'NC abiertas').getByTestId('mission-kpi-value-nc')).toHaveText('8');
  await expect(page.getByTestId('nav-badge-nc')).toHaveText('8');
  await expect(events(page).filter({ hasText: /NC-\d+ (abierta|pasó)/ })).toHaveCount(0);
});

test('aislamiento: los eventos de otro tenant no llegan a este panel (rooms por tenant)', async ({ page, request }) => {
  const OTHER = 'alumno10';
  await resetTenant(request, OTHER);
  await openAs(page, 'admin', '/mission', { tenant: TENANT });
  await expect(page.getByRole('status').filter({ hasText: 'En vivo' })).toHaveAttribute('data-state', 'live');
  const badgeBefore = await page.getByTestId('nav-badge-nc').innerText();

  // Dos NC nuevas en OTRO tenant: allí las abiertas pasan de 8 a 10 y se emiten dos eventos `nc_created`
  const { accessToken } = await loginByApi(request, 'admin', OTHER);
  const headers = { Authorization: `Bearer ${accessToken}`, 'x-tenant': OTHER };
  for (let i = 0; i < 2; i += 1) {
    const created = await request.post(`${API_URL}/nc`, { headers, data: { programCode: 'PRG-001', severity: 'critical', description: `<p>Incidencia ajena número ${i + 1} del otro tenant</p>` } });
    expect(created.status()).toBe(201);
  }
  const summary = await request.get(`${API_URL}/mission/summary`, { headers });
  expect(((await summary.json()) as Summary).kpis.ncOpen).toBe(10);

  // El panel de este tenant no se entera: su contador y su feed no mencionan esas incidencias
  await page.waitForTimeout(1000);
  await expect(page.getByTestId('nav-badge-nc')).toHaveText(badgeBefore);
  await expect(events(page).filter({ hasText: 'abierta (Crítica)' })).toHaveCount(0);
  await resetTenant(request, OTHER);
});

test('estados de carga y error: 503 con traza, reintento y recuperación', async ({ page }) => {
  let failing = true;
  await page.route('**/api/mission/summary', (route) => (failing ? route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ statusCode: 503, error: 'Service Unavailable', message: 'down' }) }) : route.continue()));
  await openAs(page, 'admin', '/mission', { tenant: TENANT });
  const alert = page.getByRole('alert').filter({ hasText: 'No se pudo cargar el panel de misión' });
  await expect(alert).toBeVisible();
  await expect(alert).toContainText('GET /api/mission/summary → 503');
  failing = false;
  await page.getByRole('button', { name: 'Reintentar' }).click();
  await expect(alert).toBeHidden();
  await expect(kpi(page, 'Programas activos').getByTestId('mission-kpi-value-programs')).toHaveText('12');
});

test('móvil (390 px): KPIs en dos columnas y sin desbordar horizontalmente', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openAs(page, 'admin', '/mission', { tenant: TENANT });
  await expect(page.getByTestId('mission-kpis')).toHaveAttribute('aria-busy', 'false');
  const a = await kpi(page, 'Programas activos').boundingBox();
  const b = await kpi(page, 'Hitos cumplidos').boundingBox();
  const c = await kpi(page, 'NC abiertas').boundingBox();
  expect(a && b && c).toBeTruthy();
  expect(Math.abs((a?.y ?? 0) - (b?.y ?? 1))).toBeLessThan(2); // mismos renglón: dos columnas
  expect((c?.y ?? 0) - (a?.y ?? 0)).toBeGreaterThan(50); // el tercero baja de fila
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);

  // El tooltip del KPI junto al borde izquierdo no se sale de la pantalla
  await page.getByRole('button', { name: 'Qué mide NC abiertas' }).hover();
  const box = await page.getByRole('tooltip').boundingBox();
  expect(box?.x).toBeGreaterThanOrEqual(0);
  expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(390);
});
