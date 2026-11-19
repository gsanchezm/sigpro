import { defineBrowserRows, type BrowserRowHandler } from '../../core/framework';
import { cell, check, conclude, preparationFailedWeb, strict, type Check } from '../../support/checks';
import { waitUntil, isVisible } from '../../support/browser';
import { TENANT_A, resetTenants } from '../../../story-runs/support/prepare';
import {
  LAYOUTS,
  accountOf,
  actionFailed,
  deleteDialog,
  dialogButton,
  inOrder,
  listedCodes,
  onWeb,
  openRowActions,
  parseEnabled,
  pressAction,
  recountText,
  rowLines,
  signIn,
  stateCheck,
  stateOfRow,
  actionItem,
  toastShown,
  type Layout,
} from './common';

// US-PROG-GESTION-006 — Archivar, duplicar y eliminar desde el menú de cada programa (web). Escritorio (1440 px) y diseño
// responsive (390 px). Preparación de cada fila: reinicio de alumno01 con el token de su administrador, inicio de sesión de la
// cuenta de la fila y llegada a /programs sin filtros.

const NAME_OF_COPY = 'Sistema de mando táctico Ártemis (copia)';

// --- Esquema 1: cada rol ve habilitadas solo las acciones que su permiso permite -----------------------------------------------

const roleStates: BrowserRowHandler = async (row, { page }) => {
  await resetTenants([TENANT_A]);
  const layout: Layout = strict('diseño', LAYOUTS, cell(row, 'diseno'));
  const expected = 'Editar, Duplicar, Archivar y Eliminar con el estado que da su rol';
  const prepared = await signIn(page, layout, accountOf(cell(row, 'cuenta')));
  if (prepared !== undefined) return preparationFailedWeb(expected, prepared);
  const opened = await openRowActions('PRG-001')(page);
  if (opened !== undefined) return actionFailed(expected, opened);
  const results: Check[] = [];
  const items: ReadonlyArray<readonly [name: string, column: string]> = [
    ['Editar', 'editar'],
    ['Duplicar', 'duplicar'],
    ['Archivar', 'archivar'],
    ['Eliminar', 'eliminar'],
  ];
  for (const [name, column] of items) {
    const state = parseEnabled(cell(row, column));
    results.push(await stateCheck(actionItem(page, layout, 'PRG-001', name), state.enabled ? 'habilitado' : 'deshabilitado', state.reason));
  }
  return conclude(results);
};

// --- Esquema 2: archivar desde el menú cierra el programa y avisa del resultado -----------------------------------------------

const archiveFromMenu: BrowserRowHandler = async (row, { page }) => {
  await resetTenants([TENANT_A]);
  const layout: Layout = strict('diseño', LAYOUTS, cell(row, 'diseno'));
  const expected = 'aviso de éxito «PRG-001 archivado» y PRG-001 muestra «Cerrado»';
  const prepared = await signIn(page, layout, 'gestor');
  if (prepared !== undefined) return preparationFailedWeb(expected, prepared);
  const acted = await inOrder(openRowActions('PRG-001'), pressAction(layout, 'PRG-001', 'Archivar'))(page);
  if (acted !== undefined) return actionFailed(expected, acted);
  const toast = await toastShown(page, 'ok', 'PRG-001 archivado');
  await waitUntil(async () => (await stateOfRow(page, layout, 'PRG-001')) === 'Cerrado');
  const state = await stateOfRow(page, layout, 'PRG-001');
  return conclude([
    check(toast.seen, 'aviso de éxito «PRG-001 archivado»', `avisos de éxito: ${toast.observed}`),
    check(state === 'Cerrado', 'PRG-001 muestra el estado «Cerrado»', `PRG-001 muestra el estado «${state ?? '(sin estado)'}»`),
  ]);
};

// --- Esquema 3: duplicar desde el menú crea una copia en borrador y la muestra primera ----------------------------------------

const duplicateFromMenu: BrowserRowHandler = async (row, { page }) => {
  await resetTenants([TENANT_A]);
  const layout: Layout = strict('diseño', LAYOUTS, cell(row, 'diseno'));
  const expected = 'aviso «PRG-025 programa creado» con «Copia creada como borrador»; primera fila PRG-025 en «Borrador»; recuento «1–10 de 25»';
  const prepared = await signIn(page, layout, 'gestor');
  if (prepared !== undefined) return preparationFailedWeb(expected, prepared);
  const acted = await inOrder(openRowActions('PRG-001'), pressAction(layout, 'PRG-001', 'Duplicar'))(page);
  if (acted !== undefined) return actionFailed(expected, acted);
  const toast = await toastShown(page, 'ok', 'PRG-025 programa creado', 'Copia creada como borrador');
  await waitUntil(async () => (await listedCodes(page, layout))[0] === 'PRG-025');
  const first = (await listedCodes(page, layout))[0];
  const lines = await rowLines(page, layout, 'PRG-025');
  const state = await stateOfRow(page, layout, 'PRG-025');
  const count = await recountText(page);
  return conclude([
    check(toast.seen, 'aviso de éxito «PRG-025 programa creado» con «Copia creada como borrador»', `avisos de éxito: ${toast.observed}`),
    check(first === 'PRG-025', 'la primera fila es PRG-025', `la primera fila es ${first ?? '(ninguna)'}`),
    check(lines.includes(NAME_OF_COPY), `la fila PRG-025 dice «${NAME_OF_COPY}»`, `la fila PRG-025 no dice «${NAME_OF_COPY}»`),
    check(state === 'Borrador', 'la fila PRG-025 muestra el estado «Borrador»', `la fila PRG-025 muestra «${state ?? '(sin estado)'}»`),
    check(count === '1–10 de 25', 'el recuento dice «1–10 de 25»', `el recuento dice «${count ?? '(sin recuento)'}»`),
  ]);
};

// --- Esquema 4: eliminar desde el menú pide confirmación y solo al confirmar borra el programa ---------------------------------

const deleteFromMenu: BrowserRowHandler = async (row, { page }) => {
  await resetTenants([TENANT_A]);
  const layout: Layout = strict('diseño', LAYOUTS, cell(row, 'diseno'));
  const expected = 'aviso de éxito «PRG-001 eliminado»; PRG-001 fuera de la lista; recuento «1–10 de 23»';
  const prepared = await signIn(page, layout, 'admin');
  if (prepared !== undefined) return preparationFailedWeb(expected, prepared);
  const acted = await inOrder(openRowActions('PRG-001'), pressAction(layout, 'PRG-001', 'Eliminar'))(page);
  if (acted !== undefined) return actionFailed(expected, acted);
  const dialog = await waitUntil(() => isVisible(deleteDialog(page)));
  if (!dialog.reached) return actionFailed(expected, { message: 'no se abrió el diálogo «Eliminar programa»', note: 'Eliminar desde el menú no abrió el diálogo de confirmación.' });
  const confirmed = await dialogButton('Eliminar')(page);
  if (confirmed !== undefined) return actionFailed(expected, confirmed);
  const toast = await toastShown(page, 'ok', 'PRG-001 eliminado');
  await waitUntil(async () => !(await listedCodes(page, layout)).includes('PRG-001'));
  const codes = await listedCodes(page, layout);
  const count = await recountText(page);
  return conclude([
    check(toast.seen, 'aviso de éxito «PRG-001 eliminado»', `avisos de éxito: ${toast.observed}`),
    check(!codes.includes('PRG-001'), 'PRG-001 ya no aparece en la lista', codes.includes('PRG-001') ? 'PRG-001 sigue en la lista' : 'PRG-001 ya no aparece en la lista'),
    check(count === '1–10 de 23', 'el recuento dice «1–10 de 23»', `el recuento dice «${count ?? '(sin recuento)'}»`),
  ]);
};

defineBrowserRows({
  story: 'US-PROG-GESTION-006',
  surface: 'web',
  tenants: [TENANT_A],
  handlers: new Map<number, BrowserRowHandler>([
    [1, onWeb(roleStates)],
    [2, onWeb(archiveFromMenu)],
    [3, onWeb(duplicateFromMenu)],
    [4, onWeb(deleteFromMenu)],
  ]),
});
