import { test, expect } from '../fixtures';
import { RequirementsPage } from '../pages/RequirementsPage';
import { createTempRequirement, fetchRequirement, restoreSeedRequirements, SIBLINGS_UNDER_REQ_015, TEMP_PREFIX } from '../support/requirements';

// SESIÓN 6 · Modales, drag & drop y estados
// Ejercicio tipo: aprobar REQ-017 y comprobar el badge; reordenar prioridades arrastrando.
//
// Qué se practica:
//  - diálogo de confirmación propio (`role="dialog"`): «Cancelar» no cambia nada, «Confirmar» sí;
//  - transiciones de estado con permisos por rol: el mismo botón está activo para un rol y deshabilitado para otro;
//  - `dragTo` para reordenar hermanos, y la aserción sobre el ORDEN (`aria-posinset`), no sobre píxeles;
//  - alternativa de teclado (Alt+flechas) y menú contextual (clic derecho), con «Subir» y «Eliminar».
//
// Datos: solo se tocan los requisitos de PRG-002. Los hermanos de REQ-015 (REQ-016, REQ-017, REQ-019) se reordenan y
// REQ-017 cambia de estado; ANTES de cada test y DESPUÉS de cada test, un helper por API lo deja como estaba
// (REQ-017 en borrador y el orden original). Así cada test arranca igual aunque el anterior haya fallado,
// y la suite puede repetirse sin reiniciar el tenant. Los requisitos temporales llevan el prefijo «s06-» y se borran.

test.describe.configure({ mode: 'serial' });

test.beforeEach(async ({ apiAs }) => {
  await restoreSeedRequirements(await apiAs('admin'));
});

test.afterEach(async ({ apiAs }) => {
  await restoreSeedRequirements(await apiAs('admin'));
});

test.describe('estados y diálogo de confirmación', () => {
  test('diálogo de confirmación: «Cancelar» no cambia nada y «Confirmar» aprueba REQ-017', async ({ managerPage }) => {
    const requirements = new RequirementsPage(managerPage);
    await requirements.goto();
    await requirements.open('REQ-017');
    await expect(requirements.stateBadge()).toHaveAttribute('data-state', 'draft');

    await requirements.detail.getByRole('button', { name: 'Aprobar', exact: true }).click();
    // El diálogo es un `role="dialog"` propio: tiene nombre accesible y dice qué va a pasar
    const dialog = managerPage.getByRole('dialog', { name: 'Cambiar el estado de REQ-017' });
    await expect(dialog).toContainText('REQ-017 pasará de Borrador a Aprobado.');
    await dialog.getByRole('button', { name: 'Cancelar' }).click();
    await expect(dialog).toBeHidden();
    await expect(requirements.stateBadge()).toHaveAttribute('data-state', 'draft');

    await requirements.detail.getByRole('button', { name: 'Aprobar', exact: true }).click();
    await dialog.getByRole('button', { name: 'Confirmar' }).click();
    await expect(managerPage.getByTestId('toast-ok')).toContainText('REQ-017 → Aprobado');
    await expect(requirements.stateBadge()).toHaveAttribute('data-state', 'approved');
  });

  test('permisos: el consultor ve «Aprobar» deshabilitado con su motivo; el gestor lo tiene activo', async ({ managerPage, consultantPage }) => {
    // Dos usuarios a la vez, en la misma pantalla de datos: el mismo botón, dos respuestas
    const manager = new RequirementsPage(managerPage);
    const consultant = new RequirementsPage(consultantPage);
    await Promise.all([manager.goto(), consultant.goto()]);
    await Promise.all([manager.open('REQ-017'), consultant.open('REQ-017')]);

    const approve = consultant.detail.getByRole('button', { name: 'Aprobar', exact: true });
    await expect(approve).toBeDisabled();
    await expect(approve).toHaveAttribute('title', 'Solo el gestor de programa o el admin pueden aprobar');
    await expect(manager.detail.getByRole('button', { name: 'Aprobar', exact: true })).toBeEnabled();
  });

  test('ciclo de vida: cada rol da su paso y el gestor devuelve REQ-017 a borrador', async ({ pageAs }) => {
    // Cuatro roles, cuatro pantallas: el paso lo decide el rol, y el estado lo muestra el badge del panel
    const steps = [
      { role: 'program_manager', button: 'Aprobar', state: 'approved' },
      { role: 'consultant', button: 'Marcar como verificado', state: 'verified' },
      { role: 'auditor', button: 'Validar', state: 'validated' },
      { role: 'program_manager', button: 'Volver a borrador', state: 'draft' },
    ] as const;

    for (const step of steps) {
      const page = await pageAs(step.role);
      const requirements = new RequirementsPage(page);
      await requirements.goto();
      await requirements.open('REQ-017');
      await requirements.detail.getByRole('button', { name: step.button, exact: true }).click();
      await page.getByRole('dialog', { name: 'Cambiar el estado de REQ-017' }).getByRole('button', { name: 'Confirmar' }).click();
      await expect(requirements.stateBadge(), `tras «${step.button}» como ${step.role}`).toHaveAttribute('data-state', step.state);
    }
  });
});

test.describe('reordenar prioridades', () => {
  test('arrastrar: REQ-019 pasa delante de REQ-016 y el orden sobrevive a una recarga', async ({ page }) => {
    const requirements = new RequirementsPage(page);
    await requirements.goto();
    await requirements.expectSiblingOrder(SIBLINGS_UNDER_REQ_015);

    // `dragTo` sobre el centro de la fila: el elemento arrastrado ocupa el sitio de la fila de destino
    await requirements.handle('REQ-019').dragTo(requirements.row('REQ-016'));
    await expect(page.getByTestId('toast-ok')).toContainText('Orden actualizado');
    await requirements.expectSiblingOrder(['REQ-019', 'REQ-016', 'REQ-017']);

    // El orden lo guarda el servidor, no solo la pantalla: tras recargar sigue igual
    await page.reload();
    await requirements.expectSiblingOrder(['REQ-019', 'REQ-016', 'REQ-017']);
  });

  test('soltar sobre un requisito de otro padre no se acepta: ni la pantalla ni el servidor cambian', async ({ page, apiAs }) => {
    const requirements = new RequirementsPage(page);
    await requirements.goto();

    // REQ-021 cuelga de REQ-020, no de REQ-015: no es hermano de REQ-016 y la caída no tiene efecto
    await requirements.handle('REQ-021').dragTo(requirements.row('REQ-016'));
    await expect(page.getByTestId('toast-ok')).toBeHidden(); // una caída aceptada habría mostrado «Orden actualizado»
    await requirements.expectSiblingOrder(SIBLINGS_UNDER_REQ_015);

    await page.reload();
    await requirements.expectSiblingOrder(SIBLINGS_UNDER_REQ_015);
    expect((await fetchRequirement(await apiAs('admin'), 'REQ-021')).parentCode).toBe('REQ-020');
  });

  test('alternativa de teclado: Alt+↑ sube REQ-017 y Alt+↓ lo devuelve a su sitio', async ({ page }) => {
    const requirements = new RequirementsPage(page);
    await requirements.goto();

    // Sin ratón: la fila con foco se mueve con Alt + flechas (el foco sigue en la fila movida)
    await requirements.row('REQ-017').focus();
    await page.keyboard.press('Alt+ArrowUp');
    await requirements.expectSiblingOrder(['REQ-017', 'REQ-016', 'REQ-019']);
    await page.keyboard.press('Alt+ArrowDown');
    await requirements.expectSiblingOrder(SIBLINGS_UNDER_REQ_015);
  });

  test('menú contextual: «Subir» en el primer hermano aparece deshabilitado con su motivo; en el segundo, reordena', async ({ page }) => {
    const requirements = new RequirementsPage(page);
    await requirements.goto();

    const first = await requirements.openContextMenu('REQ-016');
    await expect(first.getByRole('menuitem')).toHaveText(['Abrir detalle', 'Renombrar', 'Añadir hijo', 'Copiar código', 'Subir', 'Bajar', 'Eliminar']);
    const up = first.getByRole('menuitem', { name: 'Subir' });
    await expect(up).toBeDisabled();
    await expect(up).toHaveAttribute('title', 'Ya es el primero de su nivel');
    await page.keyboard.press('Escape');
    await expect(first).toBeHidden();

    const second = await requirements.openContextMenu('REQ-017');
    await second.getByRole('menuitem', { name: 'Subir' }).click();
    await expect(page.getByTestId('toast-ok')).toContainText('REQ-017 se movió');
    await requirements.expectSiblingOrder(['REQ-017', 'REQ-016', 'REQ-019']);
  });
});

test.describe('alta de hijos y borrado con descendientes', () => {
  test('menú contextual: «Añadir hijo» valida el alta; «Eliminar» avisa de los descendientes y «Cancelar» no borra', async ({ page, apiAs }) => {
    // Arrange por API: un requisito raíz propio. Así no se tocan los de la sesión y el cleanup lo borra con sus hijos
    const root = await createTempRequirement(await apiAs('admin'), 'raíz');
    const requirements = new RequirementsPage(page);
    await requirements.goto();

    const menu = await requirements.openContextMenu(root.code);
    await menu.getByRole('menuitem', { name: 'Añadir hijo' }).click();
    const dialog = page.getByRole('dialog', { name: 'Nuevo requisito' });
    await expect(dialog.getByLabel('Requisito padre')).toHaveValue(root.code);

    // Sin título, el error sale en el campo; con título válido, el requisito se crea como hijo del raíz
    await dialog.getByRole('button', { name: 'Crear requisito' }).click();
    await expect(page.getByTestId('requirement-new-title-error')).toHaveText('El título debe tener al menos 3 caracteres');
    await dialog.getByLabel('Título').fill(`${TEMP_PREFIX}hijo ${Date.now().toString(36)}`);
    await dialog.getByLabel('Prioridad').selectOption('high');
    await dialog.getByRole('button', { name: 'Crear requisito' }).click();

    await expect(page.getByTestId('toast-ok')).toContainText('Requisito creado');
    // El código lo asigna el servidor: se lee del panel en lugar de escribirlo en el test
    const code = requirements.detail.getByTestId('requirement-code');
    await expect(code).toHaveText(/^REQ-\d+$/);
    const childCode = (await code.textContent())?.trim() ?? '';
    await expect(requirements.row(childCode)).toHaveAttribute('aria-level', '2');
    await expect(requirements.stateBadge()).toHaveAttribute('data-state', 'draft');
    await page.getByRole('button', { name: `Cerrar detalle de ${childCode}` }).click();

    // Eliminar el raíz: el alertdialog cuenta a los descendientes. «Cancelar» no borra nada.
    const removeMenu = await requirements.openContextMenu(root.code);
    await removeMenu.getByRole('menuitem', { name: 'Eliminar' }).click();
    const alert = page.getByRole('alertdialog', { name: 'Eliminar requisito' });
    await expect(alert).toContainText(`${root.code} y sus 1 requisitos descendientes se eliminarán de forma permanente.`);
    await alert.getByRole('button', { name: 'Cancelar' }).click();
    await expect(requirements.row(root.code)).toBeVisible();

    const confirmMenu = await requirements.openContextMenu(root.code);
    await confirmMenu.getByRole('menuitem', { name: 'Eliminar' }).click();
    await alert.getByRole('button', { name: 'Eliminar', exact: true }).click();
    // Los avisos se apilan (varios toasts a la vez): se localiza el que habla de este requisito
    await expect(page.getByTestId('toast-ok').filter({ hasText: `${root.code} eliminado` })).toBeVisible();
    await expect(requirements.row(root.code)).toBeHidden();
    await expect(requirements.row(childCode)).toBeHidden(); // el hijo se fue con él
  });
});
