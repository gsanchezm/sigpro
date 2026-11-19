import { MISION_TESTIDS } from '../../../../packages/shared/src/testids';
import { conclude } from './common';
import { ACTION, CEILING_MS, quoted, safe, waitUntil } from '../../support/browser';
import { cell, check, preparationFailed, strict, type Check } from '../../support/checks';
import { defineBrowserRows, type BrowserRowHandler } from '../../core/framework';
import { TENANT_A, adminSession, archiveActive, failedPreparation, removeAll, resetTenants, type Failed } from '../api/common';
import { DEMO } from '../../../story-runs/support/prepare';
import {
  actionMissing,
  runSteps,
  goneWithin,
  interceptSummary,
  kpiCheck,
  normalized,
  onWeb,
  openMission,
  prepFailed,
  prepFailedReason,
  readPanel,
  signIn,
  traceDependent,
  waitKpisShown,
  type Mode,
  type PanelView,
} from './common';

// US-MISION-KPI-008 — Estados de carga, vacío y error del panel de misión en la web. Preparación de cada fila: reinicio de alumno01
// con el token de su administrador; gestor@sigpro.test entra desde /login?tenant=alumno01 y abre /mission. La demora y el fallo de la
// petición del resumen los provoca la prueba (no el caos del tenant). Lo esperado sale de la historia.

/** «3 segundos» → 3000 ms. Otra forma LANZA (la celda no es una demora). */
const delayMsOf = (text: string): number => {
  const match = /^(\d+) segundos$/.exec(text.trim());
  if (!match?.[1]) throw new Error(`celda sin interpretación: retraso «${text}»`);
  return Number(match[1]) * 1_000;
};

/** Gráfica de la celda → su lectura en el panel. */
const CHART_OF_TITLE: ReadonlyMap<string, 'milestones' | 'nc'> = new Map<string, 'milestones' | 'nc'>([
  ['Hitos cumplidos por programa', 'milestones'],
  ['NC abiertas por severidad', 'nc'],
]);

/** Cambios de preparación de la historia 008 (Esquema 2): archivar los 12 activos o eliminar los 24 programas. */
const BULK_CHANGES: ReadonlyMap<string, (token: string) => Promise<Failed | undefined>> = new Map<string, (token: string) => Promise<Failed | undefined>>([
  ['alumno01@sigpro.lab archiva los 12 programas activos con POST /api/programs/:code/archive', archiveActive],
  ['alumno01@sigpro.lab elimina los 24 programas con DELETE /api/programs/:code', removeAll],
]);

/** Falla del resumen de la celda `fallo` (Esquema 3) y lo que la historia espera como detalle. */
const FAULTS: ReadonlyMap<string, { readonly mode: Mode; readonly detail: 'trace' | 'text' }> = new Map<string, { readonly mode: Mode; readonly detail: 'trace' | 'text' }>([
  ['responde con error 503', { mode: { kind: 'http', status: 503 }, detail: 'trace' }],
  ['no recibe ninguna respuesta (sin conexión)', { mode: { kind: 'abort' }, detail: 'text' }],
]);

/** Detalle que la historia espera bajo el aviso (celda `detalle`): la traza de la respuesta, o el texto de «sin conexión». */
const DETAIL_OF_CELL: ReadonlyMap<string, 'trace' | 'text'> = new Map<string, 'trace' | 'text'>([
  ['la traza de la respuesta, que empieza por «GET /api/mission/summary → 503»', 'trace'],
  ['el texto «No se pudo contactar con el servidor»', 'text'],
]);

const TITLE_OF_ERROR = 'No se pudo cargar el panel de misión';
const SUMMARY_TRACE_503 = 'GET /api/mission/summary → 503';
const NETWORK_TEXT = 'No se pudo contactar con el servidor';
const EMPTY_TEXT = 'Sin datos todavía';
const RETRY = 'Reintentar';

// --- Esquema 1: mientras llega el resumen, las tarjetas y las gráficas no muestran cifras ----------------------------------

const loadingState: BrowserRowHandler = onWeb(async (row, { page }) => {
  await resetTenants([TENANT_A]);
  const ms = delayMsOf(cell(row, 'retraso'));
  const expected = 'mientras llega el resumen, las cuatro tarjetas no muestran ninguna cifra y el bloque está en carga, las gráficas muestran un marcador de carga y ninguna barra; cuando llega, «Programas activos» muestra 12 y «NC abiertas» muestra 8';
  const opened = await signIn(page, DEMO.gestor);
  if (opened) return prepFailed(expected, opened);
  const control = await interceptSummary(page, { kind: 'delay', ms });
  const failed = await openMission(page);
  if (failed) return prepFailed(expected, failed);
  const requested = await waitUntil(async () => control.receivedCount() > 0, CEILING_MS);
  if (!requested.reached) return prepFailedReason(expected, 'la app no pidió el resumen de misión');
  const loading: PanelView | undefined = await readPanel(page);
  const sinceRequestMs = Date.now() - (control.lastReceivedAt() ?? Date.now());
  if (loading?.kpis.some((kpi) => kpi.value !== undefined)) {
    throw new Error(`la lectura de la carga llegó ${sinceRequestMs} ms después de la petición, con un retraso de ${ms} ms: el plazo de la prueba no permite observar la carga`);
  }
  const noFigures: Check = check(
    loading !== undefined && loading.milestones.bars === 0 && loading.nc.bars === 0,
    'las gráficas no dibujan ninguna barra ni columna mientras llega el resumen',
    loading === undefined ? '(sin leer)' : `barras de hitos ${loading.milestones.bars}, columnas de NC ${loading.nc.bars}`,
  );
  const marker: Check = check(
    loading !== undefined && loading.loadingBlocks > 0 && loading.skeletons > 0,
    'las gráficas muestran un marcador de carga',
    loading === undefined ? '(sin leer)' : `bloques de carga ${loading.loadingBlocks}, marcadores ${loading.skeletons}`,
  );
  const busy = check(loading?.kpisBusy === 'true', 'el bloque de tarjetas está en carga (aria-busy «true»)', `aria-busy «${loading?.kpisBusy ?? '(sin leer)'}»`);
  const empty = check(
    loading !== undefined && loading.kpis.every((kpi) => kpi.present && kpi.value === undefined),
    'las cuatro tarjetas no muestran ninguna cifra',
    loading === undefined ? '(sin leer)' : `cifras visibles: ${loading.kpis.filter((kpi) => kpi.value !== undefined).length}`,
  );
  await waitKpisShown(page, ms + CEILING_MS);
  const settled = await readPanel(page);
  return conclude([empty, busy, marker, noFigures, kpiCheck(settled, 'programs', 'Programas activos', '12'), kpiCheck(settled, 'nc', 'NC abiertas', '8')], {
    evidence: { retrasoMs: ms, lecturaTrasUltimaPeticionMs: sinceRequestMs, peticiones: control.log() },
  });
});

// --- Esquema 2: una gráfica sin datos dice que todavía no hay datos -----------------------------------------------------------

const emptyChart: BrowserRowHandler = onWeb(async (row, { page }) => {
  await resetTenants([TENANT_A]);
  const title = quoted(cell(row, 'grafica'));
  const expected = `la gráfica «${title}» muestra «${EMPTY_TEXT}» y no dibuja ninguna barra ni ninguna columna`;
  const chart = strict('grafica', CHART_OF_TITLE, title);
  const bulk = strict('cambio', BULK_CHANGES, cell(row, 'cambio'));
  const admin = await adminSession(TENANT_A);
  if (admin.token === undefined) return preparationFailed(expected, 'alumno01@sigpro.lab inicia sesión', admin.last);
  const changed = await bulk(admin.token);
  if (changed !== undefined) return failedPreparation(expected, changed);
  const opened = await signIn(page, DEMO.gestor);
  if (opened) return prepFailed(expected, opened);
  const failed = await openMission(page);
  if (failed) return prepFailed(expected, failed);
  await waitUntil(async () => (await readPanel(page))?.[chart].present === true, CEILING_MS);
  const view = await readPanel(page);
  const figure = view?.[chart];
  return conclude([
    check(figure?.present === true, `la gráfica «${title}» aparece`, figure?.present === true ? `la gráfica «${title}» aparece` : 'la gráfica no aparece'),
    check(normalized(figure?.empty) === EMPTY_TEXT, `la gráfica «${title}» muestra «${EMPTY_TEXT}»`, `la gráfica muestra «${normalized(figure?.empty) ?? '(sin leer)'}»`),
    check(figure !== undefined && figure.bars === 0, 'no dibuja ninguna barra ni ninguna columna', figure === undefined ? '(sin leer)' : `dibuja ${figure.bars}`),
  ]);
});

// --- Esquema 3: si el resumen falla, el panel dice qué ha pasado y ofrece reintentar ------------------------------------------

const failedSummary: BrowserRowHandler = onWeb(async (row, { page }) => {
  await resetTenants([TENANT_A]);
  const fault = strict('fallo', FAULTS, cell(row, 'fallo'));
  const detail = strict('detalle', DETAIL_OF_CELL, cell(row, 'detalle'));
  if (detail !== fault.detail) throw new Error('la celda detalle no corresponde a la falla de la misma fila');
  const expected = `ve el aviso «${TITLE_OF_ERROR}» y debajo ${cell(row, 'detalle')}; ve el botón «${RETRY}»`;
  const opened = await signIn(page, DEMO.gestor);
  if (opened) return prepFailed(expected, opened);
  const control = await interceptSummary(page, fault.mode);
  const failed = await openMission(page);
  if (failed) return prepFailed(expected, failed);
  await waitUntil(async () => (await readPanel(page))?.errorVisible === true, CEILING_MS);
  const view = await readPanel(page);
  const title = check(normalized(view?.errorTitle) === TITLE_OF_ERROR, `el aviso se titula «${TITLE_OF_ERROR}»`, `el aviso se titula «${normalized(view?.errorTitle) ?? '(sin leer)'}»`);
  const retryText = normalized(await safe(() => page.getByTestId(MISION_TESTIDS.MISSION_ERROR_RETRY).innerText({ timeout: 2_000 }), undefined));
  const retry = check(retryText === RETRY, `ve el botón «${RETRY}»`, `el botón muestra «${retryText ?? '(sin leer)'}»`);
  const trace = normalized(view?.errorTrace);
  const evidence = { peticiones: control.log(), traza: trace ?? '(sin leer)' };
  if (fault.detail === 'trace') {
    const expectedTrace = `la traza de la respuesta empieza por «${SUMMARY_TRACE_503}»`;
    const traceCheck = check(trace?.startsWith(SUMMARY_TRACE_503) === true, expectedTrace, `la traza es «${trace ?? '(sin leer)'}»`);
    return traceDependent(expected, [title, retry], traceCheck, evidence);
  }
  const text = check(trace === NETWORK_TEXT, `el detalle es el texto «${NETWORK_TEXT}»`, `el detalle es la traza «${trace ?? '(sin leer)'}»`);
  return conclude([title, retry, text], {
    note: `La app muestra la traza «${trace ?? '(sin leer)'}» en lugar del texto «${NETWORK_TEXT}» (hallazgo conocido: el cliente de la API construye la traza de red y el texto del catálogo no se usa aquí).`,
    evidence,
  });
});

// --- Esquema 4: reintentar vuelve a pedir el resumen ---------------------------------------------------------------------------

const retry: BrowserRowHandler = onWeb(async (row, { page }) => {
  await resetTenants([TENANT_A]);
  const expected = `tras «${RETRY}», desaparece el aviso «${TITLE_OF_ERROR}» y «Programas activos» muestra ${cell(row, 'cifra')}`;
  const opened = await signIn(page, DEMO.gestor);
  if (opened) return prepFailed(expected, opened);
  const control = await interceptSummary(page, { kind: 'http', status: 503 });
  const failed = await openMission(page);
  if (failed) return prepFailed(expected, failed);
  await waitUntil(async () => (await readPanel(page))?.errorVisible === true, CEILING_MS);
  control.set({ kind: 'ok' });
  const before = control.receivedCount();
  const clicked = await runSteps([[`pulsar «${RETRY}»`, () => page.getByRole('alert').getByRole('button', { name: RETRY, exact: true }).click(ACTION)]]);
  if (clicked) return actionMissing(expected, clicked);
  const gone = await goneWithin(page.getByTestId(MISION_TESTIDS.MISSION_ERROR), CEILING_MS);
  await waitKpisShown(page);
  const view = await readPanel(page);
  const lastRequest = control.log()[control.log().length - 1] ?? '(ninguna)';
  return conclude(
    [
      check(gone, `desaparece el aviso «${TITLE_OF_ERROR}»`, gone ? `desaparece el aviso «${TITLE_OF_ERROR}»` : 'el aviso sigue visible'),
      kpiCheck(view, 'programs', 'Programas activos', cell(row, 'cifra')),
      check(control.receivedCount() > before && lastRequest.endsWith('pasa al servidor'), 'la petición de reintento llega al servidor con normalidad', `peticiones tras «${RETRY}»: ${lastRequest}`),
    ],
    { evidence: { peticiones: control.log() } },
  );
});

defineBrowserRows({
  story: 'US-MISION-KPI-008',
  surface: 'web',
  tenants: [TENANT_A],
  handlers: new Map<number, BrowserRowHandler>([
    [1, loadingState],
    [2, emptyChart],
    [3, failedSummary],
    [4, retry],
  ]),
});
