import type { Page } from '@playwright/test';
import { resetTenants, TENANT_A } from '../../../story-runs/support/prepare';
import { ACTION, isVisible, quoted, waitUntil } from '../../support/browser';
import { check, cell, preparationFailedWeb, strict, type Check } from '../../support/checks';
import { defineBrowserRows, type BrowserRowHandler } from '../../core/framework';
import { cuentaOf, DOCUMENTOS, intOf, thenOf } from '../api/common';
import {
  actionFailed,
  armToasts,
  chooseVersion,
  compareFrom,
  compareRegion,
  compareTo,
  diffStats,
  diffTable,
  finish,
  hiddenCheck,
  interact,
  normalizedText,
  onWeb,
  openDetail,
  openPublishDialog,
  readDiff,
  readHeaders,
  selectedOptionText,
  signIn,
  submitButton,
  toastShown,
  visibleOrUnknown,
  waitContentLoaded,
  waitDiffSettled,
  type Blocked,
  type DiffRead,
  type DiffSide,
} from './common';

// US-DOC-VERSIONES-007 — Comparar dos versiones en la ficha (web). Preparación de cada fila: reinicio de alumno01, inicio de sesión de
// gestor@sigpro.test y apertura de la ficha. Las filas del diff se localizan por su tipo y su número de línea (no por la posición de la
// pantalla); cada lado se lee por sus marcas: tachado (`del`) o resaltado (`ins`). Una elección nueva se da por válida solo cuando los
// dos selectores muestran lo elegido y la tabla deja de estar «ocupada».

/** Texto exacto de la opción de «Desde» o «Hasta» que cita la historia (`«Versión 2»`). */
const VERSION_DESDE_HASTA: ReadonlyMap<string, string> = new Map<string, string>([
  ['«Versión 1»', 'Versión 1'],
  ['«Versión 2»', 'Versión 2'],
  ['«Versión 3»', 'Versión 3'],
]);

/** Lo que dice la celda «aparece» del Esquema 2: tipo de cambio y texto tachado (columna «Desde») o resaltado (columna «Hasta»). */
interface Apariencia {
  readonly kind: 'changed' | 'added' | 'removed';
  readonly struck?: string;
  readonly marked?: string;
}

/** Celda «aparece» del Esquema 2. Los tres valores de la columna están aquí; uno que no esté LANZA. */
const APARECE: ReadonlyMap<string, Apariencia> = new Map<string, Apariencia>([
  [
    'tachada en la columna «Versión 1» con el texto «Se excluyen los equipos de apoyo en tierra.», y resaltada en la columna «Versión 2» con el texto «Se excluyen los equipos de apoyo en tierra y los simuladores.»',
    { kind: 'changed', struck: 'Se excluyen los equipos de apoyo en tierra.', marked: 'Se excluyen los equipos de apoyo en tierra y los simuladores.' },
  ],
  ['solo en la columna «Versión 2», resaltada, con el texto «El director técnico supervisa la ejecución.»', { kind: 'added', marked: 'El director técnico supervisa la ejecución.' }],
  ['solo en la columna «Versión 2», tachada, con el texto «Se excluyen los equipos de apoyo en tierra y los simuladores.»', { kind: 'removed', struck: 'Se excluyen los equipos de apoyo en tierra y los simuladores.' }],
]);

/** Acción previa del Esquema 3: elegir una versión en «Desde», o ninguna (la sección ya muestra su aviso). */
const ACCION: ReadonlyMap<string, ((page: Page) => Promise<Blocked | undefined>) | undefined> = new Map<string, ((page: Page) => Promise<Blocked | undefined>) | undefined>([
  ['elige «Versión 3» en «Desde»', chooseVersion('Desde', 'Versión 3')],
  ['mira la sección «Comparar versiones»', undefined],
]);

const sideText = (side: DiffSide): string => (side.line === '' ? '(ninguna)' : `línea ${side.line} «${side.text}»${side.struck ? ' (tachada)' : side.marked ? ' (resaltada)' : ''}`);

/** Un lado de la fila: con su texto tachado o resaltado, o sin línea si la historia dice «(ninguna)». */
const sideCheck = (label: string, side: DiffSide, expected: string | undefined, mark: 'struck' | 'marked'): Check => {
  if (expected === undefined) return check(side.line === '' && !side.struck && !side.marked, `${label} no hay línea`, `${label} ${sideText(side)}`);
  const ok = side[mark] && side.text === expected;
  return check(ok, `${label} ${mark === 'struck' ? 'tachada' : 'resaltada'} «${expected}»`, `${label} ${sideText(side)}`);
};

/** Cuerpo del aviso que muestra el diálogo tras publicar (`DOC-00X → versión N`). */
const publishedBody = (doc: string, version: number): string => `${doc} → versión ${version}`;

// --- Esquema 1: la comparación inicial es la versión anterior contra la última ---------------------------------------------------

const initialComparison: BrowserRowHandler = onWeb(async (row, { page }) => {
  const expected = thenOf(row);
  const doc = strict('documento', DOCUMENTOS, cell(row, 'documento'));
  const desde = quoted(cell(row, 'desde'));
  const hasta = quoted(cell(row, 'hasta'));
  const resumen = quoted(cell(row, 'resumen'));
  await resetTenants([TENANT_A]);
  const signed = await signIn(page, cuentaOf('gestor@sigpro.test'));
  if (signed !== undefined) return preparationFailedWeb(expected, signed);
  const opened = await openDetail(page, doc);
  if (opened !== undefined) return preparationFailedWeb(expected, opened);
  await waitDiffSettled(page, desde, hasta);
  const from = await selectedOptionText(compareFrom(page));
  const to = await selectedOptionText(compareTo(page));
  const stats = await normalizedText(diffStats(page));
  return finish([
    check(from === desde, `«Desde» muestra «${desde}»`, `«Desde» muestra «${from ?? '(sin leer)'}»`),
    check(to === hasta, `«Hasta» muestra «${hasta}»`, `«Hasta» muestra «${to ?? '(sin leer)'}»`),
    check(stats === resumen, `el resumen de la comparación es «${resumen}»`, `el resumen de la comparación es «${stats ?? '(sin leer)'}»`),
  ]);
});

// --- Esquema 2: cada tipo de cambio aparece en su columna -------------------------------------------------------------------------

const changeInItsColumn: BrowserRowHandler = onWeb(async (row, { page }) => {
  const expected = thenOf(row);
  const desde = strict('desde', VERSION_DESDE_HASTA, cell(row, 'desde'));
  const hasta = strict('hasta', VERSION_DESDE_HASTA, cell(row, 'hasta'));
  const linea = String(intOf(cell(row, 'linea')));
  const pista = strict('aparece', APARECE, cell(row, 'aparece'));
  await resetTenants([TENANT_A]);
  const signed = await signIn(page, cuentaOf('gestor@sigpro.test'));
  if (signed !== undefined) return preparationFailedWeb(expected, signed);
  const opened = await openDetail(page, 'DOC-001');
  if (opened !== undefined) return preparationFailedWeb(expected, opened);
  const pickedFrom = await chooseVersion('Desde', desde)(page);
  if (pickedFrom !== undefined) return actionFailed(expected, pickedFrom);
  const pickedTo = await chooseVersion('Hasta', hasta)(page);
  if (pickedTo !== undefined) return actionFailed(expected, pickedTo);
  await waitDiffSettled(page, desde, hasta);
  const rows: readonly DiffRead[] = (await readDiff(page)) ?? [];
  const headers = await readHeaders(page);
  // La fila de un cambio «añadido» se localiza por su línea nueva; las demás, por la antigua
  const found = rows.find((entry) => entry.kind === pista.kind && (pista.kind === 'added' ? entry.right.line === linea : entry.left.line === linea));
  const headersCheck = check(
    headers !== undefined && headers[0] === desde && headers[1] === hasta,
    `las cabeceras de la tabla son «${desde}» y «${hasta}»`,
    `las cabeceras de la tabla son ${headers === undefined ? '(sin leer)' : headers.map((header) => `«${header}»`).join(' y ')}`,
  );
  if (found === undefined) {
    return finish([headersCheck, check(false, `la línea ${linea} aparece como ${pista.kind}`, `no hay ninguna fila ${pista.kind} con la línea ${linea} (filas leídas: ${rows.length})`)]);
  }
  return finish([
    headersCheck,
    check(true, `la línea ${linea} aparece como ${pista.kind}`, `la línea ${linea} aparece como ${found.kind}`),
    sideCheck(`en la columna «${desde}»:`, found.left, pista.struck, 'struck'),
    sideCheck(`en la columna «${hasta}»:`, found.right, pista.marked, 'marked'),
  ]);
});

// --- Esquema 3: sin dos versiones distintas no hay tabla de diferencias -------------------------------------------------------------

const noDiffTable: BrowserRowHandler = onWeb(async (row, { page }) => {
  const expected = thenOf(row);
  const doc = strict('documento', DOCUMENTOS, cell(row, 'documento'));
  const action = strict('accion', ACCION, cell(row, 'accion'));
  const aviso = quoted(cell(row, 'aviso'));
  await resetTenants([TENANT_A]);
  const signed = await signIn(page, cuentaOf('gestor@sigpro.test'));
  if (signed !== undefined) return preparationFailedWeb(expected, signed);
  const opened = await openDetail(page, doc);
  if (opened !== undefined) return preparationFailedWeb(expected, opened);
  if (action !== undefined) {
    const acted = await action(page);
    if (acted !== undefined) return actionFailed(expected, acted);
  }
  const shown = await waitUntil(() => isVisible(compareRegion(page).getByText(aviso, { exact: true })));
  // La tabla deja de verse un render después del aviso: se espera a que no se vea antes de juzgar que no hay tabla
  await waitUntil(async () => (await visibleOrUnknown(diffTable(page))) === false);
  return finish([
    check(shown.reached, `la sección dice «${aviso}»`, shown.reached ? `la sección dice «${aviso}»` : `la sección no muestra «${aviso}»`),
    await hiddenCheck(diffTable(page), 'la tabla de diferencias'),
  ]);
});

// --- Esquema 4: tras publicar sin cambiar el contenido, la comparación pasa a la anterior contra la nueva -----------------------

const afterPublishUnchanged: BrowserRowHandler = onWeb(async (row, { page }) => {
  const expected = thenOf(row);
  const doc = strict('documento', DOCUMENTOS, cell(row, 'documento'));
  const version = intOf(cell(row, 'version_nueva'));
  const desde = quoted(cell(row, 'desde'));
  const hasta = quoted(cell(row, 'hasta'));
  const resumen = quoted(cell(row, 'resumen'));
  await resetTenants([TENANT_A]);
  const signed = await signIn(page, cuentaOf('gestor@sigpro.test'));
  if (signed !== undefined) return preparationFailedWeb(expected, signed);
  const opened = await openDetail(page, doc);
  if (opened !== undefined) return preparationFailedWeb(expected, opened);
  const dialog = await openPublishDialog(page, doc);
  if (dialog !== undefined) return actionFailed(expected, dialog);
  if (!(await waitContentLoaded(page))) return preparationFailedWeb(expected, 'el contenido de la última versión no llega al diálogo');
  const armedAt = await armToasts(page);
  if (armedAt === undefined) return preparationFailedWeb(expected, 'el registro de avisos no está instalado en la página');
  const submitted = await interact(submitButton(page), 'pulsar «Publicar versión» sin cambios', (element) => element.click(ACTION));
  if (submitted !== undefined) return actionFailed(expected, submitted);
  const toast = await toastShown(page, 'ok', 'Versión publicada', publishedBody(doc, version));
  if (!toast.seen) return preparationFailedWeb(expected, `no aparece el aviso de publicación: ${toast.observed}`);
  await waitDiffSettled(page, desde, hasta);
  const from = await selectedOptionText(compareFrom(page));
  const to = await selectedOptionText(compareTo(page));
  const stats = await normalizedText(diffStats(page));
  return finish([
    check(from === desde, `«Desde» muestra «${desde}»`, `«Desde» muestra «${from ?? '(sin leer)'}»`),
    check(to === hasta, `«Hasta» muestra «${hasta}»`, `«Hasta» muestra «${to ?? '(sin leer)'}»`),
    check(stats === resumen, `el resumen es «${resumen}»`, `el resumen es «${stats ?? '(sin leer)'}»`),
  ]);
});

defineBrowserRows({
  story: 'US-DOC-VERSIONES-007',
  surface: 'web',
  tenants: [TENANT_A],
  handlers: new Map<number, BrowserRowHandler>([
    [1, initialComparison],
    [2, changeInItsColumn],
    [3, noDiffTable],
    [4, afterPublishUnchanged],
  ]),
});
