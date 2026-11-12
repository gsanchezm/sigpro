import { expect, test, type APIRequestContext, type Page, type Route } from '@playwright/test';
import { chaosOff } from '../../support/admin';
import { API_URL, loginByApi, openAs, resetTenant, type RoleName } from '../../support/auth';

// No conformidades en el móvil (paridad funcional con la web): alta («Nueva no conformidad»: programa, severidad y
// descripción) y edición desde el detalle (severidad, descripción y asignación, solo con el permiso `nc.edit`). Mismos
// textos, ids y reglas que `nc.spec.ts` de la web, adaptados a hojas y radios (React Native no tiene `listbox`).
// Cada prueba parte del seed (`resetTenant` antes de cada una). Tenant propio (alumno24). Locators por rol y nombre
// primero; el `testID` (que React Native Web pinta como `data-testid`) como respaldo.
//
// Seed: NC-001 abierta (menor, Javier Ortega) · NC-005 rechazada sin asignar · NC-012 abierta (crítica, Marta Ruiz).
// Abiertas = Abierta + En análisis + Acción correctiva: 8 de 12.

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

const open = async (page: Page, role: RoleName = 'admin', path = '/nc') => {
  await openAs(page, role, path, { tenant: TENANT });
  await expect(page.getByTestId('nc-board')).toHaveAttribute('aria-busy', 'false');
};
const dialog = (page: Page, name: string) => page.getByRole('dialog', { name, exact: true });
const card = (page: Page, code: string) => page.getByTestId(`nc-card-${code}`);
const toast = (page: Page, tone: 'ok' | 'danger', text: string) => page.getByTestId(`toast-${tone}`).filter({ hasText: text });
const noHorizontalOverflow = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);

/** La NC leída por API (con el Bearer del admin): lo que quedó guardado de verdad. */
const stored = async (request: APIRequestContext, code: string): Promise<Record<string, unknown>> => {
  const { accessToken } = await loginByApi(request, 'admin', TENANT);
  const response = await request.get(`${API_URL}/nc/${code}`, { headers: { Authorization: `Bearer ${accessToken}`, 'x-tenant': TENANT } });
  return (await response.json()) as Record<string, unknown>;
};

/** Las rutas de la API que se interceptan (`unroute` necesita la misma función con la que se registraron). */
const NC_BASE = (url: URL) => url.pathname === '/api/nc';
const NC_012 = (url: URL) => url.pathname === '/api/nc/NC-012';
const PROGRAMS = (url: URL) => url.pathname === '/api/programs';

const failWith = (status: number, error: string, body: Record<string, unknown> = {}) => (route: Route) =>
  route.fulfill({ status, contentType: 'application/json', body: JSON.stringify({ statusCode: status, error, message: error.toLowerCase(), ...body }) });

/** Cuerpo del PATCH que envía el móvil al guardar (solo los campos que cambiaron). */
const patchBody = (page: Page) => page.waitForRequest((request) => request.method() === 'PATCH' && request.url().includes('/api/nc/')).then((request) => request.postDataJSON() as unknown);

const severity = (scope: ReturnType<typeof dialog>) => scope.getByRole('radiogroup', { name: 'Selector de severidad' });
const editButton = (page: Page) => dialog(page, 'Detalle de NC-012').getByRole('button', { name: 'Editar', exact: true });

/** Abre el detalle de una NC desde su tarjeta y entra en el formulario de edición. */
const edit = async (page: Page, code: string) => {
  await page.getByTestId(`nc-card-open-${code}`).click();
  const sheet = dialog(page, `Detalle de ${code}`);
  await sheet.getByRole('button', { name: 'Editar', exact: true }).click();
  await expect(sheet.getByTestId('nc-edit-form')).toBeVisible();
  return sheet;
};

test.describe('Móvil · no conformidades: alta', () => {
  test('cualquier rol puede abrir una NC: el auditor ve «Nueva no conformidad» habilitado y sin motivo de bloqueo', async ({ page }) => {
    await open(page, 'auditor');
    const button = page.getByRole('button', { name: 'Nueva no conformidad', exact: true });
    await expect(button).toBeEnabled();
    await expect(page.getByTestId('nc-new-reason')).toHaveCount(0);
    await button.click();
    await expect(dialog(page, 'Nueva no conformidad')).toBeVisible();
    await dialog(page, 'Nueva no conformidad').getByRole('button', { name: 'Cancelar', exact: true }).click();
    await expect(dialog(page, 'Nueva no conformidad')).toBeHidden();
  });

  test('la validación del cliente señala los tres campos; un alta válida aparece en «Abierta» sin asignar y queda guardada', async ({ page, request }) => {
    await open(page, 'consultant');
    await expect(page.getByTestId('nc-count')).toHaveText('12 no conformidades · 8 abiertas');
    await page.getByRole('button', { name: 'Nueva no conformidad', exact: true }).click();
    const form = dialog(page, 'Nueva no conformidad');
    await expect(form).toBeVisible();

    await form.getByRole('button', { name: 'Abrir no conformidad', exact: true }).click();
    await expect(form.getByTestId('nc-new-program-error')).toHaveText('Elige un programa');
    await expect(form.getByTestId('nc-new-severity-error')).toHaveText('Elige una severidad');
    await expect(form.getByTestId('nc-new-description-error')).toHaveText('La descripción debe tener al menos 10 caracteres');
    await expect(severity(form).getByRole('radio', { checked: true })).toHaveCount(0); // sin valor inicial, como la web
    await expect(page.getByTestId('nc-count')).toHaveText('12 no conformidades · 8 abiertas'); // nada se envió

    // El aviso de cada campo desaparece al corregirlo
    await form.getByRole('combobox', { name: 'Programa', exact: true }).click();
    const programs = dialog(page, 'Programa');
    await expect(programs.getByRole('radio')).toHaveCount(25); // «Elige un programa» + los 24 programas del seed
    await programs.getByRole('radio', { name: /^PRG-002 · / }).click();
    await expect(form.getByTestId('nc-new-program-error')).toBeHidden();
    await expect(form.getByRole('combobox', { name: 'Programa', exact: true })).toContainText('PRG-002 · ');

    await expect(severity(form).getByRole('radio')).toHaveText(['Menor', 'Mayor', 'Crítica']);
    await severity(form).getByRole('radio', { name: 'Crítica' }).click();
    await expect(severity(form).getByRole('radio', { name: 'Crítica' })).toHaveAttribute('aria-checked', 'true');
    await expect(severity(form).getByRole('radio', { name: 'Mayor' })).toHaveAttribute('aria-checked', 'false');
    await expect(severity(form).getByTestId('severity-picker-option-critical')).toHaveAttribute('data-severity', 'critical');
    await expect(form.getByTestId('nc-new-severity-error')).toBeHidden();

    await form.getByLabel('Descripción', { exact: true }).fill('Fallo rot'); // 9 caracteres: el mínimo es 10
    await form.getByRole('button', { name: 'Abrir no conformidad', exact: true }).click();
    await expect(form.getByTestId('nc-new-description-error')).toHaveText('La descripción debe tener al menos 10 caracteres');
    expect(await noHorizontalOverflow(page)).toBe(true);

    await form.getByLabel('Descripción', { exact: true }).fill('Fallo intermitente del enlace de datos');
    await form.getByRole('button', { name: 'Abrir no conformidad', exact: true }).click();

    await expect(toast(page, 'ok', 'NC-013 abierta')).toBeVisible();
    await expect(form).toBeHidden();
    await expect(page.getByRole('region', { name: /Abierta/ }).getByTestId('nc-card-NC-013')).toBeAttached();
    await expect(card(page, 'NC-013')).toHaveAttribute('data-severity', 'critical');
    await expect(card(page, 'NC-013')).toHaveAttribute('data-state', 'open');
    await expect(page.getByTestId('nc-card-assignee-NC-013')).toHaveText('Sin asignar');
    await expect(page.getByTestId('nc-count')).toHaveText('13 no conformidades · 9 abiertas');
    await expect(page.getByTestId('nc-column-count-open')).toHaveText('5');

    const created = await stored(request, 'NC-013');
    expect(created).toMatchObject({ programCode: 'PRG-002', severity: 'critical', state: 'open', assigneeId: null, description: '<p>Fallo intermitente del enlace de datos</p>' });
  });

  test('cada línea de la descripción es un párrafo y el texto se escapa', async ({ page, request }) => {
    await open(page, 'admin');
    await page.getByRole('button', { name: 'Nueva no conformidad', exact: true }).click();
    const form = dialog(page, 'Nueva no conformidad');
    await form.getByRole('combobox', { name: 'Programa', exact: true }).click();
    await dialog(page, 'Programa').getByRole('radio', { name: /^PRG-001 · / }).click();
    await severity(form).getByRole('radio', { name: 'Menor' }).click();
    await form.getByLabel('Descripción', { exact: true }).fill('Primera línea del fallo\n\nSegunda línea con <b> & signos');
    await form.getByRole('button', { name: 'Abrir no conformidad', exact: true }).click();
    await expect(toast(page, 'ok', 'NC-013 abierta')).toBeVisible();
    expect((await stored(request, 'NC-013')).description).toBe('<p>Primera línea del fallo</p><p>Segunda línea con &lt;b&gt; &amp; signos</p>');
  });

  test('errores del servidor: un 422 se pinta bajo su campo y arriba; un 503 muestra la traza; el diálogo queda abierto y Cancelar no crea nada', async ({ page }) => {
    await open(page, 'admin');
    await page.getByRole('button', { name: 'Nueva no conformidad', exact: true }).click();
    const form = dialog(page, 'Nueva no conformidad');
    await form.getByRole('combobox', { name: 'Programa', exact: true }).click();
    await dialog(page, 'Programa').getByRole('radio', { name: /^PRG-003 · / }).click();
    await severity(form).getByRole('radio', { name: 'Mayor' }).click();
    await form.getByLabel('Descripción', { exact: true }).fill('Descripción lo bastante larga para el cliente');

    const create = (handler: (route: Route) => Promise<void>) =>
      page.route(NC_BASE, (route) => (route.request().method() === 'POST' ? handler(route) : route.fallback()));
    await create(failWith(422, 'Unprocessable Entity', { errors: { programCode: 'programRequired' } }));
    await form.getByRole('button', { name: 'Abrir no conformidad', exact: true }).click();
    await expect(form.getByTestId('nc-new-program-error')).toHaveText('Elige un programa');
    await expect(form.getByTestId('nc-new-server-error')).toHaveText('Elige un programa');
    await page.unroute(NC_BASE);

    await create(failWith(503, 'Service Unavailable', { traceId: '7f3a-c21d' }));
    await form.getByRole('button', { name: 'Abrir no conformidad', exact: true }).click();
    await expect(form.getByTestId('nc-new-server-error')).toHaveText('POST /api/nc → 503 Service Unavailable · trace 7f3a-c21d');
    await expect(form).toBeVisible();
    await page.unroute(NC_BASE);

    await form.getByRole('button', { name: 'Cancelar', exact: true }).click();
    await expect(form).toBeHidden();
    await expect(page.getByTestId('nc-count')).toHaveText('12 no conformidades · 8 abiertas');
  });

  test('si los programas no cargan, el diálogo lo dice con la traza y reintenta; con ellos, se puede crear', async ({ page }) => {
    await open(page, 'admin');
    await page.route(PROGRAMS, failWith(503, 'Service Unavailable', { traceId: '7f3a-c21d' }));
    await page.getByRole('button', { name: 'Nueva no conformidad', exact: true }).click();
    const form = dialog(page, 'Nueva no conformidad');
    await expect(form.getByTestId('nc-new-programs-status')).toContainText('No se pudieron cargar los programas');
    await expect(form.getByTestId('nc-new-programs-status')).toContainText('→ 503 Service Unavailable · trace 7f3a-c21d');
    await page.unroute(PROGRAMS);
    await form.getByRole('button', { name: 'Reintentar', exact: true }).click();
    await expect(form.getByTestId('nc-new-programs-status')).toBeHidden();
    await form.getByRole('combobox', { name: 'Programa', exact: true }).click();
    await expect(dialog(page, 'Programa').getByRole('radio')).toHaveCount(25);
  });
});

test.describe('Móvil · no conformidades: edición', () => {
  test('severidad: el selector parte de la actual, «Guardar» espera un cambio y solo viaja la severidad (la descripción no se reenvía)', async ({ page, request }) => {
    await open(page, 'admin');
    const sheet = await edit(page, 'NC-012');
    await expect(sheet.getByTestId('nc-state-badge')).toHaveAttribute('data-state', 'open');
    const picker = severity(sheet);
    await expect(picker).toBeVisible();
    await expect(picker.getByRole('radio')).toHaveText(['Menor', 'Mayor', 'Crítica']);
    await expect(picker.getByRole('radio', { name: 'Crítica' })).toHaveAttribute('aria-checked', 'true');
    await expect(sheet.getByTestId('nc-severity-picker')).toBeVisible();

    // Sin cambios, «Guardar» y «Guardar y cerrar» están deshabilitados con su motivo visible
    const save = sheet.getByRole('button', { name: 'Guardar', exact: true });
    await expect(save).toBeDisabled();
    await expect(save).toHaveAttribute('data-reason', 'No hay cambios que guardar');
    await expect(sheet.getByRole('button', { name: 'Guardar y cerrar', exact: true })).toBeDisabled();
    await expect(sheet.getByText('No hay cambios que guardar', { exact: true })).toBeVisible();

    await picker.getByRole('radio', { name: 'Mayor' }).click();
    await expect(picker.getByRole('radio', { name: 'Mayor' })).toHaveAttribute('aria-checked', 'true');
    await expect(picker.getByRole('radio', { name: 'Crítica' })).toHaveAttribute('aria-checked', 'false');
    await expect(save).toBeEnabled();
    const body = patchBody(page);
    await save.click();
    expect(await body).toEqual({ severity: 'major' });

    await expect(toast(page, 'ok', 'NC-012 guardada')).toBeVisible();
    // Vuelve a la lectura con lo que dice el servidor; la tarjeta del tablero se actualiza sin cerrar la hoja
    await expect(sheet.getByTestId('nc-edit-form')).toBeHidden();
    await expect(sheet.getByTestId('nc-severity-badge')).toHaveText('Mayor');
    await expect(sheet.getByTestId('nc-severity-badge')).toHaveAttribute('data-severity', 'major');
    await expect(card(page, 'NC-012')).toHaveAttribute('data-severity', 'major');
    await expect(page.getByTestId('nc-card-severity-NC-012')).toHaveText('Mayor');
    expect((await stored(request, 'NC-012')).severity).toBe('major');

    // «Guardar y cerrar» guarda y cierra la hoja
    await sheet.getByRole('button', { name: 'Editar', exact: true }).click();
    await severity(sheet).getByRole('radio', { name: 'Menor' }).click();
    await sheet.getByRole('button', { name: 'Guardar y cerrar', exact: true }).click();
    await expect(sheet).toBeHidden();
    await expect(card(page, 'NC-012')).toHaveAttribute('data-severity', 'minor');

    await page.reload();
    await expect(page.getByTestId('nc-card-severity-NC-012')).toHaveText('Menor');
  });

  test('descripción: texto plano de la actual, error de longitud sin enviar nada y guardado con párrafos', async ({ page, request }) => {
    await open(page, 'admin');
    const requests: string[] = [];
    page.on('request', (candidate) => candidate.method() === 'PATCH' && requests.push(candidate.url()));
    const sheet = await edit(page, 'NC-012');
    const description = sheet.getByLabel('Descripción', { exact: true });
    await expect(description).toHaveValue('Desviación detectada en la ejecución 012: el resultado no cumple el criterio de aceptación.');
    await expect(description).toHaveAttribute('placeholder', 'Describe la desviación detectada…');

    await description.fill('corta');
    await sheet.getByRole('button', { name: 'Guardar', exact: true }).click();
    await expect(sheet.getByTestId('nc-description-error')).toHaveText('La descripción debe tener al menos 10 caracteres');
    expect(requests).toHaveLength(0); // el cliente no envió nada

    await description.fill('Fallo del enlace seguro\nSe repite al reiniciar el equipo');
    await expect(sheet.getByTestId('nc-description-error')).toBeHidden(); // desaparece al corregir
    const body = patchBody(page);
    await sheet.getByRole('button', { name: 'Guardar', exact: true }).click();
    expect(await body).toEqual({ description: '<p>Fallo del enlace seguro</p><p>Se repite al reiniciar el equipo</p>' });
    await expect(toast(page, 'ok', 'NC-012 guardada')).toBeVisible();
    await expect(sheet.getByTestId('nc-description')).toHaveText('Fallo del enlace seguro Se repite al reiniciar el equipo');
    await expect(page.getByTestId('nc-card-summary-NC-012')).toHaveText('Fallo del enlace seguro Se repite al reiniciar el equipo');
    expect((await stored(request, 'NC-012')).description).toBe('<p>Fallo del enlace seguro</p><p>Se repite al reiniciar el equipo</p>');
  });

  test('asignación: buscar y elegir a una persona, cambiarla y quitarla con «Quitar asignación»', async ({ page }) => {
    await open(page, 'admin');
    const sheet = await edit(page, 'NC-005');
    const field = sheet.getByRole('combobox', { name: 'Asignada a', exact: true });
    await expect(field).toContainText('Sin asignar');
    await expect(sheet.getByRole('button', { name: 'Quitar asignación', exact: true })).toHaveCount(0);

    await field.click();
    const people = dialog(page, 'Asignada a');
    await people.getByLabel('Buscar persona', { exact: true }).fill('ja');
    await expect(people.getByRole('radio')).toHaveCount(1); // el texto lleva también las iniciales del avatar: se mira el nombre accesible
    await expect(people.getByRole('radio', { name: 'Javier Ortega', exact: true })).toBeVisible();
    await people.getByRole('radio', { name: 'Javier Ortega' }).click();
    await expect(people).toBeHidden();
    await expect(field).toContainText('Javier Ortega');
    const first = patchBody(page);
    await sheet.getByRole('button', { name: 'Guardar', exact: true }).click();
    expect(await first).toEqual({ assigneeId: 'u2' });
    await expect(toast(page, 'ok', 'NC-005 guardada')).toBeVisible();
    await expect(sheet.getByTestId('nc-assignee')).toHaveText('Javier Ortega');
    await expect(page.getByTestId('nc-card-assignee-NC-005').getByRole('img', { name: 'Javier Ortega' })).toBeVisible();

    // Cambiar a otra persona
    await sheet.getByRole('button', { name: 'Editar', exact: true }).click();
    await sheet.getByRole('combobox', { name: 'Asignada a', exact: true }).click();
    await people.getByLabel('Buscar persona', { exact: true }).fill('luc');
    await people.getByRole('radio', { name: 'Lucía Fernández' }).click();
    await sheet.getByRole('button', { name: 'Guardar', exact: true }).click();
    await expect(page.getByTestId('nc-card-assignee-NC-005').getByRole('img', { name: 'Lucía Fernández' })).toBeVisible();

    // Quitar la asignación; el buscador de una lista sin nadie elegido dice «Sin coincidencias» (la elegida siempre se muestra)
    await sheet.getByRole('button', { name: 'Editar', exact: true }).click();
    await sheet.getByRole('button', { name: 'Quitar asignación', exact: true }).click();
    await expect(sheet.getByRole('combobox', { name: 'Asignada a', exact: true })).toContainText('Sin asignar');
    await expect(sheet.getByRole('button', { name: 'Quitar asignación', exact: true })).toHaveCount(0);
    await sheet.getByRole('combobox', { name: 'Asignada a', exact: true }).click();
    await people.getByLabel('Buscar persona', { exact: true }).fill('zzz');
    await expect(people.getByTestId('nc-assignee-list')).toContainText('Sin coincidencias');
    await people.getByRole('button', { name: 'Cerrar', exact: true }).click();
    await expect(people).toBeHidden();
    const removed = patchBody(page);
    await sheet.getByRole('button', { name: 'Guardar y cerrar', exact: true }).click();
    expect(await removed).toEqual({ assigneeId: null });
    await expect(sheet).toBeHidden();
    await expect(page.getByTestId('nc-card-assignee-NC-005')).toHaveText('Sin asignar');
    await expect(page.getByTestId('nc-card-assignee-NC-005').getByRole('img')).toHaveCount(0);
  });

  test('Cancelar descarta los cambios y la hoja vuelve a la lectura', async ({ page }) => {
    await open(page, 'admin');
    const sheet = await edit(page, 'NC-012');
    await severity(sheet).getByRole('radio', { name: 'Menor' }).click();
    await sheet.getByLabel('Descripción', { exact: true }).fill('Este texto no se guarda nunca');
    await sheet.getByRole('button', { name: 'Cancelar', exact: true }).click();
    await expect(sheet.getByTestId('nc-edit-form')).toBeHidden();
    await expect(sheet.getByTestId('nc-severity-badge')).toHaveAttribute('data-severity', 'critical');
    await expect(sheet.getByTestId('nc-description')).toContainText('Desviación detectada en la ejecución 012');
    await sheet.getByRole('button', { name: 'Editar', exact: true }).click();
    await expect(severity(sheet).getByRole('radio', { name: 'Crítica' })).toHaveAttribute('aria-checked', 'true');
    await expect(sheet.getByLabel('Descripción', { exact: true })).toHaveValue(/^Desviación detectada/);
  });

  test('permisos: el auditor lee y comenta pero «Editar» queda deshabilitado con su motivo; el consultor y el gestor sí editan', async ({ page }) => {
    await open(page, 'auditor');
    await page.getByTestId('nc-card-open-NC-012').click();
    const sheet = dialog(page, 'Detalle de NC-012');
    const button = sheet.getByRole('button', { name: 'Editar', exact: true });
    await expect(button).toBeDisabled();
    await expect(button).toHaveAttribute('data-reason', 'Tu rol puede leer y comentar, pero no modificar esta no conformidad.');
    await expect(sheet.getByTestId('nc-detail-denied')).toHaveText('Tu rol puede leer y comentar, pero no modificar esta no conformidad.');
    await expect(sheet.getByLabel('Añadir comentario')).toBeVisible(); // comentar sigue permitido

    await open(page, 'consultant');
    await page.getByTestId('nc-card-open-NC-012').click();
    await expect(editButton(page)).toBeEnabled();
    await expect(dialog(page, 'Detalle de NC-012').getByTestId('nc-detail-denied')).toHaveCount(0);
    await editButton(page).click();
    await severity(dialog(page, 'Detalle de NC-012')).getByRole('radio', { name: 'Mayor' }).click();
    await dialog(page, 'Detalle de NC-012').getByRole('button', { name: 'Guardar', exact: true }).click();
    await expect(toast(page, 'ok', 'NC-012 guardada')).toBeVisible();
    await expect(card(page, 'NC-012')).toHaveAttribute('data-severity', 'major');

    await open(page, 'program_manager');
    await page.getByTestId('nc-card-open-NC-001').click();
    await expect(dialog(page, 'Detalle de NC-001').getByRole('button', { name: 'Editar', exact: true })).toBeEnabled();
  });

  test('errores del servidor al guardar: un 403 muestra la traza y un 422 se pinta bajo su campo; el formulario queda abierto', async ({ page }) => {
    await open(page, 'admin');
    const sheet = await edit(page, 'NC-012');
    await severity(sheet).getByRole('radio', { name: 'Menor' }).click();

    const patch = (handler: (route: Route) => Promise<void>) =>
      page.route(NC_012, (route) => (route.request().method() === 'PATCH' ? handler(route) : route.fallback()));
    await patch(failWith(403, 'Forbidden', { traceId: '9c1e-42aa' }));
    await sheet.getByRole('button', { name: 'Guardar', exact: true }).click();
    await expect(sheet.getByTestId('nc-server-error')).toHaveText('PATCH /api/nc/NC-012 → 403 Forbidden · trace 9c1e-42aa');
    await expect(sheet.getByTestId('nc-edit-form')).toBeVisible();
    await page.unroute(NC_012);

    await patch(failWith(422, 'Unprocessable Entity', { errors: { assigneeId: 'badAssignee' } }));
    await sheet.getByRole('button', { name: 'Guardar', exact: true }).click();
    await expect(sheet.getByTestId('nc-assignee-error')).toHaveText('La persona elegida no existe');
    await expect(sheet.getByTestId('nc-server-error')).toHaveText('La persona elegida no existe');
    await page.unroute(NC_012);

    // Sin el fallo, el mismo formulario guarda y los errores desaparecen
    await sheet.getByRole('button', { name: 'Guardar', exact: true }).click();
    await expect(toast(page, 'ok', 'NC-012 guardada')).toBeVisible();
    await expect(sheet.getByTestId('nc-server-error')).toHaveCount(0);
  });

  test('en 390 px el formulario no desborda y los controles miden al menos 44 px', async ({ page }) => {
    await open(page, 'admin');
    const sheet = await edit(page, 'NC-012');
    expect(await noHorizontalOverflow(page)).toBe(true);
    for (const name of ['Menor', 'Mayor', 'Crítica']) {
      const box = await severity(sheet).getByRole('radio', { name }).boundingBox();
      expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
    }
    for (const name of ['Cancelar', 'Guardar y cerrar', 'Guardar']) {
      const box = await sheet.getByRole('button', { name, exact: true }).boundingBox();
      expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
    }
  });
});
