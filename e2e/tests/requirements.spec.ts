import { expect, test, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { openAs, resetTenant } from '../support/auth';

// Spec de humo del módulo Requisitos (fase 2): árbol, estados por rol, edición inline, etiquetas, editor contenteditable,
// reordenar (arrastrar, teclado y menú), menú contextual, atajos, portapapeles, matriz y CSV. Locators: getByRole/getByLabel primero.
// Trabaja en su propio tenant (alumno09), restaurado antes y después. Programa de trabajo: PRG-002 (REQ-015 … REQ-028).

const TENANT = 'alumno09';
const PROGRAM = '/programs/PRG-002/requirements';
test.describe.configure({ mode: 'serial' });

test.beforeAll(async ({ request }) => {
  await resetTenant(request, TENANT);
});

test.afterAll(async ({ request }) => {
  await resetTenant(request, TENANT);
});

const tree = (page: Page) => page.getByRole('tree', { name: 'Árbol de requisitos' });
const row = (page: Page, code: string) => tree(page).getByRole('treeitem', { name: new RegExp(`^${code} `) });
const detail = (page: Page) => page.getByRole('complementary', { name: 'Detalle del requisito' });
/** Códigos de las filas visibles, en orden de lectura. */
const order = (page: Page) => tree(page).getByRole('treeitem').evaluateAll((items) => items.map((item) => (item.getAttribute('aria-label') ?? '').split(' ')[0]));

test('árbol ARIA: niveles, plegar/desplegar, filtro con ancestros y recuento', async ({ page }) => {
  await openAs(page, 'admin', PROGRAM, { tenant: TENANT });
  await expect(page.getByRole('heading', { level: 1, name: 'Requisitos' })).toBeVisible();
  await expect(page.getByLabel('Programa')).toHaveValue('PRG-002');
  await expect(tree(page).getByRole('treeitem')).toHaveCount(14);
  await expect(page.getByText('14 de 14 requisitos')).toBeVisible();
  // and(): el botón de alta por rol y por data-testid a la vez
  await expect(page.getByRole('button', { name: /Nuevo requisito/ }).and(page.getByTestId('requirements-new'))).toBeEnabled();

  await expect(row(page, 'REQ-015')).toHaveAttribute('aria-level', '1');
  await expect(row(page, 'REQ-015')).toHaveAttribute('aria-expanded', 'true');
  await expect(row(page, 'REQ-017')).toHaveAttribute('aria-level', '2');
  await expect(row(page, 'REQ-018')).toHaveAttribute('aria-level', '3');
  await expect(row(page, 'REQ-016')).not.toHaveAttribute('aria-expanded'); // las hojas no se pliegan

  await page.getByRole('button', { name: 'Contraer REQ-015' }).click();
  await expect(row(page, 'REQ-015')).toHaveAttribute('aria-expanded', 'false');
  await expect(tree(page).getByRole('treeitem')).toHaveCount(10); // REQ-016…019 ocultos
  await page.getByRole('button', { name: 'Expandir REQ-015' }).click();
  await expect(tree(page).getByRole('treeitem')).toHaveCount(14);

  await page.getByRole('button', { name: 'Contraer todo' }).click();
  await expect(order(page)).resolves.toEqual(['REQ-015', 'REQ-020', 'REQ-025']);
  await page.getByRole('button', { name: 'Expandir todo' }).click();
  await expect(tree(page).getByRole('treeitem')).toHaveCount(14);

  // El filtro conserva el camino hasta cada coincidencia («Latencia»: REQ-018 y REQ-026)
  await page.getByRole('searchbox', { name: 'Buscar requisitos' }).fill('latencia');
  await expect(order(page)).resolves.toEqual(['REQ-015', 'REQ-017', 'REQ-018', 'REQ-025', 'REQ-026']);
  await expect(page.getByText('5 de 14 requisitos')).toBeVisible();
  await page.getByRole('searchbox', { name: 'Buscar requisitos' }).fill('zzz-no-existe');
  await expect(page.getByText('Sin coincidencias')).toBeVisible();
  await page.getByRole('searchbox', { name: 'Buscar requisitos' }).fill('REQ-02');
  await expect(tree(page).getByRole('treeitem')).toHaveCount(9); // REQ-020…028 (sin ancestros: ya son raíces o sus padres coinciden)
});

test('filter({ has }) y CSS por estado: badges con data-state en cada fila', async ({ page }) => {
  await openAs(page, 'admin', PROGRAM, { tenant: TENANT });
  const items = tree(page).getByRole('treeitem');
  await expect(items).toHaveCount(14);

  const approved = items.filter({ has: page.getByText('Aprobado', { exact: true }) });
  await expect(approved).toHaveCount(2); // REQ-021 y REQ-025
  await expect(items.filter({ has: page.locator('.badge[data-state="verified"]') })).toHaveCount(3);
  await expect(items.filter({ has: page.locator('.badge[data-state="validated"]') })).toHaveCount(4);
  await expect(items.filter({ hasNot: page.locator('.badge[data-state="draft"]') })).toHaveCount(9);
  await expect(row(page, 'REQ-017').getByTestId('requirement-state-badge')).toHaveText('Borrador');
});

test('copiar código: botón de la fila y del detalle escriben en el portapapeles y avisan con un toast', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await openAs(page, 'admin', PROGRAM, { tenant: TENANT });

  await page.getByRole('button', { name: 'Copiar código REQ-017' }).click();
  const toast = page.getByTestId('toast-info');
  await expect(toast).toContainText('Código copiado');
  await expect(toast).toContainText('REQ-017 está en el portapapeles');
  await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toBe('REQ-017');

  await row(page, 'REQ-019').click();
  await detail(page).getByRole('button', { name: 'Copiar código REQ-019' }).click();
  await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toBe('REQ-019');
});

test('atajos: N abre «Nuevo requisito», Esc lo cierra, / enfoca la búsqueda y Esc cierra el detalle', async ({ page }) => {
  await openAs(page, 'admin', PROGRAM, { tenant: TENANT });
  await expect(tree(page).getByRole('treeitem')).toHaveCount(14); // la página debe estar lista para que el atajo esté registrado

  await page.keyboard.press('n');
  const dialog = page.getByRole('dialog', { name: 'Nuevo requisito' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByLabel('Título')).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();

  await page.keyboard.press('/');
  await expect(page.getByRole('searchbox', { name: 'Buscar requisitos' })).toBeFocused();
  await page.keyboard.press('Escape'); // sale del campo
  await expect(page.getByRole('searchbox', { name: 'Buscar requisitos' })).not.toBeFocused();

  await row(page, 'REQ-016').click();
  await expect(detail(page)).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(detail(page)).toBeHidden();
});

test('matriz de trazabilidad: casillas por cruce, hueco de cobertura y enlace/desenlace con toast', async ({ page }) => {
  await openAs(page, 'admin', PROGRAM, { tenant: TENANT });
  await page.getByRole('tab', { name: 'Matriz de trazabilidad' }).click();
  await expect(page.getByRole('tab', { name: 'Matriz de trazabilidad' })).toHaveAttribute('aria-selected', 'true');

  const matrix = page.getByRole('table', { name: 'Matriz de trazabilidad' });
  await expect(matrix.getByRole('columnheader', { name: /TC-010/ })).toBeVisible();
  const cell = matrix.getByRole('checkbox', { name: 'REQ-017 ↔ TC-012' });
  await expect(cell).toBeChecked();
  await expect(matrix.getByRole('checkbox', { name: 'REQ-017 ↔ TC-010' })).not.toBeChecked();
  await expect(page.getByText('13 de 14 requisitos con cobertura')).toBeVisible();
  await expect(page.getByTestId('matrix-row-REQ-028')).toHaveAttribute('data-covered', 'false');
  await expect(page.getByTestId('matrix-row-REQ-028').getByText('Sin cobertura')).toBeVisible();

  await cell.uncheck();
  await expect(page.getByTestId('toast-ok')).toContainText('Enlace eliminado');
  await expect(page.getByText('12 de 14 requisitos con cobertura')).toBeVisible();
  await cell.check();
  await expect(page.getByText('13 de 14 requisitos con cobertura')).toBeVisible();

  // Cubrir el hueco: REQ-028 ↔ TC-010
  await matrix.getByRole('checkbox', { name: 'REQ-028 ↔ TC-010' }).check();
  await expect(page.getByText('14 de 14 requisitos con cobertura')).toBeVisible();
  await matrix.getByRole('checkbox', { name: 'REQ-028 ↔ TC-010' }).uncheck();

  await page.reload();
  await page.getByRole('tab', { name: 'Matriz de trazabilidad' }).click();
  await expect(page.getByRole('checkbox', { name: 'REQ-017 ↔ TC-012' })).toBeChecked();
  await expect(page.getByText('13 de 14 requisitos con cobertura')).toBeVisible();
});

test('exportar CSV: descarga sigpro-requisitos.csv con una fila por requisito', async ({ page }) => {
  await openAs(page, 'admin', PROGRAM, { tenant: TENANT });
  await expect(tree(page).getByRole('treeitem')).toHaveCount(14);
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Exportar CSV' }).click()]);
  expect(download.suggestedFilename()).toBe('sigpro-requisitos.csv');
  const lines = (await readFile(await download.path(), 'utf8')).split('\n');
  expect(lines[0]).toBe('code;title;state;priority;parent;tags;tests');
  expect(lines).toHaveLength(15);
  expect(lines).toContain('REQ-017;"Disponibilidad del subsistema 017";draft;low;REQ-015;security;TC-012');
});

test('edición inline: doble clic, Enter guarda, Esc cancela, validación y vuelta a borrador al cambiar el texto', async ({ page }) => {
  await openAs(page, 'admin', PROGRAM, { tenant: TENANT });
  const title = page.getByRole('button', { name: 'Latencia del subsistema 018' });
  await expect(row(page, 'REQ-018').getByTestId('requirement-state-badge')).toHaveAttribute('data-state', 'verified');

  await title.dblclick();
  const input = page.getByRole('textbox', { name: 'Título de REQ-018' });
  await expect(input).toBeFocused();
  await input.fill('ab');
  await input.press('Enter');
  await expect(input).toHaveAttribute('aria-invalid', 'true');
  await expect(input).toHaveAttribute('title', 'El título debe tener al menos 3 caracteres');

  await input.press('Escape');
  await expect(input).toBeHidden();
  await expect(title).toBeVisible(); // nada cambió

  await title.dblclick();
  await input.fill('Latencia máxima del enlace táctico');
  await input.press('Enter');
  const toast = page.getByTestId('toast-ok');
  // or(): dos finales posibles tras guardar (toast de éxito o alerta de error)
  await expect(toast.or(page.getByRole('alert'))).toBeVisible();
  await expect(toast).toContainText('Requisito guardado');
  await expect(toast).toContainText('REQ-018 volvió a Borrador');
  await expect(row(page, 'REQ-018').getByTestId('requirement-state-badge')).toHaveAttribute('data-state', 'draft');
  await expect(toast).toBeHidden({ timeout: 5000 }); // autocierre a los 3 s

  await page.reload();
  await expect(page.getByRole('button', { name: 'Latencia máxima del enlace táctico' })).toBeVisible();
});

test('panel de detalle: etiquetas con chips, prioridad, editor contenteditable y aviso de vuelta a borrador', async ({ page }) => {
  await openAs(page, 'admin', PROGRAM, { tenant: TENANT });
  await row(page, 'REQ-021').click();
  const panel = detail(page);
  await expect(panel.getByTestId('requirement-code')).toHaveText('REQ-021');
  await expect(panel.getByTestId('requirement-state-badge')).toHaveAttribute('data-state', 'approved');
  const save = panel.getByRole('button', { name: 'Guardar', exact: true });
  await expect(save).toBeDisabled();
  await expect(save).toHaveAttribute('title', 'No hay cambios que guardar');

  // Multi-select con chips: escribir filtra, clic elige, Enter elige, × y Retroceso quitan
  const tags = panel.getByRole('combobox', { name: 'Etiquetas' });
  await expect(panel.getByPlaceholder('Añadir etiqueta…')).toBeVisible(); // el placeholder es distinto de la etiqueta («Etiquetas»)
  const chips = panel.getByRole('list', { name: 'Etiquetas' }).getByRole('listitem');
  await expect(panel.getByRole('list', { name: 'Etiquetas' })).toContainText('Sin etiquetas');
  await tags.fill('cib');
  await page.getByRole('option', { name: 'Ciberseguridad' }).click();
  await tags.fill('rend');
  await tags.press('Enter');
  await expect(chips).toHaveCount(2);
  await expect(chips.filter({ hasText: 'Ciberseguridad' })).toHaveCount(1);
  await panel.getByRole('button', { name: 'Quitar etiqueta Rendimiento' }).click();
  await expect(chips).toHaveCount(1);
  await tags.press('Backspace'); // con el campo vacío quita el último chip
  await expect(panel.getByRole('list', { name: 'Etiquetas' })).toContainText('Sin etiquetas');
  await tags.fill('interf');
  await tags.press('Enter');
  await tags.fill('usab');
  await tags.press('Enter');
  await expect(chips).toHaveCount(2);

  // select nativo: por valor y por etiqueta
  await panel.getByLabel('Prioridad').selectOption('high');
  await panel.getByLabel('Prioridad').selectOption({ label: 'Media' });
  await panel.getByLabel('Prioridad').selectOption({ value: 'high' });

  // contenteditable: escribir, negrita con atajo y con el botón de la barra
  const editor = panel.getByRole('textbox', { name: 'Descripción' });
  await editor.click();
  await page.keyboard.press('Control+A');
  await page.keyboard.type('Texto con negrita');
  await page.keyboard.press('Control+A');
  await page.keyboard.press('Control+B');
  await expect(panel.getByRole('button', { name: 'Negrita' })).toHaveAttribute('aria-pressed', 'true');
  await expect.poll(() => editor.evaluate((element) => element.innerHTML)).toMatch(/<(b|strong)>Texto con negrita<\/(b|strong)>/);
  await page.keyboard.press('End');
  await page.keyboard.press('Control+B'); // desactiva la negrita para lo que se escriba después
  await page.keyboard.type(' y cursiva');
  await page.keyboard.press('Shift+Control+ArrowLeft');
  await page.keyboard.press('Shift+Control+ArrowLeft');
  await panel.getByRole('button', { name: 'Cursiva' }).click();
  await expect(panel.getByRole('button', { name: 'Cursiva' })).toHaveAttribute('aria-pressed', 'true');

  // Cambiar el texto de un requisito aprobado lo devuelve a borrador (aviso antes de guardar)
  const notice = panel.getByTestId('requirement-revert-notice');
  await expect(notice).toContainText('Este requisito está en estado aprobado');
  await expect(save).toBeEnabled();
  await save.click();
  const toast = page.getByTestId('toast-ok');
  await expect(toast).toContainText('Requisito guardado');
  await expect(toast).toContainText('REQ-021 volvió a Borrador');
  await expect(panel.getByTestId('requirement-state-badge')).toHaveAttribute('data-state', 'draft');
  await expect(notice).toBeHidden();
  await expect(save).toBeDisabled();

  // Persistencia: tras recargar, etiquetas, prioridad y HTML saneado (strong/em, sin atributos)
  await page.reload();
  await row(page, 'REQ-021').click();
  await expect(detail(page).getByRole('list', { name: 'Etiquetas' }).getByRole('listitem')).toHaveCount(2);
  await expect(detail(page).getByLabel('Prioridad')).toHaveValue('high');
  const html = await detail(page).getByRole('textbox', { name: 'Descripción' }).evaluate((element) => element.innerHTML);
  expect(html).toContain('<strong>Texto con negrita</strong>');
  expect(html).toContain('<em>');
  expect(html).not.toMatch(/<(b|i|div|script)\b|style=|onclick/);

  // «Guardar y cerrar» cierra el panel
  await detail(page).getByLabel('Título').fill('Latencia del subsistema 021 (revisado)');
  await detail(page).getByRole('button', { name: 'Guardar y cerrar' }).click();
  await expect(detail(page)).toBeHidden();
  await expect(page.getByRole('button', { name: 'Latencia del subsistema 021 (revisado)' })).toBeVisible();
});

test('estados con confirmación y permisos: gestor aprueba, consultor verifica, auditor valida, gestor devuelve a borrador', async ({ page }) => {
  const stateBadge = () => detail(page).getByTestId('requirement-state-badge');

  // Consultor: no puede aprobar (botón deshabilitado con su motivo)
  await openAs(page, 'consultant', PROGRAM, { tenant: TENANT });
  await row(page, 'REQ-017').click();
  const approveAsConsultant = detail(page).getByRole('button', { name: 'Aprobar' });
  await expect(stateBadge()).toHaveAttribute('data-state', 'draft');
  await expect(approveAsConsultant).toBeDisabled();
  await expect(approveAsConsultant).toHaveAttribute('title', 'Solo el gestor de programa o el admin pueden aprobar');

  // Gestor: aprueba tras confirmar (cancelar no cambia nada)
  await openAs(page, 'program_manager', PROGRAM, { tenant: TENANT });
  await row(page, 'REQ-017').click();
  await detail(page).getByRole('button', { name: 'Aprobar' }).click();
  const dialog = page.getByRole('dialog', { name: 'Cambiar el estado de REQ-017' });
  await expect(dialog).toContainText('REQ-017 pasará de Borrador a Aprobado.');
  await dialog.getByRole('button', { name: 'Cancelar' }).click();
  await expect(dialog).toBeHidden();
  await expect(stateBadge()).toHaveAttribute('data-state', 'draft');
  await detail(page).getByRole('button', { name: 'Aprobar' }).click();
  await dialog.getByRole('button', { name: 'Confirmar' }).click();
  await expect(page.getByTestId('toast-ok')).toContainText('REQ-017 → Aprobado');
  await expect(stateBadge()).toHaveAttribute('data-state', 'approved');
  await expect(detail(page).getByRole('button', { name: 'Marcar como verificado' })).toBeDisabled(); // el gestor no verifica

  // Consultor: verifica (y no puede volver a borrador)
  await openAs(page, 'consultant', PROGRAM, { tenant: TENANT });
  await row(page, 'REQ-017').click();
  await expect(detail(page).getByRole('button', { name: 'Volver a borrador' })).toBeDisabled();
  await detail(page).getByRole('button', { name: 'Marcar como verificado' }).click();
  await page.getByRole('dialog', { name: 'Cambiar el estado de REQ-017' }).getByRole('button', { name: 'Confirmar' }).click();
  await expect(stateBadge()).toHaveAttribute('data-state', 'verified');

  // Auditor: valida (y no puede aprobar ni editar)
  await openAs(page, 'auditor', PROGRAM, { tenant: TENANT });
  await row(page, 'REQ-017').click();
  await detail(page).getByRole('button', { name: 'Validar' }).click();
  await page.getByRole('dialog', { name: 'Cambiar el estado de REQ-017' }).getByRole('button', { name: 'Confirmar' }).click();
  await expect(stateBadge()).toHaveAttribute('data-state', 'validated');
  await expect(detail(page).getByRole('button', { name: 'Volver a borrador' })).toBeDisabled();

  // Gestor: devuelve a borrador
  await openAs(page, 'program_manager', PROGRAM, { tenant: TENANT });
  await row(page, 'REQ-017').click();
  await detail(page).getByRole('button', { name: 'Volver a borrador' }).click();
  await page.getByRole('dialog', { name: 'Cambiar el estado de REQ-017' }).getByRole('button', { name: 'Confirmar' }).click();
  await expect(stateBadge()).toHaveAttribute('data-state', 'draft');
});

test('reordenar: arrastrar entre hermanos, caída inválida entre padres distintos, Alt+flechas y menú «Subir»', async ({ page }) => {
  await openAs(page, 'admin', PROGRAM, { tenant: TENANT });
  const siblings = ['REQ-016', 'REQ-017', 'REQ-019'];
  const under015 = async () => (await order(page)).filter((code) => ['REQ-016', 'REQ-017', 'REQ-019'].includes(code));
  await expect.poll(under015).toEqual(siblings);

  // dragTo: REQ-019 pasa delante de REQ-016
  await page.getByRole('img', { name: 'Arrastrar REQ-019 para reordenar' }).dragTo(row(page, 'REQ-016'));
  await expect(page.getByTestId('toast-ok')).toContainText('Orden actualizado');
  await expect.poll(under015).toEqual(['REQ-019', 'REQ-016', 'REQ-017']);
  await expect(order(page)).resolves.toEqual([
    'REQ-015', 'REQ-019', 'REQ-016', 'REQ-017', 'REQ-018', 'REQ-020', 'REQ-021', 'REQ-022', 'REQ-023', 'REQ-024', 'REQ-025', 'REQ-026', 'REQ-027', 'REQ-028',
  ]);

  // Soltar sobre otro padre no hace nada
  const before = await order(page);
  await page.getByRole('img', { name: 'Arrastrar REQ-021 para reordenar' }).dragTo(row(page, 'REQ-016'));
  await page.waitForTimeout(400);
  await expect(order(page)).resolves.toEqual(before);

  // Persiste al recargar
  await page.reload();
  await expect.poll(under015).toEqual(['REQ-019', 'REQ-016', 'REQ-017']);

  // Alternativa de teclado: Alt+↑ / Alt+↓ sobre la fila con foco
  await row(page, 'REQ-017').focus();
  await page.keyboard.press('Alt+ArrowUp');
  await expect.poll(under015).toEqual(['REQ-019', 'REQ-017', 'REQ-016']);
  await page.keyboard.press('Alt+ArrowDown');
  await expect.poll(under015).toEqual(['REQ-019', 'REQ-016', 'REQ-017']);

  // Menú contextual → Subir (REQ-024 delante de REQ-022; los hermanos de REQ-020 eran 021, 022, 024)
  await row(page, 'REQ-024').click({ button: 'right' });
  const menu = page.getByRole('menu', { name: 'Acciones para REQ-024' });
  await menu.getByRole('menuitem', { name: 'Subir' }).click();
  await expect(page.getByTestId('toast-ok').last()).toContainText('REQ-024 se movió');
  const under020 = async () => (await order(page)).filter((code) => ['REQ-021', 'REQ-022', 'REQ-024'].includes(code));
  await expect.poll(under020).toEqual(['REQ-021', 'REQ-024', 'REQ-022']);

  // En los extremos, Subir/Bajar quedan deshabilitados con su motivo
  await row(page, 'REQ-021').click({ button: 'right' });
  const first = page.getByRole('menu', { name: 'Acciones para REQ-021' }).getByRole('menuitem', { name: 'Subir' });
  await expect(first).toBeDisabled();
  await expect(first).toHaveAttribute('title', 'Ya es el primero de su nivel');
  await page.keyboard.press('Escape');
});

test('menú contextual (clic derecho): añadir hijo, validación del alta, cancelar y eliminar con descendientes', async ({ page }) => {
  await openAs(page, 'admin', PROGRAM, { tenant: TENANT });
  await row(page, 'REQ-025').click({ button: 'right' });
  const menu = page.getByRole('menu', { name: 'Acciones para REQ-025' });
  await expect(menu.getByRole('menuitem')).toHaveText(['Abrir detalle', 'Renombrar', 'Añadir hijo', 'Copiar código', 'Subir', 'Bajar', 'Eliminar']);
  await expect(menu.getByRole('menuitem').first()).toHaveText('Abrir detalle');
  await expect(menu.getByRole('menuitem').nth(2)).toHaveText('Añadir hijo');
  await expect(menu.getByRole('menuitem').last()).toHaveText('Eliminar');
  await menu.getByRole('menuitem', { name: 'Añadir hijo' }).click();

  const dialog = page.getByRole('dialog', { name: 'Nuevo requisito' });
  await expect(dialog.getByLabel('Requisito padre')).toHaveValue('REQ-025');
  await dialog.getByRole('button', { name: 'Crear requisito' }).click();
  await expect(page.getByTestId('requirement-new-title-error')).toHaveText('El título debe tener al menos 3 caracteres');
  await dialog.getByLabel('Título').fill('Requisito hijo creado en la prueba');
  await dialog.getByLabel('Prioridad').selectOption('high');
  await dialog.getByRole('button', { name: 'Crear requisito' }).click();

  const toast = page.getByTestId('toast-ok');
  await expect(toast).toContainText('Requisito creado');
  await expect(toast).toContainText('REQ-041 se añadió al árbol');
  await expect(row(page, 'REQ-041')).toHaveAttribute('aria-level', '2');
  await expect(detail(page).getByTestId('requirement-code')).toHaveText('REQ-041');
  await expect(detail(page).getByTestId('requirement-state-badge')).toHaveAttribute('data-state', 'draft');
  await page.getByRole('button', { name: 'Cerrar detalle de REQ-041' }).click();

  // Eliminar: el alertdialog avisa de los descendientes (REQ-026, 027, 028 y 041); cancelar no borra
  await row(page, 'REQ-025').click({ button: 'right' });
  await page.getByRole('menuitem', { name: 'Eliminar' }).click();
  const alert = page.getByRole('alertdialog', { name: 'Eliminar requisito' });
  await expect(alert).toContainText('REQ-025 y sus 4 requisitos descendientes se eliminarán de forma permanente.');
  await alert.getByRole('button', { name: 'Cancelar' }).click();
  await expect(row(page, 'REQ-025')).toBeVisible();

  await row(page, 'REQ-025').click({ button: 'right' });
  await page.getByRole('menuitem', { name: 'Eliminar' }).click();
  await alert.getByRole('button', { name: 'Eliminar' }).click();
  await expect(page.getByTestId('toast-ok').last()).toContainText('REQ-025 eliminado');
  await expect(row(page, 'REQ-025')).toBeHidden();
  await expect(row(page, 'REQ-041')).toBeHidden();
  await expect(tree(page).getByRole('treeitem')).toHaveCount(10); // 14 + REQ-041 − REQ-025 y sus 4 descendientes
});

test('solo lectura por rol: auditor y consultor ven los controles deshabilitados con su motivo; programa sin requisitos', async ({ page }) => {
  await openAs(page, 'auditor', PROGRAM, { tenant: TENANT });
  const create = page.getByRole('button', { name: /Nuevo requisito/ });
  await expect(create).toBeDisabled();
  await expect(create).toHaveAttribute('title', 'Tu rol no permite crear requisitos');
  await expect(page.getByTitle('Tu rol no permite crear requisitos')).toBeDisabled();
  await expect(page.getByRole('img', { name: 'Arrastrar REQ-016 para reordenar' })).toHaveAttribute('title', 'Tu rol no permite editar requisitos');
  await expect(row(page, 'REQ-016')).toHaveAttribute('draggable', 'false');

  await row(page, 'REQ-016').click();
  await expect(detail(page).getByLabel('Título')).toHaveAttribute('readonly', '');
  await expect(detail(page).getByLabel('Prioridad')).toBeDisabled();
  await expect(detail(page).getByRole('textbox', { name: 'Descripción' })).toHaveAttribute('aria-readonly', 'true');
  await expect(detail(page).getByRole('button', { name: 'Guardar', exact: true })).toHaveAttribute('title', 'Tu rol no permite editar requisitos');
  await expect(detail(page).getByRole('checkbox')).toHaveCount(0);

  await row(page, 'REQ-016').click({ button: 'right' });
  await expect(page.getByRole('menuitem', { name: 'Renombrar' })).toBeDisabled();
  await expect(page.getByRole('menuitem', { name: 'Eliminar' })).toHaveAttribute('title', 'Solo admin y gestor pueden eliminar requisitos');
  await page.keyboard.press('Escape');

  await openAs(page, 'consultant', PROGRAM, { tenant: TENANT });
  await row(page, 'REQ-016').click({ button: 'right' });
  await expect(page.getByRole('menuitem', { name: 'Eliminar' })).toBeDisabled();
  await expect(page.getByRole('menuitem', { name: 'Añadir hijo' })).toBeEnabled();
  await page.keyboard.press('Escape');

  // Programa sin requisitos: estado vacío con el botón de alta (consultor) y sin él (auditor)
  await page.goto('/programs/PRG-004/requirements');
  await expect(page.getByTestId('requirements-empty')).toContainText('Sin requisitos');
  await page.getByRole('button', { name: 'Crear el primer requisito' }).click();
  await expect(page.getByRole('dialog', { name: 'Nuevo requisito' })).toBeVisible();
  await page.keyboard.press('Escape');

  await openAs(page, 'auditor', '/programs/PRG-004/requirements', { tenant: TENANT });
  await expect(page.getByTestId('requirements-empty')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Crear el primer requisito' })).toHaveCount(0);
});

test('carga lenta (skeleton + aria-busy), error 503 con traza y reintento, y programa inexistente', async ({ page }) => {
  // Tras el test de eliminación quedan 10 de los 14 requisitos (la suite es serie y comparte tenant)
  const REMAINING = 10;
  await openAs(page, 'admin', '/programs', { tenant: TENANT });

  await page.route('**/api/programs/PRG-002/requirements', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 1500));
    await route.continue().catch(() => undefined);
  });
  await page.goto(PROGRAM);
  await expect(page.getByTestId('skeleton-row').first()).toBeVisible();
  await expect(page.locator('[aria-busy="true"]').first()).toBeVisible();
  await expect(tree(page).getByRole('treeitem')).toHaveCount(REMAINING, { timeout: 8000 });
  await page.unroute('**/api/programs/PRG-002/requirements');

  await page.route('**/api/programs/PRG-002/requirements', (route) =>
    route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ statusCode: 503, error: 'Service Unavailable', message: 'down' }) }),
  );
  await page.goto(PROGRAM);
  const alert = page.getByRole('alert').filter({ hasText: 'No se pudieron cargar los requisitos' });
  await expect(alert).toContainText('503');
  await page.unroute('**/api/programs/PRG-002/requirements');
  await alert.getByRole('button', { name: 'Reintentar' }).click();
  await expect(tree(page).getByRole('treeitem')).toHaveCount(REMAINING);

  await page.goto('/programs/PRG-999/requirements');
  await expect(page.getByRole('alert').filter({ hasText: 'No se encontró el programa' })).toBeVisible();
});
