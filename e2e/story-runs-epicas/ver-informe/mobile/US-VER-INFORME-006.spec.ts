import type { Page } from '@playwright/test';
import { defineBrowserRows, outcome, type BrowserRowHandler } from '../../core/framework';
import { cell, check, preparationFailedWeb, strict, type Check } from '../../support/checks';
import { safe, waitUntil } from '../../support/browser';
import { TENANT_A, resetTenants } from '../../../story-runs/support/prepare';
import { CASE_CELLS, done, numberOf } from '../api/common';
import {
  NETWORK_CAUSE,
  TRACE_READING,
  WAIT_MS,
  actionFailed,
  clickIn,
  codesIn,
  codesOfPdf,
  exactTextCheck,
  failNextReport,
  inOrder,
  linesOfPdf,
  listed,
  pageCount,
  pdfLineCheck,
  pressWhenEnabled,
  quietWindow,
  sameSet,
  toastCheck,
  toastShown,
  traceCheck,
  visibleCodes,
  waitCountFor,
  type ReportFailure,
  type WebAction,
} from '../web/common';
import {
  armAll,
  bulkReportButton,
  bytesOf,
  caseReportButton,
  cardReport,
  chooseProgram,
  countText,
  deliveredCheck,
  emptyBlock,
  firstDelivery,
  listRoot,
  markCard,
  notDelivered,
  onExpoWeb,
  openRoute,
  reportButton,
  reportState,
  selectAllButton,
  signIn,
  toggleSelect,
} from './common';

// US-VER-INFORME-006 — Descargar el informe desde «Verificación» y desde el detalle, con selección y entrega (app móvil, Expo web a
// 390 × 844; NO es nativo). Preparación de cada fila: reinicio de alumno01 con el token de su administrador; la app en /login con
// alumno01 en «Tenant de trabajo», gestor@sigpro.test y «Entrar»; después /verification con la lista cargada, o el detalle del caso.
// La entrega se lee como lo que la app abre (una pestaña con un blob: PDF), no como la hoja de compartir del sistema.

const REASON = 'No hay casos de prueba para el informe';
const SELECTION_NAME = 'informe-verificacion-seleccion.pdf';
const ALL_CASES = 25;

/** Opción del desplegable «Programa» y los casos que trae su alcance (el seed: 25 en total y 9 en PRG-002). */
interface ProgramChoice {
  readonly label: string;
  readonly total: number;
}

/** La celda con comillas es el texto de la opción «Todos los programas». */
const PROGRAM_CELLS: ReadonlyMap<string, ProgramChoice> = new Map<string, ProgramChoice>([
  ['«Todos los programas»', { label: 'Todos los programas', total: ALL_CASES }],
  ['PRG-002', { label: 'PRG-002', total: 9 }],
]);

const CONDITION_CELLS: ReadonlyMap<string, string> = new Map<string, string>([['elige PRG-004 en el filtro «Programa»', 'PRG-004']]);

/** Selección de la lista: la acción marca casos nombrados (con su código en el texto) o «todos los de la página» (se leen de la lista). */
const SELECTION_CELLS: ReadonlyMap<string, WebAction> = new Map<string, WebAction>([
  ['pulsa «Seleccionar», marca «Seleccionar TC-001» y «Seleccionar TC-010»', inOrder(toggleSelect, markCard('TC-001'), markCard('TC-010'))],
  ['pulsa «Seleccionar» y marca «Seleccionar todos los casos de la página»', inOrder(toggleSelect, clickIn(selectAllButton, 'marcar «Seleccionar todos los casos de la página»'))],
]);

const SCREEN_CELLS: ReadonlyMap<string, 'list' | 'detail'> = new Map<string, 'list' | 'detail'>([
  ['/verification', 'list'],
  ['/verification/TC-019', 'detail'],
]);

/** Acción del menú de la tarjeta o del botón del detalle; el código de la celda «caso» la completa. */
const ACTION_CELLS: ReadonlyMap<string, (caso: string) => WebAction> = new Map<string, (caso: string) => WebAction>([
  ['abre el menú «Acciones para TC-002» y pulsa «Informe PDF»', (caso) => cardReport(caso)],
  ['pulsa «Descargar informe PDF»', () => clickIn(caseReportButton, 'pulsar «Descargar informe PDF» del detalle')],
]);

const FAILURE_CELLS: ReadonlyMap<string, ReportFailure> = new Map<string, ReportFailure>([
  ['responda con error 500', 'status500'],
  ['no obtenga respuesta del servidor', 'noResponse'],
]);

type Detail = { readonly kind: 'trace' } | { readonly kind: 'text'; readonly text: string };

const DETAIL_CELLS: ReadonlyMap<string, Detail> = new Map<string, Detail>([
  ['la traza de la petición fallida', { kind: 'trace' }],
  ['el texto «No se pudo contactar con el servidor»', { kind: 'text', text: 'No se pudo contactar con el servidor' }],
]);

/** Causa de la nota del fallo de red: solo si el aviso muestra el «network error» de la traza. */
const causeOf = (body: string | undefined): string | undefined => (body !== undefined && body.includes('network error') ? NETWORK_CAUSE : undefined);

/** Códigos de casos de la lista que se ven ahora (tarjetas de la app móvil, sin los menús). */
const shownCodes = (page: Page): Promise<readonly string[] | undefined> => visibleCodes(listRoot(page));

// --- Esquema 1: el botón de la lista descarga el informe del programa filtrado o de todos los casos -----------------------------

const listDownloads: BrowserRowHandler = async (row, { page }) => {
  await resetTenants([TENANT_A]);
  const programa = strict('programa', PROGRAM_CELLS, cell(row, 'programa'));
  const nombre = cell(row, 'nombre');
  const expected = `se entrega el informe (un PDF en una pestaña nueva) y aviso «Informe generado» con ${nombre}`;
  const signed = await signIn(page);
  if (signed !== undefined) return preparationFailedWeb(expected, signed);
  const listedAt = await openRoute(page, '/verification', 'list');
  if (listedAt !== undefined) return preparationFailedWeb(expected, listedAt);
  const chosen = await chooseProgram(programa.label)(page);
  if (chosen !== undefined) return actionFailed(expected, chosen);
  // Antes de pulsar, la lista debe mostrar el alcance elegido: si no, el botón entregaría el alcance anterior
  const settled = await waitCountFor(() => countText(page), programa.total);
  if (!settled) {
    const now = await countText(page);
    return outcome(false, expected, `la lista no muestra ${pageCount(programa.total)} tras elegir «${programa.label}» (muestra «${now ?? '(sin contador)'}»)`, {
      note: 'El contador de la lista no llega al alcance elegido: el botón entregaría otro alcance.',
    });
  }
  await armAll(page);
  const pressed = await pressWhenEnabled(reportButton, 'pulsar «Descargar informe PDF»', page);
  if (pressed !== undefined) return actionFailed(expected, pressed);
  const delivery = await firstDelivery(page);
  const toast = await toastShown(page, 'Informe generado');
  return done([deliveredCheck(delivery), toastCheck(toast, 'Informe generado', nombre)]);
};

// --- Esquema 2: sin casos en la vista, el botón está deshabilitado y lo dice ----------------------------------------------------

const emptyViewDisabled: BrowserRowHandler = async (row, { page }) => {
  await resetTenants([TENANT_A]);
  const programa = strict('condicion', CONDITION_CELLS, cell(row, 'condicion'));
  const expected = `«Descargar informe PDF» deshabilitado y se lee «${REASON}»`;
  const signed = await signIn(page);
  if (signed !== undefined) return preparationFailedWeb(expected, signed);
  const listedAt = await openRoute(page, '/verification', 'list');
  if (listedAt !== undefined) return preparationFailedWeb(expected, listedAt);
  const chosen = await chooseProgram(programa)(page);
  if (chosen !== undefined) return actionFailed(expected, chosen);
  await waitUntil(async () => (await safe(() => emptyBlock(page).isVisible(), false)) === true, WAIT_MS);
  // Una sola lectura: deshabilitado, motivo visible (acotado al elemento del motivo) y el data-reason del botón
  const state = await reportState(page);
  const visible = state?.visibleReason;
  return done(
    [
      check(state?.disabled === true, '«Descargar informe PDF» deshabilitado', state === undefined ? '(sin leer)' : state.disabled ? '«Descargar informe PDF» deshabilitado' : '«Descargar informe PDF» habilitado'),
      check(visible === REASON, `se lee «${REASON}» como texto visible`, visible === undefined ? `no se lee ningún motivo visible${state?.dataReason === undefined ? '' : ` (solo data-reason «${state.dataReason}»)`}` : `se lee «${visible}»`),
    ],
    {
      reading: 'El motivo se lee como texto visible del elemento del motivo (testid verification-report-reason), que es lo que la historia llama «debajo de él». El data-reason del botón se anota como evidencia y no cuenta como lectura.',
      evidence: { dataReason: state?.dataReason ?? '(ausente)' },
    },
  );
};

// --- Esquema 3: la selección descarga el informe de los casos marcados ---------------------------------------------------------

const selectionDelivers: BrowserRowHandler = async (row, { page }) => {
  await resetTenants([TENANT_A]);
  const seleccion = strict('seleccion', SELECTION_CELLS, cell(row, 'seleccion'));
  const casos = numberOf(cell(row, 'casos'));
  const countLine = `Casos de prueba: ${casos} · Ejecutados: ${casos} · Sin ejecutar: 0`;
  const expected = `se entrega el informe de la selección con el PDF «${countLine}» y aviso «Informe generado» con ${SELECTION_NAME}`;
  const signed = await signIn(page);
  if (signed !== undefined) return preparationFailedWeb(expected, signed);
  const listedAt = await openRoute(page, '/verification', 'list');
  if (listedAt !== undefined) return preparationFailedWeb(expected, listedAt);
  // Los casos que debe cubrir el informe: los que nombra la acción, o los que muestran las tarjetas antes de marcar («todos»)
  const named = codesIn(cell(row, 'seleccion'));
  const shownBefore = await shownCodes(page);
  if (named.length === 0 && (shownBefore === undefined || shownBefore.length === 0)) {
    return preparationFailedWeb(expected, 'no se pudo leer qué casos muestra la lista antes de marcar «todos» (sin casos en la lista o sin leer)');
  }
  const wanted = named.length > 0 ? named : (shownBefore ?? []);
  await armAll(page);
  const blocked = await inOrder(seleccion, clickIn(bulkReportButton, 'pulsar «Informe de la selección»'))(page);
  if (blocked !== undefined) return actionFailed(expected, blocked);
  const delivery = await firstDelivery(page);
  const toast = await toastShown(page, 'Informe generado');
  const lines = linesOfPdf(bytesOf(delivery));
  const pdfCodes = codesOfPdf(lines);
  const coverage: Check = check(sameSet(pdfCodes, wanted), `el PDF cubre los casos ${listed(wanted)}`, `el PDF cubre ${listed(pdfCodes)}`);
  return done([deliveredCheck(delivery), pdfLineCheck(lines, countLine, 'Casos de prueba:'), coverage, toastCheck(toast, 'Informe generado', SELECTION_NAME)]);
};

// --- Esquema 4: el menú de una tarjeta y el detalle descargan el informe de un caso --------------------------------------------

const cardOrDetailReport: BrowserRowHandler = async (row, { page }) => {
  await resetTenants([TENANT_A]);
  const pantalla = strict('pantalla', SCREEN_CELLS, cell(row, 'pantalla'));
  const caso = strict('caso', CASE_CELLS, cell(row, 'caso'));
  const accion = strict('accion', ACTION_CELLS, cell(row, 'accion'));
  const countLine = 'Casos de prueba: 1 · Ejecutados: 1 · Sin ejecutar: 0';
  const expected = `se entrega el informe de ${caso} con el PDF «${countLine}» y aviso «Informe generado» con ${SELECTION_NAME}`;
  const signed = await signIn(page);
  if (signed !== undefined) return preparationFailedWeb(expected, signed);
  const opened = await openRoute(page, pantalla === 'list' ? '/verification' : `/verification/${caso}`, pantalla);
  if (opened !== undefined) return preparationFailedWeb(expected, opened);
  await armAll(page);
  const blocked = await accion(caso)(page);
  if (blocked !== undefined) return actionFailed(expected, blocked);
  const delivery = await firstDelivery(page);
  const toast = await toastShown(page, 'Informe generado');
  const lines = linesOfPdf(bytesOf(delivery));
  const pdfCodes = codesOfPdf(lines);
  const coverage: Check = check(sameSet(pdfCodes, [caso]), `el PDF cubre solo el caso ${caso}`, `el PDF cubre ${listed(pdfCodes)}`);
  return done([deliveredCheck(delivery), pdfLineCheck(lines, countLine, 'Casos de prueba:'), coverage, toastCheck(toast, 'Informe generado', SELECTION_NAME)]);
};

// --- Esquema 5: si la petición del informe falla, aparece el aviso de error y no se entrega nada ----------------------------

const failedDelivery: BrowserRowHandler = async (row, { page }) => {
  await resetTenants([TENANT_A]);
  const fallo = strict('fallo', FAILURE_CELLS, cell(row, 'fallo'));
  const detalle = strict('detalle', DETAIL_CELLS, cell(row, 'detalle'));
  const expected = `aviso «No se pudo generar el informe» con ${cell(row, 'detalle')}, y no se entrega ningún informe`;
  const signed = await signIn(page);
  if (signed !== undefined) return preparationFailedWeb(expected, signed);
  const listedAt = await openRoute(page, '/verification', 'list');
  if (listedAt !== undefined) return preparationFailedWeb(expected, listedAt);
  await failNextReport(page, fallo);
  await armAll(page);
  const pressed = await pressWhenEnabled(reportButton, 'pulsar «Descargar informe PDF»', page);
  if (pressed !== undefined) return actionFailed(expected, pressed);
  const toast = await toastShown(page, 'No se pudo generar el informe');
  await quietWindow();
  const body = toast.entry?.body;
  const detailCheck = detalle.kind === 'trace' ? traceCheck(body) : exactTextCheck(body, detalle.text);
  return done([check(toast.entry !== undefined, 'aviso «No se pudo generar el informe»', toast.observed), detailCheck, await notDelivered(page)], {
    reading: detalle.kind === 'trace' ? TRACE_READING : undefined,
    cause: detalle.kind === 'text' ? causeOf(body) : undefined,
  });
};

defineBrowserRows({
  story: 'US-VER-INFORME-006',
  surface: 'expo-web',
  tenants: [TENANT_A],
  handlers: new Map<number, BrowserRowHandler>([
    [1, onExpoWeb(listDownloads)],
    [2, onExpoWeb(emptyViewDisabled)],
    [3, onExpoWeb(selectionDelivers)],
    [4, onExpoWeb(cardOrDetailReport)],
    [5, onExpoWeb(failedDelivery)],
  ]),
});
