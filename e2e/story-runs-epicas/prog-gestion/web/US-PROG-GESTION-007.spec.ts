import type { Page } from '@playwright/test';
import { defineBrowserRows, type BrowserRowHandler } from '../../core/framework';
import { cell, check, conclude, preparationFailedWeb, strict, type Check } from '../../support/checks';
import { ACTION, isVisible, quoted, waitUntil } from '../../support/browser';
import { TENANT_A, resetTenants } from '../../../story-runs/support/prepare';
import {
  CSV_NAME,
  accountOf,
  actionFailed,
  apiExport,
  bulkBar,
  bulkButton,
  bulkCount,
  codesOf,
  codesOfCsv,
  deleteDialog,
  dialogButton,
  downloadAfter,
  firstToastAt,
  inOrder,
  listedCodes,
  normalized,
  onWeb,
  parseEnabled,
  recountText,
  signIn,
  stateCheck,
  stateOfRow,
  timingOf,
  toastShown,
  toggleRow,
  watchResponse,
  type WebAction,
} from './common';

// US-PROG-GESTION-007 — Acciones masivas sobre los programas marcados (web, escritorio 1440 px). Preparación de cada fila: reinicio
// de alumno01 con el token de su administrador, inicio de sesión de la cuenta de la fila y llegada a /programs sin filtros.
// Los avisos se leen del registro de avisos (no de la pantalla); la descarga se compara línea a línea con la exportación de la API.

const DESKTOP = 'escritorio' as const;
const HEADER = 'code;name;status;owner;start;end;budget;progress';

/** Programas que marca la fila: «PRG-002» o «PRG-002 y PRG-003». */
const MARKED: ReadonlyMap<string, readonly string[]> = new Map<string, readonly string[]>([
  ['PRG-001', ['PRG-001']],
  ['PRG-002', ['PRG-002']],
  ['PRG-001 y PRG-002', ['PRG-001', 'PRG-002']],
  ['PRG-001 y PRG-003', ['PRG-001', 'PRG-003']],
  ['PRG-002 y PRG-003', ['PRG-002', 'PRG-003']],
]);

/** Marca cada programa de la lista de la fila (en orden). */
const markAll = (codes: readonly string[]): WebAction => inOrder(...codes.map((code) => toggleRow(code, true)));

/** Botón de la barra de acciones masivas. */
const barItem = (page: Page, name: string) => bulkBar(page).getByRole('button', { name, exact: true });

// --- Esquema 1: archivar la selección cierra todos los programas marcados -----------------------------------------------------

const archiveSelection: BrowserRowHandler = async (row, { page }) => {
  await resetTenants([TENANT_A]);
  const codes = strict('marcados', MARKED, cell(row, 'marcados'));
  const aviso = quoted(cell(row, 'aviso'));
  const expected = `aviso de éxito «${aviso}»; la barra desaparece; las filas de ${codes.join(', ')} muestran «Cerrado»`;
  const prepared = await signIn(page, DESKTOP, 'gestor');
  if (prepared !== undefined) return preparationFailedWeb(expected, prepared);
  const marked = await markAll(codes)(page);
  if (marked !== undefined) return actionFailed(expected, marked);
  const archived = await bulkButton('Archivar')(page);
  if (archived !== undefined) return actionFailed(expected, archived);
  const toast = await toastShown(page, 'ok', aviso);
  const gone = await waitUntil(async () => !(await isVisible(bulkBar(page))));
  const states: Check[] = [];
  for (const code of codes) {
    await waitUntil(async () => (await stateOfRow(page, DESKTOP, code)) === 'Cerrado');
    const state = await stateOfRow(page, DESKTOP, code);
    states.push(check(state === 'Cerrado', `${code} muestra el estado «Cerrado»`, `${code} muestra «${state ?? '(sin estado)'}»`));
  }
  return conclude([
    check(toast.seen, `aviso de éxito «${aviso}»`, `avisos de éxito: ${toast.observed}`),
    check(gone.reached, 'la barra de acciones masivas desaparece', gone.reached ? 'la barra de acciones masivas desaparece' : 'la barra sigue visible'),
    ...states,
  ]);
};

// --- Esquema 2: eliminar la selección borra los programas marcados al confirmar ------------------------------------------------

const deleteSelection: BrowserRowHandler = async (row, { page }) => {
  await resetTenants([TENANT_A]);
  const marked = strict('marcados', MARKED, cell(row, 'marcados'));
  const aviso = quoted(cell(row, 'aviso'));
  const expected = `aviso de éxito «${aviso}»; recuento «${cell(row, 'recuento')}»; ${marked.join(', ')} ya no están en la lista`;
  const prepared = await signIn(page, DESKTOP, 'admin');
  if (prepared !== undefined) return preparationFailedWeb(expected, prepared);
  const selected = await markAll(marked)(page);
  if (selected !== undefined) return actionFailed(expected, selected);
  const removing = await bulkButton('Eliminar')(page);
  if (removing !== undefined) return actionFailed(expected, removing);
  const dialog = await waitUntil(() => isVisible(deleteDialog(page)));
  if (!dialog.reached) return actionFailed(expected, { message: 'no se abrió el diálogo «Eliminar programa»', note: 'Eliminar de la barra no abrió el diálogo de confirmación.' });
  const deletedAt = watchResponse(page, 'DELETE', '/api/programs/');
  const clickAt = Date.now();
  const confirmed = await dialogButton('Eliminar')(page);
  if (confirmed !== undefined) return actionFailed(expected, confirmed);
  const toast = await toastShown(page, 'ok', aviso);
  const count = await waitUntil(async () => (await recountText(page)) === cell(row, 'recuento'));
  const observed = await recountText(page);
  const shown = await listedCodes(page, DESKTOP);
  const stillListed = marked.filter((code) => shown.includes(code));
  const firstAt = await firstToastAt(page, 'ok', aviso);
  return conclude(
    [
      check(toast.seen, `aviso de éxito «${aviso}»`, `avisos de éxito: ${toast.observed}`),
      check(count.reached, `el recuento dice «${cell(row, 'recuento')}»`, `el recuento dice «${observed ?? '(sin recuento)'}»`),
      check(stillListed.length === 0, `${marked.join(', ')} ya no están en la lista`, stillListed.length === 0 ? `${marked.join(', ')} ya no están en la lista` : `siguen en la lista: ${stillListed.join(', ')}`),
    ],
    timingOf(clickAt, firstAt, deletedAt()),
  );
};

// --- Esquema 3: exportar la selección descarga solo las filas marcadas ---------------------------------------------------------

const exportSelection: BrowserRowHandler = async (row, { page }) => {
  await resetTenants([TENANT_A]);
  const marcados = strict('marcados', MARKED, cell(row, 'marcados'));
  const codes = codesOf(cell(row, 'codigos'));
  const filas = cell(row, 'filas');
  const expected = `se descarga ${CSV_NAME} con la cabecera y las líneas de la API de ${codes.join(', ')}, en ese orden; aviso «CSV generado» con «${filas} filas exportadas»; la selección sigue`;
  const prepared = await signIn(page, DESKTOP, 'gestor');
  if (prepared !== undefined) return preparationFailedWeb(expected, prepared);
  const selected = await markAll(marcados)(page);
  if (selected !== undefined) return actionFailed(expected, selected);
  let file: { readonly name: string; readonly text: string };
  try {
    file = await downloadAfter(page, () => barItem(page, 'Exportar selección').click(ACTION));
  } catch (error) {
    return actionFailed(expected, { message: `no se descargó el archivo: ${error instanceof Error ? (error.message.split('\n')[0] ?? '') : String(error)}`, note: 'Exportar selección no produjo una descarga.' });
  }
  const toast = await toastShown(page, 'info', 'CSV generado', `${filas} filas exportadas`);
  // La API exporta los mismos programas con la misma cabecera: el archivo debe coincidir línea a línea
  const apiText = await apiExport('gestor', undefined);
  const apiLines = apiText === undefined ? [] : apiText.split('\n');
  const expectedText = [HEADER, ...apiLines.slice(1).filter((line) => codes.includes(line.split(';')[0] ?? ''))].join('\n');
  const exported = codesOfCsv(file.text);
  const sameOrder = exported.length === codes.length && exported.every((code, index) => code === codes[index]);
  const count = await normalized(bulkCount(page));
  return conclude([
    check(file.name === CSV_NAME, `descarga ${CSV_NAME}`, `descarga ${file.name}`),
    check(sameOrder, `las filas ${codes.join(', ')}, en ese orden`, `las filas ${exported.join(', ') || '(ninguna)'}`),
    check(apiText !== undefined && file.text === expectedText, 'el archivo es la cabecera y las líneas de la API de esos programas', apiText === undefined ? 'la API no dio la exportación' : file.text === expectedText ? 'el archivo coincide con la API' : 'el archivo no coincide con la API'),
    check(toast.seen, `aviso informativo «CSV generado» con «${filas} filas exportadas»`, `avisos informativos: ${toast.observed}`),
    check(count === `${marcados.length} seleccionados`, `la selección sigue marcada (${marcados.length} seleccionados)`, `la barra dice «${count ?? '(sin barra)'}»`),
  ]);
};

// --- Esquema 4: cada rol ve habilitadas solo las acciones masivas que su permiso permite -------------------------------------

const barRoles: BrowserRowHandler = async (row, { page }) => {
  await resetTenants([TENANT_A]);
  const expected = `«Exportar selección» habilitado; «Archivar» ${cell(row, 'archivar')}; «Eliminar» ${cell(row, 'eliminar')}`;
  const prepared = await signIn(page, DESKTOP, accountOf(cell(row, 'cuenta')));
  if (prepared !== undefined) return preparationFailedWeb(expected, prepared);
  const marked = await toggleRow('PRG-002', true)(page);
  if (marked !== undefined) return actionFailed(expected, marked);
  await waitUntil(() => isVisible(bulkBar(page)));
  const archive = parseEnabled(cell(row, 'archivar'));
  const remove = parseEnabled(cell(row, 'eliminar'));
  const results: Check[] = [
    await stateCheck(barItem(page, 'Exportar selección'), 'habilitado'),
    await stateCheck(barItem(page, 'Archivar'), archive.enabled ? 'habilitado' : 'deshabilitado', archive.reason),
    await stateCheck(barItem(page, 'Eliminar'), remove.enabled ? 'habilitado' : 'deshabilitado', remove.reason),
  ];
  return conclude(results);
};

defineBrowserRows({
  story: 'US-PROG-GESTION-007',
  surface: 'web',
  tenants: [TENANT_A],
  handlers: new Map<number, BrowserRowHandler>([
    [1, onWeb(archiveSelection)],
    [2, onWeb(deleteSelection)],
    [3, onWeb(exportSelection)],
    [4, onWeb(barRoles)],
  ]),
});
