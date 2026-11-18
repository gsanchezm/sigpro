import { expect, test, type APIRequestContext } from '@playwright/test';
import { HARDENED_API, loginStudent, studentTenants } from '../../support/hardened';

// Despliegue endurecido · registro solo con correos ficticios (RESTRICT_EMAIL_DOMAINS + la lista por defecto: sigpro.lab, sigpro.test, example.com).
// Un correo real debe rechazarse ANTES de tocar nada: ni base de datos, ni auditoría, ni logs (estos últimos, en logs.spec.ts).

test.describe.configure({ mode: 'serial' });

const REAL_EMAIL = 'persona.real@gmail.com';
const registerBody = (email: string) => ({ first: 'Ana', last: 'Prueba', email, org: 'Unidad de pruebas', role: 'auditor', password: 'Abcdefghij1!', confirm: 'Abcdefghij1!', terms: true });

let tenant = '';
test.beforeAll(async ({ request }) => {
  [tenant = ''] = await studentTenants(request);
});

const post = (request: APIRequestContext, path: string, data: unknown) => request.post(`${HARDENED_API}${path}`, { headers: { 'x-tenant': tenant }, data });

const adminHeaders = async (request: APIRequestContext) => ({ Authorization: `Bearer ${(await loginStudent(request, tenant)).accessToken}`, 'x-tenant': tenant });

test.describe('422 a un correo real', () => {
  test('POST /auth/register responde 422 con code, campo y sin repetir la dirección', async ({ request }) => {
    const response = await post(request, '/auth/register', registerBody(REAL_EMAIL));
    expect(response.status()).toBe(422);
    const text = await response.text();
    expect(JSON.parse(text)).toMatchObject({ statusCode: 422, code: 'email_domain_not_allowed', errors: { email: 'emailDomain' } });
    expect(text).not.toContain('persona.real');
    expect(text).not.toContain('gmail');
  });

  test('POST /auth/forgot y /auth/resend también', async ({ request }) => {
    for (const [path, body] of [['/auth/forgot', { email: REAL_EMAIL }], ['/auth/resend', { email: REAL_EMAIL }]] as const) {
      const response = await post(request, path, body);
      expect(response.status(), path).toBe(422);
      expect(await response.text(), path).not.toContain('gmail');
    }
  });

  test('un dominio que solo se le parece también se rechaza', async ({ request }) => {
    for (const email of ['ana@mail.example.com', 'ana@example.com.evil.net', 'ana@mail.sigpro.lab', 'ana@sigpro.lab.evil.net']) {
      expect((await post(request, '/auth/register', registerBody(email))).status(), email).toBe(422);
    }
  });

  test('NO queda nada en la base de datos ni en la auditoría', async ({ request }) => {
    const headers = await adminHeaders(request);
    const users = await (await request.get(`${HARDENED_API}/admin/users`, { headers })).text();
    const audit = await (await request.get(`${HARDENED_API}/audit?limit=100`, { headers })).text();
    for (const [name, text] of [['usuarios', users], ['auditoría', audit]] as const) {
      expect(text, name).not.toContain('gmail');
      expect(text, name).not.toContain('persona.real');
      expect(text, name).not.toContain('evil.net');
    }
  });
});

test.describe('los dominios ficticios siguen funcionando', () => {
  test('forgot y resend responden 202 con sigpro.test y example.com', async ({ request }) => {
    for (const email of ['cualquiera@sigpro.test', 'cualquiera@example.com', 'CUALQUIERA@EXAMPLE.COM']) {
      expect((await post(request, '/auth/forgot', { email })).status(), email).toBe(202);
      expect((await post(request, '/auth/resend', { email })).status(), email).toBe(202);
    }
  });

  test('register con example.com crea la solicitud (201) y repetirla da 409', async ({ request }) => {
    const email = `nuevo.${Date.now()}@example.com`;
    const created = await post(request, '/auth/register', registerBody(email));
    expect(created.status()).toBe(201);
    expect(await created.json()).toMatchObject({ status: 'pending_approval', email });
    expect((await post(request, '/auth/register', registerBody(email))).status()).toBe(409);
  });

  test('register con sigpro.test también', async ({ request }) => {
    expect((await post(request, '/auth/register', registerBody(`nuevo.${Date.now()}@sigpro.test`))).status()).toBe(201);
  });

  // El administrador de cada tenant de alumno es <tenant>@sigpro.lab: sin este dominio en la lista, «olvidé mi contraseña» fallaría
  // justo con los usuarios que siembra la propia API, y los tests de `examples/` que registran correos @sigpro.lab (s02) darían 422.
  test('sigpro.lab (los usuarios de alumno que siembra la API) está admitido: forgot y resend dan 202 y register 201', async ({ request }) => {
    for (const email of [`${tenant}@sigpro.lab`, `bloqueo-${Date.now()}@sigpro.lab`]) {
      expect((await post(request, '/auth/forgot', { email })).status(), `forgot ${email}`).toBe(202);
      expect((await post(request, '/auth/resend', { email })).status(), `resend ${email}`).toBe(202);
    }
    expect((await post(request, '/auth/register', registerBody(`bloqueo-${Date.now()}@sigpro.lab`))).status()).toBe(201);
  });
});
