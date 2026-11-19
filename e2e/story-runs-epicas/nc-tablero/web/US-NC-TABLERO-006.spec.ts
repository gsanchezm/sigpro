import type { Page } from '@playwright/test';
import { NC_TESTIDS, RESPONSIVE_DYNAMIC_TESTIDS } from '../../../../packages/shared/src/testids';
import { resetTenants, TENANT_A } from '../../../story-runs/support/prepare';
import { defineBrowserRows, type BrowserRowHandler, type ManifestRow, type Outcome } from '../../core/framework';
import { cell, check, preparationFailedWeb, strict } from '../../support/checks';
import { ACTION, attrOf } from '../../support/browser';
import { actionFailed, BOARD_PATH, columnOf, gotoBoard, intercept, interact, onWeb, prepareWeb, sameOrder, settled, signIn, testidText, verdictWeb, waitBoard, withLimit, type BoardView, type Interception } from './common';

// US-NC-TABLERO-006 — Tablero de no conformidades en la web. Preparación de cada fila: reinicio de alumno01 con el token de su
// administrador (desde Node); la cuenta de la fila inicia sesión en /login?tenant=alumno01 y se abre /nc. Las respuestas que la
// prueba fabrica (fallos y retardos) se arman tras iniciar sesión y antes de abrir /nc; su registro va a la nota de la fila.

const TITLE_CELLS: ReadonlyMap<string, string> = new Map<string, string>([
  ['Abierta', 'open'],
  ['En análisis', 'in_analysis'],
  ['Acción correctiva', 'corrective_action'],
  ['Cerrada', 'closed'],
  ['Rechazada', 'rejected'],
]);

const COUNT_CELLS: ReadonlyMap<string, number> = new Map<string, number>([
  ['4', 4],
  ['2', 2],
]);

/** Códigos de una columna, en el orden que dice la historia (por código). */
const CODES_CELLS: ReadonlyMap<string, readonly string[]> = new Map<string, readonly string[]>([
  ['NC-001, NC-006, NC-007 y NC-012', ['NC-001', 'NC-006', 'NC-007', 'NC-012']],
  ['NC-002 y NC-008', ['NC-002', 'NC-008']],
  ['NC-003 y NC-009', ['NC-003', 'NC-009']],
  ['NC-004 y NC-010', ['NC-004', 'NC-010']],
  ['NC-005 y NC-011', ['NC-005', 'NC-011']],
]);

const NC_CODE_CELLS: ReadonlyMap<string, string> = new Map<string, string>([
  ['NC-001', 'NC-001'],
  ['NC-003', 'NC-003'],
  ['NC-005', 'NC-005'],
]);

const PROGRAM_CELLS: ReadonlyMap<string, string> = new Map<string, string>([
  ['PRG-001', 'PRG-001'],
  ['PRG-002', 'PRG-002'],
]);

/** Severidad como texto de la tarjeta (la historia la escribe entre «…»). */
const SEVERITY_CELLS: ReadonlyMap<string, string> = new Map<string, string>([
  ['«Menor»', 'Menor'],
  ['«Crítica»', 'Crítica'],
  ['«Mayor»', 'Mayor'],
]);

const COMMENTS_CELLS: ReadonlyMap<string, string> = new Map<string, string>([
  ['«1 comentario»', '1 comentario'],
  ['«3 comentarios»', '3 comentarios'],
]);

const ASSIGNEE_CELLS: ReadonlyMap<string, string> = new Map<string, string>([
  ['Javier Ortega', 'Javier Ortega'],
  ['Andrés Molina', 'Andrés Molina'],
  ['«Sin asignar»', 'Sin asignar'],
]);

const RECOUNT_CELLS: ReadonlyMap<string, string> = new Map<string, string>([['«12 no conformidades · 8 abiertas»', '12 no conformidades · 8 abiertas']]);

const DELAY_CELLS: ReadonlyMap<string, number> = new Map<string, number>([
  ['1 segundo', 1000],
  ['3 segundos', 3000],
]);

const HTTP_CELLS: ReadonlyMap<string, number> = new Map<string, number>([
  ['500', 500],
  ['503', 503],
]);

const ERROR_TITLE = 'No se pudo cargar el tablero';
const GESTOR = 'gestor@sigpro.test';
const LIST_PATH = '/api/nc';

/** Lo que muestra una tarjeta, leído en una sola evaluación. */
interface CardView {
  readonly present: boolean;
  readonly severity: string | undefined;
  readonly program: string | undefined;
  readonly comments: string | undefined;
  readonly assignee: string | undefined;
}

/** Se ejecuta en el navegador: severidad, programa, frase de comentarios (lectura de pantalla) y responsable de una tarjeta. */
const cardReader = (code: string): CardView => {
  const card = document.querySelector(`[data-testid="nc-card-${code}"]`);
  const textOf = (testid: string): string | undefined => {
    const node = document.querySelector(`[data-testid="${testid}"]`);
    return node === null ? undefined : (node.textContent ?? '').replace(/\s+/g, ' ').trim();
  };
  const lines = card === null ? [] : ((card as HTMLElement).innerText ?? '').split('\n').map((line) => line.trim()).filter((line) => line !== '');
  const srOnly = document.querySelector(`[data-testid="nc-card-comments-${code}"] .sr-only`);
  return {
    present: card !== null,
    severity: textOf(`nc-card-severity-${code}`),
    program: lines.find((line) => /^PRG-\d{3}$/.test(line)),
    comments: srOnly === null ? undefined : (srOnly.textContent ?? '').trim(),
    assignee: textOf(`nc-card-assignee-${code}`),
  };
};

const readCard = (page: Page, code: string): Promise<CardView | undefined> => withLimit<CardView | undefined>(page.evaluate(cardReader, code), undefined);

/** Preparación de las filas que arman rutas tras el inicio de sesión: reinicio y entrada, sin abrir /nc todavía. */
const signedInFor = async (page: Page, email: string, expected: string): Promise<Outcome | undefined> => {
  await resetTenants([TENANT_A]);
  const signedIn = await signIn(page, 'escritorio', email);
  return signedIn === undefined ? undefined : preparationFailedWeb(expected, `iniciar sesión como ${email}: ${signedIn}`);
};

// --- Esquema 1: cada columna lleva su título y sus tarjetas ----------------------------------------------------------------------

const columnRow: BrowserRowHandler = async (row: ManifestRow, { page }) => {
  const state = strict('titulo', TITLE_CELLS, cell(row, 'titulo'));
  const count = strict('contador', COUNT_CELLS, cell(row, 'contador'));
  const codes = strict('codigos', CODES_CELLS, cell(row, 'codigos'));
  const expected = `la columna «${cell(row, 'titulo')}» muestra el contador ${count} y sus tarjetas son ${cell(row, 'codigos')}`;
  const failed = await prepareWeb(page, 'escritorio', GESTOR, expected);
  if (failed !== undefined) return failed;

  const view = await waitBoard(page, 'escritorio', settled);
  const column = view === undefined ? undefined : columnOf(view, state);
  return verdictWeb([
    check(view !== undefined && column !== undefined, 'tablero leído', view === undefined ? 'tablero sin leer' : 'tablero leído'),
    check(column?.present === true && column.title === cell(row, 'titulo'), `columna «${cell(row, 'titulo')}»`, `columna titulada «${column?.title ?? '(sin leer)'}»`),
    check(column?.count === String(count), `contador ${count}`, `contador ${column?.count ?? '(sin leer)'}`),
    check(column !== undefined && sameOrder(column.cards, codes), `tarjetas ${cell(row, 'codigos')}`, `tarjetas ${column?.cards.join(', ') || '(ninguna)'}`),
  ]);
};

// --- Esquema 2: cada tarjeta muestra su severidad, programa, comentarios y responsable ------------------------------------------

const cardRow: BrowserRowHandler = async (row: ManifestRow, { page }) => {
  const code = strict('código', NC_CODE_CELLS, cell(row, 'codigo'));
  const severity = strict('severidad', SEVERITY_CELLS, cell(row, 'severidad'));
  const program = strict('programa', PROGRAM_CELLS, cell(row, 'programa'));
  const comments = strict('comentarios', COMMENTS_CELLS, cell(row, 'comentarios'));
  const assignee = strict('responsable', ASSIGNEE_CELLS, cell(row, 'responsable'));
  const expected = `la tarjeta ${code} muestra la severidad ${severity}, el programa ${program}, el contador de comentarios ${comments} y el responsable ${assignee}`;
  const failed = await prepareWeb(page, 'escritorio', GESTOR, expected);
  if (failed !== undefined) return failed;

  await waitBoard(page, 'escritorio', settled);
  const card = await readCard(page, code);
  return verdictWeb(
    [
      check(card?.present === true, `tarjeta ${code} en el tablero`, card?.present === true ? `tarjeta ${code} en el tablero` : `tarjeta ${code} no está en el tablero`),
      check(card?.severity === severity, `severidad ${severity}`, `severidad ${card?.severity ?? '(sin leer)'}`),
      check(card?.program === program, `programa ${program}`, `programa ${card?.program ?? '(sin código de programa en la tarjeta)'}`),
      check(card?.comments === comments, `contador de comentarios ${comments}`, `contador de comentarios ${card?.comments ?? '(sin leer)'}`),
      check(card?.assignee === assignee, `responsable ${assignee}`, `responsable ${card?.assignee ?? '(sin leer)'}`),
    ],
    'El número visible del contador de comentarios va acompañado de la frase «N comentario(s)» en la lectura de pantalla (sr-only); la comparación usa esa frase.',
  );
};

// --- Esquema 3: recuento general --------------------------------------------------------------------------------------------------

const countRow: BrowserRowHandler = async (row: ManifestRow, { page }) => {
  const recount = strict('recuento', RECOUNT_CELLS, cell(row, 'recuento'));
  const expected = `el recuento general dice ${cell(row, 'recuento')}`;
  const failed = await prepareWeb(page, 'escritorio', GESTOR, expected);
  if (failed !== undefined) return failed;

  await waitBoard(page, 'escritorio', settled);
  const observed = await testidText(page, NC_TESTIDS.NC_COUNT);
  return verdictWeb([check(observed === recount, `recuento «${recount}»`, `recuento «${observed ?? '(sin leer)'}»`)]);
};

// --- Esquema 4: mientras llega la lista el tablero está ocupado y sin tarjetas ---------------------------------------------------

const loadingRow: BrowserRowHandler = async (row: ManifestRow, { page }) => {
  const delay = strict('espera', DELAY_CELLS, cell(row, 'espera'));
  const expected = `mientras espera la respuesta de GET /api/nc (${cell(row, 'espera')}) el tablero está ocupado, con indicador de carga y sin tarjetas; al llegar la respuesta ve las cinco columnas con sus 12 tarjetas`;
  const failed = await signedInFor(page, GESTOR, expected);
  if (failed !== undefined) return failed;
  const interception = await intercept(page, 'GET', LIST_PATH, { kind: 'delay', ms: delay });
  const opened = await gotoBoard(page, BOARD_PATH);
  if (opened !== undefined) return preparationFailedWeb(expected, `abrir ${BOARD_PATH}: ${opened}`);

  // La lectura «mientras carga» es una sola evaluación: la última que cumple «ocupado». Solo vale si cae dentro de la espera.
  const during = await waitBoard(page, 'escritorio', (view) => view.busy === 'true');
  const delivered = interception.deliveredAt();
  const inWindow = during !== undefined && (delivered === undefined || during.at < delivered);
  const duringView: BoardView | undefined = inWindow ? during : undefined;
  const after = await waitBoard(page, 'escritorio', (view) => settled(view) && view.cardsTotal === 12);
  return verdictWeb(
    [
      check(duringView?.busy === 'true', 'el tablero ocupado (aria-busy true)', `aria-busy ${duringView?.busy ?? '(sin leer)'}`),
      check((duringView?.skeletons ?? 0) > 0, 'indicador de carga (filas de esqueleto)', `${duringView?.skeletons ?? '(sin leer)'} filas de carga`),
      check(duringView?.cardsTotal === 0, 'ninguna tarjeta mientras espera', `${duringView?.cardsTotal ?? '(sin leer)'} tarjetas mientras espera`),
      check(inWindow, 'la lectura cae mientras la respuesta sigue retrasada', inWindow ? 'lectura dentro de la espera' : 'sin leer: la respuesta ya había llegado cuando se leyó'),
      check(after !== undefined && after.columns.length === 5 && after.columns.every((column) => column.present), 'al llegar ve las cinco columnas', `columnas en pantalla: ${after?.columns.filter((column) => column.present).length ?? '(sin leer)'}`),
      check(after?.cardsTotal === 12, 'con sus 12 tarjetas', `${after?.cardsTotal ?? '(sin leer)'} tarjetas`),
    ],
    `Peticiones a ${LIST_PATH}: ${interception.hits().join(' | ') || '(ninguna)'}. La espera la fija la prueba (${cell(row, 'espera')}); la lectura «mientras carga» se toma en una sola evaluación.`,
  );
};

// --- Esquema 5: un fallo de la lista muestra el aviso con «Reintentar» ----------------------------------------------------------

const failureRow: BrowserRowHandler = async (row: ManifestRow, { page }) => {
  const status = strict('codigo_http', HTTP_CELLS, cell(row, 'codigo_http'));
  const expected = `ve el aviso «${ERROR_TITLE}» con el botón «Reintentar» y no ve ninguna tarjeta; al pulsar «Reintentar» ve las cinco columnas con sus 12 tarjetas`;
  const holder: { interception?: Interception } = {};
  const failed = await prepareWeb(page, 'escritorio', GESTOR, expected, async () => {
    holder.interception = await intercept(page, 'GET', LIST_PATH, { kind: 'failFirst', status });
  });
  if (failed !== undefined) return failed;

  const errorView = await waitBoard(page, 'escritorio', (view) => view.errorText !== undefined);
  const retryText = await testidText(page, NC_TESTIDS.NC_ERROR_RETRY);
  const hitsBeforeRetry = holder.interception?.hits() ?? [];
  const clicked = await interact(page.getByTestId(NC_TESTIDS.NC_ERROR_RETRY), 'pulsar «Reintentar»', (element) => element.click(ACTION));
  if (clicked !== undefined) return actionFailed(expected, clicked);
  const after = await waitBoard(page, 'escritorio', (view) => settled(view) && view.cardsTotal === 12);
  const multiple = hitsBeforeRetry.length > 1;
  return verdictWeb(
    [
      check(errorView?.errorText?.includes(ERROR_TITLE) === true, `aviso «${ERROR_TITLE}»`, `aviso ${errorView?.errorText === undefined ? '(no aparece)' : errorView.errorText.slice(0, 80)}`),
      check(retryText === 'Reintentar', 'botón «Reintentar»', `botón «${retryText ?? '(sin leer)'}»`),
      check(errorView?.cardsTotal === 0, 'ninguna tarjeta con el aviso', `${errorView?.cardsTotal ?? '(sin leer)'} tarjetas con el aviso`),
      check(after !== undefined && after.columns.length === 5 && after.columns.every((column) => column.present), 'tras «Reintentar», las cinco columnas', `columnas en pantalla: ${after?.columns.filter((column) => column.present).length ?? '(sin leer)'}`),
      check(after?.cardsTotal === 12, 'tras «Reintentar», 12 tarjetas', `${after?.cardsTotal ?? '(sin leer)'} tarjetas`),
      check(after !== undefined && after.errorText === undefined, 'tras «Reintentar», el aviso desaparece', `aviso ${after?.errorText === undefined ? 'desaparecido' : 'todavía visible'}`),
    ],
    `Peticiones a ${LIST_PATH} antes de «Reintentar»: ${hitsBeforeRetry.join(' | ') || '(ninguna)'}.${multiple ? ' La aplicación pidió la lista más de una vez antes de «Reintentar»: la fila no distingue la primera respuesta fabricada de las siguientes.' : ''}`,
  );
};

// --- Esquema 6: con menos de 1024 px una pestaña por estado ----------------------------------------------------------------------

const tabRow: BrowserRowHandler = async (row: ManifestRow, { page }) => {
  const state = strict('pestaña', TITLE_CELLS, cell(row, 'pestaña'));
  const count = strict('contador', COUNT_CELLS, cell(row, 'contador'));
  const codes = strict('codigos', CODES_CELLS, cell(row, 'codigos'));
  const expected = `al abrir /nc está elegida «Abierta»; la pestaña «${cell(row, 'pestaña')}» muestra el contador ${count} y el panel muestra las tarjetas ${cell(row, 'codigos')}`;
  const failed = await prepareWeb(page, 'responsive', GESTOR, expected);
  if (failed !== undefined) return failed;

  await waitBoard(page, 'responsive', settled);
  const openSelected = await attrOf(page.getByTestId(RESPONSIVE_DYNAMIC_TESTIDS.NC_TAB('open')), 'aria-selected');
  const clicked = await interact(page.getByTestId(RESPONSIVE_DYNAMIC_TESTIDS.NC_TAB(state)), `elegir la pestaña «${cell(row, 'pestaña')}»`, (element) => element.click(ACTION));
  if (clicked !== undefined) return actionFailed(expected, clicked);
  const view = await waitBoard(page, 'responsive', (current) => columnOf(current, state)?.present === true);
  const column = view === undefined ? undefined : columnOf(view, state);
  return verdictWeb(
    [
      check(openSelected === 'true', 'al abrir /nc está elegida la pestaña «Abierta»', `pestaña «Abierta» aria-selected ${openSelected ?? '(sin leer)'}`),
      check(column?.present === true && column.title === cell(row, 'pestaña'), `pestaña «${cell(row, 'pestaña')}»`, `pestaña «${column?.title ?? '(sin leer)'}»`),
      check(column?.count === String(count), `contador ${count}`, `contador ${column?.count ?? '(sin leer)'}`),
      check(column !== undefined && sameOrder(column.cards, codes), `panel con ${cell(row, 'codigos')}`, `panel con ${column?.cards.join(', ') || '(ninguna)'}`),
    ],
    'El título y el contador de la pestaña se leen de la propia pestaña (texto suelto, sin el contador).',
  );
};

defineBrowserRows({
  story: 'US-NC-TABLERO-006',
  surface: 'web',
  tenants: [TENANT_A],
  handlers: new Map<number, BrowserRowHandler>([
    [1, onWeb(columnRow)],
    [2, onWeb(cardRow)],
    [3, onWeb(countRow)],
    [4, onWeb(loadingRow)],
    [5, onWeb(failureRow)],
    [6, onWeb(tabRow)],
  ]),
});

