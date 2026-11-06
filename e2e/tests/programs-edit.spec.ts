import { expect, test } from '@playwright/test';
import { API_URL, loginByApi, openAs, resetTenant } from '../support/auth';

// Spec de humo de «Editar programa» (fase 2, pendiente de la fase 1): formulario, validaciones, 422, permisos y PATCH por API.
// Trabaja en su propio tenant (alumno08) y lo restaura antes y después.

const TENANT = 'alumno08';
test.describe.configure({ mode: 'serial' });

test.beforeAll(async ({ request }) => {
  await resetTenant(request, TENANT);
});

test.afterAll(async ({ request }) => {
  await resetTenant(request, TENANT);
});

test('el menú de la fila abre la edición con los datos actuales; sin cambios, Guardar está deshabilitado', async ({ page }) => {
  await openAs(page, 'admin', '/programs', { tenant: TENANT });
  await page.getByRole('button', { name: 'Acciones para PRG-003' }).click();
  await page.getByRole('menuitem', { name: 'Editar' }).click();

  await expect(page).toHaveURL(/\/programs\/PRG-003\/edit$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Editar programa' })).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Migas de pan' }).getByText('Editar')).toBeVisible();

  const code = page.getByLabel('Código');
  await expect(code).toHaveValue('PRG-003');
  await expect(code).toHaveAttribute('readonly', '');
  await expect(page.getByLabel('Nombre')).toHaveValue('Enlace de datos seguro LD-9');
  await expect(page.getByRole('combobox', { name: /Responsable/ })).toHaveValue('Lucía Fernández');

  const save = page.getByRole('button', { name: 'Guardar', exact: true });
  await expect(save).toBeDisabled();
  await expect(save).toHaveAttribute('title', 'No hay cambios que guardar');
  await expect(page.getByRole('button', { name: 'Guardar y cerrar' })).toBeDisabled();
});

test('validación de cliente y de servidor: nombre corto, fechas incoherentes, nombre repetido y «duplicado» (422)', async ({ page }) => {
  await openAs(page, 'admin', '/programs/PRG-003/edit', { tenant: TENANT });
  const name = page.getByLabel('Nombre');
  const save = page.getByRole('button', { name: 'Guardar', exact: true });

  await name.fill('ab');
  await save.click();
  await expect(page.getByTestId('program-edit-name-error')).toHaveText('El nombre debe tener al menos 3 caracteres');
  await expect(name).toHaveAttribute('aria-invalid', 'true');

  await name.fill('Enlace de datos seguro LD-9');
  await page.getByLabel('Fecha de fin').fill('2020-01-01');
  await name.fill('Enlace de datos revisado');
  await save.click();
  await expect(page.getByTestId('program-edit-end-error')).toHaveText('La fecha de fin debe ser posterior al inicio');

  await page.getByLabel('Fecha de fin').fill('2027-12-31');
  await page.getByLabel(/Presupuesto/).fill('0');
  await save.click();
  await expect(page.getByTestId('program-edit-budget-error')).toHaveText('El presupuesto debe ser mayor que 0');

  await page.getByLabel(/Presupuesto/).fill('2500000');
  await name.fill('Sistema de mando táctico Ártemis'); // nombre de PRG-001
  await save.click();
  const alert = page.getByTestId('program-edit-server-error');
  await expect(alert).toContainText('422');
  await expect(alert).toContainText('Ya existe un programa con ese nombre');

  await name.fill('Programa duplicado de prueba');
  await save.click();
  await expect(page.getByTestId('program-edit-name-error')).toHaveText('Ya existe un programa con ese nombre');
});

test('guardar actualiza el programa (toast) y «Guardar y cerrar» vuelve al detalle con los cambios', async ({ page }) => {
  await openAs(page, 'admin', '/programs/PRG-003/edit', { tenant: TENANT });
  const save = page.getByRole('button', { name: 'Guardar', exact: true });

  // Cambiar solo la descripción no choca con el propio nombre (la comprobación de duplicados excluye al programa editado)
  await page.getByLabel('Descripción').fill('Descripción revisada desde el formulario.');
  await page.getByLabel('Estado').selectOption('on_hold');
  await page.getByRole('radio', { name: 'Alta' }).check();
  await expect(save).toBeEnabled();
  await save.click();

  const toast = page.getByTestId('toast-ok');
  await expect(toast).toContainText('Programa actualizado');
  await expect(toast).toContainText('PRG-003 se guardó correctamente');
  await expect(save).toBeDisabled(); // vuelve a no haber cambios pendientes
  await expect(toast).toBeHidden({ timeout: 5000 }); // autocierre a los 3 s

  await page.getByLabel('Nombre').fill('Enlace de datos seguro LD-9 (rev. B)');
  await page.getByRole('button', { name: 'Guardar y cerrar' }).click();
  await expect(page).toHaveURL(/\/programs\/PRG-003$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Enlace de datos seguro LD-9 (rev. B)' })).toBeVisible();
  await expect(page.getByTestId('program-detail-state-badge')).toHaveAttribute('data-state', 'on_hold');
  await expect(page.getByText('Descripción revisada desde el formulario.')).toBeVisible();
});

test('el cambio de responsable usa el combobox y se refleja en la tabla', async ({ page }) => {
  await openAs(page, 'admin', '/programs/PRG-003/edit', { tenant: TENANT });
  const owner = page.getByRole('combobox', { name: /Responsable/ });
  await owner.click();
  await page.getByTestId('program-edit-owner-option-u4').click();
  await expect(owner).toHaveValue('Andrés Molina');
  await page.getByRole('button', { name: 'Guardar y cerrar' }).click();
  await expect(page).toHaveURL(/\/programs\/PRG-003$/);

  await page.goto('/programs?q=PRG-003');
  await expect(page.getByTestId('programs-row-PRG-003')).toContainText('Andrés Molina');
});

test('un consultor ve el aviso de permisos en la edición y el botón del detalle deshabilitado con su motivo', async ({ page }) => {
  await openAs(page, 'consultant', '/programs/PRG-004', { tenant: TENANT });
  const edit = page.getByTitle('Tu rol no permite modificar programas');
  await expect(edit).toBeDisabled();
  await expect(edit).toHaveText('Editar programa');

  await page.goto('/programs/PRG-004/edit');
  await expect(page.getByRole('alert').filter({ hasText: 'Tu rol no permite modificar programas' })).toBeVisible();
  await expect(page.getByLabel('Nombre')).toHaveCount(0);

  await page.goto('/programs');
  await page.getByRole('button', { name: 'Acciones para PRG-004' }).click();
  await expect(page.getByRole('menuitem', { name: 'Editar' })).toBeDisabled();
});

test.describe('PATCH /api/programs/:code', () => {
  const patch = async (request: import('@playwright/test').APIRequestContext, role: 'admin' | 'consultant', code: string, data: unknown) => {
    const { accessToken } = await loginByApi(request, role, TENANT);
    return request.patch(`${API_URL}/programs/${code}`, { headers: { Authorization: `Bearer ${accessToken}`, 'x-tenant': TENANT }, data });
  };

  test('es parcial: solo cambia los campos enviados y no aplica valores por defecto', async ({ request }) => {
    const response = await patch(request, 'admin', 'PRG-005', { budget: 1234567 });
    expect(response.status()).toBe(200);
    const program = (await response.json()) as { name: string; status: string; priority: string; budgetEur: number };
    expect(program).toMatchObject({ budgetEur: 1234567, name: 'Centro de control de misión CCM', status: 'active', priority: 'high' }); // priority=high del seed: el valor por defecto («medium») no se aplicó
  });

  test('exige permiso: el consultor recibe 403; sin campos, 422; fechas incoherentes, 422; código inexistente, 404', async ({ request }) => {
    expect((await patch(request, 'consultant', 'PRG-005', { budget: 5 })).status()).toBe(403);
    const empty = await patch(request, 'admin', 'PRG-005', {});
    expect(empty.status()).toBe(422);
    const dates = await patch(request, 'admin', 'PRG-005', { endDate: '2000-01-01' });
    expect(dates.status()).toBe(422);
    expect(((await dates.json()) as { errors: Record<string, string> }).errors).toEqual({ endDate: 'endAfterStart' });
    expect((await patch(request, 'admin', 'PRG-999', { budget: 5 })).status()).toBe(404);
  });

  test('un nombre repetido (de otro programa) devuelve 422 dupName; el propio nombre no', async ({ request }) => {
    const clash = await patch(request, 'admin', 'PRG-005', { name: 'Sistema de mando táctico Ártemis' });
    expect(clash.status()).toBe(422);
    expect(((await clash.json()) as { errors: Record<string, string> }).errors).toEqual({ name: 'dupName' });
    expect((await patch(request, 'admin', 'PRG-005', { name: 'Centro de control de misión CCM' })).status()).toBe(200);
  });
});
