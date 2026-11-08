import { expect, test, type Page } from '@playwright/test';
import { API_URL, openAs, resetTenant } from '../support/auth';
import { authHeaders, chaosOff, readConfig } from '../support/admin';

// Spec de humo de Administración (fase 3): permisos, usuarios (select de rol y switch de activo), pestañas con teclado,
// auditoría con rango de fechas, modo caos (sliders, textos alternos, errores 500) y reinicio con confirm() nativo.
// Tenant propio: alumno04 (restaurado y con el caos apagado antes y después: el caos sobrevive al reset).

const TENANT = 'alumno04';
test.describe.configure({ mode: 'serial' });

test.beforeAll(async ({ request }) => {
  await resetTenant(request, TENANT);
  await chaosOff(request, TENANT);
});

test.afterAll(async ({ request }) => {
  await chaosOff(request, TENANT);
  await resetTenant(request, TENANT);
});

const tab = (page: Page, name: string) => page.getByRole('tab', { name });
const userRow = (page: Page, name: string) => page.getByRole('row').filter({ hasText: name });

test('permisos: solo admin ve Administración (menú, ruta y pestañas)', async ({ page }) => {
  for (const role of ['consultant', 'program_manager', 'auditor'] as const) {
    await openAs(page, role, '/programs', { tenant: TENANT });
    await expect(page.getByRole('complementary', { name: 'Navegación principal' }).getByRole('link', { name: 'Administración' })).toHaveCount(0);
    await page.goto('/admin');
    const forbidden = page.getByTestId('admin-forbidden');
    await expect(forbidden).toContainText('Tu rol no permite administrar el tenant');
    await expect(forbidden).toContainText('Solo admin puede entrar en Administración.');
    await expect(page.getByRole('tablist')).toHaveCount(0);
  }

  await openAs(page, 'admin', '/programs', { tenant: TENANT });
  await page.getByRole('complementary', { name: 'Navegación principal' }).getByRole('link', { name: 'Administración' }).click();
  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Administración' })).toBeVisible();
  await expect(page.getByRole('tab')).toHaveText(['Usuarios', 'Auditoría', 'Modo caos', 'Datos']);
  await expect(tab(page, 'Usuarios')).toHaveAttribute('aria-selected', 'true');
});

test('pestañas: flechas, Inicio y Fin cambian de panel y la URL guarda la pestaña', async ({ page }) => {
  await openAs(page, 'admin', '/admin', { tenant: TENANT });
  await expect(page.getByRole('tabpanel', { name: 'Usuarios' })).toBeVisible();

  await tab(page, 'Usuarios').focus();
  await page.keyboard.press('ArrowRight');
  await expect(tab(page, 'Auditoría')).toBeFocused();
  await expect(tab(page, 'Auditoría')).toHaveAttribute('aria-selected', 'true');
  await expect(page).toHaveURL(/tab=audit/);
  await expect(page.getByRole('tabpanel', { name: 'Auditoría' })).toBeVisible();
  await expect(page.getByRole('heading', { level: 2, name: 'Registro de auditoría' })).toBeVisible();

  await page.keyboard.press('End');
  await expect(tab(page, 'Datos')).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('button', { name: 'Restaurar datos del tenant' })).toBeVisible();
  await page.keyboard.press('ArrowRight'); // da la vuelta
  await expect(tab(page, 'Usuarios')).toHaveAttribute('aria-selected', 'true');
  await page.keyboard.press('ArrowLeft');
  await expect(tab(page, 'Datos')).toHaveAttribute('aria-selected', 'true');
  await page.keyboard.press('Home');
  await expect(tab(page, 'Usuarios')).toHaveAttribute('aria-selected', 'true');
  await expect(page).not.toHaveURL(/tab=/);
});

test('usuarios: tabla ARIA, búsqueda, estados y filter({ has })', async ({ page }) => {
  await openAs(page, 'admin', '/admin', { tenant: TENANT });
  const table = page.getByRole('table');
  await expect(table).toHaveAttribute('aria-busy', 'false');
  await expect(page.getByRole('columnheader')).toHaveText(['Usuario', 'Correo', 'Rol', 'Activo', 'Estado']);
  await expect(page.getByTestId('admin-users-count')).toHaveText('7 de 7 usuarios');
  // 1 fila de cabecera + 7 usuarios (6 del handoff + el admin del alumno)
  await expect(page.getByRole('row')).toHaveCount(8);

  // filter({ has }): filas cuyo badge de estado es «Bloqueado» o «Pendiente»
  const locked = page.getByRole('row').filter({ has: page.locator('[data-state="locked"]') });
  await expect(locked).toHaveCount(1);
  await expect(locked).toContainText('Carmen Vidal');
  await expect(page.getByRole('row').filter({ has: page.locator('[data-state="pending"]') })).toContainText('Pablo Serrano');
  await expect(page.getByRole('row').filter({ has: page.getByText('Normal', { exact: true }) })).toHaveCount(5);

  // avatar con alt en cada fila y marca «tú» en la propia
  await expect(userRow(page, 'Marta Ruiz').getByAltText('Marta Ruiz')).toBeVisible();
  await expect(userRow(page, 'Marta Ruiz')).toContainText('tú');

  // búsqueda por nombre y por correo
  const search = page.getByRole('searchbox', { name: 'Buscar usuarios' });
  await search.fill('molina');
  await expect(page.getByTestId('admin-users-count')).toHaveText('1 de 7 usuarios');
  await expect(page.getByRole('row')).toHaveCount(2);
  await search.fill('@sigpro.lab');
  await expect(page.getByRole('row').nth(1)).toContainText('Alumno 04');
  await search.fill('nadie-se-llama-asi');
  await expect(page.getByTestId('admin-users-empty')).toHaveText('Ningún usuario coincide con la búsqueda.');
  await search.fill('');
  await expect(page.getByTestId('admin-users-count')).toHaveText('7 de 7 usuarios');
});

test('usuarios: el rol (select) y el interruptor de activo persisten; tu propia cuenta queda protegida', async ({ page }) => {
  await openAs(page, 'admin', '/admin', { tenant: TENANT });
  const toastOk = page.getByTestId('toast-ok');

  // tu propia fila: controles deshabilitados con el motivo en title
  const ownRole = page.getByLabel('Rol de Marta Ruiz');
  await expect(ownRole).toBeDisabled();
  await expect(ownRole).toHaveAttribute('title', 'No puedes modificar tu propia cuenta');
  await expect(page.getByRole('switch', { name: 'Activo: Marta Ruiz' })).toBeDisabled();
  await expect(page.getByRole('switch', { name: 'Activo: Marta Ruiz' })).toHaveAttribute('title', 'No puedes modificar tu propia cuenta');

  // rol: selectOption por valor y por etiqueta
  const roleOfAndres = page.getByLabel('Rol de Andrés Molina');
  await expect(roleOfAndres).toHaveValue('auditor');
  await expect(roleOfAndres.locator('option')).toHaveText(['Admin', 'Gestor de programas', 'Consultor', 'Auditor']);
  await roleOfAndres.selectOption('consultant');
  await expect(toastOk).toContainText('Usuario actualizado');
  await expect(toastOk).toContainText('Andrés Molina: rol = Consultor');
  await expect(userRow(page, 'Andrés Molina')).toHaveAttribute('data-role', 'consultant');
  await roleOfAndres.selectOption({ label: 'Gestor de programas' });
  await expect(roleOfAndres).toHaveValue('program_manager');

  // activo: el switch cambia aria-checked, el badge de estado y persiste tras recargar
  const active = page.getByRole('switch', { name: 'Activo: Andrés Molina' });
  await expect(active).toHaveAttribute('aria-checked', 'true');
  await active.click();
  await expect(active).toHaveAttribute('aria-checked', 'false');
  await expect(userRow(page, 'Andrés Molina').getByTestId('admin-user-status-u4')).toHaveText('Desactivado');
  await expect(userRow(page, 'Andrés Molina').getByTestId('admin-user-status-u4')).toHaveAttribute('data-state', 'inactive');

  await page.reload();
  await expect(page.getByLabel('Rol de Andrés Molina')).toHaveValue('program_manager');
  await expect(page.getByRole('switch', { name: 'Activo: Andrés Molina' })).toHaveAttribute('aria-checked', 'false');

  // con el teclado: Espacio vuelve a activarlo
  await page.getByRole('switch', { name: 'Activo: Andrés Molina' }).focus();
  await page.keyboard.press('Space');
  await expect(page.getByRole('switch', { name: 'Activo: Andrés Molina' })).toHaveAttribute('aria-checked', 'true');
  await expect(userRow(page, 'Andrés Molina').getByTestId('admin-user-status-u4')).toHaveText('Normal');
});

test('usuarios: error de carga con reintento y reversión si la API rechaza el cambio', async ({ page }) => {
  await openAs(page, 'admin', '/programs', { tenant: TENANT });
  const failing = { status: 503, contentType: 'application/json', body: JSON.stringify({ statusCode: 503, error: 'Service Unavailable', message: 'caído' }) };
  await page.route('**/api/admin/users', (route) => route.fulfill(failing));
  await page.goto('/admin');
  const error = page.getByTestId('admin-users-error');
  await expect(error).toContainText('No se pudieron cargar los usuarios');
  await expect(error).toContainText('GET /api/admin/users → 503');
  await page.unroute('**/api/admin/users');
  await page.getByRole('button', { name: 'Reintentar' }).click();
  await expect(page.getByRole('table')).toHaveAttribute('aria-busy', 'false');

  // PATCH rechazado: el select vuelve a su valor y aparece el toast de error
  await page.route('**/api/admin/users/u3', (route) => (route.request().method() === 'PATCH' ? route.fulfill({ ...failing, status: 500 }) : route.fallback()));
  const role = page.getByLabel('Rol de Lucía Fernández');
  await expect(role).toHaveValue('consultant');
  await role.selectOption('auditor');
  await expect(page.getByTestId('toast-danger')).toContainText('No se pudo guardar el cambio');
  await expect(role).toHaveValue('consultant');
  await expect(userRow(page, 'Lucía Fernández')).toHaveAttribute('data-role', 'consultant');
});

test('auditoría: filtro por rango de fechas (Desde–Hasta) y limpieza de filtros', async ({ page, request }) => {
  const headers = await authHeaders(request, 'admin', TENANT);
  const total = async (query: string): Promise<number> => ((await (await request.get(`${API_URL}/audit${query}`, { headers })).json()) as { total: number }).total;
  // El seed cuenta 130 eventos en enero de 2026; las pruebas anteriores añadieron user.updated hoy
  const day = '2026-01-06';
  const expectedDay = await total(`?from=${day}&to=${day}&limit=1`);
  const expectedAll = await total('?limit=1');
  expect(expectedDay).toBeGreaterThan(0);
  expect(expectedAll).toBeGreaterThan(130);

  await openAs(page, 'admin', '/admin?tab=audit', { tenant: TENANT });
  const count = page.getByTestId('audit-count');
  await expect(count).toHaveText(`Mostrando 20 de ${expectedAll} eventos`);

  await page.getByLabel('Desde').fill(day);
  await page.getByLabel('Hasta').fill(day);
  await expect(page.getByLabel('Desde')).toHaveAttribute('max', day);
  await expect(page.getByLabel('Hasta')).toHaveAttribute('min', day);
  await expect(count).toHaveText(`Mostrando ${expectedDay} de ${expectedDay} eventos`);
  const times = await page.getByRole('feed').locator('time').evaluateAll((nodes) => nodes.map((node) => (node.getAttribute('datetime') ?? '').slice(0, 10)));
  expect(times).toHaveLength(expectedDay);
  expect(times.every((value) => value === day)).toBe(true);

  // un rango sin eventos muestra el estado vacío; «Limpiar filtros» vuelve a todo
  await page.getByLabel('Desde').fill('2030-01-01');
  await page.getByLabel('Hasta').fill('2030-01-31');
  await expect(page.getByTestId('audit-empty')).toContainText('Ningún evento coincide con los filtros aplicados.');
  await page.getByRole('button', { name: 'Limpiar filtros' }).click();
  await expect(count).toHaveText(`Mostrando 20 de ${expectedAll} eventos`);
  await expect(page.getByTestId('audit-filters-clear')).toHaveCount(0);

  // los cambios de usuario de las pruebas anteriores están en el registro con su entidad propia
  await page.getByLabel('Entidad').selectOption('user');
  await expect(page.getByRole('feed').getByRole('article').first()).toHaveAttribute('data-action', 'user.updated');
});

test('modo caos: sliders, textos alternos y persistencia por tenant', async ({ page, request }) => {
  await openAs(page, 'admin', '/admin?tab=chaos', { tenant: TENANT });
  const panel = page.getByTestId('admin-chaos-panel');
  const apply = page.getByRole('button', { name: 'Aplicar' });
  await expect(panel.getByTestId('admin-chaos-status')).toHaveAttribute('data-active', 'false');
  await expect(panel.getByTestId('admin-chaos-status')).toHaveText('Caos apagado');
  await expect(apply).toBeDisabled();
  await expect(apply).toHaveAttribute('title', 'No hay cambios que guardar');

  const latency = page.getByLabel('Latencia máxima');
  await latency.fill('1500');
  await expect(latency).toHaveAttribute('aria-valuenow', '1500');
  await expect(latency).toHaveAttribute('aria-valuetext', '1500 ms');
  await expect(panel.getByTestId('admin-chaos-latency-value')).toHaveText('1500 ms');
  const errors = page.getByLabel('Errores 500 en escrituras');
  await errors.fill('50');
  await expect(errors).toHaveAttribute('aria-valuenow', '50');
  await expect(panel.getByTestId('admin-chaos-errors-value')).toHaveText('50 %');
  const flaky = page.getByRole('switch', { name: /Textos alternos/ });
  await expect(flaky).toHaveAttribute('aria-checked', 'false');
  await flaky.click();
  await expect(flaky).toHaveAttribute('aria-checked', 'true');
  await expect(panel).toContainText('Cambios sin aplicar');
  // todavía no se ha guardado nada: la configuración pública sigue limpia
  expect((await readConfig(request, TENANT)).chaos).toEqual({ latencyMs: 0, errorRate: 0, flakyLabels: false });

  await expect(apply).toBeEnabled();
  await apply.click();
  await expect(page.getByTestId('toast-ok')).toContainText('Modo caos actualizado');
  await expect(panel.getByTestId('admin-chaos-status')).toHaveAttribute('data-active', 'true');
  await expect(panel.getByTestId('admin-chaos-status')).toHaveText('Caos activo');
  await expect(apply).toBeDisabled();
  // persistido por tenant: lo ve GET /api/config y sobrevive a recargar
  expect((await readConfig(request, TENANT)).chaos).toEqual({ latencyMs: 1500, errorRate: 0.5, flakyLabels: true });
  await page.reload();
  await expect(page.getByLabel('Latencia máxima')).toHaveAttribute('aria-valuenow', '1500');
  await expect(page.getByLabel('Errores 500 en escrituras')).toHaveAttribute('aria-valuenow', '50');
  await expect(page.getByRole('switch', { name: /Textos alternos/ })).toHaveAttribute('aria-checked', 'true');
  // otro tenant no se ve afectado
  expect((await readConfig(request, 'alumno06')).chaos).toEqual({ latencyMs: 0, errorRate: 0, flakyLabels: false });

  // la latencia es aleatoria (0–1500 ms): alguna petición tarda claramente más de lo normal
  const headers = await authHeaders(request, 'admin', TENANT);
  await expect
    .poll(
      async () => {
        const started = Date.now();
        await request.get(`${API_URL}/programs`, { headers });
        return Date.now() - started;
      },
      { timeout: 20_000 },
    )
    .toBeGreaterThan(300);

  // textos alternos: el botón de ejemplo cambia entre «Guardar» y «Guardar cambios»
  const preview = page.getByTestId('admin-chaos-preview');
  await expect(preview).toHaveText(/^Guardar( cambios)?$/);
  await expect(preview).toHaveText('Guardar cambios', { timeout: 8000 });
  await expect(preview).toHaveText('Guardar', { timeout: 8000 });
});

test('modo caos: con el 100 % de errores una escritura falla y «Apagar caos» lo deja todo limpio', async ({ page, request }) => {
  await openAs(page, 'admin', '/admin?tab=chaos', { tenant: TENANT });
  await page.getByLabel('Latencia máxima').fill('0');
  await page.getByLabel('Errores 500 en escrituras').fill('100');
  await page.getByRole('button', { name: 'Aplicar' }).click();
  await expect(page.getByTestId('toast-ok')).toContainText('Modo caos actualizado');
  expect((await readConfig(request, TENANT)).chaos).toEqual({ latencyMs: 0, errorRate: 1, flakyLabels: true });

  // una escritura de otra pantalla (editar programa) recibe el 500 simulado; el botón se localiza con regex porque su texto alterna
  await page.goto('/programs/PRG-001/edit');
  await page.getByTestId('program-edit-description').fill('Descripción cambiada con el caos activo');
  await page.getByRole('button', { name: /^Guardar( cambios)?$/ }).click();
  await expect(page.getByTestId('program-edit-server-error')).toBeVisible();

  // los endpoints de administración están exentos: el instructor siempre puede apagarlo
  await page.goto('/admin?tab=chaos');
  await page.getByRole('button', { name: 'Apagar caos' }).click();
  await expect(page.getByTestId('toast-ok')).toContainText('Modo caos actualizado');
  await expect(page.getByTestId('admin-chaos-status')).toHaveAttribute('data-active', 'false');
  await expect(page.getByRole('button', { name: 'Apagar caos' })).toBeDisabled();
  expect((await readConfig(request, TENANT)).chaos).toEqual({ latencyMs: 0, errorRate: 0, flakyLabels: false });
  await expect(page.getByTestId('admin-chaos-preview')).toHaveText('Guardar');
});

test('datos: «Restaurar datos del tenant» usa confirm() nativo (cancelar y aceptar)', async ({ page, request }) => {
  const headers = await authHeaders(request, 'admin', TENANT);
  const roleOfU4 = async (): Promise<string> => ((await (await request.get(`${API_URL}/admin/users`, { headers })).json()) as { id: string; role: string }[]).find((user) => user.id === 'u4')?.role ?? '';
  expect((await request.patch(`${API_URL}/admin/users/u4`, { headers, data: { role: 'consultant' } })).status()).toBe(200);
  expect(await roleOfU4()).toBe('consultant');

  await openAs(page, 'admin', '/admin?tab=data', { tenant: TENANT });
  const reset = page.getByRole('button', { name: 'Restaurar datos del tenant' });

  // cancelar: nada cambia y no hay toast. El manejador se registra ANTES del clic: el clic no termina hasta que se resuelve el diálogo
  const seen: { type: string; message: string }[] = [];
  page.once('dialog', async (dialog) => {
    seen.push({ type: dialog.type(), message: dialog.message() });
    await dialog.dismiss();
  });
  await reset.click();
  expect(seen).toHaveLength(1);
  expect(seen[0]?.type).toBe('confirm');
  expect(seen[0]?.message).toContain('¿Restaurar los datos del tenant al estado inicial?');
  await expect(page.getByTestId('toast-ok')).toHaveCount(0);
  expect(await roleOfU4()).toBe('consultant');

  // aceptar: se restaura el seed y aparece el toast con el tenant
  page.once('dialog', (dialog) => void dialog.accept());
  await reset.click();
  await expect(page.getByTestId('toast-ok')).toContainText('Datos restaurados');
  await expect(page.getByTestId('toast-ok')).toContainText(TENANT);
  await expect.poll(roleOfU4).toBe('auditor');
});

test('datos: «Información del tenant» lanza un alert() nativo con el tenant y los usuarios', async ({ page, request }) => {
  const headers = await authHeaders(request, 'admin', TENANT);
  const users = (await (await request.get(`${API_URL}/admin/users`, { headers })).json()) as { active: boolean }[];
  const active = users.filter((user) => user.active).length;

  await openAs(page, 'admin', '/admin?tab=data', { tenant: TENANT });
  const seen: { type: string; message: string }[] = [];
  // El manejador va ANTES del clic: el aviso nativo bloquea la página hasta que se resuelve
  page.once('dialog', async (dialog) => {
    seen.push({ type: dialog.type(), message: dialog.message() });
    await dialog.accept();
  });
  await page.getByRole('button', { name: 'Información del tenant' }).click();
  await expect.poll(() => seen.length).toBe(1);
  expect(seen[0]?.type).toBe('alert');
  expect(seen[0]?.message).toContain('Información del tenant');
  expect(seen[0]?.message).toContain(`Tenant: ${TENANT}`);
  expect(seen[0]?.message).toContain(`Usuarios: ${users.length} (${active} activos)`);
  // Un alert() solo tiene «Aceptar»: la página sigue operativa después
  await expect(page.getByRole('button', { name: 'Restaurar datos del tenant' })).toBeEnabled();
});
