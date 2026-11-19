import { TENANT_A, resetTenants } from '../../../story-runs/support/prepare';
import { DOCUMENTOS_TESTIDS } from '../../../../packages/shared/src/testids';
import { ACTION, attrOf, isVisible, safe, waitUntil } from '../../support/browser';
import { defineBrowserRows, type BrowserFixtures, type BrowserRowHandler, type ManifestRow, type Outcome } from '../../core/framework';
import { cell, check, preparationFailedWeb, strict } from '../../support/checks';
import {
  apiPdfOf,
  armToasts,
  chooseIn,
  detailBack,
  detailDownload,
  detailNotFound,
  detailOf,
  detailTitle,
  noDownload,
  tryDownload,
  gotoPath,
  hasTrace,
  historyList,
  historyRow,
  interact,
  linesOf,
  normalizedText,
  onWeb,
  openDetailFromList,
  openDocuments,
  openTabLink,
  sameBytes,
  selectedOptionText,
  signIn,
  thenOf,
  toastShown,
  versionSelect,
  type Blocked,
  finish,
  traceDependent,
  UNARMED,
} from './common';

// US-DOC-LISTA-009 — Ficha de un documento en la web: cabecera, selector de versiones, historial, visor de la versión elegida y
// descarga. Preparación: reinicio de alumno01, inicio de sesión de gestor@sigpro.test y entrada desde /documents (clic en el código).

type Page = BrowserFixtures['page'];

const CODIGO: ReadonlyMap<string, string> = new Map<string, string>([
  ['DOC-001', 'DOC-001'],
  ['DOC-002', 'DOC-002'],
  ['DOC-003', 'DOC-003'],
]);

const PROGRAMA: ReadonlyMap<string, string> = new Map<string, string>([
  ['PRG-001', 'PRG-001'],
  ['PRG-002', 'PRG-002'],
]);

/** Etiqueta de clasificación de la celda (con sus comillas de texto de la interfaz). */
const CLASIFICACION: ReadonlyMap<string, string> = new Map<string, string>([
  ['«Público»', 'Público'],
  ['«Restringido»', 'Restringido'],
]);

const VERSION: ReadonlyMap<string, number> = new Map<string, number>([
  ['3', 3],
  ['1', 1],
  ['2', 2],
]);

const FILAS: ReadonlyMap<string, number> = new Map<string, number>([
  ['3', 3],
  ['1', 1],
  ['2', 2],
]);

/** Versión elegida en el selector: el texto exacto de la opción en la interfaz (la última lleva «(última)»). */
const OPCION_DE_VERSION: ReadonlyMap<string, { readonly label: string; readonly version: number }> = new Map([
  ['2', { label: 'Versión 2', version: 2 }],
  ['1', { label: 'Versión 1', version: 1 }],
]);

/** Versión elegida en la descarga: la última del seed (3) se elige como «Versión 3 (última)». */
const OPCION_DE_DESCARGA: ReadonlyMap<string, { readonly label: string; readonly version: number }> = new Map([
  ['3', { label: 'Versión 3 (última)', version: 3 }],
  ['2', { label: 'Versión 2', version: 2 }],
]);

const VERSION_EN_HISTORIAL: ReadonlyMap<string, number> = new Map<string, number>([
  ['3', 3],
  ['2', 2],
  ['1', 1],
]);

const DIRECCION: ReadonlyMap<string, string> = new Map<string, string>([
  ['/documents/DOC-001/view?version=2', '/documents/DOC-001/view?version=2'],
  ['/documents/DOC-001/view?version=1', '/documents/DOC-001/view?version=1'],
]);

const DOCUMENTO_NO_EXISTE: ReadonlyMap<string, string> = new Map<string, string>([
  ['DOC-013', '/documents/DOC-013'],
  ['doc-001', '/documents/doc-001'],
]);

/** Visor embebido de la ficha: el iframe de la misma aplicación. */
const embeddedVersion = (page: Page) => page.frameLocator(`iframe[data-testid="${DOCUMENTOS_TESTIDS.DOCUMENT_VIEWER}"]`).getByTestId(DOCUMENTOS_TESTIDS.VIEWER_VERSION);

/** Prepara la ficha: reinicio, inicio de sesión, /documents y clic en el código del documento. */
const openFicha = async (page: Page, code: string): Promise<string | undefined> => {
  await resetTenants([TENANT_A]);
  const failure = (await signIn(page, 'escritorio')) ?? (await openDocuments(page));
  if (failure !== undefined) return failure;
  const opened = await openDetailFromList(page, code);
  return opened === undefined ? undefined : opened.message;
};

const failed = (expected: string, blocked: Blocked): Outcome => ({
  verdict: 'discrepa',
  expected,
  observed: blocked.message,
  note: blocked.note,
  ...(blocked.evidence === undefined ? {} : { evidence: blocked.evidence }),
});

// --- Esquema 1: la ficha muestra el documento y su última versión, elegida por defecto -----------------------------------------------

const detailHeader: BrowserRowHandler = onWeb(async (row: ManifestRow, { page }): Promise<Outcome> => {
  const expected = thenOf(row);
  const code = strict('código', CODIGO, cell(row, 'codigo'));
  const programa = strict('programa', PROGRAMA, cell(row, 'programa'));
  const clase = strict('clasificación', CLASIFICACION, cell(row, 'clasificacion'));
  const version = strict('versión', VERSION, cell(row, 'version'));
  const filas = strict('filas', FILAS, cell(row, 'filas'));
  const failure = await openFicha(page, code);
  if (failure !== undefined) return preparationFailedWeb(expected, failure);
  const title = await waitUntil(async () => (await normalizedText(detailTitle(page))) === cell(row, 'titulo'));
  const program = await normalizedText(page.getByTestId(DOCUMENTOS_TESTIDS.DOCUMENT_PROGRAM_LINK));
  const badge = await normalizedText(detailOf(page).getByTestId(DOCUMENTOS_TESTIDS.DOCUMENT_CLASS_BADGE));
  const selected = await safe(() => versionSelect(page).inputValue({ timeout: 500 }), undefined);
  const selectedLabel = await selectedOptionText(versionSelect(page));
  const rows = await safe(() => historyList(page).locator('li').count(), -1);
  return finish([
    check(title.reached, `el título ${cell(row, 'titulo')}`, `el título ${(await normalizedText(detailTitle(page))) ?? '(sin leer)'}`),
    check(program === programa, `el programa ${programa}`, `el programa ${program ?? '(sin leer)'}`),
    check(badge === clase, `la clasificación ${clase}`, `la clasificación ${badge ?? '(sin leer)'}`),
    check(selected === String(version) && selectedLabel === `Versión ${version} (última)`, `el selector «Versión» con «Versión ${version} (última)» elegida`, `el selector «Versión» muestra «${selectedLabel ?? '(sin leer)'}» (valor ${selected ?? '(sin leer)'})`),
    check(rows === filas, `el historial tiene ${filas} filas`, `el historial tiene ${rows < 0 ? '(sin leer)' : rows} filas`),
  ]);
});

// --- Esquema 2: cada fila del historial dice la versión, su nota, su autor y su fecha ----------------------------------------------

const historyRowText: BrowserRowHandler = onWeb(async (row: ManifestRow, { page }): Promise<Outcome> => {
  const expected = thenOf(row);
  const version = strict('versión', VERSION_EN_HISTORIAL, cell(row, 'version'));
  const failure = await openFicha(page, 'DOC-001');
  if (failure !== undefined) return preparationFailedWeb(expected, failure);
  const seen = await waitUntil(() => isVisible(historyRow(page, version)));
  // Las tres columnas son los `span` hijos directos de la fila (versión, nota y autor con fecha): se leen por posición y se comprueba su número.
  const columns = historyRow(page, version).locator(':scope > span');
  const columnCount = await safe(() => columns.count(), -1);
  const spans = await safe(() => columns.allInnerTexts(), undefined);
  const parts = (spans ?? []).map((text) => text.replace(/\s+/g, ' ').trim());
  return finish([
    check(seen.reached, `ve la fila de la versión ${version} del historial`, seen.reached ? `ve la fila de la versión ${version} del historial` : `no aparece la fila de la versión ${version}`),
    check(columnCount === 3, 'la fila tiene tres columnas (versión, nota y autor con fecha)', `la fila tiene ${columnCount < 0 ? '(sin leer)' : columnCount} columnas`),
    check(parts[0] === `v${version}`, `ve v${version}`, `ve «${parts[0] ?? '(sin leer)'}»`),
    check(parts[1] === cell(row, 'nota'), `la nota ${cell(row, 'nota')}`, `la nota «${parts[1] ?? '(sin leer)'}»`),
    check(parts[2] === `por Javier Ortega · ${cell(row, 'fecha')}`, `el texto «por Javier Ortega · ${cell(row, 'fecha')}»`, `el texto «${parts[2] ?? '(sin leer)'}»`),
  ]);
});

// --- Esquema 3: elegir una versión cambia el visor y el enlace de la nueva pestaña ---------------------------------------------------

const chooseVersion: BrowserRowHandler = onWeb(async (row: ManifestRow, { page }): Promise<Outcome> => {
  const expected = thenOf(row);
  const option = strict('versión', OPCION_DE_VERSION, cell(row, 'version'));
  const direccion = strict('dirección', DIRECCION, cell(row, 'direccion'));
  const failure = await openFicha(page, 'DOC-001');
  if (failure !== undefined) return preparationFailedWeb(expected, failure);
  const chosen = await chooseIn(versionSelect, option.label, 'Versión')(page);
  if (chosen !== undefined) return failed(expected, chosen);
  const viewer = await waitUntil(async () => (await normalizedText(embeddedVersion(page))) === option.label);
  const viewerNow = await normalizedText(embeddedVersion(page));
  const href = await attrOf(openTabLink(page), 'href');
  return finish([
    check(viewer.reached, `el visor de la ficha muestra la versión ${option.version} del documento`, `el visor de la ficha muestra «${viewerNow ?? '(sin leer)'}»`),
    check(href === direccion, `el enlace «Abrir en nueva pestaña» lleva a ${direccion}`, `el enlace «Abrir en nueva pestaña» lleva a ${href ?? '(sin leer)'}`),
  ]);
});

// --- Esquema 4: «Descargar PDF» baja la versión elegida con su nombre ----------------------------------------------------------------

const downloadVersion: BrowserRowHandler = onWeb(async (row: ManifestRow, { page }): Promise<Outcome> => {
  const expected = thenOf(row);
  const option = strict('versión', OPCION_DE_DESCARGA, cell(row, 'version'));
  const archivo = cell(row, 'archivo');
  const failure = await openFicha(page, 'DOC-001');
  if (failure !== undefined) return preparationFailedWeb(expected, failure);
  const chosen = await chooseIn(versionSelect, option.label, 'Versión')(page);
  if (chosen !== undefined) return failed(expected, chosen);
  const armedAt = await armToasts(page);
  if (armedAt === undefined) return preparationFailedWeb(expected, UNARMED);
  const got = await tryDownload(page, async () => {
    const blocked = await interact(detailDownload(page), 'pulsar «Descargar PDF»', (element) => element.click(ACTION));
    if (blocked !== undefined) throw new Error(blocked.message);
  });
  if ('error' in got) return noDownload(expected, page, got.error);
  const download = got.download;
  const toast = await toastShown(page, undefined, 'Descarga iniciada', archivo, armedAt);
  return finish([
    check(toast.seen, `ve el aviso «Descarga iniciada» con el nombre ${archivo}`, toast.seen ? `ve el aviso «Descarga iniciada» con el nombre ${archivo}` : `no aparece el aviso: ${toast.observed}`),
    check(download.name === archivo, `el archivo descargado se llama ${archivo}`, `el archivo descargado se llama ${download.name}`),
    sameBytes(download.bytes, await apiPdfOf(TENANT_A, 'DOC-001', option.version), `DOC-001 versión ${option.version}`),
  ], { evidence: { tonoDelAvisoRegistrado: toast.observed } });
});

// --- Esquema 5: un código que no existe muestra el aviso de documento no encontrado --------------------------------------------------

const notFoundDetail: BrowserRowHandler = onWeb(async (row: ManifestRow, { page }): Promise<Outcome> => {
  const expected = thenOf(row);
  const path = strict('código', DOCUMENTO_NO_EXISTE, cell(row, 'codigo'));
  await resetTenants([TENANT_A]);
  const failure = (await signIn(page, 'escritorio')) ?? (await openDocuments(page));
  if (failure !== undefined) return preparationFailedWeb(expected, failure);
  const opened = await gotoPath(page, path);
  if (opened !== undefined) return preparationFailedWeb(expected, opened);
  const shown = await waitUntil(() => isVisible(detailNotFound(page)));
  const lines = (await linesOf(detailNotFound(page))) ?? [];
  const back = await normalizedText(detailBack(page));
  const trace = lines.join(' · ');
  // La traza de la petición es una decisión pendiente de la historia: si el resto de pasos se cumple, la fila queda pendiente.
  return traceDependent(
    expected,
    [
      check(shown.reached, 've el aviso «No se encontró el documento»', shown.reached ? 've el aviso «No se encontró el documento»' : 'no aparece el aviso de no encontrado'),
      check(lines.includes('No se encontró el documento'), 'el título «No se encontró el documento»', `el aviso dice: ${trace || '(sin leer)'}`),
      check(back === 'Volver a Documentos', 'el enlace «Volver a Documentos»', `el enlace dice «${back ?? '(sin leer)'}»`),
    ],
    hasTrace(trace === '' ? undefined : trace, 404),
    { ruta: path, trazaDelAviso: trace },
  );
});


defineBrowserRows({
  story: 'US-DOC-LISTA-009',
  surface: 'web',
  tenants: [TENANT_A],
  handlers: new Map<number, BrowserRowHandler>([
    [1, detailHeader],
    [2, historyRowText],
    [3, chooseVersion],
    [4, downloadVersion],
    [5, notFoundDetail],
  ]),
});
