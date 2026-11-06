import { expect, test, type APIRequestContext } from '@playwright/test';
import { API_URL, loginByApi, resetTenant, type RoleName } from '../support/auth';

// Pruebas de API de Documentos con `request`: clasificación por rol (lista, ficha, contenido, comparación, descarga),
// comparación por líneas, publicación de versiones con validación y aislamiento por tenant. Tenant propio: alumno19 (y alumno20 de lectura).

const TENANT = 'alumno19';
const OTHER_TENANT = 'alumno20';
test.describe.configure({ mode: 'serial' });

test.beforeAll(async ({ request }) => {
  await resetTenant(request, TENANT);
});

test.afterAll(async ({ request }) => {
  await resetTenant(request, TENANT);
});

const tokens = new Map<string, string>();
const headersFor = async (request: APIRequestContext, role: RoleName, tenant: string) => {
  const key = `${tenant}|${role}`;
  if (!tokens.has(key)) tokens.set(key, (await loginByApi(request, role, tenant)).accessToken);
  return { Authorization: `Bearer ${tokens.get(key)}`, 'x-tenant': tenant };
};
const get = async (request: APIRequestContext, role: RoleName, path: string, tenant = TENANT) => request.get(`${API_URL}${path}`, { headers: await headersFor(request, role, tenant) });
const post = async (request: APIRequestContext, role: RoleName, path: string, data: unknown, tenant = TENANT) => request.post(`${API_URL}${path}`, { headers: await headersFor(request, role, tenant), data });

interface Doc {
  id: string;
  programCode: string;
  title: string;
  classification: 'public' | 'restricted';
  version: number;
  updatedAt: string;
  versions?: { version: number; note: string; authorName: string | null }[];
}

test('GET /documents: los restringidos se omiten para el consultor (con hiddenCount) y se filtran por programa, clasificación y texto', async ({ request }) => {
  const admin = (await (await get(request, 'admin', '/documents')).json()) as { items: Doc[]; hiddenCount: number };
  expect(admin.items).toHaveLength(12);
  expect(admin.hiddenCount).toBe(0);
  expect(admin.items.filter((d) => d.classification === 'restricted').map((d) => d.id)).toEqual(['DOC-003', 'DOC-006', 'DOC-009', 'DOC-012']);
  expect(admin.items[0]).toMatchObject({ id: 'DOC-001', programCode: 'PRG-001', title: 'Plan de verificación PRG-001', classification: 'public', version: 3 });
  expect(admin.items.map((d) => d.version)).toEqual([3, 1, 2, 3, 1, 2, 3, 1, 2, 3, 1, 2]);
  expect(Number.isNaN(Date.parse(admin.items[0]?.updatedAt ?? ''))).toBe(false);

  for (const role of ['program_manager', 'auditor'] as const) {
    expect(((await (await get(request, role, '/documents')).json()) as { items: Doc[] }).items).toHaveLength(12);
  }
  const consultant = (await (await get(request, 'consultant', '/documents')).json()) as { items: Doc[]; hiddenCount: number };
  expect(consultant.items).toHaveLength(8);
  expect(consultant.hiddenCount).toBe(4);
  expect(consultant.items.some((d) => d.classification === 'restricted')).toBe(false);

  const filtered = (await (await get(request, 'admin', '/documents?program=PRG-002&classification=restricted')).json()) as { items: Doc[] };
  expect(filtered.items.map((d) => d.id)).toEqual(['DOC-003']);
  expect(((await (await get(request, 'consultant', '/documents?classification=restricted')).json()) as { items: Doc[]; hiddenCount: number })).toMatchObject({ items: [], hiddenCount: 4 });
  expect(((await (await get(request, 'admin', '/documents?q=especificación')).json()) as { items: Doc[] }).items).toHaveLength(6);
  expect((await request.get(`${API_URL}/documents`, { headers: { 'x-tenant': TENANT } })).status()).toBe(401);
});

test('GET /documents/:id: ficha con versiones; 403 en un restringido para el consultor, 404 si no existe', async ({ request }) => {
  const doc = (await (await get(request, 'consultant', '/documents/DOC-001')).json()) as Doc;
  expect(doc.version).toBe(3);
  expect(doc.versions?.map((v) => [v.version, v.note, v.authorName])).toEqual([
    [1, 'Versión inicial', 'Javier Ortega'],
    [2, 'Ajuste de alcance y responsabilidades', 'Javier Ortega'],
    [3, 'Nuevos criterios de aceptación y anexos', 'Javier Ortega'],
  ]);

  const forbidden = await get(request, 'consultant', '/documents/DOC-003');
  expect(forbidden.status()).toBe(403);
  expect(((await forbidden.json()) as { code: string }).code).toBe('forbidden');
  for (const role of ['admin', 'program_manager', 'auditor'] as const) expect((await get(request, role, '/documents/DOC-003')).status()).toBe(200);
  expect((await get(request, 'admin', '/documents/DOC-999')).status()).toBe(404);
});

test('GET /documents/:id/content: páginas de 12 líneas, versión por defecto = la última, 404 si la versión no existe', async ({ request }) => {
  const latest = (await (await get(request, 'consultant', '/documents/DOC-001/content')).json()) as { version: number; pages: string[][]; title: string; classification: string; note: string };
  expect(latest).toMatchObject({ version: 3, title: 'Plan de verificación PRG-001', classification: 'public', note: 'Nuevos criterios de aceptación y anexos' });
  expect(latest.pages.map((page) => page.length)).toEqual([12, 9]);
  expect(latest.pages[1]).toContain('Anexo A: matriz de trazabilidad.');

  const first = (await (await get(request, 'consultant', '/documents/DOC-001/content?version=1')).json()) as { version: number; pages: string[][] };
  expect(first.version).toBe(1);
  expect(first.pages.map((page) => page.length)).toEqual([12, 6]);
  expect(first.pages.flat()).toContain('Se excluyen los equipos de apoyo en tierra.');

  expect((await get(request, 'consultant', '/documents/DOC-001/content?version=99')).status()).toBe(404);
  expect((await get(request, 'consultant', '/documents/DOC-003/content')).status()).toBe(403);
  expect((await get(request, 'auditor', '/documents/DOC-003/content?version=2')).status()).toBe(200);
});

test('GET /documents/:id/compare: filas alineadas y estadísticas; 422 si son la misma versión o no son números', async ({ request }) => {
  const result = (await (await get(request, 'consultant', '/documents/DOC-001/compare?from=2&to=3')).json()) as {
    from: number;
    to: number;
    stats: { added: number; removed: number; changed: number; same: number };
    rows: { kind: string; left: { line: number; text: string } | null; right: { line: number; text: string } | null }[];
  };
  expect(result).toMatchObject({ from: 2, to: 3, stats: { added: 3, removed: 1, changed: 1 } });
  expect(result.stats.same).toBe(result.rows.filter((row) => row.kind === 'same').length);
  const changed = result.rows.find((row) => row.kind === 'changed');
  expect(changed?.left?.text).toBe('Todas las pruebas deben terminar en estado superado.');
  expect(changed?.right?.text).toBe('Al menos el 95 % de las pruebas debe terminar en estado superado.');
  expect(result.rows.filter((row) => row.kind === 'added').map((row) => row.right?.text)).toEqual(['', '5. Anexos', 'Anexo A: matriz de trazabilidad.']);
  expect(result.rows.find((row) => row.kind === 'removed')?.right).toBeNull();

  const same = await get(request, 'consultant', '/documents/DOC-001/compare?from=2&to=2');
  expect(same.status()).toBe(422);
  expect(((await same.json()) as { errors: Record<string, string> }).errors).toEqual({ to: 'compareSame' });
  expect((await get(request, 'consultant', '/documents/DOC-001/compare?from=a&to=3')).status()).toBe(422);
  expect((await get(request, 'consultant', '/documents/DOC-001/compare?from=1&to=9')).status()).toBe(404);
  expect((await get(request, 'consultant', '/documents/DOC-003/compare?from=1&to=2')).status()).toBe(403);
});

test('GET /documents/:id/download: PDF de la versión pedida con su nombre; permisos como en la ficha', async ({ request }) => {
  const latest = await get(request, 'consultant', '/documents/DOC-004/download');
  expect(latest.status()).toBe(200);
  expect(latest.headers()['content-type']).toBe('application/pdf');
  expect(latest.headers()['content-disposition']).toContain('attachment; filename="DOC-004-v3.pdf"');
  const text = (await latest.body()).toString('latin1');
  expect(text.startsWith('%PDF-1.4')).toBe(true);
  expect(text).toContain('Especificaci\xf3n t\xe9cnica PRG-002');
  expect(text).toContain('DOC-004 \xb7 Programa PRG-002 \xb7 Versi\xf3n 3 \xb7 P\xdaBLICO');
  expect(text).toContain('Anexo A: matriz de trazabilidad.');

  const first = await get(request, 'consultant', '/documents/DOC-004/download?version=1');
  expect(first.headers()['content-disposition']).toContain('DOC-004-v1.pdf');
  expect((await first.body()).toString('latin1')).not.toContain('Anexo A');

  expect((await get(request, 'consultant', '/documents/DOC-003/download')).status()).toBe(403);
  const restricted = await get(request, 'auditor', '/documents/DOC-003/download');
  expect((await restricted.body()).toString('latin1')).toContain('RESTRINGIDO');
  expect((await get(request, 'admin', '/documents/DOC-004/download?version=9')).status()).toBe(404);
});

test('POST /documents/:id/versions: solo admin y gestor; valida el contenido; la versión nueva pasa a ser la última', async ({ request }) => {
  const body = { lines: ['Especificación técnica PRG-001', '', '1. Objeto', 'Texto de la versión nueva.'], note: ' Reescritura del objeto ' };
  expect((await post(request, 'consultant', '/documents/DOC-002/versions', body)).status()).toBe(403);
  expect((await post(request, 'auditor', '/documents/DOC-002/versions', body)).status()).toBe(403);

  const errorsOf = async (data: unknown) => {
    const response = await post(request, 'admin', '/documents/DOC-002/versions', data);
    expect(response.status()).toBe(422);
    return ((await response.json()) as { errors: Record<string, string> }).errors;
  };
  expect(await errorsOf({ lines: [] })).toEqual({ lines: 'linesRequired' });
  expect(await errorsOf({ lines: Array.from({ length: 81 }, (_, i) => `l${i}`) })).toEqual({ lines: 'linesMax' });
  expect(await errorsOf({ lines: ['x'.repeat(201)] })).toEqual({ 'lines.0': 'lineLong' });
  expect(await errorsOf({ lines: ['ok'], note: 'n'.repeat(201) })).toEqual({ note: 'noteLong' });

  const published = await post(request, 'program_manager', '/documents/DOC-002/versions', body);
  expect(published.status()).toBe(201);
  const doc = (await published.json()) as Doc;
  expect(doc.version).toBe(2);
  expect(doc.versions?.map((v) => [v.version, v.note, v.authorName])).toEqual([
    [1, 'Versión inicial', 'Javier Ortega'],
    [2, 'Reescritura del objeto', 'Javier Ortega'],
  ]);

  const content = (await (await get(request, 'consultant', '/documents/DOC-002/content')).json()) as { version: number; pages: string[][] };
  expect(content).toMatchObject({ version: 2, pages: [['Especificación técnica PRG-001', '', '1. Objeto', 'Texto de la versión nueva.']] });
  const diff = (await (await get(request, 'consultant', '/documents/DOC-002/compare?from=1&to=2')).json()) as { stats: { added: number; removed: number; changed: number } };
  expect(diff.stats.removed).toBeGreaterThan(0); // de 18 líneas a 4
  expect(diff.stats.changed).toBe(1); // «Texto de la versión nueva.» ocupa el sitio de la línea del objeto

  // El admin también puede, y sobre un restringido
  expect((await post(request, 'admin', '/documents/DOC-003/versions', { lines: ['Contenido restringido nuevo'] })).status()).toBe(201);
  expect((await post(request, 'admin', '/documents/DOC-999/versions', body)).status()).toBe(404);
});

test('aislamiento por tenant: publicar en un tenant no cambia el otro', async ({ request }) => {
  const other = (await (await get(request, 'admin', '/documents/DOC-002', OTHER_TENANT)).json()) as Doc;
  expect(other.version).toBe(1);
  const content = (await (await get(request, 'admin', '/documents/DOC-002/content', OTHER_TENANT)).json()) as { pages: string[][] };
  expect(content.pages.flat()).not.toContain('Texto de la versión nueva.');
  expect((await get(request, 'admin', '/documents/DOC-002/compare?from=1&to=2', OTHER_TENANT)).status()).toBe(404);
});
