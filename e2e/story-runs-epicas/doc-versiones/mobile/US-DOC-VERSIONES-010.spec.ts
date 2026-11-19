import type { Page } from '@playwright/test';
import { DOCUMENTOS_TESTIDS, MOVIL_DOCUMENTS_TESTIDS } from '../../../../packages/shared/src/testids';
import { resetTenants, TENANT_A } from '../../../story-runs/support/prepare';
import { isVisible, quoted, textOf, waitUntil } from '../../support/browser';
import { check, cell, preparationFailedWeb, strict, type Check } from '../../support/checks';
import { defineBrowserRows, type BrowserRowHandler } from '../../core/framework';
import { cuentaOf, DOCUMENTOS, thenOf } from '../api/common';
import { actionFailed, finish, normalizedText } from '../web/common';
import { cellCheck, comboValue, compareFrom, compareTo, detailTitle, diffBusy, diffStats, diffTable, gotoApp, onExpoWeb, pickVersion, readMobileDiff, signInAs, type MobileRow } from './common';

// US-DOC-VERSIONES-010 — Comparar dos versiones con las líneas apiladas (móvil, Expo web a 390 px). Preparación de cada fila: reinicio de
// alumno01, inicio de sesión de gestor@sigpro.test en la app y apertura de la ficha por una carga completa de la dirección. Las filas del
// diff se leen con su tipo (`data-diff`), su rótulo y sus celdas apiladas (número con signo, texto y tachado). La app NO es nativa.

/** Tipo de la celda «tipo»: su tipo de fila (`data-diff`) y su rótulo visible. */
const TIPO: ReadonlyMap<string, { readonly kind: string; readonly label: string }> = new Map<string, { readonly kind: string; readonly label: string }>([
  ['«Modificada»', { kind: 'changed', label: 'Modificada' }],
  ['«Añadida»', { kind: 'added', label: 'Añadida' }],
  ['«Eliminada»', { kind: 'removed', label: 'Eliminada' }],
]);

/** Una celda esperada de la fila apilada: su número con signo (− antigua, + nueva), su texto y si va tachada. */
interface Esperada {
  readonly gutter: string;
  readonly text: string;
  readonly struck: boolean;
}

/** Lo que dice la celda «lineas»: las celdas de la fila en orden, y si la nueva va debajo de la antigua. */
interface Lineas {
  readonly cells: readonly Esperada[];
  readonly stacked: boolean;
}

/** Signo menos de la historia y de la app (U+2212, no un guion). */
const MINUS = '−';

/** Celda «lineas» del Esquema 2: los tres valores de la columna. Otra forma LANZA. */
const LINEAS: ReadonlyMap<string, Lineas> = new Map<string, Lineas>([
  [
    `${MINUS}9 «Se excluyen los equipos de apoyo en tierra.» tachada, y debajo +9 «Se excluyen los equipos de apoyo en tierra y los simuladores.»`,
    {
      cells: [
        { gutter: `${MINUS}9`, text: 'Se excluyen los equipos de apoyo en tierra.', struck: true },
        { gutter: '+9', text: 'Se excluyen los equipos de apoyo en tierra y los simuladores.', struck: false },
      ],
      stacked: true,
    },
  ],
  ['solo +15 «El director técnico supervisa la ejecución.»', { cells: [{ gutter: '+15', text: 'El director técnico supervisa la ejecución.', struck: false }], stacked: false }],
  [
    `solo ${MINUS}9 «Se excluyen los equipos de apoyo en tierra y los simuladores.» tachada`,
    { cells: [{ gutter: `${MINUS}9`, text: 'Se excluyen los equipos de apoyo en tierra y los simuladores.', struck: true }], stacked: false },
  ],
]);

/** Versión elegida en «Desde» o «Hasta» (texto de la opción). */
const VERSION: ReadonlyMap<string, string> = new Map<string, string>([
  ['«Versión 1»', 'Versión 1'],
  ['«Versión 2»', 'Versión 2'],
  ['«Versión 3»', 'Versión 3'],
]);

/** Cuenta las peticiones GET de comparación que salen de la página desde ahora (una elección igual no debe pedir nada). */
const countCompares = (page: Page): (() => number) => {
  let requests = 0;
  page.on('request', (request) => {
    if (request.method() === 'GET' && new URL(request.url()).pathname.endsWith('/compare')) requests += 1;
  });
  return () => requests;
};

/** Prepara la ficha con gestor@sigpro.test en la app. Devuelve el fallo o `undefined`. */
const prepareDetail = async (page: Page, doc: string): Promise<string | undefined> => {
  await resetTenants([TENANT_A]);
  const signed = await signInAs(page, cuentaOf('gestor@sigpro.test'));
  if (signed !== undefined) return signed;
  const opened = await gotoApp(page, `/documents/${doc}`);
  if (opened !== undefined) return opened;
  const shown = await waitUntil(() => isVisible(detailTitle(page)));
  return shown.reached ? undefined : `no se ve la ficha de ${doc}`;
};

/** Espera a que los dos selectores muestren lo elegido y la tabla deje de estar «ocupada» (el resultado es el de la elección actual). */
const waitCompareSettled = async (page: Page, from: string, to: string): Promise<boolean> =>
  (
    await waitUntil(
      async () =>
        (await comboValue(compareFrom(page))) === from &&
        (await comboValue(compareTo(page))) === to &&
        (await diffBusy(page)) !== 'true' &&
        (await isVisible(diffTable(page))),
    )
  ).reached;

// --- Esquema 1: la comparación inicial es la versión anterior contra la última -------------------------------------------------------

const initialComparison: BrowserRowHandler = onExpoWeb(async (row, { page }) => {
  const expected = thenOf(row);
  const doc = strict('documento', DOCUMENTOS, cell(row, 'documento'));
  const desde = quoted(cell(row, 'desde'));
  const hasta = quoted(cell(row, 'hasta'));
  const resumen = quoted(cell(row, 'resumen'));
  const failure = await prepareDetail(page, doc);
  if (failure !== undefined) return preparationFailedWeb(expected, failure);
  const settled = await waitCompareSettled(page, desde, hasta);
  const from = await comboValue(compareFrom(page));
  const to = await comboValue(compareTo(page));
  const stats = await normalizedText(diffStats(page));
  return finish([
    check(from === desde, `«Desde» muestra «${desde}»`, `«Desde» muestra «${from ?? '(sin leer)'}»`),
    check(to === hasta, `«Hasta» muestra «${hasta}»`, `«Hasta» muestra «${to ?? '(sin leer)'}»`),
    check(settled && stats === resumen, `el resumen es «${resumen}»`, `el resumen es «${stats ?? '(sin leer)'}»`),
  ]);
});

// --- Esquema 2: cada cambio se lee en su fila, con la línea antigua encima de la nueva --------------------------------------------

const changeReadsInRow: BrowserRowHandler = onExpoWeb(async (row, { page }) => {
  const expected = thenOf(row);
  const desde = strict('desde', VERSION, cell(row, 'desde'));
  const hasta = strict('hasta', VERSION, cell(row, 'hasta'));
  const tipo = strict('tipo', TIPO, cell(row, 'tipo'));
  const lineas = strict('lineas', LINEAS, cell(row, 'lineas'));
  const failure = await prepareDetail(page, 'DOC-001');
  if (failure !== undefined) return preparationFailedWeb(expected, failure);
  const pickedFrom = await pickVersion('Desde', desde)(page);
  if (pickedFrom !== undefined) return actionFailed(expected, pickedFrom);
  const pickedTo = await pickVersion('Hasta', hasta)(page);
  if (pickedTo !== undefined) return actionFailed(expected, pickedTo);
  await waitCompareSettled(page, desde, hasta);
  const rows: readonly MobileRow[] = (await readMobileDiff(page)) ?? [];
  const found = rows.find((entry) => entry.kind === tipo.kind);
  if (found === undefined) {
    return finish([check(false, `hay una fila «${tipo.label}»`, `no hay ninguna fila «${tipo.label}» (filas leídas: ${rows.length})`)]);
  }
  const checks: Check[] = [check(found.label === tipo.label, `la fila es «${tipo.label}»`, `la fila es «${found.label}»`)];
  lineas.cells.forEach((expectedCell, index) => {
    checks.push(cellCheck(`la celda ${index + 1}`, found.cells[index], expectedCell.gutter, expectedCell.text, expectedCell.struck));
  });
  checks.push(check(found.cells.length === lineas.cells.length, `la fila tiene ${lineas.cells.length} línea(s)`, `la fila tiene ${found.cells.length} línea(s)`));
  if (lineas.stacked) {
    const first = found.cells[0];
    const second = found.cells[1];
    const below = first !== undefined && second !== undefined && second.top >= first.bottom - 1;
    checks.push(check(below, 'la línea nueva va debajo de la antigua', below ? 'la línea nueva va debajo de la antigua' : 'la línea nueva no va debajo de la antigua'));
  }
  return finish(checks, { evidence: { filasDelDiff: rows.length } });
});

// --- Esquema 3: sin dos versiones distintas no hay comparación -----------------------------------------------------------------------

/** Acción previa de la fila: «elige» (elegir Versión 3 en «Desde») o «mira» (no hacer nada). Todos los valores de la columna están aquí. */
const ACCION: ReadonlyMap<string, 'elige' | 'mira'> = new Map<string, 'elige' | 'mira'>([
  ['elige «Versión 3» en «Desde»', 'elige'],
  ['mira la sección «Comparar versiones»', 'mira'],
]);

const noComparison: BrowserRowHandler = onExpoWeb(async (row, { page }) => {
  const expected = thenOf(row);
  const doc = strict('documento', DOCUMENTOS, cell(row, 'documento'));
  const accion = strict('accion', ACCION, cell(row, 'accion'));
  const aviso = quoted(cell(row, 'aviso'));
  const failure = await prepareDetail(page, doc);
  if (failure !== undefined) return preparationFailedWeb(expected, failure);
  if (accion === 'elige') {
    // La comparación inicial (anterior contra última) debe haber asentado antes de contar: si no, su petición contaría como nueva
    await waitCompareSettled(page, 'Versión 2', 'Versión 3');
    const compares = countCompares(page);
    const picked = await pickVersion('Desde', 'Versión 3')(page);
    if (picked !== undefined) return actionFailed(expected, picked);
    const shown = await waitUntil(() => isVisible(page.getByTestId(MOVIL_DOCUMENTS_TESTIDS.COMPARE_SAME)));
    const text = await textOf(page.getByTestId(MOVIL_DOCUMENTS_TESTIDS.COMPARE_SAME));
    return finish([
      check(shown.reached && text === aviso, `la sección dice «${aviso}»`, `la sección dice «${text ?? '(sin leer)'}»`),
      check(compares() === 0, 'no pide ninguna comparación', `pide ${compares()} comparación(es)`),
    ]);
  }
  const shown = await waitUntil(() => isVisible(page.getByTestId(DOCUMENTOS_TESTIDS.DOCUMENT_COMPARE_ONE)));
  const text = await textOf(page.getByTestId(DOCUMENTOS_TESTIDS.DOCUMENT_COMPARE_ONE));
  return finish([check(shown.reached && text === aviso, `la sección dice «${aviso}»`, `la sección dice «${text ?? '(sin leer)'}»`)]);
});

defineBrowserRows({
  story: 'US-DOC-VERSIONES-010',
  surface: 'expo-web',
  tenants: [TENANT_A],
  handlers: new Map<number, BrowserRowHandler>([
    [1, initialComparison],
    [2, changeReadsInRow],
    [3, noComparison],
  ]),
});
