import type { Page } from '@playwright/test';
import { defineBrowserRows, type BrowserRowHandler, type Outcome } from '../../core/framework';
import { cell, check, conclude, preparationFailedWeb, strict } from '../../support/checks';
import { isFocused, isVisible, quoted, waitUntil } from '../../support/browser';
import { TENANT_A, resetTenants } from '../../../story-runs/support/prepare';
import {
  type Blocked,
  actionFailed,
  bulkButton,
  codesOf,
  deleteDialog,
  dialogButton,
  inOrder,
  listedCodes,
  normalized,
  onWeb,
  openRowActions,
  pressAction,
  recountText,
  signIn,
  toastShown,
  toggleRow,
  type WebAction,
} from './common';

// US-PROG-GESTION-008 — Diálogo de confirmación del borrado de programas (web, escritorio 1440 px). Preparación de cada fila:
// reinicio de alumno01 con el token de su administrador, inicio de sesión de admin@sigpro.test con el segundo factor y llegada a
// /programs sin filtros.

const DESKTOP = 'escritorio' as const;
const DESCRIPTION = '#delete-desc';

/** Cómo se pide el borrado: desde el menú de la fila de PRG-001, o desde la barra con los programas de la fila marcados. */
const VIAS: ReadonlyMap<string, (programas: string) => WebAction> = new Map<string, (programas: string) => WebAction>([
  ['su menú de acciones', () => inOrder(openRowActions('PRG-001'), pressAction(DESKTOP, 'PRG-001', 'Eliminar'))],
  ['la barra de acciones masivas, con esos dos programas marcados', (programas) => inOrder(...codesOf(programas).map((code) => toggleRow(code, true)), bulkButton('Eliminar'))],
]);

/** Texto del diálogo (la descripción) normalizado, o `undefined` si no hay diálogo. */
const dialogText = (page: Page): Promise<string | undefined> => normalized(deleteDialog(page).locator(DESCRIPTION));

/** Abre el diálogo: espera a que aparezca; si no aparece, el Outcome lo dice. */
const openDialog = async (page: Page, expected: string, open: WebAction): Promise<{ readonly failure?: Outcome }> => {
  const blocked: Blocked | undefined = await open(page);
  if (blocked !== undefined) return { failure: actionFailed(expected, blocked) };
  const shown = await waitUntil(() => isVisible(deleteDialog(page)));
  if (!shown.reached) return { failure: actionFailed(expected, { message: 'no se abrió el diálogo «Eliminar programa»', note: 'La acción de borrar no abrió el diálogo de confirmación.' }) };
  return {};
};

// --- Esquema 1: el diálogo nombra lo que se va a borrar según el número de programas -----------------------------------------

const namesWhat: BrowserRowHandler = async (row, { page }) => {
  await resetTenants([TENANT_A]);
  const texto = quoted(cell(row, 'texto'));
  const expected = `el diálogo «Eliminar programa» dice «${texto}» y el foco está en «Eliminar»`;
  const prepared = await signIn(page, DESKTOP, 'admin');
  if (prepared !== undefined) return preparationFailedWeb(expected, prepared);
  const via = strict('via', VIAS, cell(row, 'via'))(cell(row, 'programas'));
  const opened = await openDialog(page, expected, via);
  if (opened.failure) return opened.failure;
  const observed = await dialogText(page);
  const focusing = await waitUntil(() => isFocused(deleteDialog(page).getByRole('button', { name: 'Eliminar', exact: true })));
  const focused = focusing.reached;
  return conclude([
    check(observed === texto, `el diálogo dice «${texto}»`, `el diálogo dice «${observed ?? '(sin texto)'}»`),
    check(focused, 'el foco está en «Eliminar»', focused ? 'el foco está en «Eliminar»' : 'el foco no está en «Eliminar»'),
  ]);
};

// --- Esquema 2: cancelar o Esc cierran el diálogo sin borrar nada -------------------------------------------------------------

const SALIDAS: ReadonlyMap<string, WebAction> = new Map<string, WebAction>([
  ['«Cancelar»', dialogButton('Cancelar')],
  [
    'la tecla Esc',
    async (page) => {
      try {
        await page.keyboard.press('Escape');
        return undefined;
      } catch (error) {
        return { message: `no se pudo pulsar Esc: ${error instanceof Error ? (error.message.split('\n')[0] ?? '') : String(error)}`, note: 'La tecla Esc no llegó al diálogo.' };
      }
    },
  ],
]);

const cancelsWithoutDeleting: BrowserRowHandler = async (row, { page }) => {
  await resetTenants([TENANT_A]);
  const expected = 'el diálogo se cierra; PRG-001 sigue en la lista y el recuento dice «1–10 de 24»';
  const prepared = await signIn(page, DESKTOP, 'admin');
  if (prepared !== undefined) return preparationFailedWeb(expected, prepared);
  const opened = await openDialog(page, expected, inOrder(openRowActions('PRG-001'), pressAction(DESKTOP, 'PRG-001', 'Eliminar')));
  if (opened.failure) return opened.failure;
  const left = await strict('salida', SALIDAS, cell(row, 'salida'))(page);
  if (left !== undefined) return actionFailed(expected, left);
  const closed = await waitUntil(async () => !(await isVisible(deleteDialog(page))));
  await waitUntil(async () => (await listedCodes(page, DESKTOP)).includes('PRG-001'));
  const codes = await listedCodes(page, DESKTOP);
  const count = await recountText(page);
  return conclude([
    check(closed.reached, 'el diálogo se cierra', closed.reached ? 'el diálogo se cierra' : 'el diálogo sigue abierto'),
    check(codes.includes('PRG-001'), 'PRG-001 sigue en la lista', codes.includes('PRG-001') ? 'PRG-001 sigue en la lista' : 'PRG-001 ya no está en la lista'),
    check(count === '1–10 de 24', 'el recuento dice «1–10 de 24»', `el recuento dice «${count ?? '(sin recuento)'}»`),
  ]);
};

// --- Esquema 3: eliminar en el diálogo borra el programa y avisa del resultado ----------------------------------------------

const confirmsDelete: BrowserRowHandler = async (row, { page }) => {
  await resetTenants([TENANT_A]);
  const aviso = quoted(cell(row, 'aviso'));
  const expected = `el diálogo se cierra; aviso de éxito «${aviso}» y recuento «${cell(row, 'recuento')}»`;
  const prepared = await signIn(page, DESKTOP, 'admin');
  if (prepared !== undefined) return preparationFailedWeb(expected, prepared);
  const opened = await openDialog(page, expected, inOrder(openRowActions('PRG-001'), pressAction(DESKTOP, 'PRG-001', 'Eliminar')));
  if (opened.failure) return opened.failure;
  const confirmed = await dialogButton('Eliminar')(page);
  if (confirmed !== undefined) return actionFailed(expected, confirmed);
  const closed = await waitUntil(async () => !(await isVisible(deleteDialog(page))));
  const toast = await toastShown(page, 'ok', aviso);
  const count = await waitUntil(async () => (await recountText(page)) === cell(row, 'recuento'));
  const observed = await recountText(page);
  return conclude([
    check(closed.reached, 'el diálogo se cierra', closed.reached ? 'el diálogo se cierra' : 'el diálogo sigue abierto'),
    check(toast.seen, `aviso de éxito «${aviso}»`, `avisos de éxito: ${toast.observed}`),
    check(count.reached, `el recuento dice «${cell(row, 'recuento')}»`, `el recuento dice «${observed ?? '(sin recuento)'}»`),
  ]);
};

defineBrowserRows({
  story: 'US-PROG-GESTION-008',
  surface: 'web',
  tenants: [TENANT_A],
  handlers: new Map<number, BrowserRowHandler>([
    [1, onWeb(namesWhat)],
    [2, onWeb(cancelsWithoutDeleting)],
    [3, onWeb(confirmsDelete)],
  ]),
});
