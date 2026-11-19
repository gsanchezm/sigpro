import type { Page } from '@playwright/test';
import { defineBrowserRows, outcome, type BrowserRowHandler } from '../../core/framework';
import { cell, check, preparationFailedWeb, strict, type Check } from '../../support/checks';
import { safe, waitUntil } from '../../support/browser';
import { TENANT_A, resetTenants } from '../../../story-runs/support/prepare';
import { done, numberOf } from '../api/common';
import {
  NETWORK_CAUSE,
  READ_MS,
  TRACE_READING,
  WAIT_MS,
  actionFailed,
  armToasts,
  bulkReportButton,
  buttonState,
  checkIn,
  checkboxOf,
  chooseIn,
  clickIn,
  codesIn,
  codesOfPdf,
  countText,
  exactTextCheck,
  failNextReport,
  fillIn,
  firstDownload,
  inOrder,
  linesOfPdf,
  listed,
  menuItem,
  onWeb,
  openPath,
  pageCount,
  pdfLineCheck,
  pressWhenEnabled,
  programSelect,
  quietCheck,
  quietWindow,
  reportButton,
  resultSelect,
  rowMenuButton,
  sameSet,
  searchBox,
  selectAllCheckbox,
  shownRows,
  signIn,
  toastCheck,
  toastShown,
  traceCheck,
  verificationRoot,
  visibleCodes,
  waitCountFor,
  watchDownloads,
  type ReportFailure,
  type WebAction,
} from '../web/common';

// US-VER-INFORME-004 — Descargar el informe desde «Verificación» (web, escritorio 1440 px salvo el Esquema 6). Preparación de cada
// fila: reinicio de alumno01 con el token de su administrador; gestor@sigpro.test entra en /login?tenant=alumno01 y llega a /programs;
// después se abre /verification con la lista cargada.

const REASON = 'No hay casos de prueba para el informe';
const EMPTY_COUNT = '0–0 de 0';
const REPORT_NAME = 'informe-verificacion.pdf';
const SELECTION_NAME = 'informe-verificacion-seleccion.pdf';
const ALL_CASES = 25;

// --- Mapas de las celdas (un texto que no conocen LANZA) ---------------------------------------------------------------------------

/** Opción del desplegable «Programa» y los casos que trae su alcance (el seed: 25 en total y 9 en PRG-002). */
interface ProgramChoice {
  readonly label: string;
  readonly total: number;
}

const PROGRAM_CELLS: ReadonlyMap<string, ProgramChoice> = new Map<string, ProgramChoice>([
  ['«Todos los programas»', { label: 'Todos los programas', total: ALL_CASES }],
  ['PRG-002', { label: 'PRG-002', total: 9 }],
]);

const SEARCH_CELLS: ReadonlyMap<string, string> = new Map<string, string>([['Latencia', 'Latencia']]);

const RESULT_CELLS: ReadonlyMap<string, string> = new Map<string, string>([
  ['«Fallido»', 'Fallido'],
  ['«Superado»', 'Superado'],
  ['«Todos los resultados»', 'Todos los resultados'],
]);

const CONDITION_CELLS: ReadonlyMap<string, string> = new Map<string, string>([['elige PRG-004 en el filtro «Programa»', 'PRG-004']]);

const FAILURE_CELLS: ReadonlyMap<string, ReportFailure> = new Map<string, ReportFailure>([
  ['responda con error 500', 'status500'],
  ['no obtenga respuesta del servidor', 'noResponse'],
]);

/** Detalle del aviso: la traza de la petición fallida, o el texto de red exacto. */
type Detail = { readonly kind: 'trace' } | { readonly kind: 'text'; readonly text: string };

const DETAIL_CELLS: ReadonlyMap<string, Detail> = new Map<string, Detail>([
  ['la traza de la petición fallida', { kind: 'trace' }],
  ['el texto «No se pudo contactar con el servidor»', { kind: 'text', text: 'No se pudo contactar con el servidor' }],
]);

const WIDTH_CELLS: ReadonlyMap<string, number> = new Map<string, number>([
  ['1023', 1023],
  ['1024', 1024],
]);

const PRESENTATION_CELLS: ReadonlyMap<string, 'sin casillas ni menú' | 'con casilla y menú'> = new Map<string, 'sin casillas ni menú' | 'con casilla y menú'>([
  ['no hay casillas de selección ni menú en las tarjetas de los casos', 'sin casillas ni menú'],
  ['cada fila tiene la casilla «Seleccionar TC-001» y el botón «Acciones para TC-001»', 'con casilla y menú'],
]);

/**
 * Acciones de la selección y del menú de fila: cada una termina pulsando el botón de descarga que nombra la historia. Los casos que
 * marca una acción sin código explícito («todos los casos de la página») se leen de la lista antes de marcar.
 */
const SELECTION_CELLS: ReadonlyMap<string, WebAction> = new Map<string, WebAction>([
  [
    'abre el menú «Acciones para TC-002» y pulsa «Informe PDF»',
    inOrder(clickIn((page) => rowMenuButton(page, 'TC-002'), 'abrir el menú «Acciones para TC-002»'), clickIn((page) => menuItem(page, 'Informe PDF'), 'pulsar «Informe PDF»')),
  ],
  [
    'marca «Seleccionar TC-001» y «Seleccionar TC-010» y pulsa «Informe de la selección»',
    inOrder(
      checkIn((page) => checkboxOf(page, 'TC-001'), 'marcar «Seleccionar TC-001»'),
      checkIn((page) => checkboxOf(page, 'TC-010'), 'marcar «Seleccionar TC-010»'),
      clickIn(bulkReportButton, 'pulsar «Informe de la selección»'),
    ),
  ],
  [
    'marca «Seleccionar todos los casos de la página» y pulsa «Informe de la selección»',
    inOrder(checkIn(selectAllCheckbox, 'marcar «Seleccionar todos los casos de la página»'), clickIn(bulkReportButton, 'pulsar «Informe de la selección»')),
  ],
]);

/** Lectura del DOM de la lista en una sola evaluación: casillas, menús, filas y la posición del botón de informe. */
interface Presentation {
  readonly checkboxes: number;
  readonly menus: number;
  readonly rows: number;
  readonly headerText: string | null;
  readonly headerTop: number | null;
  readonly rowTop: number | null;
}

const presentationNow = (page: Page): Promise<Presentation | undefined> =>
  safe(
    () =>
      verificationRoot(page).evaluate(
        (root) => {
          const rowSelector = '[data-testid^="testcase-row-"]:not([data-testid^="testcase-row-menu-"])';
          const headerButton = Array.from(root.querySelectorAll('button')).find((button) => button.textContent?.trim() === 'Descargar informe PDF');
          const firstRow = root.querySelector(rowSelector);
          return {
            checkboxes: root.querySelectorAll('input[type="checkbox"][aria-label^="Seleccionar TC-"]').length,
            menus: root.querySelectorAll('button[aria-label^="Acciones para TC-"]').length,
            rows: root.querySelectorAll(rowSelector).length,
            headerText: headerButton?.textContent?.trim() ?? null,
            headerTop: headerButton?.getBoundingClientRect().top ?? null,
            rowTop: firstRow?.getBoundingClientRect().top ?? null,
          };
        },
        undefined,
        { timeout: READ_MS },
      ),
    undefined,
  );

/** Nota del fallo de red: la causa solo si el aviso muestra el «network error» de la traza. */
const causeOf = (body: string | undefined): string | undefined => (body !== undefined && body.includes('network error') ? NETWORK_CAUSE : undefined);

// --- Esquema 1: el botón de la cabecera descarga el informe del programa filtrado o de todos los casos ----------------------------

const headerDownloads: BrowserRowHandler = async (row, { page }) => {
  await resetTenants([TENANT_A]);
  const programa = strict('programa', PROGRAM_CELLS, cell(row, 'programa'));
  const nombre = cell(row, 'nombre');
  const expected = `se descarga ${nombre} y aviso «Informe generado» con ${nombre}`;
  const signed = await signIn(page, 1440);
  if (signed !== undefined) return preparationFailedWeb(expected, signed);
  const listedAt = await openPath(page, '/verification', 'list');
  if (listedAt !== undefined) return preparationFailedWeb(expected, listedAt);
  const chosen = await chooseIn(programSelect, 'Programa', programa.label)(page);
  if (chosen !== undefined) return actionFailed(expected, chosen);
  // Antes de pulsar, la lista debe mostrar el alcance elegido: si no, el botón descargaría el alcance anterior
  const settled = await waitCountFor(() => countText(page), programa.total);
  if (!settled) {
    const now = await countText(page);
    return outcome(false, expected, `la lista no muestra ${pageCount(programa.total)} tras elegir «${programa.label}» (muestra «${now ?? '(sin contador)'}»)`, {
      note: 'El contador de la lista no llega al alcance elegido: el botón descargaría otro alcance.',
    });
  }
  const downloads = watchDownloads(page);
  await armToasts(page);
  const pressed = await pressWhenEnabled(reportButton, 'pulsar «Descargar informe PDF»', page);
  if (pressed !== undefined) return actionFailed(expected, pressed);
  const file = await firstDownload(downloads);
  const toast = await toastShown(page, 'Informe generado');
  return done([
    check(file?.name === nombre, `se descarga el archivo «${nombre}»`, `se descarga «${file?.name ?? '(ninguna descarga)'}»`),
    toastCheck(toast, 'Informe generado', nombre),
  ]);
};

// --- Esquema 2: la búsqueda y el filtro de resultado no cambian el alcance del informe ---------------------------------------

const searchAndResultKeepScope: BrowserRowHandler = async (row, { page }) => {
  await resetTenants([TENANT_A]);
  const busqueda = strict('busqueda', SEARCH_CELLS, cell(row, 'busqueda'));
  const resultado = strict('resultado', RESULT_CELLS, cell(row, 'resultado'));
  const visibles = numberOf(cell(row, 'casos_visibles'));
  const countLine = `Casos de prueba: ${ALL_CASES} · Ejecutados: ${ALL_CASES} · Sin ejecutar: 0`;
  const expected = `la lista muestra ${visibles} casos de prueba y se descarga ${REPORT_NAME} con el PDF «${countLine}»`;
  const signed = await signIn(page, 1440);
  if (signed !== undefined) return preparationFailedWeb(expected, signed);
  const listedAt = await openPath(page, '/verification', 'list');
  if (listedAt !== undefined) return preparationFailedWeb(expected, listedAt);
  const typed = await fillIn(searchBox, 'Buscar casos de prueba', busqueda)(page);
  if (typed !== undefined) return actionFailed(expected, typed);
  const filtered = await chooseIn(resultSelect, 'Último resultado', resultado)(page);
  if (filtered !== undefined) return actionFailed(expected, filtered);
  // La lista se filtra con un retardo de búsqueda: se espera a que muestre lo que dice la historia antes de descargar
  await waitUntil(async () => (await shownRows(page)) === visibles, WAIT_MS);
  const rows = await shownRows(page);
  const downloads = watchDownloads(page);
  const pressed = await pressWhenEnabled(reportButton, 'pulsar «Descargar informe PDF»', page);
  if (pressed !== undefined) return actionFailed(expected, pressed);
  const file = await firstDownload(downloads);
  return done([
    check(rows === visibles, `la lista muestra ${visibles} casos de prueba`, `la lista muestra ${rows} casos de prueba`),
    check(file?.name === REPORT_NAME, `se descarga el archivo «${REPORT_NAME}»`, `se descarga «${file?.name ?? '(ninguna descarga)'}»`),
    pdfLineCheck(linesOfPdf(file?.bytes), countLine, 'Casos de prueba:'),
  ]);
};

// --- Esquema 3: sin casos en la vista, «Descargar informe PDF» está deshabilitado con su explicación -----------------------------

const emptyViewDisabled: BrowserRowHandler = async (row, { page }) => {
  await resetTenants([TENANT_A]);
  const programa = strict('condicion', CONDITION_CELLS, cell(row, 'condicion'));
  const expected = `«Descargar informe PDF» deshabilitado, con la explicación «${REASON}»`;
  const signed = await signIn(page, 1440);
  if (signed !== undefined) return preparationFailedWeb(expected, signed);
  const listedAt = await openPath(page, '/verification', 'list');
  if (listedAt !== undefined) return preparationFailedWeb(expected, listedAt);
  const chosen = await chooseIn(programSelect, 'Programa', programa)(page);
  if (chosen !== undefined) return actionFailed(expected, chosen);
  await waitUntil(async () => (await countText(page)) === EMPTY_COUNT, WAIT_MS);
  // Una sola lectura del botón: estado, explicación (title) y texto visible
  const state = await buttonState(reportButton(page));
  const count = await countText(page);
  return done([
    check(count === EMPTY_COUNT, 'la vista no tiene casos', `el contador dice «${count ?? '(sin contador)'}»`),
    check(state?.disabled === true, '«Descargar informe PDF» deshabilitado', state === undefined ? '(sin leer)' : `«${state.text}» ${state.disabled ? 'deshabilitado' : 'habilitado'}`),
    check(state?.title === REASON, `con la explicación «${REASON}»`, state?.title === undefined ? '(sin explicación)' : `con la explicación «${state.title}»`),
  ]);
};

// --- Esquema 4: si la petición del informe falla, aparece el aviso de error y no se descarga nada ------------------------------

const failedReport: BrowserRowHandler = async (row, { page }) => {
  await resetTenants([TENANT_A]);
  const fallo = strict('fallo', FAILURE_CELLS, cell(row, 'fallo'));
  const detalle = strict('detalle', DETAIL_CELLS, cell(row, 'detalle'));
  const expected = `aviso «No se pudo generar el informe» con ${cell(row, 'detalle')}, y no se descarga ningún archivo`;
  const signed = await signIn(page, 1440);
  if (signed !== undefined) return preparationFailedWeb(expected, signed);
  const listedAt = await openPath(page, '/verification', 'list');
  if (listedAt !== undefined) return preparationFailedWeb(expected, listedAt);
  await failNextReport(page, fallo);
  const downloads = watchDownloads(page);
  await armToasts(page);
  const pressed = await pressWhenEnabled(reportButton, 'pulsar «Descargar informe PDF»', page);
  if (pressed !== undefined) return actionFailed(expected, pressed);
  const toast = await toastShown(page, 'No se pudo generar el informe');
  await quietWindow();
  const body = toast.entry?.body;
  const detailCheck = detalle.kind === 'trace' ? traceCheck(body) : exactTextCheck(body, detalle.text);
  return done(
    [check(toast.entry !== undefined, 'aviso «No se pudo generar el informe»', toast.observed), detailCheck, quietCheck(downloads.count(), 'ningún archivo descargado')],
    { reading: detalle.kind === 'trace' ? TRACE_READING : undefined, cause: detalle.kind === 'text' ? causeOf(body) : undefined },
  );
};

// --- Esquema 5: el menú de una fila o la selección descargan el informe de esos casos ------------------------------------------

const selectionReports: BrowserRowHandler = async (row, { page }) => {
  await resetTenants([TENANT_A]);
  const accion = strict('accion', SELECTION_CELLS, cell(row, 'accion'));
  const casos = numberOf(cell(row, 'casos'));
  const countLine = `Casos de prueba: ${casos} · Ejecutados: ${casos} · Sin ejecutar: 0`;
  const expected = `se descarga ${SELECTION_NAME} con el PDF «${countLine}» que cubre los casos de la acción, y aviso «Informe generado» con ${SELECTION_NAME}`;
  const signed = await signIn(page, 1440);
  if (signed !== undefined) return preparationFailedWeb(expected, signed);
  const listedAt = await openPath(page, '/verification', 'list');
  if (listedAt !== undefined) return preparationFailedWeb(expected, listedAt);
  // Los casos que debe cubrir el informe: los que nombra la acción, o los que muestra la lista antes de marcar («todos»)
  const named = codesIn(cell(row, 'accion'));
  const shownBefore = await visibleCodes(verificationRoot(page));
  if (named.length === 0 && (shownBefore === undefined || shownBefore.length === 0)) {
    return preparationFailedWeb(expected, 'no se pudo leer qué casos muestra la lista antes de marcar «todos» (sin casos en la lista o sin leer)');
  }
  const wanted = named.length > 0 ? named : (shownBefore ?? []);
  const downloads = watchDownloads(page);
  await armToasts(page);
  const blocked = await accion(page);
  if (blocked !== undefined) return actionFailed(expected, blocked);
  const file = await firstDownload(downloads);
  const toast = await toastShown(page, 'Informe generado');
  const pdfCodes = codesOfPdf(linesOfPdf(file?.bytes));
  const coverage: Check = check(sameSet(pdfCodes, wanted), `el PDF cubre los casos ${listed(wanted)}`, `el PDF cubre ${listed(pdfCodes)}`);
  return done([
    check(file?.name === SELECTION_NAME, `se descarga el archivo «${SELECTION_NAME}»`, `se descarga «${file?.name ?? '(ninguna descarga)'}»`),
    pdfLineCheck(linesOfPdf(file?.bytes), countLine, 'Casos de prueba:'),
    coverage,
    toastCheck(toast, 'Informe generado', SELECTION_NAME),
  ]);
};

// --- Esquema 6: la presentación de la lista según el ancho de la ventana -----------------------------------------------------

const presentationByWidth: BrowserRowHandler = async (row, { page }) => {
  await resetTenants([TENANT_A]);
  const ancho = strict('ancho', WIDTH_CELLS, cell(row, 'ancho'));
  const presentacion = strict('presentacion', PRESENTATION_CELLS, cell(row, 'presentacion'));
  const expected = `${presentacion === 'sin casillas ni menú' ? 'ni casillas ni menú en las tarjetas' : 'casilla «Seleccionar TC-001» y botón «Acciones para TC-001» en cada fila'} y «Descargar informe PDF» en la cabecera`;
  const signed = await signIn(page, ancho);
  if (signed !== undefined) return preparationFailedWeb(expected, signed);
  const listedAt = await openPath(page, '/verification', 'list');
  if (listedAt !== undefined) return preparationFailedWeb(expected, listedAt);
  const view = await presentationNow(page);
  if (view === undefined) return preparationFailedWeb(expected, 'no se pudo leer la lista de casos');
  const sawTc001Checkbox = (await checkboxOf(page, 'TC-001').count()) === 1;
  const sawTc001Menu = (await rowMenuButton(page, 'TC-001').count()) === 1;
  const headerReads = view.headerText === 'Descargar informe PDF' && view.headerTop !== null && view.rowTop !== null && view.headerTop < view.rowTop;
  const cards = view.rows > 0;
  const presentationChecks: Check[] =
    presentacion === 'sin casillas ni menú'
      ? [check(cards && view.checkboxes === 0 && view.menus === 0, 'ni casillas ni menú en las tarjetas (y hay tarjetas)', `casillas ${view.checkboxes}, menús ${view.menus}, tarjetas ${view.rows}`)]
      : [
          check(cards && view.checkboxes === view.rows && view.menus === view.rows, 'una casilla y un menú en cada fila', `casillas ${view.checkboxes}, menús ${view.menus}, filas ${view.rows}`),
          check(sawTc001Checkbox && sawTc001Menu, 'la casilla «Seleccionar TC-001» y el botón «Acciones para TC-001»', `casilla TC-001 ${sawTc001Checkbox ? 'sí' : 'no'}, menú TC-001 ${sawTc001Menu ? 'sí' : 'no'}`),
        ];
  return done(
    [
      ...presentationChecks,
      check(
        headerReads,
        '«Descargar informe PDF» en la cabecera, por encima de la lista',
        `botón «${view.headerText ?? '(sin texto)'}» a ${view.headerTop === null ? '(sin medir)' : Math.round(view.headerTop)} px del borde, primera fila a ${view.rowTop === null ? '(sin medir)' : Math.round(view.rowTop)} px`,
      ),
    ],
    {
      reading: '«En la cabecera» se mide como: el botón queda por encima de la primera fila de la lista y a la vista. La historia no fija la posición exacta.',
      evidence: { ancho, casillas: view.checkboxes, menus: view.menus, filas: view.rows },
    },
  );
};

defineBrowserRows({
  story: 'US-VER-INFORME-004',
  surface: 'web',
  tenants: [TENANT_A],
  handlers: new Map<number, BrowserRowHandler>([
    [1, onWeb(headerDownloads)],
    [2, onWeb(searchAndResultKeepScope)],
    [3, onWeb(emptyViewDisabled)],
    [4, onWeb(failedReport)],
    [5, onWeb(selectionReports)],
    [6, onWeb(presentationByWidth)],
  ]),
});
