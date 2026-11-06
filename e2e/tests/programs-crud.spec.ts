import { expect, test } from '@playwright/test';
import { API_URL, loginByApi, openAs, resetTenant } from '../support/auth';

// Spec de humo de Programas (escritura): asistente de alta, 422, duplicar, archivar, eliminar y modo caos.
// Trabaja en su propio tenant (alumno02) y lo restaura antes de empezar.

const TENANT = 'alumno02';
test.describe.configure({ mode: 'serial' });

test.beforeAll(async ({ request }) => {
  await resetTenant(request, TENANT);
});

test.afterAll(async ({ request }) => {
  await resetTenant(request, TENANT);
});

const rowCodes = (page: import('@playwright/test').Page) => page.getByTestId(/^programs-link-/);

test('asistente de 3 pasos: validaciones, resumen y alta del programa', async ({ page }) => {
  await openAs(page, 'admin', '/programs', { tenant: TENANT });
  await expect(rowCodes(page)).toHaveCount(10);

  await page.getByRole('button', { name: /Nuevo programa/ }).click();
  const wizard = page.getByRole('dialog', { name: 'Nuevo programa' });
  await expect(wizard).toBeVisible();
  await expect(wizard.getByText('Paso 1 de 3')).toBeVisible();
  await expect(page.getByLabel('Código')).toHaveValue('PRG-025');
  await expect(page.getByLabel('Código')).toHaveAttribute('readonly', '');
  await expect(page.getByRole('button', { name: 'Atrás' })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Atrás' })).toHaveAttribute('title', 'Estás en el primer paso');

  // Paso 1: validación de cliente
  await page.getByLabel('Nombre').fill('ab');
  await wizard.getByRole('button', { name: 'Siguiente' }).click();
  await expect(page.getByTestId('programs-wizard-name-error')).toHaveText('El nombre debe tener al menos 3 caracteres');
  await expect(page.getByTestId('programs-wizard-owner-error')).toHaveText('Selecciona un responsable de la lista');
  await expect(page.getByLabel('Nombre')).toHaveAttribute('aria-invalid', 'true');

  await page.getByLabel('Nombre').fill('Programa de pruebas Playwright');
  await page.getByLabel('Descripción').fill('Creado desde el asistente.');
  const owner = wizard.getByRole('combobox', { name: /Responsable/ });
  await owner.fill('jav');
  await owner.press('ArrowDown');
  await owner.press('Enter');
  await expect(owner).toHaveValue('Javier Ortega');
  await page.getByLabel('Estado inicial').selectOption('active');
  await wizard.getByRole('button', { name: 'Siguiente' }).click();

  // Paso 2: fechas coherentes y presupuesto > 0
  await expect(wizard.getByText('Paso 2 de 3')).toBeVisible();
  await expect(page.getByTestId('programs-wizard-step-2')).toHaveAttribute('aria-current', 'step');
  await wizard.getByRole('button', { name: 'Siguiente' }).click();
  await expect(page.getByTestId('programs-wizard-start-error')).toHaveText('La fecha de inicio es obligatoria');
  await expect(page.getByTestId('programs-wizard-end-error')).toHaveText('La fecha de fin debe ser posterior al inicio');
  await expect(page.getByTestId('programs-wizard-budget-error')).toHaveText('El presupuesto debe ser mayor que 0');

  await page.getByLabel('Fecha de inicio').fill('2026-03-01');
  await page.getByLabel('Fecha de fin').fill('2026-03-01');
  await page.getByLabel(/Presupuesto/).fill('0');
  await wizard.getByRole('button', { name: 'Siguiente' }).click();
  await expect(page.getByTestId('programs-wizard-end-error')).toBeVisible(); // fin = inicio no es válido
  await expect(page.getByTestId('programs-wizard-budget-error')).toBeVisible();

  await page.getByLabel('Fecha de fin').fill('2027-09-30');
  await page.getByLabel(/Presupuesto/).fill('1500000');
  await page.getByRole('radio', { name: 'Alta' }).check();
  await page.getByRole('checkbox', { name: 'Programa clasificado' }).check();
  await wizard.getByRole('button', { name: 'Siguiente' }).click();

  // Paso 3: resumen y conmutador
  const summary = page.getByTestId('programs-wizard-summary');
  await expect(summary).toContainText('PRG-025');
  await expect(summary).toContainText('Programa de pruebas Playwright');
  await expect(summary).toContainText('Javier Ortega');
  await expect(summary).toContainText('01/03/2026 → 30/09/2027');
  await expect(summary).toContainText('1.500.000');
  const notify = page.getByRole('switch', { name: 'Notificar al equipo por correo' });
  await expect(notify).toHaveAttribute('aria-checked', 'true');
  await notify.click();
  await expect(notify).toHaveAttribute('aria-checked', 'false');

  await wizard.getByRole('button', { name: 'Crear programa' }).click();
  const toast = page.getByTestId('toast-ok');
  await expect(toast).toContainText('Programa creado');
  await expect(toast).toContainText('PRG-025 se añadió a la lista');
  await expect(wizard).toBeHidden();

  // La lista pasa a orden por código descendente y muestra el nuevo programa primero
  await expect(rowCodes(page).first()).toHaveText('PRG-025');
  await expect(page.getByText('25 programas')).toBeVisible();
  await expect(page.getByTestId('programs-row-PRG-025').getByTestId('programs-state-badge')).toHaveAttribute('data-state', 'active');
  await expect(toast).toBeHidden({ timeout: 5000 }); // autocierre a los 3 s
});

test('422: un nombre que contiene «duplicado» vuelve al paso 1 con el error de servidor', async ({ page }) => {
  await openAs(page, 'admin', '/programs', { tenant: TENANT });
  await expect(rowCodes(page)).toHaveCount(10); // la página debe estar lista para que el atajo esté registrado
  await page.keyboard.press('n'); // atajo N
  const wizard = page.getByRole('dialog', { name: 'Nuevo programa' });
  await expect(wizard).toBeVisible();

  await page.getByLabel('Nombre').fill('Programa duplicado de prueba');
  const owner = wizard.getByRole('combobox', { name: /Responsable/ });
  await owner.click();
  await page.getByTestId('programs-wizard-owner-option-u1').click();
  await wizard.getByRole('button', { name: 'Siguiente' }).click();
  await page.getByLabel('Fecha de inicio').fill('2026-01-10');
  await page.getByLabel('Fecha de fin').fill('2026-12-31');
  await page.getByLabel(/Presupuesto/).fill('250000');
  await wizard.getByRole('button', { name: 'Siguiente' }).click();
  await wizard.getByRole('button', { name: 'Crear programa' }).click();

  const alert = page.getByTestId('programs-wizard-server-error');
  await expect(alert).toContainText('422');
  await expect(alert).toContainText('Ya existe un programa con ese nombre');
  await expect(page.getByTestId('programs-wizard-name-error')).toHaveText('Ya existe un programa con ese nombre');
  await expect(page.getByTestId('programs-wizard-step-1')).toHaveAttribute('aria-current', 'step');

  // Esc cierra el asistente sin crear nada
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('programs-wizard')).toBeHidden();
  await expect(page.getByText('25 programas')).toBeVisible();
});

test('duplicar y archivar desde el menú de la fila', async ({ page }) => {
  await openAs(page, 'admin', '/programs', { tenant: TENANT });
  await page.getByRole('button', { name: 'Acciones para PRG-001' }).click();
  await page.getByRole('menuitem', { name: 'Duplicar' }).click();
  await expect(page.getByTestId('toast-ok').filter({ hasText: 'programa creado' })).toContainText('Copia creada como borrador');
  await expect(rowCodes(page).first()).toHaveText('PRG-026');
  const copy = page.getByTestId('programs-row-PRG-026');
  await expect(copy).toContainText('(copia)');
  await expect(copy.getByTestId('programs-state-badge')).toHaveAttribute('data-state', 'draft');

  await page.getByRole('button', { name: 'Acciones para PRG-026' }).click();
  await page.getByRole('menuitem', { name: 'Archivar' }).click();
  await expect(page.getByTestId('toast-ok').filter({ hasText: 'PRG-026 archivado' })).toBeVisible();
  await expect(page.getByTestId('programs-row-PRG-026').getByTestId('programs-state-badge')).toHaveAttribute('data-state', 'closed');
});

test('eliminar: alertdialog con foco en Eliminar; cancelar, Esc y confirmar', async ({ page }) => {
  await openAs(page, 'admin', '/programs?sort=code&dir=desc', { tenant: TENANT });
  await expect(rowCodes(page).first()).toHaveText('PRG-026');

  await page.getByRole('button', { name: 'Acciones para PRG-026' }).click();
  await page.getByRole('menuitem', { name: 'Eliminar' }).click();
  const dialog = page.getByRole('alertdialog', { name: 'Eliminar programa' });
  await expect(dialog).toContainText('PRG-026 se eliminará de forma permanente');
  await expect(page.getByRole('button', { name: 'Eliminar', exact: true })).toBeFocused();

  await page.getByTestId('modal-cancel').click();
  await expect(dialog).toBeHidden();
  await expect(page.getByTestId('programs-row-PRG-026')).toBeVisible();

  await page.getByRole('button', { name: 'Acciones para PRG-026' }).click();
  await page.getByRole('menuitem', { name: 'Eliminar' }).click();
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();

  await page.getByRole('button', { name: 'Acciones para PRG-026' }).click();
  await page.getByRole('menuitem', { name: 'Eliminar' }).click();
  await page.getByTestId('modal-confirm').click();
  await expect(page.getByTestId('toast-ok').filter({ hasText: 'PRG-026 eliminado' })).toBeVisible();
  await expect(page.getByTestId('programs-row-PRG-026')).toHaveCount(0);
});

test('acciones masivas: archivar y eliminar la selección', async ({ page }) => {
  await openAs(page, 'admin', '/programs?sort=code&dir=desc', { tenant: TENANT });
  await expect(rowCodes(page).first()).toHaveText('PRG-025');
  await page.getByRole('checkbox', { name: 'Seleccionar PRG-025' }).check();
  await page.getByRole('checkbox', { name: 'Seleccionar PRG-024' }).check();
  await expect(page.getByTestId('programs-bulk-count')).toHaveText('2 seleccionados');

  await page.getByTestId('programs-bulk-archive').click();
  await expect(page.getByTestId('toast-ok').filter({ hasText: '2 programas archivados' })).toBeVisible();
  await expect(page.getByTestId('programs-bulk-bar')).toBeHidden();

  await page.getByRole('checkbox', { name: 'Seleccionar PRG-025' }).check();
  await page.getByTestId('programs-bulk-delete').click();
  await expect(page.getByRole('alertdialog')).toContainText('PRG-025 se eliminará');
  await page.getByTestId('modal-confirm').click();
  await expect(page.getByText('24 programas')).toBeVisible();
});

test('modo caos: las escrituras fallan con 500 y la UI lo muestra; la API sigue accesible', async ({ page, request }) => {
  const { accessToken } = await loginByApi(request, 'admin', TENANT);
  const auth = { Authorization: `Bearer ${accessToken}`, 'x-tenant': TENANT };
  const on = await request.patch(`${API_URL}/admin/chaos`, { headers: auth, data: { errorRate: 1 } });
  expect(await on.json()).toMatchObject({ errorRate: 1 });

  try {
    await openAs(page, 'admin', '/programs', { tenant: TENANT });
    await expect(rowCodes(page)).toHaveCount(10); // las lecturas funcionan
    await page.getByRole('button', { name: 'Acciones para PRG-001' }).click();
    await page.getByRole('menuitem', { name: 'Duplicar' }).click();
    const toast = page.getByTestId('toast-danger');
    await expect(toast).toContainText('Ha ocurrido un error inesperado');
    await expect(toast).toContainText('500 Internal Server Error');
  } finally {
    await request.patch(`${API_URL}/admin/chaos`, { headers: auth, data: { errorRate: 0 } });
  }
});

test('el gestor puede crear y archivar, pero no eliminar', async ({ page }) => {
  await openAs(page, 'program_manager', '/programs', { tenant: TENANT });
  await page.getByRole('checkbox', { name: 'Seleccionar PRG-002' }).check();
  await expect(page.getByTestId('programs-bulk-archive')).toBeEnabled();
  await expect(page.getByTestId('programs-bulk-delete')).toBeDisabled();
  await expect(page.getByTestId('programs-bulk-delete')).toHaveAttribute('title', 'Solo admin puede eliminar');
});
