import type { Page } from '@playwright/test';
import { DEMO, resetTenants, TENANT_A } from '../../../story-runs/support/prepare';
import { ACTION, CEILING_MS, HOLD_MS, holdsFor, quoted, waitUntil } from '../../support/browser';
import { cell, check, conclude, preparationFailed, strict, type Check } from '../../support/checks';
import { defineBrowserRows, type BrowserRowHandler } from '../../core/framework';
import { adminSession, duplicatePrg001, isOk, type Change } from '../api/common';
import {
  actionMissing,
  afterListResponse,
  barCheck,
  barPainted,
  cardCheck,
  emptyVisible,
  globalSearch,
  listedCodes,
  prepFailed,
  prepFailedReason,
  readBar,
  readCard,
  readCards,
  readSubtitle,
  runSteps,
  sameCodes,
  signIn,
  statusFilter,
  summaryBlock,
  textCheck,
  waitCardsSettled,
  waitListLoaded,
  type CardReading,
  type CardSpec,
} from './common';

// US-PROG-METRICAS-002 — Cuatro tarjetas y subtítulo de la lista de programas (web, escritorio 1440 px). Preparación de cada fila:
// reinicio de alumno01 con el token de su administrador; gestor@sigpro.test entra desde /login?tenant=alumno01 en un navegador sin
// sesión guardada y llega a /programs. Las cifras se comparan con lo que dice la historia, nunca con lo que muestra la app.

/** Las cuatro tarjetas con 24 programas, 12 activos, avance medio 49 % y 8 NC abiertas (las cifras de la historia). */
const FOUR_CARDS: readonly CardSpec[] = [
  { label: 'Programas', value: '24', aux: 'activos: 12' },
  { label: 'Activos', value: '12', aux: '50 % del total' },
  { label: 'Avance medio', value: '49 %', aux: '86 de 175 hitos cumplidos' },
  { label: 'NC abiertas', value: '8', aux: 'de 12 registradas' },
];
const FOUR_CARDS_TEXT = '24, 12, 49 % y 8, con las líneas «activos: 12», «50 % del total», «86 de 175 hitos cumplidos» y «de 12 registradas»';

/** Las cuatro tarjetas coinciden (cifra y línea) con `specs`. */
const cardsMatch = (readings: readonly CardReading[], specs: readonly CardSpec[]): boolean =>
  specs.every((spec) => {
    const reading = readings.find((item) => item.label === spec.label);
    return reading !== undefined && reading.found && reading.value === spec.value && reading.aux === spec.aux;
  });

const listText = (codes: readonly string[]): string => (codes.length === 0 ? '(ninguno)' : codes.join(', '));

// --- Esquema 1: cada tarjeta muestra la cifra del tenant y su línea auxiliar -----------------------------------------------------

const oneCard: BrowserRowHandler = async (row, { page }) => {
  await resetTenants([TENANT_A]);
  const expected = `la tarjeta ${cell(row, 'tarjeta')} muestra ${cell(row, 'cifra')} y debajo la línea ${cell(row, 'linea')}`;
  const spec: CardSpec = { label: quoted(cell(row, 'tarjeta')), value: cell(row, 'cifra'), aux: quoted(cell(row, 'linea')) };
  const opened = await signIn(page, DEMO.gestor);
  if (opened) return prepFailed(expected, opened);
  const block = summaryBlock(page);
  await waitListLoaded(page);
  await waitCardsSettled(block);
  return conclude([cardCheck(await readCard(block, spec.label), spec)]);
};

// --- Esquema 2: los filtros de la lista no cambian las cuatro tarjetas --------------------------------------------------------

/** Un filtro de la historia: lo aplica (true si llegó la petición de lista) y dice si cambió la lista. */
interface FilterStep {
  readonly act: (page: Page) => Promise<boolean>;
  readonly applied: (before: readonly string[], after: readonly string[], empty: boolean) => Check;
}

const FILTERS: ReadonlyMap<string, FilterStep> = new Map<string, FilterStep>([
  [
    'escribe PRG-001 en «Búsqueda global»',
    {
      act: (page) => afterListResponse(page, () => globalSearch(page).fill('PRG-001', ACTION)),
      applied: (before, after) =>
        check(sameCodes(after, ['PRG-001']) && !sameCodes(before, after), 'el filtro deja la lista en PRG-001 (la lista cambia respecto a la lista sin filtro)', `la lista muestra ${listText(after)} (sin filtro: ${listText(before)})`),
    },
  ],
  [
    'elige «En pausa» en «Estado»',
    {
      act: (page) => afterListResponse(page, () => statusFilter(page).selectOption({ label: 'En pausa' }, ACTION)),
      applied: (before, after) =>
        check(after.length > 0 && !sameCodes(before, after), 'el filtro «En pausa» cambia la lista a programas (la lista cambia respecto a la lista sin filtro)', `la lista muestra ${listText(after)} (sin filtro: ${listText(before)})`),
    },
  ],
  [
    'escribe zzz-sin-coincidencias en «Búsqueda global»',
    {
      act: (page) => afterListResponse(page, () => globalSearch(page).fill('zzz-sin-coincidencias', ACTION)),
      applied: (_before, after, empty) => check(empty && after.length === 0, 'el filtro sin coincidencias deja la lista vacía (bloque «Sin programas»)', `bloque vacío ${empty ? 'visible' : 'no visible'}; filas ${listText(after)}`),
    },
  ],
]);

const filterKeepsCards: BrowserRowHandler = async (row, { page }) => {
  await resetTenants([TENANT_A]);
  const expected = `el filtro cambia la lista y las cuatro tarjetas siguen mostrando ${FOUR_CARDS_TEXT}`;
  const step = strict('filtro', FILTERS, cell(row, 'filtro'));
  const opened = await signIn(page, DEMO.gestor);
  if (opened) return prepFailed(expected, opened);
  const block = summaryBlock(page);
  await waitListLoaded(page);
  await waitCardsSettled(block);
  const before = await listedCodes(page);
  let replied = false;
  const acted = await runSteps([[`aplicar «${cell(row, 'filtro')}»`, async () => { replied = await step.act(page); }]]);
  if (acted) return actionMissing(expected, acted);
  if (!replied) return prepFailedReason(expected, `la lista no pidió datos (GET /api/programs) tras «${cell(row, 'filtro')}» en ${CEILING_MS / 1000} s`);
  await waitUntil(async () => !sameCodes(await listedCodes(page), before) || (await emptyVisible(page)), CEILING_MS);
  const after = await listedCodes(page);
  const applied = step.applied(before, after, await emptyVisible(page));
  // «Siguen mostrando»: se observa durante un tiempo fijo, no solo en el instante en que llega la lista
  const held = await holdsFor(async () => cardsMatch(await readCards(block), FOUR_CARDS), HOLD_MS);
  const readings = await readCards(block);
  const cards: Check[] = FOUR_CARDS.map((spec) => cardCheck(readings.find((item) => item.label === spec.label) ?? { label: spec.label, found: false, value: undefined, aux: undefined }, spec));
  return conclude([applied, ...cards, check(held.held, `las cuatro tarjetas no cambian durante ${HOLD_MS / 1000} s`, held.held ? 'sin cambios' : 'cambian tras el filtro')], {
    evidence: { listaSinFiltro: before, listaConFiltro: after },
  });
};

// --- Esquema 3: el subtítulo cuenta todos los programas y los activos que cumplen la búsqueda --------------------------------

/** Texto que se escribe en «Búsqueda global»; `undefined` si la fila no escribe nada. */
const SEARCHES: ReadonlyMap<string, string | undefined> = new Map<string, string | undefined>([
  ['no hay texto en «Búsqueda global»', undefined],
  ['escribe PRG-001 en «Búsqueda global»', 'PRG-001'],
  ['escribe zzz-sin-coincidencias en «Búsqueda global»', 'zzz-sin-coincidencias'],
]);

const subtitleOfSearch: BrowserRowHandler = async (row, { page }) => {
  await resetTenants([TENANT_A]);
  const subtitle = quoted(cell(row, 'subtitulo'));
  const expected = `el subtítulo de la cabecera dice «${subtitle}»`;
  const text = strict('busqueda', SEARCHES, cell(row, 'busqueda'));
  const opened = await signIn(page, DEMO.gestor);
  if (opened) return prepFailed(expected, opened);
  await waitCardsSettled(summaryBlock(page));
  await waitListLoaded(page);
  if (text !== undefined) {
    let replied = false;
    const typed = await runSteps([[`escribir ${text} en «Búsqueda global»`, async () => { replied = await afterListResponse(page, () => globalSearch(page).fill(text, ACTION)); }]]);
    if (typed) return actionMissing(expected, typed);
    if (!replied) return prepFailedReason(expected, `la lista no pidió datos (GET /api/programs) tras escribir ${text} en «Búsqueda global»`);
  }
  // El subtítulo llega con la lista: se espera (con techo) a que muestre el texto de la historia antes de juzgarlo
  await waitUntil(async () => (await readSubtitle(page)) === subtitle, CEILING_MS);
  return conclude([textCheck(await readSubtitle(page), subtitle, 'el subtítulo dice')]);
};

// --- Esquema 4: la barra de Avance medio se llena hasta su cifra ---------------------------------------------------------------

/** Cambio previo de la fila: nada, o duplicar PRG-001 con el administrador de alumno01. */
const PREPARATIONS: ReadonlyMap<string, Change> = new Map<string, Change>([
  ['no se hace ningún cambio', async () => undefined],
  ['alumno01@sigpro.lab duplica PRG-001 con POST /api/programs/PRG-001/duplicate', duplicatePrg001],
]);

const progressBar: BrowserRowHandler = async (row, { page }) => {
  await resetTenants([TENANT_A]);
  const percent = cell(row, 'porcentaje');
  const expected = `la barra de «Avance medio» está llena hasta el ${percent} % y su valor es ${percent}`;
  const prepare = strict('cambio', PREPARATIONS, cell(row, 'cambio'));
  const admin = await adminSession(TENANT_A);
  if (admin.token === undefined) return prepFailedReason(expected, 'alumno01@sigpro.lab no inicia sesión (administración)');
  const done = await prepare(admin.token);
  if (done !== undefined && !isOk(done)) return preparationFailed(expected, cell(row, 'cambio'), done);
  const opened = await signIn(page, DEMO.gestor);
  if (opened) return prepFailed(expected, opened);
  const block = summaryBlock(page);
  await waitCardsSettled(block);
  // La barra puede animar su ancho: se espera (con techo) a que el relleno pintado llegue al porcentaje antes de medirlo
  await waitUntil(async () => {
    const reading = await readBar(block, 'Avance medio');
    return reading.found && reading.valueNow === percent && barPainted(reading, Number(percent));
  }, CEILING_MS);
  return conclude([barCheck(await readBar(block, 'Avance medio'), percent)]);
};

defineBrowserRows({
  story: 'US-PROG-METRICAS-002',
  surface: 'web',
  tenants: [TENANT_A],
  handlers: new Map<number, BrowserRowHandler>([
    [1, oneCard],
    [2, filterKeepsCards],
    [3, subtitleOfSearch],
    [4, progressBar],
  ]),
});
