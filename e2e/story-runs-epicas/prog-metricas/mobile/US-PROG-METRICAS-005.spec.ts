import type { Page } from '@playwright/test';
import { DEMO, resetTenants, TENANT_A } from '../../../story-runs/support/prepare';
import { ACTION, CEILING_MS, HOLD_MS, holdsFor, quoted, waitUntil } from '../../support/browser';
import { cell, check, conclude, preparationFailed, strict, type Check } from '../../support/checks';
import { defineBrowserRows, type BrowserRowHandler } from '../../core/framework';
import { ADMIN_ALUMNO01, adminSession, removeAll, type Failed } from '../api/common';
import {
  FAILED,
  LOADING,
  actionMissing,
  cardCheck,
  dashCheck,
  delayMsOf,
  interceptSummary,
  prepFailed,
  prepFailedReason,
  readCard,
  readCards,
  runSteps,
  textCheck,
  valueCheck,
  waitCardsSettled,
  type CardReading,
  type CardSpec,
  type SummaryFault,
} from '../web/common';
import {
  afterListResponse,
  cardAction,
  listedCodes,
  listVisibleWith,
  mobileSubtitle,
  onExpoWeb,
  sameCodes,
  searchBox,
  signInTo,
  statusChoice,
  summaryBlock,
  waitListSettled,
} from './common';

// US-PROG-METRICAS-005 — Cuatro tarjetas y subtítulo de la lista de programas (app móvil, web de Expo a 390 px; NO es nativo).
// Preparación de cada fila: reinicio de alumno01 con el token de su administrador; después se abre la app sin sesión, se escribe
// alumno01 en «Tenant de trabajo» y se inicia sesión con la cuenta de la fila. Las cifras se comparan con lo que dice la historia.
// El veredicto vale para Expo web: no se ha comprobado en iOS ni en Android nativo.

/** Las cuatro tarjetas con 24 programas, 12 activos, avance medio 49 % y 8 NC abiertas (las cifras de la historia). */
const FOUR_CARDS: readonly CardSpec[] = [
  { label: 'Programas', value: '24', aux: 'activos: 12' },
  { label: 'Activos', value: '12', aux: '50 % del total' },
  { label: 'Avance medio', value: '49 %', aux: '86 de 175 hitos cumplidos' },
  { label: 'NC abiertas', value: '8', aux: 'de 12 registradas' },
];
const FOUR_CARDS_TEXT = '24, 12, 49 % y 8, con las líneas «activos: 12», «50 % del total», «86 de 175 hitos cumplidos» y «de 12 registradas»';

const readingOf = (readings: readonly CardReading[], label: string): CardReading => readings.find((item) => item.label === label) ?? { label, found: false, value: undefined, aux: undefined };

const matches = (readings: readonly CardReading[], specs: readonly CardSpec[]): boolean =>
  specs.every((spec) => {
    const reading = readingOf(readings, spec.label);
    return reading.found && reading.value === spec.value && reading.aux === spec.aux;
  });

const listText = (codes: readonly string[]): string => (codes.length === 0 ? '(ninguno)' : codes.join(', '));

// --- Esquema 1: cada tarjeta muestra la cifra del tenant y su línea auxiliar ---------------------------------------------------

const oneCard: BrowserRowHandler = async (row, { page }) => {
  await resetTenants([TENANT_A]);
  const expected = `la tarjeta ${cell(row, 'tarjeta')} muestra ${cell(row, 'cifra')} y debajo la línea ${cell(row, 'linea')}`;
  const spec: CardSpec = { label: quoted(cell(row, 'tarjeta')), value: cell(row, 'cifra'), aux: quoted(cell(row, 'linea')) };
  const opened = await signInTo(page, DEMO.gestor);
  if (opened) return prepFailed(expected, opened);
  if (!(await waitListSettled(page))) return prepFailedReason(expected, 'la lista de programas no aparece');
  const block = summaryBlock(page);
  await waitCardsSettled(block);
  return conclude([cardCheck(await readCard(block, spec.label), spec)]);
};

// --- Esquema 2: los filtros de la lista no cambian las cuatro tarjetas ------------------------------------------------------

/** Un filtro de la historia: lo aplica (true si llegó la petición de lista) y dice si cambió la lista. */
interface FilterStep {
  readonly act: (page: Page) => Promise<boolean>;
  readonly applied: (before: readonly string[], after: readonly string[]) => Check;
}

const FILTERS: ReadonlyMap<string, FilterStep> = new Map<string, FilterStep>([
  [
    'escribe PRG-001 en «Buscar programas»',
    {
      act: (page) => afterListResponse(page, () => searchBox(page).fill('PRG-001', ACTION)),
      applied: (before, after) =>
        check(sameCodes(after, ['PRG-001']) && !sameCodes(before, after), 'el filtro deja la lista en PRG-001 (la lista cambia respecto a la lista sin filtro)', `la lista muestra ${listText(after)} (sin filtro: ${listText(before)})`),
    },
  ],
  [
    'elige «En pausa» en «Estado»',
    {
      act: (page) => afterListResponse(page, () => statusChoice(page, 'En pausa').click(ACTION)),
      applied: (before, after) =>
        check(after.length > 0 && !sameCodes(before, after), 'el filtro «En pausa» cambia la lista a programas (la lista cambia respecto a la lista sin filtro)', `la lista muestra ${listText(after)} (sin filtro: ${listText(before)})`),
    },
  ],
]);

const filterKeepsCards: BrowserRowHandler = async (row, { page }) => {
  await resetTenants([TENANT_A]);
  const expected = `el filtro cambia la lista y las cuatro tarjetas siguen mostrando ${FOUR_CARDS_TEXT}`;
  const step = strict('filtro', FILTERS, cell(row, 'filtro'));
  const opened = await signInTo(page, DEMO.gestor);
  if (opened) return prepFailed(expected, opened);
  if (!(await waitListSettled(page))) return prepFailedReason(expected, 'la lista de programas no aparece');
  const block = summaryBlock(page);
  await waitCardsSettled(block);
  const before = await listedCodes(page);
  let replied = false;
  const acted = await runSteps([[`aplicar «${cell(row, 'filtro')}»`, async () => { replied = await step.act(page); }]]);
  if (acted) return actionMissing(expected, acted);
  if (!replied) return prepFailedReason(expected, `la lista no pidió datos (GET /api/programs) tras «${cell(row, 'filtro')}» en ${CEILING_MS / 1000} s`);
  await waitUntil(async () => !sameCodes(await listedCodes(page), before), CEILING_MS);
  const after = await listedCodes(page);
  const applied = step.applied(before, after);
  // «Siguen mostrando»: se observa durante un tiempo fijo, no solo en el instante en que llega la lista
  const held = await holdsFor(async () => matches(await readCards(block), FOUR_CARDS), HOLD_MS);
  const readings = await readCards(block);
  const cards: Check[] = FOUR_CARDS.map((spec) => cardCheck(readingOf(readings, spec.label), spec));
  return conclude([applied, ...cards, check(held.held, `las cuatro tarjetas no cambian durante ${HOLD_MS / 1000} s`, held.held ? 'sin cambios' : 'cambian tras el filtro')], {
    evidence: { listaSinFiltro: before, listaConFiltro: after },
  });
};

// --- Esquema 3: el subtítulo cuenta todos los programas y los activos que cumplen el buscador ------------------------------

const SEARCHES: ReadonlyMap<string, string | undefined> = new Map<string, string | undefined>([
  ['no hay texto en «Buscar programas»', undefined],
  ['escribe PRG-001 en «Buscar programas»', 'PRG-001'],
  ['escribe zzz-sin-coincidencias en «Buscar programas»', 'zzz-sin-coincidencias'],
]);

const subtitleOfSearch: BrowserRowHandler = async (row, { page }) => {
  await resetTenants([TENANT_A]);
  const subtitle = quoted(cell(row, 'subtitulo'));
  const expected = `el subtítulo de la pantalla dice «${subtitle}»`;
  const text = strict('busqueda', SEARCHES, cell(row, 'busqueda'));
  const opened = await signInTo(page, DEMO.gestor);
  if (opened) return prepFailed(expected, opened);
  if (!(await waitListSettled(page))) return prepFailedReason(expected, 'la lista de programas no aparece');
  if (text !== undefined) {
    let replied = false;
    const typed = await runSteps([[`escribir ${text} en «Buscar programas»`, async () => { replied = await afterListResponse(page, () => searchBox(page).fill(text, ACTION)); }]]);
    if (typed) return actionMissing(expected, typed);
    if (!replied) return prepFailedReason(expected, `la lista no pidió datos (GET /api/programs) tras escribir ${text} en «Buscar programas»`);
  }
  // El subtítulo llega con la lista: se espera (con techo) a que muestre el texto de la historia antes de juzgarlo
  await waitUntil(async () => (await mobileSubtitle(page)) === subtitle, CEILING_MS);
  return conclude([textCheck(await mobileSubtitle(page), subtitle, 'el subtítulo dice')]);
};

// --- Esquema 4: mientras el resumen no llega, las tarjetas muestran puntos suspensivos -----------------------------------

const delayedLoad: BrowserRowHandler = async (row, { page }) => {
  await resetTenants([TENANT_A]);
  const ms = delayMsOf(cell(row, 'retraso'));
  const expected = 'mientras llega el resumen, las cuatro tarjetas muestran «…» en la cifra y en la línea auxiliar y el bloque está en carga (aria-busy); cuando llega, 24, 12, 49 % y 8';
  const probe = await interceptSummary(page, { kind: 'delay', ms });
  const opened = await signInTo(page, DEMO.gestor);
  if (opened) return prepFailed(expected, opened);
  const block = summaryBlock(page);
  await block.waitFor({ timeout: CEILING_MS }).catch(() => undefined);
  const requested = await waitUntil(async () => probe.firstRequestAt() !== undefined, CEILING_MS);
  if (!requested.reached) return prepFailedReason(expected, 'la app no pidió el resumen de misión');
  const loadingReadings = await readCards(block);
  const busy = await block.getAttribute('aria-busy', { timeout: 500 }).catch(() => undefined);
  // Se juzga lo que se lee. Solo si ya no hay «…» (la respuesta llegó antes de la lectura) el plazo de la prueba impide observar la carga.
  const allLoading = FOUR_CARDS.every((spec) => {
    const reading = readingOf(loadingReadings, spec.label);
    return reading.found && reading.value === LOADING && reading.aux === LOADING;
  });
  const sinceLatestMs = Math.round(performance.now() - (probe.lastRequestAt() ?? performance.now()));
  if (!allLoading && sinceLatestMs >= ms) {
    throw new Error(`la lectura de la carga llegó ${sinceLatestMs} ms después de la última petición del resumen, con un retraso de ${ms} ms: el plazo de la prueba no permite observar «…»`);
  }
  const loadingChecks: Check[] = FOUR_CARDS.map((spec) => {
    const reading = readingOf(loadingReadings, spec.label);
    return check(
      reading.found && reading.value === LOADING && reading.aux === LOADING,
      `la tarjeta «${spec.label}» muestra «…» en la cifra y en la línea auxiliar`,
      reading.found ? `la tarjeta «${spec.label}» muestra ${reading.value ?? '(sin leer)'} y ${reading.aux ?? '(sin leer)'}` : `la tarjeta «${spec.label}» no aparece`,
    );
  });
  const busyCheck = check(busy === 'true', 'el bloque de tarjetas está en estado de carga (aria-busy «true»)', `aria-busy «${busy ?? '(sin atributo)'}»`);
  await waitUntil(async () => matches(await readCards(block), FOUR_CARDS), ms + CEILING_MS);
  const finalReadings = await readCards(block);
  const finalChecks: Check[] = FOUR_CARDS.map((spec) => cardCheck(readingOf(finalReadings, spec.label), spec));
  return conclude([...loadingChecks, busyCheck, ...finalChecks], { evidence: { retrasoMs: ms, lecturaTrasUltimaPeticionMs: sinceLatestMs, peticionesResumen: probe.hits() } });
};

// --- Esquema 5: si el resumen falla, las cuatro tarjetas muestran un guion largo y la lista sigue ----------------------------

const FAULTS: ReadonlyMap<string, SummaryFault> = new Map<string, SummaryFault>([
  ['responde con error 503', { kind: 'http', status: 503 }],
  ['no recibe ninguna respuesta (sin conexión)', { kind: 'abort' }],
]);

const failedLoad: BrowserRowHandler = async (row, { page }) => {
  await resetTenants([TENANT_A]);
  const expected = 'las cuatro tarjetas muestran «—» en la cifra y en la línea auxiliar, y la lista de programas sigue visible';
  const fault = strict('fallo', FAULTS, cell(row, 'fallo'));
  const probe = await interceptSummary(page, fault);
  const opened = await signInTo(page, DEMO.gestor);
  if (opened) return prepFailed(expected, opened);
  if (!(await waitListSettled(page))) return prepFailedReason(expected, 'la lista de programas no aparece');
  const block = summaryBlock(page);
  // Se espera (con techo) a que las tarjetas dejen «…»; si no lo hacen, la comprobación de abajo lo recoge como lo observado
  await waitUntil(async () => (await readCards(block)).every((reading) => reading.found && reading.value === FAILED), CEILING_MS + 5_000);
  const readings = await readCards(block);
  const listed = await listVisibleWith(page, 'PRG-001');
  return conclude([...FOUR_CARDS.map((spec) => dashCheck(readingOf(readings, spec.label))), listed], {
    evidence: { fallo: cell(row, 'fallo'), peticionesResumen: probe.hits() },
  });
};

// --- Esquema 6: sin programas, las tarjetas muestran cero -------------------------------------------------------------------

const zeroCards: BrowserRowHandler = async (row, { page }) => {
  await resetTenants([TENANT_A]);
  const spec: CardSpec = { label: quoted(cell(row, 'tarjeta')), value: cell(row, 'cifra'), aux: quoted(cell(row, 'linea')) };
  const expected = `la tarjeta ${cell(row, 'tarjeta')} muestra ${cell(row, 'cifra')} y debajo la línea ${cell(row, 'linea')}`;
  const admin = await adminSession(TENANT_A);
  if (admin.token === undefined) return prepFailedReason(expected, 'alumno01@sigpro.lab no inicia sesión (administración)');
  const removed: Failed | undefined = await removeAll(admin.token);
  if (removed !== undefined) return preparationFailed(expected, removed.step, removed.result);
  const opened = await signInTo(page, DEMO.gestor);
  if (opened) return prepFailed(expected, opened);
  if (!(await waitListSettled(page))) return prepFailedReason(expected, 'la lista de programas no aparece');
  const block = summaryBlock(page);
  await waitCardsSettled(block);
  return conclude([cardCheck(await readCard(block, spec.label), spec)]);
};

// --- Esquema 7: las tarjetas se recalculan tras un cambio desde el menú de la lista -----------------------------------------

const OPERATIONS: ReadonlyMap<string, { readonly item: string; readonly confirm: boolean }> = new Map<string, { readonly item: string; readonly confirm: boolean }>([
  ['duplica PRG-001 con «Duplicar» en su menú ⋯', { item: 'Duplicar', confirm: false }],
  ['archiva PRG-001 con «Archivar» en su menú ⋯', { item: 'Archivar', confirm: false }],
  ['elimina PRG-001 con «Eliminar» en su menú ⋯ y confirma con «Eliminar»', { item: 'Eliminar', confirm: true }],
]);

const afterMenuOperation: BrowserRowHandler = async (row, { page }) => {
  await resetTenants([TENANT_A]);
  const operation = strict('operacion', OPERATIONS, cell(row, 'operacion'));
  const expected = `las cuatro tarjetas muestran «Programas» con ${cell(row, 'programas')}, «Activos» con ${cell(row, 'activos')}, «Avance medio» con ${cell(row, 'avance')} y «NC abiertas» con ${cell(row, 'nc_abiertas')}, y la línea de «NC abiertas» es ${cell(row, 'linea_nc')}`;
  const opened = await signInTo(page, ADMIN_ALUMNO01);
  if (opened) return prepFailed(expected, opened);
  if (!(await waitListSettled(page))) return prepFailedReason(expected, 'la lista de programas no aparece');
  const block = summaryBlock(page);
  await waitCardsSettled(block);
  const acted = await runSteps([[`pulsar «${cell(row, 'operacion')}»`, () => cardAction(page, 'PRG-001', operation.item, operation.confirm)]]);
  if (acted) return actionMissing(expected, acted);
  // Tras la respuesta del resumen, las cifras se leen con su techo de espera (la pantalla pinta un instante después)
  await waitUntil(async () => {
    const readings = await readCards(block);
    return (
      readingOf(readings, 'Programas').value === cell(row, 'programas') &&
      readingOf(readings, 'Activos').value === cell(row, 'activos') &&
      readingOf(readings, 'Avance medio').value === cell(row, 'avance') &&
      readingOf(readings, 'NC abiertas').value === cell(row, 'nc_abiertas')
    );
  }, CEILING_MS);
  const readings = await readCards(block);
  const nc = readingOf(readings, 'NC abiertas');
  return conclude([
    valueCheck(readingOf(readings, 'Programas'), cell(row, 'programas')),
    valueCheck(readingOf(readings, 'Activos'), cell(row, 'activos')),
    valueCheck(readingOf(readings, 'Avance medio'), cell(row, 'avance')),
    valueCheck(nc, cell(row, 'nc_abiertas')),
    check(nc.aux === quoted(cell(row, 'linea_nc')), `la línea de «NC abiertas» es ${cell(row, 'linea_nc')}`, `la línea de «NC abiertas» es «${nc.aux ?? '(sin leer)'}»`),
  ]);
};

defineBrowserRows({
  story: 'US-PROG-METRICAS-005',
  surface: 'expo-web',
  tenants: [TENANT_A],
  handlers: new Map<number, BrowserRowHandler>([
    [1, onExpoWeb(oneCard)],
    [2, onExpoWeb(filterKeepsCards)],
    [3, onExpoWeb(subtitleOfSearch)],
    [4, onExpoWeb(delayedLoad)],
    [5, onExpoWeb(failedLoad)],
    [6, onExpoWeb(zeroCards)],
    [7, onExpoWeb(afterMenuOperation)],
  ]),
});
