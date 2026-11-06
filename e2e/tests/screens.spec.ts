import { test, type Page, type APIRequestContext } from '@playwright/test';
import { loginByApi, resetTenant, type RoleName } from '../support/auth';
import { capture, prepareStorage, THEMES, VIEWPORTS } from '../support/screens';

// Capturas de cada pantalla en claro/oscuro a 1440 y 390 px → docs/screens/ (se ejecuta con `pnpm e2e:screens`).

/** Inicia sesión por API en `tenant` y deja el token en localStorage antes de cargar la app. */
const signIn = async (page: Page, request: APIRequestContext, tenant: string, role: RoleName = 'admin'): Promise<void> => {
  const { refreshToken } = await loginByApi(request, role, tenant);
  await page.context().addInitScript(
    ({ token, tenantId }) => {
      localStorage.setItem('sigpro.tenant', tenantId);
      localStorage.setItem('sigpro.session', JSON.stringify({ refreshToken: token, remember: true }));
    },
    { token: refreshToken, tenantId: tenant },
  );
};

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

      test('programas (fase 2): edición, permisos y páginas legales', async ({ page, request }) => {
        const tenant = 'alumno13';
        await resetTenant(request, tenant);
        await signIn(page, request, tenant);

        await page.goto('/programs/PRG-003/edit');
        await page.getByTestId('program-edit-form').waitFor();
        await capture(page, 'programas-editar', theme);

        await page.getByLabel('Nombre').fill('ab');
        await page.getByLabel('Fecha de fin').fill('2020-01-01');
        await page.getByLabel('Presupuesto (€)').fill('0');
        await page.getByRole('button', { name: 'Guardar', exact: true }).click();
        await page.getByTestId('program-edit-name-error').waitFor();
        await capture(page, 'programas-editar-errores', theme);

        await page.getByLabel('Nombre').fill('Programa duplicado');
        await page.getByLabel('Fecha de fin').fill('2027-12-31');
        await page.getByLabel('Presupuesto (€)').fill('1000');
        await page.getByRole('button', { name: 'Guardar', exact: true }).click();
        await page.getByTestId('program-edit-server-error').waitFor();
        await capture(page, 'programas-editar-422', theme);

        await page.getByLabel('Nombre').fill('Enlace de datos seguro LD-9 (rev. B)');
        await page.getByRole('button', { name: 'Guardar', exact: true }).click();
        await page.getByTestId('toast-ok').waitFor();
        await capture(page, 'programas-editar-guardado', theme);

        await page.goto('/legal/terms');
        await page.getByTestId('legal-title').waitFor();
        await capture(page, 'legal-condiciones', theme);
        await page.goto('/help');
        await page.getByTestId('help-page').waitFor();
        await capture(page, 'ayuda', theme);
      });

      test('requisitos: árbol, detalle, etiquetas, menú contextual, confirmación, matriz y vacío', async ({ page, request }) => {
        const tenant = 'alumno14';
        await resetTenant(request, tenant);
        await signIn(page, request, tenant);
        const mobile = viewport.width < 640;
        const row = (code: string) => page.getByRole('tree', { name: 'Árbol de requisitos' }).getByRole('treeitem', { name: new RegExp(`^${code} `) });

        await page.goto('/programs/PRG-002/requirements');
        await row('REQ-015').waitFor();
        await capture(page, 'requisitos-arbol', theme);

        await page.getByRole('button', { name: 'Contraer REQ-020' }).click();
        await capture(page, 'requisitos-arbol-plegado', theme);
        await page.getByRole('button', { name: 'Expandir todo' }).click();

        if (mobile) {
          // El menú se cierra al redimensionar y la captura ajusta el viewport a la altura del contenido: solo en escritorio
          await row('REQ-017').click();
        } else {
          await row('REQ-017').click({ button: 'right' });
          await page.getByRole('menu').waitFor();
          await capture(page, 'requisitos-menu-contextual', theme);
          await page.getByRole('menuitem', { name: 'Abrir detalle' }).click();
        }

        const panel = page.getByRole('complementary', { name: 'Detalle del requisito' });
        await panel.waitFor();
        await panel.getByRole('combobox', { name: 'Etiquetas' }).fill('r');
        await page.getByRole('listbox').waitFor();
        await capture(page, 'requisitos-etiquetas', theme);
        await page.getByRole('option', { name: 'Rendimiento' }).click();
        await panel.getByRole('textbox', { name: 'Descripción' }).click();
        await page.keyboard.press('Control+A');
        await page.keyboard.press('Control+B');
        await capture(page, 'requisitos-detalle-editor', theme);

        await panel.getByRole('button', { name: 'Aprobar' }).click();
        await page.getByRole('dialog', { name: 'Cambiar el estado de REQ-017' }).waitFor();
        await capture(page, 'requisitos-confirmar-estado', theme);
        await page.getByRole('button', { name: 'Confirmar' }).click();
        await page.getByTestId('toast-ok').waitFor();
        await capture(page, 'requisitos-estado-aprobado', theme);

        // En móvil el detalle es una hoja a pantalla completa: hay que cerrarla para ver el resto
        await page.getByRole('button', { name: 'Cerrar detalle de REQ-017' }).click();
        await page.getByRole('searchbox', { name: 'Buscar requisitos' }).fill('latencia');
        await capture(page, 'requisitos-filtro', theme);
        await page.getByRole('searchbox', { name: 'Buscar requisitos' }).fill('');

        await page.getByRole('tab', { name: 'Matriz de trazabilidad' }).click();
        await page.getByRole('table', { name: 'Matriz de trazabilidad' }).waitFor();
        await capture(page, 'requisitos-matriz', theme);

        await page.goto('/programs/PRG-004/requirements');
        await page.getByTestId('requirements-empty').waitFor();
        await capture(page, 'requisitos-vacio', theme);

        await page.route('**/api/programs/PRG-002/requirements', (route) =>
          route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ statusCode: 503, error: 'Service Unavailable', message: 'down', traceId: '7f3a-c21d' }) }),
        );
        await page.goto('/programs/PRG-002/requirements');
        await page.getByTestId('requirements-error').waitFor();
        await capture(page, 'requisitos-error', theme);
        await page.unroute('**/api/programs/PRG-002/requirements');
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
