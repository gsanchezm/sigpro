import { TENANT_A, resetTenants } from '../../../story-runs/support/prepare';
import { ACTION, isVisible, waitUntil } from '../../support/browser';
import { defineBrowserRows, outcome, type BrowserFixtures, type BrowserRowHandler, type ManifestRow, type Outcome } from '../../core/framework';
import { cell, check, preparationFailedWeb, strict } from '../../support/checks';
import {
  apiPdfOf,
  armToasts,
  delayGet,
  noDownload,
  tryDownload,
  failAllGet,
  failFirstGet,
  interact,
  linesOf,
  sameBytes,
  shownCodes,
  normalizedText,
  thenOf,
  visibleOrUnknown,
  toastShown,
  type FailTally,
  type Blocked,
  finish,
  UNARMED,
} from '../web/common';
import {
  onExpoWeb,
  cardMenu,
  cardOf,
  detailTitleOf,
  emptyBlock,
  emptyClear,
  gotoApp,
  listError,
  listLoading,
  listRetry,
  listSettled,
  openDocumentsPath,
  recountOf,
  searchBox,
  sheetItem,
  sheetOf,
  signIn,
} from './common';

// US-DOC-LISTA-011 — Lista de documentos en tarjetas en la app móvil (Expo web, 390 px): tarjetas, buscador, menú ⋯ con ver y descargar,
// estados de carga, vacío y error. Preparación: reinicio de alumno01, inicio de sesión de gestor@sigpro.test y apertura de /documents.

type Page = BrowserFixtures['page'];

const CODIGO: ReadonlyMap<string, string> = new Map<string, string>([
  ['DOC-001', 'DOC-001'],
  ['DOC-002', 'DOC-002'],
  ['DOC-003', 'DOC-003'],
]);

const CLASIFICACION: ReadonlyMap<string, string> = new Map<string, string>([
  ['«Público»', 'Público'],
  ['«Restringido»', 'Restringido'],
]);

/** Programa de la tarjeta (código · nombre, con el separador « · » de la interfaz). */
const PROGRAMA: ReadonlyMap<string, string> = new Map<string, string>([
  ['PRG-001 · Sistema de mando táctico Ártemis', 'PRG-001 · Sistema de mando táctico Ártemis'],
  ['PRG-002 · Radar de vigilancia costera RVC-2', 'PRG-002 · Radar de vigilancia costera RVC-2'],
]);

/** Versión y fecha de la tarjeta («v3 · 05/02/2026»). */
const PIE: ReadonlyMap<string, string> = new Map<string, string>([
  ['v3 · 05/02/2026', 'v3 · 05/02/2026'],
  ['v2 · 29/01/2026', 'v2 · 29/01/2026'],
]);

const TEXTO: ReadonlyMap<string, string> = new Map<string, string>([
  ['plan', 'plan'],
  ['PRG-004', 'PRG-004'],
  ['Ártemis', 'Ártemis'],
  ['zzz-no-existe', 'zzz-no-existe'],
]);

/** Códigos de la celda de la segunda tabla: «ninguna» es la lista vacía (`codesOf` no conoce esa palabra). */
const CODIGOS_ESCRITOS: ReadonlyMap<string, readonly string[]> = new Map<string, readonly string[]>([
  ['DOC-001, DOC-003, DOC-005, DOC-007, DOC-009 y DOC-011', ['DOC-001', 'DOC-003', 'DOC-005', 'DOC-007', 'DOC-009', 'DOC-011']],
  ['DOC-007 y DOC-008', ['DOC-007', 'DOC-008']],
  ['ninguna', []],
]);

const RECUENTO: ReadonlyMap<string, string> = new Map<string, string>([
  ['«6 documentos»', '6 documentos'],
  ['«2 documentos»', '2 documentos'],
  ['«0 documentos»', '0 documentos'],
]);

const OPCION: ReadonlyMap<string, string> = new Map<string, string>([
  ['«Ver documento»', 'Ver documento'],
  ['«Descargar PDF»', 'Descargar PDF'],
]);

/** Resultado de la tercera tabla → lo que se comprueba. */
const TIPO_DE_RESULTADO: ReadonlyMap<string, string> = new Map<string, string>([
  ['llega a la ficha de DOC-002 y ve el título Especificación técnica PRG-001', 'ver'],
  ['ve el aviso «Descarga iniciada» con el nombre DOC-002-v1.pdf', 'descarga'],
]);

const ESPERA: ReadonlyMap<string, number> = new Map<string, number>([
  ['1 segundo', 1_000],
  ['3 segundos', 3_000],
]);

const TEXTO_SIN_COINCIDENCIAS: ReadonlyMap<string, string> = new Map<string, string>([
  ['zzz-no-existe', 'zzz-no-existe'],
  ['Ártemis', 'Ártemis'],
]);

const ESTADO: ReadonlyMap<string, number> = new Map<string, number>([
  ['500', 500],
  ['503', 503],
]);

/** Todos los documentos del tenant (12), en orden. */
const TODOS: readonly string[] = Array.from({ length: 12 }, (_, index) => `DOC-${String(index + 1).padStart(3, '0')}`);

const LISTA = '/api/documents';

/** Prepara la app: reinicio, inicio de sesión y /documents (con carga completa). */
const prepare = async (page: Page): Promise<string | undefined> => {
  await resetTenants([TENANT_A]);
  return (await signIn(page)) ?? (await openDocumentsPath(page));
};

/** Lectura de una tarjeta: sus líneas visibles (sin el botón ⋯). `undefined` si no se puede leer. */
const cardLines = async (page: Page, code: string): Promise<readonly string[] | undefined> => linesOf(cardOf(page, code));

const sameCodes = (actual: readonly string[] | undefined, expected: readonly string[]): boolean =>
  actual !== undefined && actual.length === expected.length && actual.every((code, index) => code === expected[index]);

/** Espera a que la lista muestre `codes` y el recuento `count` (si se da); devuelve lo que se ve. */
const settledList = async (page: Page, codes: readonly string[], count?: string) => {
  await waitUntil(async () => sameCodes(await shownCodes(page), codes) && (count === undefined || (await recountOf(page)) === count));
  return { codes: await shownCodes(page), count: await recountOf(page) };
};

/** Resultado de una acción de la app que falló, como fila con su diagnóstico. */
const failed = (expected: string, blocked: Blocked): Outcome => outcome(false, expected, blocked.message, { note: blocked.note, ...(blocked.evidence === undefined ? {} : { evidence: blocked.evidence }) });

// --- Esquema 1: cada tarjeta muestra el documento con su clasificación, su programa y su versión -------------------------------

const cardData: BrowserRowHandler = onExpoWeb(async (row: ManifestRow, { page }): Promise<Outcome> => {
  const expected = thenOf(row);
  const code = strict('código', CODIGO, cell(row, 'codigo'));
  const clase = strict('clasificación', CLASIFICACION, cell(row, 'clasificacion'));
  const programa = strict('programa', PROGRAMA, cell(row, 'programa'));
  const pie = strict('pie', PIE, cell(row, 'pie'));
  const failure = await prepare(page);
  if (failure !== undefined) return preparationFailedWeb(expected, failure);
  const seen = await waitUntil(() => isVisible(cardOf(page, code)));
  const lines = (await cardLines(page, code)) ?? [];
  return finish([
    check(seen.reached, `ve la tarjeta de ${code}`, seen.reached ? `ve la tarjeta de ${code}` : `no aparece la tarjeta de ${code}`),
    check(lines.includes(cell(row, 'titulo')), `el título ${cell(row, 'titulo')}`, `las líneas de la tarjeta son ${lines.join(' · ') || '(sin leer)'}`),
    check(lines.includes(programa), `el programa ${programa}`, `el programa no aparece entre «${lines.join(' · ') || '(sin leer)'}»`),
    check(lines.includes(clase), `la clasificación ${clase}`, `la clasificación no aparece entre «${lines.join(' · ') || '(sin leer)'}»`),
    check(lines.includes(pie), `el texto ${pie}`, `el texto no aparece entre «${lines.join(' · ') || '(sin leer)'}»`),
  ]);
});

// --- Esquema 2: el buscador deja las tarjetas de los documentos cuyo código o título contiene el texto --------------------------

const searchCards: BrowserRowHandler = onExpoWeb(async (row: ManifestRow, { page }): Promise<Outcome> => {
  const expected = thenOf(row);
  const texto = strict('texto', TEXTO, cell(row, 'texto'));
  const codes = strict('codigos', CODIGOS_ESCRITOS, cell(row, 'codigos'));
  const recuento = strict('recuento', RECUENTO, cell(row, 'recuento'));
  const failure = await prepare(page);
  if (failure !== undefined) return preparationFailedWeb(expected, failure);
  const typed = await interact(searchBox(page), `escribir «${texto}» en «Buscar documentos»`, (element) => element.fill(texto, ACTION));
  if (typed !== undefined) return failed(expected, typed);
  const shown = await settledList(page, codes, recuento);
  return finish([
    check(sameCodes(shown.codes, codes), `las tarjetas son ${codes.length === 0 ? 'ninguna' : codes.join(', ')}`, `las tarjetas son ${shown.codes?.join(', ') ?? '(sin leer)'}`),
    check(shown.count === recuento, `el recuento dice «${recuento}»`, `el recuento dice «${shown.count ?? '(sin leer)'}»`),
  ]);
});

// --- Esquema 3: el menú de la tarjeta ofrece ver el documento y descargar su última versión ------------------------------------

const cardMenuActions: BrowserRowHandler = onExpoWeb(async (row: ManifestRow, { page }): Promise<Outcome> => {
  const expected = thenOf(row);
  const code = strict('código', CODIGO, cell(row, 'codigo'));
  const option = strict('opción', OPCION, cell(row, 'opcion'));
  const kind = strict('resultado', TIPO_DE_RESULTADO, cell(row, 'resultado'));
  const failure = await prepare(page);
  if (failure !== undefined) return preparationFailedWeb(expected, failure);
  const opened = await interact(cardMenu(page, code), `abrir «Acciones para ${code}»`, (element) => element.click(ACTION));
  if (opened !== undefined) return failed(expected, opened);
  const sheet = await waitUntil(() => isVisible(sheetOf(page, code)));
  if (!sheet.reached) return outcome(false, expected, `no se abre la hoja «Acciones para ${code}»`, { note: 'el botón ⋯ existe y se pulsó, pero no se abrió la hoja de acciones' });
  if (kind === 'ver') {
    const pressed = await interact(sheetItem(page, code, option), `pulsar «${option}» en las acciones de ${code}`, (element) => element.click(ACTION));
    if (pressed !== undefined) return failed(expected, pressed);
    const detail = await waitUntil(async () => new URL(page.url()).pathname === `/documents/${code}`);
    const title = await waitUntil(async () => (await normalizedText(detailTitleOf(page))) === 'Especificación técnica PRG-001');
    const shownTitle = await normalizedText(detailTitleOf(page));
    return finish([
      check(detail.reached, `llega a la ficha de ${code}`, `llega a ${new URL(page.url()).pathname}`),
      check(title.reached, 've el título Especificación técnica PRG-001', `ve el título «${shownTitle ?? '(sin leer)'}»`),
    ]);
  }
  const armedAt = await armToasts(page);
  if (armedAt === undefined) return preparationFailedWeb(expected, UNARMED);
  const got = await tryDownload(page, async () => {
    const blocked = await interact(sheetItem(page, code, option), `pulsar «${option}» en las acciones de ${code}`, (element) => element.click(ACTION));
    if (blocked !== undefined) throw new Error(blocked.message);
  });
  if ('error' in got) return noDownload(expected, page, got.error);
  const download = got.download;
  const toast = await toastShown(page, 'info', 'Descarga iniciada', 'DOC-002-v1.pdf', armedAt);
  return finish([
    check(toast.seen, 've el aviso «Descarga iniciada» con el nombre DOC-002-v1.pdf', toast.seen ? 've el aviso «Descarga iniciada» con el nombre DOC-002-v1.pdf' : `no aparece el aviso: ${toast.observed}`),
    check(download.name === 'DOC-002-v1.pdf', 'el archivo se llama DOC-002-v1.pdf', `el archivo se llama ${download.name}`),
    sameBytes(download.bytes, await apiPdfOf(TENANT_A, 'DOC-002'), 'DOC-002 versión 1'),
  ]);
});

// --- Esquema 4: mientras llega la respuesta se ve el estado de carga y después las tarjetas --------------------------------------

const loadingThenCards: BrowserRowHandler = onExpoWeb(async (row: ManifestRow, { page }): Promise<Outcome> => {
  const expected = thenOf(row);
  const delay = strict('espera', ESPERA, cell(row, 'espera'));
  await resetTenants([TENANT_A]);
  const signed = await signIn(page);
  if (signed !== undefined) return preparationFailedWeb(expected, signed);
  await delayGet(page, LISTA, delay);
  const opened = await gotoApp(page, '/documents');
  if (opened !== undefined) return preparationFailedWeb(expected, opened);
  const loading = await waitUntil(() => isVisible(listLoading(page)));
  const settled = await listSettled(page);
  const shown = await settledList(page, TODOS, '12 documentos');
  return finish([
    check(loading.reached, 've el estado de carga mientras espera', loading.reached ? 've el estado de carga mientras espera' : 'no se ve el estado de carga mientras espera'),
    check(settled, 'la lista se asienta al llegar la respuesta', settled ? 'la lista se asienta al llegar la respuesta' : 'la lista no se asienta'),
    check(sameCodes(shown.codes, TODOS), 've los 12 documentos', `ve ${shown.codes?.length ?? '(sin leer)'} documentos`),
    check(shown.count === '12 documentos', 'el recuento «12 documentos»', `el recuento «${shown.count ?? '(sin leer)'}»`),
  ]);
});

// --- Esquema 5: un texto sin coincidencias muestra el bloque vacío con la opción de limpiar ------------------------------------

const emptyWithClear: BrowserRowHandler = onExpoWeb(async (row: ManifestRow, { page }): Promise<Outcome> => {
  const expected = thenOf(row);
  const texto = strict('texto', TEXTO_SIN_COINCIDENCIAS, cell(row, 'texto'));
  const failure = await prepare(page);
  if (failure !== undefined) return preparationFailedWeb(expected, failure);
  const typed = await interact(searchBox(page), `escribir «${texto}» en «Buscar documentos»`, (element) => element.fill(texto, ACTION));
  if (typed !== undefined) return failed(expected, typed);
  const shown = await waitUntil(() => isVisible(emptyBlock(page)));
  const lines = (await linesOf(emptyBlock(page))) ?? [];
  const cleared = await interact(emptyClear(page), 'pulsar «Limpiar filtros» del bloque vacío', (element) => element.click(ACTION));
  if (cleared !== undefined) return failed(expected, cleared);
  const after = await settledList(page, TODOS, '12 documentos');
  return finish([
    check(shown.reached && lines.includes('Sin documentos'), 'el título «Sin documentos»', `el bloque dice «${lines.join(' · ') || '(sin leer)'}»`),
    check(lines.includes('Ningún documento coincide con los filtros aplicados.'), 'el mensaje «Ningún documento coincide con los filtros aplicados.»', `el bloque dice «${lines.join(' · ') || '(sin leer)'}»`),
    check(lines.includes('Limpiar filtros'), 'el botón «Limpiar filtros»', `el bloque no tiene el botón «Limpiar filtros» (dice «${lines.join(' · ')}»)`),
    check(sameCodes(after.codes, TODOS), 'al pulsar «Limpiar filtros» ve los 12 documentos', `tras limpiar ve ${after.codes?.length ?? '(sin leer)'} documentos`),
  ]);
});

// --- Esquemas 6 y 7: un fallo de la petición muestra el aviso con «Reintentar» (y «Reintentar» pide la lista otra vez) ------------

const failedRequest: BrowserRowHandler = onExpoWeb(async (row: ManifestRow, { page }): Promise<Outcome> => {
  const expected = thenOf(row);
  const status = strict('estado', ESTADO, cell(row, 'estado'));
  await resetTenants([TENANT_A]);
  const signed = await signIn(page);
  if (signed !== undefined) return preparationFailedWeb(expected, signed);
  await failAllGet(page, LISTA, status);
  const opened = await gotoApp(page, '/documents');
  if (opened !== undefined) return preparationFailedWeb(expected, opened);
  const shown = await waitUntil(() => isVisible(listError(page)));
  const lines = (await linesOf(listError(page))) ?? [];
  const retry = await isVisible(listRetry(page));
  const codes = await shownCodes(page);
  return finish(
    [
      check(shown.reached && lines.includes('No se pudieron cargar los documentos'), 'el aviso «No se pudieron cargar los documentos»', `el aviso dice «${lines.join(' · ') || '(sin leer)'}»`),
      check(retry, 'el botón «Reintentar»', retry ? 'el botón «Reintentar»' : 'no se ve el botón «Reintentar»'),
      check(sameCodes(codes, []), 'ningún documento', `se ven ${codes?.length ?? '(sin leer)'} documentos`),
    ],
    { evidence: { trazaDelAviso: lines } },
  );
});

const retryRequest: BrowserRowHandler = onExpoWeb(async (row: ManifestRow, { page }): Promise<Outcome> => {
  const expected = thenOf(row);
  const status = strict('estado', ESTADO, cell(row, 'estado'));
  await resetTenants([TENANT_A]);
  const signed = await signIn(page);
  if (signed !== undefined) return preparationFailedWeb(expected, signed);
  const tally: FailTally = { failed: 0, passed: 0 };
  await failFirstGet(page, LISTA, status, tally);
  const opened = await gotoApp(page, '/documents');
  if (opened !== undefined) return preparationFailedWeb(expected, opened);
  const errorSeen = await waitUntil(() => isVisible(listError(page)));
  if (!errorSeen.reached) {
    return outcome(false, expected, `no aparece el aviso de error; peticiones GET de la lista: ${tally.failed} fallida(s), ${tally.passed} dejada(s) pasar`, {
      note: 'El aviso de error no aparece tras la primera petición fallida: ver la evidencia (conteo de peticiones).',
      evidence: { peticionesGetDeLaLista: { fallidas: tally.failed, dejadasPasar: tally.passed } },
    });
  }
  const retried = await interact(listRetry(page), 'pulsar «Reintentar»', (element) => element.click(ACTION));
  if (retried !== undefined) return failed(expected, retried);
  const shown = await settledList(page, TODOS, '12 documentos');
  const errorGone = await waitUntil(async () => (await visibleOrUnknown(listError(page))) === false);
  return finish(
    [
      check(sameCodes(shown.codes, TODOS), 've los 12 documentos', `ve ${shown.codes?.length ?? '(sin leer)'} documentos`),
      check(shown.count === '12 documentos', 'el recuento «12 documentos»', `el recuento «${shown.count ?? '(sin leer)'}»`),
      check(errorGone.reached, 'ya no ve el aviso de error', errorGone.reached ? 'ya no ve el aviso de error' : 'sigue viendo el aviso de error'),
    ],
    { evidence: { peticionesGetDeLaLista: { fallidas: tally.failed, dejadasPasar: tally.passed } } },
  );
});

defineBrowserRows({
  story: 'US-DOC-LISTA-011',
  surface: 'expo-web',
  tenants: [TENANT_A],
  handlers: new Map<number, BrowserRowHandler>([
    [1, cardData],
    [2, searchCards],
    [3, cardMenuActions],
    [4, loadingThenCards],
    [5, emptyWithClear],
    [6, failedRequest],
    [7, retryRequest],
  ]),
});
