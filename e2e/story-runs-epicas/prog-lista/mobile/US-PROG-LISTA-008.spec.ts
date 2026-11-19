import type { Page } from '@playwright/test';
import { resetTenants, TENANT_A } from '../../../story-runs/support/prepare';
import { ACTION, attrOf, quoted, runSteps, valueOf, waitUntil } from '../../support/browser';
import { cell, check, conclude, preparationFailedWeb, strict } from '../../support/checks';
import { defineBrowserRows, type BrowserRowHandler } from '../../core/framework';
import {
  actionMissing,
  afterListResponse,
  clearButton,
  codesOf,
  countCheck,
  DIRECT_APPROXIMATION,
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
} from './common';

// US-PROG-LISTA-008 — Ver la lista de programas en tarjetas con búsqueda, estado y «Cargar más» (app móvil, web de Expo a 390 px).
// Preparación de cada fila: reinicio de alumno01 con el token de su administrador; gestor@sigpro.test inicia sesión en la app con
// alumno01 en «Tenant de trabajo» y llega a /programs. El veredicto vale para Expo web, no para iOS ni Android nativo.

/** Recuento de la primera carga y de cada «Cargar más»: diez programas por carga, sobre 24. */
const TOTAL = 24;
const PER_LOAD = 10;

/** «aparece» / «no aparece» de la historia. */
const BUTTON: ReadonlyMap<string, boolean> = new Map<string, boolean>([
  ['aparece', true],
  ['no aparece', false],
]);

/** Filtro de cada Esquema 5: un estado en el grupo «Estado» o un texto en el buscador. */
const FILTERS: ReadonlyMap<string, (page: Page) => Promise<void>> = new Map<string, (page: Page) => Promise<void>>([
  ['«En pausa» en el grupo «Estado»', (page) => afterListResponse(page, () => statusChoice(page, 'En pausa').click(ACTION))],
  ['el texto gestión en «Buscar programas»', (page) => afterListResponse(page, () => searchBox(page).fill('gestión', ACTION))],
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
    const clicked = await runSteps([['pulsar «Cargar más»', () => afterListResponse(page, () => loadMoreButton(page).click(ACTION))]]);
    if (clicked) return actionMissing(expected, clicked);
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
  const chosen = await runSteps([[`elegir ${cell(row, 'estado')} en el grupo «Estado»`, () => afterListResponse(page, () => statusChoice(page, label).click(ACTION))]]);
  if (chosen) return actionMissing(expected, chosen);
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
  const typed = await runSteps([[`escribir ${cell(row, 'texto')} en «Buscar programas»`, () => afterListResponse(page, () => searchBox(page).fill(cell(row, 'texto'), ACTION))]]);
  if (typed) return actionMissing(expected, typed);
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
  const prepared = await runSteps([[`aplicar ${cell(row, 'filtro')}`, () => apply(page)]]);
  if (prepared) return preparationFailedWeb(expected, prepared);
  const cleared = await runSteps([['pulsar «Limpiar filtros»', () => afterListResponse(page, () => clearButton(page).click(ACTION))]]);
  if (cleared) return actionMissing(expected, cleared);
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
