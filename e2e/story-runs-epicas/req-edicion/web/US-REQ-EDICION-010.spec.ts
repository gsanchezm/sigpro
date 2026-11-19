import type { Page } from '@playwright/test';
import { defineBrowserRows, notExecutable, type BrowserRowHandler, type Outcome } from '../../core/framework';
import { ACTION, quoted } from '../../support/browser';
import { cell, check, preparationFailedWeb, strict, type Check } from '../../support/checks';
import { field } from '../../../story-runs/support/api';
import { ACCOUNT_OF, TENANT_A, act, codeCell, codesOf, itemsOf, loginAs, resetTenants, verdict } from '../api/common';
import { REQUISITOS_DYNAMIC_TESTIDS } from '../../../../packages/shared/src/testids';
import { armDragLog, actionFailed, inOrder, interact, menuItem, noOkToast, onWeb, openRequirements, performDrag, pollApi, rowMenuOf, rowOf, signIn, stateCheck, toastShown, tree, uiChildrenOf, uiRootsOf, uiRowsIn, type AccountName } from './common';

// US-REQ-EDICION-010 — Reordenar con Subir, Bajar, el teclado y arrastrando (web, escritorio 1440 px). Preparación de cada fila: reinicio
// de alumno01, inicio de sesión en /login?tenant=alumno01 y apertura de /programs/PRG-001/requirements con el árbol desplegado.
// Reglas de lectura: (1) la API y la pantalla se leen DESPUÉS del aviso de la acción (o de la ventana de silencio si no hay aviso) y se
// sondean hasta que el orden coincide (techo 5 s), para no adelantarse a la respuesta; (2) el padre se elige por fila: raíces (padre null)
// o hijos de REQ-001, tanto en API como en pantalla.
// «elige la fila» se implementa como foco en la fila del árbol (no hay clic de selección en esta acción).

/** Padre de los hermanos que se comprueban: `null` son las raíces de PRG-001; «REQ-001» sus hijos. */
type Parent = null | 'REQ-001';

/** Códigos de los hermanos de un padre en orden de posición, según la API (cuenta gestor); `undefined` si no se puede leer. */
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

/** Orden de los hermanos según la PANTALLA: raíces (padre null) o hijos de REQ-001, en orden del DOM. */
const uiOrderOf = async (page: Page, parent: Parent): Promise<readonly string[]> => {
  const rows = await uiRowsIn(tree(page), 'treeitem');
  return parent === null ? uiRootsOf(rows) : uiChildrenOf(rows, 'REQ-001');
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

/** Comprobaciones de un orden (API y pantalla) del padre dado. Se sondea hasta que coincida (techo 5 s): nunca se adelanta a la acción. */
const orderChecks = async (page: Page, parent: Parent, expected: readonly string[], label?: string): Promise<readonly Check[]> => {
  const text = label ?? (parent === null ? 'las raíces de PRG-001 quedan' : 'los hijos de REQ-001 quedan');
  const matches = (observed: readonly string[] | undefined): boolean => observed !== undefined && JSON.stringify(observed) === JSON.stringify(expected);
  const api = await pollApi(() => orderOf(parent), matches);
  const ui = await pollApi(() => uiOrderOf(page, parent), (observed) => JSON.stringify(observed) === JSON.stringify(expected));
  return [
    check(api.reached, `${text} ${expected.join(', ')} (API)`, `${text} ${api.value === undefined ? '(sin leer)' : api.value.join(', ')} (API)`),
    check(ui.reached, `${text} ${expected.join(', ')} (pantalla)`, `${text} ${ui.value.length === 0 ? '(sin filas)' : ui.value.join(', ')} (pantalla)`),
  ];
};

/** Instantánea del orden de las raíces y de los hijos de REQ-001, en API y en pantalla. */
interface Snapshot {
  readonly roots: readonly string[] | undefined;
  readonly children: readonly string[] | undefined;
  readonly uiRoots: readonly string[];
  readonly uiChildren: readonly string[];
}

const snapshotOf = async (page: Page): Promise<Snapshot> => ({
  roots: await orderOf(null),
  children: await orderOf('REQ-001'),
  uiRoots: await uiOrderOf(page, null),
  uiChildren: await uiOrderOf(page, 'REQ-001'),
});

/** Dos instantáneas iguales en API y en pantalla: «ningún orden cambia». La observación es lo medido en ambas. */
const unchangedChecks = (before: Snapshot, after: Snapshot): Check[] => {
  const same = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b);
  return [
    check(
      same(before.roots, after.roots) && same(before.children, after.children),
      `ningún orden cambia en la API (raíces ${before.roots?.join(', ') ?? '(sin leer)'}; hijos de REQ-001 ${before.children?.join(', ') ?? '(sin leer)'})`,
      `API tras soltar: raíces ${after.roots?.join(', ') ?? '(sin leer)'}; hijos de REQ-001 ${after.children?.join(', ') ?? '(sin leer)'}`,
    ),
    check(
      same(before.uiRoots, after.uiRoots) && same(before.uiChildren, after.uiChildren),
      `ningún orden cambia en pantalla (raíces ${before.uiRoots.join(', ')}; hijos de REQ-001 ${before.uiChildren.join(', ')})`,
      `pantalla tras soltar: raíces ${after.uiRoots.join(', ')}; hijos de REQ-001 ${after.uiChildren.join(', ')}`,
    ),
  ];
};

// --- Esquema 1: Subir y bajar en el menú mueve el requisito entre sus hermanos ----------------------------------------------

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
  // Primero el aviso (la respuesta de la API ya llegó) y LUEGO la lectura del orden
  const toast = await toastShown(page, 'ok', 'Orden actualizado', `${code} se movió`);
  return verdict([check(toast.seen, `aviso «Orden actualizado» con «${code} se movió»`, `aviso ${toast.observed}`), ...(await orderChecks(page, null, wanted))]);
};

// --- Esquema 2: los extremos del orden no se pueden mover --------------------------------------------------------------

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

// --- Esquema 3: el teclado mueve la fila elegida entre sus hermanos -------------------------------------------------------

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
  // Primero el aviso y LUEGO la lectura de los hijos (API y pantalla)
  const toast = await toastShown(page, 'ok', 'Orden actualizado', `${code} se movió`);
  return verdict([check(toast.seen, `aviso «Orden actualizado» con «${code} se movió»`, `aviso ${toast.observed}`), ...(await orderChecks(page, 'REQ-001', wanted))], 'La fila se elige con el foco del árbol (no hay selección por clic en esta acción).');
};

// --- Esquema 4: arrastrar y soltar reordena solo entre hermanos ----------------------------------------------------------

/** Fracción de la altura de la fila destino donde se suelta: cuarto superior, inferior o centro. */
const DROP_ZONE_OF: ReadonlyMap<string, number> = new Map([
  ['en el cuarto superior', 0.1],
  ['en el cuarto inferior', 0.9],
  ['en la zona central', 0.5],
  ['en cualquier zona', 0.5],
]);

/** Resultado esperado: el padre del grupo afectado y el orden que debe quedar, o `null` si nada cambia. */
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
  const before = await snapshotOf(page);
  // Se arma el registro de arrastres antes del gesto: un arrastre que no arranca no es un hallazgo sobre la app
  await armDragLog(page);
  const endedAt = Date.now();
  const drag = await performDrag(page, from, to, zone);
  if (!('started' in drag)) return actionFailed(expected, drag);
  if (!drag.started) {
    return notExecutable(expected, `el gesto de arrastrar no arranca en el arnés: no hay «dragstart» sobre la fila de ${from} (el puntero no inicia el arrastre)`);
  }
  const measured = `arrastre medido: dragstart sobre ${from}; marca «${drag.dropOnTarget}» en ${to} con el puntero (punto en la fila: ${drag.pointerOnTarget ? 'sí' : 'no'})`;
  if (result.order === null) {
    // Nada debe cambiar: se espera la ventana de silencio y SOLO DESPUÉS se lee el orden (raíces e hijos de REQ-001, API y pantalla)
    const quiet = await noOkToast(page, endedAt);
    const after = await snapshotOf(page);
    return verdict([...unchangedChecks(before, after), check(quiet.held, 'no aparece el aviso «Orden actualizado»', quiet.held ? 'no aparece el aviso «Orden actualizado»' : `aparece ${quiet.seen}`)], measured);
  }
  // Se mueve: primero el aviso y LUEGO la lectura del padre de la fila (raíces o hijos de REQ-001, según la fila)
  const toast = await toastShown(page, 'ok', 'Orden actualizado', `${from} se movió`);
  const checks: Check[] = [check(toast.seen, `aviso «Orden actualizado» con «${from} se movió»`, `aviso ${toast.observed}`), ...(await orderChecks(page, result.parent, result.order))];
  return verdict(checks, measured);
};

// --- Esquema 5: un rol sin permiso de edición no reordena ---------------------------------------------------------------

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
  return verdict([state, ...(await orderChecks(page, null, ['REQ-001', 'REQ-006', 'REQ-011'], 'las raíces de PRG-001 siguen en el orden'))]);
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
