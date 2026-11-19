import type { Page } from '@playwright/test';
import { resetTenants, TENANT_A } from '../../../story-runs/support/prepare';
import { ACTION, isFocused, quoted, runSteps, valueOf, waitUntil } from '../../support/browser';
import { check, cell, conclude, preparationFailedWeb, strict } from '../../support/checks';
import { defineBrowserRows, type BrowserRowHandler } from '../../core/framework';
import {
  actionFailed,
  actionMissing,
  chooseStatus,
  clearButton,
  closeFilters,
  codesOf,
  countCheck,
  describeCodes,
  emptyBlockChecks,
  fillDate,
  interactAndAwait,
  LAYOUTS,
  listCheck,
  listedCodes,
  onWeb,
  openFilters,
  openPath,
  pickOwner,
  recountText,
  sameCodes,
  searchBox,
  signIn,
  statusSelect,
  typeSearch,
  waitForList,
  waitSettled,
  type Blocked,
  type Layout,
} from './common';

// US-PROG-LISTA-004 — Filtrar y buscar en la lista de programas (web). Preparación de cada fila: reinicio de alumno01 con el token de
// su administrador; después gestor@sigpro.test entra desde /login?tenant=alumno01 en un navegador sin sesión guardada y llega a
// /programs. El escritorio es 1440 px; el responsive, 390 px. En responsive, «Limpiar filtros» solo existe dentro del panel «Filtros»:
// la fila abre el panel, lo lee y lo cierra con «Listo».

const FIRST_TEN = '1–10 de 24';
const DESKTOP: Layout = 'escritorio';

/** Parámetro de la dirección que lleva cada fecha del filtro. */
const DATE_PARAM: ReadonlyMap<string, string> = new Map<string, string>([
  ['Inicio desde', 'from'],
  ['Fin hasta', 'to'],
]);

// --- Esquema 1: el filtro de estado muestra solo los programas de ese estado --------------------------------------------

const statusFilter: BrowserRowHandler = async (row, { page }) => {
  await resetTenants([TENANT_A]);
  const layout = strict('diseño', LAYOUTS, cell(row, 'diseno'));
  const label = quoted(cell(row, 'estado'));
  const expectedCodes = codesOf(cell(row, 'codigos'));
  const expectedCount = quoted(cell(row, 'recuento'));
  const expected = `la lista muestra ${cell(row, 'codigos')} y el recuento dice ${cell(row, 'recuento')}`;
  const opened = await signIn(page, layout);
  if (opened) return preparationFailedWeb(expected, opened);
  const chosen = await chooseStatus(page, label);
  if (chosen) return actionFailed(expected, chosen);
  const shown = await waitForList(page, layout, expectedCodes, expectedCount);
  return conclude([listCheck(shown.codes, expectedCodes), countCheck(shown.count, expectedCount)]);
};

// --- Esquema 2: «Inicio desde» y «Fin hasta» incluyen el día indicado --------------------------------------------------------

/** Lista sin la fecha, para la evidencia: se espera a que la lista se asiente y se leen sus códigos. */
const listedWithoutDate = async (page: Page): Promise<readonly string[]> => {
  await waitSettled(page, DESKTOP);
  return listedCodes(page, DESKTOP);
};

const dateIncluded: BrowserRowHandler = async (row, { page }) => {
  await resetTenants([TENANT_A]);
  const expectedCodes = codesOf(cell(row, 'codigos'));
  const expected = `la lista muestra ${cell(row, 'codigos')}`;
  const opened = await signIn(page, DESKTOP);
  if (opened) return preparationFailedWeb(expected, opened);
  const campo = quoted(cell(row, 'campo'));
  const fecha = cell(row, 'fecha');
  const typed = await typeSearch(page, DESKTOP, cell(row, 'texto'));
  if (typed) return actionFailed(expected, typed);
  const dated = await fillDate(page, campo, fecha);
  if (dated) return actionFailed(expected, dated);
  const shown = await waitForList(page, DESKTOP, expectedCodes);
  // El filtro debe quedar aplicado: el parámetro de la dirección y el valor del campo llevan la fecha de la fila
  const param = strict('campo', DATE_PARAM, campo);
  const inUrl = new URL(page.url()).searchParams.get(param);
  const inField = await valueOf(page.getByLabel(campo, { exact: true }));
  const emptyChecks = await emptyBlockChecks(page, expectedCodes);
  // Evidencia para discriminar: la misma búsqueda sin la fecha
  const cleared = await fillDate(page, campo, '');
  const withoutDate = cleared === undefined ? await listedWithoutDate(page) : undefined;
  const sameWithoutDate = withoutDate !== undefined && sameCodes(withoutDate, expectedCodes);
  const note = sameWithoutDate ? `la fila no distingue un filtro inactivo: sin «${campo}» la lista muestra también ${describeCodes(withoutDate)}` : undefined;
  return conclude(
    [
      listCheck(shown.codes, expectedCodes),
      check(inUrl === fecha, `la dirección lleva ${param}=${fecha}`, `la dirección lleva ${param}=${inUrl ?? '(sin el parámetro)'}`),
      check(inField === fecha, `el campo «${campo}» muestra ${fecha}`, `el campo «${campo}» muestra ${inField ?? '(sin leer)'}`),
      ...emptyChecks,
    ],
    {
      ...(note === undefined ? {} : { note }),
      evidence: { sinFecha: withoutDate === undefined ? '(no se pudo leer)' : describeCodes(withoutDate), parametroUrl: inUrl, valorCampo: inField },
    },
  );
};

// --- Esquema 3: el filtro de responsable muestra los programas de la persona elegida ----------------------------------------

const ownerFilter: BrowserRowHandler = async (row, { page }) => {
  await resetTenants([TENANT_A]);
  const expectedCodes = codesOf(cell(row, 'codigos'));
  const expected = `la lista muestra ${cell(row, 'codigos')}`;
  const opened = await signIn(page, DESKTOP);
  if (opened) return preparationFailedWeb(expected, opened);
  const picked = await pickOwner(page, cell(row, 'busqueda'), cell(row, 'persona'));
  if (picked) return actionFailed(expected, picked);
  const shown = await waitForList(page, DESKTOP, expectedCodes);
  return conclude([listCheck(shown.codes, expectedCodes), ...(await emptyBlockChecks(page, expectedCodes))]);
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
  const typed = await typeSearch(page, layout, cell(row, 'texto'));
  if (typed) return actionFailed(expected, typed);
  const shown = await waitForList(page, layout, expectedCodes, expectedCount);
  return conclude([listCheck(shown.codes, expectedCodes), countCheck(shown.count, expectedCount)]);
};

// --- Esquema 5: «Limpiar filtros» quita filtros y texto y vuelve a la lista completa -------------------------------------

/** Deja aplicado «En pausa» en «Estado» y «gestión» en el buscador (en el responsive, el estado va dentro del panel). */
const applyFilters = async (page: Page, layout: Layout): Promise<Blocked | undefined> => {
  if (layout === DESKTOP) {
    const status = await chooseStatus(page, 'En pausa');
    if (status !== undefined) return status;
    return typeSearch(page, layout, 'gestión');
  }
  const opened = await openFilters(page);
  if (opened !== undefined) return opened;
  const status = await chooseStatus(page, 'En pausa');
  if (status !== undefined) return status;
  const closed = await closeFilters(page);
  if (closed !== undefined) return closed;
  return typeSearch(page, layout, 'gestión');
};

const clearAll: BrowserRowHandler = async (row, { page }) => {
  await resetTenants([TENANT_A]);
  const layout = strict('diseño', LAYOUTS, cell(row, 'diseno'));
  const expected = `la lista muestra el recuento «${FIRST_TEN}» y el buscador queda vacío`;
  const opened = await signIn(page, layout);
  if (opened) return preparationFailedWeb(expected, opened);
  const prepared = await applyFilters(page, layout);
  if (prepared) return preparationFailedWeb(expected, prepared.message);
  // En responsive, «Limpiar filtros» solo existe dentro del panel «Filtros»: se abre, se pulsa y se lee el estado antes de cerrarlo
  if (layout !== DESKTOP) {
    const opening = await openFilters(page);
    if (opening !== undefined) return actionFailed(expected, opening);
  }
  const cleared = await interactAndAwait(page, clearButton(page), 'pulsar «Limpiar filtros»', (element) => element.click(ACTION));
  if (cleared !== undefined) return actionFailed(expected, cleared);
  const statusAfter = await valueOf(statusSelect(page));
  if (layout !== DESKTOP) {
    const closed = await closeFilters(page);
    if (closed !== undefined) return actionFailed(expected, closed);
  }
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
  const focused = await waitUntil(() => isFocused(searchBox(page, target)), 2_000);
  return conclude([check(focused.reached, expected, focused.reached ? expected : `el foco no queda en ${cell(row, 'campo')}`)]);
};

defineBrowserRows({
  story: 'US-PROG-LISTA-004',
  surface: 'web',
  tenants: [TENANT_A],
  handlers: new Map<number, BrowserRowHandler>([
    [1, onWeb(statusFilter)],
    [2, onWeb(dateIncluded)],
    [3, onWeb(ownerFilter)],
    [4, onWeb(searchCount)],
    [5, onWeb(clearAll)],
    [6, onWeb(addressFilter)],
    [7, onWeb(slashFocus)],
  ]),
});
