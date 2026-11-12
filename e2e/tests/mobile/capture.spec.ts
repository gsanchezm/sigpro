import { expect, test } from '@playwright/test';
import { chaosOff } from '../../support/admin';
import { openAs, resetTenant, seedStorage } from '../../support/auth';
import { png } from '../../support/files';
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
      await expect(page.getByRole('button', { name: 'Editar programa', exact: true })).toBeVisible();
      await captureMobile(page, 'programa-detalle', theme);

      await page.getByRole('radio', { name: 'Hitos', exact: true }).click();
      await expect(page.getByTestId(/^milestone-row-PRG-002-M\d+$/)).toHaveCount(6);
      await captureMobile(page, 'programa-hitos', theme);

      await page.getByRole('radio', { name: 'Proveedores', exact: true }).click();
      await expect(page.getByTestId('suppliers-panel')).toBeVisible();
      await captureMobile(page, 'programa-proveedores', theme);
    });

    test('programas: asistente de alta, menú de fila, edición y selección', async ({ page }) => {
      await openAs(page, 'admin', '/programs', { tenant: TENANT, theme });
      await expect(page.getByTestId('programs-count')).toHaveText('1–10 de 24');
      await page.getByRole('button', { name: 'Nuevo programa', exact: true }).click();
      const wizard = page.getByRole('dialog', { name: 'Nuevo programa', exact: true });
      await expect(wizard.getByTestId('programs-wizard-step-text')).toHaveText('Paso 1 de 3');
      await captureMobile(page, 'programas-nuevo', theme);
      await wizard.getByRole('button', { name: 'Cancelar', exact: true }).click();

      await page.getByRole('button', { name: 'Acciones para PRG-001', exact: true }).click();
      await expect(page.getByRole('dialog', { name: 'Acciones para PRG-001', exact: true })).toBeVisible();
      await captureMobile(page, 'programas-menu', theme);
      await page.getByRole('button', { name: 'Cerrar', exact: true }).click();

      await page.getByRole('button', { name: 'Seleccionar', exact: true }).click();
      await page.getByRole('checkbox', { name: 'Seleccionar PRG-001', exact: true }).click();
      await expect(page.getByTestId('programs-bulk-bar')).toBeVisible();
      await captureMobile(page, 'programas-seleccion', theme);

      await page.goto('/programs/PRG-003/edit');
      await expect(page.getByRole('heading', { level: 1, name: 'Editar programa', exact: true })).toBeVisible();
      await captureMobile(page, 'programa-editar', theme);
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

    test('no conformidades: alta con errores, selector de programa, edición y asignación (sin guardar nada)', async ({ page }) => {
      await openAs(page, 'admin', '/nc', { tenant: TENANT, theme });
      await expect(page.getByTestId('nc-column-count-open')).toHaveText('4');
      await captureMobile(page, 'nc-tablero-nueva', theme);

      await page.getByRole('button', { name: 'Nueva no conformidad', exact: true }).click();
      const form = page.getByRole('dialog', { name: 'Nueva no conformidad', exact: true });
      await form.getByRole('button', { name: 'Abrir no conformidad', exact: true }).click();
      await expect(form.getByTestId('nc-new-severity-error')).toBeVisible();
      await captureMobile(page, 'nc-nueva-errores', theme);
      await form.getByRole('combobox', { name: 'Programa', exact: true }).click();
      await expect(page.getByRole('dialog', { name: 'Programa', exact: true })).toBeVisible();
      await captureMobile(page, 'nc-nueva-programa', theme);
      await page.getByRole('dialog', { name: 'Programa', exact: true }).getByRole('radio', { name: /^PRG-002 · / }).click();
      await form.getByRole('radio', { name: 'Crítica' }).click();
      await form.getByLabel('Descripción', { exact: true }).fill('Fallo intermitente del enlace de datos');
      await captureMobile(page, 'nc-nueva-completa', theme);
      await form.getByRole('button', { name: 'Cancelar', exact: true }).click();

      await page.getByTestId('nc-card-open-NC-012').click();
      const sheet = page.getByRole('dialog', { name: 'Detalle de NC-012', exact: true });
      await expect(sheet.getByRole('button', { name: 'Editar', exact: true })).toBeVisible();
      await captureMobile(page, 'nc-detalle-editar', theme);
      await sheet.getByRole('button', { name: 'Editar', exact: true }).click();
      await expect(sheet.getByTestId('nc-edit-form')).toBeVisible();
      await sheet.getByRole('radio', { name: 'Mayor' }).click();
      await captureMobile(page, 'nc-editar', theme);
      await sheet.getByRole('combobox', { name: 'Asignada a', exact: true }).click();
      await expect(page.getByRole('dialog', { name: 'Asignada a', exact: true })).toBeVisible();
      await captureMobile(page, 'nc-editar-asignar', theme);
      await page.getByRole('dialog', { name: 'Asignada a', exact: true }).getByRole('button', { name: 'Cerrar', exact: true }).click();
      await sheet.getByRole('button', { name: 'Cancelar', exact: true }).click();
      await sheet.getByRole('button', { name: 'Cerrar', exact: true }).click();

      // El auditor lee y comenta, pero «Editar» queda deshabilitado con su motivo
      await openAs(page, 'auditor', '/nc', { tenant: TENANT, theme });
      await page.getByTestId('nc-card-open-NC-012').click();
      await expect(page.getByTestId('nc-detail-denied')).toBeVisible();
      await captureMobile(page, 'nc-editar-denegado', theme);
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

    test('documentos: acciones, comparar, publicar y menú de la lista (sin publicar ni descargar nada)', async ({ page }) => {
      await openAs(page, 'admin', '/documents/DOC-001', { tenant: TENANT, theme });
      await expect(page.getByTestId('viewer-page-1')).toBeVisible();
      await captureMobile(page, 'documento-acciones', theme);
      await expect(page.getByTestId('document-diff-stats')).toBeVisible();
      await page.getByRole('heading', { name: 'Comparar versiones', exact: true }).evaluate((heading) => heading.scrollIntoView({ block: 'start' }));
      await captureMobile(page, 'documento-comparar', theme);
      await page.getByRole('combobox', { name: 'Desde', exact: true }).click();
      await expect(page.getByRole('dialog', { name: 'Desde', exact: true })).toBeVisible();
      await captureMobile(page, 'documento-comparar-desde', theme);
      await page.getByRole('dialog', { name: 'Desde', exact: true }).getByRole('button', { name: 'Cerrar', exact: true }).click();

      await openAs(page, 'admin', '/documents/DOC-002', { tenant: TENANT, theme });
      await page.getByRole('button', { name: 'Publicar nueva versión', exact: true }).click();
      const form = page.getByRole('dialog', { name: 'Nueva versión de DOC-002', exact: true });
      await expect(form.getByLabel('Contenido (una línea por fila)', { exact: true })).toHaveValue(/^Especificación técnica/);
      await captureMobile(page, 'documento-publicar', theme);
      await form.getByLabel('Contenido (una línea por fila)', { exact: true }).fill('');
      await form.getByRole('button', { name: 'Publicar versión', exact: true }).click();
      await expect(form.getByTestId('document-publish-text-error')).toBeVisible();
      await captureMobile(page, 'documento-publicar-errores', theme);
      await form.getByRole('button', { name: 'Cancelar', exact: true }).click();

      await openAs(page, 'consultant', '/documents/DOC-002', { tenant: TENANT, theme });
      await expect(page.getByTestId('document-publish-reason')).toBeVisible();
      await captureMobile(page, 'documento-publicar-denegado', theme);

      await page.goto('/documents');
      await page.getByRole('button', { name: 'Acciones para DOC-001', exact: true }).click();
      await expect(page.getByRole('dialog', { name: 'Acciones para DOC-001', exact: true })).toBeVisible();
      await captureMobile(page, 'documentos-menu', theme);
    });

    test('verificación: lista, filtros, menú, detalle, evidencia ampliada y registro (sin enviar nada)', async ({ page }) => {
      await openAs(page, 'consultant', '/verification', { tenant: TENANT, theme });
      await expect(page.getByTestId('verification-count')).toHaveText('1–10 de 25');
      await captureMobile(page, 'verificacion', theme);

      await page.getByRole('combobox', { name: 'Último resultado', exact: true }).click();
      await expect(page.getByRole('dialog', { name: 'Último resultado', exact: true })).toBeVisible();
      await captureMobile(page, 'verificacion-filtro', theme);
      await page.getByRole('radio', { name: 'Fallido', exact: true }).click();
      await expect(page.getByTestId('testcase-row-TC-001').or(page.getByTestId('verification-empty')).first()).toBeVisible();
      await captureMobile(page, 'verificacion-fallidos', theme);
      await page.getByRole('button', { name: 'Limpiar filtros', exact: true }).click();

      await page.getByRole('button', { name: 'Seleccionar', exact: true }).click();
      await page.getByRole('checkbox', { name: 'Seleccionar TC-002', exact: true }).click();
      await expect(page.getByTestId('verification-bulk-bar')).toBeVisible();
      await captureMobile(page, 'verificacion-seleccion', theme);

      await page.getByRole('button', { name: 'Acciones para TC-003', exact: true }).click();
      await expect(page.getByRole('dialog', { name: 'Acciones para TC-003', exact: true })).toBeVisible();
      await captureMobile(page, 'verificacion-menu', theme);

      await page.goto('/verification/TC-001');
      await expect(page.getByRole('heading', { level: 1, name: 'Verificar disponibilidad (caso 001)' })).toBeVisible();
      await captureMobile(page, 'verificacion-detalle', theme);
      await expect(page.getByTestId('testcase-runs')).toBeVisible();
      await page.getByTestId('testcase-runs').scrollIntoViewIfNeeded();
      const thumb = page.getByRole('button', { name: /Ampliar · Evidencia TC-001/ });
      await expect(thumb).toBeVisible();
      await captureMobile(page, 'verificacion-historial', theme);
      await thumb.click();
      await expect(page.getByTestId('evidence-zoom')).toBeVisible();
      await captureMobile(page, 'verificacion-evidencia', theme);
      await page.getByRole('button', { name: 'Cerrar', exact: true }).click();

      await page.goto('/verification/TC-005?run=1');
      await expect(page.getByRole('heading', { level: 2, name: 'Registrar ejecución' })).toBeInViewport();
      await page.getByRole('radio', { name: 'Fallido', exact: true }).click();
      await page.getByLabel('Notas', { exact: true }).fill('El caso falla al reiniciar el servicio.');
      const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.getByRole('button', { name: 'Adjuntar un archivo', exact: true }).click()]);
      await chooser.setFiles(png('captura-fallo.png'));
      await expect(page.getByTestId('run-files').getByRole('listitem')).toHaveCount(1);
      await captureMobile(page, 'verificacion-registrar', theme);

      await openAs(page, 'auditor', '/verification/TC-007?run=1', { tenant: TENANT, theme });
      await expect(page.getByTestId('run-denied')).toBeVisible();
      await captureMobile(page, 'verificacion-registrar-denegado', theme);
    });

    test('auditoría: feed, filtros con errores de fecha y aviso sin permiso (sin cambiar nada)', async ({ page }) => {
      await openAs(page, 'auditor', '/audit', { tenant: TENANT, theme });
      await expect(page.getByTestId('audit-count')).toHaveText('Mostrando 20 de 130 eventos');
      await captureMobile(page, 'auditoria', theme);

      await page.getByLabel('Desde', { exact: true }).fill('2026-13-45');
      await page.getByLabel('Hasta', { exact: true }).fill('2026-01-06');
      await expect(page.getByTestId('audit-filter-from-error')).toBeVisible();
      await captureMobile(page, 'auditoria-fechas', theme);

      await page.getByRole('button', { name: 'Limpiar filtros', exact: true }).click();
      await page.getByRole('combobox', { name: 'Entidad', exact: true }).click();
      await expect(page.getByRole('dialog', { name: 'Entidad', exact: true })).toBeVisible();
      await captureMobile(page, 'auditoria-entidad', theme);
      await page.getByRole('dialog', { name: 'Entidad', exact: true }).getByRole('button', { name: 'Cerrar', exact: true }).click();

      await openAs(page, 'consultant', '/audit', { tenant: TENANT, theme });
      await expect(page.getByTestId('audit-forbidden')).toBeVisible();
      await captureMobile(page, 'auditoria-denegada', theme);
    });

    test('administración: usuarios, modo caos, datos y diálogos (sin aplicar ni restaurar nada)', async ({ page }) => {
      await openAs(page, 'admin', '/admin', { tenant: TENANT, theme });
      await expect(page.getByTestId('admin-users-count')).toHaveText('7 de 7 usuarios');
      await captureMobile(page, 'admin-usuarios', theme);

      await page.getByRole('combobox', { name: 'Rol de Andrés Molina', exact: true }).click();
      await expect(page.getByRole('dialog', { name: 'Rol de Andrés Molina', exact: true })).toBeVisible();
      await captureMobile(page, 'admin-usuarios-rol', theme);
      await page.getByRole('dialog', { name: 'Rol de Andrés Molina', exact: true }).getByRole('button', { name: 'Cerrar', exact: true }).click();

      await page.getByRole('tab', { name: 'Auditoría', exact: true }).click();
      await expect(page.getByTestId('audit-count')).toHaveText('Mostrando 20 de 130 eventos');
      await captureMobile(page, 'admin-auditoria', theme);

      await page.getByRole('tab', { name: 'Modo caos', exact: true }).click();
      await expect(page.getByTestId('admin-chaos-panel')).toBeVisible();
      await captureMobile(page, 'admin-caos', theme);
      for (let index = 0; index < 5; index += 1) await page.getByRole('button', { name: 'Latencia máxima +100', exact: true }).click();
      await page.getByTestId('admin-chaos-flaky').click();
      await expect(page.getByTestId('admin-chaos-unsaved')).toBeVisible();
      await captureMobile(page, 'admin-caos-cambios', theme);

      await page.getByRole('tab', { name: 'Datos', exact: true }).click();
      await expect(page.getByTestId('admin-data-panel')).toBeVisible();
      await captureMobile(page, 'admin-datos', theme);
      await page.getByTestId('admin-reset').click();
      await expect(page.getByRole('dialog', { name: 'Restaurar datos del tenant', exact: true })).toBeVisible();
      await captureMobile(page, 'admin-datos-reinicio', theme);
      await page.getByRole('dialog', { name: 'Restaurar datos del tenant', exact: true }).getByRole('button', { name: 'Cancelar', exact: true }).click();
      await page.getByRole('button', { name: 'Información del tenant', exact: true }).click();
      await expect(page.getByRole('dialog', { name: 'Información del tenant', exact: true })).toBeVisible();
      await captureMobile(page, 'admin-datos-info', theme);

      await openAs(page, 'auditor', '/admin', { tenant: TENANT, theme });
      await expect(page.getByTestId('admin-forbidden')).toBeVisible();
      await captureMobile(page, 'admin-denegada', theme);
    });

    test('acceso: registro, errores, solicitud enviada y recuperar contraseña', async ({ page }) => {
      await seedStorage(page.context(), { tenant: TENANT, theme });
      await page.goto('/register');
      await expect(page.getByRole('heading', { name: 'Solicitar acceso', level: 1 })).toBeVisible();
      await captureMobile(page, 'registro', theme);

      await page.getByRole('button', { name: 'Enviar solicitud', exact: true }).click();
      await expect(page.getByTestId('register-terms-error')).toBeVisible();
      await page.getByTestId('register-terms-error').scrollIntoViewIfNeeded();
      await captureMobile(page, 'registro-errores', theme);

      await page.getByLabel('Nombre', { exact: true }).fill('Ana');
      await page.getByLabel('Apellidos', { exact: true }).fill('Prueba');
      await page.getByLabel('Correo corporativo', { exact: true }).fill(`captura-${theme}-${Date.now()}@organizacion.es`);
      await page.getByLabel('Organización / Unidad', { exact: true }).fill('Unidad de pruebas');
      await page.getByLabel('Contraseña', { exact: true }).fill('Abcdefghij1!');
      await page.getByLabel('Confirmar contraseña', { exact: true }).fill('Abcdefghij1!');
      await page.getByRole('checkbox', { name: /He leído y acepto/ }).click();
      await page.getByTestId('register-password-meter').scrollIntoViewIfNeeded();
      await captureMobile(page, 'registro-medidor', theme);
      await page.getByRole('button', { name: 'Enviar solicitud', exact: true }).click();
      await expect(page.getByTestId('verify-panel')).toBeVisible();
      await captureMobile(page, 'registro-enviado', theme);

      await page.goto('/forgot');
      await page.getByLabel('Correo electrónico', { exact: true }).fill('cualquiera@sigpro.test');
      await page.getByRole('button', { name: 'Enviar enlace', exact: true }).click();
      await expect(page.getByTestId('forgot-sent')).toBeVisible();
      await captureMobile(page, 'recuperar', theme);
    });

    test('páginas legales y ayuda', async ({ page }) => {
      await seedStorage(page.context(), { tenant: TENANT, theme });
      await page.goto('/legal/terms');
      await expect(page.getByRole('heading', { name: 'Términos de uso', level: 1 })).toBeVisible();
      await captureMobile(page, 'legal-condiciones', theme);
      await page.goto('/help');
      await expect(page.getByRole('heading', { name: 'Ayuda', level: 1 })).toBeVisible();
      await captureMobile(page, 'ayuda', theme);
    });

    test('perfil', async ({ page }) => {
      await openAs(page, 'admin', '/profile', { tenant: TENANT, theme });
      await expect(page.getByTestId('profile-name')).toBeVisible();
      await captureMobile(page, 'perfil', theme);
      await page.getByTestId('profile-live').scrollIntoViewIfNeeded();
      await captureMobile(page, 'perfil-preferencias', theme);
      await page.getByRole('combobox', { name: 'Idioma de la interfaz', exact: true }).click();
      await expect(page.getByRole('dialog', { name: 'Idioma de la interfaz', exact: true })).toBeVisible();
      await captureMobile(page, 'perfil-idioma', theme);
    });
  });
}
