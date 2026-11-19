import type { Page } from '@playwright/test';
import { defineBrowserRows, type BrowserRowHandler } from '../../core/framework';
import { cell, check, conclude, preparationFailedWeb, strict } from '../../support/checks';
import { quoted, safe, waitUntil } from '../../support/browser';
import { TENANT_A, resetTenants } from '../../../story-runs/support/prepare';
import {
  accountOf,
  actionFailed,
  bulkBar,
  bulkCount,
  chooseStatus,
  clickIn,
  headerCheckbox,
  inOrder,
  nextPageButton,
  normalized,
  onWeb,
  signIn,
  toggleHeader,
  toggleRow,
  type WebAction,
} from './common';

// US-PROG-GESTION-005 — Selección con casillas en la web (escritorio, 1440 px). Preparación de cada fila: reinicio de alumno01 con
// el token de su administrador, inicio de sesión de la cuenta de la fila y llegada a /programs sin filtros.

const DESKTOP = 'escritorio' as const;

/** Estado de la casilla de cabecera: marcada, desmarcada o parcial (su propiedad `indeterminate`). */
const headerState = (page: Page): Promise<string> =>
  safe(
    () =>
      headerCheckbox(page).evaluate((element) => {
        const box = element as HTMLInputElement;
        return box.indeterminate ? 'parcial' : box.checked ? 'marcada' : 'desmarcada';
      }),
    '(sin leer)',
  );

/** Marca PRG-002 y PRG-003 (el punto de partida de los Esquemas 2 y 3). */
const markTwo: WebAction = inOrder(toggleRow('PRG-002', true), toggleRow('PRG-003', true));

// --- Esquema 1: el contador cuenta las filas marcadas y la cabecera refleja la página -----------------------------------------

const SELECTIONS: ReadonlyMap<string, WebAction> = new Map<string, WebAction>([
  ['marca «Seleccionar todos los programas de la página»', toggleHeader(true)],
  ['marca «Seleccionar» de PRG-002 y de PRG-003', markTwo],
  ['marca «Seleccionar» de PRG-002', toggleRow('PRG-002', true)],
  ['marca «Seleccionar todos los programas de la página» y después desmarca «Seleccionar» de PRG-002', inOrder(toggleHeader(true), toggleRow('PRG-002', false))],
]);

const countAndHeader: BrowserRowHandler = async (row, { page }) => {
  await resetTenants([TENANT_A]);
  const contador = quoted(cell(row, 'contador'));
  const expected = `la barra dice «${contador}» y la cabecera queda ${cell(row, 'cabecera')}`;
  const prepared = await signIn(page, DESKTOP, 'gestor');
  if (prepared !== undefined) return preparationFailedWeb(expected, prepared);
  const blocked = await strict('accion', SELECTIONS, cell(row, 'accion'))(page);
  if (blocked !== undefined) return actionFailed(expected, blocked);
  await waitUntil(async () => (await normalized(bulkCount(page))) === contador);
  const count = await normalized(bulkCount(page));
  const header = await headerState(page);
  return conclude([
    check(count === contador, `la barra dice «${contador}»`, `la barra dice «${count ?? '(sin barra)'}»`),
    check(header === cell(row, 'cabecera'), `la cabecera queda ${cell(row, 'cabecera')}`, `la cabecera queda ${header}`),
  ]);
};

// --- Esquema 2: cambiar la página, un filtro o el orden, o quitar la selección, vacía la selección ----------------------------

const CLEARING: ReadonlyMap<string, WebAction> = new Map<string, WebAction>([
  ['pulsa «Página siguiente»', clickIn(nextPageButton, 'pulsar «Página siguiente»')],
  ['elige «En pausa» en «Estado»', chooseStatus('En pausa')],
  ['pulsa «Nombre» en la cabecera de la tabla', clickIn((page) => page.getByRole('table').getByRole('button', { name: 'Nombre', exact: true }), 'pulsar «Nombre» en la cabecera')],
  ['pulsa «Quitar selección» en la barra de acciones masivas', clickIn((page) => bulkBar(page).getByRole('button', { name: 'Quitar selección', exact: true }), 'pulsar «Quitar selección» en la barra')],
]);

const clearsSelection: BrowserRowHandler = async (row, { page }) => {
  await resetTenants([TENANT_A]);
  const expected = `la barra de acciones masivas ${cell(row, 'barra')}`;
  const prepared = await signIn(page, DESKTOP, 'gestor');
  if (prepared !== undefined) return preparationFailedWeb(expected, prepared);
  const marked = await markTwo(page);
  if (marked !== undefined) return actionFailed(expected, marked);
  const ready = await waitUntil(async () => (await normalized(bulkCount(page))) === '2 seleccionados');
  if (!ready.reached) return preparationFailedWeb(expected, 'la barra no dice «2 seleccionados» tras marcar PRG-002 y PRG-003');
  const blocked = await strict('accion', CLEARING, cell(row, 'accion'))(page);
  if (blocked !== undefined) return actionFailed(expected, blocked);
  // La barra debe desaparecer: la reacción es local (se espera hasta el techo de la prueba)
  const gone = await waitUntil(async () => (await safe(() => bulkBar(page).isVisible(), false)) === false);
  return conclude([check(gone.reached, 'la barra de acciones masivas no aparece', gone.reached ? 'la barra de acciones masivas no aparece' : 'la barra de acciones masivas sigue visible')]);
};

// --- Esquema 3: todos los roles pueden marcar programas con casillas --------------------------------------------------------------

const everyRole: BrowserRowHandler = async (row, { page }) => {
  await resetTenants([TENANT_A]);
  const expected = 'la barra de acciones masivas dice «2 seleccionados»';
  const prepared = await signIn(page, DESKTOP, accountOf(cell(row, 'cuenta')));
  if (prepared !== undefined) return preparationFailedWeb(expected, prepared);
  const marked = await markTwo(page);
  if (marked !== undefined) return actionFailed(expected, marked);
  await waitUntil(async () => (await normalized(bulkCount(page))) === '2 seleccionados');
  const count = await normalized(bulkCount(page));
  return conclude([check(count === '2 seleccionados', 'la barra dice «2 seleccionados»', `la barra dice «${count ?? '(sin barra)'}»`)]);
};

defineBrowserRows({
  story: 'US-PROG-GESTION-005',
  surface: 'web',
  tenants: [TENANT_A],
  handlers: new Map<number, BrowserRowHandler>([
    [1, onWeb(countAndHeader)],
    [2, onWeb(clearsSelection)],
    [3, onWeb(everyRole)],
  ]),
});
