import { expect, test } from '@playwright/test';
import { API_URL, loginByApi, resetTenant } from '../support/auth';

// Regresión (fase 3): borrar CUALQUIER programa del seed responde 204. En la fase 2, PRG-001 y PRG-002 daban 500 porque una NC
// enlazaba una ejecución de un caso de OTRO programa y la clave foránea (NO ACTION) bloqueaba el borrado en cascada.
// Tenant propio: alumno20. Solo API: no toca la interfaz.

const TENANT = 'alumno20';
test.describe.configure({ mode: 'serial' });

test.beforeAll(async ({ request }) => {
  await resetTenant(request, TENANT);
});
test.afterAll(async ({ request }) => {
  await resetTenant(request, TENANT);
});

test('borrar cada uno de los 24 programas del seed responde 204 y se lleva sus NC y ejecuciones', async ({ request }) => {
  const { accessToken } = await loginByApi(request, 'admin', TENANT);
  const headers = { Authorization: `Bearer ${accessToken}`, 'x-tenant': TENANT };

  const before = await request.get(`${API_URL}/nc`, { headers });
  expect(((await before.json()) as { total: number }).total).toBe(12);

  for (let n = 1; n <= 24; n += 1) {
    const code = `PRG-${String(n).padStart(3, '0')}`;
    const response = await request.delete(`${API_URL}/programs/${code}`, { headers });
    expect(response.status(), `DELETE ${code}`).toBe(204);
    expect((await request.get(`${API_URL}/programs/${code}`, { headers })).status()).toBe(404);
  }

  const after = await request.get(`${API_URL}/nc`, { headers });
  expect(((await after.json()) as { total: number }).total).toBe(0);
  const programs = await request.get(`${API_URL}/programs`, { headers });
  expect(((await programs.json()) as { total: number }).total).toBe(0);
});
