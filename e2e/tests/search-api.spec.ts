import { expect, test, type APIRequestContext } from '@playwright/test';
import { API_URL, loginByApi, resetTenant, type RoleName } from '../support/auth';

// Pruebas de API de la búsqueda global agrupada con `request`: mínimo de 2 caracteres (422), grupos en orden fijo y solo los
// que tienen resultados, máximo 5 ítems por grupo con el total real, búsqueda sobre texto plano, documentos restringidos por
// rol y aislamiento por tenant. Tenant propio: alumno15 (y alumno18 de solo lectura).
// Seed: PRG-005 = «Centro de control de misión CCM»; documentos restringidos DOC-003, 006, 009 y 012.

const TENANT = 'alumno15';
const OTHER_TENANT = 'alumno18';
const KIND_ORDER = ['program', 'requirement', 'testcase', 'nc', 'document'];
test.describe.configure({ mode: 'serial' });

test.beforeAll(async ({ request }) => {
  await resetTenant(request, TENANT);
});
test.afterAll(async ({ request }) => {
  await resetTenant(request, TENANT);
});

interface Item {
  id: string;
  title: string;
  subtitle: string;
  href: string;
}
interface Group {
  kind: string;
  total: number;
  items: Item[];
}
interface SearchBody {
  query: string;
  groups: Group[];
}

const tokens = new Map<string, string>();
const headersFor = async (request: APIRequestContext, role: RoleName, tenant: string) => {
  const key = `${tenant}|${role}`;
  if (!tokens.has(key)) tokens.set(key, (await loginByApi(request, role, tenant)).accessToken);
  return { Authorization: `Bearer ${tokens.get(key)}`, 'x-tenant': tenant };
};
const rawSearch = async (request: APIRequestContext, q: string | null, role: RoleName = 'admin', tenant = TENANT) =>
  request.get(`${API_URL}/search${q === null ? '' : `?q=${encodeURIComponent(q)}`}`, { headers: await headersFor(request, role, tenant) });
const search = async (request: APIRequestContext, q: string, role: RoleName = 'admin', tenant = TENANT): Promise<SearchBody> => {
  const response = await rawSearch(request, q, role, tenant);
  expect(response.status()).toBe(200);
  return (await response.json()) as SearchBody;
};
const group = (body: SearchBody, kind: string): Group | undefined => body.groups.find((candidate) => candidate.kind === kind);
const kinds = (body: SearchBody): string[] => body.groups.map((candidate) => candidate.kind);

test('sin token es 401', async ({ request }) => {
  expect((await request.get(`${API_URL}/search?q=ccm`, { headers: { 'x-tenant': TENANT } })).status()).toBe(401);
});

test('el texto debe tener al menos 2 caracteres: 422 con errors.q = minChars', async ({ request }) => {
  for (const q of [null, '', 'a', '   a   ', '  ']) {
    const response = await rawSearch(request, q);
    expect(response.status(), `q=${JSON.stringify(q)}`).toBe(422);
    expect(((await response.json()) as { errors: Record<string, string> }).errors).toEqual({ q: 'minChars' });
  }
  // El límite: 2 caracteres ya vale (y se devuelve el texto recortado)
  const body = await search(request, '  cc  ');
  expect(body.query).toBe('cc');
});

test('cualquier rol puede buscar', async ({ request }) => {
  for (const role of ['admin', 'program_manager', 'consultant', 'auditor'] as const) {
    expect(kinds(await search(request, 'ccm', role))).toEqual(['program']);
  }
});

test('un resultado trae id, título, subtítulo y el enlace a su pantalla', async ({ request }) => {
  const program = group(await search(request, 'ccm'), 'program');
  expect(program).toEqual({ kind: 'program', total: 1, items: [{ id: 'PRG-005', title: 'Centro de control de misión CCM', subtitle: expect.any(String), href: '/programs/PRG-005' }] });

  const body = await search(request, 'disponibilidad');
  expect(kinds(body)).toEqual(['requirement', 'testcase']);
  expect(group(body, 'requirement')?.items[0]).toMatchObject({ id: 'REQ-001', subtitle: 'PRG-001', href: '/programs/PRG-001/requirements?select=REQ-001' });
  expect(group(body, 'testcase')?.items[0]).toMatchObject({ id: 'TC-001', href: '/verification/TC-001' });

  expect(group(await search(request, 'nc-001'), 'nc')?.items[0]).toMatchObject({ id: 'NC-001', href: '/nc/NC-001' });
  expect(group(await search(request, 'doc-001'), 'document')?.items[0]).toMatchObject({ id: 'DOC-001', href: '/documents/DOC-001' });
});

test('solo hay grupos con resultados y siempre en orden fijo (programas, requisitos, casos, NC, documentos)', async ({ request }) => {
  for (const q of ['sistema', 'verific', 'prg', 'plan', 'desviación']) {
    const body = await search(request, q);
    expect(body.groups.length, q).toBeGreaterThan(0);
    const order = kinds(body).map((kind) => KIND_ORDER.indexOf(kind));
    expect(order, q).toEqual([...order].sort((a, b) => a - b));
    expect(body.groups.every((candidate) => candidate.items.length > 0), q).toBe(true);
  }
  expect(await search(request, 'zzzzzz')).toEqual({ query: 'zzzzzz', groups: [] });
});

test('como mucho 5 ítems por grupo, por código, y el total cuenta todas las coincidencias', async ({ request }) => {
  const body = await search(request, 'sistema');
  const programs = group(body, 'program');
  expect(programs?.total).toBe(24);
  expect(programs?.items.map((item) => item.id)).toEqual(['PRG-001', 'PRG-002', 'PRG-003', 'PRG-004', 'PRG-005']);
  expect(group(body, 'requirement')).toMatchObject({ total: 40 });
  for (const candidate of body.groups) expect(candidate.items.length).toBeLessThanOrEqual(5);
  // NC: 9 coinciden con «nc-00» y solo se devuelven 5
  expect(group(await search(request, 'nc-00'), 'nc')).toMatchObject({ total: 9 });
});

test('no distingue mayúsculas ni acentos escritos en mayúscula', async ({ request }) => {
  expect(await search(request, 'CCM')).toEqual({ ...(await search(request, 'ccm')), query: 'CCM' });
  expect(group(await search(request, 'MISIÓN'), 'program')?.items.map((item) => item.id)).toContain('PRG-005');
});

test('busca sobre texto plano: la descripción en HTML no coincide con sus propias etiquetas', async ({ request }) => {
  const created = await request.post(`${API_URL}/nc`, {
    headers: await headersFor(request, 'admin', TENANT),
    data: { programCode: 'PRG-001', severity: 'minor', description: '<p>Incidencia en el <strong>enlace óptico</strong> del radar</p>' },
  });
  expect(created.status()).toBe(201);
  const { code } = (await created.json()) as { code: string };

  const byText = group(await search(request, 'enlace óptico'), 'nc');
  expect(byText?.items.map((item) => item.id)).toEqual([code]);
  expect(byText?.items[0]?.title).toBe('Incidencia en el enlace óptico del radar');
  expect(group(await search(request, 'strong'), 'nc')).toBeUndefined();
  expect(group(await search(request, '<p>'), 'nc')).toBeUndefined();
});

test('los documentos restringidos solo aparecen para admin, gestor y auditor', async ({ request }) => {
  const visible = async (role: RoleName): Promise<{ ids: string[]; total: number }> => {
    const documents = group(await search(request, 'especificación', role), 'document');
    return { ids: documents?.items.map((item) => item.id) ?? [], total: documents?.total ?? 0 };
  };
  const admin = await visible('admin');
  expect(admin.total).toBe(6);
  expect(admin.ids).toContain('DOC-006'); // restringido
  for (const role of ['program_manager', 'auditor'] as const) expect((await visible(role)).total).toBe(6);

  const consultant = await visible('consultant');
  expect(consultant.total).toBe(4);
  expect(consultant.ids).not.toContain('DOC-006');
  expect(consultant.ids).toEqual(['DOC-002', 'DOC-004', 'DOC-008', 'DOC-010']);
  // Buscar un restringido por su código tampoco lo revela
  expect(group(await search(request, 'doc-006', 'consultant'), 'document')).toBeUndefined();
  expect(group(await search(request, 'doc-006', 'admin'), 'document')?.items[0]?.id).toBe('DOC-006');
});

test('aislamiento: lo que cambia en un tenant no se ve desde otro (y la cabecera x-tenant no cambia de tenant con token)', async ({ request }) => {
  const headers = await headersFor(request, 'admin', TENANT);
  expect((await request.delete(`${API_URL}/programs/PRG-003`, { headers })).status()).toBe(204);

  expect(group(await search(request, 'prg-003', 'admin', TENANT), 'program')).toBeUndefined();
  expect(group(await search(request, 'prg-003', 'admin', OTHER_TENANT), 'program')?.items.map((item) => item.id)).toEqual(['PRG-003']);

  // Con el token de alumno15 y la cabecera de alumno18 se sigue viendo alumno15
  const crossed = await request.get(`${API_URL}/search?q=prg-003`, { headers: { Authorization: headers.Authorization, 'x-tenant': OTHER_TENANT } });
  expect(((await crossed.json()) as SearchBody).groups).toEqual([]);
});
