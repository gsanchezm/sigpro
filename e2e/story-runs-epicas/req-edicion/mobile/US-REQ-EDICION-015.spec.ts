import { defineBrowserRows, type BrowserRowHandler } from '../../core/framework';
import { ACTION, quoted, safe, waitUntil } from '../../support/browser';
import { cell, check, strict, type Check } from '../../support/checks';
import { ACCOUNT_OF, TENANT_A, act, codeCell, loginAs, resetTenants, verdict } from '../api/common';
import { interact, toastShown, type WebAction } from '../web/common';
import { ACCOUNT_CREDENTIALS, cardOf, deleteDialog, mobileStateCheck, onExpoWeb, openSheet, outcomeOf, prepareMobile, sheet, sheetButton, textVisible } from './common';
import { REQUISITOS_TESTIDS } from '../../../../packages/shared/src/testids';

// US-REQ-EDICION-015 — Eliminar un requisito desde la hoja (app móvil, Expo web 390 px). Preparación de cada fila: reinicio de alumno01, la
// app en /login con alumno01 en «Tenant de trabajo», inicio de sesión de la cuenta de la fila y apertura de la hoja de REQ-004 o de REQ-006.

/** «Eliminar» de la hoja abierta. */
const pressDelete: WebAction = (page) => interact(sheetButton(page, 'Eliminar'), 'pulsar «Eliminar» en la hoja', (element) => element.click(ACTION));

/** Botón de la confirmación de borrado («Eliminar» o «Cancelar»). */
const confirm = (name: string): WebAction => (page) => interact(deleteDialog(page).getByRole('button', { name, exact: true }), `pulsar «${name}» en la confirmación`, (element) => element.click(ACTION));

/** Descendientes (códigos que se llevan consigo) de cada requisito de la historia. */
const SUBTREE_OF: ReadonlyMap<string, readonly string[]> = new Map([
  ['REQ-004', ['REQ-004']],
  ['REQ-006', ['REQ-006', 'REQ-007', 'REQ-008', 'REQ-009', 'REQ-010']],
]);

/** Cuenta de la fila (gestor o alumno01) con sus credenciales. */
const ACCOUNT_OF_ROW: ReadonlyMap<string, typeof ACCOUNT_CREDENTIALS.gestor> = new Map([
  ['gestor@sigpro.test', ACCOUNT_CREDENTIALS.gestor],
  ['alumno01@sigpro.lab', ACCOUNT_CREDENTIALS.alumno01],
  ['consultor@sigpro.test', ACCOUNT_CREDENTIALS.consultor],
]);

/** Texto de la confirmación según el requisito de la fila. */
const CONFIRM_TEXT_OF: ReadonlyMap<string, string> = new Map([
  ['«REQ-004 se eliminará de forma permanente.»', 'REQ-004 se eliminará de forma permanente.'],
  ['«REQ-006 y sus 4 requisitos descendientes se eliminarán de forma permanente.»', 'REQ-006 y sus 4 requisitos descendientes se eliminarán de forma permanente.'],
]);

/** Código de un requisito de la historia (validado) y sus descendientes. */
const subtreeOf = (code: string): readonly string[] => strict('subárbol', SUBTREE_OF, codeCell(code));

/** Estado de un requisito por la API con la cuenta gestor (404 si no existe). */
const statusOf = async (code: string): Promise<number | undefined> => {
  const session = await loginAs(strict('cuenta', ACCOUNT_OF, 'gestor@sigpro.test'));
  return session.token === undefined ? undefined : (await act('GET', `/requirements/${code}`, session.token)).status;
};

// --- Esquema 1: la confirmación dice cuántos descendientes se llevan ----------------------------------------------------------

const confirmationText: BrowserRowHandler = async (row, { page }) => {
  await resetTenants([TENANT_A]);
  const code = codeCell(cell(row, 'codigo'));
  const text = strict('texto', CONFIRM_TEXT_OF, cell(row, 'texto'));
  const expected = `confirmación «Eliminar requisito» con el texto «${text}» y los botones «Eliminar» y «Cancelar»`;
  const failure = await prepareMobile(page, ACCOUNT_CREDENTIALS.gestor, expected);
  if (failure !== undefined) return failure;
  const steps: WebAction[] = [openSheet(code), pressDelete];
  for (const step of steps) {
    const blocked = await step(page);
    if (blocked !== undefined) return outcomeOf([check(false, expected, blocked.message)], blocked.note);
  }
  const shown = await waitUntil(() => textVisible(page, text));
  const buttons = await Promise.all(['Eliminar', 'Cancelar'].map((name) => safe(() => deleteDialog(page).getByRole('button', { name, exact: true }).isVisible({ timeout: 1_000 }), false)));
  return verdict([
    check(shown.reached, `la confirmación dice «${text}»`, shown.reached ? `la confirmación dice «${text}»` : `la confirmación no dice «${text}»`),
    check(buttons.every(Boolean), 'puede elegir «Eliminar» o «Cancelar»', `botones visibles: ${buttons.map((ok) => (ok ? 'sí' : 'no')).join(', ')}`),
  ]);
};

// --- Esquema 2: confirmar borra el requisito con sus descendientes y cierra la hoja -------------------------------------

const confirmDeletes: BrowserRowHandler = async (row, { page }) => {
  await resetTenants([TENANT_A]);
  const code = codeCell(cell(row, 'codigo'));
  const notice = quoted(cell(row, 'aviso'));
  const expected = `la hoja se cierra; aviso «Requisito eliminado» con «${notice}»; ya no aparecen ${code} ni sus descendientes`;
  const failure = await prepareMobile(page, ACCOUNT_CREDENTIALS.gestor, expected);
  if (failure !== undefined) return failure;
  const steps: WebAction[] = [openSheet(code), pressDelete, confirm('Eliminar')];
  for (const step of steps) {
    const blocked = await step(page);
    if (blocked !== undefined) return outcomeOf([check(false, expected, blocked.message)], blocked.note);
  }
  const toast = await toastShown(page, 'ok', 'Requisito eliminado', notice);
  const closed = await waitUntil(async () => !(await safe(() => sheet(page).isVisible(), false)));
  const cards: Check[] = [];
  for (const entry of subtreeOf(code)) {
    const visible = await safe(() => cardOf(page, entry).isVisible({ timeout: 1_000 }), true);
    cards.push(check(visible === false, `${entry} ya no aparece en la lista`, visible === false ? `${entry} ya no aparece en la lista` : `${entry} sigue en la lista`));
  }
  const statuses = await Promise.all(subtreeOf(code).map(statusOf));
  return verdict([
    check(toast.seen, `aviso «Requisito eliminado» con «${notice}»`, `aviso ${toast.observed}`),
    check(closed.reached, 'la hoja se cierra', closed.reached ? 'la hoja se cierra' : 'la hoja sigue abierta'),
    ...cards,
    check(statuses.every((status) => status === 404), `la API responde 404 a ${subtreeOf(code).join(', ')}`, `la API responde ${statuses.map((status) => String(status ?? '(sin leer)')).join(', ')}`),
  ]);
};

// --- Esquema 3: cancelar la confirmación no borra nada ------------------------------------------------------------------

const cancelKeeps: BrowserRowHandler = async (row, { page }) => {
  await resetTenants([TENANT_A]);
  const expected = 'la confirmación se cierra, la hoja de REQ-004 sigue abierta y REQ-004 sigue en la lista';
  const credentials = strict('cuenta', ACCOUNT_OF_ROW, cell(row, 'cuenta'));
  const failure = await prepareMobile(page, credentials, expected);
  if (failure !== undefined) return failure;
  const steps: WebAction[] = [openSheet('REQ-004'), pressDelete, confirm('Cancelar')];
  for (const step of steps) {
    const blocked = await step(page);
    if (blocked !== undefined) return outcomeOf([check(false, expected, blocked.message)], blocked.note);
  }
  const closed = await waitUntil(async () => !(await safe(() => deleteDialog(page).isVisible(), false)));
  const sheetOpen = await safe(() => sheet(page).isVisible(), false);
  const status = await statusOf('REQ-004');
  return verdict([
    check(closed.reached, 'la confirmación se cierra', closed.reached ? 'la confirmación se cierra' : 'la confirmación sigue abierta'),
    check(sheetOpen, 'la hoja de REQ-004 sigue abierta', sheetOpen ? 'la hoja de REQ-004 sigue abierta' : 'la hoja se cerró'),
    check(status === 200, 'REQ-004 sigue en la lista', `REQ-004 responde ${status ?? '(sin leer)'}`),
  ]);
};

// --- Esquema 4: solo admin y gestor pueden eliminar desde la hoja -------------------------------------------------------

const DELETE_STATE_OF: ReadonlyMap<string, { readonly enabled: boolean; readonly reason?: string }> = new Map([
  ['está habilitado', { enabled: true }],
  ['está deshabilitado con la explicación «Solo admin y gestor pueden eliminar requisitos»', { enabled: false, reason: 'Solo admin y gestor pueden eliminar requisitos' }],
]);

const onlyAdminAndManager: BrowserRowHandler = async (row, { page }) => {
  await resetTenants([TENANT_A]);
  const want = strict('estado', DELETE_STATE_OF, cell(row, 'estado'));
  const expected = want.enabled ? '«Eliminar» de la hoja de REQ-004 está habilitado' : `«Eliminar» de la hoja de REQ-004 está deshabilitado con «${want.reason ?? ''}»`;
  const failure = await prepareMobile(page, strict('cuenta', ACCOUNT_OF_ROW, cell(row, 'cuenta')), expected);
  if (failure !== undefined) return failure;
  const opened = await openSheet('REQ-004')(page);
  if (opened !== undefined) return outcomeOf([check(false, expected, opened.message)], opened.note);
  const state = await mobileStateCheck(sheetButton(page, 'Eliminar').or(page.getByTestId(REQUISITOS_TESTIDS.REQUIREMENT_MENU_DELETE)), want.enabled ? 'habilitado' : 'deshabilitado', want.reason);
  return verdict([state]);
};

defineBrowserRows({
  story: 'US-REQ-EDICION-015',
  surface: 'expo-web',
  tenants: [TENANT_A],
  handlers: new Map<number, BrowserRowHandler>([
    [1, onExpoWeb(confirmationText)],
    [2, onExpoWeb(confirmDeletes)],
    [3, onExpoWeb(cancelKeeps)],
    [4, onExpoWeb(onlyAdminAndManager)],
  ]),
});
