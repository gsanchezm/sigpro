import { test, type APIRequestContext, type Page } from '@playwright/test';
import { chaosOff } from '../support/admin';
import { loginByApi, resetTenant, type RoleName } from '../support/auth';
import { capture, prepareStorage, THEMES, VIEWPORTS } from '../support/screens';

// Capturas de Administración, Hitos y Perfil (fase 3) en claro/oscuro a 1440 y 390 px → docs/screens/.
// Se ejecuta con: pnpm --filter @sigpro/e2e exec playwright test --project=screens tests/screens-admin.spec.ts

const TENANT = 'alumno14';

/** Inicia sesión por API en `TENANT` y deja el token en localStorage antes de cargar la app. */
const signIn = async (page: Page, request: APIRequestContext, role: RoleName = 'admin'): Promise<void> => {
  const { refreshToken } = await loginByApi(request, role, TENANT);
  await page.context().addInitScript(
    ({ token, tenantId }) => {
      localStorage.setItem('sigpro.tenant', tenantId);
      localStorage.setItem('sigpro.session', JSON.stringify({ refreshToken: token, remember: true }));
    },
    { token: refreshToken, tenantId: TENANT },
  );
};

for (const theme of THEMES) {
  for (const viewport of VIEWPORTS) {
    test.describe(`capturas admin ${theme} ${viewport.width}`, () => {
      test.use({ viewport });

      test.beforeEach(async ({ page, request }) => {
        await prepareStorage(page, theme);
        await resetTenant(request, TENANT);
        await chaosOff(request, TENANT);
      });

      test.afterEach(async ({ request }) => {
        await chaosOff(request, TENANT);
      });

      test('administración: usuarios, auditoría por rango, modo caos, datos, permiso y error', async ({ page, request }) => {
        await signIn(page, request);
        await page.goto('/admin');
        await page.getByRole('table').and(page.locator('[aria-busy="false"]')).waitFor();
        await capture(page, 'admin-usuarios', theme);

        // un cambio de rol y una desactivación (con el toast visible)
        await page.getByLabel('Rol de Andrés Molina').selectOption('program_manager');
        await page.getByTestId('toast-ok').waitFor();
        await page.getByRole('switch', { name: 'Activo: Javier Ortega' }).click();
        await page.getByTestId('admin-user-status-u2').filter({ hasText: 'Desactivado' }).waitFor();
        await capture(page, 'admin-usuarios-cambios', theme);

        await page.getByRole('searchbox', { name: 'Buscar usuarios' }).fill('zzz-no-existe');
        await page.getByTestId('admin-users-empty').waitFor();
        await capture(page, 'admin-usuarios-vacio', theme);

        await page.goto('/admin?tab=audit');
        await page.getByRole('feed').getByRole('article').first().waitFor();
        await page.getByLabel('Desde').fill('2026-01-06');
        await page.getByLabel('Hasta').fill('2026-01-07');
        await page.getByText(/Mostrando \d+ de \d+ eventos/).waitFor();
        await capture(page, 'admin-auditoria-rango', theme);

        await page.goto('/admin?tab=chaos');
        await page.getByLabel('Latencia máxima').fill('1500');
        await page.getByLabel('Errores 500 en escrituras').fill('30');
        await page.getByRole('switch', { name: /Textos alternos/ }).click();
        await capture(page, 'admin-caos-borrador', theme);
        await page.getByRole('button', { name: 'Aplicar' }).click();
        await page.getByTestId('admin-chaos-status').filter({ hasText: 'Caos activo' }).waitFor();
        await capture(page, 'admin-caos-activo', theme);
        await chaosOff(request, TENANT);

        await page.goto('/admin?tab=data');
        await page.getByTestId('admin-reset').waitFor();
        await capture(page, 'admin-datos', theme);

        await signIn(page, request, 'consultant');
        await page.goto('/admin');
        await page.getByTestId('admin-forbidden').waitFor();
        await capture(page, 'admin-permiso', theme);

        await signIn(page, request);
        await page.route('**/api/admin/users', (route) =>
          route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ statusCode: 503, error: 'Service Unavailable', message: 'down', traceId: '7f3a-c21d' }) }),
        );
        await page.goto('/admin');
        await page.getByTestId('admin-users-error').waitFor();
        await capture(page, 'admin-usuarios-error', theme);
        await page.unroute('**/api/admin/users');
      });
    });
  }
}
