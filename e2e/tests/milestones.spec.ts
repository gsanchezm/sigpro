import { expect, test, type APIRequestContext, type Page } from '@playwright/test';
import { API_URL, openAs, resetTenant, type RoleName } from '../support/auth';
import { authHeaders } from '../support/admin';

// Spec de humo de los hitos del programa (fase 3): tabla con edición inline de celdas (doble clic, F2, Intro, Esc), slider de
// avance con aria-valuenow, alta, eliminación con alertdialog, permisos por rol, estados de carga/error/vacío y la API.
// Tenant propio: alumno07. PRG-001 tiene 9 hitos (PRG-001-M01 … M09): M01 cumplido, M02 al 10 %, el resto sin empezar.
// Los avances nunca saltan de menos del 50 % al 100 % de golpe (defecto plantado del laboratorio, ver docs/planted-bugs.md).

const TENANT = 'alumno07';
test.describe.configure({ mode: 'serial' });

test.beforeAll(async ({ request }) => {
  await resetTenant(request, TENANT);
});

test.afterAll(async ({ request }) => {
  await resetTenant(request, TENANT);
});

const table = (page: Page) => page.getByTestId('milestones-table');
const count = (page: Page) => page.getByTestId('milestones-count');
const row = (page: Page, id: string) => page.getByTestId(`milestone-row-${id}`);
const nameCell = (page: Page, id: string) => page.getByTestId(`milestone-name-${id}`);
const slider = (page: Page, id: string) => page.getByTestId(`milestone-progress-${id}`);

const openMilestones = async (page: Page, program = 'PRG-001', role: RoleName = 'program_manager'): Promise<void> => {
  await openAs(page, role, `/programs/${program}`, { tenant: TENANT });
  await page.getByRole('tab', { name: 'Hitos' }).click();
  await expect(table(page)).toHaveAttribute('aria-busy', 'false');
};

interface MilestoneDto {
  id: string;
  name: string;
  dueDate: string;
  progress: number;
  done: boolean;
}

const apiList = async (request: APIRequestContext, program = 'PRG-001'): Promise<MilestoneDto[]> => {
  const response = await request.get(`${API_URL}/programs/${program}/milestones`, { headers: await authHeaders(request, 'admin', TENANT) });
  expect(response.status()).toBe(200);
  return (await response.json()) as MilestoneDto[];
};

test('tabla: columnas, contador, estados con data-state y barra de avance del programa', async ({ page }) => {
  await openMilestones(page);
  await expect(page.getByRole('tab', { name: 'Hitos' })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('heading', { level: 2, name: 'Hitos del programa' })).toBeVisible();
  await expect(page.getByRole('columnheader')).toHaveText(['Hito', 'Fecha límite', 'Avance', 'Estado', 'Acciones']);
  await expect(page.getByRole('row')).toHaveCount(10);
  await expect(count(page)).toHaveText('1 de 9 hitos cumplidos');

  // estado por fila: badge y data-state
  await expect(page.getByTestId('milestone-status-PRG-001-M01')).toHaveText('Cumplido');
  await expect(row(page, 'PRG-001-M01')).toHaveAttribute('data-state', 'done');
  await expect(page.getByTestId('milestone-status-PRG-001-M02')).toHaveText('En curso');
  await expect(page.getByTestId('milestone-status-PRG-001-M03')).toHaveText('Pendiente');
  await expect(page.getByRole('row').filter({ has: page.locator('[data-state="pending"]') })).toHaveCount(7);

  // slider por fila con nombre accesible y aria-valuenow
  await expect(page.getByLabel('Avance de SRR')).toHaveAttribute('aria-valuenow', '100');
  await expect(page.getByLabel('Avance de PDR')).toHaveAttribute('aria-valuenow', '10');
  await expect(page.getByLabel('Avance de PDR')).toHaveAttribute('aria-valuetext', '10 %');
  await expect(page.getByLabel('Avance de CDR')).toHaveAttribute('aria-valuenow', '0');

  // cabecera del programa: 1 de 9 hitos = 11 %
  await expect(page.getByTestId('program-detail-progress')).toHaveAttribute('aria-valuenow', '11');
  await expect(page.getByTitle('11 % completado')).toBeVisible();
});

test('edición inline del nombre: doble clic, Intro guarda y persiste; Esc y salir del campo cancelan', async ({ page, request }) => {
  await openMilestones(page);
  const cell = nameCell(page, 'PRG-001-M03');
  await expect(cell).toHaveText('CDR');
  await expect(cell).toHaveAttribute('title', 'Doble clic para editar · Intro guarda · Esc cancela');

  await cell.dblclick();
  const input = page.getByRole('textbox', { name: 'Nombre del hito' });
  await expect(input).toBeFocused();
  await expect(input).toHaveValue('CDR');
  await input.fill('CDR revisado');
  await input.press('Enter');
  await expect(page.getByTestId('toast-ok')).toContainText('Hito actualizado');
  await expect(page.getByTestId('toast-ok')).toContainText('CDR revisado');
  await expect(input).toHaveCount(0);
  await expect(cell).toHaveText('CDR revisado');
  expect((await apiList(request)).find((milestone) => milestone.id === 'PRG-001-M03')?.name).toBe('CDR revisado');

  // persiste tras recargar
  await page.reload();
  await page.getByRole('tab', { name: 'Hitos' }).click();
  await expect(nameCell(page, 'PRG-001-M03')).toHaveText('CDR revisado');

  // Esc cancela
  await nameCell(page, 'PRG-001-M03').dblclick();
  await page.getByRole('textbox', { name: 'Nombre del hito' }).fill('No debería guardarse');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('textbox', { name: 'Nombre del hito' })).toHaveCount(0);
  await expect(nameCell(page, 'PRG-001-M03')).toHaveText('CDR revisado');

  // salir del campo también cancela
  await nameCell(page, 'PRG-001-M03').dblclick();
  await page.getByRole('textbox', { name: 'Nombre del hito' }).fill('Tampoco');
  await page.getByRole('heading', { level: 1 }).click();
  await expect(page.getByRole('textbox', { name: 'Nombre del hito' })).toHaveCount(0);
  await expect(nameCell(page, 'PRG-001-M03')).toHaveText('CDR revisado');
  expect((await apiList(request)).find((milestone) => milestone.id === 'PRG-001-M03')?.name).toBe('CDR revisado');
});

test('edición inline: un nombre inválido deja el campo abierto con aria-invalid y el motivo; F2 y el menú «Renombrar» también editan', async ({ page }) => {
  await openMilestones(page);
  await nameCell(page, 'PRG-001-M04').dblclick();
  const input = page.getByRole('textbox', { name: 'Nombre del hito' });
  await input.fill('a');
  await input.press('Enter');
  await expect(input).toBeVisible();
  await expect(input).toHaveAttribute('aria-invalid', 'true');
  await expect(input).toHaveAttribute('title', 'El nombre debe tener al menos 2 caracteres');
  await input.fill('Revisión de pruebas');
  await expect(input).not.toHaveAttribute('aria-invalid', 'true');
  await page.keyboard.press('Escape');
  await expect(nameCell(page, 'PRG-001-M04')).toHaveText('TRR');

  // F2 sobre la celda enfocada
  await nameCell(page, 'PRG-001-M04').focus();
  await page.keyboard.press('F2');
  await expect(page.getByRole('textbox', { name: 'Nombre del hito' })).toBeFocused();
  await page.keyboard.press('Escape');

  // menú ⋯ → Renombrar
  await page.getByRole('button', { name: 'Acciones para el hito TRR' }).click();
  await expect(page.getByRole('menu', { name: 'Acciones para el hito TRR' })).toBeVisible();
  await page.getByRole('menuitem', { name: 'Renombrar' }).click();
  await expect(page.getByRole('textbox', { name: 'Nombre del hito' })).toBeFocused();
  await page.keyboard.press('Escape');
});

test('edición inline de la fecha límite: input de fecha, Intro guarda y la tabla se reordena por fecha', async ({ page, request }) => {
  await openMilestones(page);
  const date = page.getByTestId('milestone-date-PRG-001-M05');
  const before = await date.innerText();
  await date.dblclick();
  const input = page.getByLabel('Fecha límite', { exact: true });
  await expect(input).toHaveAttribute('type', 'date');

  // fecha vacía: inválida, el campo sigue abierto
  await input.fill('');
  await input.press('Enter');
  await expect(input).toHaveAttribute('aria-invalid', 'true');
  await expect(input).toHaveAttribute('title', 'Indica una fecha válida');

  await input.fill('2030-05-17');
  await input.press('Enter');
  await expect(page.getByTestId('toast-ok')).toContainText('Hito actualizado');
  await expect(date).toHaveText('17/05/2030');
  expect(before).not.toBe('17/05/2030');
  expect((await apiList(request)).find((milestone) => milestone.id === 'PRG-001-M05')?.dueDate).toBe('2030-05-17');
  // la fecha más lejana pasa a ser la última fila (FAT)
  await expect(page.getByRole('row').last()).toContainText('FAT');
});

test('slider de avance: fill, teclado y aria-valuenow; al llegar al 100 % el hito se cumple y cambia el avance del programa', async ({ page, request }) => {
  await openMilestones(page);
  const pdr = slider(page, 'PRG-001-M02');
  await expect(pdr).toHaveAttribute('aria-valuenow', '10');

  await pdr.fill('50');
  await expect(pdr).toHaveAttribute('aria-valuenow', '50');
  await expect(pdr).toHaveAttribute('aria-valuetext', '50 %');
  await expect(page.getByTestId('toast-ok').last()).toContainText('Hito actualizado');
  await expect(page.getByTestId('milestone-status-PRG-001-M02')).toHaveText('En curso');
  await expect(count(page)).toHaveText('1 de 9 hitos cumplidos');
  await expect.poll(async () => (await apiList(request)).find((milestone) => milestone.id === 'PRG-001-M02')?.progress).toBe(50);

  // 50 → 100: cumplido (no es un salto desde menos del 50 %)
  await pdr.fill('100');
  await expect(page.getByTestId('milestone-status-PRG-001-M02')).toHaveText('Cumplido');
  await expect(row(page, 'PRG-001-M02')).toHaveAttribute('data-state', 'done');
  await expect(count(page)).toHaveText('2 de 9 hitos cumplidos');
  // el detalle del programa vuelve a pedir su avance: 2 de 9 = 22 %
  await expect(page.getByTestId('program-detail-progress')).toHaveAttribute('aria-valuenow', '22');
  await expect(page.getByTitle('22 % completado')).toBeVisible();
  const saved = (await apiList(request)).find((milestone) => milestone.id === 'PRG-001-M02');
  expect(saved).toMatchObject({ progress: 100, done: true });

  // teclado: cada paso de las flechas son 5 puntos y se guarda
  const trr = slider(page, 'PRG-001-M04');
  await trr.focus();
  await page.keyboard.press('ArrowRight');
  await expect(trr).toHaveAttribute('aria-valuenow', '5');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  await expect(trr).toHaveAttribute('aria-valuenow', '15');
  await page.keyboard.press('ArrowLeft');
  await expect(trr).toHaveAttribute('aria-valuenow', '10');
  await expect.poll(async () => (await apiList(request)).find((milestone) => milestone.id === 'PRG-001-M04')?.progress).toBe(10);
  await expect(page.getByTestId('milestone-status-PRG-001-M04')).toHaveText('En curso');
});

test('alta de hito: validación del formulario (cliente) y creación con toast', async ({ page }) => {
  await openMilestones(page);
  await page.getByRole('button', { name: 'Nuevo hito' }).click();
  const dialog = page.getByRole('dialog', { name: 'Nuevo hito' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByLabel('Nombre')).toBeFocused();

  await dialog.getByRole('button', { name: 'Crear hito' }).click();
  await expect(page.getByTestId('milestone-new-name-error')).toHaveText('El nombre debe tener al menos 2 caracteres');
  await expect(page.getByTestId('milestone-new-date-error')).toHaveText('Indica una fecha válida');
  await expect(dialog.getByLabel('Nombre')).toHaveAttribute('aria-invalid', 'true');

  await dialog.getByLabel('Nombre').fill('Revisión de diseño');
  await expect(page.getByTestId('milestone-new-name-error')).toHaveCount(0);
  await dialog.getByLabel('Fecha límite').fill('2029-03-01');
  await dialog.getByRole('button', { name: 'Crear hito' }).click();

  await expect(dialog).toBeHidden();
  await expect(page.getByTestId('toast-ok')).toContainText('Hito creado');
  await expect(page.getByTestId('toast-ok')).toContainText('PRG-001-M10');
  await expect(row(page, 'PRG-001-M10')).toBeVisible();
  await expect(nameCell(page, 'PRG-001-M10')).toHaveText('Revisión de diseño');
  await expect(page.getByTestId('milestone-status-PRG-001-M10')).toHaveText('Pendiente');
  await expect(count(page)).toHaveText('2 de 10 hitos cumplidos');

  // Esc cierra el diálogo sin crear nada
  await page.getByRole('button', { name: 'Nuevo hito' }).click();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('row')).toHaveCount(11);
});

test('eliminar un hito: alertdialog con cancelar y aceptar, y el avance del programa se recalcula', async ({ page }) => {
  await openMilestones(page);
  await expect(count(page)).toHaveText('2 de 10 hitos cumplidos');

  // cancelar conserva la fila
  await page.getByRole('button', { name: 'Acciones para el hito Revisión de diseño' }).click();
  await page.getByRole('menuitem', { name: 'Eliminar' }).click();
  const dialog = page.getByRole('alertdialog', { name: 'Eliminar hito' });
  await expect(dialog).toContainText('¿Eliminar el hito «Revisión de diseño»?');
  await dialog.getByRole('button', { name: 'Cancelar' }).click();
  await expect(dialog).toBeHidden();
  await expect(row(page, 'PRG-001-M10')).toBeVisible();

  // aceptar la elimina
  await page.getByRole('button', { name: 'Acciones para el hito Revisión de diseño' }).click();
  await page.getByRole('menuitem', { name: 'Eliminar' }).click();
  await page.getByRole('alertdialog', { name: 'Eliminar hito' }).getByRole('button', { name: 'Eliminar' }).click();
  await expect(row(page, 'PRG-001-M10')).toHaveCount(0);
  await expect(page.getByTestId('toast-ok')).toContainText('Hito eliminado');
  await expect(count(page)).toHaveText('2 de 9 hitos cumplidos');

  // eliminar un hito cumplido recalcula el avance: 1 de 8 = 13 %
  await page.getByRole('button', { name: 'Acciones para el hito SRR' }).click();
  await page.getByRole('menuitem', { name: 'Eliminar' }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Eliminar' }).click();
  await expect(count(page)).toHaveText('1 de 8 hitos cumplidos');
  await expect(page.getByTestId('program-detail-progress')).toHaveAttribute('aria-valuenow', '13');
});

test('permisos: solo admin y gestor editan; consultor y auditor ven los controles deshabilitados con su motivo', async ({ page }) => {
  for (const role of ['consultant', 'auditor'] as const) {
    await openMilestones(page, 'PRG-002', role);
    await expect(page.getByRole('button', { name: 'Nuevo hito' })).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Nuevo hito' })).toHaveAttribute('title', 'Tu rol no permite crear hitos');
    await expect(page.getByText('Tu rol no permite modificar hitos').first()).toBeVisible();

    const first = page.getByRole('slider').first();
    await expect(first).toBeDisabled();
    await expect(first).toHaveAttribute('title', 'Tu rol no permite modificar hitos');

    // la celda no entra en edición con doble clic
    await page.getByTestId(/^milestone-name-PRG-002-M/).first().dblclick();
    await expect(page.getByRole('textbox', { name: 'Nombre del hito' })).toHaveCount(0);

    await page.getByRole('button', { name: /^Acciones para el hito/ }).first().click();
    await expect(page.getByRole('menuitem', { name: 'Renombrar' })).toBeDisabled();
    await expect(page.getByRole('menuitem', { name: 'Renombrar' })).toHaveAttribute('title', 'Tu rol no permite modificar hitos');
    await expect(page.getByRole('menuitem', { name: 'Eliminar' })).toBeDisabled();
    await expect(page.getByRole('menuitem', { name: 'Eliminar' })).toHaveAttribute('title', 'Tu rol no permite eliminar hitos');
    await page.keyboard.press('Escape');
  }

  for (const role of ['admin', 'program_manager'] as const) {
    await openMilestones(page, 'PRG-002', role);
    await expect(page.getByRole('button', { name: 'Nuevo hito' })).toBeEnabled();
    await expect(page.getByRole('slider').first()).toBeEnabled();
  }
});

test('estados de la lista: carga con esqueleto y aria-busy, error 503 con reintento y programa sin hitos', async ({ page, request }) => {
  // carga lenta: esqueleto y aria-busy mientras llegan los datos
  await openAs(page, 'program_manager', '/programs/PRG-002', { tenant: TENANT });
  await page.route('**/api/programs/PRG-002/milestones', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 900));
    await route.fallback();
  });
  await page.getByRole('tab', { name: 'Hitos' }).click();
  await expect(table(page)).toHaveAttribute('aria-busy', 'true');
  await expect(page.getByTestId('skeleton-row')).toHaveCount(4);
  await expect(table(page)).toHaveAttribute('aria-busy', 'false');
  await expect(page.getByTestId('skeleton-row')).toHaveCount(0);
  await page.unroute('**/api/programs/PRG-002/milestones');

  // error del servidor con traza y reintento
  await page.route('**/api/programs/PRG-002/milestones', (route) =>
    route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ statusCode: 503, error: 'Service Unavailable', message: 'caído', traceId: '7f3a-c21d' }) }),
  );
  await page.getByRole('tab', { name: 'Resumen' }).click();
  await page.getByRole('tab', { name: 'Hitos' }).click();
  const error = page.getByTestId('milestones-error');
  await expect(error).toContainText('No se pudieron cargar los hitos');
  await expect(error).toContainText('GET /api/programs/PRG-002/milestones → 503');
  await page.unroute('**/api/programs/PRG-002/milestones');
  await page.getByRole('button', { name: 'Reintentar' }).click();
  await expect(table(page)).toHaveAttribute('aria-busy', 'false');

  // un programa sin hitos muestra el estado vacío
  const headers = await authHeaders(request, 'admin', TENANT);
  for (const milestone of await apiList(request, 'PRG-003')) {
    expect((await request.delete(`${API_URL}/milestones/${milestone.id}`, { headers })).status()).toBe(204);
  }
  await openMilestones(page, 'PRG-003');
  await expect(page.getByTestId('milestones-empty')).toHaveText('Este programa todavía no tiene hitos.');
  await expect(count(page)).toHaveText('0 de 0 hitos cumplidos');
});

test('API de hitos: permisos, validación 422, 404 y operaciones válidas con su auditoría', async ({ request }) => {
  const admin = await authHeaders(request, 'admin', TENANT);
  const base = `${API_URL}/milestones`;

  expect((await request.get(`${API_URL}/programs/PRG-004/milestones`, { headers: { 'x-tenant': TENANT } })).status()).toBe(401);
  expect((await request.get(`${API_URL}/programs/PRG-999/milestones`, { headers: admin })).status()).toBe(404);

  // el consultor y el auditor leen pero no escriben (403)
  for (const role of ['consultant', 'auditor'] as RoleName[]) {
    const headers = await authHeaders(request, role, TENANT);
    expect((await request.get(`${API_URL}/programs/PRG-004/milestones`, { headers })).status()).toBe(200);
    expect((await request.patch(`${base}/PRG-004-M01`, { headers, data: { progress: 5 } })).status(), `PATCH como ${role}`).toBe(403);
    expect((await request.post(`${API_URL}/programs/PRG-004/milestones`, { headers, data: { name: 'Prueba', dueDate: '2030-01-01' } })).status()).toBe(403);
    expect((await request.delete(`${base}/PRG-004-M01`, { headers })).status()).toBe(403);
  }

  // validación: claves de los esquemas Zod en `errors`
  const errorsOf = async (response: Awaited<ReturnType<APIRequestContext['patch']>>): Promise<Record<string, string>> => ((await response.json()) as { errors: Record<string, string> }).errors;
  const tooShort = await request.patch(`${base}/PRG-004-M01`, { headers: admin, data: { name: 'x' } });
  expect(tooShort.status()).toBe(422);
  expect((await errorsOf(tooShort)).name).toBe('nameShort');
  expect((await errorsOf(await request.patch(`${base}/PRG-004-M01`, { headers: admin, data: { progress: 101 } }))).progress).toBe('progressInvalid');
  expect((await request.patch(`${base}/PRG-004-M01`, { headers: admin, data: { progress: 12.5 } })).status()).toBe(422);
  expect((await errorsOf(await request.patch(`${base}/PRG-004-M01`, { headers: admin, data: { dueDate: '31/12/2030' } }))).dueDate).toBe('dateInvalid');
  expect((await request.patch(`${base}/PRG-004-M01`, { headers: admin, data: {} })).status()).toBe(422);
  expect((await request.patch(`${base}/PRG-004-M99`, { headers: admin, data: { progress: 5 } })).status()).toBe(404);
  expect((await request.post(`${API_URL}/programs/PRG-004/milestones`, { headers: admin, data: { name: '', dueDate: '' } })).status()).toBe(422);
  expect((await request.delete(`${base}/PRG-004-M99`, { headers: admin })).status()).toBe(404);

  // operaciones válidas (60 → 100 y no un salto desde menos del 50 %)
  const before = await apiList(request, 'PRG-004');
  const created = await request.post(`${API_URL}/programs/PRG-004/milestones`, { headers: admin, data: { name: 'Hito de API', dueDate: '2031-01-15' } });
  expect(created.status()).toBe(201);
  const createdBody = (await created.json()) as MilestoneDto;
  expect(createdBody).toMatchObject({ name: 'Hito de API', dueDate: '2031-01-15', progress: 0, done: false });
  expect(createdBody.id).toMatch(/^PRG-004-M\d{2}$/);
  expect(await apiList(request, 'PRG-004')).toHaveLength(before.length + 1);

  expect(((await (await request.patch(`${base}/${createdBody.id}`, { headers: admin, data: { progress: 60 } })).json()) as MilestoneDto).done).toBe(false);
  const complete = (await (await request.patch(`${base}/${createdBody.id}`, { headers: admin, data: { progress: 100 } })).json()) as MilestoneDto;
  expect(complete).toMatchObject({ progress: 100, done: true });
  const reopened = (await (await request.patch(`${base}/${createdBody.id}`, { headers: admin, data: { progress: 95, name: 'Hito renombrado' } })).json()) as MilestoneDto;
  expect(reopened).toMatchObject({ progress: 95, done: false, name: 'Hito renombrado' });

  // el avance del programa sale de los hitos cumplidos
  const programBody = (await (await request.get(`${API_URL}/programs/PRG-004`, { headers: admin })).json()) as { milestonesDone: number; milestonesTotal: number };
  const list = await apiList(request, 'PRG-004');
  expect(programBody.milestonesTotal).toBe(list.length);
  expect(programBody.milestonesDone).toBe(list.filter((milestone) => milestone.done).length);

  expect((await request.delete(`${base}/${createdBody.id}`, { headers: admin })).status()).toBe(204);
  expect(await apiList(request, 'PRG-004')).toHaveLength(before.length);

  // cada cambio efectivo escribe su evento de auditoría
  const audit = (await (await request.get(`${API_URL}/audit?entity=milestone&limit=100`, { headers: admin })).json()) as { items: { action: string; entityId: string }[] };
  const actions = audit.items.filter((event) => event.entityId === createdBody.id).map((event) => event.action);
  expect(actions.sort()).toEqual(['milestone.created', 'milestone.deleted', 'milestone.updated', 'milestone.updated', 'milestone.updated']);
});
