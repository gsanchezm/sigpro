import type { Locator, Page } from '@playwright/test';
import { defineBrowserRows, type BrowserRowHandler, type Outcome } from '../../core/framework';
import { ACTION, quoted, safe, waitUntil } from '../../support/browser';
import { cell, check, preparationFailedWeb, strict } from '../../support/checks';
import { field } from '../../../story-runs/support/api';
import { ACCOUNT_OF, TENANT_A, act, codeCell, itemsOf, loginAs, resetTenants, verdict } from '../api/common';
import { REQUISITOS_TESTIDS } from '../../../../packages/shared/src/testids';
import { ACCOUNT_BY_EMAIL, actionFailed, interact, inOrder, menuItem, onWeb, openRequirements, rowMenuOf, rowOf, signIn, stateCheck, toastShown, tree, uiRowsIn, type AccountName, type WebAction } from './common';

// US-REQ-EDICION-011 — Eliminar un requisito con su confirmación (web, escritorio 1440 px). Preparación de cada fila: reinicio de
// alumno01, inicio de sesión en /login?tenant=alumno01 y apertura de /programs/PRG-001/requirements. Estado del seed: REQ-004 no tiene
// descendientes; REQ-006 tiene cuatro (REQ-007, REQ-008, REQ-009 y REQ-010).

const DELETE_DIALOG = (page: Page): Locator => page.getByRole('alertdialog', { name: 'Eliminar requisito', exact: true }).or(page.getByTestId(REQUISITOS_TESTIDS.REQUIREMENT_DELETE_DIALOG));

/** Botón «Eliminar» o «Cancelar» del diálogo de confirmación. */
const confirmButton = (name: string): WebAction => (page) => interact(DELETE_DIALOG(page).getByRole('button', { name, exact: true }), `pulsar «${name}» en el diálogo`, (element) => element.click(ACTION));

/** Abre el menú de la fila y elige «Eliminar». */
const chooseDelete = (code: string): WebAction =>
  inOrder(
    (page) => interact(rowMenuOf(page, code), `abrir «Acciones para ${code}»`, (element) => element.click(ACTION)),
    (page) => interact(menuItem(page, code, 'Eliminar'), `elegir «Eliminar» de ${code}`, (element) => element.click(ACTION)),
  );

/** Preparación común: reinicio, inicio de sesión y apertura del árbol. */
const prepare = async (page: Page, account: AccountName, expected: string): Promise<Outcome | undefined> => {
  await resetTenants([TENANT_A]);
  const failure = (await signIn(page, account)) ?? (await openRequirements(page));
  return failure === undefined ? undefined : preparationFailedWeb(expected, failure);
};

/** Códigos de PRG-001 leídos por la API (cuenta gestor), o `undefined` si no se pueden leer. */
const programCodes = async (): Promise<readonly string[] | undefined> => {
  const session = await loginAs(strict('cuenta', ACCOUNT_OF, 'gestor@sigpro.test'));
  if (session.token === undefined) return undefined;
  return itemsOf(await act('GET', '/programs/PRG-001/requirements', session.token))?.map((item) => String(field(item, 'code')));
};

/** Estado de un requisito por la API: 200 si existe, 404 si no. */
const existsStatus = async (code: string): Promise<number | undefined> => {
  const session = await loginAs(strict('cuenta', ACCOUNT_OF, 'gestor@sigpro.test'));
  return session.token === undefined ? undefined : (await act('GET', `/requirements/${code}`, session.token)).status;
};

// --- Esquema 1: eliminar pide confirmación y dice cuántos descendientes se llevan -----------------------------------------

const confirmsWithCount: BrowserRowHandler = async (row, { page }) => {
  const code = codeCell(cell(row, 'codigo'));
  const text = quoted(cell(row, 'texto'));
  const expected = `diálogo «Eliminar requisito» con el texto «${text}», botones «Eliminar» y «Cancelar», y nada eliminado`;
  const failure = await prepare(page, 'gestor', expected);
  if (failure !== undefined) return failure;
  const before = await programCodes();
  const blocked = await chooseDelete(code)(page);
  if (blocked !== undefined) return actionFailed(expected, blocked);
  const dialog = DELETE_DIALOG(page);
  const shown = await waitUntil(async () => safe(() => dialog.isVisible(), false));
  const textShown = await safe(() => dialog.getByText(text, { exact: true }).first().isVisible({ timeout: 1_000 }), false);
  const confirm = await safe(() => dialog.getByRole('button', { name: 'Eliminar', exact: true }).first().isVisible({ timeout: 500 }), false);
  const cancel = await safe(() => dialog.getByRole('button', { name: 'Cancelar', exact: true }).first().isVisible({ timeout: 500 }), false);
  const after = await programCodes();
  return verdict([
    check(shown.reached, 'el diálogo «Eliminar requisito» está abierto', shown.reached ? 'el diálogo «Eliminar requisito» está abierto' : 'el diálogo no aparece'),
    check(textShown, `el diálogo dice «${text}»`, textShown ? `el diálogo dice «${text}»` : `el diálogo no dice «${text}»`),
    check(confirm && cancel, 'tiene los botones «Eliminar» y «Cancelar»', `botones: Eliminar ${confirm ? 'sí' : 'no'}, Cancelar ${cancel ? 'sí' : 'no'}`),
    check(before !== undefined && after !== undefined && JSON.stringify(before) === JSON.stringify(after), 'todavía no se ha eliminado nada', before === undefined || after === undefined ? 'lista no legible' : JSON.stringify(before) === JSON.stringify(after) ? 'todavía no se ha eliminado nada' : 'ya se ha eliminado algo'),
  ]);
};

// --- Esquema 2: cancelar cierra el diálogo y el requisito sigue en el árbol -----------------------------------------------

const cancelKeeps: BrowserRowHandler = async (row, { page }) => {
  const code = codeCell(cell(row, 'codigo'));
  const expected = `el diálogo se cierra y ${code} sigue en el árbol con todos sus requisitos`;
  const failure = await prepare(page, 'gestor', expected);
  if (failure !== undefined) return failure;
  const before = await programCodes();
  const blocked = await inOrder(chooseDelete(code), confirmButton('Cancelar'))(page);
  if (blocked !== undefined) return actionFailed(expected, blocked);
  const closed = await waitUntil(async () => !(await safe(() => DELETE_DIALOG(page).isVisible(), false)));
  const stillInTree = await safe(() => rowOf(page, code).isVisible({ timeout: 1_000 }), false);
  const after = await programCodes();
  return verdict([
    check(closed.reached, 'el diálogo se cierra', closed.reached ? 'el diálogo se cierra' : 'el diálogo sigue abierto'),
    check(stillInTree, `${code} sigue en el árbol`, stillInTree ? `${code} sigue en el árbol` : `${code} no aparece en el árbol`),
    check(before !== undefined && after !== undefined && JSON.stringify(before) === JSON.stringify(after), 'todos los requisitos siguen', before === undefined || after === undefined ? 'lista no legible' : JSON.stringify(before) === JSON.stringify(after) ? 'todos los requisitos siguen' : 'faltan requisitos'),
  ]);
};

// --- Esquema 3: eliminar quita el requisito y sus descendientes del árbol -------------------------------------------------

/** Códigos que desaparecen con cada requisito (el requisito y sus descendientes, según la historia). */
const SUBTREE_OF: ReadonlyMap<string, readonly string[]> = new Map([
  ['REQ-004', ['REQ-004']],
  ['REQ-006', ['REQ-006', 'REQ-007', 'REQ-008', 'REQ-009', 'REQ-010']],
]);

const deletesSubtree: BrowserRowHandler = async (row, { page }) => {
  const code = codeCell(cell(row, 'codigo'));
  const notice = `${code} eliminado`;
  const expected = `aviso «Requisito eliminado» con «${notice}»; ya no aparecen ${code} ni sus descendientes; el resto de PRG-001 sigue`;
  const failure = await prepare(page, 'gestor', expected);
  if (failure !== undefined) return failure;
  const subtree = strict('subárbol', SUBTREE_OF, code);
  const before = await programCodes();
  const blocked = await inOrder(chooseDelete(code), confirmButton('Eliminar'))(page);
  if (blocked !== undefined) return actionFailed(expected, blocked);
  const toast = await toastShown(page, 'ok', 'Requisito eliminado', notice);
  // Se espera a que la lista esté cargada: sin filas no se puede afirmar que algo desapareció
  const loaded = await waitUntil(async () => (await uiRowsIn(tree(page), 'treeitem')).length > 0);
  const onScreen = await uiRowsIn(tree(page), 'treeitem');
  const gone = subtree.map((entry) => onScreen.length > 0 && !onScreen.some((row) => row.code === entry));
  const after = await programCodes();
  const apiGone = await Promise.all(subtree.map((entry) => existsStatus(entry)));
  const rest = (before ?? []).filter((entry) => !subtree.includes(entry));
  return verdict([
    check(toast.seen, `aviso «Requisito eliminado» con «${notice}»`, `aviso ${toast.observed}`),
    check(loaded.reached && gone.every(Boolean), `ya no aparecen ${subtree.join(', ')}`, !loaded.reached ? 'la lista no se cargó' : gone.every(Boolean) ? `ya no aparecen ${subtree.join(', ')}` : `siguen en el árbol: ${subtree.filter((_, i) => !gone[i]).join(', ')}`),
    check(apiGone.every((status) => status === 404), `la API responde 404 para ${subtree.join(', ')}`, `la API responde ${apiGone.map((status) => String(status ?? '(sin leer)')).join(', ')}`),
    check(after !== undefined && JSON.stringify(after) === JSON.stringify(rest), `el resto de PRG-001 sigue (${rest.length} requisitos)`, after === undefined ? 'lista no legible' : `PRG-001 tiene ${after.length} requisitos`),
  ]);
};

// --- Esquema 4: solo admin y gestor pueden eliminar ---------------------------------------------------------------------

const DELETE_STATE_OF: ReadonlyMap<string, { readonly enabled: boolean; readonly reason?: string }> = new Map([
  ['está habilitado', { enabled: true }],
  ['está deshabilitado con la explicación «Solo admin y gestor pueden eliminar requisitos»', { enabled: false, reason: 'Solo admin y gestor pueden eliminar requisitos' }],
]);

const onlyAdminAndManager: BrowserRowHandler = async (row, { page }) => {
  const account = strict('cuenta', ACCOUNT_BY_EMAIL, cell(row, 'cuenta'));
  const want = strict('estado', DELETE_STATE_OF, cell(row, 'estado'));
  const expected = want.enabled ? '«Eliminar» del menú de REQ-004 está habilitado' : `«Eliminar» del menú de REQ-004 está deshabilitado con «${want.reason ?? ''}»`;
  const failure = await prepare(page, account, expected);
  if (failure !== undefined) return failure;
  const opened = await interact(rowMenuOf(page, 'REQ-004'), 'abrir «Acciones para REQ-004»', (element) => element.click(ACTION));
  if (opened !== undefined) return actionFailed(expected, opened);
  const item: Locator = menuItem(page, 'REQ-004', 'Eliminar');
  return verdict([await stateCheck(item, want.enabled ? 'habilitado' : 'deshabilitado', want.reason)]);
};

defineBrowserRows({
  story: 'US-REQ-EDICION-011',
  surface: 'web',
  tenants: [TENANT_A],
  handlers: new Map<number, BrowserRowHandler>([
    [1, onWeb(confirmsWithCount)],
    [2, onWeb(cancelKeeps)],
    [3, onWeb(deletesSubtree)],
    [4, onWeb(onlyAdminAndManager)],
  ]),
});
