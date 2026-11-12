import { expect, test } from '@playwright/test';
import { chaosOff } from '../../support/admin';
import { openAs, resetTenant, seedStorage } from '../../support/auth';
import { THEMES, captureMobile } from '../../support/screens';

// Capturas de la app móvil en claro y oscuro a 390 px → docs/screens/mobile-<pantalla>-<tema>-390.png
// (pnpm e2e:mobile:screens). Una captura es la pantalla visible, no la página entera: el contenido hace scroll dentro de la app.

const TENANT = 'alumno24';
test.describe.configure({ mode: 'serial' });

test.beforeAll(async ({ request }) => {
  await chaosOff(request, TENANT);
  await resetTenant(request, TENANT);
});

for (const theme of THEMES) {
  test.describe(`capturas móvil ${theme} 390`, () => {
    test('acceso, MFA y usuarios de prueba', async ({ page }) => {
      await seedStorage(page.context(), { tenant: TENANT, theme });
      await page.goto('/login');
      await expect(page.getByTestId('test-users')).toBeVisible();
      await captureMobile(page, 'login', theme);

      await page.getByRole('radio', { name: /admin$/ }).click();
      await page.getByRole('button', { name: 'Entrar' }).click();
      await expect(page.getByRole('heading', { name: 'Verificación en dos pasos' })).toBeVisible();
      await page.getByLabel('Código de verificación').fill('123456');
      await captureMobile(page, 'login-mfa', theme);
    });

    test('programas: lista, filtro por estado y detalle', async ({ page }) => {
      await openAs(page, 'admin', '/programs', { tenant: TENANT, theme });
      await expect(page.getByTestId('programs-count')).toHaveText('1–10 de 24');
      await captureMobile(page, 'programas', theme);

      await page.getByRole('radio', { name: 'En pausa' }).click();
      await expect(page.getByTestId(/^programs-row-PRG-\d+$/)).toHaveCount(3);
      await captureMobile(page, 'programas-en-pausa', theme);

      await page.goto('/programs/PRG-002');
      await expect(page.getByTestId(/^milestone-row-PRG-002-M\d+$/)).toHaveCount(6);
      await captureMobile(page, 'programa-detalle', theme);
    });

    test('requisitos en lectura: árbol y detalle', async ({ page }) => {
      await openAs(page, 'admin', '/programs/PRG-002/requirements', { tenant: TENANT, theme });
      await expect(page.getByTestId('requirements-count')).toContainText('14 de 14');
      await captureMobile(page, 'requisitos', theme);

      await page.getByRole('button', { name: 'Abrir detalle de REQ-017' }).click();
      await expect(page.getByRole('dialog')).toContainText('REQ-017');
      await captureMobile(page, 'requisito-detalle', theme);
      await page.getByRole('button', { name: 'Cerrar' }).click();

      await page.getByRole('radio', { name: 'Documento' }).click();
      await expect(page.getByTestId('requirements-document')).toBeVisible();
      await captureMobile(page, 'requisitos-documento', theme);
    });

    test('requisitos: alta, traza, edición, mover, transición y matriz (sin confirmar nada)', async ({ page }) => {
      await openAs(page, 'admin', '/programs/PRG-002/requirements', { tenant: TENANT, theme });
      await expect(page.getByTestId('requirements-count')).toContainText('14 de 14');

      await page.getByRole('button', { name: 'Nuevo requisito', exact: true }).click();
      await expect(page.getByRole('dialog', { name: 'Nuevo requisito' })).toBeVisible();
      await captureMobile(page, 'requisito-nuevo', theme);
      // El selector de padre con todas las opciones: la lista hace scroll y «Cerrar» sigue a la vista
      await page.getByRole('dialog', { name: 'Nuevo requisito' }).getByRole('combobox', { name: 'Requisito padre' }).click();
      await expect(page.getByRole('dialog', { name: 'Requisito padre' })).toBeVisible();
      await captureMobile(page, 'requisito-padre', theme);
      await page.getByRole('dialog', { name: 'Requisito padre' }).getByRole('button', { name: 'Cerrar', exact: true }).click();
      await page.getByRole('dialog', { name: 'Nuevo requisito' }).getByRole('button', { name: 'Cancelar', exact: true }).click();

      // REQ-015 es el requisito con más contenido: casos, NC y botones de acción
      await page.getByRole('button', { name: 'Abrir detalle de REQ-015', exact: true }).click();
      const sheet = page.getByRole('dialog', { name: 'Detalle del requisito' });
      await expect(sheet.getByTestId('requirement-trace')).toBeVisible();
      await captureMobile(page, 'requisito-detalle-largo', theme);
      await sheet.getByTestId('requirement-trace').scrollIntoViewIfNeeded();
      await captureMobile(page, 'requisito-trazabilidad', theme);

      await sheet.getByRole('button', { name: 'Editar', exact: true }).click();
      await expect(sheet.getByTestId('requirement-edit-form')).toBeVisible();
      await captureMobile(page, 'requisito-editar', theme);
      await sheet.getByRole('button', { name: 'Cancelar', exact: true }).click();

      await sheet.getByRole('button', { name: 'Mover a…', exact: true }).click();
      await expect(sheet.getByTestId('requirement-move-form')).toBeVisible();
      await captureMobile(page, 'requisito-mover', theme);
      await sheet.getByRole('button', { name: 'Cancelar', exact: true }).click();
      await sheet.getByRole('button', { name: 'Cerrar', exact: true }).click();

      await page.getByRole('button', { name: 'Abrir detalle de REQ-017', exact: true }).click();
      await sheet.getByRole('button', { name: 'Aprobar', exact: true }).click();
      const transition = page.getByRole('dialog', { name: 'Cambiar el estado de REQ-017' });
      await expect(transition).toBeVisible();
      await captureMobile(page, 'requisito-transicion', theme);
      await transition.getByRole('button', { name: 'Cancelar', exact: true }).click();
      await sheet.getByRole('button', { name: 'Cerrar', exact: true }).click();

      await page.getByRole('radio', { name: 'Matriz de trazabilidad' }).click();
      await expect(page.getByTestId('matrix-table')).toBeVisible();
      await captureMobile(page, 'requisitos-matriz', theme);
    });

    test('no conformidades: tablero, columna a la vista, detalle y cierre', async ({ page }) => {
      await openAs(page, 'admin', '/nc', { tenant: TENANT, theme });
      await expect(page.getByTestId('nc-column-count-open')).toHaveText('4');
      await captureMobile(page, 'nc-tablero', theme);

      await page.getByRole('radio', { name: 'Crítica' }).click();
      await expect(page.getByTestId(/^nc-card-NC-\d+$/)).toHaveCount(4);
      await captureMobile(page, 'nc-filtro-critica', theme);
      await page.getByRole('radio', { name: 'Todas' }).click();

      await page.getByTestId('nc-card-open-NC-003').click();
      const sheet = page.getByRole('dialog');
      await expect(sheet.getByTestId('nc-state-badge')).toHaveAttribute('data-state', 'corrective_action');
      await captureMobile(page, 'nc-detalle', theme);

      await sheet.getByRole('button', { name: 'Mover a «Cerrada»' }).click();
      await sheet.getByLabel('Comentario de cierre').fill('Corto');
      await sheet.getByRole('button', { name: 'Cerrar no conformidad' }).click();
      await expect(sheet.getByTestId('nc-close-error')).toBeVisible();
      await captureMobile(page, 'nc-cierre', theme);
    });

    test('panel de misión: KPIs, gráficas y feed en vivo', async ({ page }) => {
      await openAs(page, 'admin', '/mission', { tenant: TENANT, theme });
      await expect(page.getByTestId('mission-connection')).toHaveAttribute('data-state', 'connected', { timeout: 15_000 });
      await expect(page.getByTestId('mission-kpi-value-programs')).toHaveText('12');
      await captureMobile(page, 'mision', theme);
    });

    test('documentos en lectura: lista (consultor con aviso), ficha y 403', async ({ page }) => {
      await openAs(page, 'consultant', '/documents', { tenant: TENANT, theme });
      await expect(page.getByTestId('documents-hidden-note')).toBeVisible();
      await captureMobile(page, 'documentos', theme);

      await page.goto('/documents/DOC-003');
      await expect(page.getByTestId('document-forbidden')).toBeVisible();
      await captureMobile(page, 'documento-403', theme);

      await openAs(page, 'admin', '/documents/DOC-004', { tenant: TENANT, theme });
      await expect(page.getByTestId('viewer-page-1')).toBeVisible();
      await captureMobile(page, 'documento-detalle', theme);
    });

    test('perfil', async ({ page }) => {
      await openAs(page, 'admin', '/profile', { tenant: TENANT, theme });
      await expect(page.getByTestId('profile-name')).toBeVisible();
      await captureMobile(page, 'perfil', theme);
    });
  });
}
