import { expect, test, type APIRequestContext } from '@playwright/test';
import { API_URL, loginByApi, resetTenant, type RoleName } from '../support/auth';

// Pruebas de API de Requisitos con `request` (sin UI): permisos por rol, máquina de estados, saneado del HTML,
// reordenación, enlaces con casos de prueba, borrado en cascada y aislamiento por tenant. Tenant propio: alumno10.

const TENANT = 'alumno10';
const OTHER_TENANT = 'alumno11';
test.describe.configure({ mode: 'serial' });

test.beforeAll(async ({ request }) => {
  await resetTenant(request, TENANT);
});

test.afterAll(async ({ request }) => {
  await resetTenant(request, TENANT);
});

interface Requirement {
  code: string;
  programCode: string;
  parentCode: string | null;
  title: string;
  description: string;
  priority: string;
  state: string;
  tags: string[];
  position: number;
  testCaseCodes: string[];
}

const tokens = new Map<string, string>();
const call = async (request: APIRequestContext, role: RoleName, method: 'get' | 'post' | 'patch' | 'put' | 'delete', path: string, data?: unknown, tenant = TENANT) => {
  const key = `${tenant}|${role}`;
  if (!tokens.has(key)) tokens.set(key, (await loginByApi(request, role, tenant)).accessToken);
  return request[method](`${API_URL}${path}`, { headers: { Authorization: `Bearer ${tokens.get(key)}`, 'x-tenant': tenant }, data });
};

const list = async (request: APIRequestContext, program = 'PRG-002') => ((await (await call(request, 'admin', 'get', `/programs/${program}/requirements`)).json()) as { items: Requirement[] }).items;

test('GET /programs/:code/requirements devuelve la lista plana con árbol, etiquetas, orden y casos enlazados', async ({ request }) => {
  const response = await call(request, 'auditor', 'get', '/programs/PRG-002/requirements');
  expect(response.status()).toBe(200);
  const body = (await response.json()) as { program: { code: string; name: string }; items: Requirement[] };
  expect(body.program).toEqual({ code: 'PRG-002', name: 'Radar de vigilancia costera RVC-2' });
  expect(body.items).toHaveLength(14);
  expect(body.items.find((r) => r.code === 'REQ-017')).toMatchObject({
    parentCode: 'REQ-015',
    state: 'draft',
    priority: 'low',
    tags: ['security'],
    testCaseCodes: ['TC-012'],
    position: 1,
    description: '<p>El sistema debe cumplir el requisito 017 de <strong>disponibilidad</strong> en condiciones nominales.</p>',
  });
  expect((await call(request, 'admin', 'get', '/programs/PRG-999/requirements')).status()).toBe(404);
  expect((await call(request, 'admin', 'get', '/requirements/REQ-999')).status()).toBe(404);
  expect((await list(request, 'PRG-004'))).toEqual([]);
});

test('POST /requirements: alta en borrador al final de sus hermanos, con validación 422 y permisos', async ({ request }) => {
  const created = await call(request, 'consultant', 'post', '/requirements', { programCode: 'PRG-002', parentCode: 'REQ-025', title: 'Requisito creado por API', priority: 'high', tags: ['security', 'security', 'safety'] });
  expect(created.status()).toBe(201);
  const requirement = (await created.json()) as Requirement;
  expect(requirement).toMatchObject({ code: 'REQ-041', state: 'draft', parentCode: 'REQ-025', position: 2, priority: 'high', tags: ['security', 'safety'] });

  const short = await call(request, 'consultant', 'post', '/requirements', { programCode: 'PRG-002', title: 'ab' });
  expect(short.status()).toBe(422);
  expect(((await short.json()) as { errors: Record<string, string> }).errors).toEqual({ title: 'titleShort' });
  const badTag = await call(request, 'consultant', 'post', '/requirements', { programCode: 'PRG-002', title: 'Etiqueta inventada', tags: ['inexistente'] });
  expect(badTag.status()).toBe(422);
  // El padre debe ser del mismo programa
  const badParent = await call(request, 'admin', 'post', '/requirements', { programCode: 'PRG-002', parentCode: 'REQ-001', title: 'Padre de otro programa' });
  expect(badParent.status()).toBe(422);
  expect(((await badParent.json()) as { errors: Record<string, string> }).errors).toEqual({ parentCode: 'badParent' });
  expect((await call(request, 'admin', 'post', '/requirements', { programCode: 'PRG-999', title: 'Programa inexistente' })).status()).toBe(404);
  expect((await call(request, 'auditor', 'post', '/requirements', { programCode: 'PRG-002', title: 'El auditor no crea' })).status()).toBe(403);
});

test('la descripción HTML se sanea en el servidor (lista blanca, sin scripts ni atributos)', async ({ request }) => {
  const response = await call(request, 'admin', 'patch', '/requirements/REQ-016', {
    description: '<div onclick="alert(1)"><b>negrita</b> y <i>cursiva</i></div><script>alert(1)</script><a href="javascript:alert(1)">enlace</a><img src=x onerror=alert(1)>',
  });
  expect(response.status()).toBe(200);
  expect(((await response.json()) as Requirement).description).toBe('<p><strong>negrita</strong> y <em>cursiva</em></p>enlace');
});

test('PATCH: editar el texto devuelve a borrador; etiquetas y prioridad no; 422 y permisos', async ({ request }) => {
  // REQ-021 está aprobado en el seed
  const tagsOnly = await call(request, 'consultant', 'patch', '/requirements/REQ-021', { priority: 'high', tags: ['usability', 'usability', 'interface'] });
  expect(tagsOnly.status()).toBe(200);
  expect(await tagsOnly.json()).toMatchObject({ state: 'approved', priority: 'high', tags: ['usability', 'interface'] });

  const sameTitle = await call(request, 'consultant', 'patch', '/requirements/REQ-021', { title: 'Interfaz operador del subsistema 021' });
  expect(((await sameTitle.json()) as Requirement).state).toBe('approved'); // mismo texto: no cuenta como edición

  const retitled = await call(request, 'consultant', 'patch', '/requirements/REQ-021', { title: 'Interfaz operador del subsistema 021 (rev. 2)' });
  expect(await retitled.json()).toMatchObject({ state: 'draft', title: 'Interfaz operador del subsistema 021 (rev. 2)' });

  expect((await call(request, 'consultant', 'patch', '/requirements/REQ-021', {})).status()).toBe(422);
  expect((await call(request, 'consultant', 'patch', '/requirements/REQ-021', { title: 'x' })).status()).toBe(422);
  expect((await call(request, 'auditor', 'patch', '/requirements/REQ-021', { priority: 'low' })).status()).toBe(403);
  expect((await call(request, 'admin', 'patch', '/requirements/REQ-999', { priority: 'low' })).status()).toBe(404);
});

test('POST /transition: solo los pasos de la máquina de estados y solo con el permiso del paso', async ({ request }) => {
  // REQ-016 está en borrador
  const skip = await call(request, 'admin', 'post', '/requirements/REQ-016/transition', { to: 'validated' });
  expect(skip.status()).toBe(409);
  expect(((await skip.json()) as { code: string }).code).toBe('invalid_transition');
  expect((await call(request, 'admin', 'post', '/requirements/REQ-016/transition', { to: 'draft' })).status()).toBe(409); // ya está en borrador
  expect((await call(request, 'admin', 'post', '/requirements/REQ-016/transition', { to: 'hecho' })).status()).toBe(422);

  expect((await call(request, 'consultant', 'post', '/requirements/REQ-016/transition', { to: 'approved' })).status()).toBe(403);
  expect((await call(request, 'auditor', 'post', '/requirements/REQ-016/transition', { to: 'approved' })).status()).toBe(403);
  const approved = await call(request, 'program_manager', 'post', '/requirements/REQ-016/transition', { to: 'approved' });
  expect(approved.status()).toBe(200);
  expect(((await approved.json()) as Requirement).state).toBe('approved');

  expect((await call(request, 'program_manager', 'post', '/requirements/REQ-016/transition', { to: 'verified' })).status()).toBe(403);
  expect((await call(request, 'consultant', 'post', '/requirements/REQ-016/transition', { to: 'verified' })).status()).toBe(200);
  expect((await call(request, 'consultant', 'post', '/requirements/REQ-016/transition', { to: 'validated' })).status()).toBe(403);
  expect((await call(request, 'auditor', 'post', '/requirements/REQ-016/transition', { to: 'validated' })).status()).toBe(200);
  expect((await call(request, 'auditor', 'post', '/requirements/REQ-016/transition', { to: 'draft' })).status()).toBe(403);
  expect((await call(request, 'program_manager', 'post', '/requirements/REQ-016/transition', { to: 'draft' })).status()).toBe(200);
  // admin puede todos los pasos
  expect((await call(request, 'admin', 'post', '/requirements/REQ-016/transition', { to: 'approved' })).status()).toBe(200);
  expect((await call(request, 'admin', 'post', '/requirements/REQ-016/transition', { to: 'verified' })).status()).toBe(200);
  expect((await call(request, 'admin', 'post', '/requirements/REQ-016/transition', { to: 'validated' })).status()).toBe(200);
});

test('POST /move: solo entre hermanos, renumera posiciones y devuelve la lista del programa', async ({ request }) => {
  // Hermanos de REQ-015: REQ-016, 017, 019 (posiciones 0, 1, 2)
  const moved = await call(request, 'consultant', 'post', '/requirements/REQ-019/move', { targetCode: 'REQ-016', placement: 'before' });
  expect(moved.status()).toBe(200);
  const items = ((await moved.json()) as { items: Requirement[] }).items;
  const under015 = items.filter((r) => r.parentCode === 'REQ-015').sort((a, b) => a.position - b.position);
  expect(under015.map((r) => [r.code, r.position])).toEqual([['REQ-019', 0], ['REQ-016', 1], ['REQ-017', 2]]);

  const after = await call(request, 'consultant', 'post', '/requirements/REQ-019/move', { targetCode: 'REQ-017', placement: 'after' });
  expect(((await after.json()) as { items: Requirement[] }).items.filter((r) => r.parentCode === 'REQ-015').sort((a, b) => a.position - b.position).map((r) => r.code)).toEqual(['REQ-016', 'REQ-017', 'REQ-019']);

  const crossParent = await call(request, 'consultant', 'post', '/requirements/REQ-021/move', { targetCode: 'REQ-016', placement: 'before' });
  expect(crossParent.status()).toBe(422);
  expect(((await crossParent.json()) as { errors: Record<string, string> }).errors).toEqual({ targetCode: 'badTarget' });
  expect((await call(request, 'consultant', 'post', '/requirements/REQ-016/move', { targetCode: 'REQ-016', placement: 'before' })).status()).toBe(422);
  expect((await call(request, 'consultant', 'post', '/requirements/REQ-016/move', { targetCode: 'REQ-017', placement: 'inside' })).status()).toBe(422);
  expect((await call(request, 'auditor', 'post', '/requirements/REQ-016/move', { targetCode: 'REQ-017', placement: 'after' })).status()).toBe(403);
});

test('enlaces con casos de prueba: idempotentes, solo del mismo programa, reflejados en la matriz', async ({ request }) => {
  expect((await call(request, 'consultant', 'put', '/requirements/REQ-028/tests/TC-010')).status()).toBe(204);
  expect((await call(request, 'consultant', 'put', '/requirements/REQ-028/tests/TC-010')).status()).toBe(204); // idempotente

  const matrix = (await (await call(request, 'auditor', 'get', '/programs/PRG-002/traceability')).json()) as {
    requirements: { code: string }[];
    testCases: { code: string }[];
    links: { requirementCode: string; testCaseCode: string }[];
  };
  expect(matrix.requirements).toHaveLength(15); // 14 + REQ-041 creado antes
  expect(matrix.testCases.map((t) => t.code)).toEqual(['TC-010', 'TC-011', 'TC-012', 'TC-013', 'TC-014', 'TC-015', 'TC-016', 'TC-017', 'TC-018']);
  expect(matrix.links.filter((l) => l.requirementCode === 'REQ-028')).toEqual([{ requirementCode: 'REQ-028', testCaseCode: 'TC-010' }]);

  const otherProgram = await call(request, 'consultant', 'put', '/requirements/REQ-028/tests/TC-001');
  expect(otherProgram.status()).toBe(422);
  expect(((await otherProgram.json()) as { errors: Record<string, string> }).errors).toEqual({ testCaseCode: 'differentProgram' });
  expect((await call(request, 'consultant', 'put', '/requirements/REQ-028/tests/TC-999')).status()).toBe(404);
  expect((await call(request, 'auditor', 'put', '/requirements/REQ-028/tests/TC-011')).status()).toBe(403);

  expect((await call(request, 'consultant', 'delete', '/requirements/REQ-028/tests/TC-010')).status()).toBe(204);
  expect((await call(request, 'consultant', 'delete', '/requirements/REQ-028/tests/TC-010')).status()).toBe(204);
  expect((await list(request)).find((r) => r.code === 'REQ-028')?.testCaseCodes).toEqual([]);
});

test('DELETE: solo admin y gestor; elimina también a los descendientes y sus enlaces', async ({ request }) => {
  expect((await call(request, 'consultant', 'delete', '/requirements/REQ-025')).status()).toBe(403);
  expect((await call(request, 'auditor', 'delete', '/requirements/REQ-025')).status()).toBe(403);
  expect((await call(request, 'program_manager', 'delete', '/requirements/REQ-025')).status()).toBe(204);
  for (const code of ['REQ-025', 'REQ-026', 'REQ-027', 'REQ-028', 'REQ-041']) expect((await call(request, 'admin', 'get', `/requirements/${code}`)).status(), code).toBe(404);
  expect((await list(request)).map((r) => r.code)).not.toContain('REQ-027');
  expect((await call(request, 'admin', 'delete', '/requirements/REQ-025')).status()).toBe(404);
});

test('aislamiento por tenant: lo creado en un tenant no existe en otro', async ({ request }) => {
  const created = await call(request, 'admin', 'post', '/requirements', { programCode: 'PRG-001', title: 'Solo existe en alumno10' });
  const { code } = (await created.json()) as Requirement;
  expect((await call(request, 'admin', 'get', `/requirements/${code}`)).status()).toBe(200);
  expect((await call(request, 'admin', 'get', `/requirements/${code}`, undefined, OTHER_TENANT)).status()).toBe(404);
  // El token de un tenant tampoco permite tocar datos de otro aunque se mande su cabecera
  const crossed = await request.get(`${API_URL}/requirements/${code}`, { headers: { Authorization: `Bearer ${tokens.get(`${TENANT}|admin`)}`, 'x-tenant': OTHER_TENANT } });
  expect(crossed.status()).toBe(200); // el JWT manda: sigue viendo SU tenant
  expect(((await crossed.json()) as Requirement).title).toBe('Solo existe en alumno10');
});
