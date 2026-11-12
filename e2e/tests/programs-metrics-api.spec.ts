import { expect, test } from '@playwright/test';
import { API_URL, resetTenant } from '../support/auth';
import { authHeaders } from '../support/admin';

// API del resumen de Misión que alimenta las tarjetas de métricas de Programas. Tenant: alumno21 (solo lectura).

const TENANT = 'alumno21';
test.beforeAll(async ({ request }) => resetTenant(request, TENANT));

interface Summary {
  kpis: { programsTotal: number; activePrograms: number; programsProgress: number; ncOpen: number; ncTotal: number };
}

test('GET /mission/summary: programsProgress es la media del avance de todos los programas del tenant', async ({ request }) => {
  const headers = await authHeaders(request, 'admin', TENANT);
  const list = (await (await request.get(`${API_URL}/programs?pageSize=100`, { headers })).json()) as { items: { progress: number }[]; totalAll: number };
  const average = Math.round(list.items.reduce((sum, program) => sum + program.progress, 0) / list.items.length);

  const summary = (await (await request.get(`${API_URL}/mission/summary`, { headers })).json()) as Summary;
  expect(summary.kpis.programsProgress).toBe(average);
  expect(summary.kpis.programsTotal).toBe(list.totalAll);
});
