import type { Page } from '@playwright/test';
import { NC_TESTIDS } from '../../../../packages/shared/src/testids';
import { TENANT_A } from '../../../story-runs/support/prepare';
import { defineBrowserRows, type BrowserRowHandler, type ManifestRow } from '../../core/framework';
import { cell, check, strict } from '../../support/checks';
import { ACTION } from '../../support/browser';
import { actionFailed, intercept, interact, sameSet, verdictWeb, withLimit, type WebAction } from '../web/common';
import { ERROR_TITLE, EMPTY_HINT, mobileCards, mobileColumn, mobileSettled, onMobile, prepareMobile, readMobileCard, waitMobileBoard } from './common';

// US-NC-TABLERO-010 — Tablero de no conformidades en la app móvil (Expo web, 390 × 844). Preparación de cada fila: reinicio de
// alumno01 con el token de su administrador; gestor@sigpro.test inicia sesión en la app con alumno01 en «Tenant de trabajo» y abre
// la pestaña «No conformidades». Los filtros de severidad y de búsqueda se pidan al servidor; las tarjetas se comparan por conjunto.

const TITLE_CELLS: ReadonlyMap<string, string> = new Map<string, string>([
  ['Abierta', 'open'],
  ['Rechazada', 'rejected'],
]);

const COUNT_CELLS: ReadonlyMap<string, number> = new Map<string, number>([
  ['4', 4],
  ['2', 2],
]);

const NC_CODE_CELLS: ReadonlyMap<string, string> = new Map<string, string>([
  ['NC-003', 'NC-003'],
  ['NC-005', 'NC-005'],
]);

const SEVERITY_CELLS: ReadonlyMap<string, string> = new Map<string, string>([
  ['«Crítica»', 'Crítica'],
  ['«Mayor»', 'Mayor'],
]);

const PROGRAM_CELLS: ReadonlyMap<string, string> = new Map<string, string>([
  ['PRG-001', 'PRG-001'],
  ['PRG-002', 'PRG-002'],
]);

const COMMENTS_CELLS: ReadonlyMap<string, string> = new Map<string, string>([
  ['«3 comentarios»', '3 comentarios'],
  ['«1 comentario»', '1 comentario'],
]);

const ASSIGNEE_CELLS: ReadonlyMap<string, string> = new Map<string, string>([
  ['Andrés Molina', 'Andrés Molina'],
  ['«Sin asignar»', 'Sin asignar'],
]);

/** Acciones de la celda «accion»: elegir una severidad en el control de chips, o escribir en el buscador. */
const ACTIONS: ReadonlyMap<string, WebAction> = new Map<string, WebAction>([
  ['elige la severidad «Crítica»', (page: Page) => interact(page.getByRole('radio', { name: 'Crítica', exact: true }), 'elegir la severidad «Crítica»', (element) => element.click(ACTION))],
  ['elige la severidad «Menor»', (page: Page) => interact(page.getByRole('radio', { name: 'Menor', exact: true }), 'elegir la severidad «Menor»', (element) => element.click(ACTION))],
  ['escribe nc-01 en «Buscar no conformidades»', (page: Page) => interact(page.getByRole('textbox', { name: 'Buscar no conformidades', exact: true }), 'escribir nc-01 en «Buscar no conformidades»', (element) => element.fill('nc-01', ACTION))],
]);

const RECOUNT_CELLS: ReadonlyMap<string, string> = new Map<string, string>([
  ['«4 de 12 no conformidades»', '4 de 12 no conformidades'],
  ['«3 de 12 no conformidades»', '3 de 12 no conformidades'],
]);

const CODES_CELLS: ReadonlyMap<string, readonly string[]> = new Map<string, readonly string[]>([
  ['NC-003, NC-006, NC-009 y NC-012', ['NC-003', 'NC-006', 'NC-009', 'NC-012']],
  ['NC-001, NC-004, NC-007 y NC-010', ['NC-001', 'NC-004', 'NC-007', 'NC-010']],
  ['NC-010, NC-011 y NC-012', ['NC-010', 'NC-011', 'NC-012']],
]);

const TEXT_CELLS: ReadonlyMap<string, string> = new Map<string, string>([['zzzz-no-existe', 'zzzz-no-existe']]);

const HTTP_CELLS: ReadonlyMap<string, number> = new Map<string, number>([
  ['500', 500],
  ['503', 503],
]);

const GESTOR = 'gestor@sigpro.test';
const LIST_PATH = '/api/nc';

// --- Esquema 1: cada columna lleva su título y el número de tarjetas ----------------------------------------------------------

const columnRow: BrowserRowHandler = async (row: ManifestRow, { page }) => {
  const state = strict('titulo', TITLE_CELLS, cell(row, 'titulo'));
  const count = strict('contador', COUNT_CELLS, cell(row, 'contador'));
  const expected = `la columna «${cell(row, 'titulo')}» muestra el contador ${count}`;
  const failed = await prepareMobile(page, GESTOR, expected);
  if (failed !== undefined) return failed;

  const view = await waitMobileBoard(page, mobileSettled);
  const column = view === undefined ? undefined : mobileColumn(view, state);
  return verdictWeb([
    check(column?.label === `${cell(row, 'titulo')} · ${count}`, `columna «${cell(row, 'titulo')} · ${count}»`, `columna «${column?.label ?? '(sin leer)'}»`),
    check(column?.count === String(count), `contador ${count}`, `contador ${column?.count ?? '(sin leer)'}`),
  ]);
};

// --- Esquema 2: cada tarjeta muestra su severidad, programa, comentarios y responsable ----------------------------------

const cardRow: BrowserRowHandler = async (row: ManifestRow, { page }) => {
  const code = strict('codigo', NC_CODE_CELLS, cell(row, 'codigo'));
  const severity = strict('severidad', SEVERITY_CELLS, cell(row, 'severidad'));
  const program = strict('programa', PROGRAM_CELLS, cell(row, 'programa'));
  const comments = strict('comentarios', COMMENTS_CELLS, cell(row, 'comentarios'));
  const assignee = strict('responsable', ASSIGNEE_CELLS, cell(row, 'responsable'));
  const expected = `la tarjeta ${code} muestra la severidad ${severity}, el programa ${program}, el comentario ${comments} y el responsable ${assignee}`;
  const failed = await prepareMobile(page, GESTOR, expected);
  if (failed !== undefined) return failed;

  await waitMobileBoard(page, mobileSettled);
  const card = await readMobileCard(page, code);
  return verdictWeb([
    check(card?.present === true, `tarjeta ${code}`, card?.present === true ? `tarjeta ${code}` : `tarjeta ${code} no está en el tablero`),
    check(card?.severity === severity, `severidad ${severity}`, `severidad ${card?.severity ?? '(sin leer)'}`),
    check(card?.program === program, `programa ${program}`, `programa ${card?.program ?? '(sin código de programa en la tarjeta)'}`),
    check(card?.comments === comments, `comentario ${comments}`, `comentario ${card?.comments ?? '(sin leer)'}`),
    check(card?.assignee === assignee, `responsable ${assignee}`, `responsable ${card?.assignee ?? '(sin leer)'}`),
  ]);
};

// --- Esquema 3: la severidad y la búsqueda acotan el tablero ----------------------------------------------------------------

const filterRow: BrowserRowHandler = async (row: ManifestRow, { page }) => {
  const action = strict('accion', ACTIONS, cell(row, 'accion'));
  const recount = strict('recuento', RECOUNT_CELLS, cell(row, 'recuento'));
  const codes = strict('codigos', CODES_CELLS, cell(row, 'codigos'));
  const expected = `tras «${cell(row, 'accion')}» el recuento dice ${cell(row, 'recuento')} y las tarjetas que se ven son ${cell(row, 'codigos')}`;
  const failed = await prepareMobile(page, GESTOR, expected);
  if (failed !== undefined) return failed;

  const acted = await action(page);
  if (acted !== undefined) return actionFailed(expected, acted);
  const view = await waitMobileBoard(page, (current) => current.total === recount);
  const onScreen = view === undefined ? [] : mobileCards(view);
  return verdictWeb(
    [
      check(view?.total === recount, `recuento «${recount}»`, `recuento «${view?.total ?? '(sin leer)'}»`),
      check(view !== undefined && sameSet(onScreen, codes), `tarjetas ${cell(row, 'codigos')}`, `tarjetas ${onScreen.join(', ') || '(ninguna)'}`),
    ],
    'Las tarjetas se comparan como conjunto: el orden de la app móvil va por columna y la historia no fija el orden entre columnas.',
  );
};

// --- Esquema 4: un texto sin coincidencias muestra el aviso de filtro vacío -----------------------------------------------

const noMatchRow: BrowserRowHandler = async (row: ManifestRow, { page }) => {
  const text = strict('texto', TEXT_CELLS, cell(row, 'texto'));
  const expected = `tras escribir ${cell(row, 'texto')} en «Buscar no conformidades» ve el aviso «${EMPTY_HINT}»`;
  const failed = await prepareMobile(page, GESTOR, expected);
  if (failed !== undefined) return failed;

  const typed = await interact(page.getByRole('textbox', { name: 'Buscar no conformidades', exact: true }), 'escribir zzzz-no-existe en «Buscar no conformidades»', (element) => element.fill(text, ACTION));
  if (typed !== undefined) return actionFailed(expected, typed);
  const view = await waitMobileBoard(page, (current) => current.emptyLines.includes(EMPTY_HINT));
  return verdictWeb([check(view?.emptyLines.includes(EMPTY_HINT) === true, `aviso «${EMPTY_HINT}»`, `aviso ${view?.emptyLines.find((line) => line.startsWith('Ninguna')) ?? '(no aparece)'}`)]);
};

// --- Esquema 5: un fallo de la lista muestra el aviso con «Reintentar» ----------------------------------------------------

const failureRow: BrowserRowHandler = async (row: ManifestRow, { page }) => {
  const status = strict('codigo_http', HTTP_CELLS, cell(row, 'codigo_http'));
  const expected = `ve el aviso «${ERROR_TITLE}» con el botón «Reintentar»`;
  const holder: { hits?: () => readonly string[] } = {};
  const failed = await prepareMobile(page, GESTOR, expected, async () => {
    const interception = await intercept(page, 'GET', LIST_PATH, { kind: 'failFirst', status });
    holder.hits = interception.hits;
  });
  if (failed !== undefined) return failed;

  const view = await waitMobileBoard(page, (current) => current.errorText !== undefined);
  const retry = await withLimit(page.getByTestId(NC_TESTIDS.NC_ERROR_RETRY).textContent({ timeout: 2_000 }), null);
  const hits = holder.hits?.() ?? [];
  return verdictWeb(
    [
      check(view?.errorText?.includes(ERROR_TITLE) === true, `aviso «${ERROR_TITLE}»`, `aviso ${view?.errorText === undefined ? '(no aparece)' : view.errorText.slice(0, 80)}`),
      check(retry?.trim() === 'Reintentar', 'botón «Reintentar»', `botón «${retry?.trim() ?? '(sin leer)'}»`),
    ],
    `Peticiones a ${LIST_PATH}: ${hits.join(' | ') || '(ninguna)'}. Expo web no es nativo.`,
  );
};

defineBrowserRows({
  story: 'US-NC-TABLERO-010',
  surface: 'expo-web',
  tenants: [TENANT_A],
  handlers: new Map<number, BrowserRowHandler>([
    [1, onMobile(columnRow)],
    [2, onMobile(cardRow)],
    [3, onMobile(filterRow)],
    [4, onMobile(noMatchRow)],
    [5, onMobile(failureRow)],
  ]),
});
