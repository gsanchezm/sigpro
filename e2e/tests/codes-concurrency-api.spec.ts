import { expect, test, type APIResponse } from '@playwright/test';
import { API_URL, resetTenant } from '../support/auth';
import { authHeaders } from '../support/admin';

// Altas simultáneas en un mismo tenant (p. ej. dos shards del curso contra el mismo alumnoNN): el código correlativo
// (PRG-025, REQ-041, NC-013, RUN-…) se calcula leyendo los existentes, así que dos peticiones a la vez pueden calcular el
// mismo. Ninguna debe fallar y los códigos deben ser todos distintos. Tenant: alumno21 (no lo usa ningún otro spec).

const TENANT = 'alumno21';
const CONCURRENT = 8;
test.describe.configure({ mode: 'serial' });

test.beforeAll(async ({ request }) => resetTenant(request, TENANT));
test.afterAll(async ({ request }) => resetTenant(request, TENANT));

/** Lanza `CONCURRENT` peticiones a la vez (no una tras otra). */
const burst = (send: (index: number) => Promise<APIResponse>): Promise<APIResponse[]> => Promise.all(Array.from({ length: CONCURRENT }, (_, index) => send(index)));

/** Todas con 201 y con un `field` (código o id) distinto en cada respuesta. */
const expectAllCreatedWithDistinct = async (responses: readonly APIResponse[], field: string): Promise<void> => {
  const statuses = responses.map((response) => response.status());
  expect(statuses, 'ninguna petición simultánea debe fallar').toEqual(statuses.map(() => 201));
  const values = await Promise.all(responses.map(async (response) => ((await response.json()) as Record<string, string>)[field]));
  expect(new Set(values).size, `${field} repetidos: ${values.join(', ')}`).toBe(CONCURRENT);
};

test('programas: altas simultáneas → todas 201 y códigos distintos', async ({ request }) => {
  const headers = await authHeaders(request, 'admin', TENANT);
  const responses = await burst((index) =>
    request.post(`${API_URL}/programs`, {
      headers,
      data: { name: `Programa simultáneo ${index}`, ownerId: 'u1', startDate: '2026-01-01', endDate: '2026-12-31', budget: 1000 },
    }),
  );
  await expectAllCreatedWithDistinct(responses, 'code');
});

test('programas: duplicar a la vez → todas 201 y códigos distintos', async ({ request }) => {
  const headers = await authHeaders(request, 'admin', TENANT);
  const responses = await burst(() => request.post(`${API_URL}/programs/PRG-001/duplicate`, { headers }));
  await expectAllCreatedWithDistinct(responses, 'code');
});

test('requisitos: altas simultáneas → todas 201 y códigos distintos', async ({ request }) => {
  const headers = await authHeaders(request, 'admin', TENANT);
  const responses = await burst((index) => request.post(`${API_URL}/requirements`, { headers, data: { programCode: 'PRG-001', title: `Requisito simultáneo ${index}` } }));
  await expectAllCreatedWithDistinct(responses, 'code');
});

test('no conformidades: altas simultáneas → todas 201 y códigos distintos', async ({ request }) => {
  const headers = await authHeaders(request, 'admin', TENANT);
  const responses = await burst((index) =>
    request.post(`${API_URL}/nc`, { headers, data: { programCode: 'PRG-001', severity: 'minor', description: `<p>Desviación simultánea número ${index}</p>` } }),
  );
  await expectAllCreatedWithDistinct(responses, 'code');
});

test('ejecuciones de prueba: registros simultáneos → todos 201 e ids distintos', async ({ request }) => {
  const headers = await authHeaders(request, 'admin', TENANT);
  const responses = await burst((index) => request.post(`${API_URL}/test-cases/TC-001/runs`, { headers, multipart: { result: 'pass', notes: `ejecución ${index}` } }));
  await expectAllCreatedWithDistinct(responses, 'id');
});
