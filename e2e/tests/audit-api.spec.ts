import { expect, test, type APIRequestContext } from '@playwright/test';
import { API_URL, loginByApi, resetTenant, type RoleName } from '../support/auth';
import { PNG_BUFFER } from '../support/files';

// Pruebas de API de Auditoría con `request`: permisos, paginación por cursor (sin duplicados ni saltos aunque lleguen
// eventos nuevos), filtros, y que cada mutación de la fase 2 deje su evento. Tenant propio: alumno23 (y alumno20 de lectura).

const TENANT = 'alumno23';
const OTHER_TENANT = 'alumno20';
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
  actorId: string | null;
  actorName: string | null;
  action: string;
  entity: string;
  entityId: string;
  diff: Record<string, unknown> | null;
}
interface AuditPage {
  items: AuditItem[];
  nextCursor: string | null;
  total: number;
}

const tokens = new Map<string, string>();
const headersFor = async (request: APIRequestContext, role: RoleName, tenant: string) => {
  const key = `${tenant}|${role}`;
  if (!tokens.has(key)) tokens.set(key, (await loginByApi(request, role, tenant)).accessToken);
  return { Authorization: `Bearer ${tokens.get(key)}`, 'x-tenant': tenant };
};
const audit = async (request: APIRequestContext, query = '', role: RoleName = 'admin', tenant = TENANT) => request.get(`${API_URL}/audit${query}`, { headers: await headersFor(request, role, tenant) });
const auditPage = async (request: APIRequestContext, query = '', role: RoleName = 'admin', tenant = TENANT): Promise<AuditPage> => {
  const response = await audit(request, query, role, tenant);
  expect(response.status()).toBe(200);
  return (await response.json()) as AuditPage;
};
const call = async (request: APIRequestContext, role: RoleName, method: 'post' | 'patch' | 'put' | 'delete', path: string, data?: unknown) =>
  request[method](`${API_URL}${path}`, { headers: await headersFor(request, role, TENANT), data });

test('permisos: admin y auditor leen el registro; gestor y consultor reciben 403; sin token, 401', async ({ request }) => {
  expect((await audit(request, '', 'admin')).status()).toBe(200);
  expect((await audit(request, '', 'auditor')).status()).toBe(200);
  expect((await audit(request, '', 'program_manager')).status()).toBe(403);
  expect((await audit(request, '', 'consultant')).status()).toBe(403);
  expect((await request.get(`${API_URL}/audit`, { headers: { 'x-tenant': TENANT } })).status()).toBe(401);
});

test('primera página: 20 eventos con actor y diff, ordenados por fecha descendente, con total y nextCursor', async ({ request }) => {
  const page = await auditPage(request);
  expect(page.total).toBe(130);
  expect(page.items).toHaveLength(20);
  expect(typeof page.nextCursor).toBe('string');
  expect(page.items[0]).toMatchObject({ id: 'AL-130', actorId: expect.any(String), actorName: expect.any(String), action: expect.any(String), entity: expect.any(String), entityId: expect.any(String) });
  expect(page.items[0]?.diff).toEqual(expect.any(Object));
  const times = page.items.map((item) => Date.parse(item.at));
  expect(times).toEqual([...times].sort((a, b) => b - a));
  expect(new Set(page.items.map((item) => item.entity))).toEqual(new Set(['program', 'requirement', 'testrun', 'document']));
});

test('paginación por cursor: recorrer todo el registro sin duplicados ni saltos; límite acotado; cursor inválido → 422', async ({ request }) => {
  // Con 50 por página: 50 + 50 + 30
  const sizes: number[] = [];
  const collected: string[] = [];
  let cursor: string | null = null;
  for (let guard = 0; guard < 10; guard += 1) {
    const page: AuditPage = await auditPage(request, `?limit=50${cursor ? `&cursor=${cursor}` : ''}`);
    sizes.push(page.items.length);
    collected.push(...page.items.map((item) => item.id));
    cursor = page.nextCursor;
    if (!cursor) break;
  }
  expect(sizes).toEqual([50, 50, 30]);
  expect(new Set(collected).size).toBe(130);
  expect(collected[0]).toBe('AL-130');
  expect(collected[129]).toBe('AL-001');

  // Es el mismo orden que pidiendo todo de una vez
  const all = await auditPage(request, '?limit=100');
  expect(all.items.map((item) => item.id)).toEqual(collected.slice(0, 100));
  expect((await auditPage(request, '?limit=1000')).items).toHaveLength(100); // máximo 100
  expect((await auditPage(request, '?limit=0')).items).toHaveLength(1); // mínimo 1
  expect((await auditPage(request, '?limit=abc')).items).toHaveLength(20); // no numérico: el valor por defecto

  const bad = await audit(request, '?cursor=esto-no-es-un-cursor');
  expect(bad.status()).toBe(422);
  expect(((await bad.json()) as { errors: Record<string, string> }).errors).toEqual({ cursor: 'badCursor' });
  expect((await audit(request, `?cursor=${Buffer.from('{"at":"ayer","id":"AL-1"}').toString('base64url')}`)).status()).toBe(422);
});

test('filtros: entidad, texto (acción o código, sin distinguir mayúsculas), fechas (ambos extremos incluidos) y combinaciones', async ({ request }) => {
  const entities = ['program', 'requirement', 'testrun', 'document', 'tenant'];
  const totals = await Promise.all(entities.map(async (entity) => (await auditPage(request, `?entity=${entity}&limit=1`)).total));
  expect(totals.reduce((sum, value) => sum + value, 0)).toBe(130);
  expect(totals[4]).toBe(0); // el seed no tiene eventos de tenant

  const stateChanged = await auditPage(request, '?q=STATE_CHANGED&limit=100');
  expect(stateChanged.total).toBeGreaterThan(0);
  expect(stateChanged.items.every((item) => item.action === 'requirement.state_changed')).toBe(true);
  const byCode = await auditPage(request, '?q=req-01&limit=100');
  expect(byCode.items.every((item) => item.entityId.toLowerCase().includes('req-01'))).toBe(true);
  expect(byCode.total).toBeGreaterThan(0);

  const all = await auditPage(request, '?limit=100');
  const day = (all.items[40] as AuditItem).at.slice(0, 10);
  const onDay = all.items.filter((item) => item.at.slice(0, 10) === day);
  expect((await auditPage(request, `?from=${day}&to=${day}&limit=100`)).total).toBe(onDay.length);
  expect((await auditPage(request, `?from=${day}&limit=1`)).total).toBe(all.items.filter((item) => item.at.slice(0, 10) >= day).length);
  expect((await auditPage(request, `?from=2030-01-01`)).total).toBe(0);
  expect((await auditPage(request, `?from=${day}&to=2020-01-01`)).total).toBe(0);
  expect((await auditPage(request, '?from=ayer&to=mañana')).total).toBe(130); // fechas no válidas: se ignoran

  const combined = await auditPage(request, `?entity=requirement&q=state_changed&from=${day}&limit=100`);
  expect(combined.items.every((item) => item.entity === 'requirement' && item.action === 'requirement.state_changed' && item.at.slice(0, 10) >= day)).toBe(true);
});

test('cada mutación deja su evento: programas, requisitos, ejecuciones y documentos (actor, entidad, acción y diff)', async ({ request }) => {
  const newest = async (count: number) => (await auditPage(request, `?limit=${count}`)).items;

  const patched = await call(request, 'program_manager', 'patch', '/programs/PRG-005', { budget: 777000, status: 'on_hold' });
  expect(patched.status()).toBe(200);
  const created = await call(request, 'consultant', 'post', '/requirements', { programCode: 'PRG-002', parentCode: 'REQ-025', title: 'Requisito auditado' });
  const code = ((await created.json()) as { code: string }).code;
  await call(request, 'consultant', 'patch', `/requirements/${code}`, { priority: 'high' });
  await call(request, 'program_manager', 'post', `/requirements/${code}/transition`, { to: 'approved' });
  await call(request, 'consultant', 'post', `/requirements/${code}/move`, { targetCode: 'REQ-026', placement: 'before' });
  await call(request, 'consultant', 'put', `/requirements/${code}/tests/TC-010`);
  await call(request, 'consultant', 'delete', `/requirements/${code}/tests/TC-010`);
  await call(request, 'program_manager', 'delete', `/requirements/${code}`);

  const run = await request.post(`${API_URL}/test-cases/TC-003/runs`, { headers: await headersFor(request, 'consultant', TENANT), multipart: { result: 'fail', notes: 'auditoría', files: { name: 'captura.png', mimeType: 'image/png', buffer: PNG_BUFFER } } });
  expect(run.status()).toBe(201);
  const runId = ((await run.json()) as { id: string }).id;

  await call(request, 'program_manager', 'post', '/documents/DOC-002/versions', { lines: ['Contenido nuevo'], note: 'Auditoría' });

  // Más reciente primero: documento, ejecución, borrado, desenlace, enlace, movimiento, transición, edición, alta, programa
  const events = await newest(10);
  expect(events.map((event) => [event.action, event.entity, event.actorName])).toEqual([
    ['document.version_published', 'document', 'Javier Ortega'],
    ['testrun.executed', 'testrun', 'Lucía Fernández'],
    ['requirement.deleted', 'requirement', 'Javier Ortega'],
    ['requirement.unlinked', 'requirement', 'Lucía Fernández'],
    ['requirement.linked', 'requirement', 'Lucía Fernández'],
    ['requirement.moved', 'requirement', 'Lucía Fernández'],
    ['requirement.state_changed', 'requirement', 'Javier Ortega'],
    ['requirement.updated', 'requirement', 'Lucía Fernández'],
    ['requirement.created', 'requirement', 'Lucía Fernández'],
    ['program.updated', 'program', 'Javier Ortega'],
  ]);
  const byAction = new Map(events.map((event) => [event.action, event]));
  expect(byAction.get('document.version_published')).toMatchObject({ entityId: 'DOC-002', diff: { version: 2, lines: 1 } });
  expect(byAction.get('testrun.executed')).toMatchObject({ entityId: runId, diff: { testCase: 'TC-003', result: 'fail', files: 1 } });
  expect(byAction.get('requirement.deleted')).toMatchObject({ entityId: code, diff: { descendants: 0 } });
  expect(byAction.get('requirement.moved')).toMatchObject({ entityId: code, diff: { target: 'REQ-026', placement: 'before' } });
  expect(byAction.get('requirement.state_changed')).toMatchObject({ entityId: code, diff: { from: 'draft', to: 'approved' } });
  expect(byAction.get('requirement.updated')?.diff).toMatchObject({ fields: ['priority'] });
  expect(byAction.get('requirement.created')).toMatchObject({ entityId: code, diff: { title: 'Requisito auditado', parent: 'REQ-025' } });
  expect(byAction.get('program.updated')).toMatchObject({ entityId: 'PRG-005' });
  expect((byAction.get('program.updated')?.diff as { fields: string[] }).fields.sort()).toEqual(['budgetEur', 'status']);

  // Las operaciones rechazadas (403 / 422) no dejan evento
  const before = (await auditPage(request, '?limit=1')).total;
  expect((await call(request, 'auditor', 'patch', '/programs/PRG-005', { budget: 1 })).status()).toBe(403);
  expect((await call(request, 'consultant', 'post', '/requirements', { programCode: 'PRG-002', title: 'x' })).status()).toBe(422);
  expect((await call(request, 'consultant', 'post', '/requirements/REQ-016/transition', { to: 'validated' })).status()).toBe(409);
  expect((await auditPage(request, '?limit=1')).total).toBe(before);
});

test('el cursor es estable aunque lleguen eventos nuevos entre páginas (no hay duplicados ni saltos)', async ({ request }) => {
  const first = await auditPage(request, '?limit=20');
  const secondExpected = await auditPage(request, `?limit=20&cursor=${first.nextCursor}`);

  // Llegan eventos nuevos después de pedir la primera página
  for (let i = 0; i < 3; i += 1) expect((await call(request, 'program_manager', 'patch', '/programs/PRG-006', { description: `Revisión ${i}` })).status()).toBe(200);

  const second = await auditPage(request, `?limit=20&cursor=${first.nextCursor}`);
  expect(second.items.map((item) => item.id)).toEqual(secondExpected.items.map((item) => item.id)); // la página 2 no se desplaza
  const overlap = second.items.filter((item) => first.items.some((previous) => previous.id === item.id));
  expect(overlap).toEqual([]);
  expect(second.total).toBe(first.total + 3); // el total sí refleja los eventos nuevos
});

test('aislamiento por tenant: los eventos de un tenant no aparecen en otro', async ({ request }) => {
  const mine = await auditPage(request, '?limit=100');
  const other = await auditPage(request, '?limit=100', 'admin', OTHER_TENANT);
  expect(other.total).toBe(130);
  const mineIds = new Set(mine.items.map((item) => item.id));
  // Los eventos creados en este tenant tienen ids aleatorios (AL-xxxxxxxxxx): no existen en el otro
  const created = mine.items.filter((item) => !/^AL-\d{3}$/.test(item.id));
  expect(created.length).toBeGreaterThan(5);
  expect(other.items.some((item) => created.some((event) => event.id === item.id))).toBe(false);
  expect(mineIds.size).toBe(mine.items.length);
});
