import { DEMO, resetTenants, TENANT_A } from '../../../story-runs/support/prepare';
import { CEILING_MS, holdsFor, quoted, waitUntil } from '../../support/browser';
import { cell, check, conclude, strict, type Check } from '../../support/checks';
import { defineBrowserRows, type BrowserRowHandler } from '../../core/framework';
import { ADMIN_ALUMNO01, adminSession, archiveActive, removeAll, type Failed } from '../api/common';
import {
  FAILED,
  LOADING,
  QUIET_MS,
  actionMissing,
  cardCheck,
  dashCheck,
  delayMsOf,
  interceptSummary,
  listStillVisible,
  prepFailed,
  prepFailedReason,
  readCards,
  rowAction,
  runSteps,
  signIn,
  summaryBlock,
  toastCount,
  valueCheck,
  waitCardsSettled,
  type CardReading,
  type CardSpec,
  type SummaryFault,
} from './common';

// US-PROG-METRICAS-003 — Carga, error, vacío y actualización de las cifras de programas (web, escritorio 1440 px). Preparación de
// cada fila: reinicio de alumno01 con el token de su administrador; los estados que se fabrican con la API se preparan después con
// ese mismo token; las demoras y los fallos del resumen los provoca la prueba (page.route), nunca el caos del tenant.

/** Las cuatro tarjetas con las cifras de la historia para alumno01 recién reiniciado. */
const FOUR_CARDS: readonly CardSpec[] = [
  { label: 'Programas', value: '24', aux: 'activos: 12' },
  { label: 'Activos', value: '12', aux: '50 % del total' },
  { label: 'Avance medio', value: '49 %', aux: '86 de 175 hitos cumplidos' },
  { label: 'NC abiertas', value: '8', aux: 'de 12 registradas' },
];

/** Una tarjeta concreta de la lista de tarjetas, por su etiqueta (no encontrada = `found: false`, nunca cumple). */
const readingOf = (readings: readonly CardReading[], label: string): CardReading => readings.find((item) => item.label === label) ?? { label, found: false, value: undefined, aux: undefined };

/** Las cifras de `specs` son las que muestran las tarjetas (la cifra y la línea auxiliar). */
const matches = (readings: readonly CardReading[], specs: readonly CardSpec[]): boolean =>
  specs.every((spec) => {
    const reading = readingOf(readings, spec.label);
    return reading.found && reading.value === spec.value && reading.aux === spec.aux;
  });

// --- Esquema 1: mientras el resumen no llega, las tarjetas muestran puntos suspensivos ----------------------------------------

const delayedLoad: BrowserRowHandler = async (row, { page }) => {
  await resetTenants([TENANT_A]);
  const ms = delayMsOf(cell(row, 'retraso'));
  const expected = 'mientras llega el resumen, las cuatro tarjetas muestran «…» en la cifra y en la línea auxiliar y el bloque está en carga (aria-busy); cuando llega, 24, 12, 49 % y 8';
  const probe = await interceptSummary(page, { kind: 'delay', ms });
  const opened = await signIn(page, DEMO.gestor);
  if (opened) return prepFailed(expected, opened);
  const block = summaryBlock(page);
  await block.waitFor({ timeout: CEILING_MS }).catch(() => undefined);
  const requested = await waitUntil(async () => probe.firstRequestAt() !== undefined, CEILING_MS);
  if (!requested.reached) return prepFailedReason(expected, 'la página no pidió el resumen de misión');
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
  // Tras la respuesta: el techo es el retraso que elige la prueba más el tiempo de tolerancia de la lectura
  await waitUntil(async () => matches(await readCards(block), FOUR_CARDS), ms + CEILING_MS);
  const finalReadings = await readCards(block);
  const finalChecks: Check[] = FOUR_CARDS.map((spec) => cardCheck(readingOf(finalReadings, spec.label), spec));
  return conclude([...loadingChecks, busyCheck, ...finalChecks], { evidence: { retrasoMs: ms, lecturaTrasUltimaPeticionMs: sinceLatestMs, peticionesResumen: probe.hits() } });
};

// --- Esquema 2: si el resumen falla, las cuatro tarjetas muestran un guion largo ---------------------------------------------

const FAULTS: ReadonlyMap<string, SummaryFault> = new Map<string, SummaryFault>([
  ['responde con error 503', { kind: 'http', status: 503 }],
  ['no recibe ninguna respuesta (sin conexión)', { kind: 'abort' }],
]);

const failedLoad: BrowserRowHandler = async (row, { page }) => {
  await resetTenants([TENANT_A]);
  const expected = 'las cuatro tarjetas muestran «—» en la cifra y en la línea auxiliar; no aparece ningún aviso emergente de error; la lista de programas sigue visible';
  const fault = strict('fallo', FAULTS, cell(row, 'fallo'));
  const probe = await interceptSummary(page, fault);
  const opened = await signIn(page, DEMO.gestor);
  if (opened) return prepFailed(expected, opened);
  const block = summaryBlock(page);
  // Se espera (con techo) a que las tarjetas dejen «…»; si no lo hacen, la comprobación de abajo lo recoge como lo observado
  await waitUntil(async () => (await readCards(block)).every((reading) => reading.found && reading.value === FAILED), CEILING_MS + 5_000);
  const readings = await readCards(block);
  const quiet = await holdsFor(async () => (await toastCount(page, 'danger')) === 0, QUIET_MS);
  await waitUntil(() => listStillVisible(page), CEILING_MS);
  const listed = await listStillVisible(page);
  return conclude(
    [
      ...FOUR_CARDS.map((spec) => dashCheck(readingOf(readings, spec.label))),
      check(quiet.held, `ningún aviso emergente de error durante ${QUIET_MS / 1000} s`, quiet.held ? 'ningún aviso de error' : 'apareció un aviso de error'),
      check(listed, 'la lista de programas sigue visible', listed ? 'la lista de programas sigue visible' : 'la lista de programas no se ve'),
    ],
    { evidence: { fallo: cell(row, 'fallo'), peticionesResumen: probe.hits() } },
  );
};

// --- Esquema 3: sin programas o sin activos, las tarjetas reflejan el tenant -----------------------------------------------

/** Cambio previo de la fila: borrar los 24 programas, o archivar los 12 activos (la API con el administrador de alumno01). */
const STATE_CHANGES: ReadonlyMap<string, (token: string) => Promise<Failed | undefined>> = new Map<string, (token: string) => Promise<Failed | undefined>>([
  ['alumno01@sigpro.lab elimina los 24 programas con DELETE /api/programs/:code', removeAll],
  ['alumno01@sigpro.lab archiva los 12 programas activos con POST /api/programs/:code/archive', archiveActive],
]);

const stateCard: BrowserRowHandler = async (row, { page }) => {
  await resetTenants([TENANT_A]);
  const spec: CardSpec = { label: quoted(cell(row, 'tarjeta')), value: cell(row, 'cifra'), aux: quoted(cell(row, 'linea')) };
  const expected = `la tarjeta ${cell(row, 'tarjeta')} muestra ${cell(row, 'cifra')} y debajo la línea ${cell(row, 'linea')}`;
  const change = strict('cambio', STATE_CHANGES, cell(row, 'cambio'));
  const admin = await adminSession(TENANT_A);
  if (admin.token === undefined) return prepFailedReason(expected, 'alumno01@sigpro.lab no inicia sesión (administración)');
  const prepared = await change(admin.token);
  if (prepared !== undefined) return prepFailedReason(expected, `${prepared.step} → respuesta ${prepared.result.status}`);
  const opened = await signIn(page, DEMO.gestor);
  if (opened) return prepFailed(expected, opened);
  const block = summaryBlock(page);
  await waitCardsSettled(block);
  return conclude([cardCheck(readingOf(await readCards(block), spec.label), spec)]);
};

// --- Esquema 4: las tarjetas se recalculan sin recargar la página tras un cambio desde la lista --------------------------

/** Acción del menú ⋯ de la fila de PRG-001 (`item`) y si pide confirmar con «Eliminar». */
const OPERATIONS: ReadonlyMap<string, { readonly item: string; readonly confirm: boolean }> = new Map<string, { readonly item: string; readonly confirm: boolean }>([
  ['duplica PRG-001 con «Duplicar» en el menú de acciones de su fila', { item: 'Duplicar', confirm: false }],
  ['archiva PRG-001 con «Archivar» en el menú de acciones de su fila', { item: 'Archivar', confirm: false }],
  ['elimina PRG-001 con «Eliminar» en el menú de acciones de su fila y confirma con «Eliminar»', { item: 'Eliminar', confirm: true }],
]);

const afterListOperation: BrowserRowHandler = async (row, { page }) => {
  await resetTenants([TENANT_A]);
  const operation = strict('operacion', OPERATIONS, cell(row, 'operacion'));
  const expected = `sin recargar la página, la tarjeta «Programas» muestra ${cell(row, 'programas')}, la tarjeta «Activos» muestra ${cell(row, 'activos')} y la tarjeta «Avance medio» muestra ${cell(row, 'avance')}`;
  const opened = await signIn(page, ADMIN_ALUMNO01);
  if (opened) return prepFailed(expected, opened);
  const block = summaryBlock(page);
  await waitCardsSettled(block);
  const acted = await runSteps([[`pulsar «${cell(row, 'operacion')}»`, () => rowAction(page, 'PRG-001', operation.item, operation.confirm)]]);
  if (acted) return actionMissing(expected, acted);
  // Tras la respuesta del resumen, las cifras se leen con su techo de espera (la pantalla pinta un instante después)
  await waitUntil(async () => {
    const readings = await readCards(block);
    return readingOf(readings, 'Programas').value === cell(row, 'programas') && readingOf(readings, 'Activos').value === cell(row, 'activos') && readingOf(readings, 'Avance medio').value === cell(row, 'avance');
  }, CEILING_MS);
  const readings = await readCards(block);
  return conclude([
    valueCheck(readingOf(readings, 'Programas'), cell(row, 'programas')),
    valueCheck(readingOf(readings, 'Activos'), cell(row, 'activos')),
    valueCheck(readingOf(readings, 'Avance medio'), cell(row, 'avance')),
  ]);
};

defineBrowserRows({
  story: 'US-PROG-METRICAS-003',
  surface: 'web',
  tenants: [TENANT_A],
  handlers: new Map<number, BrowserRowHandler>([
    [1, delayedLoad],
    [2, failedLoad],
    [3, stateCard],
    [4, afterListOperation],
  ]),
});
