import { TENANT_A, resetTenants } from '../../../story-runs/support/prepare';
import { ACTION, isVisible, safe, waitUntil } from '../../support/browser';
import { defineBrowserRows, type BrowserFixtures, type BrowserRowHandler, type ManifestRow, type Outcome } from '../../core/framework';
import { cell, check, preparationFailedWeb, strict } from '../../support/checks';
import {
  LAYOUTS,
  countCheck,
  countText,
  busyOf,
  emptyBlock,
  emptyClear,
  failAllGet,
  failFirstGet,
  gotoPath,
  interact,
  linesOf,
  listCheck,
  listError,
  listRetry,
  listSettled,
  onWeb,
  openDocuments,
  searchBox,
  shownCodes,
  signIn,
  skeletonRows,
  thenOf,
  visibleOrUnknown,
  waitForList,
  delayGet,
  type FailTally,
  type Layout,
  finish,
} from './common';
import { DOCUMENTOS_TESTIDS } from '../../../../packages/shared/src/testids';

// US-DOC-LISTA-008 — Estados de carga, vacío y error de la lista de documentos en la web. Preparación: reinicio de alumno01 e inicio
// de sesión de gestor@sigpro.test; las demoras y los errores los provoca la prueba en ese navegador antes de abrir /documents.

type Page = BrowserFixtures['page'];

/** Retraso de la respuesta de GET /api/documents (dato de la historia, fijado por la prueba). */
const ESPERA: ReadonlyMap<string, number> = new Map<string, number>([
  ['1 segundo', 1_000],
  ['3 segundos', 3_000],
]);

/** Todos los documentos del tenant (12), en orden. */
const TODOS: readonly string[] = Array.from({ length: 12 }, (_, index) => `DOC-${String(index + 1).padStart(3, '0')}`);

/** Ruta de la lista de documentos (la de la API, sin cadena de consulta: los filtros no cambian la ruta). */
const LISTA = '/api/documents';

/** Elemento ocupado de la lista (el primer `aria-busy` de la página de documentos: la tabla o las tarjetas). */
const busyTarget = (page: Page) => page.getByTestId(DOCUMENTOS_TESTIDS.DOCUMENTS_PAGE).locator('[aria-busy]').first();

/** Prepara la sesión de gestor@sigpro.test con el diseño dado (sin abrir /documents todavía). */
const loggedIn = async (page: Page, layout: Layout): Promise<string | undefined> => {
  await resetTenants([TENANT_A]);
  return signIn(page, layout);
};

/** Fila con un fallo de acción: el mismo formato que las demás filas (no cumple, con su diagnóstico). */
const outcomeOf = (expected: string, observed: string, note: string): Outcome => ({ verdict: 'discrepa', expected, observed, note });

/** Líneas del aviso de error (título y traza), para comprobar el título y para la evidencia. */
const errorLines = async (page: Page): Promise<readonly string[] | undefined> => linesOf(listError(page));

// --- Esquema 1: mientras llega la respuesta se ven filas de carga y después los documentos --------------------------------------

const loadingThenRows: BrowserRowHandler = onWeb(async (row: ManifestRow, { page }): Promise<Outcome> => {
  const expected = thenOf(row);
  const delay = strict('espera', ESPERA, cell(row, 'espera'));
  const layout = strict('diseño', LAYOUTS, cell(row, 'diseno'));
  const failure = await loggedIn(page, layout);
  if (failure !== undefined) return preparationFailedWeb(expected, failure);
  await delayGet(page, LISTA, delay);
  const opened = await gotoPath(page, '/documents');
  if (opened !== undefined) return preparationFailedWeb(expected, opened);
  const skeleton = await waitUntil(async () => (await safe(() => skeletonRows(page).count(), 0)) > 0);
  const busy = await busyOf(busyTarget(page));
  const settled = await listSettled(page);
  const codes = await shownCodes(page);
  const count = await countText(page);
  return finish([
    check(skeleton.reached, 've filas de carga mientras espera', skeleton.reached ? 've filas de carga mientras espera' : 'no se ven filas de carga mientras espera'),
    check(busy === 'true', 'la lista marcada como ocupada mientras espera', `la lista aria-busy=${busy ?? '(sin leer)'} mientras espera`),
    check(settled, 'la lista se asienta al llegar la respuesta', settled ? 'la lista se asienta al llegar la respuesta' : 'la lista no se asienta'),
    listCheck(codes, TODOS),
    countCheck(count, '12 documentos'),
  ]);
});

// --- Esquema 2: un filtro sin coincidencias muestra el bloque vacío con la opción de limpiar ----------------------------------

const emptyFiltered: BrowserRowHandler = onWeb(async (row: ManifestRow, { page }): Promise<Outcome> => {
  const expected = thenOf(row);
  const layout = strict('diseño', LAYOUTS, cell(row, 'diseno'));
  const failure = (await loggedIn(page, layout)) ?? (await openDocuments(page));
  if (failure !== undefined) return preparationFailedWeb(expected, failure);
  const typed = await interact(searchBox(page), 'escribir «zzz-no-existe» en «Buscar documentos»', (element) => element.fill('zzz-no-existe', ACTION));
  if (typed !== undefined) return outcomeOf(expected, typed.message, typed.note);
  const shown = await waitUntil(() => isVisible(emptyBlock(page)));
  const lines = await linesOf(emptyBlock(page));
  const clearVisible = await isVisible(emptyClear(page));
  const codes = await shownCodes(page);
  return finish([
    check(shown.reached, 've el bloque «Sin documentos»', shown.reached ? 've el bloque «Sin documentos»' : 'no aparece el bloque «Sin documentos»'),
    check(lines?.includes('Sin documentos') === true, 'el título «Sin documentos»', `las líneas del bloque: ${lines?.join(' · ') ?? '(sin leer)'}`),
    check(lines?.includes('Ningún documento coincide con los filtros aplicados.') === true, 'el mensaje «Ningún documento coincide con los filtros aplicados.»', `las líneas del bloque: ${lines?.join(' · ') ?? '(sin leer)'}`),
    check(clearVisible, 'el botón «Limpiar filtros» dentro del bloque', clearVisible ? 'el botón «Limpiar filtros» dentro del bloque' : 'no se ve el botón «Limpiar filtros» dentro del bloque'),
    listCheck(codes, []),
  ]);
});

// --- Esquema 3: un fallo de la petición muestra el aviso de error con «Reintentar» y ningún documento -------------------------

const failedRequest: BrowserRowHandler = onWeb(async (row: ManifestRow, { page }): Promise<Outcome> => {
  const expected = thenOf(row);
  const layout = strict('diseño', LAYOUTS, cell(row, 'diseno'));
  const failure = await loggedIn(page, layout);
  if (failure !== undefined) return preparationFailedWeb(expected, failure);
  await failAllGet(page, LISTA, 500);
  const opened = await gotoPath(page, '/documents');
  if (opened !== undefined) return preparationFailedWeb(expected, opened);
  const shown = await waitUntil(() => isVisible(listError(page)));
  const lines = await errorLines(page);
  const retry = await isVisible(listRetry(page));
  const codes = await shownCodes(page);
  return finish(
    [
      check(shown.reached, 've el aviso de error', shown.reached ? 've el aviso de error' : 'no aparece el aviso de error'),
      check(lines?.includes('No se pudieron cargar los documentos') === true, 'el aviso «No se pudieron cargar los documentos»', `el aviso dice: ${lines?.join(' · ') ?? '(sin leer)'}`),
      check(retry, 'el botón «Reintentar»', retry ? 'el botón «Reintentar»' : 'no se ve el botón «Reintentar»'),
      listCheck(codes, []),
    ],
    { evidence: { trazaDelAviso: lines ?? null } },
  );
});

// --- Esquema 4: «Reintentar» pide la lista otra vez y la muestra cuando la respuesta llega bien ----------------------------------

const retryRequest: BrowserRowHandler = onWeb(async (row: ManifestRow, { page }): Promise<Outcome> => {
  const expected = thenOf(row);
  const layout = strict('diseño', LAYOUTS, cell(row, 'diseno'));
  const failure = await loggedIn(page, layout);
  if (failure !== undefined) return preparationFailedWeb(expected, failure);
  const tally: FailTally = { failed: 0, passed: 0 };
  await failFirstGet(page, LISTA, 500, tally);
  const opened = await gotoPath(page, '/documents');
  if (opened !== undefined) return preparationFailedWeb(expected, opened);
  const errorSeen = await waitUntil(() => isVisible(listError(page)));
  if (!errorSeen.reached) {
    return outcomeOf(expected, `no aparece el aviso de error; peticiones GET de la lista: ${tally.failed} fallida(s), ${tally.passed} dejada(s) pasar`, 'El aviso de error no aparece tras la primera petición fallida: ver la nota y la evidencia (conteo de peticiones).');
  }
  const retried = await interact(listRetry(page), 'pulsar «Reintentar»', (element) => element.click(ACTION));
  if (retried !== undefined) return outcomeOf(expected, retried.message, retried.note);
  const shown = await waitForList(page, TODOS, '12 documentos');
  const errorGone = await waitUntil(async () => (await visibleOrUnknown(listError(page))) === false);
  return finish(
    [listCheck(shown.codes, TODOS), countCheck(shown.count, '12 documentos'), check(errorGone.reached, 'ya no ve el aviso de error', errorGone.reached ? 'ya no ve el aviso de error' : 'sigue viendo el aviso de error')],
    { evidence: { peticionesGetDeLaLista: { fallidas: tally.failed, dejadasPasar: tally.passed } } },
  );
});

defineBrowserRows({
  story: 'US-DOC-LISTA-008',
  surface: 'web',
  tenants: [TENANT_A],
  handlers: new Map<number, BrowserRowHandler>([
    [1, loadingThenRows],
    [2, emptyFiltered],
    [3, failedRequest],
    [4, retryRequest],
  ]),
});
