import type { Page } from '@playwright/test';
import { resetTenants, TENANT_A } from '../../../story-runs/support/prepare';
import { ACTION, isFocused, quoted, runSteps, valueOf, waitUntil } from '../../support/browser';
import { check, cell, conclude, preparationFailedWeb, strict } from '../../support/checks';
import { defineBrowserRows, type BrowserRowHandler } from '../../core/framework';
import {
  actionMissing,
  afterListResponse,
  chooseStatus,
  clearButton,
  closeFilters,
  codesOf,
  countCheck,
  fillDate,
  listCheck,
  LAYOUTS,
  openFilters,
  openPath,
  pickOwner,
  recountText,
  searchBox,
  signIn,
  statusSelect,
  typeSearch,
  waitForList,
  type Layout,
} from './common';

// US-PROG-LISTA-004 — Filtrar y buscar en la lista de programas (web). Preparación de cada fila: reinicio de alumno01 con el token
// de su administrador; después gestor@sigpro.test entra desde /login?tenant=alumno01 en un navegador sin sesión guardada y llega a
// /programs. El escritorio es 1440 px; el diseño responsive, 390 px (por debajo de 1024). Las filas de «Limpiar filtros» en el
// responsive abren el panel «Filtros», porque el botón solo existe dentro de él.

const FIRST_TEN = '1–10 de 24';

/** Un Esquema que no mira diseño (las filas de escritorio) siempre va a escritorio. */
const DESKTOP: Layout = 'escritorio';

// --- Esquema 1: el filtro de estado muestra solo los programas de ese estado --------------------------------------------------

const statusFilter: BrowserRowHandler = async (row, { page }) => {
  await resetTenants([TENANT_A]);
  const layout = strict('diseño', LAYOUTS, cell(row, 'diseno'));
  const label = quoted(cell(row, 'estado'));
  const expectedCodes = codesOf(cell(row, 'codigos'));
  const expectedCount = quoted(cell(row, 'recuento'));
  const expected = `la lista muestra ${cell(row, 'codigos')} y el recuento dice ${cell(row, 'recuento')}`;
  const opened = await signIn(page, layout);
  if (opened) return preparationFailedWeb(expected, opened);
  const chosen = await runSteps([[`elegir ${cell(row, 'estado')} en «Estado»`, () => chooseStatus(page, label)]]);
  if (chosen) return actionMissing(expected, chosen);
  const shown = await waitForList(page, layout, expectedCodes, expectedCount);
  return conclude([listCheck(shown.codes, expectedCodes), countCheck(shown.count, expectedCount)]);
};

// --- Esquema 2: «Inicio desde» y «Fin hasta» incluyen el día indicado --------------------------------------------------------

const dateIncluded: BrowserRowHandler = async (row, { page }) => {
  await resetTenants([TENANT_A]);
  const expectedCodes = codesOf(cell(row, 'codigos'));
  const expected = `la lista muestra ${cell(row, 'codigos')}`;
  const opened = await signIn(page, DESKTOP);
  if (opened) return preparationFailedWeb(expected, opened);
  const campo = quoted(cell(row, 'campo'));
  const typed = await runSteps([[`escribir ${cell(row, 'texto')} en el buscador de la lista`, () => typeSearch(page, DESKTOP, cell(row, 'texto'))]]);
  if (typed) return actionMissing(expected, typed);
  const dated = await runSteps([[`escribir ${cell(row, 'fecha')} en ${cell(row, 'campo')}`, () => fillDate(page, campo, cell(row, 'fecha'))]]);
  if (dated) return actionMissing(expected, dated);
  const shown = await waitForList(page, DESKTOP, expectedCodes);
  return conclude([listCheck(shown.codes, expectedCodes)]);
};

// --- Esquema 3: el filtro de responsable muestra los programas de la persona elegida ----------------------------------------

const ownerFilter: BrowserRowHandler = async (row, { page }) => {
  await resetTenants([TENANT_A]);
  const expectedCodes = codesOf(cell(row, 'codigos'));
  const expected = `la lista muestra ${cell(row, 'codigos')}`;
  const opened = await signIn(page, DESKTOP);
  if (opened) return preparationFailedWeb(expected, opened);
  const picked = await pickOwner(page, cell(row, 'busqueda'), cell(row, 'persona'));
  if (picked) return actionMissing(expected, picked);
  const shown = await waitForList(page, DESKTOP, expectedCodes);
  return conclude([listCheck(shown.codes, expectedCodes)]);
};

// --- Esquema 4: el buscador compara código y nombre y muestra el recuento -----------------------------------------------------

const searchCount: BrowserRowHandler = async (row, { page }) => {
  await resetTenants([TENANT_A]);
  const layout = strict('diseño', LAYOUTS, cell(row, 'diseno'));
  const expectedCodes = codesOf(cell(row, 'codigos'));
  const expectedCount = quoted(cell(row, 'recuento'));
  const expected = `la lista muestra ${cell(row, 'codigos')} y el recuento dice ${cell(row, 'recuento')}`;
  const opened = await signIn(page, layout);
  if (opened) return preparationFailedWeb(expected, opened);
  const typed = await runSteps([[`escribir ${cell(row, 'texto')} en el buscador de la lista`, () => typeSearch(page, layout, cell(row, 'texto'))]]);
  if (typed) return actionMissing(expected, typed);
  const shown = await waitForList(page, layout, expectedCodes, expectedCount);
  return conclude([listCheck(shown.codes, expectedCodes), countCheck(shown.count, expectedCount)]);
};

// --- Esquema 5: «Limpiar filtros» quita filtros y texto y vuelve a la lista completa -----------------------------------------

/** Deja aplicado «En pausa» en «Estado» y «gestión» en el buscador (en el responsive, el estado va dentro del panel). */
const applyFilters = async (page: Page, layout: Layout): Promise<string | undefined> => {
  if (layout === DESKTOP) {
    return runSteps([
      ['elegir «En pausa» en «Estado»', () => chooseStatus(page, 'En pausa')],
      ['escribir gestión en el buscador de la lista', () => typeSearch(page, layout, 'gestión')],
    ]);
  }
  return runSteps([
    ['abrir «Filtros»', () => openFilters(page)],
    ['elegir «En pausa» en «Estado»', () => chooseStatus(page, 'En pausa')],
    ['pulsar «Listo»', () => closeFilters(page)],
    ['escribir gestión en «Buscar programas»', () => typeSearch(page, layout, 'gestión')],
  ]);
};

const clearAll: BrowserRowHandler = async (row, { page }) => {
  await resetTenants([TENANT_A]);
  const layout = strict('diseño', LAYOUTS, cell(row, 'diseno'));
  const expected = `la lista muestra el recuento «${FIRST_TEN}» y el buscador queda vacío`;
  const opened = await signIn(page, layout);
  if (opened) return preparationFailedWeb(expected, opened);
  const prepared = await applyFilters(page, layout);
  if (prepared) return preparationFailedWeb(expected, prepared);
  // En responsive, «Limpiar filtros» solo existe dentro del panel «Filtros»: se abre, se pulsa y se lee el estado antes de cerrarlo
  const opening = layout === DESKTOP ? undefined : await runSteps([['abrir «Filtros»', () => openFilters(page)]]);
  if (opening) return actionMissing(expected, opening);
  const cleared = await runSteps([['pulsar «Limpiar filtros»', () => afterListResponse(page, () => clearButton(page).click(ACTION))]]);
  if (cleared) return actionMissing(expected, cleared);
  const statusAfter = await valueOf(statusSelect(page));
  if (layout !== DESKTOP) await runSteps([['pulsar «Listo»', () => closeFilters(page)]]);
  await waitUntil(async () => (await recountText(page)) === FIRST_TEN);
  const count = await recountText(page);
  const typed = await valueOf(searchBox(page, layout));
  return conclude([
    countCheck(count, FIRST_TEN),
    check(typed === '', 'el buscador queda vacío', `el buscador tiene «${typed ?? '(sin leer)'}»`),
    check(statusAfter === '', 'sin estado elegido en «Estado»', `«Estado» tiene «${statusAfter ?? '(sin leer)'}»`),
  ]);
};

// --- Esquema 6: una dirección con filtros muestra la lista filtrada ----------------------------------------------------------

const addressFilter: BrowserRowHandler = async (row, { page }) => {
  await resetTenants([TENANT_A]);
  const expectedCodes = codesOf(cell(row, 'codigos'));
  const expectedCount = quoted(cell(row, 'recuento'));
  const expected = `la lista muestra ${cell(row, 'codigos')} y el recuento dice ${cell(row, 'recuento')}`;
  const opened = await signIn(page, DESKTOP);
  if (opened) return preparationFailedWeb(expected, opened);
  const loaded = await openPath(page, DESKTOP, cell(row, 'direccion'));
  if (loaded) return actionMissing(expected, loaded);
  const shown = await waitForList(page, DESKTOP, expectedCodes, expectedCount);
  return conclude([listCheck(shown.codes, expectedCodes), countCheck(shown.count, expectedCount)]);
};

// --- Esquema 7: la tecla / lleva el foco al buscador de la lista ---------------------------------------------------------------

/** El campo que la historia nombra, con el diseño en el que existe. */
const FOCUS_TARGETS: ReadonlyMap<string, Layout> = new Map<string, Layout>([
  ['«Búsqueda global» de la cabecera', 'escritorio'],
  ['«Buscar programas»', 'responsive'],
]);

const slashFocus: BrowserRowHandler = async (row, { page }) => {
  await resetTenants([TENANT_A]);
  const layout = strict('diseño', LAYOUTS, cell(row, 'diseno'));
  const target = strict('campo', FOCUS_TARGETS, cell(row, 'campo'));
  const expected = `el foco queda en ${cell(row, 'campo')}`;
  const opened = await signIn(page, layout);
  if (opened) return preparationFailedWeb(expected, opened);
  await page.evaluate(() => {
    const active = document.activeElement;
    if (active instanceof HTMLElement) active.blur();
  });
  const pressed = await runSteps([['pulsar /', () => page.keyboard.press('/')]]);
  if (pressed) return actionMissing(expected, pressed);
  const box = searchBox(page, target);
  const focused = await waitUntil(() => isFocused(box), 2_000);
  return conclude([check(focused.reached, expected, focused.reached ? expected : `el foco no queda en ${cell(row, 'campo')}`)]);
};

defineBrowserRows({
  story: 'US-PROG-LISTA-004',
  surface: 'web',
  tenants: [TENANT_A],
  handlers: new Map<number, BrowserRowHandler>([
    [1, statusFilter],
    [2, dateIncluded],
    [3, ownerFilter],
    [4, searchCount],
    [5, clearAll],
    [6, addressFilter],
    [7, slashFocus],
  ]),
});
