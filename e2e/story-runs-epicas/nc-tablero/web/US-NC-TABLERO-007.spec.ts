import type { Page } from '@playwright/test';
import { NC_TESTIDS } from '../../../../packages/shared/src/testids';
import { defineBrowserRows, type BrowserRowHandler, type ManifestRow } from '../../core/framework';
import { cell, check, strict } from '../../support/checks';
import { ACTION, safe } from '../../support/browser';
import {
  actionFailed,
  checkIn,
  checkedOf,
  chooseIn,
  columnOf,
  controlValue,
  fillIn,
  filtersClearButton,
  inOrder,
  interact,
  onWeb,
  prepareWeb,
  programSelect,
  searchBox,
  sameSet,
  severitySelect,
  cardsOnScreen,
  unassignedBox,
  verdictWeb,
  waitBoard,
  settled,
  withLimit,
  type WebAction,
} from './common';
import { TENANT_A } from '../../../story-runs/support/prepare';

// US-NC-TABLERO-007 — Filtros del tablero en la web (escritorio 1440 px). Preparación de cada fila: reinicio de alumno01 con el
// token de su administrador, inicio de sesión de gestor@sigpro.test y apertura de /nc. Los filtros no se guardan en la dirección,
// así que cada fila empieza con el tablero sin filtros. La comparación de las tarjetas que se ven es por CONJUNTO: el orden del DOM
// va por columna y la historia no fija un orden entre columnas.

/** Acciones de la celda «accion» (escribir, elegir o marcar un control de la barra de filtros). */
const ACTIONS: ReadonlyMap<string, WebAction> = new Map<string, WebAction>([
  ['escribe 012 en «Buscar no conformidades»', fillIn(searchBox, 'escribir 012 en «Buscar no conformidades»', '012')],
  ['escribe nc-01 en «Buscar no conformidades»', fillIn(searchBox, 'escribir nc-01 en «Buscar no conformidades»', 'nc-01')],
  ['elige PRG-002 en «Programa»', chooseIn(programSelect, 'elegir PRG-002 en «Programa»', { value: 'PRG-002' })],
  ['elige «Crítica» en «Severidad»', chooseIn(severitySelect, 'elegir «Crítica» en «Severidad»', { label: 'Crítica' })],
  ['marca «Solo sin asignar»', checkIn(unassignedBox, 'marcar «Solo sin asignar»')],
  [
    'elige PRG-003 en «Programa» y «Crítica» en «Severidad»',
    inOrder(chooseIn(programSelect, 'elegir PRG-003 en «Programa»', { value: 'PRG-003' }), chooseIn(severitySelect, 'elegir «Crítica» en «Severidad»', { label: 'Crítica' })),
  ],
]);

/** Filtros previos de la fila «Limpiar filtros» (la celda dice qué se escribe o elige antes de pulsar). */
const PREVIOUS_CELLS: ReadonlyMap<string, WebAction> = new Map<string, WebAction>([
  ['escrito zzzz-no-existe en «Buscar no conformidades»', fillIn(searchBox, 'escribir zzzz-no-existe en «Buscar no conformidades»', 'zzzz-no-existe')],
  [
    'elegido PRG-002 en «Programa» y «Crítica» en «Severidad»',
    inOrder(chooseIn(programSelect, 'elegir PRG-002 en «Programa»', { value: 'PRG-002' }), chooseIn(severitySelect, 'elegir «Crítica» en «Severidad»', { label: 'Crítica' })),
  ],
]);

const RECOUNT_CELLS: ReadonlyMap<string, string> = new Map<string, string>([
  ['«1 de 12 no conformidades»', '1 de 12 no conformidades'],
  ['«3 de 12 no conformidades»', '3 de 12 no conformidades'],
  ['«4 de 12 no conformidades»', '4 de 12 no conformidades'],
  ['«2 de 12 no conformidades»', '2 de 12 no conformidades'],
  ['«0 de 12 no conformidades»', '0 de 12 no conformidades'],
]);

const CODES_CELLS: ReadonlyMap<string, readonly string[]> = new Map<string, readonly string[]>([
  ['NC-012', ['NC-012']],
  ['NC-010, NC-011 y NC-012', ['NC-010', 'NC-011', 'NC-012']],
  ['NC-005, NC-006, NC-007 y NC-008', ['NC-005', 'NC-006', 'NC-007', 'NC-008']],
  ['NC-003, NC-006, NC-009 y NC-012', ['NC-003', 'NC-006', 'NC-009', 'NC-012']],
  ['NC-005 y NC-010', ['NC-005', 'NC-010']],
  ['NC-009 y NC-012', ['NC-009', 'NC-012']],
]);

const COLUMN_CELLS: ReadonlyMap<string, string> = new Map<string, string>([
  ['Rechazada', 'rejected'],
  ['Cerrada', 'closed'],
  ['En análisis', 'in_analysis'],
]);

const TEXT_CELLS: ReadonlyMap<string, string> = new Map<string, string>([['zzzz-no-existe', 'zzzz-no-existe']]);

const ALL_RECOUNT = '12 no conformidades · 8 abiertas';
const EMPTY_HINT = 'Ninguna no conformidad coincide con los filtros aplicados.';
const GESTOR = 'gestor@sigpro.test';

/** Lo que muestra el aviso de tablero vacío: sus líneas de texto y el nombre de su botón. */
interface EmptyView {
  readonly present: boolean;
  readonly lines: readonly string[];
  readonly clear: string | undefined;
}

/** Se ejecuta en el navegador: el aviso de filtro vacío en una sola lectura. */
const emptyReader = (): EmptyView => {
  const block = document.querySelector('[data-testid="nc-empty"]');
  const clear = document.querySelector('[data-testid="nc-empty-clear"]');
  return {
    present: block !== null,
    lines: block === null ? [] : ((block as HTMLElement).innerText ?? '').split('\n').map((line) => line.trim()).filter((line) => line !== ''),
    clear: clear === null ? undefined : (clear.textContent ?? '').replace(/\s+/g, ' ').trim(),
  };
};

const readEmpty = (page: Page): Promise<EmptyView | undefined> => withLimit<EmptyView | undefined>(page.evaluate(emptyReader), undefined);

/** Recuento de la lista esperado tras un filtro, espera incluida (el texto se pide con un pequeño retardo). */
const waitTotal = (page: Page, total: string) => waitBoard(page, 'escritorio', (view) => view.total === total && settled(view));

// --- Esquema 1: cada filtro deja solo las no conformidades que cumplen con él -----------------------------------------------------

const filterRow: BrowserRowHandler = async (row: ManifestRow, { page }) => {
  const action = strict('accion', ACTIONS, cell(row, 'accion'));
  const recount = strict('recuento', RECOUNT_CELLS, cell(row, 'recuento'));
  const codes = strict('codigos', CODES_CELLS, cell(row, 'codigos'));
  const expected = `tras «${cell(row, 'accion')}» el recuento de la lista dice ${cell(row, 'recuento')} y las tarjetas que se ven son ${cell(row, 'codigos')}`;
  const failed = await prepareWeb(page, 'escritorio', GESTOR, expected);
  if (failed !== undefined) return failed;

  const acted = await action(page);
  if (acted !== undefined) return actionFailed(expected, acted);
  const view = await waitTotal(page, recount);
  const onScreen = view === undefined ? [] : cardsOnScreen(view);
  return verdictWeb(
    [
      check(view?.total === recount, `recuento «${recount}»`, `recuento «${view?.total ?? '(sin leer)'}»`),
      check(view !== undefined && sameSet(onScreen, codes), `tarjetas ${cell(row, 'codigos')}`, `tarjetas ${onScreen.join(', ') || '(ninguna)'}`),
    ],
    'Las tarjetas se comparan como conjunto: el orden del tablero va por columna y la historia no fija el orden entre columnas.',
  );
};

// --- Esquema 2: una columna sin tarjetas que cumplen los filtros muestra «Sin tarjetas» ----------------------------------------

const emptyColumnRow: BrowserRowHandler = async (row: ManifestRow, { page }) => {
  const action = strict('accion', ACTIONS, cell(row, 'accion'));
  const state = strict('columna', COLUMN_CELLS, cell(row, 'columna'));
  const expected = `tras «${cell(row, 'accion')}» la columna «${cell(row, 'columna')}» muestra el contador 0 y el texto «Sin tarjetas»`;
  const failed = await prepareWeb(page, 'escritorio', GESTOR, expected);
  if (failed !== undefined) return failed;

  const acted = await action(page);
  if (acted !== undefined) return actionFailed(expected, acted);
  const view = await waitBoard(page, 'escritorio', (current) => columnOf(current, state)?.count === '0' && settled(current));
  const column = view === undefined ? undefined : columnOf(view, state);
  return verdictWeb([
    check(column?.present === true && column.title === cell(row, 'columna'), `columna «${cell(row, 'columna')}»`, `columna «${column?.title ?? '(sin leer)'}»`),
    check(column?.count === '0', 'contador 0', `contador ${column?.count ?? '(sin leer)'}`),
    check(column?.empty === 'Sin tarjetas', 'texto «Sin tarjetas»', `texto «${column?.empty ?? '(sin leer)'}»`),
  ]);
};

// --- Esquema 3: un texto sin coincidencias muestra el aviso de filtro vacío ----------------------------------------------------

const noMatchRow: BrowserRowHandler = async (row: ManifestRow, { page }) => {
  const text = strict('texto', TEXT_CELLS, cell(row, 'texto'));
  const recount = strict('recuento', RECOUNT_CELLS, cell(row, 'recuento'));
  const expected = `tras escribir ${cell(row, 'texto')} en «Buscar no conformidades» ve el aviso «${EMPTY_HINT}» con el botón «Limpiar filtros» y el recuento dice ${cell(row, 'recuento')}`;
  const failed = await prepareWeb(page, 'escritorio', GESTOR, expected);
  if (failed !== undefined) return failed;

  const acted = await fillIn(searchBox, 'escribir zzzz-no-existe en «Buscar no conformidades»', text)(page);
  if (acted !== undefined) return actionFailed(expected, acted);
  // Con el tablero vacío no hay tablero que asentar (aparece el aviso en su lugar): se espera solo al recuento
  const view = await waitBoard(page, 'escritorio', (current) => current.total === recount);
  const empty = await readEmpty(page);
  return verdictWeb(
    [
      check(empty?.present === true && empty.lines.includes(EMPTY_HINT), `aviso «${EMPTY_HINT}»`, `aviso ${empty?.present === true ? (empty.lines.find((line) => line.startsWith('Ninguna')) ?? '(sin ese texto)') : '(no aparece)'}`),
      check(empty?.clear === 'Limpiar filtros', 'botón «Limpiar filtros» en el aviso', `botón «${empty?.clear ?? '(sin leer)'}»`),
      check(view?.total === recount, `recuento «${recount}»`, `recuento «${view?.total ?? '(sin leer)'}»`),
    ],
    'Con el tablero vacío hay dos botones «Limpiar filtros» (el de la barra y el del aviso); esta fila solo comprueba el del aviso.',
  );
};

// --- Esquema 4: «Limpiar filtros» vuelve a mostrar las doce no conformidades -----------------------------------------------

const clearRow: BrowserRowHandler = async (row: ManifestRow, { page }) => {
  const previous = strict('filtro_previo', PREVIOUS_CELLS, cell(row, 'filtro_previo'));
  const expected = `tras «Limpiar filtros» el recuento de la lista dice «${ALL_RECOUNT}», ve las doce tarjetas, no ve el botón «Limpiar filtros» y los controles vuelven a su valor inicial`;
  const failed = await prepareWeb(page, 'escritorio', GESTOR, expected);
  if (failed !== undefined) return failed;

  const set = await previous(page);
  if (set !== undefined) return actionFailed(expected, set);
  await waitBoard(page, 'escritorio', (view) => view.total !== undefined && view.total !== ALL_RECOUNT);
  // Se pulsa el «Limpiar filtros» de la barra de filtros (el del aviso de tablero vacío, si aparece, hace lo mismo y no se usa)
  const cleared = await interact(filtersClearButton(page), 'pulsar «Limpiar filtros» de la barra', (element) => element.click(ACTION));
  if (cleared !== undefined) return actionFailed(expected, cleared);
  const view = await waitBoard(page, 'escritorio', (current) => current.total === ALL_RECOUNT && current.cardsTotal === 12 && settled(current));
  const clearButtons = await safe(() => page.getByTestId(NC_TESTIDS.NC_FILTERS_CLEAR).count(), -1);
  const search = await controlValue(page, searchBox);
  const program = await controlValue(page, programSelect);
  const severity = await controlValue(page, severitySelect);
  const unassigned = await checkedOf(unassignedBox)(page);
  return verdictWeb(
    [
      check(view?.total === ALL_RECOUNT, `recuento «${ALL_RECOUNT}»`, `recuento «${view?.total ?? '(sin leer)'}»`),
      check(view?.cardsTotal === 12, 'las doce tarjetas', `${view?.cardsTotal ?? '(sin leer)'} tarjetas`),
      check(clearButtons === 0, 'sin el botón «Limpiar filtros» de la barra', `botones «Limpiar filtros» de la barra: ${clearButtons < 0 ? '(sin leer)' : clearButtons}`),
      check(search === '', 'la búsqueda vacía', `búsqueda «${search ?? '(sin leer)'}»`),
      check(program === '', '«Programa» en «Todos los programas»', `«Programa» con valor «${program ?? '(sin leer)'}»`),
      check(severity === '', '«Severidad» en «Todas las severidades»', `«Severidad» con valor «${severity ?? '(sin leer)'}»`),
      check(unassigned === false, 'la casilla «Solo sin asignar» desmarcada', `casilla ${unassigned === undefined ? '(sin leer)' : unassigned ? 'marcada' : 'desmarcada'}`),
    ],
    'Con el tablero vacío habría dos botones «Limpiar filtros»; esta fila pulsa el de la barra (nc-filters-clear) y no el del aviso. Regla sin fila: los filtros no se guardan en la dirección; no se recarga la página para comprobarlo.',
  );
};

defineBrowserRows({
  story: 'US-NC-TABLERO-007',
  surface: 'web',
  tenants: [TENANT_A],
  handlers: new Map<number, BrowserRowHandler>([
    [1, onWeb(filterRow)],
    [2, onWeb(emptyColumnRow)],
    [3, onWeb(noMatchRow)],
    [4, onWeb(clearRow)],
  ]),
});
