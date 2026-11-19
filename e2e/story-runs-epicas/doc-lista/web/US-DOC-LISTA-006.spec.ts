import type { BrowserContext } from '@playwright/test';
import { TENANT_A, resetTenants } from '../../../story-runs/support/prepare';
import { ACTION, attrOf, isVisible, waitUntil } from '../../support/browser';
import { defineBrowserRows, outcome, type BrowserFixtures, type BrowserRowHandler, type ManifestRow, type Outcome } from '../../core/framework';
import { cell, check, preparationFailedWeb, strict, type Check } from '../../support/checks';
import {
  LAYOUTS,
  apiPdfOf,
  armToasts,
  countText,
  detailTitle,
  linkOf,
  listCheck,
  noDownload,
  tryDownload,
  interact,
  menuItem,
  newTabFrom,
  normalizedText,
  onWeb,
  openDocuments,
  openRowMenu,
  pressMenuItem,
  rowCells,
  rowOf,
  sameBytes,
  shownCodes,
  signIn,
  subtitleText,
  thenOf,
  toastShown,
  viewerTitle,
  viewerVersion,
  type Blocked,
  type Layout,
  finish,
  UNARMED,
} from './common';

// US-DOC-LISTA-006 — Tabla de documentos en la web y menú de acciones de cada fila. Preparación: reinicio de alumno01, inicio de
// sesión de gestor@sigpro.test y apertura de /documents con el diseño de la fila. El recuento que va «encima de la lista» se juzga en
// el texto de encima de la tabla; el de debajo de la tabla se anota como evidencia.

const CODIGO: ReadonlyMap<string, string> = new Map<string, string>([
  ['DOC-001', 'DOC-001'],
  ['DOC-002', 'DOC-002'],
  ['DOC-003', 'DOC-003'],
]);

/** Clasificación de la celda (con sus comillas de texto de la interfaz) → etiqueta visible de la tabla. */
const CLASIFICACION: ReadonlyMap<string, string> = new Map<string, string>([
  ['«Público»', 'Público'],
  ['«Restringido»', 'Restringido'],
]);

/** Opción del menú de la celda → nombre de la opción en la interfaz. */
const OPCION: ReadonlyMap<string, string> = new Map<string, string>([
  ['«Ver documento»', 'Ver documento'],
  ['«Abrir en nueva pestaña»', 'Abrir en nueva pestaña'],
  ['«Descargar PDF»', 'Descargar PDF'],
]);

/** Resultado de la tercera tabla → acción que lo comprueba (el texto de la celda identifica la fila). */
const TIPO_DE_RESULTADO: ReadonlyMap<string, string> = new Map<string, string>([
  ['llega a /documents/DOC-001 y ve el título Plan de verificación PRG-001', 'ver'],
  ['se abre una pestaña nueva con /documents/DOC-001/view y ve la versión 3 del documento', 'pestana'],
  ['ve el aviso «Descarga iniciada» con el nombre DOC-002-v1.pdf y el archivo descargado se llama DOC-002-v1.pdf', 'descarga'],
]);

type Page = BrowserFixtures['page'];

/** Prepara la pantalla: reinicio, inicio de sesión y /documents con el diseño dado. Devuelve el fallo o `undefined`. */
const prepare = async (page: Page, layout: Layout): Promise<string | undefined> => {
  await resetTenants([TENANT_A]);
  return (await signIn(page, layout)) ?? (await openDocuments(page));
};

/** Resultado de una acción de la lista que falló, como fila con su diagnóstico. */
const failedAction = (expected: string, blocked: Blocked): Outcome =>
  outcome(false, expected, blocked.message, { note: blocked.note, ...(blocked.evidence === undefined ? {} : { evidence: blocked.evidence }) });

// --- Esquema 1: cada fila de la tabla muestra los datos del documento ------------------------------------------------------------

const rowData: BrowserRowHandler = onWeb(async (row: ManifestRow, { page }) => {
  const expected = thenOf(row);
  const code = strict('código', CODIGO, cell(row, 'codigo'));
  const clase = strict('clasificación', CLASIFICACION, cell(row, 'clasificacion'));
  const failure = await prepare(page, 'escritorio');
  if (failure !== undefined) return preparationFailedWeb(expected, failure);
  const seen = await waitUntil(() => isVisible(rowOf(page, code)));
  const cells = await rowCells(page, code);
  const href = await attrOf(linkOf(page, code), 'href');
  const checks: Check[] = [
    check(seen.reached, `ve la fila de ${code}`, seen.reached ? `ve la fila de ${code}` : `no aparece la fila de ${code}`),
    check(cells?.[1] === cell(row, 'titulo'), `el título ${cell(row, 'titulo')}`, `el título ${cells?.[1] ?? '(sin leer)'}`),
    check(cells?.[2] === cell(row, 'programa'), `el programa ${cell(row, 'programa')}`, `el programa ${cells?.[2] ?? '(sin leer)'}`),
    check(cells?.[3] === clase, `la clasificación ${clase}`, `la clasificación ${cells?.[3] ?? '(sin leer)'}`),
    check(cells?.[4] === cell(row, 'version'), `la versión ${cell(row, 'version')}`, `la versión ${cells?.[4] ?? '(sin leer)'}`),
    check(cells?.[5] === cell(row, 'fecha'), `la fecha ${cell(row, 'fecha')}`, `la fecha ${cells?.[5] ?? '(sin leer)'}`),
    check(href === `/documents/${code}`, `el código es un enlace a /documents/${code}`, `el código enlaza a «${href ?? '(sin leer)'}»`),
  ];
  return finish(checks, { evidence: { celdas: cells ?? null } });
});

// --- Esquema 2: la lista sale en orden de código y con el recuento de documentos en cualquier diseño -------------------------

/** Los doce documentos del tenant, en orden de código (la historia los cita como DOC-001 a DOC-012). */
const TODOS: readonly string[] = Array.from({ length: 12 }, (_, index) => `DOC-${String(index + 1).padStart(3, '0')}`);

const orderAndCount: BrowserRowHandler = onWeb(async (row, { page }) => {
  const expected = thenOf(row);
  const layout = strict('diseño', LAYOUTS, cell(row, 'diseno'));
  const failure = await prepare(page, layout);
  if (failure !== undefined) return preparationFailedWeb(expected, failure);
  await waitUntil(async () => (await shownCodes(page))?.length === 12);
  const codes = await shownCodes(page);
  const above = await subtitleText(page);
  const below = await countText(page);
  return finish(
    [
      listCheck(codes, TODOS),
      check(above === '12 documentos', 'el recuento encima de la lista dice «12 documentos»', `el recuento encima de la lista dice «${above ?? '(sin leer)'}»`),
    ],
    { evidence: { recuentoDebajoDeLaTabla: below ?? null, documentosVistos: codes?.length ?? null } },
  );
});

// --- Esquema 3: el menú de la fila ofrece ver el documento, abrirlo en una pestaña nueva y descargarlo ------------------------

const viewFromMenu = async (expected: string, code: string, option: string, page: Page): Promise<Outcome> => {
  const opened = await openRowMenu(page, code);
  if (opened !== undefined) return failedAction(expected, opened);
  const pressed = await pressMenuItem(page, code, option);
  if (pressed !== undefined) return failedAction(expected, pressed);
  const arrived = await waitUntil(async () => new URL(page.url()).pathname === `/documents/${code}`);
  const title = await waitUntil(async () => (await normalizedText(detailTitle(page))) === 'Plan de verificación PRG-001');
  return finish([
    check(arrived.reached, `llega a /documents/${code}`, `llega a ${new URL(page.url()).pathname}`),
    check(title.reached, 've el título Plan de verificación PRG-001', title.reached ? 've el título Plan de verificación PRG-001' : `ve el título «${(await normalizedText(detailTitle(page))) ?? '(sin leer)'}»`),
  ]);
};

const newTabFromMenu = async (expected: string, code: string, option: string, page: Page, context: BrowserContext): Promise<Outcome> => {
  const opened = await openRowMenu(page, code);
  if (opened !== undefined) return failedAction(expected, opened);
  const tab = await newTabFrom(context, async () => {
    const blocked = await interact(menuItem(page, code, option), `pulsar «${option}» en las acciones de ${code}`, (element) => element.click(ACTION));
    if (blocked !== undefined) throw new Error(blocked.message);
  });
  if ('failure' in tab) return outcome(false, expected, tab.failure, { note: 'La opción debe abrir una pestaña nueva con el visor.' });
  const version = await waitUntil(async () => (await normalizedText(viewerVersion(tab.page))) === 'Versión 3');
  const path = new URL(tab.page.url()).pathname;
  return finish(
    [
      check(path === `/documents/${code}/view`, `se abre una pestaña nueva con /documents/${code}/view`, `la pestaña nueva va a ${path}`),
      check(version.reached, 've la versión 3 del documento', `ve «${(await normalizedText(viewerVersion(tab.page))) ?? '(sin leer)'}»`),
    ],
    { evidence: { tituloDelVisor: (await normalizedText(viewerTitle(tab.page))) ?? null } },
  );
};

const downloadFromMenu = async (expected: string, code: string, option: string, page: Page): Promise<Outcome> => {
  const opened = await openRowMenu(page, code);
  if (opened !== undefined) return failedAction(expected, opened);
  const armedAt = await armToasts(page);
  if (armedAt === undefined) return preparationFailedWeb(expected, UNARMED);
  const got = await tryDownload(page, async () => {
    const blocked = await pressMenuItem(page, code, option);
    if (blocked !== undefined) throw new Error(blocked.message);
  });
  if ('error' in got) return noDownload(expected, page, got.error);
  const download = got.download;
  const toast = await toastShown(page, undefined, 'Descarga iniciada', 'DOC-002-v1.pdf', armedAt);
  return finish([
    check(toast.seen, 've el aviso «Descarga iniciada» con el nombre DOC-002-v1.pdf', toast.seen ? 've el aviso «Descarga iniciada» con el nombre DOC-002-v1.pdf' : `no aparece el aviso: ${toast.observed}`),
    check(download.name === 'DOC-002-v1.pdf', 'el archivo descargado se llama DOC-002-v1.pdf', `el archivo descargado se llama ${download.name}`),
    sameBytes(download.bytes, await apiPdfOf(TENANT_A, 'DOC-002'), 'DOC-002 versión 1'),
  ], { evidence: { tonoDelAvisoRegistrado: toast.observed } });
};

const menuActions: BrowserRowHandler = async (row: ManifestRow, { page, context }): Promise<Outcome> => {
  const expected = thenOf(row);
  const code = strict('código', CODIGO, cell(row, 'codigo'));
  const option = strict('opción', OPCION, cell(row, 'opcion'));
  const kind = strict('resultado', TIPO_DE_RESULTADO, cell(row, 'resultado'));
  const failure = await prepare(page, 'escritorio');
  if (failure !== undefined) return preparationFailedWeb(expected, failure);
  if (kind === 'ver') return viewFromMenu(expected, code, option, page);
  if (kind === 'pestana') return newTabFromMenu(expected, code, option, page, context);
  return downloadFromMenu(expected, code, option, page);
};

defineBrowserRows({
  story: 'US-DOC-LISTA-006',
  surface: 'web',
  tenants: [TENANT_A],
  handlers: new Map<number, BrowserRowHandler>([
    [1, rowData],
    [2, orderAndCount],
    [3, onWeb(menuActions)],
  ]),
});
