import { test } from '@playwright/test';
import { loginByApi, resetTenant } from '../support/auth';
import { capture, prepareStorage, THEMES, VIEWPORTS } from '../support/screens';

// Capturas de cada pantalla en claro/oscuro a 1440 y 390 px → docs/screens/ (se ejecuta con `pnpm e2e:screens`).

for (const theme of THEMES) {
  for (const viewport of VIEWPORTS) {
    test.describe(`capturas ${theme} ${viewport.width}`, () => {
      test.use({ viewport });

      test.beforeEach(async ({ page }) => {
        await prepareStorage(page, theme);
      });

      test('acceso: login, registro, recuperar, MFA y verificación', async ({ page }) => {
        await page.goto('/login');
        await page.getByTestId('test-users').waitFor();
        await capture(page, 'acceso-login', theme);

        // Error 401 del servidor
        await page.getByLabel('Correo electrónico').fill(`nadie-${theme}-${viewport.width}@sigpro.test`);
        await page.getByLabel('Contraseña', { exact: true }).fill('incorrecta');
        await page.getByRole('button', { name: 'Entrar' }).click();
        await page.getByRole('alert').waitFor();
        await capture(page, 'acceso-login-error', theme);

        await page.goto('/forgot');
        await page.getByLabel('Correo electrónico').fill('cualquiera@sigpro.test');
        await page.getByRole('button', { name: 'Enviar enlace' }).click();
        await page.getByTestId('forgot-sent').waitFor();
        await capture(page, 'acceso-recuperar', theme);

        await page.goto('/login');
        await page.getByTestId('test-user-admin').click();
        await page.getByRole('button', { name: 'Entrar' }).click();
        await page.getByTestId('mfa-form').waitFor();
        await page.getByLabel('Código de verificación').fill('123456');
        await capture(page, 'acceso-mfa', theme);

        await page.goto('/register');
        await page.getByRole('button', { name: 'Enviar solicitud' }).click();
        await page.getByTestId('register-first-name-error').waitFor();
        await capture(page, 'acceso-registro-errores', theme);

        await page.getByLabel('Nombre').fill('Ana');
        await page.getByLabel('Apellidos').fill('Prueba');
        await page.getByLabel('Correo corporativo').fill(`ana-${theme}-${viewport.width}-${Date.now()}@organizacion.es`);
        await page.getByLabel('Organización / Unidad').fill('Unidad de pruebas');
        await page.getByLabel('Contraseña', { exact: true }).fill('Abcdefghij1!');
        await page.getByLabel('Confirmar contraseña').fill('Abcdefghij1!');
        await page.getByRole('checkbox', { name: /He leído y acepto/ }).check();
        await capture(page, 'acceso-registro', theme);
        await page.getByRole('button', { name: 'Enviar solicitud' }).click();
        await page.getByTestId('verify-panel').waitFor();
        await capture(page, 'acceso-verificacion', theme);
      });

      test('lab: público y con sesión de admin', async ({ page, request }) => {
        const tenant = 'alumno06';
        await page.goto('/lab');
        await page.getByTestId('lab-health').filter({ hasText: 'API operativa' }).waitFor();
        await capture(page, 'lab-publico', theme);

        const { refreshToken } = await loginByApi(request, 'admin', tenant);
        await page.context().addInitScript(
          ({ token, tenantId }) => {
            localStorage.setItem('sigpro.tenant', tenantId);
            localStorage.setItem('sigpro.session', JSON.stringify({ refreshToken: token, remember: true }));
          },
          { token: refreshToken, tenantId: tenant },
        );
        await page.goto('/lab');
        await page.getByTestId('lab-credentials').getByRole('row').nth(1).waitFor();
        await capture(page, 'lab-admin', theme);
      });

      test('programas: lista, estados, menú, asistente, diálogos y detalle', async ({ page, request, browser }) => {
        const tenant = 'alumno04';
        await resetTenant(request, tenant);
        const { refreshToken } = await loginByApi(request, 'admin', tenant);
        await page.context().addInitScript(
          ({ token, tenantId }) => {
            localStorage.setItem('sigpro.tenant', tenantId);
            localStorage.setItem('sigpro.session', JSON.stringify({ refreshToken: token, remember: true }));
          },
          { token: refreshToken, tenantId: tenant },
        );
        const mobile = viewport.width < 640;

        await page.goto('/programs');
        await page.getByTestId('programs-row-PRG-001').waitFor();
        await capture(page, 'programas-lista', theme);

        if (!mobile) {
          await page.getByTestId('programs-select-PRG-002').check();
          await page.getByTestId('programs-select-PRG-003').check();
          await capture(page, 'programas-seleccion', theme);
          await page.getByTestId('programs-bulk-clear').click();
          await page.getByTestId('programs-row-menu-PRG-002').click();
          await capture(page, 'programas-menu-fila', theme);
          await page.keyboard.press('Escape');
          await page.getByTestId('programs-row-menu-PRG-002').click();
          await page.getByTestId('programs-row-menu-delete').click();
          await capture(page, 'programas-eliminar', theme);
          await page.getByTestId('modal-cancel').click();
          await page.getByTestId('programs-filter-owner').click();
          await capture(page, 'programas-filtro-responsable', theme);
          await page.keyboard.press('Escape');
        }

        await page.getByTestId('programs-new').click();
        await page.getByTestId('programs-wizard-next').click();
        await capture(page, 'programas-asistente-errores', theme);
        await page.getByTestId('programs-wizard-name').fill('Radar de vigilancia costera RVC-3');
        await page.getByTestId('programs-wizard-owner').click();
        await page.getByTestId('programs-wizard-owner-option-u2').click();
        await capture(page, 'programas-asistente-1', theme);
        await page.getByTestId('programs-wizard-next').click();
        await page.getByTestId('programs-wizard-start').fill('2026-03-01');
        await page.getByTestId('programs-wizard-end').fill('2027-09-30');
        await page.getByTestId('programs-wizard-budget').fill('1500000');
        await capture(page, 'programas-asistente-2', theme);
        await page.getByTestId('programs-wizard-next').click();
        await capture(page, 'programas-asistente-3', theme);
        await page.getByTestId('programs-wizard-submit').click();
        await page.getByTestId('toast-ok').waitFor();
        await capture(page, 'programas-alta-toast', theme);

        await page.goto('/programs?q=zzzz-no-existe');
        await page.getByTestId('programs-empty').waitFor();
        await capture(page, 'programas-vacio', theme);

        await page.route('**/api/programs?*', (route) =>
          route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ statusCode: 503, error: 'Service Unavailable', message: 'down', traceId: '7f3a-c21d' }) }),
        );
        await page.goto('/programs');
        await page.getByTestId('programs-error').waitFor();
        await capture(page, 'programas-error', theme);
        await page.unroute('**/api/programs?*');

        await page.route('**/api/programs?*', async (route) => {
          await new Promise((resolve) => setTimeout(resolve, 6000));
          await route.continue().catch(() => undefined);
        });
        await page.goto('/programs');
        await page.getByTestId('skeleton-row').first().waitFor();
        await capture(page, 'programas-carga', theme);
        await page.unroute('**/api/programs?*');

        await page.goto('/programs/PRG-001');
        await page.getByTestId('program-detail').waitFor();
        await capture(page, 'programas-detalle', theme);

        // Primera visita: banner de cookies (contexto nuevo, sin la marca de "cookies vistas")
        const fresh = await browser.newContext({ viewport });
        await fresh.addInitScript(
          ({ token, tenantId, themeName }) => {
            localStorage.setItem('sigpro.tenant', tenantId);
            localStorage.setItem('sigpro.theme', themeName);
            localStorage.setItem('sigpro.session', JSON.stringify({ refreshToken: token, remember: true }));
          },
          { token: refreshToken, tenantId: tenant, themeName: theme },
        );
        const firstVisit = await fresh.newPage();
        await firstVisit.goto('/programs');
        await firstVisit.getByTestId('cookie-banner').waitFor();
        await capture(firstVisit, 'programas-cookies', theme);
        await fresh.close();
      });
    });
  }
}
