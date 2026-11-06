import { expect, test } from '@playwright/test';

// Ruta protegida con basic auth: /api/docs (Swagger UI) y /api/docs-json (OpenAPI) en el entorno del curso.
// Usa la segunda API del arranque de Playwright (puerto 3100, DOCS_BASIC_AUTH=curso:docs-2026; ver support/start-docs-api.mjs).
// Para probar otro entorno: E2E_DOCS_URL=https://…/api y E2E_DOCS_AUTH=usuario:contraseña.

const DOCS_API = process.env.E2E_DOCS_URL ?? 'http://localhost:3100/api';
const [USERNAME = '', ...rest] = (process.env.E2E_DOCS_AUTH ?? 'curso:docs-2026').split(':');
const PASSWORD = rest.join(':');

const basic = (user: string, password: string) => `Basic ${Buffer.from(`${user}:${password}`).toString('base64')}`;

test.describe('basic auth de /api/docs', () => {
  test('sin credenciales responde 401 con el reto Basic, tanto en Swagger UI como en el JSON de OpenAPI', async ({ request }) => {
    for (const path of ['/docs', '/docs-json']) {
      const response = await request.get(`${DOCS_API}${path}`);
      expect(response.status(), path).toBe(401);
      expect(response.headers()['www-authenticate'], path).toMatch(/^Basic realm="SIGPRO API docs"/);
    }
  });

  test('credenciales incorrectas siguen dando 401', async ({ request }) => {
    const response = await request.get(`${DOCS_API}/docs`, { headers: { Authorization: basic(USERNAME, 'contraseña-incorrecta') } });
    expect(response.status()).toBe(401);
  });

  test('con credenciales en la cabecera devuelve el OpenAPI de SIGPRO', async ({ request }) => {
    const response = await request.get(`${DOCS_API}/docs-json`, { headers: { Authorization: basic(USERNAME, PASSWORD) } });
    expect(response.status()).toBe(200);
    const spec = (await response.json()) as { info: { title: string }; paths: Record<string, unknown> };
    expect(spec.info.title).toBe('SIGPRO API');
    expect(Object.keys(spec.paths)).toContain('/api/programs');
  });

  test('un contexto con httpCredentials ve Swagger UI', async ({ browser }) => {
    const context = await browser.newContext({ httpCredentials: { username: USERNAME, password: PASSWORD } });
    const page = await context.newPage();
    const response = await page.goto(`${DOCS_API}/docs`);
    expect(response?.status()).toBe(200);
    await expect(page.getByRole('heading', { name: /SIGPRO API/ })).toBeVisible();
    await context.close();
  });

  test('sin httpCredentials el navegador se queda en el 401', async ({ page }) => {
    const response = await page.goto(`${DOCS_API}/docs`);
    expect(response?.status()).toBe(401);
    await expect(page.getByText('Authentication required')).toBeVisible();
  });

  test('el resto de la API no pide credenciales (solo la documentación)', async ({ request }) => {
    const response = await request.get(`${DOCS_API}/health`);
    expect(response.status()).toBe(200);
    expect(await response.json()).toMatchObject({ status: 'ok' });
  });
});
