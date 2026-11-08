import { expect, test, type APIRequestContext } from '@playwright/test';
import { API_URL, loginByApi, resetTenant, type RoleName } from '../support/auth';

// Pruebas de API de Proveedores con `request`: lista ordenada, búsqueda por nombre o NIF, filtro por programa, permisos
// (cualquier rol) y aislamiento por tenant. Tenant propio: alumno17 (y alumno18 de solo lectura).

const TENANT = 'alumno17';
const OTHER_TENANT = 'alumno18';
test.describe.configure({ mode: 'serial' });

test.beforeAll(async ({ request }) => {
  await resetTenant(request, TENANT);
});
test.afterAll(async ({ request }) => {
  await resetTenant(request, TENANT);
});

interface Supplier {
  id: string;
  name: string;
  nif: string;
  contactEmail: string;
  approved: boolean;
  contracts: { programCode: string; programName: string; amountEur: number; signedAt: string }[];
}

const tokens = new Map<string, string>();
const headersFor = async (request: APIRequestContext, role: RoleName, tenant: string) => {
  const key = `${tenant}|${role}`;
  if (!tokens.has(key)) tokens.set(key, (await loginByApi(request, role, tenant)).accessToken);
  return { Authorization: `Bearer ${tokens.get(key)}`, 'x-tenant': tenant };
};
const suppliers = async (request: APIRequestContext, query = '', role: RoleName = 'admin', tenant = TENANT): Promise<Supplier[]> => {
  const response = await request.get(`${API_URL}/suppliers${query}`, { headers: await headersFor(request, role, tenant) });
  expect(response.status()).toBe(200);
  return (await response.json()) as Supplier[];
};
const ids = (items: Supplier[]): string[] => items.map((item) => item.id);

test('sin token es 401', async ({ request }) => {
  const response = await request.get(`${API_URL}/suppliers`, { headers: { 'x-tenant': TENANT } });
  expect(response.status()).toBe(401);
});

test('lista los 6 proveedores del seed ordenados por nombre, con sus contratos', async ({ request }) => {
  const all = await suppliers(request);
  expect(all).toHaveLength(6);
  expect(all.map((supplier) => supplier.name)).toEqual([
    'Aeronáutica Levante S.L.',
    'Cibertáctica Norte',
    'Electrónica del Cantábrico',
    'Logística Marítima Atlas',
    'Optrónica Meseta S.L.',
    'Sistemas Ibéricos S.A.',
  ]);
  expect(ids(all)).toEqual(['s1', 's5', 's3', 's6', 's4', 's2']);

  const [levante] = all;
  expect(levante).toMatchObject({ id: 's1', nif: 'B11111111', contactEmail: 'contacto@proveedor1.example', approved: true });
  expect(levante?.contracts).toEqual([
    { programCode: 'PRG-001', programName: expect.any(String), amountEur: 150_000, signedAt: '2025-01-15' },
    { programCode: 'PRG-002', programName: expect.any(String), amountEur: 150_000, signedAt: '2025-01-15' },
  ]);
  // 12 contratos en total, 2 por proveedor
  expect(all.flatMap((supplier) => supplier.contracts)).toHaveLength(12);
});

test('solo Cibertáctica Norte no está aprobado', async ({ request }) => {
  const all = await suppliers(request);
  expect(all.filter((supplier) => !supplier.approved).map((supplier) => supplier.id)).toEqual(['s5']);
});

test('cualquier rol puede consultarlos', async ({ request }) => {
  for (const role of ['admin', 'program_manager', 'consultant', 'auditor'] as const) {
    expect(await suppliers(request, '', role)).toHaveLength(6);
  }
});

test('q busca en nombre y NIF sin distinguir mayúsculas ni espacios de los extremos', async ({ request }) => {
  expect(ids(await suppliers(request, '?q=IBÉRICOS'))).toEqual(['s2']);
  expect(ids(await suppliers(request, '?q=b1555'))).toEqual(['s5']);
  expect(ids(await suppliers(request, `?q=${encodeURIComponent('  s.l.  ')}`))).toEqual(['s1', 's4']);
  // «ÓN» (mayúsculas y acento) encuentra «Electrónica» y «Optrónica», por orden de nombre
  expect(ids(await suppliers(request, `?q=${encodeURIComponent('ÓN')}`))).toEqual(['s3', 's4']);
});

test('q vacío o en blanco no filtra; sin coincidencias devuelve una lista vacía', async ({ request }) => {
  expect(await suppliers(request, '?q=')).toHaveLength(6);
  expect(await suppliers(request, `?q=${encodeURIComponent('   ')}`)).toHaveLength(6);
  expect(await suppliers(request, '?q=zzzzzz')).toEqual([]);
});

test('program deja solo los proveedores contratados en ese programa y se combina con q', async ({ request }) => {
  expect(ids(await suppliers(request, '?program=PRG-001'))).toEqual(['s1']);
  expect(ids(await suppliers(request, '?program=PRG-010'))).toEqual(['s5']);
  expect(await suppliers(request, '?program=PRG-013')).toEqual([]);
  expect(await suppliers(request, '?program=PRG-001&q=ibéricos')).toEqual([]);
  expect(ids(await suppliers(request, '?program=PRG-003&q=ibéricos'))).toEqual(['s2']);
  // el filtro por programa no recorta los contratos del proveedor: sigue trayendo todos
  expect((await suppliers(request, '?program=PRG-001'))[0]?.contracts).toHaveLength(2);
});

test('aislamiento: borrar un programa en un tenant solo le quita contratos a ese tenant', async ({ request }) => {
  const headers = await headersFor(request, 'admin', TENANT);
  // PRG-003 es el primer contrato de Sistemas Ibéricos (s2). (PRG-001 y PRG-002 no se pueden borrar: ver DECISIONS)
  expect((await request.delete(`${API_URL}/programs/PRG-003`, { headers })).status()).toBe(204);

  const mine = (await suppliers(request, '', 'admin', TENANT)).find((supplier) => supplier.id === 's2');
  const other = (await suppliers(request, '', 'admin', OTHER_TENANT)).find((supplier) => supplier.id === 's2');
  expect(mine?.contracts.map((contract) => contract.programCode)).toEqual(['PRG-004']);
  expect(other?.contracts.map((contract) => contract.programCode)).toEqual(['PRG-003', 'PRG-004']);
  expect(await suppliers(request, '?program=PRG-003', 'admin', TENANT)).toEqual([]);
  expect(ids(await suppliers(request, '?program=PRG-003', 'admin', OTHER_TENANT))).toEqual(['s2']);
});
