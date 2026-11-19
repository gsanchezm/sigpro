import type { Page } from '@playwright/test';
import { defineBrowserRows, type BrowserRowHandler, type Outcome } from '../../core/framework';
import { ACTION, quoted } from '../../support/browser';
import { cell, check, preparationFailedWeb, strict, type Check } from '../../support/checks';
import { field } from '../../../story-runs/support/api';
import { ACCOUNT_OF, TENANT_A, act, codeCell, codesOf, itemsOf, loginAs, resetTenants, verdict } from '../api/common';
import { actionFailed, inOrder, interact, menuItem, noOkToast, onWeb, openRequirements, rowMenuOf, rowOf, settle, signIn, stateCheck, toastShown, type AccountName } from './common';

// US-REQ-EDICION-010 — Reordenar con Subir, Bajar, el teclado y arrastrando (web, escritorio 1440 px). Preparación de cada fila: reinicio
// de alumno01, inicio de sesión en /login?tenant=alumno01 y apertura de /programs/PRG-001/requirements con el árbol desplegado. El orden
// que se comprueba es el que guarda la API (hermanos por posición): lo que se ve en la pantalla no basta.

/** Padre de los hermanos que se comprueban: `null` son las raíces de PRG-001; «REQ-001» sus hijos. */
type Parent = null | 'REQ-001';

/** Códigos de los hermanos de un padre, en orden de posición, leídos por la API (cuenta gestor). */
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

/** Preparación común: reinicio, inicio de sesión, apertura del árbol. */
const prepare = async (page: Page, account: AccountName, expected: string): Promise<Outcome | undefined> => {
  await resetTenants([TENANT_A]);
  const failure = (await signIn(page, account)) ?? (await openRequirements(page));
  return failure === undefined ? undefined : preparationFailedWeb(expected, failure);
};

/** Lista esperada de la celda «orden» («REQ-006, REQ-001, REQ-011»): cada código pasa por `codeCell`. */
const expectedOrder = (text: string): readonly string[] => codesOf(text);

/** Comprueba que el orden de los hermanos de `parent` es el esperado, leído por la API. */
const orderCheck = async (parent: Parent, expected: readonly string[], label: string): Promise<Check> => {
  const observed = await orderOf(parent);
  return check(observed !== undefined && JSON.stringify(observed) === JSON.stringify(expected), `${label} ${expected.join(', ')}`, `${label} ${observed === undefined ? '(sin leer)' : observed.join(', ')}`);
};

// --- Esquema 1: Subir y bajar en el menú mueve el requisito entre sus hermanos ------------------------------------------

const MENU_OPTION_OF: ReadonlyMap<string, string> = new Map([
  ['«Subir»', 'Subir'],
  ['«Bajar»', 'Bajar'],
]);

const menuMoves: BrowserRowHandler = async (row, { page }) => {
  const code = codeCell(cell(row, 'codigo'));
  const option = strict('opción', MENU_OPTION_OF, cell(row, 'opcion'));
  const expected = `aviso «Orden actualizado» con «${code} se movió»; las raíces de PRG-001 quedan ${cell(row, 'orden')}`;
  const failure = await prepare(page, 'gestor', expected);
  if (failure !== undefined) return failure;
  const blocked = await inOrder(
    (current) => interact(rowMenuOf(current, code), `abrir «Acciones para ${code}»`, (element) => element.click(ACTION)),
    (current) => interact(menuItem(current, code, option), `elegir «${option}»`, (element) => element.click(ACTION)),
  )(page);
  if (blocked !== undefined) return actionFailed(expected, blocked);
  const toast = await toastShown(page, 'ok', 'Orden actualizado', `${code} se movió`);
  const roots = await orderCheck(null, expectedOrder(cell(row, 'orden')), 'las raíces de PRG-001 quedan');
  return verdict([check(toast.seen, `aviso «Orden actualizado» con «${code} se movió»`, `aviso ${toast.observed}`), roots]);
};

// --- Esquema 2: los extremos del orden no se pueden mover -----------------------------------------------------------------

const EXTREME_OF: ReadonlyMap<string, { readonly option: string; readonly reason: string }> = new Map([
  ['«Subir»', { option: 'Subir', reason: 'Ya es el primero de su nivel' }],
  ['«Bajar»', { option: 'Bajar', reason: 'Ya es el último de su nivel' }],
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
  const expected = `los hijos de REQ-001 quedan ${cell(row, 'orden')}`;
  const failure = await prepare(page, 'gestor', expected);
  if (failure !== undefined) return failure;
  const blocked = await inOrder(
    (current) => interact(rowOf(current, code), `elegir la fila de ${code}`, (element) => element.focus(ACTION)),
    (current) => current.keyboard.press(key).then(() => undefined, (error: unknown) => ({ message: `no se pudo pulsar ${key}: ${String(error)}`, note: 'el teclado no llegó a la fila' })),
  )(page);
  if (blocked !== undefined) return actionFailed(expected, blocked);
  await settle();
  const children = await orderCheck('REQ-001', expectedOrder(cell(row, 'orden')), 'los hijos de REQ-001 quedan');
  const toast = await toastShown(page, 'ok', 'Orden actualizado', `${code} se movió`);
  return verdict([children, check(toast.seen, `aviso «Orden actualizado» con «${code} se movió»`, `aviso ${toast.observed}`)]);
};

// --- Esquema 4: arrastrar y soltar reordena solo entre hermanos -----------------------------------------------------------

/** Punto de la fila destino donde se suelta (fracción de su altura): cuarto superior, inferior o centro. */
const DROP_RATIO_OF: ReadonlyMap<string, number> = new Map([
  ['en el cuarto superior', 0.1],
  ['en el cuarto inferior', 0.9],
  ['en la zona central', 0.5],
  ['en cualquier zona', 0.5],
]);

/** Resultado esperado: el padre y el orden que deben quedar, o que nada cambia. */
interface DropResult {
  readonly parent: Parent;
  readonly order?: readonly string[];
}

const DROP_RESULT_OF: ReadonlyMap<string, DropResult> = new Map<string, DropResult>([
  ['las raíces de PRG-001 quedan REQ-011, REQ-001, REQ-006', { parent: null, order: ['REQ-011', 'REQ-001', 'REQ-006'] }],
  ['las raíces de PRG-001 quedan REQ-006, REQ-011, REQ-001', { parent: null, order: ['REQ-006', 'REQ-011', 'REQ-001'] }],
  ['los hijos de REQ-001 quedan REQ-003, REQ-002, REQ-005', { parent: 'REQ-001', order: ['REQ-003', 'REQ-002', 'REQ-005'] }],
  ['ningún orden cambia y no aparece el aviso «Orden actualizado»', { parent: null }],
]);

const dragsWithinSiblings: BrowserRowHandler = async (row, { page }) => {
  const from = codeCell(cell(row, 'origen'));
  const to = codeCell(cell(row, 'destino'));
  const zone = strict('zona', DROP_RATIO_OF, cell(row, 'zona'));
  const result = strict('resultado', DROP_RESULT_OF, cell(row, 'resultado'));
  const expected = cell(row, 'resultado');
  const failure = await prepare(page, 'gestor', expected);
  if (failure !== undefined) return failure;
  const beforeRoots = await orderOf(null);
  const beforeChildren = await orderOf('REQ-001');
  const endedAt = Date.now();
  const dropped = await interact(rowOf(page, from), `arrastrar ${from} sobre ${to}`, async (element) => {
    const target = rowOf(page, to);
    const box = await target.boundingBox({ timeout: 2_000 });
    if (box === null) throw new Error(`la fila ${to} no tiene caja visible`);
    await element.dragTo(target, { targetPosition: { x: Math.round(box.width / 2), y: Math.round(box.height * zone) }, timeout: 10_000 });
  });
  if (dropped !== undefined) return actionFailed(expected, dropped);
  await settle();
  const checks: Check[] = [];
  if (result.order === undefined) {
    const quiet = await noOkToast(page, endedAt);
    const roots = await orderOf(null);
    const children = await orderOf('REQ-001');
    checks.push(check(JSON.stringify(roots) === JSON.stringify(beforeRoots) && JSON.stringify(children) === JSON.stringify(beforeChildren), 'ningún orden cambia', 'ningún orden cambia'));
    checks.push(check(quiet.held, 'no aparece el aviso «Orden actualizado»', quiet.held ? 'no aparece el aviso «Orden actualizado»' : `aparece ${quiet.seen}`));
  } else {
    const toast = await toastShown(page, 'ok', 'Orden actualizado', `${from} se movió`);
    checks.push(check(toast.seen, `aviso «Orden actualizado» con «${from} se movió»`, `aviso ${toast.observed}`));
    checks.push(await orderCheck(result.parent, result.order, result.parent === null ? 'las raíces de PRG-001 quedan' : 'los hijos de REQ-001 quedan'));
  }
  return verdict(checks);
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
  const roots = await orderCheck(null, ['REQ-001', 'REQ-006', 'REQ-011'], 'las raíces de PRG-001 siguen en el orden');
  return verdict([state, roots]);
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
