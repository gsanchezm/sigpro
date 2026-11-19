import type { Page } from '@playwright/test';
import { DEMO, resetTenants, TENANT_A } from '../../../story-runs/support/prepare';
import { ACTION, holdsFor, quoted, waitUntil, HOLD_MS, CEILING_MS } from '../../support/browser';
import { cell, check, conclude, preparationFailed, strict, type Check } from '../../support/checks';
import { defineBrowserRows, type BrowserRowHandler } from '../../core/framework';
import { adminSession, isOk, duplicatePrg001, type Change } from '../api/common';
import {
  afterListResponse,
  barCheck,
  cardCheck,
  globalSearch,
  prepFailed,
  prepFailedReason,
  readBar,
  readCard,
  readCards,
  readSubtitle,
  runSteps,
  signIn,
  statusFilter,
  summaryBlock,
  waitCardsSettled,
  actionMissing,
  textCheck,
  type CardSpec,
  type CardReading,
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

// --- Esquema 1: cada tarjeta muestra la cifra del tenant y su línea auxiliar -----------------------------------------------------

const oneCard: BrowserRowHandler = async (row, { page }) => {
  await resetTenants([TENANT_A]);
  const expected = `la tarjeta ${cell(row, 'tarjeta')} muestra ${cell(row, 'cifra')} y debajo la línea ${cell(row, 'linea')}`;
  const spec: CardSpec = { label: quoted(cell(row, 'tarjeta')), value: cell(row, 'cifra'), aux: quoted(cell(row, 'linea')) };
  const opened = await signIn(page, DEMO.gestor);
  if (opened) return prepFailed(expected, opened);
  const block = summaryBlock(page);
  await waitCardsSettled(block);
  return conclude([cardCheck(await readCard(block, spec.label), spec)]);
};

// --- Esquema 2: los filtros de la lista no cambian las cuatro tarjetas --------------------------------------------------------

const FILTERS: ReadonlyMap<string, (page: Page) => Promise<void>> = new Map<string, (page: Page) => Promise<void>>([
  ['escribe PRG-001 en «Búsqueda global»', (page) => afterListResponse(page, () => globalSearch(page).fill('PRG-001', ACTION))],
  ['elige «En pausa» en «Estado»', (page) => afterListResponse(page, () => statusFilter(page).selectOption({ label: 'En pausa' }, ACTION))],
  ['escribe zzz-sin-coincidencias en «Búsqueda global»', (page) => afterListResponse(page, () => globalSearch(page).fill('zzz-sin-coincidencias', ACTION))],
]);

const filterKeepsCards: BrowserRowHandler = async (row, { page }) => {
  await resetTenants([TENANT_A]);
  const expected = `las cuatro tarjetas siguen mostrando ${FOUR_CARDS_TEXT}`;
  const filter = strict('filtro', FILTERS, cell(row, 'filtro'));
  const opened = await signIn(page, DEMO.gestor);
  if (opened) return prepFailed(expected, opened);
  const block = summaryBlock(page);
  await waitCardsSettled(block);
  const acted = await runSteps([[`aplicar «${cell(row, 'filtro')}»`, () => filter(page)]]);
  if (acted) return actionMissing(expected, acted);
  // «Siguen mostrando»: se observa durante un tiempo fijo, no solo en el instante en que llega la lista
  const held = await holdsFor(async () => cardsMatch(await readCards(block), FOUR_CARDS), HOLD_MS);
  const readings = await readCards(block);
  const cards: Check[] = FOUR_CARDS.map((spec) => cardCheck(readings.find((item) => item.label === spec.label) ?? { label: spec.label, found: false, value: undefined, aux: undefined }, spec));
  return conclude([...cards, check(held.held, `las cuatro tarjetas no cambian durante ${HOLD_MS / 1000} s`, held.held ? 'sin cambios' : 'cambian tras el filtro')]);
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
  if (text !== undefined) {
    const typed = await runSteps([[`escribir ${text} en «Búsqueda global»`, () => afterListResponse(page, () => globalSearch(page).fill(text, ACTION))]]);
    if (typed) return actionMissing(expected, typed);
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

