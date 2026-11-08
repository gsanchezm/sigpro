import { expect, test, type APIRequestContext } from '@playwright/test';
import { API_URL, loginByApi, openAs, resetTenant, type RoleName } from '../support/auth';

// Reproduce los 8 defectos plantados (docs/planted-bugs.md, solo instructor). Con PLANTED_BUGS=true (por defecto) cada
// test afirma el comportamiento DEFECTUOSO; con PLANTED_BUGS=false, el CORRECTO. Así una corrección accidental también se
// detecta. Tenant propio: alumno12. No se enumeran los defectos en `/lab` ni en ninguna pantalla.

const TENANT = 'alumno12';
test.describe.configure({ mode: 'serial' });

let planted = true;

test.beforeAll(async ({ request }) => {
  await resetTenant(request, TENANT);
  const config = await request.get(`${API_URL}/config`, { headers: { 'x-tenant': TENANT } });
  planted = ((await config.json()) as { plantedBugs: boolean }).plantedBugs;
});
test.afterAll(async ({ request }) => {
  await resetTenant(request, TENANT);
});

const headersFor = async (request: APIRequestContext, role: RoleName) => {
  const { accessToken } = await loginByApi(request, role, TENANT);
  return { Authorization: `Bearer ${accessToken}`, 'x-tenant': TENANT };
};

interface ProgramRow {
  code: string;
  endDate: string;
  budgetEur: number;
  milestonesDone: number;
}
interface ProgramPage {
  items: ProgramRow[];
}
const programs = async (request: APIRequestContext, query: string): Promise<ProgramPage> => {
  const response = await request.get(`${API_URL}/programs${query}`, { headers: await headersFor(request, 'admin') });
  expect(response.status()).toBe(200);
  return (await response.json()) as ProgramPage;
};

const nextDay = (iso: string): string => new Date(Date.parse(`${iso}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10);

test('B1 · el filtro «Hasta» deja fuera el programa que termina justo ese día', async ({ request }) => {
  const [program] = (await programs(request, '?q=PRG-001')).items;
  if (!program) throw new Error('el seed trae PRG-001');
  const exact = await programs(request, `?q=PRG-001&to=${program.endDate}`);
  expect(exact.items.map((item) => item.code).includes('PRG-001')).toBe(!planted);
  // Control: un día después siempre entra
  const after = await programs(request, `?q=PRG-001&to=${nextDay(program.endDate)}`);
  expect(after.items.map((item) => item.code)).toContain('PRG-001');
});

test('B2 · al pasar a la página 2 se pierde el orden por presupuesto', async ({ request }) => {
  const first = await programs(request, '?sort=budget&dir=desc&page=1');
  const second = await programs(request, '?sort=budget&dir=desc&page=2');
  const budgets = second.items.map((item) => item.budgetEur);
  const descending = budgets.every((value, index) => index === 0 || (budgets[index - 1] as number) >= value);
  // La primera página siempre está bien ordenada y su último presupuesto no es menor que el primero de la siguiente
  const firstBudgets = first.items.map((item) => item.budgetEur);
  expect(firstBudgets.every((value, index) => index === 0 || (firstBudgets[index - 1] as number) >= value)).toBe(true);
  expect(descending).toBe(!planted);
  if (planted) expect(second.items.map((item) => item.code)).toEqual(['PRG-011', 'PRG-012', 'PRG-013', 'PRG-014', 'PRG-015', 'PRG-016', 'PRG-017', 'PRG-018', 'PRG-019', 'PRG-020']);
});

test('B3 · el cierre de una NC acepta 19 caracteres (y rechaza 18)', async ({ request }) => {
  const headers = await headersFor(request, 'program_manager');
  const close = (code: string, comment: string) => request.post(`${API_URL}/nc/${code}/transition`, { headers, data: { to: 'closed', comment } });

  const eighteen = await close('NC-009', 'a'.repeat(18));
  expect(eighteen.status()).toBe(422);
  expect(((await eighteen.json()) as { errors: { comment: string } }).errors.comment).toBe('closureShort');

  const nineteen = await close('NC-003', 'a'.repeat(19));
  expect(nineteen.status()).toBe(planted ? 200 : 422);

  // Control: 20 siempre vale
  expect((await close('NC-009', 'a'.repeat(20))).status()).toBe(200);
});

test('B3 (web) · el formulario de cierre muestra «19 / 20» y deja enviar', async ({ page, request }) => {
  // NC-006 (abierta) llega a «Acción correctiva» por API; después se arrastra a «Cerrada» desde la interfaz
  const consultant = await headersFor(request, 'consultant');
  for (const to of ['in_analysis', 'corrective_action']) {
    expect((await request.post(`${API_URL}/nc/NC-006/transition`, { headers: consultant, data: { to } })).status()).toBe(200);
  }
  await openAs(page, 'program_manager', '/nc', { tenant: TENANT });
  await page.getByTestId('nc-card-NC-006').dragTo(page.getByTestId('nc-column-closed'));
  const close = page.getByRole('dialog', { name: 'Cerrar NC-006' });
  await close.getByLabel('Comentario de cierre').fill('a'.repeat(19));
  await expect(close.getByTestId('nc-close-counter')).toHaveText('19 / 20');
  await close.getByRole('button', { name: 'Cerrar no conformidad' }).click();
  if (planted) {
    await expect(close).toBeHidden();
    await expect(page.getByTestId('nc-column-closed').getByTestId('nc-card-NC-006')).toBeVisible();
  } else {
    await expect(close.getByRole('alert')).toContainText('al menos 20 caracteres');
  }
});

test('B4 · el KPI «NC abiertas» no sigue al WebSocket, aunque la insignia del menú y la gráfica sí', async ({ page, request }) => {
  await openAs(page, 'admin', '/mission', { tenant: TENANT });
  await expect(page.getByRole('status').filter({ hasText: 'En vivo' })).toHaveAttribute('data-state', 'live');
  const kpiValue = page.getByRole('article', { name: 'NC abiertas' }).getByTestId('mission-kpi-value-nc');
  // Las abiertas dependen de cuántos cierres aceptó B3: se toma el valor real de la API como punto de partida
  const summary = await request.get(`${API_URL}/mission/summary`, { headers: await headersFor(request, 'admin') });
  const before = ((await summary.json()) as { kpis: { ncOpen: number } }).kpis.ncOpen;
  await expect(kpiValue).toHaveText(String(before));

  const created = await request.post(`${API_URL}/nc`, { headers: await headersFor(request, 'admin'), data: { programCode: 'PRG-001', severity: 'minor', description: '<p>Nueva desviación detectada en el enlace</p>' } });
  expect(created.status()).toBe(201);

  // La insignia del menú (alimentada por el mismo evento) sí cambia
  await expect(page.getByTestId('nav-badge-nc')).toHaveText(String(before + 1));
  // El KPI: con el defecto se queda como estaba; sin él, sube
  if (planted) {
    await page.waitForTimeout(1000);
    await expect(kpiValue).toHaveText(String(before));
  } else {
    await expect(kpiValue).toHaveText(String(before + 1));
  }
  // Recargando se corrige
  await page.reload();
  await expect(kpiValue).toHaveText(String(before + 1));
});

test('B5 · `open → rejected` se acepta aunque la máquina de estados lo prohíbe', async ({ request }) => {
  const response = await request.post(`${API_URL}/nc/NC-001/transition`, { headers: await headersFor(request, 'consultant'), data: { to: 'rejected' } });
  expect(response.status()).toBe(planted ? 200 : 409);
  if (!planted) expect(((await response.json()) as { code: string }).code).toBe('invalid_transition');
});

test('B6 · «Marcar leídas» deja un aviso sin leer', async ({ page, request }) => {
  await openAs(page, 'admin', '/mission', { tenant: TENANT });
  await expect(page.getByRole('status').filter({ hasText: 'En vivo' })).toHaveAttribute('data-state', 'live');
  const headers = await headersFor(request, 'admin');
  const count = page.getByTestId('layout-notifications-count');
  // Dos avisos como mínimo: el simulador intercala uno cada ocho eventos, así que se emiten hasta acumular dos
  let warnings = 0;
  for (let i = 0; i < 18 && warnings < 2; i += 1) {
    const tick = await request.post(`${API_URL}/mission/tick`, { headers });
    const severity = ((await tick.json()) as { event: { severity: string } }).event.severity;
    if (severity === 'warn' || severity === 'danger') warnings += 1;
  }
  expect(warnings).toBe(2);
  await expect(count).toBeVisible();

  await page.getByRole('button', { name: /^Notificaciones/ }).click();
  await page.getByRole('button', { name: 'Marcar leídas' }).click();
  if (planted) await expect(count).toHaveText('1');
  else await expect(count).toHaveCount(0);
});

test('B7 · un salto de menos del 50 % a 100 % no marca el hito como cumplido', async ({ request }) => {
  const headers = await headersFor(request, 'program_manager');
  const list = await request.get(`${API_URL}/programs/PRG-001/milestones`, { headers });
  const milestones = (await list.json()) as { id: string; progress: number; done: boolean }[];
  const target = [...milestones].reverse().find((milestone) => milestone.progress === 0);
  if (!target) throw new Error('el seed deja hitos de PRG-001 sin empezar');
  const doneBefore = (await programs(request, '?q=PRG-001')).items[0]?.milestonesDone;

  const jump = await request.patch(`${API_URL}/milestones/${target.id}`, { headers, data: { progress: 100 } });
  const jumped = (await jump.json()) as { progress: number; done: boolean };
  expect(jumped.progress).toBe(100);
  expect(jumped.done).toBe(!planted);
  expect((await programs(request, '?q=PRG-001')).items[0]?.milestonesDone).toBe(planted ? doneBefore : (doneBefore ?? 0) + 1);

  // Control: bajando a 95 y volviendo a 100 sí se marca (el avance previo ya era ≥ 50 %)
  await request.patch(`${API_URL}/milestones/${target.id}`, { headers, data: { progress: 95 } });
  const again = await request.patch(`${API_URL}/milestones/${target.id}`, { headers, data: { progress: 100 } });
  expect(((await again.json()) as { done: boolean }).done).toBe(true);
});

test('B8 · la tarjeta del tablero muestra un comentario menos cuando hay más de dos', async ({ page, request }) => {
  const headers = await headersFor(request, 'admin');
  const list = await request.get(`${API_URL}/nc`, { headers });
  const items = ((await list.json()) as { items: { code: string; commentCount: number }[] }).items;
  const withThree = items.find((item) => item.commentCount === 3);
  const withTwo = items.find((item) => item.commentCount === 2);
  if (!withThree || !withTwo) throw new Error('el seed trae NC con 2 y 3 comentarios');

  await openAs(page, 'admin', '/nc', { tenant: TENANT });
  // Con dos comentarios, correcto siempre; con tres, el defecto muestra dos
  await expect(page.getByTestId(`nc-card-comments-${withTwo.code}`)).toContainText('2');
  await expect(page.getByTestId(`nc-card-comments-${withThree.code}`)).toContainText(planted ? '2' : '3');
});
