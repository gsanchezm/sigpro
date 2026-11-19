import type { Page } from '@playwright/test';
import { resetTenants, TENANT_A } from '../../../story-runs/support/prepare';
import { ACTION, attrOf, quoted, valueOf, waitUntil } from '../../support/browser';
import { cell, check, conclude, preparationFailedWeb, strict } from '../../support/checks';
import { defineBrowserRows, type BrowserRowHandler } from '../../core/framework';
import {
  actionFailed,
  actionMissing,
  clearButton,
  codesOf,
  countCheck,
  DIRECT_APPROXIMATION,
  interactAndAwait,
  listCheck,
  listedCodes,
  loadMoreButton,
  onExpoWeb,
  openPath,
  recountText,
  searchBox,
  signIn,
  statusChoice,
  strictSeen,
  valueCheck,
  waitForList,
  type Blocked,
} from './common';

// US-PROG-LISTA-008 — Ver la lista de programas en tarjetas con búsqueda, estado y «Cargar más» (app móvil, web de Expo a 390 px).
// Preparación de cada fila: reinicio de alumno01 con el token de su administrador; gestor@sigpro.test inicia sesión en la app con
// alumno01 en «Tenant de trabajo» y llega a /programs. El veredicto vale para Expo web, no para iOS ni Android nativo.

/** Diez programas por carga, sobre 24. */
const TOTAL = 24;
const PER_LOAD = 10;

/** «aparece» / «no aparece» de la historia. */
const BUTTON: ReadonlyMap<string, boolean> = new Map<string, boolean>([
  ['aparece', true],
  ['no aparece', false],
]);

/** Filtro de cada Esquema 5: un estado en el grupo «Estado» o un texto en el buscador (cada uno espera su respuesta). */
const FILTERS: ReadonlyMap<string, (page: Page) => Promise<Blocked | undefined>> = new Map<string, (page: Page) => Promise<Blocked | undefined>>([
  ['«En pausa» en el grupo «Estado»', (page) => interactAndAwait(page, statusChoice(page, 'En pausa'), 'elegir «En pausa» en el grupo «Estado»', (element) => element.click(ACTION))],
  ['el texto gestión en «Buscar programas»', (page) => interactAndAwait(page, searchBox(page), 'escribir «gestión» en «Buscar programas»', (element) => element.fill('gestión', ACTION))],
]);

// --- Esquema 1: «Cargar más» añade los programas siguientes -----------------------------------------------------------------

const loadMore: BrowserRowHandler = async (row, { page }) => {
  await resetTenants([TENANT_A]);
  const times = Number(cell(row, 'veces'));
  const expectedCount = quoted(cell(row, 'recuento'));
  const last = cell(row, 'ultimo');
  const wantVisible = strict('boton', BUTTON, cell(row, 'boton'));
  const expected = `ve el recuento ${cell(row, 'recuento')}, el último programa es ${last} y el botón «Cargar más» ${cell(row, 'boton')}`;
  const opened = await signIn(page);
  if (opened) return preparationFailedWeb(expected, opened);
  for (let clicks = 1; clicks <= times; clicks += 1) {
    const clicked = await interactAndAwait(page, loadMoreButton(page), 'pulsar «Cargar más»', (element) => element.click(ACTION), clicks);
    if (clicked !== undefined) return actionFailed(expected, clicked);
    // Tras cada carga se ven diez programas más (sin pasar de 24): se espera a que estén en pantalla
    await waitUntil(async () => (await listedCodes(page)).length === Math.min(PER_LOAD * (clicks + 1), TOTAL));
  }
  await waitUntil(async () => (await recountText(page)) === expectedCount);
  const codes = await listedCodes(page);
  const count = await recountText(page);
  const buttonSeen = await waitUntil(async () => (await strictSeen(loadMoreButton(page))) === wantVisible, 5_000);
  const shownButton = await strictSeen(loadMoreButton(page));
  return conclude([
    countCheck(count, expectedCount),
    check(codes[codes.length - 1] === last, `el último programa es ${last}`, `el último programa es ${codes[codes.length - 1] ?? '(ninguno)'}`),
    check(buttonSeen.reached && shownButton === wantVisible, `el botón «Cargar más» ${cell(row, 'boton')}`, `el botón «Cargar más» ${shownButton ? 'aparece' : 'no aparece'}`),
  ]);
};

// --- Esquema 2: el estado filtra la lista por ese estado ------------------------------------------------------------------

const statusFilter: BrowserRowHandler = async (row, { page }) => {
  await resetTenants([TENANT_A]);
  const label = quoted(cell(row, 'estado'));
  const expectedCodes = codesOf(cell(row, 'codigos'));
  const expectedCount = quoted(cell(row, 'recuento'));
  const expected = `ve ${cell(row, 'codigos')} y el recuento ${cell(row, 'recuento')}`;
  const opened = await signIn(page);
  if (opened) return preparationFailedWeb(expected, opened);
  const chosen = await interactAndAwait(page, statusChoice(page, label), `elegir ${cell(row, 'estado')} en el grupo «Estado»`, (element) => element.click(ACTION));
  if (chosen !== undefined) return actionFailed(expected, chosen);
  const shown = await waitForList(page, expectedCodes, expectedCount);
  return conclude([listCheck(shown.codes, expectedCodes), countCheck(shown.count, expectedCount)]);
};

// --- Esquema 3: la búsqueda compara código y nombre --------------------------------------------------------------------------

const searchText: BrowserRowHandler = async (row, { page }) => {
  await resetTenants([TENANT_A]);
  const expectedCodes = codesOf(cell(row, 'codigos'));
  const expectedCount = quoted(cell(row, 'recuento'));
  const expected = `ve ${cell(row, 'codigos')} y el recuento ${cell(row, 'recuento')}`;
  const opened = await signIn(page);
  if (opened) return preparationFailedWeb(expected, opened);
  const typed = await interactAndAwait(page, searchBox(page), `escribir ${cell(row, 'texto')} en «Buscar programas»`, (element) => element.fill(cell(row, 'texto'), ACTION));
  if (typed !== undefined) return actionFailed(expected, typed);
  const shown = await waitForList(page, expectedCodes, expectedCount);
  return conclude([listCheck(shown.codes, expectedCodes), countCheck(shown.count, expectedCount)]);
};

// --- Esquema 4: una dirección con filtros muestra la misma lista filtrada ------------------------------------------------------

const addressFilter: BrowserRowHandler = async (row, { page }) => {
  await resetTenants([TENANT_A]);
  const expectedCodes = codesOf(cell(row, 'codigos'));
  const expectedCount = quoted(cell(row, 'recuento'));
  const expected = `ve ${cell(row, 'codigos')} y el recuento ${cell(row, 'recuento')}`;
  const opened = await signIn(page);
  if (opened) return preparationFailedWeb(expected, opened);
  const loaded = await openPath(page, cell(row, 'direccion'));
  if (loaded) return actionMissing(expected, loaded);
  const shown = await waitForList(page, expectedCodes, expectedCount);
  return conclude([listCheck(shown.codes, expectedCodes), countCheck(shown.count, expectedCount)], { note: DIRECT_APPROXIMATION });
};

// --- Esquema 5: «Limpiar filtros» vuelve a la lista de los primeros 10 programas ----------------------------------------------

const clearAll: BrowserRowHandler = async (row, { page }) => {
  await resetTenants([TENANT_A]);
  const apply = strict('filtro', FILTERS, cell(row, 'filtro'));
  const expected = 've el recuento «1–10 de 24» y ningún filtro aplicado';
  const opened = await signIn(page);
  if (opened) return preparationFailedWeb(expected, opened);
  const prepared = await apply(page);
  if (prepared !== undefined) return preparationFailedWeb(expected, prepared.message);
  const cleared = await interactAndAwait(page, clearButton(page), 'pulsar «Limpiar filtros»', (element) => element.click(ACTION));
  if (cleared !== undefined) return actionFailed(expected, cleared);
  await waitUntil(async () => (await recountText(page)) === '1–10 de 24');
  const count = await recountText(page);
  const search = await valueOf(searchBox(page));
  const todos = await attrOf(statusChoice(page, 'Todos'), 'aria-checked');
  const url = new URL(page.url());
  const clearStill = await strictSeen(clearButton(page));
  return conclude([
    countCheck(count, '1–10 de 24'),
    valueCheck(search, '', 'el buscador tiene'),
    check(todos === 'true', 'la opción «Todos» del grupo «Estado» elegida', `la opción «Todos» tiene aria-checked ${todos ?? '(sin atributo)'}`),
    check(!url.searchParams.has('status') && !url.searchParams.has('q'), 'la dirección sin estado ni texto', `la dirección es ${url.pathname}${url.search}`),
    check(!clearStill, 'sin el botón «Limpiar filtros» (no hay filtro aplicado)', 'el botón «Limpiar filtros» sigue visible'),
  ]);
};

defineBrowserRows({
  story: 'US-PROG-LISTA-008',
  surface: 'expo-web',
  tenants: [TENANT_A],
  handlers: new Map<number, BrowserRowHandler>([
    [1, onExpoWeb(loadMore)],
    [2, onExpoWeb(statusFilter)],
    [3, onExpoWeb(searchText)],
    [4, onExpoWeb(addressFilter)],
    [5, onExpoWeb(clearAll)],
  ]),
});
