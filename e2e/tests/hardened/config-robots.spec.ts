import { expect, test } from '@playwright/test';
import { HARDENED_ADMIN_KEY, HARDENED_API, HARDENED_WEB, loginStudent, studentTenants } from '../../support/hardened';

// Despliegue endurecido · laboratorio cerrado (LAB_PUBLIC=false) y sin indexar (ROBOTS_NOINDEX=true), en la API.

const API_ORIGIN = new URL(HARDENED_API).origin;
const NOINDEX = 'noindex, nofollow';

test.describe('credenciales de demo (LAB_PUBLIC=false)', () => {
  test('GET /config anuncia testUsers=false: la pantalla de acceso no pinta el panel', async ({ request }) => {
    expect(await (await request.get(`${HARDENED_API}/config`)).json()).toMatchObject({ testUsers: false });
  });

  test('GET /config/test-users sin sesión devuelve una lista vacía (no un error)', async ({ request }) => {
    const response = await request.get(`${HARDENED_API}/config/test-users`);
    expect(response.status()).toBe(200);
    expect(await response.json()).toEqual([]);
  });

  test('con un token roto, caducado o de otro tipo sigue vacía', async ({ request }) => {
    for (const authorization of ['Bearer no-es-un-token', 'Bearer', 'Basic abc']) {
      expect(await (await request.get(`${HARDENED_API}/config/test-users`, { headers: { authorization } })).json(), authorization).toEqual([]);
    }
  });

  test('con sesión (o con X-Admin-Key) devuelve los seis usuarios de demo', async ({ request }) => {
    const [tenant = ''] = await studentTenants(request);
    const { accessToken } = await loginStudent(request, tenant);
    const withSession = await (await request.get(`${HARDENED_API}/config/test-users`, { headers: { Authorization: `Bearer ${accessToken}` } })).json();
    expect(withSession).toHaveLength(6);
    const withKey = await (await request.get(`${HARDENED_API}/config/test-users`, { headers: { 'x-admin-key': HARDENED_ADMIN_KEY } })).json();
    expect(withKey).toHaveLength(6);
  });
});

test.describe('sin indexar (ROBOTS_NOINDEX=true)', () => {
  test('todas las respuestas de la API llevan X-Robots-Tag: noindex, nofollow', async ({ request }) => {
    for (const path of ['/health', '/config', '/config/tenants', '/ruta-que-no-existe', '/docs']) {
      const response = await request.get(`${HARDENED_API}${path}`);
      expect(response.headers()['x-robots-tag'], `${path} → ${response.status()}`).toBe(NOINDEX);
    }
  });

  test('también las de error (403) y las de POST', async ({ request }) => {
    const forbidden = await request.get(`${HARDENED_API}/config/tenants`);
    expect(forbidden.status()).toBe(403);
    expect(forbidden.headers()['x-robots-tag']).toBe(NOINDEX);
    const login = await request.post(`${HARDENED_API}/auth/login`, { data: { email: 'a@sigpro.test', password: 'x', remember: false } });
    expect(login.headers()['x-robots-tag']).toBe(NOINDEX);
  });

  test('/robots.txt en la raíz de la API prohíbe todo el rastreo', async ({ request }) => {
    const response = await request.get(`${API_ORIGIN}/robots.txt`);
    expect(response.status()).toBe(200);
    expect(response.headers()['content-type']).toContain('text/plain');
    expect(await response.text()).toBe('User-agent: *\nDisallow: /\n');
  });

  test('la web (dev, con VITE_NOINDEX=true) lleva la meta noindex en su HTML', async ({ request }) => {
    expect(await (await request.get(`${HARDENED_WEB}/`)).text()).toMatch(/<meta name="robots" content="noindex, nofollow"\s*\/?>/);
  });
});
