import { test, type APIRequestContext, type Page } from '@playwright/test';
import { loginByApi, resetTenant } from '../support/auth';
import { capture, prepareStorage, THEMES, VIEWPORTS } from '../support/screens';
import { BREAKPOINT_PX, byTid } from '../support/responsive';

// Capturas de los huecos cerrados del catálogo de componentes (búsqueda global agrupada y combobox de proveedor) en
// claro/oscuro a 1440 y 390 px → docs/screens/ (tenant alumno19). Se ejecuta con:
// pnpm --filter @sigpro/e2e exec playwright test --project=screens tests/screens-catalog.spec.ts

const TENANT = 'alumno19';

const signIn = async (page: Page, request: APIRequestContext): Promise<void> => {
  const { refreshToken } = await loginByApi(request, 'admin', TENANT);
  await page.context().addInitScript(
    ({ token, tenantId }) => {
      localStorage.setItem('sigpro.tenant', tenantId);
      localStorage.setItem('sigpro.session', JSON.stringify({ refreshToken: token, remember: true }));
    },
    { token: refreshToken, tenantId: TENANT },
  );
};

test.beforeAll(async ({ request }) => {
  await resetTenant(request, TENANT);
});

for (const theme of THEMES) {
  for (const viewport of VIEWPORTS) {
    test.describe(`capturas catálogo ${theme} ${viewport.width}`, () => {
      test.use({ viewport });

      test.beforeEach(async ({ page }) => {
        await prepareStorage(page, theme);
      });

      test('búsqueda global con resultados agrupados', async ({ page, request }) => {
        await signIn(page, request);
        await page.goto('/documents');
        await page.getByTestId('documents-page').waitFor();
        // En responsive el campo vive en la pantalla completa que abre el icono de la cabecera
        if (viewport.width < BREAKPOINT_PX) await page.getByRole('button', { name: 'Búsqueda global' }).click();
        const answered = page.waitForResponse((response) => response.url().includes('/api/search') && response.url().includes('q=disponibilidad'));
        await page.getByRole('combobox', { name: 'Búsqueda global' }).fill('disponibilidad');
        await answered;
        await byTid(page, 'global-search-results', viewport.width < BREAKPOINT_PX).getByRole('option').first().waitFor();
        await capture(page, 'busqueda-agrupada', theme);
      });

      test('combobox «buscar proveedor» abierto y ficha del proveedor elegido', async ({ page, request }) => {
        await signIn(page, request);
        await page.goto('/programs/PRG-009');
        await page.getByTestId('suppliers-panel').waitFor();
        await page.getByTestId('supplier-row-s5').waitFor();
        const combobox = page.getByRole('combobox', { name: 'Proveedor del tenant' });
        await combobox.click();
        await page.getByRole('listbox', { name: 'Proveedores encontrados' }).waitFor();
        await combobox.press('ArrowDown');
        await capture(page, 'proveedores-combobox', theme);

        await combobox.press('Enter');
        await page.getByTestId('supplier-detail').waitFor();
        await capture(page, 'proveedores-ficha', theme);
      });
    });
  }
}
