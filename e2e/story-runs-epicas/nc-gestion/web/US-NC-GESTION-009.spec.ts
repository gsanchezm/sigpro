import type { Locator, Page } from '@playwright/test';
import { NC_TESTIDS } from '../../../../packages/shared/src/testids';
import { defineBrowserRows, notExecutable, type BrowserRowHandler, type ManifestRow, type Outcome } from '../../core/framework';
import { cell, check, preparationFailedWeb, strict } from '../../support/checks';
import { ACTION, waitUntil } from '../../support/browser';
import { actionFailed, armDragLog, armToasts, closeDialog, columnOf, controlCheck, controlOf, detailDialog, dragStarts, interact, isDragOutcome, observe, onWeb, performDrag, prepareWeb, readDetail, toastShown, verdictWeb, waitDetail, visibleText, type DetailView } from './common';
import { persistedState } from '../api/common';

// US-NC-GESTION-009 — Cierre de NC-003 con su comentario desde el detalle (/nc/NC-003) y desde el tablero (arrastrar la tarjeta a «Cerrada»).
// Preparación de cada fila: reinicio de alumno01 con el token de su administrador; la cuenta de la fila inicia sesión y abre la dirección
// que dice la historia. NC-003 está en «Acción correctiva» tras el reinicio. El cambio se comprueba en el servidor después del aviso, y la
// petición de cierre lleva el comentario recortado (se captura su cuerpo).

const TRANSITION_PATH = '/api/nc/NC-003/transition';
const CLOSED_TOAST = 'NC-003 cerrada';
const SHORT_ERROR = 'El comentario de cierre debe tener al menos 20 caracteres';
const REQUIRED_ERROR = 'El comentario de cierre es obligatorio';
const DENIED = 'Tu rol no permite cerrar no conformidades';
const NO_MORE = 'Sin más cambios de estado posibles';

const ACCOUNT_CELLS: ReadonlyMap<string, string> = new Map<string, string>([
  ['alumno01@sigpro.lab', 'alumno01@sigpro.lab'],
  ['gestor@sigpro.test', 'gestor@sigpro.test'],
  ['consultor@sigpro.test', 'consultor@sigpro.test'],
  ['auditor@sigpro.test', 'auditor@sigpro.test'],
]);

/** Texto del comentario de cierre (sin las comillas de la celda): la celda «(N letras a)» o «(un espacio, … y un espacio)». */
const TEXT_CELLS: ReadonlyMap<string, string> = new Map<string, string>([
  ['(19 letras a)', 'a'.repeat(19)],
  ['(20 letras a)', 'a'.repeat(20)],
  ['(21 letras a)', 'a'.repeat(21)],
  ['(un espacio, 19 letras a y un espacio)', ` ${'a'.repeat(19)} `],
  ['(un espacio, 20 letras a y un espacio)', ` ${'a'.repeat(20)} `],
  ['(vacío)', ''],
  ['(tres espacios)', '   '],
]);

const COUNTER_CELLS: ReadonlyMap<string, string> = new Map<string, string>([
  ['19 / 20', '19 / 20'],
  ['20 / 20', '20 / 20'],
  ['21 / 20', '21 / 20'],
]);

/** Resultado de la celda: un error bajo el campo (con su texto) o el aviso de cierre. */
const RESULT_CELLS: ReadonlyMap<string, { readonly kind: 'error'; readonly text: string } | { readonly kind: 'closed' }> = new Map<string, { readonly kind: 'error'; readonly text: string } | { readonly kind: 'closed' }>([
  ['ve el mensaje «El comentario de cierre debe tener al menos 20 caracteres» bajo el campo y no se envía ninguna petición', { kind: 'error', text: SHORT_ERROR }],
  ['ve el aviso «NC-003 cerrada»', { kind: 'closed' }],
  ['ve el mensaje «El comentario de cierre debe tener al menos 20 caracteres» y el diálogo «Cerrar NC-003» sigue abierto', { kind: 'error', text: SHORT_ERROR }],
  ['ve el aviso «NC-003 cerrada», el diálogo se cierra y la tarjeta queda en la columna «Cerrada»', { kind: 'closed' }],
]);

const ROLE_RESULT_CELLS: ReadonlyMap<string, 'enabled' | 'denied'> = new Map<string, 'enabled' | 'denied'>([
  ['el botón está habilitado y al pulsarlo aparece el formulario de cierre en el detalle', 'enabled'],
  ['el botón está deshabilitado con la explicación «Tu rol no permite cerrar no conformidades»', 'denied'],
]);

const CANCEL_CELLS: ReadonlyMap<string, 'pulsa «Cancelar»'> = new Map<string, 'pulsa «Cancelar»'>([['pulsa «Cancelar»', 'pulsa «Cancelar»']]);

const GESTOR = 'gestor@sigpro.test';

// --- Piezas del detalle y del diálogo de cierre ------------------------------------------------------------------------------------

const dialogOf = (page: Page): Locator => detailDialog(page, 'NC-003');
const closeToggle = (page: Page): Locator => dialogOf(page).getByRole('button', { name: 'Pasar a «Cerrada»', exact: true });
const closeArea = (page: Page): Locator => dialogOf(page).getByRole('textbox', { name: 'Comentario de cierre', exact: true });
const closeSubmit = (page: Page): Locator => dialogOf(page).getByRole('button', { name: 'Cerrar no conformidad', exact: true });
const closeCancel = (page: Page): Locator => dialogOf(page).getByRole('button', { name: 'Cancelar', exact: true });
const dialogArea = (page: Page): Locator => closeDialog(page, 'NC-003').getByRole('textbox', { name: 'Comentario de cierre', exact: true });
const dialogSubmit = (page: Page): Locator => closeDialog(page, 'NC-003').getByRole('button', { name: 'Cerrar no conformidad', exact: true });

/** Cuerpos de las peticiones de cierre que salen de la página (se captura el `comment` enviado). */
const captureTransitions = (page: Page): { readonly bodies: () => readonly string[]; readonly control: () => boolean } => {
  const bodies: string[] = [];
  let reads = 0;
  page.on('request', (request) => {
    try {
      const path = new URL(request.url()).pathname;
      if (request.method() === 'GET' && path.startsWith('/api/nc')) reads += 1;
      if (request.method() === 'POST' && path === TRANSITION_PATH) bodies.push(request.postData() ?? '(sin cuerpo)');
    } catch {
      // una URL que no se lee no cuenta
    }
  });
  // Control positivo: el registro ve las lecturas de la propia página (si no, una negativa «0 peticiones» no prueba nada)
  return { bodies: () => [...bodies], control: () => reads > 0 };
};

/** Comentario de cierre enviado (texto `comment` del cuerpo JSON), o `undefined` si no se puede leer. */
const sentComment = (raw: string): string | undefined => {
  try {
    const parsed = JSON.parse(raw) as { readonly comment?: unknown };
    return typeof parsed.comment === 'string' ? parsed.comment : undefined;
  } catch {
    return undefined;
  }
};

/** Estado del servidor (con sondeo, techo de 5 s) hasta que sea el esperado: la lectura va después del aviso. */
const pollState = async (code: string, expectedState: string): Promise<string | undefined> => {
  let last: string | undefined;
  await waitUntil(async () => {
    last = await persistedState(code);
    return last === expectedState;
  }, 5_000);
  return last;
};

/** Abre el detalle de NC-003 con la cuenta de la fila y espera a que muestre el estado. */
const openDetail = async (page: Page, email: string, expected: string): Promise<{ readonly failed?: Outcome; readonly view?: DetailView }> => {
  const failed = await prepareWeb(page, email, expected, '/nc/NC-003');
  if (failed !== undefined) return { failed };
  const view = await waitDetail(page, (current) => current.open && current.stateText !== undefined);
  return view === undefined ? { failed: preparationFailedWeb(expected, 'el detalle de NC-003 no se abrió') } : { view };
};

// --- Esquema 1: el comentario de cierre debe tener al menos 20 caracteres tras recortar los espacios -----------------------------

const minimumLength: BrowserRowHandler = async (row: ManifestRow, { page }) => {
  const text = strict('texto', TEXT_CELLS, cell(row, 'texto'));
  const counter = strict('contador', COUNTER_CELLS, cell(row, 'contador'));
  const result = strict('resultado', RESULT_CELLS, cell(row, 'resultado'));
  const expected = `gestor@sigpro.test pulsa «Pasar a «Cerrada»», escribe ${cell(row, 'texto')} en «Comentario de cierre», ve el contador ${counter} y pulsa «Cerrar no conformidad» → ${cell(row, 'resultado')}`;
  const transitions = captureTransitions(page);
  const opened = await openDetail(page, GESTOR, expected);
  if (opened.failed !== undefined) return opened.failed;

  const toggled = await interact(closeToggle(page), 'pulsar «Pasar a «Cerrada»»', (element) => element.click(ACTION));
  if (toggled !== undefined) return actionFailed(expected, toggled);
  const typed = await interact(closeArea(page), 'escribir en «Comentario de cierre»', (element) => element.fill(text, ACTION));
  if (typed !== undefined) return actionFailed(expected, typed);
  const counted = await waitUntil(async () => (await readDetail(page))?.closeCounter === counter);
  const shownCounter = (await readDetail(page))?.closeCounter;
  const submitted = await interact(closeSubmit(page), 'pulsar «Cerrar no conformidad»', (element) => element.click(ACTION));
  if (submitted !== undefined) return actionFailed(expected, submitted);

  if (result.kind === 'closed') {
    const toast = await toastShown(page, 'ok', CLOSED_TOAST);
    const view = await waitDetail(page, (current) => current.stateText === 'Cerrada');
    const state = await pollState('NC-003', 'closed');
    const last = view?.comments[view.comments.length - 1];
    const sent = transitions.bodies().map(sentComment);
    return verdictWeb([
      check(counted.reached && shownCounter === counter, `contador «${counter}»`, `contador «${shownCounter ?? '(sin leer)'}»`),
      check(toast.readable && toast.seen, `aviso «${CLOSED_TOAST}»`, toast.observed),
      check(view?.stateText === 'Cerrada', 'estado del detalle «Cerrada»', `estado «${view?.stateText ?? '(sin leer)'}»`),
      check(last?.kindLabel === 'Cierre' && last?.body === text.trim(), 'último comentario con la etiqueta «Cierre» y el texto recortado', `último comentario: «${last?.kindLabel ?? '(sin leer)'}» / «${last?.body ?? '(sin leer)'}»`),
      check(view?.transitionsText?.includes(NO_MORE) === true, `«${NO_MORE}»`, `cambio de estado: «${view?.transitionsText ?? '(sin leer)'}»`),
      check(sent.length === 1 && sent[0] === text.trim(), 'la petición lleva el comentario recortado', `comentario enviado: ${sent.map((value) => `«${value ?? '(sin leer)'}»`).join(', ') || '(ninguna)'}`),
      check(state === 'closed', 'NC-003 cerrada en el servidor', `NC-003 en el servidor: ${state ?? '(sin leer)'}`),
    ]);
  }
  const shown = await waitUntil(async () => (await readDetail(page))?.closeError === result.text);
  const view = await readDetail(page);
  await observe(2_000);
  const state = await persistedState('NC-003');
  return verdictWeb([
    check(counted.reached && shownCounter === counter, `contador «${counter}»`, `contador «${shownCounter ?? '(sin leer)'}»`),
    check(shown.reached, `«${result.text}» bajo el campo`, `bajo el campo: «${view?.closeError ?? '(sin error visible)'}»`),
    check(transitions.bodies().length === 0, 'ninguna petición de cierre', `peticiones de cierre: ${transitions.bodies().length}`),
    check(transitions.control(), 'control: el registro de peticiones ve la carga de la página', `lecturas GET /api/nc vistas: ${transitions.control() ? 'sí' : 'no'}`),
    check(state === 'corrective_action', 'NC-003 sigue en «Acción correctiva» en el servidor', `NC-003 en el servidor: ${state ?? '(sin leer)'}`),
  ]);
};

// --- Esquema 2: un comentario de cierre vacío no se envía -----------------------------------------------------------------------

const emptyNotSent: BrowserRowHandler = async (row: ManifestRow, { page }) => {
  const text = strict('texto', TEXT_CELLS, cell(row, 'texto'));
  const expected = `gestor@sigpro.test pulsa «Pasar a «Cerrada»», escribe ${cell(row, 'texto')} en «Comentario de cierre» y pulsa «Cerrar no conformidad» → «${REQUIRED_ERROR}» bajo el campo y ninguna petición de cierre`;
  const transitions = captureTransitions(page);
  const opened = await openDetail(page, GESTOR, expected);
  if (opened.failed !== undefined) return opened.failed;

  const toggled = await interact(closeToggle(page), 'pulsar «Pasar a «Cerrada»»', (element) => element.click(ACTION));
  if (toggled !== undefined) return actionFailed(expected, toggled);
  if (text !== '') {
    const typed = await interact(closeArea(page), 'escribir en «Comentario de cierre»', (element) => element.fill(text, ACTION));
    if (typed !== undefined) return actionFailed(expected, typed);
  }
  const submitted = await interact(closeSubmit(page), 'pulsar «Cerrar no conformidad»', (element) => element.click(ACTION));
  if (submitted !== undefined) return actionFailed(expected, submitted);

  const shown = await waitUntil(async () => (await readDetail(page))?.closeError === REQUIRED_ERROR);
  await observe(2_000);
  return verdictWeb([
    check(shown.reached, `«${REQUIRED_ERROR}» bajo el campo`, `bajo el campo: «${(await readDetail(page))?.closeError ?? '(sin error visible)'}»`),
    check(transitions.bodies().length === 0, 'ninguna petición de cierre', `peticiones de cierre: ${transitions.bodies().length}`),
    check(transitions.control(), 'control: el registro de peticiones ve la carga de la página', `lecturas GET /api/nc vistas: ${transitions.control() ? 'sí' : 'no'}`),
  ]);
};

// --- Esquema 3: solo admin y program_manager pueden cerrar desde el detalle ------------------------------------------------------

const onlyCloserFromDetail: BrowserRowHandler = async (row: ManifestRow, { page }) => {
  const account = strict('correo', ACCOUNT_CELLS, cell(row, 'correo'));
  const result = strict('resultado', ROLE_RESULT_CELLS, cell(row, 'resultado'));
  const expected = `${account} mira el botón «Pasar a «Cerrada»» en el detalle de NC-003 → ${cell(row, 'resultado')}`;
  const opened = await openDetail(page, account, expected);
  if (opened.failed !== undefined) return opened.failed;

  const control = await controlOf(closeToggle(page));
  if (result === 'enabled') {
    const toggled = await interact(closeToggle(page), 'pulsar «Pasar a «Cerrada»»', (element) => element.click(ACTION));
    if (toggled !== undefined) return actionFailed(expected, toggled);
    const area = await waitUntil(async () => (await closeArea(page).count()) > 0 && (await closeArea(page).first().isVisible()));
    return verdictWeb([controlCheck(control, 'habilitado', undefined, '«Pasar a «Cerrada»»'), check(area.reached, 'aparece el formulario de cierre en el detalle', area.reached ? 'aparece el formulario de cierre en el detalle' : 'no aparece el formulario de cierre')]);
  }
  return verdictWeb([controlCheck(control, 'deshabilitado', DENIED, '«Pasar a «Cerrada»»')]);
};

// --- Esquema 4: soltar la tarjeta en «Cerrada» abre el mismo formulario en un diálogo -----------------------------------------

const dragToClosed: BrowserRowHandler = async (row: ManifestRow, { page }) => {
  const text = strict('texto', TEXT_CELLS, cell(row, 'texto'));
  const result = strict('resultado', RESULT_CELLS, cell(row, 'resultado'));
  const expected = `gestor@sigpro.test está en /nc con NC-003 en «Acción correctiva», suelta la tarjeta en «Cerrada», escribe ${cell(row, 'texto')} y pulsa «Cerrar no conformidad» → ${cell(row, 'resultado')}`;
  const transitions = captureTransitions(page);
  const failed = await prepareWeb(page, GESTOR, expected, '/nc');
  if (failed !== undefined) return failed;

  const onColumn = await waitUntil(async () => (await columnOf(page, 'corrective_action').locator('li[data-testid="nc-card-NC-003"]').count()) > 0);
  if (!onColumn.reached) return preparationFailedWeb(expected, 'NC-003 no está en la columna «Acción correctiva» del tablero');
  const armed = await armToasts(page);
  if (!armed) throw new Error('registro de avisos no instalado: fallo del arnés');
  await armDragLog(page);
  const drag = await performDrag(page, 'NC-003', 'closed');
  if (!isDragOutcome(drag)) return actionFailed(expected, drag);
  if (!drag.started) {
    // Una tarjeta NO arrastrable (draggable=false) es un defecto: la historia exige poder arrastrarla (rol con permiso de cierre)
    if (drag.draggable === 'false') {
      return verdictWeb([check(false, 'la tarjeta NC-003 arrastrable (draggable=true) para el rol con permiso de cierre', `la tarjeta NC-003 tiene draggable=false: no se puede arrastrar a «Cerrada»`)]);
    }
    // Sin «dragstart» sobre una tarjeta arrastrable (o sin atributo legible) no se puede afirmar nada de la app: la fila no se ejecuta
    return notExecutable(expected, `el gesto de arrastrar no arranca en el arnés: no hay «dragstart» sobre NC-003 (draggable=${drag.draggable ?? '(sin leer)'}; marca de la columna «${drag.dropOnTarget}»; puntero sobre la columna: ${drag.pointerOnTarget ? 'sí' : 'no'}); no se puede afirmar que la app lo impida. Inicios de arrastre registrados: ${(await dragStarts(page)).join(', ') || '(ninguno)'}`);
  }

  const dialogShown = await waitUntil(async () => (await closeDialog(page, 'NC-003').count()) > 0);
  if (!dialogShown.reached) return actionFailed(expected, { message: 'no se abrió el diálogo «Cerrar NC-003» al soltar la tarjeta', note: 'el arrastre arrancó, pero la columna «Cerrada» no abrió el diálogo de cierre' });
  const typed = await interact(dialogArea(page), 'escribir en «Comentario de cierre»', (element) => element.fill(text, ACTION));
  if (typed !== undefined) return actionFailed(expected, typed);
  const submitted = await interact(dialogSubmit(page), 'pulsar «Cerrar no conformidad»', (element) => element.click(ACTION));
  if (submitted !== undefined) return actionFailed(expected, submitted);

  if (result.kind === 'closed') {
    const toast = await toastShown(page, 'ok', CLOSED_TOAST);
    const gone = await waitUntil(async () => (await closeDialog(page, 'NC-003').count()) === 0);
    const inColumn = await waitUntil(async () => (await columnOf(page, 'closed').locator('li[data-testid="nc-card-NC-003"]').count()) > 0);
    const state = await pollState('NC-003', 'closed');
    const sent = transitions.bodies().map(sentComment);
    return verdictWeb([
      check(toast.readable && toast.seen, `aviso «${CLOSED_TOAST}»`, toast.observed),
      check(gone.reached, 'el diálogo «Cerrar NC-003» se cierra', gone.reached ? 'el diálogo se cerró' : 'el diálogo sigue abierto'),
      check(inColumn.reached, 'la tarjeta NC-003 queda en la columna «Cerrada»', inColumn.reached ? 'la tarjeta NC-003 está en la columna «Cerrada»' : 'la tarjeta NC-003 no está en la columna «Cerrada»'),
      check(sent.length === 1 && sent[0] === text.trim(), 'la petición lleva el comentario recortado', `comentario enviado: ${sent.map((value) => `«${value ?? '(sin leer)'}»`).join(', ') || '(ninguna)'}`),
      check(state === 'closed', 'NC-003 cerrada en el servidor', `NC-003 en el servidor: ${state ?? '(sin leer)'}`),
    ]);
  }
  const shown = await waitUntil(async () => (await visibleText(closeDialog(page, 'NC-003').getByTestId(NC_TESTIDS.NC_CLOSE_ERROR))) === result.text);
  const message = await visibleText(closeDialog(page, 'NC-003').getByTestId(NC_TESTIDS.NC_CLOSE_ERROR));
  const stillOpen = (await closeDialog(page, 'NC-003').count()) > 0;
  await observe(2_000);
  return verdictWeb([
    check(shown.reached, `«${result.text}» bajo el campo`, `bajo el campo: «${message ?? '(sin error visible)'}»`),
    check(stillOpen, 'el diálogo «Cerrar NC-003» sigue abierto', stillOpen ? 'el diálogo «Cerrar NC-003» sigue abierto' : 'el diálogo se cerró'),
    check(transitions.bodies().length === 0, 'ninguna petición de cierre', `peticiones de cierre: ${transitions.bodies().length}`),
    check(transitions.control(), 'control: el registro de peticiones ve la carga del tablero', `lecturas GET /api/nc vistas: ${transitions.control() ? 'sí' : 'no'}`),
  ]);
};

// --- Esquema 5: cancelar no cierra la no conformidad -----------------------------------------------------------------------------

const cancelKeeps: BrowserRowHandler = async (row: ManifestRow, { page }) => {
  strict('intento', CANCEL_CELLS, cell(row, 'intento'));
  const expected = `gestor@sigpro.test tiene abierto el formulario de cierre de NC-003 con (20 letras a) escrito, pulsa «Cancelar» → el formulario se cierra y NC-003 sigue en «Acción correctiva»`;
  const transitions = captureTransitions(page);
  const opened = await openDetail(page, GESTOR, expected);
  if (opened.failed !== undefined) return opened.failed;

  const toggled = await interact(closeToggle(page), 'pulsar «Pasar a «Cerrada»»', (element) => element.click(ACTION));
  if (toggled !== undefined) return actionFailed(expected, toggled);
  const filled = await interact(closeArea(page), 'escribir en «Comentario de cierre»', (element) => element.fill('a'.repeat(20), ACTION));
  if (filled !== undefined) return actionFailed(expected, filled);
  const cancelled = await interact(closeCancel(page), 'pulsar «Cancelar»', (element) => element.click(ACTION));
  if (cancelled !== undefined) return actionFailed(expected, cancelled);

  const closed = await waitUntil(async () => (await closeArea(page).count()) === 0);
  await observe(2_000);
  const view = await readDetail(page);
  const state = await persistedState('NC-003');
  return verdictWeb([
    check(closed.reached, 'el formulario de cierre se cierra', closed.reached ? 'el formulario de cierre se cerró' : 'el formulario de cierre sigue abierto'),
    check(view?.stateText === 'Acción correctiva', 'NC-003 sigue en «Acción correctiva» (detalle)', `estado del detalle «${view?.stateText ?? '(sin leer)'}»`),
    check(state === 'corrective_action', 'NC-003 sigue en «Acción correctiva» en el servidor', `NC-003 en el servidor: ${state ?? '(sin leer)'}`),
    check(transitions.bodies().length === 0, 'ninguna petición de cierre', `peticiones de cierre: ${transitions.bodies().length}`),
    check(transitions.control(), 'control: el registro de peticiones ve la carga del detalle', `lecturas GET /api/nc vistas: ${transitions.control() ? 'sí' : 'no'}`),
  ]);
};

defineBrowserRows({
  story: 'US-NC-GESTION-009',
  surface: 'web',
  tenants: ['alumno01'],
  handlers: new Map<number, BrowserRowHandler>([
    [1, onWeb(minimumLength)],
    [2, onWeb(emptyNotSent)],
    [3, onWeb(onlyCloserFromDetail)],
    [4, onWeb(dragToClosed)],
    [5, onWeb(cancelKeeps)],
  ]),
});

