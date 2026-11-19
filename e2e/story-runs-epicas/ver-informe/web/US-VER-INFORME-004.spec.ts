import type { Page } from '@playwright/test';
import { defineBrowserRows, outcome, type BrowserRowHandler } from '../../core/framework';
import { cell, check, preparationFailedWeb, strict, type Check } from '../../support/checks';
import { safe, waitUntil } from '../../support/browser';
import { TENANT_A, resetTenants } from '../../../story-runs/support/prepare';
import { done, numberOf } from '../api/common';
import { SEED_CASES } from '../api/seed-cases';
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
/** La primera página de la lista (diez casos, por código): los que marca «Seleccionar todos los casos de la página». Viene del seed. */
const FIRST_PAGE = SEED_CASES.slice(0, 10).map((testCase) => testCase.code);

/** Reglas que la historia enuncia y que ninguna fila de este Esquema comprueba (se anotan, no se juzgan aquí). */
const RULES_WITHOUT_ROW =
  'Reglas sin fila (no se comprueban aquí): la barra dice «<n> seleccionados», «Quitar selección» vacía la marca, y cambiar filtro, orden o página vacía la selección marcada.';
/** Decisión pendiente de la historia 002 (sigue en la 004 por su Ejemplo): el nombre de la selección de un solo caso. */
const SINGLE_CASE_NAME_PENDING =
  'Decisión pendiente de la historia 002: el nombre de la selección de un solo caso. Se juzga contra el Ejemplo (informe-verificacion-seleccion.pdf), que es lo que la historia afirma hoy.';
/** Cambiar el filtro vacía la selección: esta fila cambia el filtro sin tener nada marcado. */
const FILTER_RULE = 'Regla sin fila: cambiar el filtro de programa o de resultado vacía la selección marcada (aquí no hay selección).';

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
 * marca una acción sin código explícito («todos los casos de la página») son los de la primera página del seed.
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

/**
 * Lectura del DOM de la lista en UNA sola evaluación: casillas, menús, filas, el botón de informe (texto, visibilidad, posición) y el
 * título de la pantalla (solo se muestra en escritorio).
 */
interface Presentation {
  readonly checkboxes: number;
  readonly menus: number;
  readonly rows: number;
  readonly tc001Checkbox: number;
  readonly tc001Menu: number;
  readonly headerText: string | null;
  readonly headerVisible: boolean;
  readonly headerTop: number | null;
  readonly headerLeft: number | null;
  readonly rowTop: number | null;
  readonly titleRight: number | null;
}

const presentationNow = (page: Page): Promise<Presentation | undefined> =>
  safe(
    () =>
      verificationRoot(page).evaluate(
        (root) => {
          const rowSelector = '[data-testid^="testcase-row-"]:not([data-testid^="testcase-row-menu-"])';
          const shown = (element: Element): boolean => {
            const box = element.getBoundingClientRect();
            const style = getComputedStyle(element);
            return box.width > 0 && box.height > 0 && style.visibility !== 'hidden' && style.display !== 'none';
          };
          const headerButton = Array.from(root.querySelectorAll('button')).find((button) => button.textContent?.trim() === 'Descargar informe PDF') ?? null;
          const title = root.querySelector('h1');
          const firstRow = root.querySelector(rowSelector);
          return {
            checkboxes: root.querySelectorAll('input[type="checkbox"][aria-label^="Seleccionar TC-"]').length,
            menus: root.querySelectorAll('button[aria-label^="Acciones para TC-"]').length,
            rows: root.querySelectorAll(rowSelector).length,
            tc001Checkbox: root.querySelectorAll('input[type="checkbox"][aria-label="Seleccionar TC-001"]').length,
            tc001Menu: root.querySelectorAll('button[aria-label="Acciones para TC-001"]').length,
            headerText: headerButton?.textContent?.trim() ?? null,
            headerVisible: headerButton !== null && shown(headerButton),
            headerTop: headerButton?.getBoundingClientRect().top ?? null,
            headerLeft: headerButton?.getBoundingClientRect().left ?? null,
            rowTop: firstRow?.getBoundingClientRect().top ?? null,
            titleRight: title !== null && shown(title) ? title.getBoundingClientRect().right : null,
          };
        },
        undefined,
        { timeout: READ_MS },
      ),
    undefined,
  );

/** Un número de píxeles para el observado (o «(sin medir)»). */
const px = (value: number | null): string => (value === null ? '(sin medir)' : `${Math.round(value)} px`);

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
  return done(
    [check(file?.name === nombre, `se descarga el archivo «${nombre}»`, `se descarga «${file?.name ?? '(ninguna descarga)'}»`), toastCheck(toast, 'Informe generado', nombre)],
    { reading: FILTER_RULE },
  );
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
  return done(
    [
      check(rows === visibles, `la lista muestra ${visibles} casos de prueba`, `la lista muestra ${rows} casos de prueba`),
      check(file?.name === REPORT_NAME, `se descarga el archivo «${REPORT_NAME}»`, `se descarga «${file?.name ?? '(ninguna descarga)'}»`),
      pdfLineCheck(linesOfPdf(file?.bytes), countLine, 'Casos de prueba:'),
    ],
    { reading: FILTER_RULE },
  );
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
  // Los casos que debe cubrir el informe: los que nombra la acción, o («todos los de la página») los diez primeros del seed
  const named = codesIn(cell(row, 'accion'));
  const wanted = named.length > 0 ? named : FIRST_PAGE;
  const shownBefore = named.length === 0 ? await visibleCodes(verificationRoot(page)) : undefined;
  const downloads = watchDownloads(page);
  await armToasts(page);
  const blocked = await accion(page);
  if (blocked !== undefined) return actionFailed(expected, blocked);
  const file = await firstDownload(downloads);
  const toast = await toastShown(page, 'Informe generado');
  const pdfCodes = codesOfPdf(linesOfPdf(file?.bytes));
  const coverage: Check = check(sameSet(pdfCodes, wanted), `el PDF cubre los casos ${listed(wanted)}`, `el PDF cubre ${listed(pdfCodes)}`);
  const pageCheck: Check[] =
    named.length === 0 ? [check(sameSet(shownBefore ?? [], FIRST_PAGE), `la lista muestra los diez primeros casos (${listed(FIRST_PAGE)})`, `la lista muestra ${listed(shownBefore)}`)] : [];
  return done(
    [
      check(file?.name === SELECTION_NAME, `se descarga el archivo «${SELECTION_NAME}»`, `se descarga «${file?.name ?? '(ninguna descarga)'}»`),
      pdfLineCheck(linesOfPdf(file?.bytes), countLine, 'Casos de prueba:'),
      coverage,
      ...pageCheck,
      toastCheck(toast, 'Informe generado', SELECTION_NAME),
    ],
    { reading: [named.length === 1 ? SINGLE_CASE_NAME_PENDING : undefined, RULES_WITHOUT_ROW].filter((part): part is string => part !== undefined).join(' ') },
  );
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
  const cards = view.rows > 0;
  const presentationChecks: Check[] =
    presentacion === 'sin casillas ni menú'
      ? [check(cards && view.checkboxes === 0 && view.menus === 0, 'ni casillas ni menú en las tarjetas (y hay tarjetas)', `casillas ${view.checkboxes}, menús ${view.menus}, tarjetas ${view.rows}`)]
      : [
          check(cards && view.checkboxes === view.rows && view.menus === view.rows, 'una casilla y un menú en cada fila', `casillas ${view.checkboxes}, menús ${view.menus}, filas ${view.rows}`),
          check(view.tc001Checkbox === 1 && view.tc001Menu === 1, 'la casilla «Seleccionar TC-001» y el botón «Acciones para TC-001»', `casilla TC-001 ${view.tc001Checkbox}, menú TC-001 ${view.tc001Menu}`),
        ];
  const above = view.headerTop !== null && view.rowTop !== null && view.headerTop < view.rowTop;
  const headerOk = view.headerText === 'Descargar informe PDF' && view.headerVisible && above;
  // A 1023 px el título no se muestra (VerificationPage.tsx: «!mobile ? h1»): ahí no hay con qué comparar la posición horizontal
  const rightOfTitle = view.titleRight === null || (view.headerLeft !== null && view.headerLeft >= view.titleRight);
  return done(
    [
      ...presentationChecks,
      check(
        headerOk,
        '«Descargar informe PDF» visible en la cabecera, por encima de la lista',
        `botón «${view.headerText ?? '(sin texto)'}» ${view.headerVisible ? 'visible' : 'no visible'}, arriba ${px(view.headerTop)}, primera fila ${px(view.rowTop)}`,
      ),
      check(
        rightOfTitle,
        '«Descargar informe PDF» a la derecha del título',
        view.titleRight === null ? 'el título no se muestra a este ancho: no hay título con el que comparar' : `botón a ${px(view.headerLeft)}, el título acaba a ${px(view.titleRight)}`,
      ),
    ],
    {
      reading:
        '«En la cabecera» se mide como: el botón queda visible, por encima de la primera fila de la lista y, si el título se muestra, a su derecha (Regla de la historia). La historia no fija la posición exacta. A 1023 px el título no se muestra y la posición horizontal no se compara.',
      evidence: { ancho, casillas: view.checkboxes, menus: view.menus, filas: view.rows, visible: view.headerVisible },
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
