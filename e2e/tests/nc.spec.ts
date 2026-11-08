import { expect, test, type Page } from '@playwright/test';
import { openAs, resetTenant } from '../support/auth';

// Spec de humo de No conformidades (fase 3): tablero kanban con drag & drop, filtros, detalle en modal, selector de
// severidad con Shadow DOM, combobox de asignación, comentarios, comentario rápido con el prompt() NATIVO, cierre con
// comentario de ≥ 20 caracteres, alta, estados de carga/error y móvil. Tenant propio: alumno01.
//
// Seed por columna: Abierta NC-001·006·007·012 · En análisis NC-002·008 · Acción correctiva NC-003·009 ·
// Cerrada NC-004·010 · Rechazada NC-005·011. Sin asignar: NC-005 y NC-010. Los tests están en serie y cada uno
// muta NC distintas para no depender del anterior. Evita a propósito los caminos de los defectos plantados
// (cierre con 19 caracteres, open → rejected, contadores de comentarios > 2).

const TENANT = 'alumno01';
test.describe.configure({ mode: 'serial' });

test.beforeAll(async ({ request }) => {
  await resetTenant(request, TENANT);
});

test.afterAll(async ({ request }) => {
  await resetTenant(request, TENANT);
});

const STATES = ['open', 'in_analysis', 'corrective_action', 'closed', 'rejected'] as const;
const CARD = /^nc-card-NC-\d+$/;

const card = (page: Page, code: string) => page.getByTestId(`nc-card-${code}`);
const column = (page: Page, state: string) => page.getByTestId(`nc-column-${state}`);
const codesIn = (page: Page, state: string) =>
  column(page, state)
    .getByTestId(CARD)
    .evaluateAll((items) => items.map((item) => item.getAttribute('data-testid')?.replace('nc-card-', '') ?? ''));
const toast = (page: Page, tone: 'ok' | 'danger' | 'warn' | 'info', text: string) => page.getByTestId(`toast-${tone}`).filter({ hasText: text });
const dialog = (page: Page, name: string | RegExp) => page.getByRole('dialog', { name });
const openBoard = async (page: Page, role: Parameters<typeof openAs>[1] = 'admin', path = '/nc') => {
  await openAs(page, role, path, { tenant: TENANT });
  await expect(page.getByTestId('nc-board')).toHaveAttribute('aria-busy', 'false');
};
const counts = async (page: Page) => Promise.all(STATES.map(async (state) => (await codesIn(page, state)).length));

test('estructura: cinco columnas con las tarjetas del seed, severidad por color y tarjetas sin asignar', async ({ page }) => {
  await openBoard(page);
  await expect(page.getByRole('heading', { level: 1, name: 'No conformidades' })).toBeVisible();
  await expect(page.getByTestId('nc-count')).toHaveText('12 no conformidades · 8 abiertas');
  await expect(page.getByTestId('nav-badge-nc')).toHaveText('8');

  await expect(page.getByTestId('nc-board').getByRole('region')).toHaveCount(5);
  await expect(page.getByRole('region', { name: /^Abierta/ })).toBeVisible();
  const expected: Record<string, string[]> = {
    open: ['NC-001', 'NC-006', 'NC-007', 'NC-012'],
    in_analysis: ['NC-002', 'NC-008'],
    corrective_action: ['NC-003', 'NC-009'],
    closed: ['NC-004', 'NC-010'],
    rejected: ['NC-005', 'NC-011'],
  };
  for (const state of STATES) {
    expect(await codesIn(page, state)).toEqual(expected[state]);
    await expect(page.getByTestId(`nc-column-count-${state}`)).toHaveText(String(expected[state]?.length));
    await expect(column(page, state)).toHaveAttribute('data-state', state);
  }

  // CSS por atributo: data-severity en tarjetas y badges
  await expect(page.locator('li[data-testid^="nc-card-NC-"][data-severity="critical"]')).toHaveCount(4);
  await expect(page.getByTestId('nc-card-severity-NC-003')).toHaveText('Crítica');
  await expect(page.getByTestId('nc-card-severity-NC-001')).toHaveAttribute('data-severity', 'minor');
  // Color de la severidad en el borde izquierdo (claro): crítica = --danger, mayor = --warn, menor = --info
  await expect(card(page, 'NC-003')).toHaveCSS('border-left-color', 'rgb(198, 47, 47)');
  await expect(card(page, 'NC-002')).toHaveCSS('border-left-color', 'rgb(138, 82, 0)');
  await expect(card(page, 'NC-001')).toHaveCSS('border-left-color', 'rgb(36, 89, 199)');

  // filter({ hasNot }): sin asignar = sin <img> de avatar
  const unassigned = page.getByTestId('nc-board').getByRole('listitem').filter({ hasNot: page.getByRole('img') });
  await expect(unassigned).toHaveCount(2);
  expect((await unassigned.evaluateAll((items) => items.map((item) => item.getAttribute('data-testid') ?? ''))).sort()).toEqual(['nc-card-NC-005', 'nc-card-NC-010']);
  await expect(card(page, 'NC-005').getByText('Sin asignar')).toBeVisible();
  await expect(card(page, 'NC-003').getByAltText('Andrés Molina')).toBeVisible();
  await expect(card(page, 'NC-003').getByTestId('nc-card-assignee-NC-003')).toContainText('Andrés Molina');
  // las tarjetas se pueden arrastrar con un rol operativo
  await expect(card(page, 'NC-001')).toHaveAttribute('draggable', 'true');
});

test('filtros: búsqueda, programa, severidad y «Solo sin asignar» (los pide el servidor) y estado vacío', async ({ page }) => {
  await openBoard(page);
  const visible = () => page.getByTestId(CARD).evaluateAll((items) => items.map((item) => item.getAttribute('data-testid')?.replace('nc-card-', '') ?? ''));

  await page.getByPlaceholder('Código o descripción…').fill('012'); // getByPlaceholder: el placeholder es distinto del label
  await expect(page.getByTestId('nc-count')).toHaveText('1 de 12 no conformidades');
  expect(await visible()).toEqual(['NC-012']);

  await page.getByRole('button', { name: 'Limpiar filtros' }).click();
  await expect(page.getByTestId(CARD)).toHaveCount(12);
  await expect(page.getByRole('searchbox', { name: 'Buscar no conformidades' })).toHaveValue('');

  await page.getByLabel('Programa', { exact: true }).selectOption('PRG-002');
  await expect(page.getByTestId('nc-count')).toHaveText('4 de 12 no conformidades');
  expect((await visible()).sort()).toEqual(['NC-005', 'NC-006', 'NC-007', 'NC-008']);

  await page.getByLabel('Severidad', { exact: true }).selectOption({ label: 'Crítica' });
  await expect(page.getByTestId('nc-count')).toHaveText('1 de 12 no conformidades');
  expect(await visible()).toEqual(['NC-006']);

  await page.getByLabel('Programa', { exact: true }).selectOption('');
  await expect(page.getByTestId('nc-count')).toHaveText('4 de 12 no conformidades');
  expect((await visible()).sort()).toEqual(['NC-003', 'NC-006', 'NC-009', 'NC-012']);

  await page.getByLabel('Severidad', { exact: true }).selectOption('');
  await page.getByRole('checkbox', { name: 'Solo sin asignar' }).check();
  await expect(page.getByTestId(CARD)).toHaveCount(2);
  expect((await visible()).sort()).toEqual(['NC-005', 'NC-010']);
  await page.getByRole('checkbox', { name: 'Solo sin asignar' }).uncheck();
  await expect(page.getByTestId(CARD)).toHaveCount(12);

  await page.getByRole('searchbox', { name: 'Buscar no conformidades' }).fill('zzzz-no-existe');
  await expect(page.getByTestId('nc-empty')).toContainText('Ninguna no conformidad coincide con los filtros aplicados.');
  await expect(page.getByTestId(CARD)).toHaveCount(0);
  await page.getByTestId('nc-empty-clear').click();
  await expect(page.getByTestId(CARD)).toHaveCount(12);
});

test('permisos: el auditor ve y comenta pero no mueve; el consultor mueve pero no cierra', async ({ page }) => {
  await openBoard(page, 'auditor');
  await expect(page.getByTestId(CARD)).toHaveCount(12);
  await expect(card(page, 'NC-001')).toHaveAttribute('draggable', 'false');
  await expect(page.getByTitle('Tu rol no permite mover no conformidades').first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Nueva no conformidad' })).toBeEnabled();

  // «Mover a…» sigue visible pero deshabilitado con su motivo
  await page.getByRole('button', { name: 'Acciones para NC-001' }).click();
  const move = page.getByRole('menuitem', { name: /Mover a «En análisis»/ });
  await expect(move).toBeDisabled();
  await expect(move).toHaveAttribute('title', 'Tu rol no permite mover no conformidades');
  await page.keyboard.press('Escape');

  // arrastrar no hace nada: la tarjeta sigue en su columna
  await card(page, 'NC-001').dragTo(column(page, 'in_analysis'));
  expect(await codesIn(page, 'open')).toContain('NC-001');

  // el detalle es de solo lectura para el auditor
  await page.goto('/nc/NC-001');
  const detail = dialog(page, 'Detalle de NC-001');
  await expect(detail.getByTestId('nc-detail-denied')).toContainText('puede leer y comentar');
  await expect(detail.getByRole('textbox', { name: 'Descripción' })).toHaveAttribute('aria-readonly', 'true');
  await expect(detail.getByRole('button', { name: /^Guardar$/ })).toBeDisabled();
  await expect(detail.getByRole('button', { name: /^Guardar$/ })).toHaveAttribute('title', 'Tu rol puede leer y comentar, pero no modificar esta no conformidad.');
  await expect(detail.getByRole('listbox', { name: 'Selector de severidad' })).toHaveAttribute('aria-disabled', 'true');
  await expect(detail.getByRole('textbox', { name: 'Añadir comentario' })).toBeEnabled();
});

test('detalle: el enlace directo /nc/NC-002 abre el modal; Esc y × lo cierran y la tarjeta lo vuelve a abrir', async ({ page }) => {
  await openBoard(page, 'admin', '/nc/NC-002');
  const detail = dialog(page, 'Detalle de NC-002');
  await expect(detail).toBeVisible();
  await expect(detail.getByTestId('nc-state-badge')).toHaveAttribute('data-state', 'in_analysis');
  await expect(detail.getByTestId('nc-state-badge')).toHaveText('En análisis');
  await expect(detail.getByTestId('nc-severity-badge')).toHaveAttribute('data-severity', 'major');
  await expect(detail.getByRole('link', { name: /PRG-001/ })).toHaveAttribute('href', '/programs/PRG-001');
  // 2 comentarios sembrados, con su autor (avatar con alt)
  await expect(detail.getByTestId('nc-comments').getByRole('listitem')).toHaveCount(2);
  await expect(detail.getByTestId('nc-comments').getByAltText('Andrés Molina')).toBeVisible();
  await expect(detail.getByTestId('nc-comments').getByAltText('Carmen Vidal')).toBeVisible();
  // transiciones permitidas desde «En análisis»: acción correctiva, rechazada y volver a abierta
  await expect(detail.getByTestId('nc-transitions').getByRole('button')).toHaveText(['Pasar a «Acción correctiva»', 'Pasar a «Rechazada»', 'Pasar a «Abierta»']);
  // sin cambios: «Guardar» y «Guardar y cerrar» deshabilitados con su motivo
  await expect(detail.getByRole('button', { name: /^Guardar$/ })).toBeDisabled();
  await expect(detail.getByRole('button', { name: 'Guardar y cerrar' })).toHaveAttribute('title', 'No hay cambios que guardar');

  await page.keyboard.press('Escape');
  await expect(detail).toBeHidden();
  await expect(page).toHaveURL(/\/nc$/);

  await page.getByRole('button', { name: 'Abrir NC-009' }).click();
  await expect(page).toHaveURL(/\/nc\/NC-009$/);
  await dialog(page, 'Detalle de NC-009').getByRole('button', { name: 'Cerrar el detalle' }).click();
  await expect(page).toHaveURL(/\/nc$/);

  await page.goto('/nc/NC-999');
  await expect(page.getByTestId('nc-detail-not-found')).toContainText('No se encontró la no conformidad');
});

test('arrastrar una tarjeta a una columna válida cambia su estado, actualiza los contadores y persiste (toast a los 3 s)', async ({ page }) => {
  await openBoard(page);
  expect(await counts(page)).toEqual([4, 2, 2, 2, 2]);

  await card(page, 'NC-001').dragTo(column(page, 'in_analysis'));
  const done = toast(page, 'ok', 'NC-001 pasó a «En análisis»');
  await expect(done).toBeVisible();
  await expect(column(page, 'in_analysis').getByTestId('nc-card-NC-001')).toHaveAttribute('data-state', 'in_analysis');
  await expect.poll(() => counts(page)).toEqual([3, 3, 2, 2, 2]);
  await expect(page.getByTestId('nc-column-count-in_analysis')).toHaveText('3');
  expect(await codesIn(page, 'open')).not.toContain('NC-001');

  // El toast se cierra solo a los 3 s
  await expect(done).toBeHidden({ timeout: 5_000 });

  // Persiste tras recargar y la insignia del menú sigue contando NC abiertas (en análisis sigue abierta)
  await page.reload();
  await expect(page.getByTestId('nc-board')).toHaveAttribute('aria-busy', 'false');
  expect(await codesIn(page, 'in_analysis')).toEqual(['NC-001', 'NC-002', 'NC-008']);
  await expect(page.getByTestId('nav-badge-nc')).toHaveText('8');
});

test('alternativa de teclado: el menú ⋯ → «Mover a…» mueve la tarjeta sin ratón', async ({ page }) => {
  await openBoard(page);
  const menuButton = page.getByRole('button', { name: 'Acciones para NC-006' });
  await menuButton.focus();
  await page.keyboard.press('Enter');
  const menu = page.getByRole('menu', { name: 'Acciones para NC-006' });
  await expect(menu).toBeVisible();
  // Desde «Abierta» solo se puede pasar a «En análisis»
  await expect(menu.getByRole('menuitem')).toHaveText(['Abrir detalle', 'Comentario rápido…', 'Mover a «En análisis»']);
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');

  await expect(toast(page, 'ok', 'NC-006 pasó a «En análisis»')).toBeVisible();
  await expect.poll(() => codesIn(page, 'in_analysis')).toContain('NC-006');
  expect(await codesIn(page, 'open')).toEqual(['NC-007', 'NC-012']);
});

test('arrastrar a una columna inválida: 409 del servidor, toast de error y la tarjeta vuelve a su sitio', async ({ page }) => {
  await openBoard(page);
  const before = await counts(page);

  await card(page, 'NC-007').dragTo(column(page, 'corrective_action'));
  await expect(toast(page, 'danger', 'NC-007: no se puede pasar de «Abierta» a «Acción correctiva»')).toBeVisible();
  expect(await codesIn(page, 'open')).toContain('NC-007');

  // Abierta → Cerrada tampoco existe: no pide comentario, el servidor responde 409 antes que 422
  await card(page, 'NC-007').dragTo(column(page, 'closed'));
  await expect(toast(page, 'danger', 'NC-007: no se puede pasar de «Abierta» a «Cerrada»')).toBeVisible();
  await expect(dialog(page, /Cerrar NC-007/)).toHaveCount(0);
  expect(await counts(page)).toEqual(before);
});

test('cerrar una NC exige un comentario de al menos 20 caracteres (5 se rechazan, 25 se aceptan)', async ({ page }) => {
  await openBoard(page, 'program_manager');
  await card(page, 'NC-003').dragTo(column(page, 'closed'));
  const close = dialog(page, 'Cerrar NC-003');
  await expect(close).toBeVisible();
  await expect(close.getByLabel('Comentario de cierre')).toBeFocused();
  await expect(close.getByTestId('nc-close-counter')).toHaveText('0 / 20');

  await close.getByLabel('Comentario de cierre').fill('corto');
  await expect(close.getByTestId('nc-close-counter')).toHaveText('5 / 20');
  await close.getByRole('button', { name: 'Cerrar no conformidad' }).click();
  await expect(close.getByRole('alert')).toHaveText('El comentario de cierre debe tener al menos 20 caracteres');
  await expect(close.getByLabel('Comentario de cierre')).toHaveAttribute('aria-invalid', 'true');
  expect(await codesIn(page, 'corrective_action')).toContain('NC-003');

  // Cancelar con Esc deja todo como estaba
  await page.keyboard.press('Escape');
  await expect(close).toBeHidden();
  expect(await codesIn(page, 'corrective_action')).toContain('NC-003');

  await card(page, 'NC-003').dragTo(column(page, 'closed'));
  await close.getByLabel('Comentario de cierre').fill('Acción correctiva verificada en banco.');
  await expect(close.getByTestId('nc-close-counter')).toHaveText('38 / 20');
  await close.getByRole('button', { name: 'Cerrar no conformidad' }).click();
  await expect(close).toBeHidden();
  await expect(toast(page, 'ok', 'NC-003 cerrada')).toBeVisible();
  await expect.poll(() => codesIn(page, 'closed')).toEqual(['NC-003', 'NC-004', 'NC-010']);

  // El comentario de cierre queda en el detalle, con su insignia, y la NC ya no admite más pasos
  await page.getByRole('button', { name: 'Abrir NC-003' }).click();
  const detail = dialog(page, 'Detalle de NC-003');
  await expect(detail.getByTestId('nc-state-badge')).toHaveAttribute('data-state', 'closed');
  await expect(detail.getByTestId('nc-comments')).toContainText('Acción correctiva verificada en banco.');
  await expect(detail.getByTestId('nc-comments').getByText('Cierre', { exact: true })).toBeVisible();
  await expect(detail.getByTestId('nc-transitions')).toContainText('Sin más cambios de estado posibles');
});

test('consultor: mueve entre columnas pero no puede cerrar (toast y sin diálogo)', async ({ page }) => {
  await openBoard(page, 'consultant');
  await card(page, 'NC-009').dragTo(column(page, 'closed'));
  await expect(toast(page, 'warn', 'Tu rol no permite cerrar no conformidades')).toBeVisible();
  await expect(dialog(page, /Cerrar NC-009/)).toHaveCount(0);
  expect(await codesIn(page, 'corrective_action')).toContain('NC-009');

  // En el menú, «Mover a «Cerrada»» queda deshabilitado con su motivo
  await page.getByRole('button', { name: 'Acciones para NC-009' }).click();
  await expect(page.getByRole('menuitem', { name: /Mover a «Cerrada»/ })).toBeDisabled();
  await expect(page.getByRole('menuitem', { name: /Mover a «Cerrada»/ })).toHaveAttribute('title', 'Tu rol no permite cerrar no conformidades');
  await page.keyboard.press('Escape');

  // Sí puede mover NC-008 de «En análisis» a «Acción correctiva»
  await card(page, 'NC-008').dragTo(column(page, 'corrective_action'));
  await expect(toast(page, 'ok', 'NC-008 pasó a «Acción correctiva»')).toBeVisible();
  await expect.poll(() => codesIn(page, 'corrective_action')).toEqual(['NC-008', 'NC-009']);
});

test('severidad con <sigpro-severity-picker> (Shadow DOM abierto): roles option, teclado y persistencia', async ({ page }) => {
  await openBoard(page, 'admin', '/nc/NC-012');
  const detail = dialog(page, 'Detalle de NC-012');
  // getByRole atraviesa el shadow root abierto
  const listbox = detail.getByRole('listbox', { name: 'Selector de severidad' });
  await expect(listbox).toBeVisible();
  await expect(detail.getByRole('option')).toHaveText(['Menor', 'Mayor', 'Crítica']);
  await expect(detail.getByRole('option', { name: 'Crítica' })).toHaveAttribute('aria-selected', 'true');
  await expect(detail.getByTestId('severity-picker-option-critical')).toHaveAttribute('data-severity', 'critical');
  // El host existe en el DOM normal; sus opciones viven dentro del shadow
  const host = detail.getByTestId('nc-severity-picker');
  expect(await host.evaluate((element) => element.tagName.toLowerCase())).toBe('sigpro-severity-picker');
  expect(await host.evaluate((element) => element.shadowRoot?.mode)).toBe('open');
  expect(await host.evaluate((element) => element.shadowRoot?.querySelectorAll('[role="option"]').length)).toBe(3);

  await expect(detail.getByRole('button', { name: /^Guardar$/ })).toBeDisabled();
  await detail.getByRole('option', { name: 'Mayor' }).click();
  await expect(detail.getByRole('option', { name: 'Mayor' })).toHaveAttribute('aria-selected', 'true');
  await expect(detail.getByRole('option', { name: 'Crítica' })).toHaveAttribute('aria-selected', 'false');
  await expect(detail.getByRole('button', { name: /^Guardar$/ })).toBeEnabled();
  await detail.getByRole('button', { name: /^Guardar$/ }).click();

  await expect(toast(page, 'ok', 'NC-012 guardada')).toBeVisible();
  await expect(detail.getByTestId('nc-severity-badge')).toHaveText('Mayor');
  await expect(detail.getByTestId('nc-severity-badge')).toHaveAttribute('data-severity', 'major');
  await expect(card(page, 'NC-012')).toHaveAttribute('data-severity', 'major');

  // Teclado: las flechas mueven el foco sin elegir; Intro elige
  await detail.getByRole('option', { name: 'Mayor' }).focus();
  await page.keyboard.press('ArrowLeft');
  await expect(detail.getByRole('option', { name: 'Menor' })).toBeFocused();
  await expect(detail.getByRole('option', { name: 'Mayor' })).toHaveAttribute('aria-selected', 'true');
  await page.keyboard.press('Enter');
  await expect(detail.getByRole('option', { name: 'Menor' })).toHaveAttribute('aria-selected', 'true');
  await detail.getByRole('button', { name: 'Guardar y cerrar' }).click();
  await expect(detail).toBeHidden();
  await expect(page).toHaveURL(/\/nc$/);

  await page.reload();
  await expect(card(page, 'NC-012')).toHaveAttribute('data-severity', 'minor');
  await expect(page.getByTestId('nc-card-severity-NC-012')).toHaveText('Menor');
});

test('asignación con combobox: escribir, elegir por teclado y por clic, y quitar', async ({ page }) => {
  await openBoard(page, 'admin', '/nc/NC-005');
  const detail = dialog(page, 'Detalle de NC-005');
  const combo = detail.getByRole('combobox', { name: 'Asignada a' });
  await expect(combo).toHaveValue('');
  await expect(combo).toHaveAttribute('placeholder', 'Buscar persona…');

  // Escribir filtra las sugerencias; ↓ + Intro elige por teclado
  await combo.fill('ja');
  const options = page.getByRole('listbox', { name: 'Personas' }).getByRole('option');
  await expect(options).toHaveText(['Javier Ortega']);
  await combo.press('ArrowDown');
  await combo.press('Enter');
  await expect(combo).toHaveValue('Javier Ortega');
  await detail.getByRole('button', { name: /^Guardar$/ }).click();
  await expect(toast(page, 'ok', 'NC-005 guardada')).toBeVisible();
  await expect(card(page, 'NC-005').getByAltText('Javier Ortega')).toBeVisible();

  // Por clic: cambia a otra persona
  await combo.fill('luc');
  await page.getByRole('option', { name: 'Lucía Fernández' }).click();
  await expect(combo).toHaveValue('Lucía Fernández');
  await detail.getByRole('button', { name: /^Guardar$/ }).click();
  await expect(card(page, 'NC-005').getByAltText('Lucía Fernández')).toBeVisible();

  // Sin coincidencias; al recargar sin guardar queda lo último guardado y se puede quitar la asignación
  await combo.fill('zzz');
  await expect(page.getByRole('listbox', { name: 'Personas' })).toContainText('Sin coincidencias');
  await page.goto('/nc/NC-005');
  await expect(dialog(page, 'Detalle de NC-005').getByRole('combobox', { name: 'Asignada a' })).toHaveValue('Lucía Fernández');
  await dialog(page, 'Detalle de NC-005').getByRole('button', { name: 'Quitar asignación' }).click();
  await expect(dialog(page, 'Detalle de NC-005').getByRole('combobox', { name: 'Asignada a' })).toHaveValue('');
  await dialog(page, 'Detalle de NC-005').getByRole('button', { name: 'Guardar y cerrar' }).click();
  await expect(card(page, 'NC-005').getByText('Sin asignar')).toBeVisible();
  await expect(card(page, 'NC-005').getByRole('img')).toHaveCount(0);
});

test('descripción enriquecida (contenteditable): negrita con atajo, guardado y saneado al recargar', async ({ page }) => {
  await openBoard(page, 'admin', '/nc/NC-011');
  const detail = dialog(page, 'Detalle de NC-011');
  const editor = detail.getByRole('textbox', { name: 'Descripción' });
  await editor.click();
  await page.keyboard.press('Control+A');
  await page.keyboard.press('Control+B');
  await page.keyboard.type('Fallo del enlace seguro');
  await expect(detail.getByRole('button', { name: 'Negrita' })).toHaveAttribute('aria-pressed', 'true');
  await detail.getByRole('button', { name: /^Guardar$/ }).click();
  await expect(toast(page, 'ok', 'NC-011 guardada')).toBeVisible();

  await page.goto('/nc/NC-011');
  await expect(dialog(page, 'Detalle de NC-011').getByRole('textbox', { name: 'Descripción' }).locator('strong')).toHaveText('Fallo del enlace seguro');
  // Una descripción demasiado corta se rechaza en el cliente con su mensaje
  const again = dialog(page, 'Detalle de NC-011');
  await again.getByRole('textbox', { name: 'Descripción' }).click();
  await page.keyboard.press('Control+A');
  await page.keyboard.type('corta');
  await again.getByRole('button', { name: /^Guardar$/ }).click();
  await expect(again.getByTestId('nc-description-error')).toHaveText('La descripción debe tener al menos 10 caracteres');
});

test('comentarios del detalle: error inline si está vacío y alta con toast', async ({ page }) => {
  await openBoard(page, 'consultant', '/nc/NC-008');
  const detail = dialog(page, 'Detalle de NC-008');
  await expect(detail.getByTestId('nc-comments-empty')).toHaveText('Todavía no hay comentarios');

  await detail.getByRole('button', { name: 'Comentar' }).click();
  await expect(detail.getByTestId('nc-comment-error')).toHaveText('Escribe un comentario');
  await expect(detail.getByRole('textbox', { name: 'Añadir comentario' })).toHaveAttribute('aria-invalid', 'true');

  await detail.getByRole('textbox', { name: 'Añadir comentario' }).fill('Pendiente de la prueba de aceptación.');
  await detail.getByRole('button', { name: 'Comentar' }).click();
  await expect(toast(page, 'ok', 'Comentario añadido')).toBeVisible();
  await expect(detail.getByTestId('nc-comments').getByRole('listitem')).toHaveCount(1);
  await expect(detail.getByTestId('nc-comments')).toContainText('Pendiente de la prueba de aceptación.');
  await expect(detail.getByTestId('nc-comments').getByAltText('Lucía Fernández')).toBeVisible();
  await expect(detail.getByRole('textbox', { name: 'Añadir comentario' })).toHaveValue('');

  // La tarjeta del tablero se actualiza
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('nc-card-comments-NC-008')).toContainText('1 comentario');
});

test('comentario rápido con el prompt() nativo: aceptar con texto, texto vacío y cancelar', async ({ page }) => {
  await openBoard(page);
  const seen: { type: string; message: string }[] = [];

  // Aceptar con texto
  page.once('dialog', async (nativeDialog) => {
    seen.push({ type: nativeDialog.type(), message: nativeDialog.message() });
    await nativeDialog.accept('Seguimiento desde el prompt nativo');
  });
  await page.getByRole('button', { name: 'Comentario rápido NC-004' }).click();
  await expect(toast(page, 'ok', 'Comentario añadido a NC-004')).toBeVisible();
  expect(seen).toEqual([{ type: 'prompt', message: 'Comentario rápido para NC-004' }]);

  // Aceptar sin texto: aviso y no se guarda nada
  page.once('dialog', (nativeDialog) => void nativeDialog.accept('   '));
  await page.getByRole('button', { name: 'Comentario rápido NC-004' }).click();
  await expect(toast(page, 'warn', 'El comentario rápido no puede estar vacío')).toBeVisible();

  // Cancelar: ni toast ni comentario
  page.once('dialog', (nativeDialog) => void nativeDialog.dismiss());
  await page.getByRole('button', { name: 'Comentario rápido NC-004' }).click();
  await expect(page.getByTestId('toast-danger')).toHaveCount(0);

  // El comentario quedó en el detalle, marcado como «Rápido» (los otros dos intentos no guardaron nada)
  await page.getByRole('button', { name: 'Abrir NC-004' }).click();
  const comments = dialog(page, 'Detalle de NC-004').getByTestId('nc-comments');
  await expect(comments.getByRole('listitem')).toHaveCount(2);
  await expect(comments).toContainText('Seguimiento desde el prompt nativo');
  await expect(comments.getByText('Rápido', { exact: true })).toBeVisible();
});

test('alta de una no conformidad: errores por campo, selector Shadow DOM y tarjeta en «Abierta»', async ({ page }) => {
  await openBoard(page, 'consultant');
  const badge = page.getByTestId('nav-badge-nc');
  const openBefore = Number(await badge.textContent());

  await page.getByRole('button', { name: 'Nueva no conformidad' }).click();
  const form = dialog(page, 'Nueva no conformidad');
  await expect(form).toBeVisible();
  await form.getByRole('button', { name: 'Abrir no conformidad' }).click();
  await expect(form.getByTestId('nc-new-program-error')).toHaveText('Elige un programa');
  await expect(form.getByTestId('nc-new-severity-error')).toHaveText('Elige una severidad');
  await expect(form.getByTestId('nc-new-description-error')).toHaveText('La descripción debe tener al menos 10 caracteres');

  await form.getByLabel('Programa').selectOption('PRG-002');
  await form.getByTestId('nc-new-severity').getByRole('option', { name: 'Crítica' }).click();
  await form.getByRole('textbox', { name: 'Descripción' }).fill('Fallo intermitente del enlace de datos');
  await form.getByRole('button', { name: 'Abrir no conformidad' }).click();

  await expect(toast(page, 'ok', 'NC-013 abierta')).toBeVisible();
  await expect(form).toBeHidden();
  await expect(card(page, 'NC-013')).toHaveAttribute('data-severity', 'critical');
  await expect(column(page, 'open').getByTestId('nc-card-NC-013')).toBeVisible();
  await expect(card(page, 'NC-013').getByText('Sin asignar')).toBeVisible();
  await expect(page.getByTestId('nc-count')).toContainText('13 no conformidades');
  // La insignia del menú se actualiza sola con el evento de Socket.IO
  await expect(badge).toHaveText(String(openBefore + 1));
});

test('estados de carga y de error: skeleton con aria-busy, 503 con traza y reintento', async ({ page }) => {
  await openAs(page, 'admin', '/programs', { tenant: TENANT });
  await page.route('**/api/nc', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 900));
    await route.continue();
  });
  await page.goto('/nc');
  await expect(page.getByTestId('nc-board')).toHaveAttribute('aria-busy', 'true');
  await expect(page.getByTestId('skeleton-row').first()).toBeVisible();
  await expect(page.getByTestId('nc-board')).toHaveAttribute('aria-busy', 'false');
  await expect(page.getByTestId('skeleton-row')).toHaveCount(0);
  await page.unroute('**/api/nc');

  await page.route('**/api/nc', (route) => route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ statusCode: 503, error: 'Service Unavailable', message: 'down' }) }));
  await page.goto('/nc');
  await expect(page.getByTestId('nc-error')).toContainText('No se pudo cargar el tablero');
  await expect(page.getByTestId('nc-error')).toContainText('GET /api/nc → 503 Service Unavailable');
  await page.unroute('**/api/nc');
  await page.getByRole('button', { name: 'Reintentar' }).click();
  await expect(page.getByTestId('nc-error')).toHaveCount(0);
  await expect(page.getByTestId(CARD).first()).toBeVisible();
});

test('móvil (390 px): el tablero hace scroll horizontal y el menú ⋯ permite mover sin arrastrar', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openBoard(page, 'admin');
  const board = page.getByTestId('nc-board');
  expect(await board.evaluate((element) => element.scrollWidth > element.clientWidth)).toBe(true);
  await expect(column(page, 'rejected')).not.toBeInViewport();
  await column(page, 'rejected').scrollIntoViewIfNeeded();
  await expect(column(page, 'rejected')).toBeInViewport({ ratio: 0.5 });

  await page.getByRole('button', { name: 'Acciones para NC-012' }).scrollIntoViewIfNeeded();
  await page.getByRole('button', { name: 'Acciones para NC-012' }).click();
  await page.getByRole('menuitem', { name: /Mover a «En análisis»/ }).click();
  await expect(toast(page, 'ok', 'NC-012 pasó a «En análisis»')).toBeVisible();
  await expect.poll(() => codesIn(page, 'in_analysis')).toContain('NC-012');
});

