import type { Locator, Page } from '@playwright/test';
import { defineBrowserRows, type BrowserRowHandler, type Outcome } from '../../core/framework';
import { ACTION, holdsFor, safe, waitUntil } from '../../support/browser';
import { cell, check, preparationFailedWeb, strict, type Check } from '../../support/checks';
import { field } from '../../../story-runs/support/api';
import { ACCOUNT_OF, TENANT_A, act, loginAs, resetTenants, verdict } from '../api/common';
import { REQUISITOS_TESTIDS } from '../../../../packages/shared/src/testids';
import { actionFailed, inOrder, interact, isAbsent, isShown, menuItem, noOkToast, onWeb, openRequirements, panelBadge, readText, rowMenuOf, rowOf, signIn, stateCheck, titleButtonOf, toastShown, type AccountName, type WebAction } from './common';

// US-REQ-EDICION-009 — Editar un requisito en su panel y en su fila (web, escritorio 1440 px). Preparación de cada fila: reinicio de
// alumno01, inicio de sesión en /login?tenant=alumno01 y apertura de /programs/PRG-001/requirements. Estado del seed: REQ-001 aprobado
// («Disponibilidad del subsistema 001», priority high, tags [security]), REQ-002 verificado («Latencia del subsistema 002»).
// Las insignias de estado se leen del PANEL abierto (la del árbol repite el estado de cada fila). Guardar es el botón «Guardar» exacto.

const TITLE_FIELD = (page: Page): Locator => page.getByRole('textbox', { name: 'Título', exact: true }).or(page.getByTestId(REQUISITOS_TESTIDS.REQUIREMENT_TITLE));
const PRIORITY_FIELD = (page: Page): Locator => page.getByRole('combobox', { name: 'Prioridad', exact: true }).or(page.getByTestId(REQUISITOS_TESTIDS.REQUIREMENT_PRIORITY));
const DESCRIPTION_FIELD = (page: Page): Locator => page.getByTestId(REQUISITOS_TESTIDS.REQUIREMENT_DESCRIPTION).locator('[contenteditable="true"]').or(page.getByTestId(REQUISITOS_TESTIDS.REQUIREMENT_DESCRIPTION));
const TAGS_INPUT = (page: Page): Locator => page.getByRole('combobox', { name: 'Etiquetas', exact: true }).or(page.getByTestId(REQUISITOS_TESTIDS.REQUIREMENT_TAGS_INPUT));
const SAVE = (page: Page): Locator => page.getByRole('button', { name: 'Guardar', exact: true }).or(page.getByTestId(REQUISITOS_TESTIDS.REQUIREMENT_SAVE));
const REVERT_NOTICE = (page: Page): Locator => page.getByTestId(REQUISITOS_TESTIDS.REQUIREMENT_REVERT_NOTICE);
const TITLE_ERROR = (page: Page): Locator => page.getByTestId(REQUISITOS_TESTIDS.REQUIREMENT_TITLE_ERROR);
const INLINE = (page: Page): Locator => page.getByTestId(REQUISITOS_TESTIDS.REQUIREMENT_INLINE_INPUT);

const NOTICE_TEXT = 'Este requisito está en estado aprobado. Si cambias el título o la descripción volverá a Borrador.';
const DESCRIPTION_TEXT = 'Texto de prueba';

/** Abre el panel de un requisito pulsando su título. */
const openDetail = (code: string): WebAction => (page) => interact(titleButtonOf(page, code), `abrir el panel de ${code}`, (element) => element.click(ACTION));

/** Pulsa una tecla en la página; si falla, el diagnóstico lo dice. */
const pressKey = (key: string): WebAction => async (page) => {
  try {
    await page.keyboard.press(key);
    return undefined;
  } catch (error) {
    return { message: `no se pudo pulsar ${key}: ${String(error)}`, note: 'el teclado no llegó a la página' };
  }
};

/** Sustituye el contenido del editor de descripción: clic, seleccionar todo y escribir. */
const replaceDescription = (text: string): WebAction => (page) =>
  inOrder(
    (current) => interact(DESCRIPTION_FIELD(current), 'escribir en «Descripción»', (element) => element.click(ACTION)),
    pressKey('Control+A'),
    (current) => interact(current.locator(':focus'), `escribir «${text}» en «Descripción»`, (element) => element.pressSequentially(text, { delay: 0 })),
  )(page);

/** Preparación común: reinicio, inicio de sesión y apertura del árbol. */
const prepare = async (page: Page, account: AccountName, expected: string): Promise<Outcome | undefined> => {
  await resetTenants([TENANT_A]);
  const failure = (await signIn(page, account)) ?? (await openRequirements(page));
  return failure === undefined ? undefined : preparationFailedWeb(expected, failure);
};

/** Estado de un requisito leído por la API con la cuenta gestor (persistencia). */
const storedOf = async (code: string) => {
  const session = await loginAs(strict('cuenta', ACCOUNT_OF, 'gestor@sigpro.test'));
  return session.token === undefined ? undefined : act('GET', `/requirements/${code}`, session.token);
};

/** Descripción guardada sin el <p> exterior (si lo hay). */
const bareDescription = (body: unknown): string => String(field(body, 'description') ?? '').replace(/^<p>([\s\S]*)<\/p>$/, '$1');

/** Insignia del panel (la del árbol no cuenta). */
const panelState = (page: Page): Promise<string | undefined> => readText(panelBadge(page));

// --- Un cambio de prioridad o de etiquetas guarda sin devolver a borrador --------------------------------------------------

/** Cambios de la celda: cómo se modifica el panel antes de guardar. */
const CHANGE_OF: ReadonlyMap<string, WebAction> = new Map<string, WebAction>([
  ['cambia «Prioridad» a «Baja»', (page) => interact(PRIORITY_FIELD(page), 'elegir «Baja» en «Prioridad»', (element) => element.selectOption({ label: 'Baja' }, ACTION))],
  [
    'añade la etiqueta «Normativo» en «Etiquetas»',
    (page) =>
      inOrder(
        (current) => interact(TAGS_INPUT(current), 'abrir «Etiquetas»', (element) => element.click(ACTION)),
        (current) => interact(current.getByRole('option', { name: 'Normativo', exact: true }), 'elegir «Normativo»', (element) => element.click(ACTION)),
      )(page),
  ],
  ['cambia «Título» a Disponibilidad revisada del subsistema 001', (page) => interact(TITLE_FIELD(page), 'escribir en «Título»', (element) => element.fill('Disponibilidad revisada del subsistema 001', ACTION))],
  ['escribe Texto revisado del requisito en «Descripción»', replaceDescription('Texto revisado del requisito')],
]);

/** Efecto de guardar según el cambio: el aviso, el estado que queda y el campo que debe quedar guardado (lectura y valor esperado). */
interface SaveExpect {
  readonly toastBody: string;
  readonly badge: string;
  readonly apiState: string;
  readonly label: string;
  readonly read: (body: unknown) => unknown;
  readonly want: unknown;
}

const SAVE_OF_CHANGE: ReadonlyMap<string, SaveExpect> = new Map<string, SaveExpect>([
  ['cambia «Prioridad» a «Baja»', { toastBody: 'REQ-001 actualizado', badge: 'Aprobado', apiState: 'approved', label: 'prioridad', read: (body) => field(body, 'priority'), want: 'low' }],
  [
    'añade la etiqueta «Normativo» en «Etiquetas»',
    { toastBody: 'REQ-001 actualizado', badge: 'Aprobado', apiState: 'approved', label: 'etiquetas', read: (body) => field(body, 'tags'), want: ['security', 'regulatory'] },
  ],
  [
    'cambia «Título» a Disponibilidad revisada del subsistema 001',
    { toastBody: 'REQ-001 volvió a Borrador', badge: 'Borrador', apiState: 'draft', label: 'título', read: (body) => field(body, 'title'), want: 'Disponibilidad revisada del subsistema 001' },
  ],
  [
    'escribe Texto revisado del requisito en «Descripción»',
    { toastBody: 'REQ-001 volvió a Borrador', badge: 'Borrador', apiState: 'draft', label: 'descripción', read: bareDescription, want: 'Texto revisado del requisito' },
  ],
]);

/** Comprobación de lo guardado en la API: el campo del cambio tiene el valor esperado. */
const savedCheck = (body: unknown, spec: SaveExpect): Check => {
  const observed = spec.read(body) ?? null;
  return check(JSON.stringify(observed) === JSON.stringify(spec.want), `${spec.label} guardado: ${JSON.stringify(spec.want)}`, `${spec.label} guardado: ${JSON.stringify(observed)}`);
};

/** Pulsa «Guardar» del panel. */
const pressSave: WebAction = (page) => interact(SAVE(page), 'pulsar «Guardar»', (element) => element.click(ACTION));

const savesWithoutReverting: BrowserRowHandler = async (row, { page }) => {
  const expected = 'pulsar «Guardar»: aviso «Requisito guardado» con «REQ-001 actualizado»; el estado de REQ-001 en el panel es «Aprobado»';
  const failure = await prepare(page, 'gestor', expected);
  if (failure !== undefined) return failure;
  const save = strict('cambio', SAVE_OF_CHANGE, cell(row, 'cambio'));
  const blocked = await inOrder(openDetail('REQ-001'), strict('cambio', CHANGE_OF, cell(row, 'cambio')), pressSave)(page);
  if (blocked !== undefined) return actionFailed(expected, blocked);
  const toast = await toastShown(page, 'ok', 'Requisito guardado', 'REQ-001 actualizado');
  const badge = await panelState(page);
  const stored = await storedOf('REQ-001');
  return verdict([
    check(toast.seen, '«Requisito guardado» con «REQ-001 actualizado»', `aviso ${toast.observed}`),
    check(badge === 'Aprobado', 'REQ-001 en el panel «Aprobado»', `REQ-001 en el panel «${badge ?? '(sin leer)'}»`),
    check(stored?.status === 200 && field(stored.body, 'state') === 'approved', 'REQ-001 sigue approved en la API', `REQ-001 en la API con state ${stored === undefined ? '(sin leer)' : String(field(stored.body, 'state'))}`),
    stored?.status === 200 ? savedCheck(stored.body, save) : check(false, `${save.label} guardado`, 'REQ-001 no se pudo leer'),
  ]);
};

// --- Un cambio de título o de descripción de un aprobado lo devuelve a borrador -----------------------------------------

const revertsOnTextChange: BrowserRowHandler = async (row, { page }) => {
  const change = cell(row, 'cambio');
  const save = strict('cambio', SAVE_OF_CHANGE, change);
  const expected = `pulsar «Guardar»: aviso «Requisito guardado» con «${save.toastBody}»; el estado de REQ-001 en el panel es «${save.badge}»`;
  const failure = await prepare(page, 'gestor', expected);
  if (failure !== undefined) return failure;
  const blocked = await inOrder(openDetail('REQ-001'), strict('cambio', CHANGE_OF, change), pressSave)(page);
  if (blocked !== undefined) return actionFailed(expected, blocked);
  const toast = await toastShown(page, 'ok', 'Requisito guardado', save.toastBody);
  const badge = await panelState(page);
  const stored = await storedOf('REQ-001');
  return verdict([
    check(toast.seen, `«Requisito guardado» con «${save.toastBody}»`, `aviso ${toast.observed}`),
    check(badge === save.badge, `REQ-001 en el panel «${save.badge}»`, `REQ-001 en el panel «${badge ?? '(sin leer)'}»`),
    check(stored?.status === 200 && field(stored.body, 'state') === save.apiState, `REQ-001 en la API con state ${save.apiState}`, `REQ-001 en la API con state ${stored === undefined ? '(sin leer)' : String(field(stored.body, 'state'))}`),
    stored?.status === 200 ? savedCheck(stored.body, save) : check(false, `${save.label} guardado`, 'REQ-001 no se pudo leer'),
  ]);
};

// --- El aviso de vuelta a borrador aparece solo al cambiar el texto -------------------------------------------------------

const NOTICE_OF: ReadonlyMap<string, { readonly visible: boolean; readonly text?: string }> = new Map([
  ['ve el aviso «Este requisito está en estado aprobado. Si cambias el título o la descripción volverá a Borrador.»', { visible: true, text: NOTICE_TEXT }],
  ['no ve ningún aviso de vuelta a borrador', { visible: false }],
]);

const noticeOnTextOnly: BrowserRowHandler = async (row, { page }) => {
  const notice = strict('aviso', NOTICE_OF, cell(row, 'aviso'));
  const expected = notice.visible ? `aparece el aviso «${NOTICE_TEXT}» con REQ-001 aprobado` : 'no aparece ningún aviso de vuelta a borrador';
  const failure = await prepare(page, 'gestor', expected);
  if (failure !== undefined) return failure;
  const blocked = await inOrder(openDetail('REQ-001'), strict('cambio', CHANGE_OF, cell(row, 'cambio')))(page);
  if (blocked !== undefined) return actionFailed(expected, blocked);
  if (notice.visible) {
    const shown = await waitUntil(async () => (await readText(REVERT_NOTICE(page))) === notice.text);
    const text = await readText(REVERT_NOTICE(page));
    return verdict([check(shown.reached, `aparece el aviso «${notice.text ?? ''}»`, text === undefined ? 'no aparece ningún aviso de vuelta a borrador' : `aparece el aviso «${text}»`)]);
  }
  // Ausencia comprobada por recuento: un error de lectura cuenta como no cumplido
  const hidden = await holdsFor(() => isAbsent(REVERT_NOTICE(page)));
  return verdict([check(hidden.held, 'no aparece ningún aviso de vuelta a borrador', hidden.held ? 'no aparece ningún aviso de vuelta a borrador' : 'aparece el aviso de vuelta a borrador')]);
};

// --- Un título no válido no se guarda -------------------------------------------------------------------------------------

const INVALID_TITLE_OF: ReadonlyMap<string, string> = new Map([
  ['ab', 'ab'],
  ['(121 letras a)', 'a'.repeat(121)],
]);

const NOTICE_TEXT_OF: ReadonlyMap<string, string> = new Map([
  ['«El título debe tener al menos 3 caracteres»', 'El título debe tener al menos 3 caracteres'],
  ['«El título admite hasta 120 caracteres»', 'El título admite hasta 120 caracteres'],
]);

const invalidTitleIsNotSaved: BrowserRowHandler = async (row, { page }) => {
  const value = strict('título', INVALID_TITLE_OF, cell(row, 'titulo'));
  const notice = strict('aviso', NOTICE_TEXT_OF, cell(row, 'aviso'));
  const expected = `bajo «Título» el aviso «${notice}»; REQ-002 conserva «Latencia del subsistema 002» y su estado «Verificado»`;
  const failure = await prepare(page, 'gestor', expected);
  if (failure !== undefined) return failure;
  const blocked = await inOrder(
    openDetail('REQ-002'),
    (current) => interact(TITLE_FIELD(current), `escribir «${value}» en «Título»`, (element) => element.fill(value, ACTION)),
    pressSave,
  )(page);
  if (blocked !== undefined) return actionFailed(expected, blocked);
  const shown = await waitUntil(async () => (await readText(TITLE_ERROR(page))) === notice);
  const noticeText = await readText(TITLE_ERROR(page));
  const stored = await storedOf('REQ-002');
  return verdict([
    check(shown.reached, `bajo «Título» el aviso «${notice}»`, noticeText === undefined ? 'bajo «Título» no aparece ningún aviso' : `bajo «Título» el aviso «${noticeText}»`),
    check(field(stored?.body ?? null, 'title') === 'Latencia del subsistema 002', 'REQ-002 conserva su título «Latencia del subsistema 002»', `REQ-002 tiene el título «${String(field(stored?.body ?? null, 'title'))}»`),
    check(field(stored?.body ?? null, 'state') === 'verified', 'REQ-002 conserva su estado «Verificado»', `REQ-002 tiene el estado «${String(field(stored?.body ?? null, 'state'))}»`),
  ]);
};

// --- La edición en la fila guarda con Intro y cancela con Esc --------------------------------------------------------------

const INLINE_ACTION_OF: ReadonlyMap<string, 'dblclick-intro' | 'f2-intro' | 'dblclick-esc' | 'dblclick-invalid'> = new Map([
  ['hace doble clic en el título de REQ-002, escribe Latencia revisada del subsistema 002 y pulsa Intro', 'dblclick-intro'],
  ['elige REQ-002, pulsa F2, escribe Latencia revisada del subsistema 002 y pulsa Intro', 'f2-intro'],
  ['hace doble clic en el título de REQ-002, escribe Latencia cambiada y pulsa Esc', 'dblclick-esc'],
  ['hace doble clic en el título de REQ-002, escribe ab y pulsa Intro', 'dblclick-invalid'],
]);

const NEW_INLINE_TITLE_OF = { 'dblclick-intro': 'Latencia revisada del subsistema 002', 'f2-intro': 'Latencia revisada del subsistema 002', 'dblclick-esc': 'Latencia cambiada', 'dblclick-invalid': 'ab' } as const;

const inlineEdit: BrowserRowHandler = async (row, { page }) => {
  const kind = strict('acción', INLINE_ACTION_OF, cell(row, 'accion'));
  const expected = cell(row, 'resultado');
  const failure = await prepare(page, 'gestor', expected);
  if (failure !== undefined) return failure;
  const typed = NEW_INLINE_TITLE_OF[kind];
  // «elige la fila» se implementa como foco en la fila (no hay clic): el panel no se abre con F2 y el foco queda en el árbol
  const start: WebAction =
    kind === 'f2-intro'
      ? (current) => interact(rowOf(current, 'REQ-002'), 'elegir la fila de REQ-002 (foco)', (element) => element.focus(ACTION))
      : (current) => interact(titleButtonOf(current, 'REQ-002'), 'hacer doble clic en el título de REQ-002', (element) => element.dblclick(ACTION));
  const starter: WebAction = kind === 'f2-intro' ? inOrder(start, pressKey('F2')) : start;
  const finish = kind === 'dblclick-esc' ? pressKey('Escape') : pressKey('Enter');
  const blocked = await inOrder(
    starter,
    (current) => interact(INLINE(current), `escribir «${typed}» en la fila`, (element) => element.fill(typed, ACTION)),
    finish,
  )(page);
  if (blocked !== undefined) return actionFailed(expected, blocked);
  const endedAt = Date.now();
  const stored = await storedOf('REQ-002');
  const currentTitle = field(stored?.body ?? null, 'title');
  if (kind === 'dblclick-esc') {
    // Ningún aviso de guardado (de ningún tipo de éxito), no solo el de «volvió a Borrador»
    const quiet = await noOkToast(page, endedAt);
    return verdict([
      check(currentTitle === 'Latencia del subsistema 002', 'el título de REQ-002 sigue siendo «Latencia del subsistema 002»', `el título de REQ-002 es «${String(currentTitle)}»`),
      check(quiet.held, 'no aparece ningún aviso de guardado', quiet.held ? 'no aparece ningún aviso de guardado' : `aparece ${quiet.seen}`),
    ]);
  }
  const toast = await toastShown(page, 'ok', 'Requisito guardado', 'REQ-002 volvió a Borrador');
  if (kind === 'dblclick-invalid') {
    const explanation = await safe(() => INLINE(page).getAttribute('title', { timeout: 1_000 }), null);
    const stillOpen = await isShown(INLINE(page));
    return verdict([
      check(stillOpen, 'el campo sigue abierto', stillOpen ? 'el campo sigue abierto' : 'el campo se cerró'),
      check(explanation === 'El título debe tener al menos 3 caracteres', 'la explicación del campo es «El título debe tener al menos 3 caracteres»', `la explicación del campo es «${explanation ?? '(sin explicación)'}»`),
      check(currentTitle === 'Latencia del subsistema 002', 'el título de REQ-002 no cambia', `el título de REQ-002 es «${String(currentTitle)}»`),
    ]);
  }
  return verdict([
    check(toast.seen, '«Requisito guardado» con «REQ-002 volvió a Borrador»', `aviso ${toast.observed}`),
    check(currentTitle === 'Latencia revisada del subsistema 002', 'el título de REQ-002 es «Latencia revisada del subsistema 002»', `el título de REQ-002 es «${String(currentTitle)}»`),
  ]);
};

// --- Un rol sin permiso de edición no cambia nada -----------------------------------------------------------------------

const READONLY_OF: ReadonlyMap<string, 'title' | 'save' | 'rename'> = new Map([
  ['elige REQ-001 en el árbol y mira el campo «Título»', 'title'],
  ['elige REQ-001 en el árbol y mira «Guardar»', 'save'],
  ['abre el menú de la fila de REQ-001', 'rename'],
]);

const READONLY_RESULT_OF: ReadonlyMap<string, string> = new Map([
  ['el campo «Título» es de solo lectura', 'el campo «Título» es de solo lectura'],
  ['«Guardar» está deshabilitado con la explicación «Tu rol no permite editar requisitos»', '«Guardar» está deshabilitado con la explicación «Tu rol no permite editar requisitos»'],
  ['«Renombrar» está deshabilitado con la explicación «Tu rol no permite editar requisitos»', '«Renombrar» está deshabilitado con la explicación «Tu rol no permite editar requisitos»'],
]);

const readOnlyForAuditor: BrowserRowHandler = async (row, { page }) => {
  const expected = strict('resultado', READONLY_RESULT_OF, cell(row, 'resultado'));
  const failure = await prepare(page, 'auditor', expected);
  if (failure !== undefined) return failure;
  const kind = strict('acción', READONLY_OF, cell(row, 'accion'));
  if (kind === 'rename') {
    const opened = await interact(rowMenuOf(page, 'REQ-001'), 'abrir «Acciones para REQ-001»', (element) => element.click(ACTION));
    if (opened !== undefined) return actionFailed(expected, opened);
    return verdict([await stateCheck(menuItem(page, 'REQ-001', 'Renombrar'), 'deshabilitado', 'Tu rol no permite editar requisitos')]);
  }
  const opened = await openDetail('REQ-001')(page);
  if (opened !== undefined) return actionFailed(expected, opened);
  if (kind === 'save') return verdict([await stateCheck(SAVE(page), 'deshabilitado', 'Tu rol no permite editar requisitos')]);
  const readonly = await safe(() => TITLE_FIELD(page).evaluate((element) => (element as HTMLInputElement).readOnly, undefined, { timeout: 2_000 }), undefined);
  return verdict([check(readonly === true, 'el campo «Título» es de solo lectura', readonly === undefined ? 'el campo «Título» no se pudo leer' : readonly ? 'el campo «Título» es de solo lectura' : 'el campo «Título» es editable')]);
};

// --- El formato del texto de la descripción se guarda con el requisito ---------------------------------------------------

const FORMAT_OF: ReadonlyMap<string, { readonly button: string; readonly testId: string }> = new Map([
  ['«Negrita»', { button: 'Negrita', testId: REQUISITOS_TESTIDS.REQUIREMENT_EDITOR_BOLD }],
  ['«Cursiva»', { button: 'Cursiva', testId: REQUISITOS_TESTIDS.REQUIREMENT_EDITOR_ITALIC }],
  ['«Lista»', { button: 'Lista', testId: REQUISITOS_TESTIDS.REQUIREMENT_EDITOR_LIST }],
]);

/** Forma guardada de la descripción (sin el <p> exterior) para cada formato de la celda. */
const FORMATO_OF: ReadonlyMap<string, { readonly html: string }> = new Map([
  ['negrita', { html: `<strong>${DESCRIPTION_TEXT}</strong>` }],
  ['cursiva', { html: `<em>${DESCRIPTION_TEXT}</em>` }],
  ['forma de lista', { html: `<ul><li>${DESCRIPTION_TEXT}</li></ul>` }],
]);

const formatIsKept: BrowserRowHandler = async (row, { page }) => {
  const format = strict('botón', FORMAT_OF, cell(row, 'boton'));
  const wanted = strict('formato', FORMATO_OF, cell(row, 'formato'));
  const expected = `la descripción guardada de REQ-002 muestra «${DESCRIPTION_TEXT}» con ${cell(row, 'formato')}`;
  const failure = await prepare(page, 'gestor', expected);
  if (failure !== undefined) return failure;
  const blocked = await inOrder(
    openDetail('REQ-002'),
    replaceDescription(DESCRIPTION_TEXT),
    pressKey('Control+A'),
    (current) => interact(current.getByRole('button', { name: format.button, exact: true }).or(current.getByTestId(format.testId)), `pulsar «${format.button}»`, (element) => element.click(ACTION)),
    pressSave,
  )(page);
  if (blocked !== undefined) return actionFailed(expected, blocked);
  const toast = await toastShown(page, 'ok', 'Requisito guardado', 'REQ-002 volvió a Borrador');
  const stored = await storedOf('REQ-002');
  const description = String(field(stored?.body ?? null, 'description') ?? '');
  return verdict([
    check(toast.seen, '«Requisito guardado» con «REQ-002 volvió a Borrador»', `aviso ${toast.observed}`),
    check(bareDescription(stored?.body ?? null) === wanted.html, `la descripción guardada es ${wanted.html}`, `la descripción guardada es ${description === '' ? '(vacía)' : description}`),
  ]);
};

defineBrowserRows({
  story: 'US-REQ-EDICION-009',
  surface: 'web',
  tenants: [TENANT_A],
  handlers: new Map<number, BrowserRowHandler>([
    [1, onWeb(savesWithoutReverting)],
    [2, onWeb(revertsOnTextChange)],
    [3, onWeb(noticeOnTextOnly)],
    [4, onWeb(invalidTitleIsNotSaved)],
    [5, onWeb(inlineEdit)],
    [6, onWeb(readOnlyForAuditor)],
    [7, onWeb(formatIsKept)],
  ]),
});
