import { defineBrowserRows, type BrowserRowHandler } from '../../core/framework';
import { cell, check, conclude, preparationFailedWeb, strict } from '../../support/checks';
import { ACTION, isVisible, safe, waitUntil } from '../../support/browser';
import { TENANT_A, resetTenants } from '../../../story-runs/support/prepare';
import {
  CSV_NAME,
  accountOf,
  actionFailed,
  apiExport,
  chooseStatus,
  codesOf,
  codesOfCsv,
  downloadAfter,
  emptyBlock,
  exportButton,
  firstToastAt,
  inOrder,
  interact,
  onWeb,
  ownerCombobox,
  recountFor,
  recountText,
  searchBox,
  signIn,
  stateCheck,
  timingOf,
  toastShown,
  type WebAction,
} from './common';

// US-PROG-GESTION-009 — Exportar a CSV la lista de programas desde la cabecera (web, escritorio 1440 px). Preparación de cada fila:
// reinicio de alumno01 con el token de su administrador, inicio de sesión de la cuenta de la fila y llegada a /programs. La descarga
// se compara con la exportación de la API con los mismos filtros (cabecera y líneas), y el aviso se lee del registro de avisos.

const DESKTOP = 'escritorio' as const;
const NO_EXPORT_REASON = 'No hay programas para exportar';

/** Escribe en el buscador de la lista (la búsqueda global de escritorio). */
const typeSearch = (text: string): WebAction => (page) => interact(searchBox(page, DESKTOP), `escribir «${text}» en el buscador de la lista`, (element) => element.fill(text, ACTION));

/** Escribe una fecha en «Fin hasta». */
const endDate = (text: string): WebAction => (page) => interact(page.getByLabel('Fin hasta', { exact: true }), `escribir «${text}» en «Fin hasta»`, (element) => element.fill(text, ACTION));

/** Elige la persona «Alumno 01» en «Responsable»: escribe la búsqueda y pulsa la opción (su nombre accesible puede llevar un recuento). */
const pickOwner = (search: string, persona: RegExp): WebAction =>
  inOrder(
    (page) => interact(ownerCombobox(page), `escribir «${search}» en «Responsable»`, (element) => element.fill(search, ACTION)),
    (page) => interact(page.getByRole('listbox', { name: 'Responsable', exact: true }).getByRole('option', { name: persona }), 'elegir la persona en «Responsable»', (element) => element.click(ACTION)),
  );

/** Filtros que la fila aplica antes de exportar (texto de la celda → acción) y la consulta equivalente de la API. */
const FILTROS: ReadonlyMap<string, { readonly act: WebAction; readonly query: string | undefined }> = new Map<string, { readonly act: WebAction; readonly query: string | undefined }>([
  ['«Estado» en «En pausa»', { act: chooseStatus('En pausa'), query: 'status=on_hold' }],
  ['PRG-001 en el buscador de la lista y 2024-07-01 en «Fin hasta»', { act: inOrder(typeSearch('PRG-001'), endDate('2024-07-01')), query: 'q=PRG-001&to=2024-07-01' }],
  ['ningún filtro', { act: async () => undefined, query: undefined }],
]);

/** Filtros que dejan la lista sin programas (el botón no se puede usar). */
const EMPTY_FILTROS: ReadonlyMap<string, WebAction> = new Map<string, WebAction>([
  ['el buscador de la lista escrito «PRG-999»', typeSearch('PRG-999')],
  ['«Responsable» con «Alumno 01» elegido', pickOwner('Alumno', /^Alumno 01/)],
]);

// --- Esquema 1: la descarga contiene los programas que cumplen los filtros vigentes -------------------------------------------

const downloadsFiltered: BrowserRowHandler = async (row, { page }) => {
  await resetTenants([TENANT_A]);
  const codes = codesOf(cell(row, 'codigos'));
  const filas = cell(row, 'filas');
  const expected = `se descarga ${CSV_NAME} con la cabecera y las líneas de la API con esos filtros (${codes.join(', ')}) y aviso «CSV generado» con «${filas} filas exportadas»`;
  const account = accountOf(cell(row, 'cuenta'));
  const prepared = await signIn(page, DESKTOP, account);
  if (prepared !== undefined) return preparationFailedWeb(expected, prepared);
  const filter = strict('filtro', FILTROS, cell(row, 'filtro'));
  const filtered = await filter.act(page);
  if (filtered !== undefined) return actionFailed(expected, filtered);
  // La lista debe haberse releído con los filtros antes de exportar (recuento de la historia)
  const listed = await waitUntil(async () => (await recountText(page)) === recountFor(Number(filas)) && (await safe(() => exportButton(page).isEnabled({ timeout: 500 }), false)));
  if (!listed.reached) return actionFailed(expected, { message: 'la lista no se asienta con los filtros aplicados', note: 'El recuento no llega al de los programas que cumplen los filtros.' });
  const clickAt = Date.now();
  let file: { readonly name: string; readonly text: string };
  try {
    file = await downloadAfter(page, () => exportButton(page).click(ACTION));
  } catch (error) {
    return actionFailed(expected, { message: `no se descargó el archivo: ${error instanceof Error ? (error.message.split('\n')[0] ?? '') : String(error)}`, note: 'Exportar CSV no produjo una descarga.' });
  }
  const toast = await toastShown(page, 'info', 'CSV generado', `${filas} filas exportadas`);
  const firstAt = await firstToastAt(page, 'info', 'CSV generado');
  const apiText = await apiExport(account, filter.query);
  const exported = codesOfCsv(file.text);
  const sameOrder = exported.length === codes.length && exported.every((code, index) => code === codes[index]);
  return conclude(
    [
      check(file.name === CSV_NAME, `descarga ${CSV_NAME}`, `descarga ${file.name}`),
      check(sameOrder, `las filas ${codes.join(', ')}`, `las filas ${exported.join(', ') || '(ninguna)'}`),
      check(apiText !== undefined && file.text === apiText, 'el archivo es, línea a línea, la exportación de la API con esos filtros', apiText === undefined ? 'la API no dio la exportación' : file.text === apiText ? 'el archivo coincide con la API' : 'el archivo no coincide con la API'),
      check(toast.seen, `aviso informativo «CSV generado» con «${filas} filas exportadas»`, `avisos informativos: ${toast.observed}`),
    ],
    timingOf(clickAt, firstAt),
  );
};

// --- Esquema 2: el botón no se puede usar si ningún programa cumple los filtros -----------------------------------------------

const disabledWithoutRows: BrowserRowHandler = async (row, { page }) => {
  await resetTenants([TENANT_A]);
  const expected = `«Exportar CSV» deshabilitado con el motivo «${NO_EXPORT_REASON}»`;
  const prepared = await signIn(page, DESKTOP, 'gestor');
  if (prepared !== undefined) return preparationFailedWeb(expected, prepared);
  const filtered = await strict('filtro', EMPTY_FILTROS, cell(row, 'filtro'))(page);
  if (filtered !== undefined) return actionFailed(expected, filtered);
  // La lista vacía muestra su bloque «Sin programas»: se espera a verlo antes de juzgar el botón
  const empty = await waitUntil(() => isVisible(emptyBlock(page)));
  if (!empty.reached) return actionFailed(expected, { message: 'no se ve el bloque «Sin programas»', note: 'La lista con esos filtros no muestra el bloque vacío.' });
  const state = await stateCheck(exportButton(page), 'deshabilitado', NO_EXPORT_REASON);
  return conclude([state]);
};

defineBrowserRows({
  story: 'US-PROG-GESTION-009',
  surface: 'web',
  tenants: [TENANT_A],
  handlers: new Map<number, BrowserRowHandler>([
    [1, onWeb(downloadsFiltered)],
    [2, onWeb(disabledWithoutRows)],
  ]),
});
