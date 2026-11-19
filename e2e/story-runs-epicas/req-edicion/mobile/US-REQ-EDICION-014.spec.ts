import type { Page } from '@playwright/test';
import { defineBrowserRows, type BrowserRowHandler } from '../../core/framework';
import { ACTION, quoted, safe, waitUntil } from '../../support/browser';
import { cell, check, strict } from '../../support/checks';
import { field } from '../../../story-runs/support/api';
import { ACCOUNT_OF, TENANT_A, act, codeCell, codesOf, itemsOf, loginAs, resetTenants, verdict } from '../api/common';
import { interact, toastShown, type WebAction } from '../web/common';
import { ACCOUNT_CREDENTIALS, mobileStateCheck, onExpoWeb, openSheet, outcomeOf, prepareMobile, sheetButton } from './common';
import { MOVIL_REQUIREMENTS_TESTIDS } from '../../../../packages/shared/src/testids';

// US-REQ-EDICION-014 — Mover un requisito con «Mover a…» (app móvil, Expo web 390 px). Preparación de cada fila: reinicio de alumno01, la
// app en /login con alumno01 en «Tenant de trabajo», inicio de sesión de la cuenta y apertura de la hoja del requisito de la fila.

const MOVE_FORM = (page: Page) => page.getByTestId(MOVIL_REQUIREMENTS_TESTIDS.MOVE_FORM);

/** Abre «Mover a…» dentro de la hoja abierta. */
const openMove: WebAction = (page) => interact(sheetButton(page, 'Mover a…'), 'pulsar «Mover a…»', (element) => element.click(ACTION));

/** Elige una opción de un selector del formulario «Mover a…» por su texto visible. */
const choose = (label: string, option: string): WebAction => async (page) => {
  const opened = await interact(MOVE_FORM(page).getByRole('combobox', { name: label, exact: true }), `abrir «${label}»`, (element) => element.click(ACTION));
  if (opened !== undefined) return opened;
  return interact(page.getByRole('radio', { name: option, exact: true }), `elegir «${option}» en «${label}»`, (element) => element.click(ACTION));
};

/** Pulsa un botón del formulario «Mover a…» por su nombre. */
const formButton = (name: string): WebAction => (page) => interact(MOVE_FORM(page).getByRole('button', { name, exact: true }), `pulsar «${name}»`, (element) => element.click(ACTION));

/** Orden de los requisitos raíz de PRG-001, leído por la API con la cuenta gestor (undefined si no se puede leer). */
const rootsOrder = async (): Promise<readonly string[] | undefined> => {
  const session = await loginAs(strict('cuenta', ACCOUNT_OF, 'gestor@sigpro.test'));
  if (session.token === undefined) return undefined;
  const items = itemsOf(await act('GET', '/programs/PRG-001/requirements', session.token));
  return items
    ?.filter((item) => (field(item, 'parentCode') ?? null) === null)
    .sort((a, b) => Number(field(a, 'position')) - Number(field(b, 'position')))
    .map((item) => String(field(item, 'code')));
};

const ROOTS_BEFORE = ['REQ-001', 'REQ-006', 'REQ-011'];

// --- Esquema 1: mover coloca el requisito junto al hermano elegido ----------------------------------------------------------

const PLACEMENT_OF: ReadonlyMap<string, string> = new Map([
  ['«Después»', 'Después'],
  ['«Antes»', 'Antes'],
]);

const movesNextTo: BrowserRowHandler = async (row, { page }) => {
  await resetTenants([TENANT_A]);
  const code = codeCell(cell(row, 'codigo'));
  const expected = `aviso «Orden actualizado» con «${code} se movió»; las raíces de PRG-001 quedan ${cell(row, 'orden')}`;
  const failure = await prepareMobile(page, ACCOUNT_CREDENTIALS.gestor, expected);
  if (failure !== undefined) return failure;
  const placement = strict('colocar', PLACEMENT_OF, cell(row, 'colocar'));
  const steps: WebAction[] = [openSheet(code), openMove, choose('Junto a', quoted(cell(row, 'junto_a'))), choose('Colocar', placement), formButton('Mover')];
  for (const step of steps) {
    const blocked = await step(page);
    if (blocked !== undefined) return outcomeOf([check(false, expected, blocked.message)], blocked.note);
  }
  const toast = await toastShown(page, 'ok', 'Orden actualizado', `${code} se movió`);
  const roots = await rootsOrder();
  const wanted = codesOf(cell(row, 'orden'));
  return verdict([
    check(toast.seen, `aviso «Orden actualizado» con «${code} se movió»`, `aviso ${toast.observed}`),
    check(JSON.stringify(roots) === JSON.stringify(wanted), `las raíces de PRG-001 quedan ${wanted.join(', ')}`, `las raíces de PRG-001 quedan ${roots === undefined ? '(sin leer)' : roots.join(', ')}`),
  ]);
};

// --- Esquema 2: cancelar no cambia el orden ---------------------------------------------------------------------------------

const cancelKeepsOrder: BrowserRowHandler = async (row, { page }) => {
  await resetTenants([TENANT_A]);
  const expected = 'el formulario se cierra; las raíces de PRG-001 siguen en el orden REQ-001, REQ-006, REQ-011';
  const failure = await prepareMobile(page, ACCOUNT_CREDENTIALS.gestor, expected);
  if (failure !== undefined) return failure;
  const steps: WebAction[] = [openSheet('REQ-001'), openMove, choose('Junto a', quoted(cell(row, 'junto_a'))), formButton('Cancelar')];
  for (const step of steps) {
    const blocked = await step(page);
    if (blocked !== undefined) return outcomeOf([check(false, expected, blocked.message)], blocked.note);
  }
  const closed = await waitUntil(async () => !(await safe(() => MOVE_FORM(page).isVisible(), false)));
  const roots = await rootsOrder();
  return verdict([
    check(closed.reached, 'el formulario se cierra', closed.reached ? 'el formulario se cierra' : 'el formulario sigue abierto'),
    check(JSON.stringify(roots) === JSON.stringify(ROOTS_BEFORE), 'las raíces siguen en el orden REQ-001, REQ-006, REQ-011', `las raíces quedan ${roots === undefined ? '(sin leer)' : roots.join(', ')}`),
  ]);
};

// --- Esquema 3: un requisito sin hermanos o un rol sin permiso no se puede mover --------------------------------------------

const REASON_OF: ReadonlyMap<string, string> = new Map([
  ['«Es el único de su nivel: no hay con quién cambiar su posición.»', 'Es el único de su nivel: no hay con quién cambiar su posición.'],
  ['«Tu rol no permite editar requisitos»', 'Tu rol no permite editar requisitos'],
]);

/** Cuenta de la fila (gestor o auditor) con sus credenciales. */
const EDIT_ACCOUNT_OF: ReadonlyMap<string, typeof ACCOUNT_CREDENTIALS.gestor> = new Map([
  ['gestor@sigpro.test', ACCOUNT_CREDENTIALS.gestor],
  ['auditor@sigpro.test', ACCOUNT_CREDENTIALS.auditor],
]);

const cannotMove: BrowserRowHandler = async (row, { page }) => {
  await resetTenants([TENANT_A]);
  const code = codeCell(cell(row, 'codigo'));
  const reason = strict('motivo', REASON_OF, cell(row, 'motivo'));
  const expected = `«Mover a…» de ${code} está deshabilitado con la explicación «${reason}»`;
  const failure = await prepareMobile(page, strict('cuenta', EDIT_ACCOUNT_OF, cell(row, 'cuenta')), expected);
  if (failure !== undefined) return failure;
  const opened = await openSheet(code)(page);
  if (opened !== undefined) return outcomeOf([check(false, expected, opened.message)], opened.note);
  return verdict([await mobileStateCheck(sheetButton(page, 'Mover a…'), 'deshabilitado', reason)]);
};

defineBrowserRows({
  story: 'US-REQ-EDICION-014',
  surface: 'expo-web',
  tenants: [TENANT_A],
  handlers: new Map<number, BrowserRowHandler>([
    [1, onExpoWeb(movesNextTo)],
    [2, onExpoWeb(cancelKeepsOrder)],
    [3, onExpoWeb(cannotMove)],
  ]),
});
