import { test, type APIRequestContext, type Page } from '@playwright/test';
import { API_URL, loginByApi, resetTenant } from '../support/auth';
import { capture, prepareStorage, THEMES, VIEWPORTS } from '../support/screens';

// Capturas del Panel de misión en claro/oscuro a 1440 y 390 px → docs/screens/ (tenant alumno11).
// Se ejecuta con: pnpm --filter @sigpro/e2e exec playwright test --project=screens tests/screens-mission.spec.ts

const TENANT = 'alumno11';

const signIn = async (page: Page, request: APIRequestContext): Promise<string> => {
  const { refreshToken, accessToken } = await loginByApi(request, 'admin', TENANT);
  await page.context().addInitScript(
    ({ token, tenantId }) => {
      localStorage.setItem('sigpro.tenant', tenantId);
      localStorage.setItem('sigpro.session', JSON.stringify({ refreshToken: token, remember: true }));
    },
    { token: refreshToken, tenantId: TENANT },
  );
  return accessToken;
};

const tick = async (request: APIRequestContext, accessToken: string): Promise<void> => {
  await request.post(`${API_URL}/mission/tick`, { headers: { Authorization: `Bearer ${accessToken}`, 'x-tenant': TENANT } });
};

test.beforeAll(async ({ request }) => {
  await resetTenant(request, TENANT);
});

for (const theme of THEMES) {
  for (const viewport of VIEWPORTS) {
    test.describe(`capturas misión ${theme} ${viewport.width}`, () => {
      test.use({ viewport });

      test.beforeEach(async ({ page }) => {
        await prepareStorage(page, theme);
      });

      test('panel de misión: KPIs, gráficas, feed en vivo y campana', async ({ page, request }) => {
        const token = await signIn(page, request);
        await page.goto('/mission');
        await page.getByTestId('mission-kpis').and(page.locator('[aria-busy="false"]')).waitFor();
        await page.getByRole('status').filter({ hasText: 'En vivo' }).waitFor();
        // Ocho eventos más recorren todo el catálogo del simulador (info, correcto, aviso y crítico) y llenan la campana
        for (let i = 0; i < 8; i += 1) await tick(request, token);
        await page.getByTestId('layout-notifications-count').waitFor();

        // Un tooltip abierto en el KPI de NC (icono de estado con ayuda)
        await page.getByRole('button', { name: 'Qué mide NC abiertas' }).hover();
        await page.getByRole('tooltip').waitFor();
        await capture(page, 'mision-panel', theme);

        await page.mouse.move(0, 0);
        await page.getByRole('figure', { name: 'NC abiertas por severidad' }).getByRole('button', { name: 'Ver como tabla' }).click();
        await capture(page, 'mision-tabla', theme);

        await page.getByRole('button', { name: /^Notificaciones/ }).click();
        await page.getByRole('dialog', { name: 'Notificaciones' }).waitFor();
        await capture(page, 'mision-campana', theme);
      });
    });
  }
}
