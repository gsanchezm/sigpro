import { expect, test, type Page, type APIRequestContext } from '@playwright/test';
import { loginByApi, resetTenant, type RoleName } from '../support/auth';
import { capture, prepareStorage, THEMES, VIEWPORTS } from '../support/screens';

// Capturas de No conformidades en claro/oscuro a 1440 y 390 px → docs/screens/nc-*.png.
// Se ejecutan con `pnpm --filter @sigpro/e2e exec playwright test --project=screens tests/screens-nc.spec.ts`.
// Tenant propio: alumno13.

const TENANT = 'alumno13';

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

const board = async (page: Page, path = '/nc') => {
  await page.goto(path);
  await expect(page.getByTestId('nc-board')).toHaveAttribute('aria-busy', 'false');
  await expect(page.getByTestId('nc-card-NC-001')).toBeVisible();
};

for (const theme of THEMES) {
  for (const viewport of VIEWPORTS) {
    test.describe(`capturas NC ${theme} ${viewport.width}`, () => {
      test.use({ viewport });

      test.beforeEach(async ({ page, request }) => {
        await resetTenant(request, TENANT);
        await prepareStorage(page, theme);
        await signIn(page, request);
      });

      test.afterAll(async ({ request }) => {
        await resetTenant(request, TENANT);
      });

      test('tablero, vacío por filtros y error de carga', async ({ page }) => {
        await board(page);
        await capture(page, 'nc-tablero', theme);

        await page.getByRole('searchbox', { name: 'Buscar no conformidades' }).fill('zzzz-no-existe');
        await expect(page.getByTestId('nc-empty')).toBeVisible();
        await capture(page, 'nc-vacio', theme);

        await page.route('**/api/nc', (route) => route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ statusCode: 503, error: 'Service Unavailable', message: 'down', traceId: '7f3a-c21d' }) }));
        await page.reload();
        await expect(page.getByTestId('nc-error')).toBeVisible();
        await capture(page, 'nc-error', theme);
      });

      test('detalle con el selector de severidad y los comentarios', async ({ page }) => {
        await board(page, '/nc/NC-003');
        const detail = page.getByRole('dialog', { name: 'Detalle de NC-003' });
        await expect(detail.getByRole('option', { name: 'Crítica' })).toHaveAttribute('aria-selected', 'true');
        await expect(detail.getByTestId('nc-comments').getByRole('listitem')).toHaveCount(3);
        await capture(page, 'nc-detalle', theme);
      });

      test('cierre con el contador y el error de menos de 20 caracteres', async ({ page }) => {
        await board(page);
        // En móvil la columna «Acción correctiva» queda fuera de pantalla: se trae a la vista y se espera al snap (un scroll cierra el menú)
        await page.getByRole('button', { name: 'Acciones para NC-003' }).scrollIntoViewIfNeeded();
        await page.waitForTimeout(500);
        await page.getByRole('button', { name: 'Acciones para NC-003' }).click();
        await page.getByRole('menuitem', { name: /Mover a «Cerrada»/ }).click();
        const close = page.getByRole('dialog', { name: 'Cerrar NC-003' });
        await close.getByLabel('Comentario de cierre').fill('corto');
        await close.getByRole('button', { name: 'Cerrar no conformidad' }).click();
        await expect(close.getByRole('alert')).toBeVisible();
        await capture(page, 'nc-cierre', theme);
      });

      test('alta con errores por campo', async ({ page }) => {
        await board(page);
        await page.getByRole('button', { name: 'Nueva no conformidad' }).click();
        const form = page.getByRole('dialog', { name: 'Nueva no conformidad' });
        await form.getByRole('button', { name: 'Abrir no conformidad' }).click();
        await expect(form.getByTestId('nc-new-program-error')).toBeVisible();
        await form.getByTestId('nc-new-severity').getByRole('option', { name: 'Mayor' }).click();
        await capture(page, 'nc-alta', theme);
      });

      test('menú de la tarjeta (solo escritorio: se cierra al redimensionar)', async ({ page }) => {
        test.skip(viewport.width < 640, 'el menú contextual solo se captura en escritorio');
        await board(page);
        await page.getByRole('button', { name: 'Acciones para NC-002' }).click();
        await expect(page.getByRole('menu', { name: 'Acciones para NC-002' })).toBeVisible();
        await capture(page, 'nc-menu', theme);
      });
    });
  }
}
