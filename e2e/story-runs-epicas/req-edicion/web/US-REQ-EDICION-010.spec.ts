import type { Page } from '@playwright/test';
import { defineBrowserRows, notExecutable, type BrowserRowHandler, type Outcome } from '../../core/framework';
import { ACTION, quoted } from '../../support/browser';
import { cell, check, preparationFailedWeb, strict, type Check } from '../../support/checks';
import { field } from '../../../story-runs/support/api';
import { ACCOUNT_OF, TENANT_A, act, codeCell, codesOf, itemsOf, loginAs, resetTenants, verdict } from '../api/common';
import { REQUISITOS_DYNAMIC_TESTIDS } from '../../../../packages/shared/src/testids';
import { armDragLog, actionFailed, inOrder, interact, menuItem, noOkToast, onWeb, openRequirements, performDrag, rowMenuOf, rowOf, settle, signIn, stateCheck, toastShown, tree, type AccountName, type UiRow, uiChildrenOf, uiRootsOf, uiRowsIn } from './common';

// US-REQ-EDICION-010 — Reordenar con Subir, Bajar, el teclado y arrastrando (web, escritorio 1440 px). Preparación de cada fila: reinicio
// de alumno01, inicio de sesión en /login?tenant=alumno01 y apertura de /programs/PRG-001/requirements con el árbol desplegado. El orden
// que se comprueba es el de la API (hermanos por posición) y el de la UI (filas del árbol en orden del DOM), las dos a la vez.
// «elige la fila» se implementa como foco en la fila del árbol (no hay clic de selección en esta acción).

/** Padre de los hermanos que se comprueban: `null` son las raíces de PRG-001; «REQ-001» sus hijos. */
type Parent = null | 'REQ-001';

/** Códigos de los hermanos de un padre en orden de posición, leídos por la API (cuenta gestor). */
const orderOf = async (parent: Parent): Promise<readonly string[] | undefined> => {
  const session = await loginAs(strict('cuenta', ACCOUNT_OF, 'gestor@sigpro.test'));
  if (session.token === undefined) return undefined;
  const items = itemsOf(await act('GET', '/programs/PRG-001/requirements', session.token));
  if (items === undefined) return undefined;
  return items
    .filter((item) => (field(item, 'parentCode') ?? null) === parent)
    .sort((a, b) => Number(field(a, 'position')) - Number(field(b, 'position')))
    .map((item) => String(field(item, 'code')));
};

/** Preparación común: reinicio, inicio de sesión y apertura del árbol. Con `expanded`, exige que REQ-001 esté desplegado. */
const prepare = async (page: Page, account: AccountName, expected: string, expanded = false): Promise<Outcome | undefined> => {
  await resetTenants([TENANT_A]);
  const failure = (await signIn(page, account)) ?? (await openRequirements(page));
  if (failure !== undefined) return preparationFailedWeb(expected, failure);
  if (!expanded) return undefined;
  const state = await page.getByTestId(REQUISITOS_DYNAMIC_TESTIDS.REQUIREMENT_ROW('REQ-001')).getAttribute('aria-expanded', { timeout: 2_000 }).catch(() => null);
  return state === 'true' ? undefined : preparationFailedWeb(expected, `el árbol de REQ-001 no está desplegado (aria-expanded ${String(state)})`);
};

/** Orden de las raíces en la UI y en la API, en el mismo momento (dos lecturas de lo mismo). */
const rootsReading = async (page: Page, expected: readonly string[], label: string): Promise<readonly Check[]> => {
  const apiOrder = await orderOf(null);
  const uiRows: readonly UiRow[] = await uiRowsIn(tree(page), 'treeitem');
  const uiOrder = uiRootsOf(uiRows);
  const same = (observed: readonly string[] | undefined): boolean => observed !== undefined && JSON.stringify(observed) === JSON.stringify(expected);
  return [
    check(same(apiOrder), `${label} ${expected.join(', ')} (API)`, `${label} ${apiOrder === undefined ? '(sin leer)' : apiOrder.join(', ')} (API)`),
    check(same(uiOrder), `${label} ${expected.join(', ')} (pantalla)`, `${label} ${uiOrder.length === 0 ? '(sin filas)' : uiOrder.join(', ')} (pantalla)`),
  ];
};

/** Orden de los hijos de REQ-001 en la UI y en la API. */
const childrenReading = async (page: Page, expected: readonly string[]): Promise<readonly Check[]> => {
  const apiOrder = await orderOf('REQ-001');
  const uiOrder = uiChildrenOf(await uiRowsIn(tree(page), 'treeitem'), 'REQ-001');
  const same = (observed: readonly string[] | undefined): boolean => observed !== undefined && JSON.stringify(observed) === JSON.stringify(expected);
  return [
    check(same(apiOrder), `los hijos de REQ-001 quedan ${expected.join(', ')} (API)`, `los hijos de REQ-001 quedan ${apiOrder === undefined ? '(sin leer)' : apiOrder.join(', ')} (API)`),
    check(same(uiOrder), `los hijos de REQ-001 quedan ${expected.join(', ')} (pantalla)`, `los hijos de REQ-001 quedan ${uiOrder.length === 0 ? '(sin filas)' : uiOrder.join(', ')} (pantalla)`),
  ];
};

// --- Esquema 1: Subir y bajar en el menú mueve el requisito entre sus hermanos -----------------------------------------

const MENU_OPTION_OF: ReadonlyMap<string, string> = new Map([
  ['«Subir»', 'Subir'],
  ['«Bajar»', 'Bajar'],
]);

const menuMoves: BrowserRowHandler = async (row, { page }) => {
  const code = codeCell(cell(row, 'codigo'));
  const option = strict('opción', MENU_OPTION_OF, cell(row, 'opcion'));
  const wanted = codesOf(cell(row, 'orden'));
  const expected = `aviso «Orden actualizado» con «${code} se movió»; las raíces de PRG-001 quedan ${wanted.join(', ')}`;
  const failure = await prepare(page, 'gestor', expected);
  if (failure !== undefined) return failure;
  const blocked = await inOrder(
    (current) => interact(rowMenuOf(current, code), `abrir «Acciones para ${code}»`, (element) => element.click(ACTION)),
    (current) => interact(menuItem(current, code, option), `elegir «${option}»`, (element) => element.click(ACTION)),
  )(page);
  if (blocked !== undefined) return actionFailed(expected, blocked);
  const toast = await toastShown(page, 'ok', 'Orden actualizado', `${code} se movió`);
  return verdict([check(toast.seen, `aviso «Orden actualizado» con «${code} se movió»`, `aviso ${toast.observed}`), ...(await rootsReading(page, wanted, 'las raíces de PRG-001 quedan'))]);
};

// --- Esquema 2: los extremos del orden no se pueden mover ---------------------------------------------------------------

const EXTREME_OF: ReadonlyMap<string, { readonly option: string }> = new Map([
  ['«Subir»', { option: 'Subir' }],
  ['«Bajar»', { option: 'Bajar' }],
]);

const extremesDisabled: BrowserRowHandler = async (row, { page }) => {
  const code = codeCell(cell(row, 'codigo'));
  const want = strict('opción', EXTREME_OF, cell(row, 'opcion'));
  const reason = quoted(cell(row, 'motivo'));
  const expected = `«${want.option}» de ${code} está deshabilitado con la explicación «${reason}»`;
  const failure = await prepare(page, 'gestor', expected);
  if (failure !== undefined) return failure;
  const opened = await interact(rowMenuOf(page, code), `abrir «Acciones para ${code}»`, (element) => element.click(ACTION));
  if (opened !== undefined) return actionFailed(expected, opened);
  return verdict([await stateCheck(menuItem(page, code, want.option), 'deshabilitado', reason)]);
};

// --- Esquema 3: el teclado mueve la fila elegida entre sus hermanos -----------------------------------------------------

const KEY_OF: ReadonlyMap<string, string> = new Map([
  ['Alt más flecha arriba', 'Alt+ArrowUp'],
  ['Alt más flecha abajo', 'Alt+ArrowDown'],
]);

const keyboardMoves: BrowserRowHandler = async (row, { page }) => {
  const code = codeCell(cell(row, 'codigo'));
  const key = strict('tecla', KEY_OF, cell(row, 'tecla'));
  const wanted = codesOf(cell(row, 'orden'));
  const expected = `los hijos de REQ-001 quedan ${wanted.join(', ')}`;
  const failure = await prepare(page, 'gestor', expected, true);
  if (failure !== undefined) return failure;
  const blocked = await inOrder(
    (current) => interact(rowOf(current, code), `elegir la fila de ${code} (foco)`, (element) => element.focus(ACTION)),
    async (current) => {
      try {
        await current.keyboard.press(key);
        return undefined;
      } catch (error) {
        return { message: `no se pudo pulsar ${key}: ${String(error)}`, note: 'el teclado no llegó a la fila' };
      }
    },
  )(page);
  if (blocked !== undefined) return actionFailed(expected, blocked);
  await settle();
  const toastShownNow = await toastShown(page, 'ok', 'Orden actualizado', `${code} se movió`);
  return verdict([...(await childrenReading(page, wanted)), check(toastShownNow.seen, `aviso «Orden actualizado» con «${code} se movió»`, `aviso ${toastShownNow.observed}`)], 'La fila se elige con el foco del árbol (no hay selección por clic en esta acción).');
};

// --- Esquema 4: arrastrar y soltar reordena solo entre hermanos ---------------------------------------------------------

/** Fracción de la altura de la fila destino donde se suelta: cuarto superior, inferior o centro. */
const DROP_ZONE_OF: ReadonlyMap<string, number> = new Map([
  ['en el cuarto superior', 0.1],
  ['en el cuarto inferior', 0.9],
  ['en la zona central', 0.5],
  ['en cualquier zona', 0.5],
]);

/** Resultado esperado: el padre del grupo y el orden que debe quedar, o `null` si nada cambia. */
interface DropResult {
  readonly parent: Parent;
  readonly order: readonly string[] | null;
}

const DROP_RESULT_OF: ReadonlyMap<string, DropResult> = new Map<string, DropResult>([
  ['las raíces de PRG-001 quedan REQ-011, REQ-001, REQ-006', { parent: null, order: ['REQ-011', 'REQ-001', 'REQ-006'] }],
  ['las raíces de PRG-001 quedan REQ-006, REQ-011, REQ-001', { parent: null, order: ['REQ-006', 'REQ-011', 'REQ-001'] }],
  ['los hijos de REQ-001 quedan REQ-003, REQ-002, REQ-005', { parent: 'REQ-001', order: ['REQ-003', 'REQ-002', 'REQ-005'] }],
  ['ningún orden cambia y no aparece el aviso «Orden actualizado»', { parent: null, order: null }],
]);

const dragsWithinSiblings: BrowserRowHandler = async (row, { page }) => {
  const from = codeCell(cell(row, 'origen'));
  const to = codeCell(cell(row, 'destino'));
  const zone = strict('zona', DROP_ZONE_OF, cell(row, 'zona'));
  const result = strict('resultado', DROP_RESULT_OF, cell(row, 'resultado'));
  const expected = cell(row, 'resultado');
  const failure = await prepare(page, 'gestor', expected, true);
  if (failure !== undefined) return failure;
  const rootsBefore = uiRootsOf(await uiRowsIn(tree(page), 'treeitem'));
  const apiRootsBefore = await orderOf(null);
  // Se arma el registro de arrastres antes del gesto: un arrastre que no arranca no es un hallazgo sobre la app
  await armDragLog(page);
  const endedAt0 = Date.now();
  const drag = await performDrag(page, from, to, zone);
  if (!('started' in drag)) return actionFailed(expected, drag);
  if (!drag.started) {
    return notExecutable(expected, `el gesto de arrastrar no arranca en el arnés: no hay «dragstart» sobre la fila de ${from} (el puntero no inicia el arrastre)`);
  }
  await settle();
  const quiet = await noOkToast(page, endedAt0);
  const toast = await toastShown(page, 'ok', 'Orden actualizado', `${from} se movió`);
  const apiRootsAfter = await orderOf(null);
  const uiRootsAfter = uiRootsOf(await uiRowsIn(tree(page), 'treeitem'));
  const measured = `arrastre medido: dragstart sobre ${from}; marca «${drag.dropOnTarget}» en ${to} con el puntero (punto en la fila: ${drag.pointerOnTarget ? 'sí' : 'no'}); raíces API ${apiRootsAfter?.join(', ') ?? '(sin leer)'}; pantalla ${uiRootsAfter.join(', ')}`;
  const checks: Check[] = [];
  if (result.order === null) {
    checks.push(check(JSON.stringify(apiRootsAfter) === JSON.stringify(apiRootsBefore), `ningún orden cambia (API: ${apiRootsBefore?.join(', ') ?? '(sin leer)'})`, `API tras soltar: ${apiRootsAfter?.join(', ') ?? '(sin leer)'}`));
    checks.push(check(JSON.stringify(uiRootsAfter) === JSON.stringify(rootsBefore), `ningún orden cambia en pantalla (${rootsBefore.join(', ')})`, `pantalla tras soltar: ${uiRootsAfter.join(', ')}`));
    checks.push(check(quiet.held, 'no aparece el aviso «Orden actualizado»', quiet.held ? 'no aparece el aviso «Orden actualizado»' : `aparece ${quiet.seen}`));
  } else {
    checks.push(check(toast.seen, `aviso «Orden actualizado» con «${from} se movió»`, `aviso ${toast.observed}`));
    checks.push(...(await rootsReading(page, result.order, result.parent === null ? 'las raíces de PRG-001 quedan' : 'los hijos de REQ-001 quedan')));
  }
  return verdict(checks, measured);
};

// --- Esquema 5: un rol sin permiso de edición no reordena -----------------------------------------------------------------

const AUDITOR_OPTION_OF: ReadonlyMap<string, string> = new Map([
  ['«Subir»', 'Subir'],
  ['«Bajar»', 'Bajar'],
]);

const auditorCannotReorder: BrowserRowHandler = async (row, { page }) => {
  const code = codeCell(cell(row, 'codigo'));
  const option = strict('opción', AUDITOR_OPTION_OF, cell(row, 'opcion'));
  const expected = `«${option}» de ${code} está deshabilitado con «Tu rol no permite editar requisitos»; las raíces de PRG-001 siguen en el orden REQ-001, REQ-006, REQ-011`;
  const failure = await prepare(page, 'auditor', expected);
  if (failure !== undefined) return failure;
  const opened = await interact(rowMenuOf(page, code), `abrir «Acciones para ${code}»`, (element) => element.click(ACTION));
  if (opened !== undefined) return actionFailed(expected, opened);
  const state = await stateCheck(menuItem(page, code, option), 'deshabilitado', 'Tu rol no permite editar requisitos');
  return verdict([state, ...(await rootsReading(page, ['REQ-001', 'REQ-006', 'REQ-011'], 'las raíces de PRG-001 siguen en el orden'))]);
};

defineBrowserRows({
  story: 'US-REQ-EDICION-010',
  surface: 'web',
  tenants: [TENANT_A],
  handlers: new Map<number, BrowserRowHandler>([
    [1, onWeb(menuMoves)],
    [2, onWeb(extremesDisabled)],
    [3, onWeb(keyboardMoves)],
    [4, onWeb(dragsWithinSiblings)],
    [5, onWeb(auditorCannotReorder)],
  ]),
});
