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

      test('hitos: tabla, edición inline, avance, alta con errores, eliminación y solo lectura', async ({ page, request }) => {
        await signIn(page, request, 'program_manager');
        await page.goto('/programs/PRG-001');
        await page.getByRole('tab', { name: 'Hitos' }).click();
        const table = page.locator('[data-testid="milestones-table"][aria-busy="false"]');
        await table.waitFor();
        await capture(page, 'hitos-tabla', theme);

        // celda de nombre en edición, y el avance del slider ya guardado
        await page.getByTestId('milestone-name-PRG-001-M03').dblclick();
        await page.getByRole('textbox', { name: 'Nombre del hito' }).fill('CDR revisado');
        await capture(page, 'hitos-edicion', theme);
        await page.keyboard.press('Enter');
        await page.getByTestId('toast-ok').first().waitFor();
        await page.getByTestId('milestone-progress-PRG-001-M02').fill('60');
        await page.getByTestId('milestone-status-PRG-001-M02').filter({ hasText: 'En curso' }).waitFor();
        await capture(page, 'hitos-avance', theme);

        // validación inline
        await page.getByTestId('milestone-name-PRG-001-M04').dblclick();
        await page.getByRole('textbox', { name: 'Nombre del hito' }).fill('a');
        await page.keyboard.press('Enter');
        await page.locator('[aria-invalid="true"]').waitFor();
        await capture(page, 'hitos-edicion-error', theme);
        await page.keyboard.press('Escape');

        // alta con errores y confirmación de borrado
        await page.getByRole('button', { name: 'Nuevo hito' }).click();
        await page.getByRole('button', { name: 'Crear hito' }).click();
        await page.getByTestId('milestone-new-name-error').waitFor();
        await capture(page, 'hitos-nuevo-errores', theme);
        await page.keyboard.press('Escape');
        // la tabla se desplaza en horizontal en móvil y el menú se cierra con cualquier scroll: primero se lleva el botón a la vista
        const rowMenu = page.getByRole('button', { name: 'Acciones para el hito SAT' });
        await rowMenu.scrollIntoViewIfNeeded();
        await rowMenu.click();
        await page.getByRole('menuitem', { name: 'Eliminar' }).click();
        await page.getByRole('alertdialog').waitFor();
        await capture(page, 'hitos-eliminar', theme);
        await page.keyboard.press('Escape');

        // el consultor solo lee
        await signIn(page, request, 'consultant');
        await page.goto('/programs/PRG-001');
        await page.getByRole('tab', { name: 'Hitos' }).click();
        await table.waitFor();
        await capture(page, 'hitos-solo-lectura', theme);
      });

      test('perfil: cuenta, permisos por rol y preferencias en borrador', async ({ page, request }) => {
        await signIn(page, request);
        await page.goto('/profile');
        await page.getByTestId('profile-name').waitFor();
        await capture(page, 'perfil', theme);

        // borrador sin guardar: cambios en los cuatro controles y «Guardar» habilitado
        await page.getByRole('switch', { name: 'Notificaciones en tiempo real' }).click();
        await page.getByRole('checkbox', { name: /resumen semanal/i }).check();
        await page.getByRole('radio', { name: theme === 'dark' ? 'Claro' : 'Oscuro' }).check();
        await capture(page, 'perfil-borrador', theme);

        // el auditor tiene otros permisos
        await signIn(page, request, 'auditor');
        await page.goto('/profile');
        await page.getByTestId('profile-name').waitFor();
        await capture(page, 'perfil-auditor', theme);
      });
    });
  }
}
