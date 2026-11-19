import { resetTenants, TENANT_A } from '../../../story-runs/support/prepare';
import { ACTION, isVisible, quoted, runSteps, textOf, waitUntil } from '../../support/browser';
import { check, cell, conclude, preparationFailedWeb, strict } from '../../support/checks';
import { defineBrowserRows, type BrowserRowHandler } from '../../core/framework';
import {
  actionMissing,
  afterListResponse,
  ariaSortOf,
  cardOf,
  cellsOf,
  columnIndex,
  countCheck,
  headerOf,
  type Layout,
  listedCodes,
  openPath,
  recountText,
  rowOf,
  signIn,
} from './common';

// US-PROG-LISTA-005 — Ver la lista de programas en tabla o en tarjetas y ordenarla por columna (web). Preparación de cada fila:
// reinicio de alumno01 con el token de su administrador; después gestor@sigpro.test entra desde /login?tenant=alumno01 y llega a
// /programs. Escritorio a 1440 px; responsive a 390 px (sin tabla: una tarjeta por programa).

/** Sentido de la cabecera: el texto de la historia y el atributo `aria-sort` y la flecha que lo muestran. */
const SENSE: ReadonlyMap<string, { readonly aria: string; readonly arrow: string }> = new Map([
  ['ascendente', { aria: 'ascending', arrow: '↑' }],
  ['descendente', { aria: 'descending', arrow: '↓' }],
]);

/** Valor de una celda de la historia: «Activo» (con comillas) o un valor tal cual. */
const plainOf = (text: string): string => (text.startsWith('«') ? quoted(text) : text);

const DESKTOP: Layout = 'escritorio';

// --- Esquema 1: la fila de un programa muestra sus datos en cada columna -----------------------------------------------------

const rowValue: BrowserRowHandler = async (row, { page }) => {
  await resetTenants([TENANT_A]);
  const column = quoted(cell(row, 'columna'));
  const expectedValue = plainOf(cell(row, 'valor'));
  const expected = `la columna ${column} muestra ${expectedValue}`;
  const opened = await signIn(page, DESKTOP);
  if (opened) return preparationFailedWeb(expected, opened);
  await waitUntil(() => isVisible(rowOf(page, 'PRG-001')));
  const index = await columnIndex(page, column);
  const values = await cellsOf(rowOf(page, 'PRG-001'));
  const observed = index < 0 ? `sin la columna ${column}` : (values[index] ?? '(sin celda)');
  return conclude([check(index >= 0 && observed === expectedValue, expected, `la columna ${column} muestra ${observed}`)]);
};

// --- Esquema 2: pulsar una cabecera ordena la tabla y marca el sentido ------------------------------------------------------

const sortByHeader: BrowserRowHandler = async (row, { page }) => {
  await resetTenants([TENANT_A]);
  const column = quoted(cell(row, 'columna'));
  const times = Number(cell(row, 'veces'));
  const first = cell(row, 'primera');
  const sense = strict('sentido', SENSE, cell(row, 'sentido'));
  const senseText = cell(row, 'sentido');
  const expected = `la primera fila es ${first} y la flecha de la columna marca el sentido ${senseText}`;
  const opened = await signIn(page, DESKTOP);
  if (opened) return preparationFailedWeb(expected, opened);
  for (let index = 0; index < times; index += 1) {
    const clicked = await runSteps([[`pulsar la cabecera ${column}`, () => afterListResponse(page, () => headerOf(page, column).getByRole('button').click(ACTION))]]);
    if (clicked) return actionMissing(expected, clicked);
  }
  // La respuesta del último clic ya llegó; se espera a que la tabla refleje ese orden (cabecera y primera fila)
  await waitUntil(async () => (await ariaSortOf(page, column)) === sense.aria && (await listedCodes(page, DESKTOP))[0] === first);
  const observedFirst = (await listedCodes(page, DESKTOP))[0];
  const observedAria = await ariaSortOf(page, column);
  const glyph = (await textOf(headerOf(page, column).getByRole('button'))) ?? '';
  return conclude([
    check(observedFirst === first, `la primera fila es ${first}`, `la primera fila es ${observedFirst ?? '(ninguna)'}`),
    check(observedAria === sense.aria && glyph.includes(sense.arrow), `la flecha de ${column} marca el sentido ${senseText}`, `la cabecera de ${column} tiene aria-sort ${observedAria ?? '(sin atributo)'} y la flecha «${glyph.trim()}»`),
  ]);
};

// --- Esquema 3: la lista entra ordenada por código ascendente ----------------------------------------------------------------

const defaultOrder: BrowserRowHandler = async (row, { page }) => {
  await resetTenants([TENANT_A]);
  const first = cell(row, 'primera');
  const expectedCount = quoted(cell(row, 'recuento'));
  const expected = `la primera fila es ${first}, la flecha de «Código» marca ascendente y el recuento dice ${cell(row, 'recuento')}`;
  const opened = await signIn(page, DESKTOP);
  if (opened) return preparationFailedWeb(expected, opened);
  const loaded = await openPath(page, DESKTOP, '/programs');
  if (loaded) return actionMissing(expected, loaded);
  // Espera a que la tabla muestre la primera fila y el recuento de la historia (la lista se pidió al abrir la página)
  await waitUntil(async () => (await listedCodes(page, DESKTOP))[0] === first && (await recountText(page)) === expectedCount);
  const observedFirst = (await listedCodes(page, DESKTOP))[0];
  const count = await recountText(page);
  const aria = await ariaSortOf(page, 'Código');
  const glyph = (await textOf(headerOf(page, 'Código').getByRole('button'))) ?? '';
  return conclude([
    check(observedFirst === first, `la primera fila es ${first}`, `la primera fila es ${observedFirst ?? '(ninguna)'}`),
    check(aria === 'ascending' && glyph.includes('↑'), 'la flecha de «Código» marca ascendente', `la cabecera de «Código» tiene aria-sort ${aria ?? '(sin atributo)'} y la flecha «${glyph.trim()}»`),
    countCheck(count, expectedCount),
  ]);
};

// --- Esquema 4: en el responsive cada programa es una tarjeta con sus datos -------------------------------------------------

const cardField: BrowserRowHandler = async (row, { page }) => {
  await resetTenants([TENANT_A]);
  const dato = cell(row, 'dato');
  const value = plainOf(cell(row, 'valor'));
  const expected = `la tarjeta muestra ${dato} como ${value}`;
  const opened = await signIn(page, 'responsive');
  if (opened) return preparationFailedWeb(expected, opened);
  const card = cardOf(page, 'PRG-001');
  const seen = await isVisible(card.getByText(value, { exact: true }));
  return conclude([check(seen, expected, seen ? `la tarjeta muestra ${value}` : `la tarjeta de PRG-001 no muestra ${value}`)]);
};

defineBrowserRows({
  story: 'US-PROG-LISTA-005',
  surface: 'web',
  tenants: [TENANT_A],
  handlers: new Map<number, BrowserRowHandler>([
    [1, rowValue],
    [2, sortByHeader],
    [3, defaultOrder],
    [4, cardField],
  ]),
});
