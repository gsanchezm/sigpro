import { test } from '@playwright/test';
import { openAs } from '../support/auth';
import { capture, THEMES, type ThemeName } from '../support/screens';

// Capturas del DISEÑO RESPONSIVE (< 1024 px) → docs/screens/responsive-*.png: drawer, búsqueda a pantalla completa, filtros y
// hoja de acciones de Programas, detalle de programa con select, detalle de requisito a pantalla completa y NC con pestañas.
// Móvil (390 px) en claro y oscuro y tablet (iPad, 810 px) en claro. Solo lectura: corre sobre `demo`.
// Se ejecutan con `pnpm --filter @sigpro/e2e exec playwright test --project=screens tests/screens-responsive.spec.ts`.

const RUNS: readonly { readonly width: number; readonly height: number; readonly themes: readonly ThemeName[] }[] = [
  { width: 390, height: 844, themes: THEMES },
  { width: 810, height: 1080, themes: ['light'] },
];

for (const { width, height, themes } of RUNS) {
  for (const theme of themes) {
    test.describe(`capturas responsive ${theme} ${width}`, () => {
      test.use({ viewport: { width, height } });

      test('navegación: drawer abierto con el menú de usuario al pie', async ({ page }) => {
        await openAs(page, 'admin', '/programs', { theme });
        await page.getByTestId('programs-row-PRG-001-mobile').waitFor();
        await page.getByTestId('layout-sidebar-toggle-mobile').click();
        await page.getByTestId('layout-sidebar-mobile').waitFor();
        await capture(page, 'responsive-drawer', theme);
      });

      test('búsqueda global a pantalla completa con resultados agrupados', async ({ page }) => {
        await openAs(page, 'admin', '/nc', { theme });
        await page.getByTestId('layout-search-toggle').click();
        await page.getByTestId('layout-search-mobile').fill('disponibilidad');
        await page.getByTestId('global-search-results-mobile').getByRole('option').first().waitFor();
        await capture(page, 'responsive-busqueda', theme);
      });

      test('Programas: lista de tarjetas, panel de filtros y hoja de acciones', async ({ page }) => {
        await openAs(page, 'admin', '/programs', { theme });
        await page.getByTestId('programs-row-PRG-001-mobile').waitFor();
        await capture(page, 'responsive-programas-lista', theme);

        await page.getByTestId('programs-filters-mobile').click();
        await page.getByLabel('Estado').selectOption('on_hold');
        await page.getByTestId('programs-filters-panel-mobile').waitFor();
        await capture(page, 'responsive-programas-filtros', theme);
        await page.getByTestId('programs-filters-apply-mobile').click();

        await page.getByTestId('programs-row-menu-PRG-004-mobile').click();
        await page.getByTestId('programs-row-menu-mobile').waitFor();
        await capture(page, 'responsive-programas-acciones', theme);
      });

      test('detalle de programa con el select de pestañas y detalle de requisito a pantalla completa', async ({ page }) => {
        await openAs(page, 'admin', '/programs/PRG-001', { theme });
        await page.getByTestId('program-detail-tabs-mobile').selectOption('milestones');
        await page.locator('[data-testid="milestones-table"][aria-busy="false"]').waitFor();
        await capture(page, 'responsive-detalle-programa', theme);

        await page.goto('/programs/PRG-002/requirements');
        await page.getByTestId('requirement-open-REQ-017').click();
        await page.getByTestId('requirement-detail-mobile').waitFor();
        await capture(page, 'responsive-requisito-detalle', theme);
      });

      test('No conformidades: pestañas por estado y hoja «Mover a…»', async ({ page }) => {
        await openAs(page, 'admin', '/nc', { theme });
        await page.getByTestId('nc-card-NC-001-mobile').waitFor();
        await capture(page, 'responsive-nc-pestanas', theme);
        await page.getByTestId('nc-card-move-NC-001-mobile').click();
        await page.getByTestId('nc-menu-mobile').waitFor();
        await capture(page, 'responsive-nc-mover', theme);
      });
    });
  }
}
