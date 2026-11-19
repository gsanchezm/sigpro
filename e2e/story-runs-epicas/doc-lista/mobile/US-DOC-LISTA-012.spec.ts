import type { Locator, Page } from '@playwright/test';
import { TENANT_A, resetTenants } from '../../../story-runs/support/prepare';
import { ACTION, attrOf, isVisible, waitUntil } from '../../support/browser';
import { defineBrowserRows, outcome, type BrowserRowHandler, type ManifestRow, type Outcome } from '../../core/framework';
import { cell, check, preparationFailedWeb, strict } from '../../support/checks';
import {
  apiPdfOf,
  armToasts,
  noDownload,
  tryDownload,
  interact,
  linesOf,
  normalizedText,
  openDetailFromList,
  sameBytes,
  thenOf,
  visibleOrUnknown,
  toastShown,
  finish,
  UNARMED,
} from '../web/common';
import {
  DIRECT_APPROXIMATION,
  backLink,
  detailBox,
  detailClassBadge,
  detailDownload,
  detailTitleOf,
  detailUpdated,
  gotoApp,
  loadMore,
  notFoundNotice,
  onExpoWeb,
  openDocumentsPath,
  signIn,
  versionChip,
  versionMeta,
  versionNote,
  viewerPageN,
} from './common';

// US-DOC-LISTA-012 — Ficha de un documento en la app móvil (Expo web, 390 px): cabecera, versiones con su autor, fecha y nota,
// contenido en páginas con «Cargar más», descarga de la versión elegida y aviso de «no encontrado». Preparación: reinicio de alumno01,
// inicio de sesión de gestor@sigpro.test y entrada a la ficha desde /documents (clic en el código), salvo la fila de dirección directa.

const CODIGO: ReadonlyMap<string, string> = new Map<string, string>([
  ['DOC-001', 'DOC-001'],
  ['DOC-002', 'DOC-002'],
]);

const CLASIFICACION: ReadonlyMap<string, string> = new Map<string, string>([
  ['«Público»', 'Público'],
  ['«Restringido»', 'Restringido'],
]);

/** Versión de la celda → nombre del chip del selector (la última lleva «· última»; la del seed es la 3). */
const CHIP_DE_VERSION: ReadonlyMap<string, string> = new Map<string, string>([
  ['3', 'Versión 3 · última'],
  ['2', 'Versión 2'],
  ['1', 'Versión 1'],
]);

const VERSION_DE_ESTADO: ReadonlyMap<string, number> = new Map<string, number>([
  ['3', 3],
  ['2', 2],
  ['1', 1],
]);

const DIRECCION_NO_EXISTE: ReadonlyMap<string, string> = new Map<string, string>([
  ['DOC-013', '/documents/DOC-013'],
  ['doc-001', '/documents/doc-001'],
]);

/** Lectura de una casilla de un chip: su `aria-checked` (`true` si está marcada). */
const checkedOf = (chip: Locator): Promise<string | undefined> => attrOf(chip, 'aria-checked');

/** Entrada a la ficha de DOC-001 (o del código dado) desde la lista, con la sesión iniciada en la app. */
const openFicha = async (page: Page, code: string): Promise<string | undefined> => {
  await resetTenants([TENANT_A]);
  const signed = await signIn(page);
  if (signed !== undefined) return signed;
  const listed = await openDocumentsPath(page);
  if (listed !== undefined) return listed;
  const opened = await openDetailFromList(page, code);
  return opened === undefined ? undefined : opened.message;
};

const failed = (expected: string, message: string, note: string): Outcome => outcome(false, expected, message, { note });

// --- Esquema 1: la ficha abre en la última versión con su autor y su fecha ---------------------------------------------------------

const opensOnLatest: BrowserRowHandler = async (row: ManifestRow, { page }): Promise<Outcome> => {
  const expected = thenOf(row);
  const code = strict('código', CODIGO, cell(row, 'codigo'));
  const clase = strict('clasificación', CLASIFICACION, cell(row, 'clasificacion'));
  const latest = strict('versión', VERSION_DE_ESTADO, cell(row, 'version'));
  const chip = `Versión ${latest} · última`;
  const failure = await openFicha(page, code);
  if (failure !== undefined) return preparationFailedWeb(expected, failure);
  const title = await waitUntil(async () => (await normalizedText(detailTitleOf(page))) === cell(row, 'titulo'));
  const badge = await normalizedText(detailClassBadge(page));
  const updated = await normalizedText(detailUpdated(page));
  const selected = await checkedOf(versionChip(page, chip));
  const meta = await normalizedText(versionMeta(page));
  return finish([
    check(title.reached, `el título ${cell(row, 'titulo')}`, `el título «${(await normalizedText(detailTitleOf(page))) ?? '(sin leer)'}»`),
    check(badge === clase, `la clasificación ${clase}`, `la clasificación «${badge ?? '(sin leer)'}»`),
    check(updated === `Actualizado: ${cell(row, 'actualizado')}`, `el texto «Actualizado: ${cell(row, 'actualizado')}»`, `el texto «${updated ?? '(sin leer)'}»`),
    check(selected === 'true', `el selector de versiones con «${chip}» marcada`, `«${chip}» está ${selected === undefined ? '(sin leer)' : selected === 'true' ? 'marcada' : 'sin marcar'}`),
    check(meta === `por Javier Ortega · ${cell(row, 'fecha')}`, `el texto «por Javier Ortega · ${cell(row, 'fecha')}» debajo`, `debajo se lee «${meta ?? '(sin leer)'}»`),
  ]);
};

// --- Esquema 2: tocar una versión muestra su autor, su fecha y su nota -------------------------------------------------------------

const touchVersion: BrowserRowHandler = async (row: ManifestRow, { page }): Promise<Outcome> => {
  const expected = thenOf(row);
  const version = strict('versión', CHIP_DE_VERSION, cell(row, 'version'));
  const failure = await openFicha(page, 'DOC-001');
  if (failure !== undefined) return preparationFailedWeb(expected, failure);
  const touched = await interact(versionChip(page, version), `tocar «${version}»`, (element) => element.click(ACTION));
  if (touched !== undefined) return failed(expected, touched.message, touched.note);
  const marked = await waitUntil(async () => (await checkedOf(versionChip(page, version))) === 'true');
  const stateNow = await checkedOf(versionChip(page, version));
  const meta = await normalizedText(versionMeta(page));
  const label = await isVisible(detailBox(page).getByText('Nota de cambios', { exact: true }));
  const note = await normalizedText(versionNote(page));
  return finish([
    check(marked.reached, `queda marcada «${version}»`, `«${version}» tiene aria-checked ${stateNow ?? '(sin leer)'}`),
    check(meta === `por Javier Ortega · ${cell(row, 'fecha')}`, `ve el texto «por Javier Ortega · ${cell(row, 'fecha')}»`, `ve «${meta ?? '(sin leer)'}»`),
    check(label, 'la etiqueta «Nota de cambios»', label ? 'se ve la etiqueta «Nota de cambios»' : 'no se ve la etiqueta «Nota de cambios»'),
    check(note === cell(row, 'nota'), `la nota ${cell(row, 'nota')}`, `la nota «${note ?? '(sin leer)'}»`),
  ]);
};

// --- Esquema 3: el contenido abre con la primera página y «Cargar más» añade la siguiente -----------------------------------------

const pagesWithLoadMore: BrowserRowHandler = async (row: ManifestRow, { page }): Promise<Outcome> => {
  const expected = thenOf(row);
  const code = strict('código', CODIGO, cell(row, 'codigo'));
  const failure = await openFicha(page, code);
  if (failure !== undefined) return preparationFailedWeb(expected, failure);
  const first = await waitUntil(() => isVisible(viewerPageN(page, 1)));
  const page1 = (await linesOf(viewerPageN(page, 1))) ?? [];
  const secondBefore = await visibleOrUnknown(viewerPageN(page, 2));
  const more = await interact(loadMore(page), 'pulsar «Cargar más»', (element) => element.click(ACTION));
  if (more !== undefined) return failed(expected, more.message, more.note);
  const second = await waitUntil(() => isVisible(viewerPageN(page, 2)));
  const page2 = (await linesOf(viewerPageN(page, 2))) ?? [];
  const moreGone = await waitUntil(async () => (await visibleOrUnknown(loadMore(page))) === false);
  return finish([
    check(first.reached && page1[0] === 'Página 1 de 2', 've «Página 1 de 2»', `ve «${page1[0] ?? '(sin leer)'}»`),
    check(page1[page1.length - 1] === cell(row, 'ultima_pagina_1'), `con las líneas hasta ${cell(row, 'ultima_pagina_1')}`, `la última línea de la página 1 es «${page1[page1.length - 1] ?? '(sin leer)'}»`),
    check(secondBefore === false, 'no ve la página 2', secondBefore === undefined ? '(sin leer)' : secondBefore ? 've la página 2 antes de pulsar «Cargar más»' : 'no ve la página 2 antes de pulsar «Cargar más»'),
    check(second.reached && page2[0] === 'Página 2 de 2', 've «Página 2 de 2»', `ve «${page2[0] ?? '(sin leer)'}»`),
    check(page2[1] === cell(row, 'primera_pagina_2'), `con la línea ${cell(row, 'primera_pagina_2')} al principio`, `la primera línea de la página 2 es «${page2[1] ?? '(sin leer)'}»`),
    check(moreGone.reached, 'ya no ve «Cargar más»', moreGone.reached ? 'ya no ve «Cargar más»' : 'sigue viendo «Cargar más»'),
  ]);
};

// --- Esquema 4: «Descargar PDF» entrega la versión elegida con su nombre ------------------------------------------------------------

const downloadChosen: BrowserRowHandler = async (row: ManifestRow, { page }): Promise<Outcome> => {
  const expected = thenOf(row);
  const version = strict('versión', CHIP_DE_VERSION, cell(row, 'version'));
  const number = strict('número', VERSION_DE_ESTADO, cell(row, 'version'));
  const archivo = cell(row, 'archivo');
  const failure = await openFicha(page, 'DOC-001');
  if (failure !== undefined) return preparationFailedWeb(expected, failure);
  const touched = await interact(versionChip(page, version), `tocar «${version}»`, (element) => element.click(ACTION));
  if (touched !== undefined) return failed(expected, touched.message, touched.note);
  const armedAt = await armToasts(page);
  if (armedAt === undefined) return preparationFailedWeb(expected, UNARMED);
  const got = await tryDownload(page, async () => {
    const blocked = await interact(detailDownload(page), 'pulsar «Descargar PDF»', (element) => element.click(ACTION));
    if (blocked !== undefined) throw new Error(blocked.message);
  });
  if ('error' in got) return noDownload(expected, page, got.error);
  const download = got.download;
  const toast = await toastShown(page, 'info', 'Descarga iniciada', archivo, armedAt);
  return finish([
    check(toast.seen, `ve el aviso «Descarga iniciada» con el nombre ${archivo}`, toast.seen ? `ve el aviso «Descarga iniciada» con el nombre ${archivo}` : `no aparece el aviso: ${toast.observed}`),
    check(download.name === archivo, `el archivo se llama ${archivo}`, `el archivo se llama ${download.name}`),
    sameBytes(download.bytes, await apiPdfOf(TENANT_A, 'DOC-001', number), `DOC-001 versión ${number}`),
  ]);
};

// --- Esquema 5: un código que no existe muestra el aviso de documento no encontrado --------------------------------------------------

const notFoundFicha: BrowserRowHandler = async (row: ManifestRow, { page }): Promise<Outcome> => {
  const expected = thenOf(row);
  const path = strict('código', DIRECCION_NO_EXISTE, cell(row, 'codigo'));
  await resetTenants([TENANT_A]);
  const signed = await signIn(page);
  if (signed !== undefined) return preparationFailedWeb(expected, signed);
  const opened = await gotoApp(page, path);
  if (opened !== undefined) return preparationFailedWeb(expected, opened);
  const shown = await waitUntil(() => isVisible(notFoundNotice(page)));
  const lines = (await linesOf(notFoundNotice(page))) ?? [];
  const back = await normalizedText(backLink(page));
  const trace = lines.join(' · ');
  return finish(
    [
      check(shown.reached && lines.includes('No se encontró el documento'), 'el aviso «No se encontró el documento»', `el aviso dice «${trace || '(sin leer)'}»`),
      check(back === 'Volver a Documentos', 'el enlace «Volver a Documentos»', `el enlace dice «${back ?? '(sin leer)'}»`),
    ],
    { note: `${DIRECT_APPROXIMATION} El paso pide la traza de la petición, pero la línea de detalle técnico no decide el veredicto (el README la excluye): se anota en la evidencia y no se compara.`, evidence: { ruta: path, trazaDelAviso: trace, trazaContieneEl404: trace.includes('→ 404') } },
  );
};

defineBrowserRows({
  story: 'US-DOC-LISTA-012',
  surface: 'expo-web',
  tenants: [TENANT_A],
  handlers: new Map<number, BrowserRowHandler>([
    [1, onExpoWeb(opensOnLatest)],
    [2, onExpoWeb(touchVersion)],
    [3, onExpoWeb(pagesWithLoadMore)],
    [4, onExpoWeb(downloadChosen)],
    [5, onExpoWeb(notFoundFicha)],
  ]),
});
