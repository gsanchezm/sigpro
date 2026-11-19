import type { Page } from '@playwright/test';
import { NC_DYNAMIC_TESTIDS, NC_TESTIDS } from '../../../../packages/shared/src/testids';
import { resetTenants, TENANT_A } from '../../../story-runs/support/prepare';
import { ACTION, runSteps, waitUntil } from '../../support/browser';
import { defineBrowserRows, type BrowserRowHandler, type ManifestRow, type Outcome } from '../../core/framework';
import { cell, check, preparationFailedWeb, strict } from '../../support/checks';
import { actionFailed, armToasts, columnOf, controlCheck, intercept, interact, onWeb, openPath, persistedState, sameOrder, settled, signIn, toastShown, verdictWeb, waitBoard, withLimit, type Interception, type TransitionButton } from './common';

// US-NC-TABLERO-009 — Detalle de una no conformidad en /nc/:code (web, escritorio 1440 px). Preparación de cada fila: reinicio de
// alumno01 con el token de su administrador; la cuenta de la fila inicia sesión y se abre la dirección de la fila (el tablero queda
// detrás del detalle). Las respuestas fabricadas por la prueba se arman ANTES de abrir la dirección y su registro va a la nota.

const STATE_CELLS: ReadonlyMap<string, string> = new Map<string, string>([
  ['Abierta', 'open'],
  ['En análisis', 'in_analysis'],
  ['Rechazada', 'rejected'],
  ['Cerrada', 'closed'],
]);

const NC_CODE_CELLS: ReadonlyMap<string, string> = new Map<string, string>([
  ['NC-001', 'NC-001'],
  ['NC-002', 'NC-002'],
  ['NC-004', 'NC-004'],
  ['NC-005', 'NC-005'],
  ['NC-013', 'NC-013'],
]);

const SEVERITY_CELLS: ReadonlyMap<string, string> = new Map<string, string>([
  ['Menor', 'Menor'],
  ['Mayor', 'Mayor'],
]);

/** Botones «Pasar a …» que el detalle debe mostrar, en orden; `none` si la celda dice «sin cambios» (y ningún botón). */
const STEPS_CELLS: ReadonlyMap<string, { readonly labels: readonly string[]; readonly none: boolean }> = new Map<string, { readonly labels: readonly string[]; readonly none: boolean }>([
  ['el botón «Pasar a «En análisis»»', { labels: ['Pasar a «En análisis»'], none: false }],
  ['los botones «Pasar a «Acción correctiva»», «Pasar a «Rechazada»» y «Pasar a «Abierta»»', { labels: ['Pasar a «Acción correctiva»', 'Pasar a «Rechazada»', 'Pasar a «Abierta»'], none: false }],
  ['el botón «Pasar a «Abierta»»', { labels: ['Pasar a «Abierta»'], none: false }],
  ['el texto «Sin más cambios de estado posibles» y ningún botón', { labels: [], none: true }],
]);

const DESTINO_CELLS: ReadonlyMap<string, string> = new Map<string, string>([
  ['En análisis', 'in_analysis'],
  ['Abierta', 'open'],
]);

const AVISO_CELLS: ReadonlyMap<string, string> = new Map<string, string>([
  ['NC-001 pasó a «En análisis»', 'NC-001 pasó a «En análisis»'],
  ['NC-005 pasó a «Abierta»', 'NC-005 pasó a «Abierta»'],
]);

const HTTP_CELLS: ReadonlyMap<string, number> = new Map<string, number>([
  ['500', 500],
  ['503', 503],
]);

/** Forma de cerrar el detalle que dice la celda: un botón, o la tecla Esc. */
const CLOSE_CELLS: ReadonlyMap<string, (page: Page) => Promise<unknown>> = new Map<string, (page: Page) => Promise<unknown>>([
  ['pulsa «Cerrar el detalle»', (page) => page.getByTestId(NC_TESTIDS.NC_DETAIL_CLOSE).click(ACTION)],
  ['pulsa la tecla Esc', (page) => page.keyboard.press('Escape')],
]);

const GESTOR = 'gestor@sigpro.test';
const AUDITOR = 'auditor@sigpro.test';
const READ_ONLY_REASON = 'Tu rol no permite mover no conformidades';
const DETAIL_NOT_FOUND = 'No se encontró la no conformidad';
const DETAIL_ERROR = 'No se pudo cargar la no conformidad';
const BOARD_CODE_PATH = (code: string): string => `/nc/${code}`;
const DETAIL_API_PATH = (code: string): string => `/api/nc/${code}`;

/** Lo que muestra el detalle abierto, leído en una sola evaluación. */
interface DetailView {
  readonly present: boolean;
  readonly heading: string | undefined;
  readonly state: string | undefined;
  readonly severity: string | undefined;
  readonly transitions: readonly TransitionButton[];
  readonly sectionText: string | undefined;
  readonly notFound: string | undefined;
  readonly error: string | undefined;
  readonly retryText: string | undefined;
}

/** Se ejecuta en el navegador: el detalle (título, badges, botones «Pasar a …», avisos de no encontrada y de error). */
const detailReader = (): DetailView => {
  const dialog = document.querySelector('[data-testid="nc-detail"]');
  const textOf = (node: Element | null | undefined): string | undefined => (node === null || node === undefined ? undefined : (node.textContent ?? '').replace(/\s+/g, ' ').trim());
  const inside = (testid: string): Element | null => (dialog === null ? null : dialog.querySelector(`[data-testid="${testid}"]`));
  const buttons = dialog === null ? [] : Array.from(dialog.querySelectorAll('[data-testid^="nc-transition-"]'));
  return {
    present: dialog !== null,
    heading: textOf(document.getElementById('nc-detail-heading')),
    state: textOf(inside('nc-state-badge')),
    severity: textOf(inside('nc-severity-badge')),
    transitions: buttons.map((button) => ({
      state: (button.getAttribute('data-testid') ?? '').replace(/^nc-transition-/, ''),
      text: textOf(button) ?? '',
      disabled: (button as HTMLButtonElement).disabled === true,
      title: button.getAttribute('title') ?? undefined,
    })),
    sectionText: textOf(inside('nc-transitions')),
    notFound: textOf(inside('nc-detail-not-found')),
    error: textOf(inside('nc-detail-error')),
    retryText: textOf(inside('nc-detail-error-retry')),
  };
};

const readDetail = (page: Page): Promise<DetailView | undefined> => withLimit<DetailView | undefined>(page.evaluate(detailReader), undefined);

/** Espera (con techo) a que el detalle cumpla `ok`; devuelve la última lectura. */
const waitDetail = async (page: Page, ok: (view: DetailView) => boolean): Promise<DetailView | undefined> => {
  let last: DetailView | undefined;
  await waitUntil(async () => {
    last = await readDetail(page);
    return last !== undefined && ok(last);
  });
  return last;
};

/**
 * El detalle ya tiene respuesta: estado (la cabecera del diálogo existe desde el primer pintado, así que no sirve de señal),
 * aviso de no encontrada o aviso de error.
 */
const answered = (view: DetailView): boolean => view.state !== undefined || view.notFound !== undefined || view.error !== undefined;

/** Preparación de la fila: reinicio, inicio de sesión de la cuenta, rutas de la fila (si las hay) y apertura de la dirección. */
const prepareDetail = async (page: Page, email: string, expected: string, path: string, beforeOpen?: () => Promise<unknown>): Promise<Outcome | undefined> => {
  await resetTenants([TENANT_A]);
  const signedIn = await signIn(page, 'escritorio', email);
  if (signedIn !== undefined) return preparationFailedWeb(expected, `iniciar sesión como ${email}: ${signedIn}`);
  if (beforeOpen !== undefined) await beforeOpen();
  const opened = await openPath(page, path, 'escritorio');
  if (opened !== undefined) return preparationFailedWeb(expected, `abrir ${path}: ${opened}`);
  return undefined;
};

// --- Esquema 1: el detalle muestra el estado, la severidad y solo los pasos que la máquina admite ----------------------------

const detailShows: BrowserRowHandler = async (row: ManifestRow, { page }) => {
  const code = strict('codigo', NC_CODE_CELLS, cell(row, 'codigo'));
  strict('estado', STATE_CELLS, cell(row, 'estado')); // la celda debe ser un estado conocido (la lectura se compara con su texto)
  const severity = strict('severidad', SEVERITY_CELLS, cell(row, 'severidad'));
  const steps = strict('pasos', STEPS_CELLS, cell(row, 'pasos'));
  const expected = `el detalle «Detalle de ${code}» muestra el estado «${cell(row, 'estado')}» y la severidad «${severity}»; en «Cambiar estado» ve ${cell(row, 'pasos')}`;
  const failed = await prepareDetail(page, GESTOR, expected, BOARD_CODE_PATH(code));
  if (failed !== undefined) return failed;

  const view = await waitDetail(page, answered);
  const labels = view?.transitions.map((button) => button.text) ?? [];
  const noButtons = view?.transitions.length === 0 && (view.sectionText ?? '').includes('Sin más cambios de estado posibles');
  const stepsOk = steps.none ? noButtons : sameOrder(labels, steps.labels);
  return verdictWeb([
    check(view?.heading === `Detalle de ${code}`, `título «Detalle de ${code}»`, `título «${view?.heading ?? '(sin leer)'}»`),
    check(view?.state === cell(row, 'estado'), `estado «${cell(row, 'estado')}»`, `estado «${view?.state ?? '(sin leer)'}»`),
    check(view?.severity === severity, `severidad «${severity}»`, `severidad «${view?.severity ?? '(sin leer)'}»`),
    check(stepsOk, `en «Cambiar estado» ${cell(row, 'pasos')}`, steps.none ? `en «Cambiar estado»: ${view?.transitions.length ?? '(sin leer)'} botones, texto «${(view?.sectionText ?? '(sin leer)').slice(0, 80)}»` : `en «Cambiar estado» ${labels.join(' | ') || '(ningún botón)'}`),
  ]);
};

// --- Esquema 2: un código que no existe muestra el aviso y el tablero queda detrás ----------------------------------------

const unknownCode: BrowserRowHandler = async (row: ManifestRow, { page }) => {
  const code = strict('codigo', NC_CODE_CELLS, cell(row, 'codigo'));
  const expected = `ve el aviso «${DETAIL_NOT_FOUND}» y el tablero queda detrás`;
  const failed = await prepareDetail(page, GESTOR, expected, BOARD_CODE_PATH(code));
  if (failed !== undefined) return failed;

  const view = await waitDetail(page, answered);
  const board = await waitBoard(page, 'escritorio', settled);
  const columns = board?.columns.filter((column) => column.present).length ?? 0;
  return verdictWeb([
    check(view?.notFound === DETAIL_NOT_FOUND, `aviso «${DETAIL_NOT_FOUND}»`, `aviso «${view?.notFound ?? '(no aparece)'}»`),
    check(board !== undefined && columns === 5, 'el tablero queda detrás con sus cinco columnas', `columnas detrás del detalle: ${board === undefined ? '(sin leer)' : columns}`),
  ]);
};

// --- Esquema 3: un paso desde el detalle cambia el estado mostrado y avisa --------------------------------------------------

const moveFromDetail: BrowserRowHandler = async (row: ManifestRow, { page }) => {
  const code = strict('codigo', NC_CODE_CELLS, cell(row, 'codigo'));
  const to = strict('destino', DESTINO_CELLS, cell(row, 'destino'));
  const aviso = strict('aviso', AVISO_CELLS, cell(row, 'aviso'));
  const newState = strict('estado_nuevo', STATE_CELLS, cell(row, 'estado_nuevo'));
  const expected = `pulsar «Pasar a «${cell(row, 'destino')}»» muestra el aviso «${cell(row, 'aviso')}», el detalle muestra el estado «${cell(row, 'estado_nuevo')}» y el tablero muestra ${code} en la columna «${cell(row, 'estado_nuevo')}»`;
  const failed = await prepareDetail(page, GESTOR, expected, BOARD_CODE_PATH(code));
  if (failed !== undefined) return failed;

  await waitDetail(page, answered);
  await armToasts(page);
  const clicked = await interact(page.getByTestId(NC_DYNAMIC_TESTIDS.NC_TRANSITION(to)), `pulsar «Pasar a «${cell(row, 'destino')}»»`, (element) => element.click(ACTION));
  if (clicked !== undefined) return actionFailed(expected, clicked);
  const toast = await toastShown(page, 'ok', aviso);
  const detail = await waitDetail(page, (view) => view.state === cell(row, 'estado_nuevo'));
  const board = await waitBoard(page, 'escritorio', (view) => columnOf(view, newState)?.cards.includes(code) === true);
  const column = board === undefined ? undefined : columnOf(board, newState);
  // Persistencia: la API se lee después del aviso y de la reacción del detalle y del tablero
  const persisted = await persistedState(code);
  return verdictWeb([
    check(persisted === newState, `la API guarda ${code} en ${newState}`, `la API da state ${persisted ?? '(sin leer)'}`),
    check(toast.seen, `aviso «${aviso}»`, `aviso ${toast.observed}`),
    check(detail?.state === cell(row, 'estado_nuevo'), `estado «${cell(row, 'estado_nuevo')}» en el detalle`, `estado «${detail?.state ?? '(sin leer)'}» en el detalle`),
    check(column?.cards.includes(code) === true, `${code} en la columna «${cell(row, 'estado_nuevo')}» del tablero`, `${code} ${column?.cards.includes(code) === true ? 'en' : 'no está en'} la columna «${cell(row, 'estado_nuevo')}» (tarjetas: ${column?.cards.join(', ') || '(ninguna)'})`),
  ]);
};

// --- Esquema 4: quien solo lee ve los pasos deshabilitados con su motivo --------------------------------------------------

const readOnlyDetail: BrowserRowHandler = async (row: ManifestRow, { page }) => {
  const code = strict('codigo', NC_CODE_CELLS, cell(row, 'codigo'));
  const to = strict('destino', DESTINO_CELLS, cell(row, 'destino'));
  const label = `Pasar a «${cell(row, 'destino')}»`;
  const expected = `el botón «${label}» de ${code} está deshabilitado con el motivo «${READ_ONLY_REASON}»`;
  const failed = await prepareDetail(page, AUDITOR, expected, BOARD_CODE_PATH(code));
  if (failed !== undefined) return failed;

  const view = await waitDetail(page, (current) => current.transitions.length > 0);
  const entry = view?.transitions.find((button) => button.state === to);
  return verdictWeb(
    [controlCheck(entry, 'deshabilitado', READ_ONLY_REASON, `el botón «${label}»`)],
    '«Con el motivo» se lee del atributo title del botón (en escritorio el motivo de un paso no permitido va en title).',
  );
};

// --- Esquema 5: un fallo al cargar el detalle muestra el aviso con «Reintentar» ---------------------------------------------

const detailFailure: BrowserRowHandler = async (row: ManifestRow, { page }) => {
  const status = strict('codigo_http', HTTP_CELLS, cell(row, 'codigo_http'));
  const expected = `ve el aviso «${DETAIL_ERROR}» con el botón «Reintentar»; al pulsar «Reintentar» ve el detalle de NC-001`;
  const holder: { interception?: Interception } = {};
  const failed = await prepareDetail(page, GESTOR, expected, BOARD_CODE_PATH('NC-001'), async () => {
    holder.interception = await intercept(page, 'GET', DETAIL_API_PATH('NC-001'), { kind: 'failFirst', status });
  });
  if (failed !== undefined) return failed;

  const errorView = await waitDetail(page, (view) => view.error !== undefined);
  const hitsBeforeRetry = holder.interception?.hits() ?? [];
  const clicked = await interact(page.getByTestId(NC_TESTIDS.NC_DETAIL_ERROR_RETRY), 'pulsar «Reintentar»', (element) => element.click(ACTION));
  if (clicked !== undefined) return actionFailed(expected, clicked);
  const after = await waitDetail(page, (view) => view.heading === 'Detalle de NC-001' && view.state !== undefined);
  return verdictWeb(
    [
      check(errorView?.error?.includes(DETAIL_ERROR) === true, `aviso «${DETAIL_ERROR}»`, `aviso ${errorView?.error === undefined ? '(no aparece)' : errorView.error.slice(0, 80)}`),
      check(errorView?.retryText === 'Reintentar', 'botón «Reintentar»', `botón «${errorView?.retryText ?? '(sin leer)'}»`),
      check(after?.heading === 'Detalle de NC-001' && after.state !== undefined && after.error === undefined, 'tras «Reintentar», el detalle de NC-001 (con su estado, sin aviso de error)', `título «${after?.heading ?? '(sin leer)'}», estado «${after?.state ?? '(sin leer)'}», aviso de error ${after?.error === undefined ? 'ausente' : 'presente'}`),
    ],
    `Peticiones a ${DETAIL_API_PATH('NC-001')} antes de «Reintentar»: ${hitsBeforeRetry.join(' | ') || '(ninguna)'}. Las respuestas fabricadas no llegan al servidor.`,
  );
};

// --- Esquema 6: el detalle se cierra y vuelve al tablero ------------------------------------------------------------------

const closeDetail: BrowserRowHandler = async (row: ManifestRow, { page }) => {
  const close = strict('forma_de_cerrar', CLOSE_CELLS, cell(row, 'forma_de_cerrar'));
  const expected = `${cell(row, 'forma_de_cerrar')}: la dirección es /nc y el tablero muestra las cinco columnas con sus 12 tarjetas`;
  const failed = await prepareDetail(page, GESTOR, expected, BOARD_CODE_PATH('NC-002'));
  if (failed !== undefined) return failed;

  await waitDetail(page, answered);
  const closing = await runSteps([[`pulsar la forma de cerrar: ${cell(row, 'forma_de_cerrar')}`, () => close(page)]]);
  if (closing !== undefined) return actionFailed(expected, { message: closing, note: 'la acción de cerrar el detalle no se pudo completar' });
  const board = await waitBoard(page, 'escritorio', (view) => view.cardsTotal === 12 && settled(view));
  const path = new URL(page.url()).pathname;
  const columns = board?.columns.filter((column) => column.present).length ?? 0;
  const still = await readDetail(page);
  return verdictWeb([
    check(path === '/nc', 'la dirección es /nc', `la dirección es ${path}`),
    check(columns === 5 && board?.cardsTotal === 12, 'el tablero muestra las cinco columnas con sus 12 tarjetas', `${columns} columnas y ${board?.cardsTotal ?? '(sin leer)'} tarjetas`),
    check(still?.present === false, 'el detalle ya no está abierto', still === undefined ? '(detalle sin leer)' : still.present ? 'el detalle sigue abierto' : 'el detalle está cerrado'),
  ]);
};

defineBrowserRows({
  story: 'US-NC-TABLERO-009',
  surface: 'web',
  tenants: [TENANT_A],
  handlers: new Map<number, BrowserRowHandler>([
    [1, onWeb(detailShows)],
    [2, onWeb(unknownCode)],
    [3, onWeb(moveFromDetail)],
    [4, onWeb(readOnlyDetail)],
    [5, onWeb(detailFailure)],
    [6, onWeb(closeDetail)],
  ]),
});
