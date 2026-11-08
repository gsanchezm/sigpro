import { expect, test } from '@playwright/test';
import { API_URL, resetTenant, type RoleName } from '../support/auth';
import { authHeaders, chaosOff, loginWithPassword, readConfig } from '../support/admin';

// Spec de la API de Administración (fase 3): usuarios (GET/PATCH /admin/users con 401/403/404/409/422), auditoría de cada
// cambio, aislamiento entre tenants y validación del caos (PATCH /admin/chaos). Tenants: alumno05 (escritura) y alumno06 (solo lectura).

const TENANT = 'alumno05';
const OTHER = 'alumno06';
test.describe.configure({ mode: 'serial' });

test.beforeAll(async ({ request }) => {
  for (const tenant of [TENANT, OTHER]) {
    await resetTenant(request, tenant);
    await chaosOff(request, tenant);
  }
});

test.afterAll(async ({ request }) => {
  for (const tenant of [TENANT, OTHER]) {
    await chaosOff(request, tenant);
    await resetTenant(request, tenant);
  }
});

interface UserDto {
  id: string;
  name: string;
  email: string;
  role: string;
  active: boolean;
  locked: boolean;
  pending: boolean;
  org: string | null;
}

const listUsers = async (request: Parameters<typeof authHeaders>[0], tenant: string): Promise<UserDto[]> => {
  const response = await request.get(`${API_URL}/admin/users`, { headers: await authHeaders(request, 'admin', tenant) });
  expect(response.status()).toBe(200);
  return (await response.json()) as UserDto[];
};

test('seguridad: sin token 401 y solo admin puede listar o modificar usuarios (403)', async ({ request }) => {
  expect((await request.get(`${API_URL}/admin/users`, { headers: { 'x-tenant': TENANT } })).status()).toBe(401);
  for (const role of ['program_manager', 'consultant', 'auditor'] as RoleName[]) {
    const headers = await authHeaders(request, role, TENANT);
    expect((await request.get(`${API_URL}/admin/users`, { headers })).status(), `GET como ${role}`).toBe(403);
    const patch = await request.patch(`${API_URL}/admin/users/u4`, { headers, data: { active: false } });
    expect(patch.status(), `PATCH como ${role}`).toBe(403);
    expect(((await patch.json()) as { code: string }).code).toBe('forbidden');
  }
});

test('GET /admin/users: los 7 usuarios del tenant con su estado y sin datos sensibles', async ({ request }) => {
  const users = await listUsers(request, TENANT);
  expect(users.map((user) => user.id)).toEqual(['u1', 'u2', 'u3', 'u4', 'u5', 'u6', 'u7']);
  expect(users.map((user) => user.role)).toEqual(['admin', 'program_manager', 'consultant', 'auditor', 'consultant', 'consultant', 'admin']);
  expect(users.find((user) => user.id === 'u5')).toMatchObject({ locked: true, pending: false, active: true });
  expect(users.find((user) => user.id === 'u6')).toMatchObject({ pending: true, locked: false });
  expect(users.find((user) => user.id === 'u7')).toMatchObject({ email: `${TENANT}@sigpro.lab`, org: 'Curso Playwright' });
  users.forEach((user) => expect(Object.keys(user).sort()).toEqual(['active', 'email', 'id', 'locked', 'name', 'org', 'pending', 'role']));
});

test('PATCH /admin/users/:id: validación 422, 404 y cambios válidos con su respuesta', async ({ request }) => {
  const headers = await authHeaders(request, 'admin', TENANT);

  const badRole = await request.patch(`${API_URL}/admin/users/u4`, { headers, data: { role: 'dios' } });
  expect(badRole.status()).toBe(422);
  const badBody = (await badRole.json()) as { code: string; errors: Record<string, string> };
  expect(badBody.code).toBe('validation_failed');
  expect(badBody.errors.role).toBe('roleInvalid');

  const empty = await request.patch(`${API_URL}/admin/users/u4`, { headers, data: {} });
  expect(empty.status()).toBe(422);
  expect(Object.values(((await empty.json()) as { errors: Record<string, string> }).errors)).toContain('nothingToUpdate');

  const notBoolean = await request.patch(`${API_URL}/admin/users/u4`, { headers, data: { active: 'no' } });
  expect(notBoolean.status()).toBe(422);

  const missing = await request.patch(`${API_URL}/admin/users/u99`, { headers, data: { active: false } });
  expect(missing.status()).toBe(404);
  expect(((await missing.json()) as { code: string }).code).toBe('user_not_found');

  const role = await request.patch(`${API_URL}/admin/users/u4`, { headers, data: { role: 'consultant' } });
  expect(role.status()).toBe(200);
  expect(await role.json()).toMatchObject({ id: 'u4', role: 'consultant', active: true });
  const active = await request.patch(`${API_URL}/admin/users/u4`, { headers, data: { active: false } });
  expect(await active.json()).toMatchObject({ id: 'u4', role: 'consultant', active: false });
  expect(await listUsers(request, TENANT).then((users) => users.find((user) => user.id === 'u4'))).toMatchObject({ role: 'consultant', active: false });

  // un usuario desactivado ya no puede entrar
  const login = await request.post(`${API_URL}/auth/login`, { headers: { 'x-tenant': TENANT }, data: { email: 'auditor@sigpro.test', password: 'Audit1234!', remember: true } });
  expect(login.status()).toBe(403);
  expect(((await login.json()) as { code: string }).code).toBe('account_disabled');

  // rol y activo a la vez: se restaura el usuario para el resto de la suite
  const both = await request.patch(`${API_URL}/admin/users/u4`, { headers, data: { role: 'auditor', active: true } });
  expect(await both.json()).toMatchObject({ id: 'u4', role: 'auditor', active: true });
});

test('auditoría: cada cambio efectivo escribe user.updated con su diff y repetir el valor no escribe nada', async ({ request }) => {
  const headers = await authHeaders(request, 'admin', TENANT);
  const events = async (): Promise<{ items: { action: string; entity: string; entityId: string; actorName: string | null; diff: Record<string, unknown> | null }[]; total: number }> =>
    (await (await request.get(`${API_URL}/audit?entity=user&limit=100`, { headers })).json()) as never;

  const before = await events();
  // los tres cambios del test anterior (u4: rol, activo y rol + activo a la vez)
  expect(before.total).toBe(3);
  expect(before.items.every((event) => event.action === 'user.updated' && event.entity === 'user')).toBe(true);
  expect(before.items.map((event) => event.entityId)).toEqual(['u4', 'u4', 'u4']);
  // el más reciente primero: rol + activo a la vez, luego activo y por último rol
  expect(before.items.map((event) => event.diff)).toEqual([{ active: true, role: 'auditor' }, { active: false }, { role: 'consultant' }]);
  expect(before.items[0]?.actorName).toBe('Marta Ruiz');

  // mismo valor → 200 pero sin evento
  const same = await request.patch(`${API_URL}/admin/users/u4`, { headers, data: { role: 'auditor', active: true } });
  expect(same.status()).toBe(200);
  expect((await events()).total).toBe(3);

  // un rechazo (409) tampoco deja evento
  const rejected = await request.patch(`${API_URL}/admin/users/u1`, { headers, data: { active: false } });
  expect(rejected.status()).toBe(409);
  expect((await events()).total).toBe(3);
});

test('409: no puedes tocar tu propia cuenta ni dejar el tenant sin admin activo', async ({ request }) => {
  const admin = await authHeaders(request, 'admin', TENANT);

  const self = await request.patch(`${API_URL}/admin/users/u1`, { headers: admin, data: { role: 'consultant' } });
  expect(self.status()).toBe(409);
  expect(((await self.json()) as { code: string }).code).toBe('self_change');
  expect((await request.patch(`${API_URL}/admin/users/u1`, { headers: admin, data: { active: false } })).status()).toBe(409);
  // «cambiar» al mismo valor no es tocarse la cuenta
  expect((await request.patch(`${API_URL}/admin/users/u1`, { headers: admin, data: { role: 'admin', active: true } })).status()).toBe(200);

  // Dos admins: u1 (admin@sigpro.test) y u7 (alumno05@sigpro.lab). Con el JWT de u7 aún vigente se desactiva u7 desde u1…
  const u7Token = await loginWithPassword(request, TENANT, `${TENANT}@sigpro.lab`, 'Alumno1234!');
  const u7 = { Authorization: `Bearer ${u7Token}`, 'x-tenant': TENANT };
  expect((await request.patch(`${API_URL}/admin/users/u7`, { headers: admin, data: { active: false } })).status()).toBe(200);
  // …y ahora u1 es el último admin activo: u7 (token válido, cuenta desactivada) no puede desactivarlo ni degradarlo
  const last = await request.patch(`${API_URL}/admin/users/u1`, { headers: u7, data: { active: false } });
  expect(last.status()).toBe(409);
  expect(((await last.json()) as { code: string }).code).toBe('last_admin');
  const demote = await request.patch(`${API_URL}/admin/users/u1`, { headers: u7, data: { role: 'auditor' } });
  expect(demote.status()).toBe(409);
  expect(((await demote.json()) as { code: string }).code).toBe('last_admin');

  // reactivar a u7 lo deja todo como estaba
  expect((await request.patch(`${API_URL}/admin/users/u7`, { headers: admin, data: { active: true } })).status()).toBe(200);
  expect((await listUsers(request, TENANT)).filter((user) => user.role === 'admin' && user.active).map((user) => user.id)).toEqual(['u1', 'u7']);
});

test('aislamiento: los cambios de un tenant no se ven en otro y el JWT manda sobre la cabecera x-tenant', async ({ request }) => {
  const other = await listUsers(request, OTHER);
  expect(other.find((user) => user.id === 'u4')).toMatchObject({ role: 'auditor', active: true });
  expect(other.find((user) => user.id === 'u3')).toMatchObject({ role: 'consultant', active: true });
  expect(await listUsers(request, TENANT).then((users) => users.find((user) => user.id === 'u4'))).toMatchObject({ role: 'auditor', active: true });

  // un admin de alumno05 que manda x-tenant: alumno06 sigue modificando su propio tenant
  const admin = await authHeaders(request, 'admin', TENANT);
  const sneaky = await request.patch(`${API_URL}/admin/users/u5`, { headers: { ...admin, 'x-tenant': OTHER }, data: { role: 'auditor' } });
  expect(sneaky.status()).toBe(200);
  expect((await listUsers(request, OTHER)).find((user) => user.id === 'u5')?.role).toBe('consultant');
  expect((await listUsers(request, TENANT)).find((user) => user.id === 'u5')?.role).toBe('auditor');
});

test('PATCH /admin/chaos: valida rangos (422), fusiona parciales y solo lo toca admin', async ({ request }) => {
  const headers = await authHeaders(request, 'admin', TENANT);
  const chaos = `${API_URL}/admin/chaos`;
  expect((await request.get(chaos, { headers: await authHeaders(request, 'consultant', TENANT) })).status()).toBe(403);
  expect((await request.patch(chaos, { headers: await authHeaders(request, 'program_manager', TENANT), data: { latencyMs: 100 } })).status()).toBe(403);

  expect(await (await request.get(chaos, { headers })).json()).toEqual({ latencyMs: 0, errorRate: 0, flakyLabels: false });
  expect((await request.patch(chaos, { headers, data: { latencyMs: 6000 } })).status()).toBe(422);
  expect((await request.patch(chaos, { headers, data: { errorRate: 1.5 } })).status()).toBe(422);
  expect((await request.patch(chaos, { headers, data: { flakyLabels: 'si' } })).status()).toBe(422);

  const partial = await request.patch(chaos, { headers, data: { latencyMs: 200 } });
  expect(await partial.json()).toEqual({ latencyMs: 200, errorRate: 0, flakyLabels: false });
  const merged = await request.patch(chaos, { headers, data: { flakyLabels: true } });
  expect(await merged.json()).toEqual({ latencyMs: 200, errorRate: 0, flakyLabels: true });
  expect((await readConfig(request, TENANT)).chaos).toEqual({ latencyMs: 200, errorRate: 0, flakyLabels: true });
  expect((await readConfig(request, OTHER)).chaos).toEqual({ latencyMs: 0, errorRate: 0, flakyLabels: false });

  // el caos sobrevive al reset del tenant (decisión documentada) y se apaga explícitamente
  await resetTenant(request, TENANT);
  expect((await readConfig(request, TENANT)).chaos).toEqual({ latencyMs: 200, errorRate: 0, flakyLabels: true });
  await chaosOff(request, TENANT);
  expect((await readConfig(request, TENANT)).chaos).toEqual({ latencyMs: 0, errorRate: 0, flakyLabels: false });
});
