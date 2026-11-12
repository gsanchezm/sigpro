import { expect, test, type Page } from '@playwright/test';
import { chaosOff } from '../../support/admin';
import { openAs, resetTenant } from '../../support/auth';

// Requisitos en el móvil (paridad funcional con la web): transiciones de estado por rol, alta, edición, borrado, «Mover a…»
// y matriz de trazabilidad. Cada prueba parte de los datos del seed (`resetTenant` antes de cada una), así que el orden no
// importa. Tenant propio (alumno24), programa PRG-002 (REQ-015 … REQ-028). Locators por rol y nombre primero; el `testID`
// (que React Native Web pinta como `data-testid`) como respaldo, sobre todo para los selectores de opciones.

const TENANT = 'alumno24';
const PROGRAM = '/programs/PRG-002/requirements';
test.describe.configure({ mode: 'serial' });

test.beforeAll(async ({ request }) => {
  await chaosOff(request, TENANT);
});

test.beforeEach(async ({ request }) => {
  await resetTenant(request, TENANT);
});

test.afterAll(async ({ request }) => {
  await resetTenant(request, TENANT);
});

type Role = 'admin' | 'program_manager' | 'consultant' | 'auditor';
const open = (page: Page, role: Role = 'admin', path = PROGRAM) => openAs(page, role, path, { tenant: TENANT });
/** La hoja de detalle, y el diálogo de confirmación que nace dentro de ella (siempre por nombre, nunca el primer «dialog»). */
const sheet = (page: Page) => page.getByRole('dialog', { name: 'Detalle del requisito' });
const action = (page: Page, name: string) => sheet(page).getByRole('button', { name, exact: true });
/** Abre el requisito desde el árbol (su botón de detalle tiene nombre accesible «Abrir detalle de REQ-…»). */
const openRequirement = async (page: Page, code: string) => {
  await page.getByRole('button', { name: `Abrir detalle de ${code}`, exact: true }).click();
  await expect(sheet(page).getByTestId('requirement-code')).toHaveText(code);
};
/** Códigos de las filas del árbol en orden de lectura (solo los `requirement-row-REQ-…`, no sus subelementos). */
const rowOrder = (page: Page) =>
  page.getByTestId(/^requirement-row-REQ-\d+$/).evaluateAll((rows) => rows.map((row) => (row.getAttribute('data-testid') ?? '').replace('requirement-row-', '')));
const stateOf = (page: Page) => sheet(page).getByTestId('requirement-state-badge');
const noHorizontalOverflow = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);

test.describe('Móvil · requisitos: transiciones de estado por rol', () => {
  test('el consultor ve «Aprobar» deshabilitado con su motivo; el gestor aprueba tras confirmar (cancelar no cambia nada)', async ({ page }) => {
    await open(page, 'consultant');
    await openRequirement(page, 'REQ-017');
    await expect(stateOf(page)).toHaveAttribute('data-state', 'draft');
    const approve = sheet(page).getByTestId('requirement-transition-approved');
    await expect(approve).toBeDisabled();
    await expect(page.getByTestId('requirement-transition-reason-approved')).toHaveText('Solo el gestor de programa o el admin pueden aprobar');
    await expect(sheet(page).getByTestId('requirement-flow-step-approved')).toHaveAttribute('data-status', 'future');

    await open(page, 'program_manager');
    await openRequirement(page, 'REQ-017');
    await action(page, 'Aprobar').click();
    const dialog = page.getByRole('dialog', { name: 'Cambiar el estado de REQ-017' });
    await expect(dialog).toContainText('REQ-017 pasará de Borrador a Aprobado.');
    await dialog.getByRole('button', { name: 'Cancelar', exact: true }).click();
    await expect(dialog).toBeHidden();
    await expect(stateOf(page)).toHaveAttribute('data-state', 'draft');

    await action(page, 'Aprobar').click();
    await page.getByRole('dialog', { name: 'Cambiar el estado de REQ-017' }).getByRole('button', { name: 'Confirmar', exact: true }).click();
    await expect(page.getByTestId('toast-ok').filter({ hasText: 'REQ-017 → Aprobado' })).toBeVisible();
    await expect(stateOf(page)).toHaveAttribute('data-state', 'approved');
    await expect(sheet(page).getByTestId('requirement-flow-step-approved')).toHaveAttribute('data-status', 'current');
    // El gestor no verifica: el botón existe, deshabilitado y con motivo
    await expect(action(page, 'Marcar como verificado')).toBeDisabled();
    await expect(page.getByTestId('requirement-transition-reason-verified')).toHaveText('Solo el consultor o el admin pueden verificar');
  });

  test('cadena completa: gestor aprueba, consultor verifica, auditor valida y el gestor devuelve a borrador (el auditor no puede)', async ({ page }) => {
    await open(page, 'program_manager');
    await openRequirement(page, 'REQ-017');
    await action(page, 'Aprobar').click();
    await page.getByRole('dialog', { name: 'Cambiar el estado de REQ-017' }).getByRole('button', { name: 'Confirmar', exact: true }).click();
    await expect(stateOf(page)).toHaveAttribute('data-state', 'approved');

    // En «Aprobado» el consultor puede verificar, pero no devolver a borrador (ese paso es del gestor o del admin)
    await open(page, 'consultant');
    await openRequirement(page, 'REQ-017');
    await expect(action(page, 'Volver a borrador')).toBeDisabled();
    await action(page, 'Marcar como verificado').click();
    await page.getByRole('dialog', { name: 'Cambiar el estado de REQ-017' }).getByRole('button', { name: 'Confirmar', exact: true }).click();
    await expect(stateOf(page)).toHaveAttribute('data-state', 'verified');
    await expect(page.getByTestId('toast-ok').filter({ hasText: 'REQ-017 → Verificado' })).toBeVisible();

    await open(page, 'auditor');
    await openRequirement(page, 'REQ-017');
    await expect(action(page, 'Validar')).toBeEnabled();
    await expect(action(page, 'Volver a borrador')).toBeDisabled();
    await expect(page.getByTestId('requirement-transition-reason-draft')).toHaveText('Solo el gestor de programa o el admin pueden devolver a borrador');
    await action(page, 'Validar').click();
    await page.getByRole('dialog', { name: 'Cambiar el estado de REQ-017' }).getByRole('button', { name: 'Confirmar', exact: true }).click();
    await expect(stateOf(page)).toHaveAttribute('data-state', 'validated');

    await open(page, 'program_manager');
    await openRequirement(page, 'REQ-017');
    await action(page, 'Volver a borrador').click();
    await page.getByRole('dialog', { name: 'Cambiar el estado de REQ-017' }).getByRole('button', { name: 'Confirmar', exact: true }).click();
    await expect(stateOf(page)).toHaveAttribute('data-state', 'draft');
  });

  test('un fallo de la API (403) se muestra dentro del diálogo y este queda abierto', async ({ page }) => {
    await open(page, 'admin');
    await openRequirement(page, 'REQ-017');
    await page.route('**/api/requirements/REQ-017/transition', (route) =>
      route.fulfill({ status: 403, contentType: 'application/json', body: JSON.stringify({ statusCode: 403, error: 'Forbidden', message: 'forbidden', traceId: '9c1e-42aa' }) }),
    );
    await action(page, 'Aprobar').click();
    const dialog = page.getByRole('dialog', { name: 'Cambiar el estado de REQ-017' });
    await dialog.getByRole('button', { name: 'Confirmar', exact: true }).click();
    await expect(dialog.getByRole('alert')).toContainText('POST /api/requirements/REQ-017/transition → 403 Forbidden · trace 9c1e-42aa');
    await expect(dialog).toBeVisible();
    await page.unroute('**/api/requirements/REQ-017/transition');
    await dialog.getByRole('button', { name: 'Cancelar', exact: true }).click();
    await expect(stateOf(page)).toHaveAttribute('data-state', 'draft');
  });
});

test.describe('Móvil · requisitos: alta', () => {
  test('el auditor no puede dar de alta: «Nuevo requisito» deshabilitado con su motivo visible', async ({ page }) => {
    await open(page, 'auditor');
    await expect(page.getByTestId('requirements-count')).toContainText('14 de 14');
    await expect(page.getByRole('button', { name: 'Nuevo requisito', exact: true })).toBeDisabled();
    await expect(page.getByTestId('requirements-new-reason')).toHaveText('Tu rol no permite crear requisitos');
  });

  test('la validación del título bloquea el envío; un alta válida aparece en el árbol y abre su detalle', async ({ page }) => {
    await open(page, 'admin');
    await expect(page.getByTestId('requirements-count')).toContainText('14 de 14');
    await page.getByRole('button', { name: 'Nuevo requisito', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Nuevo requisito' });
    await expect(dialog).toBeVisible();

    await dialog.getByRole('button', { name: 'Crear requisito', exact: true }).click();
    await expect(page.getByTestId('requirement-new-title-error')).toHaveText('El título debe tener al menos 3 caracteres');
    await expect(page.getByTestId('requirements-count')).toContainText('14 de 14'); // nada se envió

    await dialog.getByLabel('Título').fill('Requisito creado desde el móvil');
    await expect(page.getByTestId('requirement-new-title-error')).toBeHidden(); // el aviso desaparece al corregir
    // Selectores de hoja: el campo es un `combobox` con su etiqueta; cada opción tiene su `testID`
    await dialog.getByRole('combobox', { name: 'Prioridad' }).click();
    await page.getByRole('dialog', { name: 'Prioridad' }).getByRole('radio', { name: 'Alta', exact: true }).click();
    await dialog.getByRole('button', { name: 'Ciberseguridad', exact: true }).click();
    await expect(dialog.getByRole('button', { name: 'Ciberseguridad', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await dialog.getByRole('combobox', { name: 'Requisito padre' }).click();
    const parentSheet = page.getByRole('dialog', { name: 'Requisito padre' });
    // Con 15 opciones la hoja no puede cortarlas: «Cerrar» sigue a la vista y el último requisito se alcanza desplazando
    await expect(parentSheet.getByRole('button', { name: 'Cerrar', exact: true })).toBeInViewport();
    const last = parentSheet.getByTestId('requirement-new-parent-option-REQ-028');
    await last.scrollIntoViewIfNeeded();
    await expect(last).toBeInViewport();
    await parentSheet.getByTestId('requirement-new-parent-option-REQ-025').scrollIntoViewIfNeeded();
    await parentSheet.getByTestId('requirement-new-parent-option-REQ-025').click();

    await dialog.getByRole('button', { name: 'Crear requisito', exact: true }).click();
    await expect(page.getByTestId('toast-ok').filter({ hasText: 'se añadió al árbol' })).toBeVisible();
    await expect(page.getByTestId('requirements-count')).toContainText('15 de 15');
    // El código lo asigna la API (el siguiente libre del tenant): se lee de la hoja que se abre
    const code = (await sheet(page).getByTestId('requirement-code').textContent()) ?? '';
    expect(code).toMatch(/^REQ-\d{3}$/);
    await expect(sheet(page).getByTestId('requirement-title')).toHaveText('Requisito creado desde el móvil');
    await expect(sheet(page).getByTestId('requirement-priority')).toHaveText('Alta');
    await expect(sheet(page).getByTestId('requirement-tags')).toHaveText('Ciberseguridad');
    await expect(stateOf(page)).toHaveAttribute('data-state', 'draft');
    // Hijo de REQ-025: aparece bajo su padre, un nivel más sangrado (aria-level 2)
    await sheet(page).getByRole('button', { name: 'Cerrar', exact: true }).click();
    await expect(page.getByRole('listitem', { name: new RegExp(`^${code} `) })).toHaveAttribute('aria-level', '2');
  });
});

test.describe('Móvil · requisitos: edición', () => {
  test('editar título y prioridad: el aprobado vuelve a borrador con aviso; solo viaja lo que cambió', async ({ page }) => {
    await open(page, 'admin');
    await openRequirement(page, 'REQ-021'); // aprobado
    await expect(stateOf(page)).toHaveAttribute('data-state', 'approved');
    await action(page, 'Editar').click();
    await expect(sheet(page).getByRole('button', { name: 'Guardar', exact: true })).toBeDisabled();
    await expect(page.getByTestId('requirement-action-reason-save')).toHaveText('No hay cambios que guardar');

    await sheet(page).getByLabel('Título').fill('Latencia máxima del enlace táctico');
    await expect(page.getByTestId('requirement-revert-notice')).toContainText('Este requisito está en estado aprobado.');
    await sheet(page).getByLabel('Título').fill('ab');
    await sheet(page).getByRole('button', { name: 'Guardar', exact: true }).click();
    await expect(page.getByTestId('requirement-title-error')).toHaveText('El título debe tener al menos 3 caracteres');

    await sheet(page).getByLabel('Título').fill('Latencia máxima del enlace táctico');
    await sheet(page).getByRole('combobox', { name: 'Prioridad' }).click();
    await page.getByRole('dialog', { name: 'Prioridad' }).getByRole('radio', { name: 'Alta', exact: true }).click();
    await sheet(page).getByRole('button', { name: 'Guardar', exact: true }).click();
    await expect(page.getByTestId('toast-ok').filter({ hasText: 'REQ-021 volvió a Borrador' })).toBeVisible();
    await expect(stateOf(page)).toHaveAttribute('data-state', 'draft');
    await expect(sheet(page).getByTestId('requirement-title')).toHaveText('Latencia máxima del enlace táctico');
    await expect(sheet(page).getByTestId('requirement-priority')).toHaveText('Alta');
  });

  test('cambiar solo la prioridad no devuelve a borrador (no se reenvía la descripción)', async ({ page }) => {
    await open(page, 'admin');
    await openRequirement(page, 'REQ-015'); // validado
    await action(page, 'Editar').click();
    await sheet(page).getByRole('combobox', { name: 'Prioridad' }).click();
    await page.getByRole('dialog', { name: 'Prioridad' }).getByRole('radio', { name: 'Baja', exact: true }).click();
    await expect(page.getByTestId('requirement-revert-notice')).toHaveCount(0);
    await sheet(page).getByRole('button', { name: 'Guardar', exact: true }).click();
    await expect(page.getByTestId('toast-ok').filter({ hasText: 'REQ-015 actualizado' })).toBeVisible();
    await expect(stateOf(page)).toHaveAttribute('data-state', 'validated');
    await expect(sheet(page).getByTestId('requirement-priority')).toHaveText('Baja');
  });

  test('la descripción se edita como texto plano con un párrafo por línea y «Guardar y cerrar» cierra la hoja', async ({ page }) => {
    await open(page, 'admin');
    await openRequirement(page, 'REQ-017');
    await action(page, 'Editar').click();
    await sheet(page).getByLabel('Descripción').fill('Primer párrafo del requisito.\nSegundo párrafo con & y símbolos.');
    await sheet(page).getByRole('button', { name: 'Guardar y cerrar', exact: true }).click();
    await expect(sheet(page)).toBeHidden();
    await expect(page.getByTestId('toast-ok').filter({ hasText: 'REQ-017 actualizado' })).toBeVisible();

    await openRequirement(page, 'REQ-017');
    // Cada párrafo es una línea del texto (Playwright normaliza los saltos al comparar, así que se buscan los dos fragmentos)
    await expect(sheet(page).getByTestId('requirement-description')).toContainText('Primer párrafo del requisito.');
    await expect(sheet(page).getByTestId('requirement-description')).toContainText('Segundo párrafo con & y símbolos.');
  });

  test('el auditor no puede editar: el botón está deshabilitado con su motivo', async ({ page }) => {
    await open(page, 'auditor');
    await openRequirement(page, 'REQ-017');
    await expect(action(page, 'Editar')).toBeDisabled();
    await expect(page.getByTestId('requirement-action-reason-edit')).toHaveText('Tu rol no permite editar requisitos');
    await expect(action(page, 'Eliminar')).toBeDisabled();
    await expect(page.getByTestId('requirement-action-reason-delete')).toHaveText('Solo admin y gestor pueden eliminar requisitos');
  });
});

test.describe('Móvil · requisitos: borrado con confirmación', () => {
  test('el aviso cuenta los descendientes; cancelar no borra y confirmar quita el subárbol y cierra la hoja', async ({ page }) => {
    await open(page, 'admin');
    await openRequirement(page, 'REQ-025');
    await action(page, 'Eliminar').click();
    const alert = page.getByRole('dialog', { name: 'Eliminar requisito' });
    await expect(alert).toContainText('REQ-025 y sus 3 requisitos descendientes se eliminarán de forma permanente.');
    await alert.getByRole('button', { name: 'Cancelar', exact: true }).click();
    await expect(alert).toBeHidden();
    await expect(sheet(page)).toBeVisible();

    await action(page, 'Eliminar').click();
    await page.getByRole('dialog', { name: 'Eliminar requisito' }).getByRole('button', { name: 'Eliminar', exact: true }).click();
    await expect(page.getByTestId('toast-ok').filter({ hasText: 'REQ-025 eliminado' })).toBeVisible();
    await expect(sheet(page)).toBeHidden();
    await expect(page.getByTestId('requirement-row-REQ-025')).toHaveCount(0);
    await expect(page.getByTestId('requirement-row-REQ-026')).toHaveCount(0);
    await expect(page.getByTestId('requirements-count')).toContainText('10 de 10');
  });

  test('un requisito con un solo descendiente lo cuenta en el aviso (singular del contador, como la web)', async ({ page }) => {
    await open(page, 'admin');
    await openRequirement(page, 'REQ-017'); // en el seed tiene un descendiente
    await action(page, 'Eliminar').click();
    await expect(page.getByRole('dialog', { name: 'Eliminar requisito' })).toContainText('REQ-017 y sus 1 requisitos descendientes se eliminarán de forma permanente.');
    await page.getByRole('dialog', { name: 'Eliminar requisito' }).getByRole('button', { name: 'Cancelar', exact: true }).click();
  });
});

test.describe('Móvil · requisitos: «Mover a…»', () => {
  test('reordena entre hermanos (antes del elegido) sin cambiar de padre y avisa con un toast', async ({ page }) => {
    await open(page, 'admin');
    // Raíces del programa: REQ-015, REQ-020 y REQ-025 (en ese orden)
    const roots = async () => (await rowOrder(page)).filter((code) => ['REQ-015', 'REQ-020', 'REQ-025'].includes(code));
    await expect.poll(roots).toEqual(['REQ-015', 'REQ-020', 'REQ-025']);

    await openRequirement(page, 'REQ-025');
    await action(page, 'Mover a…').click();
    await sheet(page).getByRole('combobox', { name: 'Junto a' }).click();
    await page.getByRole('dialog', { name: 'Junto a' }).getByTestId('requirement-move-target-option-REQ-015').click();
    await sheet(page).getByRole('combobox', { name: 'Colocar' }).click();
    await page.getByRole('dialog', { name: 'Colocar' }).getByRole('radio', { name: 'Antes', exact: true }).click();
    await sheet(page).getByRole('button', { name: 'Mover', exact: true }).click();

    await expect(page.getByTestId('toast-ok').filter({ hasText: 'REQ-025 se movió' })).toBeVisible();
    await expect.poll(roots).toEqual(['REQ-025', 'REQ-015', 'REQ-020']);
    await expect(sheet(page).getByTestId('requirement-code')).toHaveText('REQ-025'); // la hoja sigue abierta
  });

  test('el auditor no puede mover: «Mover a…» deshabilitado con su motivo', async ({ page }) => {
    await open(page, 'auditor');
    await openRequirement(page, 'REQ-017');
    await expect(action(page, 'Mover a…')).toBeDisabled();
    await expect(page.getByTestId('requirement-action-reason-move')).toHaveText('Tu rol no permite editar requisitos');
  });
});

test.describe('Móvil · requisitos: matriz de trazabilidad', () => {
  test('enlaza y desenlaza casos de prueba con toast y la cobertura se actualiza; reaparece tras recargar', async ({ page }) => {
    await open(page, 'admin');
    await page.getByRole('radio', { name: 'Matriz de trazabilidad' }).click();
    await expect(page.getByRole('radio', { name: 'Matriz de trazabilidad' })).toHaveAttribute('aria-checked', 'true');
    await expect(page.getByTestId('requirements-panel-matrix')).toBeVisible();
    await expect(page.getByTestId('matrix-legend')).toHaveText('13 de 14 requisitos con cobertura');
    expect(await noHorizontalOverflow(page)).toBe(true); // la matriz se desplaza dentro de su propio contenedor

    const cell = page.getByRole('checkbox', { name: /^REQ-017 ↔ TC-012/ });
    await expect(cell).toBeChecked();
    await expect(page.getByRole('checkbox', { name: /^REQ-017 ↔ TC-010/ })).not.toBeChecked();
    await expect(page.getByTestId('matrix-row-REQ-028')).toHaveAttribute('data-covered', 'false');
    await expect(page.getByTestId('matrix-row-REQ-028').getByText('Sin cobertura')).toBeVisible();

    await cell.click();
    await expect(page.getByTestId('toast-ok').filter({ hasText: 'Enlace eliminado' })).toBeVisible();
    await expect(page.getByTestId('matrix-legend')).toHaveText('12 de 14 requisitos con cobertura');
    await expect(cell).not.toBeChecked();
    await cell.click();
    await expect(page.getByTestId('matrix-legend')).toHaveText('13 de 14 requisitos con cobertura');

    // Cubrir el hueco de REQ-028 con TC-010 y deshacerlo
    await page.getByRole('checkbox', { name: /^REQ-028 ↔ TC-010/ }).click();
    await expect(page.getByTestId('matrix-legend')).toHaveText('14 de 14 requisitos con cobertura');
    await page.getByRole('checkbox', { name: /^REQ-028 ↔ TC-010/ }).click();
    await expect(page.getByTestId('matrix-legend')).toHaveText('13 de 14 requisitos con cobertura');

    await page.reload();
    await page.getByRole('radio', { name: 'Matriz de trazabilidad' }).click();
    await expect(page.getByRole('checkbox', { name: /^REQ-017 ↔ TC-012/ })).toBeChecked();
    await expect(page.getByTestId('matrix-legend')).toHaveText('13 de 14 requisitos con cobertura');
  });

  test('el auditor ve la matriz con las casillas deshabilitadas y su motivo', async ({ page }) => {
    await open(page, 'auditor');
    await page.getByRole('radio', { name: 'Matriz de trazabilidad' }).click();
    const cell = page.getByRole('checkbox', { name: /^REQ-017 ↔ TC-012/ });
    await expect(cell).toBeDisabled();
    await expect(cell).toBeChecked();
    await expect(page.getByTestId('requirements-matrix-reason')).toHaveText('Tu rol no permite editar requisitos');
  });
});

test.describe('Móvil · requisitos: traza en la hoja', () => {
  test('la hoja muestra los casos enlazados con su último resultado y las NC abiertas', async ({ page }) => {
    await open(page, 'admin');
    await openRequirement(page, 'REQ-015');
    const trace = sheet(page).getByTestId('requirement-trace');
    await expect(trace).toBeVisible();
    await expect(sheet(page).getByTestId(/^requirement-trace-test-TC-\d+$/)).toHaveCount(1);
    await expect(sheet(page).getByTestId(/^requirement-trace-test-TC-\d+$/)).toHaveAttribute('data-state', 'pass');
    await expect(sheet(page).getByTestId('requirement-trace-nc-NC-006')).toHaveText('NC-006');
    await expect(sheet(page).getByTestId('requirement-trace-nc-badge-NC-006')).toBeVisible();
    await expect(sheet(page).getByTestId('requirement-tests')).toBeVisible();
  });
});
