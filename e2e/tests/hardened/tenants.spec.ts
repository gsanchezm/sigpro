import { expect, test } from '@playwright/test';
import { HARDENED_ADMIN_KEY, HARDENED_API, STUDENT_PASSWORD, listTenants, loginStudent, studentTenants } from '../../support/hardened';

// Despliegue endurecido · tenants no adivinables (TENANT_SUFFIX_SEED). Contra la API de support/start-hardened-api.mjs, con su
// propio schema de Postgres: nada de esto toca la base ni los tenants que usan los demás specs.

test.describe.configure({ mode: 'serial' });

test.describe('lista de tenants', () => {
  test('GET /config/tenants exige X-Admin-Key: 403 sin ella y con una clave equivocada', async ({ request }) => {
    const attempts: Record<string, string>[] = [{}, { 'x-admin-key': 'otra-clave' }, { 'x-admin-key': '' }];
    for (const headers of attempts) {
      const response = await request.get(`${HARDENED_API}/config/tenants`, { headers });
      expect(response.status(), JSON.stringify(headers)).toBe(403);
      expect(await response.json()).toMatchObject({ code: 'admin_key_required' });
    }
  });

  test('una sesión de alumno tampoco basta: la lista es del administrador del despliegue', async ({ request }) => {
    const [tenant = ''] = await studentTenants(request);
    const { accessToken } = await loginStudent(request, tenant);
    const response = await request.get(`${HARDENED_API}/config/tenants`, { headers: { Authorization: `Bearer ${accessToken}`, 'x-tenant': tenant } });
    expect(response.status()).toBe(403);
  });

  test('con la clave lista demo y los alumnos con sufijo, y ninguno de los ids antiguos', async ({ request }) => {
    const ids = (await listTenants(request)).map((tenant) => tenant.id);
    expect(ids).toContain('demo');
    const students = ids.filter((id) => id.startsWith('alumno'));
    expect(students).toHaveLength(2);
    expect(students.every((id) => /^alumno0[12]-[0-9a-z]{4}$/.test(id))).toBe(true);
    expect(ids.filter((id) => /^alumno\d{2}$/.test(id))).toEqual([]);
  });
});

test.describe('ids estables', () => {
  test('el reinicio global (lo que hace sigpro-reset cada noche) conserva los mismos ids', async ({ request }) => {
    const before = await studentTenants(request);
    const reset = await request.post(`${HARDENED_API}/admin/reset?all=true`, { headers: { 'x-admin-key': HARDENED_ADMIN_KEY } });
    expect(reset.status()).toBe(200);
    const reseeded = ((await reset.json()) as { tenant: string }[]).map((row) => row.tenant).sort();
    expect(reseeded).toEqual(['demo', ...before].sort());
    expect(await studentTenants(request)).toEqual(before);
  });

  test('el reinicio de un solo tenant (lo que hace el botón de /lab) tampoco los cambia', async ({ request }) => {
    const before = await studentTenants(request);
    const [tenant = ''] = before;
    const { accessToken } = await loginStudent(request, tenant);
    const reset = await request.post(`${HARDENED_API}/admin/reset`, { headers: { Authorization: `Bearer ${accessToken}`, 'x-tenant': tenant } });
    expect(reset.status()).toBe(200);
    expect(await reset.json()).toMatchObject({ tenant });
    expect(await studentTenants(request)).toEqual(before);
  });
});

test.describe('acceso con el id nuevo', () => {
  test('el administrador de cada tenant entra con <tenant>@sigpro.lab y la contraseña pública', async ({ request }) => {
    for (const tenant of await studentTenants(request)) {
      const login = await loginStudent(request, tenant);
      const me = await request.get(`${HARDENED_API}/auth/me`, { headers: { Authorization: `Bearer ${login.accessToken}`, 'x-tenant': tenant } });
      expect(await me.json()).toMatchObject({ email: `${tenant}@sigpro.lab`, role: 'admin' });
    }
  });

  test('el id antiguo (alumno01) ya no existe: 404 tenant_not_found', async ({ request }) => {
    const response = await request.post(`${HARDENED_API}/auth/login`, { headers: { 'x-tenant': 'alumno01' }, data: { email: 'alumno01@sigpro.lab', password: STUDENT_PASSWORD, remember: false } });
    expect(response.status()).toBe(404);
    expect(await response.json()).toMatchObject({ code: 'tenant_not_found' });
  });

  test('sin cabecera x-tenant el login no encuentra a nadie por correo antiguo ni te cuela en un tenant', async ({ request }) => {
    const response = await request.post(`${HARDENED_API}/auth/login`, { data: { email: 'alumno01@sigpro.lab', password: STUDENT_PASSWORD, remember: false } });
    expect([401, 404]).toContain(response.status());
  });
});

test.describe('ningún otro endpoint filtra los nombres de los tenants', () => {
  test('GET /config devuelve solo el tenant pedido, sin ninguna lista', async ({ request }) => {
    const [tenant = '', other = ''] = await studentTenants(request);
    const response = await request.get(`${HARDENED_API}/config`, { headers: { 'x-tenant': tenant } });
    const text = await response.text();
    expect(text).toContain(tenant);
    expect(text).not.toContain(other);
  });

  test('GET /auth/me y /admin/users solo muestran el propio tenant', async ({ request }) => {
    const [tenant = '', other = ''] = await studentTenants(request);
    const { accessToken } = await loginStudent(request, tenant);
    const headers = { Authorization: `Bearer ${accessToken}`, 'x-tenant': tenant };
    for (const path of ['/auth/me', '/admin/users', '/programs']) {
      expect(await (await request.get(`${HARDENED_API}${path}`, { headers })).text(), path).not.toContain(other);
    }
  });

  test('la documentación de la API (Swagger) no lista tenants', async ({ request }) => {
    const [tenant = ''] = await studentTenants(request);
    const response = await request.get(`${HARDENED_API}/docs-json`);
    expect(response.status()).toBe(200);
    expect(await response.text()).not.toContain(tenant);
  });
});
