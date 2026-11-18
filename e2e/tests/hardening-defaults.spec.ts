import { expect, test } from '@playwright/test';
import { API_URL } from '../support/auth';

// Sin ninguna variable de endurecimiento (la API y la web normales de esta suite: ni TENANT_SUFFIX_SEED, ni LAB_PUBLIC, ni
// RESTRICT_EMAIL_DOMAINS, ni ROBOTS_NOINDEX) todo se comporta como en el entorno demo público de siempre. Es el control de
// los specs de tests/hardened. El resto de esta suite (lab.spec.ts, access.spec.ts…) lo prueba además sin haberse tocado.

const ORIGIN = new URL(API_URL).origin;

test.describe('entorno demo público: sin variables, igual que siempre', () => {
  test('GET /config/tenants es público y lista demo y alumno01…25', async ({ request }) => {
    const response = await request.get(`${API_URL}/config/tenants`);
    expect(response.status()).toBe(200);
    const ids = ((await response.json()) as { id: string }[]).map((tenant) => tenant.id);
    expect(ids).toContain('demo');
    expect(ids).toContain('alumno01');
    expect(ids).toContain('alumno25');
    expect(ids.filter((id) => /^alumno\d{2}$/.test(id))).toHaveLength(25);
  });

  test('GET /config anuncia testUsers=true y GET /config/test-users devuelve los seis usuarios sin sesión', async ({ request }) => {
    expect(await (await request.get(`${API_URL}/config`)).json()).toMatchObject({ testUsers: true });
    expect(await (await request.get(`${API_URL}/config/test-users`)).json()).toHaveLength(6);
  });

  test('la API no añade X-Robots-Tag ni sirve robots.txt', async ({ request }) => {
    for (const path of ['/health', '/config']) expect((await request.get(`${API_URL}${path}`)).headers()['x-robots-tag'], path).toBeUndefined();
    expect((await request.get(`${ORIGIN}/robots.txt`)).status()).toBe(404);
  });

  test('«olvidé mi contraseña» y el reenvío admiten cualquier dominio (202)', async ({ request }) => {
    for (const path of ['/auth/forgot', '/auth/resend']) {
      const response = await request.post(`${API_URL}${path}`, { data: { email: 'persona.real@gmail.com' } });
      expect(response.status(), path).toBe(202);
    }
  });

  test('el login con un tenant que no existe sigue dando 404 y con uno que sí, 401 (comportamiento de siempre)', async ({ request }) => {
    const unknown = await request.post(`${API_URL}/auth/login`, { headers: { 'x-tenant': 'no-existe-este-tenant' }, data: { email: 'a@sigpro.test', password: 'x', remember: false } });
    expect(unknown.status()).toBe(404);
    const known = await request.post(`${API_URL}/auth/login`, { headers: { 'x-tenant': 'demo' }, data: { email: 'inexistente@sigpro.test', password: 'x', remember: false } });
    expect(known.status()).toBe(401);
  });
});
