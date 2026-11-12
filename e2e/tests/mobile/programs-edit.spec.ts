import { expect, test, type APIRequestContext, type Page } from '@playwright/test';
import { chaosOff } from '../../support/admin';
import { API_URL, openAs, resetTenant, type RoleName } from '../../support/auth';
import { authHeaders } from '../../support/admin';

// Programas en el móvil (paridad funcional con la web): asistente de alta en tres pasos, menú ⋯ de cada fila (abrir, editar,
// duplicar, archivar, eliminar), selección múltiple con acciones en lote, exportación CSV con la hoja de compartir, edición
// con 422, y la pestaña «Hitos» y «Proveedores» del detalle. Cada prueba parte de los datos del seed (`resetTenant` antes de
// cada una). Tenant propio (alumno24: 24 programas, PRG-025 es el siguiente código). Locators por rol y nombre primero; el
// `testID` (que React Native Web pinta como `data-testid`) como respaldo para los ids de la web.

const TENANT = 'alumno24';
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

const open = (page: Page, role: RoleName = 'admin', path = '/programs') => openAs(page, role, path, { tenant: TENANT });
const rowCodes = (page: Page) => page.getByTestId(/^programs-row-PRG-\d+$/);
/** Hoja del menú ⋯ de un programa (su nombre accesible es «Acciones para PRG-…»). */
const rowMenu = (page: Page, code: string) => page.getByRole('dialog', { name: `Acciones para ${code}`, exact: true });
const openRowMenu = async (page: Page, code: string) => {
  await page.getByRole('button', { name: `Acciones para ${code}`, exact: true }).click();
  await expect(rowMenu(page, code)).toBeVisible();
};
const noHorizontalOverflow = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);

/** Intercepta `navigator.share` (la hoja de compartir del sistema): guarda lo que se comparte en `window.__shared`. */
const stubShare = (page: Page) =>
  page.addInitScript(() => {
    Object.defineProperty(window.navigator, 'share', {
      configurable: true,
      value: (data: unknown) => {
        (window as unknown as { __shared?: unknown }).__shared = data;
        return Promise.resolve();
      },
    });
  });
const sharedPayload = (page: Page) => page.evaluate(() => (window as unknown as { __shared?: { title?: string; text?: string } }).__shared ?? null);

interface MilestoneDto {
  readonly id: string;
  readonly name: string;
  readonly dueDate: string;
  readonly progress: number;
  readonly done: boolean;
}

/** Hitos de un programa tal como los devuelve la API (fuente de verdad para elegir datos del seed). */
const milestonesByApi = async (request: APIRequestContext, code: string): Promise<MilestoneDto[]> => {
  const response = await request.get(`${API_URL}/programs/${code}/milestones`, { headers: await authHeaders(request, 'admin', TENANT) });
  expect(response.status()).toBe(200);
  return (await response.json()) as MilestoneDto[];
};

test.describe('Móvil · programas: alta en el asistente', () => {
  test('el asistente valida cada paso, elige el responsable en una hoja y crea el programa, que sale el primero', async ({ page }) => {
    await open(page, 'admin');
    await expect(page.getByTestId('programs-count')).toHaveText('1–10 de 24');
    await page.getByRole('button', { name: 'Nuevo programa', exact: true }).click();

    const wizard = page.getByRole('dialog', { name: 'Nuevo programa', exact: true });
    await expect(wizard).toBeVisible();
    await expect(wizard.getByTestId('programs-wizard-step-text')).toHaveText('Paso 1 de 3');
    await expect(wizard.getByLabel('Código', { exact: true })).toHaveValue('PRG-025');
    // El primer paso no tiene «Atrás» (deshabilitado con su motivo visible)
    await expect(wizard.getByRole('button', { name: 'Atrás', exact: true })).toBeDisabled();
    await expect(page.getByTestId('programs-action-reason-back')).toHaveText('Estás en el primer paso');

    // Paso 1: validación de cliente (nombre corto y responsable obligatorio)
    await wizard.getByLabel('Nombre', { exact: true }).fill('ab');
    await wizard.getByRole('button', { name: 'Siguiente', exact: true }).click();
    await expect(page.getByTestId('programs-wizard-name-error')).toHaveText('El nombre debe tener al menos 3 caracteres');
    await expect(page.getByTestId('programs-wizard-owner-error')).toHaveText('Selecciona un responsable de la lista');

    await wizard.getByLabel('Nombre', { exact: true }).fill('Programa de pruebas móvil');
    await wizard.getByLabel('Descripción', { exact: true }).fill('Creado desde el móvil.');
    // El responsable sale de `api.users.owners` en una hoja con buscador
    await wizard.getByRole('combobox', { name: 'Responsable', exact: true }).click();
    const owners = page.getByRole('dialog', { name: 'Responsable', exact: true });
    await owners.getByLabel('Buscar responsable', { exact: true }).fill('jav');
    await owners.getByRole('radio', { name: 'Javier Ortega', exact: true }).click();
    await expect(owners).toBeHidden();
    await expect(wizard.getByRole('combobox', { name: 'Responsable', exact: true })).toContainText('Javier Ortega');

    await wizard.getByRole('combobox', { name: 'Estado inicial', exact: true }).click();
    await page.getByRole('dialog', { name: 'Estado inicial', exact: true }).getByRole('radio', { name: 'Activo', exact: true }).click();
    await wizard.getByRole('button', { name: 'Siguiente', exact: true }).click();

    // Paso 2: fechas coherentes y presupuesto > 0
    await expect(wizard.getByTestId('programs-wizard-step-text')).toHaveText('Paso 2 de 3');
    await wizard.getByRole('button', { name: 'Siguiente', exact: true }).click();
    await expect(page.getByTestId('programs-wizard-start-error')).toHaveText('La fecha de inicio es obligatoria');
    await expect(page.getByTestId('programs-wizard-budget-error')).toHaveText('El presupuesto debe ser mayor que 0');

    await wizard.getByLabel('Fecha de inicio', { exact: true }).fill('2026-03-01');
    await wizard.getByLabel('Fecha de fin', { exact: true }).fill('2026-03-01');
    await wizard.getByLabel('Presupuesto (€)', { exact: true }).fill('0');
    await wizard.getByRole('button', { name: 'Siguiente', exact: true }).click();
    await expect(page.getByTestId('programs-wizard-end-error')).toHaveText('La fecha de fin debe ser posterior al inicio');
    await expect(page.getByTestId('programs-wizard-budget-error')).toHaveText('El presupuesto debe ser mayor que 0');

    await wizard.getByLabel('Fecha de fin', { exact: true }).fill('2027-09-30');
    await wizard.getByLabel('Presupuesto (€)', { exact: true }).fill('1500000');
    await wizard.getByRole('radio', { name: 'Alta', exact: true }).click();
    // Interruptor de RN Web: el testID es el nodo con role=switch y aria-checked (el input interno repite el nombre)
    await wizard.getByTestId('programs-wizard-classified').click();
    await expect(wizard.getByTestId('programs-wizard-classified')).toHaveAttribute('aria-checked', 'true');
    await wizard.getByRole('button', { name: 'Siguiente', exact: true }).click();

    // Paso 3: revisión con el resumen y el aviso por correo
    await expect(wizard.getByTestId('programs-wizard-step-text')).toHaveText('Paso 3 de 3');
    const summary = wizard.getByTestId('programs-wizard-summary');
    await expect(summary).toContainText('PRG-025');
    await expect(summary).toContainText('Programa de pruebas móvil');
    await expect(summary).toContainText('Javier Ortega');
    await expect(summary).toContainText('01/03/2026 → 30/09/2027');
    await expect(summary).toContainText('1.500.000');
    const notify = wizard.getByTestId('programs-wizard-notify');
    await expect(notify).toHaveAttribute('aria-checked', 'true');
    await notify.click();
    await expect(notify).toHaveAttribute('aria-checked', 'false');

    await wizard.getByRole('button', { name: 'Crear programa', exact: true }).click();
    await expect(page.getByTestId('toast-ok').filter({ hasText: 'Programa creado' })).toContainText('PRG-025 se añadió a la lista');
    await expect(wizard).toBeHidden();
    // La lista pasa a orden descendente y muestra el programa nuevo primero; las métricas se actualizan
    await expect(rowCodes(page).first()).toHaveAttribute('data-testid', 'programs-row-PRG-025');
    await expect(page.getByTestId('programs-count')).toHaveText('1–10 de 25');
    await expect(page.getByTestId('programs-metric-total')).toContainText('25');
    await expect(page.getByTestId('programs-row-PRG-025').getByTestId('programs-state-badge')).toHaveAttribute('data-state', 'active');
    expect(await noHorizontalOverflow(page)).toBe(true);
  });

  test('422: un nombre que contiene «duplicado» vuelve al paso 1 con el aviso del servidor', async ({ page }) => {
    await open(page, 'admin');
    await page.getByRole('button', { name: 'Nuevo programa', exact: true }).click();
    const wizard = page.getByRole('dialog', { name: 'Nuevo programa', exact: true });
    await wizard.getByLabel('Nombre', { exact: true }).fill('Programa duplicado de prueba');
    await wizard.getByRole('combobox', { name: 'Responsable', exact: true }).click();
    await page.getByTestId('programs-wizard-owner-option-u1').click();
    await wizard.getByRole('button', { name: 'Siguiente', exact: true }).click();
    await wizard.getByLabel('Fecha de inicio', { exact: true }).fill('2026-01-10');
    await wizard.getByLabel('Fecha de fin', { exact: true }).fill('2026-12-31');
    await wizard.getByLabel('Presupuesto (€)', { exact: true }).fill('250000');
    await wizard.getByRole('button', { name: 'Siguiente', exact: true }).click();
    await wizard.getByRole('button', { name: 'Crear programa', exact: true }).click();

    await expect(page.getByTestId('programs-wizard-server-error')).toHaveText('422 · Ya existe un programa con ese nombre');
    await expect(page.getByTestId('programs-wizard-name-error')).toHaveText('Ya existe un programa con ese nombre');
    await expect(page.getByTestId('programs-wizard-step-text')).toHaveText('Paso 1 de 3');

    // Cancelar cierra el asistente sin crear nada
    await wizard.getByRole('button', { name: 'Cancelar', exact: true }).click();
    await expect(wizard).toBeHidden();
    await expect(page.getByTestId('programs-count')).toHaveText('1–10 de 24');
  });
});

test.describe('Móvil · programas: menú ⋯ de cada fila', () => {
  test('duplicar: la copia sale la primera como borrador y las métricas se actualizan', async ({ page }) => {
    await open(page, 'admin');
    await openRowMenu(page, 'PRG-001');
    await rowMenu(page, 'PRG-001').getByRole('button', { name: 'Duplicar', exact: true }).click();
    await expect(page.getByTestId('toast-ok').filter({ hasText: 'PRG-025 programa creado' })).toContainText('Copia creada como borrador');
    await expect(rowCodes(page).first()).toHaveAttribute('data-testid', 'programs-row-PRG-025');
    const copy = page.getByTestId('programs-row-PRG-025');
    await expect(copy).toContainText('(copia)');
    await expect(copy.getByTestId('programs-state-badge')).toHaveAttribute('data-state', 'draft');
    await expect(page.getByTestId('programs-metric-total')).toContainText('25');
  });

  test('archivar: el programa pasa a Cerrado sin pedir confirmación (como la web)', async ({ page }) => {
    await open(page, 'admin');
    await openRowMenu(page, 'PRG-002');
    await rowMenu(page, 'PRG-002').getByRole('button', { name: 'Archivar', exact: true }).click();
    await expect(page.getByTestId('toast-ok').filter({ hasText: 'PRG-002 archivado' })).toBeVisible();
    await expect(page.getByTestId('programs-row-PRG-002').getByTestId('programs-state-badge')).toHaveAttribute('data-state', 'closed');
  });

  test('eliminar: el diálogo de confirmación; cancelar no borra y confirmar quita el programa', async ({ page }) => {
    await open(page, 'admin');
    await openRowMenu(page, 'PRG-010');
    await rowMenu(page, 'PRG-010').getByRole('button', { name: 'Eliminar', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Eliminar programa', exact: true });
    await expect(dialog).toContainText('PRG-010 se eliminará de forma permanente junto con sus requisitos y documentos.');
    await dialog.getByRole('button', { name: 'Cancelar', exact: true }).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByTestId('programs-row-PRG-010')).toBeVisible();

    await openRowMenu(page, 'PRG-010');
    await rowMenu(page, 'PRG-010').getByRole('button', { name: 'Eliminar', exact: true }).click();
    await page.getByRole('dialog', { name: 'Eliminar programa', exact: true }).getByRole('button', { name: 'Eliminar', exact: true }).click();
    await expect(page.getByTestId('toast-ok').filter({ hasText: 'PRG-010 eliminado' })).toBeVisible();
    await expect(page.getByTestId('programs-row-PRG-010')).toHaveCount(0);
    await expect(page.getByTestId('programs-count')).toHaveText('1–10 de 23');
  });

  test('el consultor ve Editar, Duplicar y Archivar deshabilitados, cada uno con su motivo visible', async ({ page }) => {
    await open(page, 'consultant');
    await openRowMenu(page, 'PRG-004');
    const menu = rowMenu(page, 'PRG-004');
    await expect(menu.getByRole('button', { name: 'Editar', exact: true })).toBeDisabled();
    await expect(page.getByTestId('programs-action-reason-edit')).toHaveText('Tu rol no permite modificar programas');
    await expect(menu.getByRole('button', { name: 'Duplicar', exact: true })).toBeDisabled();
    await expect(page.getByTestId('programs-action-reason-duplicate')).toHaveText('Tu rol no permite crear programas');
    await expect(menu.getByRole('button', { name: 'Archivar', exact: true })).toBeDisabled();
    await expect(page.getByTestId('programs-action-reason-archive')).toHaveText('Tu rol no permite archivar programas');
    await expect(menu.getByRole('button', { name: 'Eliminar', exact: true })).toBeDisabled();
    // Ver el detalle sí está permitido
    await expect(menu.getByRole('button', { name: 'Ver detalle', exact: true })).toBeEnabled();
    await expect(page.getByTestId('programs-new-reason')).toHaveText('Tu rol no permite crear programas');
    await expect(page.getByRole('button', { name: 'Nuevo programa', exact: true })).toBeDisabled();
  });

  test('el gestor puede duplicar y archivar, pero Eliminar queda deshabilitado con su motivo', async ({ page }) => {
    await open(page, 'program_manager');
    await openRowMenu(page, 'PRG-002');
    await expect(rowMenu(page, 'PRG-002').getByRole('button', { name: 'Archivar', exact: true })).toBeEnabled();
    await expect(rowMenu(page, 'PRG-002').getByRole('button', { name: 'Eliminar', exact: true })).toBeDisabled();
    await expect(page.getByTestId('programs-action-reason-delete')).toHaveText('Solo admin puede eliminar');
  });
});

test.describe('Móvil · programas: selección múltiple y CSV', () => {
  test('selección, archivado en lote y eliminación de la selección con confirmación', async ({ page }) => {
    await open(page, 'admin');
    await page.getByRole('button', { name: 'Seleccionar', exact: true }).click();
    await page.getByRole('checkbox', { name: 'Seleccionar PRG-001', exact: true }).click();
    await page.getByRole('checkbox', { name: 'Seleccionar PRG-002', exact: true }).click();
    await expect(page.getByTestId('programs-bulk-count')).toHaveText('2 seleccionados');

    await page.getByTestId('programs-bulk-archive').click();
    await expect(page.getByTestId('toast-ok').filter({ hasText: '2 programas archivados' })).toBeVisible();
    await expect(page.getByTestId('programs-bulk-bar')).toHaveCount(0);

    await page.getByRole('checkbox', { name: 'Seleccionar PRG-003', exact: true }).click();
    await page.getByTestId('programs-bulk-delete').click();
    const dialog = page.getByRole('dialog', { name: 'Eliminar programa', exact: true });
    await expect(dialog).toContainText('PRG-003 se eliminará de forma permanente');
    await dialog.getByRole('button', { name: 'Eliminar', exact: true }).click();
    await expect(page.getByTestId('toast-ok').filter({ hasText: 'PRG-003 eliminado' })).toBeVisible();
    await expect(page.getByTestId('programs-row-PRG-003')).toHaveCount(0);
  });

  test('el gestor archiva en lote, pero «Eliminar» de la barra queda deshabilitado con su motivo', async ({ page }) => {
    await open(page, 'program_manager');
    await page.getByRole('button', { name: 'Seleccionar', exact: true }).click();
    await page.getByRole('checkbox', { name: 'Seleccionar PRG-002', exact: true }).click();
    await expect(page.getByTestId('programs-bulk-archive')).toBeEnabled();
    await expect(page.getByTestId('programs-bulk-delete')).toBeDisabled();
    await expect(page.getByTestId('programs-action-reason-bulk-delete')).toHaveText('Solo admin puede eliminar');
  });

  test('exporta el CSV de la lista filtrada y el de la selección con la hoja de compartir', async ({ page }) => {
    await stubShare(page);
    await open(page, 'admin', '/programs?status=on_hold');
    await expect(page.getByTestId('programs-count')).toHaveText('1–3 de 3');
    await page.getByRole('button', { name: 'Exportar CSV', exact: true }).click();
    await expect(page.getByTestId('toast-info').filter({ hasText: 'CSV generado' })).toContainText('3 filas exportadas');
    const filtered = await sharedPayload(page);
    expect(filtered?.title).toBe('sigpro-programas.csv');
    expect(filtered?.text?.split('\n')[0]).toBe('code;name;status;owner;start;end;budget;progress');
    expect(filtered?.text?.split('\n')).toHaveLength(4); // cabecera + 3 programas en pausa
    expect(filtered?.text).toContain('on_hold');

    await page.getByRole('button', { name: 'Seleccionar', exact: true }).click();
    await page.getByRole('checkbox', { name: 'Seleccionar PRG-004', exact: true }).click();
    await page.getByTestId('programs-bulk-export').click();
    const picked = await sharedPayload(page);
    expect(picked?.text?.split('\n')).toHaveLength(2);
    expect(picked?.text).toContain('PRG-004');
  });
});

test.describe('Móvil · programas: edición', () => {
  test('el menú abre la edición con los datos actuales; sin cambios, Guardar está deshabilitado con su motivo', async ({ page }) => {
    await open(page, 'admin');
    await openRowMenu(page, 'PRG-003');
    await rowMenu(page, 'PRG-003').getByRole('button', { name: 'Editar', exact: true }).click();

    await expect(page).toHaveURL(/\/programs\/PRG-003\/edit$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Editar programa', exact: true })).toBeVisible();
    await expect(page.getByLabel('Código', { exact: true })).toHaveValue('PRG-003');
    await expect(page.getByLabel('Nombre', { exact: true })).toHaveValue('Enlace de datos seguro LD-9');
    await expect(page.getByRole('combobox', { name: 'Responsable', exact: true })).toContainText('Lucía Fernández');

    const save = page.getByRole('button', { name: 'Guardar', exact: true });
    await expect(save).toBeDisabled();
    await expect(page.getByTestId('programs-action-reason-save')).toHaveText('No hay cambios que guardar');
    await expect(page.getByRole('button', { name: 'Guardar y cerrar', exact: true })).toBeDisabled();
  });

  test('validación de cliente y de servidor: nombre corto, fechas incoherentes, presupuesto y nombre repetido (422)', async ({ page }) => {
    await open(page, 'admin', '/programs/PRG-003/edit');
    const name = page.getByLabel('Nombre', { exact: true });
    const save = page.getByRole('button', { name: 'Guardar', exact: true });

    await name.fill('ab');
    await save.click();
    await expect(page.getByTestId('program-edit-name-error')).toHaveText('El nombre debe tener al menos 3 caracteres');
    await expect(name).toHaveAttribute('aria-invalid', 'true');

    await name.fill('Enlace de datos seguro LD-9');
    await page.getByLabel('Fecha de fin', { exact: true }).fill('2020-01-01');
    await name.fill('Enlace de datos revisado');
    await save.click();
    await expect(page.getByTestId('program-edit-end-error')).toHaveText('La fecha de fin debe ser posterior al inicio');

    await page.getByLabel('Fecha de fin', { exact: true }).fill('2027-12-31');
    await page.getByLabel('Presupuesto (€)', { exact: true }).fill('0');
    await save.click();
    await expect(page.getByTestId('program-edit-budget-error')).toHaveText('El presupuesto debe ser mayor que 0');

    await page.getByLabel('Presupuesto (€)', { exact: true }).fill('2500000');
    await name.fill('Sistema de mando táctico Ártemis'); // nombre de PRG-001
    await save.click();
    await expect(page.getByTestId('program-edit-server-error')).toHaveText('422 · Ya existe un programa con ese nombre');
    await expect(page.getByTestId('program-edit-name-error')).toHaveText('Ya existe un programa con ese nombre');
  });

  test('guardar muestra el aviso; «Guardar y cerrar» vuelve al detalle con los cambios', async ({ page }) => {
    await open(page, 'admin', '/programs/PRG-003/edit');
    const save = page.getByRole('button', { name: 'Guardar', exact: true });

    await page.getByLabel('Descripción', { exact: true }).fill('Descripción revisada desde el móvil.');
    await page.getByRole('combobox', { name: 'Estado', exact: true }).click();
    await page.getByRole('dialog', { name: 'Estado', exact: true }).getByRole('radio', { name: 'En pausa', exact: true }).click();
    await page.getByRole('radio', { name: 'Alta', exact: true }).click();
    await expect(save).toBeEnabled();
    await save.click();

    await expect(page.getByTestId('toast-ok').filter({ hasText: 'Programa actualizado' })).toContainText('PRG-003 se guardó correctamente');
    await expect(save).toBeDisabled(); // vuelve a no haber cambios pendientes

    await page.getByLabel('Nombre', { exact: true }).fill('Enlace de datos seguro LD-9 (rev. B)');
    await page.getByRole('button', { name: 'Guardar y cerrar', exact: true }).click();
    await expect(page).toHaveURL(/\/programs\/PRG-003$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Enlace de datos seguro LD-9 (rev. B)', exact: true })).toBeVisible();
    await expect(page.getByTestId('program-detail-state-badge')).toHaveAttribute('data-state', 'on_hold');
    await expect(page.getByTestId('program-detail-description')).toHaveText('Descripción revisada desde el móvil.');
  });

  test('el cambio de responsable usa la hoja con buscador y se refleja en el detalle', async ({ page }) => {
    await open(page, 'admin', '/programs/PRG-003/edit');
    await page.getByRole('combobox', { name: 'Responsable', exact: true }).click();
    const owners = page.getByRole('dialog', { name: 'Responsable', exact: true });
    await owners.getByLabel('Buscar responsable', { exact: true }).fill('andr');
    await owners.getByRole('radio', { name: 'Andrés Molina', exact: true }).click();
    await expect(page.getByRole('combobox', { name: 'Responsable', exact: true })).toContainText('Andrés Molina');
    await page.getByRole('button', { name: 'Guardar y cerrar', exact: true }).click();
    await expect(page).toHaveURL(/\/programs\/PRG-003$/);
    await expect(page.getByTestId('program-detail-owner')).toHaveText('Andrés Molina');
  });

  test('un consultor ve Editar deshabilitado con su motivo en el detalle y el aviso de permisos en la ruta de edición', async ({ page }) => {
    await open(page, 'consultant', '/programs/PRG-004');
    await expect(page.getByTestId('program-detail-edit')).toBeDisabled();
    await expect(page.getByTestId('programs-action-reason-edit')).toHaveText('Tu rol no permite modificar programas');

    await page.goto('/programs/PRG-004/edit');
    await expect(page.getByRole('alert').filter({ hasText: 'Tu rol no permite modificar programas' })).toBeVisible();
    await expect(page.getByLabel('Nombre', { exact: true })).toHaveCount(0);
  });
});

test.describe('Móvil · programas: pestaña Hitos del detalle', () => {
  test('lista los hitos del programa; el gestor crea uno con validación y el aviso del alta', async ({ page }) => {
    await open(page, 'program_manager', '/programs/PRG-002');
    await page.getByRole('radio', { name: 'Hitos', exact: true }).click();
    await expect(page.getByTestId(/^milestone-row-PRG-002-M\d+$/)).toHaveCount(6);
    await expect(page.getByTestId('milestones-count')).toContainText('de 6 hitos cumplidos');

    await page.getByRole('button', { name: 'Nuevo hito', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Nuevo hito', exact: true });
    await dialog.getByRole('button', { name: 'Crear hito', exact: true }).click();
    await expect(page.getByTestId('milestone-new-name-error')).toHaveText('El nombre debe tener al menos 2 caracteres');
    await expect(page.getByTestId('milestone-new-date-error')).toHaveText('Indica una fecha válida');

    await dialog.getByLabel('Nombre', { exact: true }).fill('Revisión de diseño de prueba');
    await dialog.getByLabel('Fecha límite', { exact: true }).fill('2026-09-15');
    await dialog.getByRole('button', { name: 'Crear hito', exact: true }).click();
    await expect(page.getByTestId('toast-ok').filter({ hasText: 'Hito creado' })).toContainText('Revisión de diseño de prueba · PRG-002-M07');
    await expect(page.getByTestId(/^milestone-row-PRG-002-M\d+$/)).toHaveCount(7);
  });

  test('renombrar un hito en la hoja y mover su avance de 5 en 5; al 100 % queda cumplido', async ({ page, request }) => {
    const milestones = await milestonesByApi(request, 'PRG-002');
    const target = milestones.find((item) => !item.done && item.progress === 0) ?? milestones[0];
    expect(target).toBeDefined();
    if (!target) return;

    await open(page, 'admin', '/programs/PRG-002');
    await page.getByRole('radio', { name: 'Hitos', exact: true }).click();
    const row = page.getByTestId(`milestone-row-${target.id}`);
    const slider = page.getByTestId(`milestone-progress-${target.id}`);
    await expect(slider).toHaveAttribute('aria-valuenow', String(target.progress));

    await page.getByRole('button', { name: `Acciones para el hito ${target.name}`, exact: true }).click();
    await page.getByTestId('milestone-menu-rename').click();
    const edit = page.getByRole('dialog', { name: 'Editar hito', exact: true });
    await edit.getByLabel('Nombre del hito', { exact: true }).fill('Nombre renombrado en móvil');
    await edit.getByRole('button', { name: 'Guardar hito', exact: true }).click();
    await expect(page.getByTestId('toast-ok').filter({ hasText: 'Hito actualizado' })).toContainText('Nombre renombrado en móvil');
    await expect(row.getByTestId(`milestone-name-${target.id}`)).toHaveText('Nombre renombrado en móvil');

    // Un paso del slider: el avance sube 5 y el estado pasa a «En curso»
    await page.getByRole('button', { name: `Avance de Nombre renombrado en móvil +5`, exact: true }).click();
    await expect(slider).toHaveAttribute('aria-valuenow', '5');
    await expect(row.getByTestId(`milestone-status-${target.id}`)).toHaveText('En curso');

    // Hasta el 100 %: el hito queda cumplido y el contador del panel se actualiza
    for (let value = 10; value <= 100; value += 5) {
      await page.getByRole('button', { name: 'Avance de Nombre renombrado en móvil +5', exact: true }).click();
      await expect(slider).toHaveAttribute('aria-valuenow', String(value));
    }
    await expect(row.getByTestId(`milestone-status-${target.id}`)).toHaveText('Cumplido');
    await expect(row).toHaveAttribute('data-state', 'done');
  });

  test('eliminar un hito: la confirmación cancela o borra; el panel se actualiza', async ({ page, request }) => {
    const milestones = await milestonesByApi(request, 'PRG-002');
    const target = milestones[0];
    expect(target).toBeDefined();
    if (!target) return;

    await open(page, 'program_manager', '/programs/PRG-002');
    await page.getByRole('radio', { name: 'Hitos', exact: true }).click();
    await page.getByRole('button', { name: `Acciones para el hito ${target.name}`, exact: true }).click();
    await page.getByTestId('milestone-menu-delete').click();
    const dialog = page.getByRole('dialog', { name: 'Eliminar hito', exact: true });
    await expect(dialog).toContainText(`¿Eliminar el hito «${target.name}»? El avance del programa se recalculará.`);
    await dialog.getByRole('button', { name: 'Cancelar', exact: true }).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByTestId(`milestone-row-${target.id}`)).toBeVisible();

    await page.getByRole('button', { name: `Acciones para el hito ${target.name}`, exact: true }).click();
    await page.getByTestId('milestone-menu-delete').click();
    await page.getByRole('dialog', { name: 'Eliminar hito', exact: true }).getByRole('button', { name: 'Eliminar', exact: true }).click();
    await expect(page.getByTestId('toast-ok').filter({ hasText: 'Hito eliminado' })).toBeVisible();
    await expect(page.getByTestId(`milestone-row-${target.id}`)).toHaveCount(0);
    await expect(page.getByTestId(/^milestone-row-PRG-002-M\d+$/)).toHaveCount(5);
  });

  test('el consultor ve los hitos con sus controles deshabilitados y el motivo de cada acción', async ({ page }) => {
    await open(page, 'consultant', '/programs/PRG-002');
    await page.getByRole('radio', { name: 'Hitos', exact: true }).click();
    await expect(page.getByTestId(/^milestone-row-PRG-002-M\d+$/)).toHaveCount(6);
    await expect(page.getByRole('button', { name: 'Nuevo hito', exact: true })).toBeDisabled();
    await expect(page.getByTestId('milestones-new-reason')).toHaveText('Tu rol no permite crear hitos');

    const sliderButton = page.getByRole('button', { name: /^Avance de .+ \+5$/ }).first();
    await expect(sliderButton).toBeDisabled();

    await page.getByRole('button', { name: /^Acciones para el hito / }).first().click();
    await expect(page.getByTestId('milestone-menu-rename')).toBeDisabled();
    await expect(page.getByTestId('milestone-menu-delete')).toBeDisabled();
    await expect(page.getByTestId('programs-action-reason-milestone-delete')).toHaveText('Tu rol no permite eliminar hitos');
  });
});

test.describe('Móvil · programas: pestaña Proveedores del detalle', () => {
  test('PRG-001 lista a Aeronáutica Levante con su NIF, importe y «Aprobado»; el buscador muestra la ficha con sus contratos', async ({ page }) => {
    await open(page, 'admin', '/programs/PRG-001');
    await page.getByRole('radio', { name: 'Proveedores', exact: true }).click();
    await expect(page.getByTestId('suppliers-count')).toHaveText('1 proveedor contratado');
    const row = page.getByTestId('supplier-row-s1');
    await expect(row).toContainText('Aeronáutica Levante S.L.');
    await expect(row).toContainText('B11111111');
    await expect(row).toContainText('150.000');
    await expect(page.getByTestId('supplier-badge-s1')).toHaveText('Aprobado');
    await expect(page.getByTestId('supplier-badge-s1')).toHaveAttribute('data-state', 'approved');

    await page.getByLabel('Proveedor del tenant', { exact: true }).fill('aero');
    await page.getByTestId('supplier-option-s1').click();
    await expect(page.getByTestId('supplier-detail')).toBeVisible();
    await expect(page.getByTestId('supplier-detail-nif')).toHaveText('B11111111');
    await expect(page.getByTestId('supplier-detail-badge')).toHaveText('Aprobado');
    await expect(page.getByTestId('supplier-contract-PRG-001')).toContainText('Sistema de mando táctico Ártemis');

    await page.getByRole('button', { name: 'Quitar proveedor seleccionado', exact: true }).click();
    await expect(page.getByTestId('supplier-detail')).toHaveCount(0);
  });

  test('un proveedor no aprobado lleva «No aprobado» y un programa sin contratos muestra el estado vacío', async ({ page }) => {
    await open(page, 'admin', '/programs/PRG-009');
    await page.getByRole('radio', { name: 'Proveedores', exact: true }).click();
    await expect(page.getByTestId('supplier-row-s5')).toContainText('Cibertáctica Norte');
    await expect(page.getByTestId('supplier-badge-s5')).toHaveText('No aprobado');
    await expect(page.getByTestId('supplier-badge-s5')).toHaveAttribute('data-state', 'not_approved');

    await page.goto('/programs/PRG-013');
    await page.getByRole('radio', { name: 'Proveedores', exact: true }).click();
    await expect(page.getByTestId('suppliers-empty')).toHaveText('Este programa no tiene proveedores contratados.');
  });

  test('la búsqueda enseña como mucho cinco proveedores con el aviso de los que sobran, y «Sin coincidencias» si no hay ninguno', async ({ page }) => {
    await open(page, 'admin', '/programs/PRG-001');
    await page.getByRole('radio', { name: 'Proveedores', exact: true }).click();
    await page.getByLabel('Proveedor del tenant', { exact: true }).fill('a');
    await expect(page.getByTestId('supplier-search-status')).toContainText('más: afina la búsqueda');
    await expect(page.getByRole('list', { name: 'Proveedores encontrados', exact: true }).getByRole('option')).toHaveCount(5);

    await page.getByLabel('Proveedor del tenant', { exact: true }).fill('zzzz-no-existe');
    await expect(page.getByTestId('supplier-search-status')).toHaveText('Sin coincidencias');
    await expect(page.getByTestId('supplier-search-list')).toHaveCount(0);
  });

  test('error de la API con traza y reintento', async ({ page }) => {
    await page.route('**/api/suppliers?program=PRG-001', (route) =>
      route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ statusCode: 503, error: 'Service Unavailable', message: 'down', traceId: '4b2e-9f01' }) }),
    );
    await open(page, 'admin', '/programs/PRG-001');
    await page.getByRole('radio', { name: 'Proveedores', exact: true }).click();
    await expect(page.getByTestId('suppliers-error')).toContainText('GET /api/suppliers → 503 Service Unavailable · trace 4b2e-9f01');
    await page.unroute('**/api/suppliers?program=PRG-001');
    await page.getByTestId('suppliers-error-retry').click();
    await expect(page.getByTestId('suppliers-error')).toHaveCount(0);
    await expect(page.getByTestId('supplier-row-s1')).toBeVisible();
  });
});
