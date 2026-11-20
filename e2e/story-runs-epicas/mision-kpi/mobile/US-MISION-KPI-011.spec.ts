import { MISION_TESTIDS, MOVIL_MISSION_TESTIDS } from '../../../../packages/shared/src/testids';
import { conclude } from '../web/common';
import { CEILING_MS, quoted, waitUntil } from '../../support/browser';
import { cell, check, preparationFailed, strict } from '../../support/checks';
import { defineBrowserRows, type BrowserRowHandler } from '../../core/framework';
import { TENANT_A, adminSession, archiveActive, failedPreparation, removeAll, resetTenants, type Failed } from '../api/common';
import { DEMO } from '../../../story-runs/support/prepare';
import { runSteps, actionMissing, interceptSummary, normalized, prepFailed, prepFailedReason, type PanelView } from '../web/common';
import { onExpoWeb, openMissionTab, readLegend, readLoadingSnapshot, readMobilePanel, readMobileTable, signInTo, toggleTable } from './common';

// US-MISION-KPI-011 — Gráficas del panel de misión en la app móvil (web de Expo a 390 px; NO es nativo): barras, leyenda, vista de tabla
// y estados de carga y vacío. Preparación de cada fila: reinicio de alumno01 con el token de su administrador; la app se abre sin
// sesión, se escribe alumno01 en «Tenant de trabajo», la cuenta de la fila inicia sesión y se abre la pestaña «Misión». Los números
// de la tabla salen de la historia; la demora del resumen la provoca la prueba.

/** «3 segundos» → 3000 ms. Otra forma LANZA. */
const delayMsOf = (text: string): number => {
  const match = /^(\d+) segundos$/.exec(text.trim());
  if (!match?.[1]) throw new Error(`celda sin interpretación: retraso «${text}»`);
  return Number(match[1]) * 1_000;
};

/** Gráfica de la celda (con sus comillas) → clave de la lectura del panel y su toggle. */
const CHART_OF_TITLE: ReadonlyMap<string, 'milestones' | 'nc'> = new Map<string, 'milestones' | 'nc'>([
  ['«Hitos cumplidos por programa»', 'milestones'],
  ['«NC abiertas por severidad»', 'nc'],
]);

/** Leyenda de la celda (texto exacto de la historia) → sus nombres, en orden. */
const LEGEND_OF_CELL: ReadonlyMap<string, readonly string[]> = new Map<string, readonly string[]>([
  ['«Cumplidos» y «Pendientes»', ['Cumplidos', 'Pendientes']],
  ['«Menor», «Mayor» y «Crítica»', ['Menor', 'Mayor', 'Crítica']],
]);

/** Gráfica de la celda → testid de su leyenda. */
const LEGEND_TESTID: ReadonlyMap<string, string> = new Map<string, string>([
  ['«Hitos cumplidos por programa»', MOVIL_MISSION_TESTIDS.MISSION_CHART_MILESTONES_LEGEND],
  ['«NC abiertas por severidad»', MOVIL_MISSION_TESTIDS.MISSION_CHART_NC_LEGEND],
]);

/** Severidad de la celda → su fila en la tabla de NC. */
const SEVERITY_LABEL: ReadonlyMap<string, string> = new Map<string, string>([
  ['«Menor»', 'Menor'],
  ['«Mayor»', 'Mayor'],
  ['«Crítica»', 'Crítica'],
]);

// --- Esquema 1: la tabla de hitos muestra cada programa con sus hitos ----------------------------------------------------------

const milestoneTable: BrowserRowHandler = onExpoWeb(async (row, { page }) => {
  await resetTenants([TENANT_A]);
  const code = cell(row, 'programa');
  const expected = `la fila de ${code} muestra ${cell(row, 'cumplidos')} en «Cumplidos» y ${cell(row, 'total')} en «Total»`;
  const opened = await signInTo(page, DEMO.gestor);
  if (opened) return prepFailed(expected, opened);
  const tab = await openMissionTab(page);
  if (tab) return prepFailed(expected, tab);
  await waitUntil(async () => ((await readMobilePanel(page))?.milestones.bars ?? 0) > 0, CEILING_MS);
  const pressed = await runSteps([['pulsar «Ver como tabla» en «Hitos cumplidos por programa»', () => toggleTable(page, 'Hitos cumplidos por programa')]]);
  if (pressed) return actionMissing(expected, pressed);
  await waitUntil(async () => (await readMobileTable(page, MISION_TESTIDS.MISSION_CHART_MILESTONES_TABLE)) !== undefined, CEILING_MS);
  const rows = await readMobileTable(page, MISION_TESTIDS.MISSION_CHART_MILESTONES_TABLE);
  const found = rows?.find((item) => item.key === code);
  const done = found?.cells[0];
  const total = found?.cells[1];
  return conclude([
    check(found !== undefined, `la tabla tiene la fila de ${code}`, found === undefined ? `sin fila de ${code}` : `fila de ${code}`),
    check(done === cell(row, 'cumplidos'), `${code} muestra ${cell(row, 'cumplidos')} en «Cumplidos»`, `«Cumplidos» ${done ?? '(sin leer)'}`),
    check(total === cell(row, 'total'), `${code} muestra ${cell(row, 'total')} en «Total»`, `«Total» ${total ?? '(sin leer)'}`),
  ]);
});

// --- Esquema 2: la tabla de NC muestra el número de cada severidad -------------------------------------------------------------

const ncTable: BrowserRowHandler = onExpoWeb(async (row, { page }) => {
  await resetTenants([TENANT_A]);
  const severity = quoted(cell(row, 'severidad'));
  const label = strict('severidad', SEVERITY_LABEL, cell(row, 'severidad'));
  const expected = `la fila de «${severity}» muestra ${cell(row, 'cantidad')} en «NC abiertas»`;
  const opened = await signInTo(page, DEMO.gestor);
  if (opened) return prepFailed(expected, opened);
  const tab = await openMissionTab(page);
  if (tab) return prepFailed(expected, tab);
  await waitUntil(async () => ((await readMobilePanel(page))?.nc.bars ?? 0) > 0, CEILING_MS);
  const pressed = await runSteps([['pulsar «Ver como tabla» en «NC abiertas por severidad»', () => toggleTable(page, 'NC abiertas por severidad')]]);
  if (pressed) return actionMissing(expected, pressed);
  await waitUntil(async () => (await readMobileTable(page, MISION_TESTIDS.MISSION_CHART_NC_TABLE)) !== undefined, CEILING_MS);
  const rows = await readMobileTable(page, MISION_TESTIDS.MISSION_CHART_NC_TABLE);
  const found = rows?.find((item) => item.key === label);
  const count = found?.cells[0];
  return conclude([
    check(found !== undefined, `la tabla tiene la fila de «${label}»`, found === undefined ? `sin fila de «${label}»` : `fila de «${label}»`),
    check(count === cell(row, 'cantidad'), `«${label}» muestra ${cell(row, 'cantidad')} en «NC abiertas»`, `«NC abiertas» ${count ?? '(sin leer)'}`),
  ]);
});

// --- Esquema 3: cada gráfica muestra su leyenda ----------------------------------------------------------------------------------

const legendOfChart: BrowserRowHandler = onExpoWeb(async (row, { page }) => {
  await resetTenants([TENANT_A]);
  const chart = cell(row, 'grafica');
  const legendTestId = strict('grafica', LEGEND_TESTID, chart);
  const names = strict('leyenda', LEGEND_OF_CELL, cell(row, 'leyenda'));
  const expected = `la gráfica ${chart} muestra la leyenda ${cell(row, 'leyenda')}`;
  const opened = await signInTo(page, DEMO.gestor);
  if (opened) return prepFailed(expected, opened);
  const tab = await openMissionTab(page);
  if (tab) return prepFailed(expected, tab);
  await waitUntil(async () => (await readLegend(page, legendTestId)) !== undefined, CEILING_MS);
  const observed = await readLegend(page, legendTestId);
  return conclude([check(observed !== undefined && observed.length === names.length && observed.every((item, index) => item === names[index]), `la leyenda es ${names.join(', ')}`, `la leyenda es ${observed?.join(', ') ?? '(sin leer)'}`)]);
});

// --- Esquema 4: una gráfica sin datos dice que todavía no hay datos --------------------------------------------------------------

const BULK: ReadonlyMap<string, (token: string) => Promise<Failed | undefined>> = new Map<string, (token: string) => Promise<Failed | undefined>>([
  ['alumno01@sigpro.lab archiva los 12 programas activos con POST /api/programs/:code/archive', archiveActive],
  ['alumno01@sigpro.lab elimina los 24 programas con DELETE /api/programs/:code', removeAll],
]);

const emptyChart: BrowserRowHandler = onExpoWeb(async (row, { page }) => {
  await resetTenants([TENANT_A]);
  const title = cell(row, 'grafica');
  const expected = `la gráfica ${title} muestra «Sin datos todavía» y no dibuja ninguna barra ni ninguna columna`;
  const chart = strict('grafica', CHART_OF_TITLE, title);
  const bulk = strict('cambio', BULK, cell(row, 'cambio'));
  const admin = await adminSession(TENANT_A);
  if (admin.token === undefined) return preparationFailed(expected, 'alumno01@sigpro.lab inicia sesión', admin.last);
  const changed = await bulk(admin.token);
  if (changed !== undefined) return failedPreparation(expected, changed);
  const opened = await signInTo(page, DEMO.gestor);
  if (opened) return prepFailed(expected, opened);
  const tab = await openMissionTab(page);
  if (tab) return prepFailed(expected, tab);
  await waitUntil(async () => (await readMobilePanel(page))?.[chart].present === true, CEILING_MS);
  const view: PanelView | undefined = await readMobilePanel(page);
  const figure = view?.[chart];
  return conclude([
    check(normalized(figure?.empty) === 'Sin datos todavía', `la gráfica ${title} muestra «Sin datos todavía»`, `la gráfica muestra «${normalized(figure?.empty) ?? '(sin leer)'}»`),
    check(figure !== undefined && figure.bars === 0, 'no dibuja ninguna barra ni ninguna columna', figure === undefined ? '(sin leer)' : `dibuja ${figure.bars}`),
  ]);
});

// --- Esquema 5: mientras llega el resumen, las gráficas muestran el texto de carga ----------------------------------------------

const loadingCharts: BrowserRowHandler = onExpoWeb(async (row, { page }) => {
  await resetTenants([TENANT_A]);
  const ms = delayMsOf(cell(row, 'retraso'));
  // El Ejemplo manda («las gráficas muestran «Cargando…» hasta que llega la respuesta»); la Regla («cada gráfica muestra…») se mide y se anota
  const expected = 'mientras llega el resumen, las gráficas muestran «Cargando…» hasta que llega la respuesta';
  const opened = await signInTo(page, DEMO.gestor);
  if (opened) return prepFailed(expected, opened);
  const control = await interceptSummary(page, { kind: 'delay', ms });
  const tab = await openMissionTab(page);
  if (tab) return prepFailed(expected, tab);
  const requested = await waitUntil(async () => control.receivedCount() > 0, CEILING_MS);
  if (!requested.reached) return prepFailedReason(expected, 'la app no pidió el resumen de misión');
  // Una sola lectura atómica: el bloque de carga y el texto de cada figura en el mismo instante
  const loading = await readLoadingSnapshot(page);
  const sinceRequestMs = Date.now() - (control.lastReceivedAt() ?? Date.now());
  // Solo es un fallo del arnés si la lectura llega cuando la respuesta ya debía haber llegado (no se puede observar la carga)
  if (sinceRequestMs >= ms) {
    throw new Error(`la lectura de la carga llegó ${sinceRequestMs} ms después de la petición, con un retraso de ${ms} ms: el plazo de la prueba no permite observar el texto de carga`);
  }
  const sharedText = normalized(loading?.shared);
  const figureTexts = { hitos: loading?.milestonesFigure, nc: loading?.ncFigure };
  const figuresWithText = [figureTexts.hitos, figureTexts.nc].filter((text) => text !== undefined && text.includes('Cargando…')).length;
  const loadingCheck = check(
    sharedText === 'Cargando…' || figuresWithText > 0,
    'mientras llega el resumen, las gráficas muestran «Cargando…»',
    `mientras llega el resumen se muestra «${sharedText ?? '(sin bloque de carga)'}»${figuresWithText > 0 ? ` y ${figuresWithText} de 2 figuras con su texto` : ''}`,
  );
  // «Hasta que llega la respuesta»: el texto de carga desaparece cuando llega
  await waitUntil(async () => (await readLoadingSnapshot(page))?.shared === undefined, ms + CEILING_MS);
  const after = await readLoadingSnapshot(page);
  const goneCheck = check(after?.shared === undefined, 'cuando llega la respuesta, el texto de carga desaparece', after?.shared === undefined ? 'el texto de carga desaparece' : `sigue visible «${normalized(after.shared)}»`);
  const figureSummary = `hitos: ${figureTexts.hitos === undefined ? 'sin figura' : figureTexts.hitos.includes('Cargando…') ? 'con «Cargando…»' : 'sin «Cargando…»'}; NC: ${figureTexts.nc === undefined ? 'sin figura' : figureTexts.nc.includes('Cargando…') ? 'con «Cargando…»' : 'sin «Cargando…»'}`;
  return conclude([loadingCheck, goneCheck], {
    note: `La Regla dice «cada gráfica muestra el texto «Cargando…»»; el Ejemplo, «las gráficas muestran «Cargando…»». Medido figura a figura: ${figuresWithText} de 2 figuras con su texto (${figureSummary}); la app pinta un único estado de carga («${sharedText ?? 'sin bloque'}») para las dos. Se sigue el Ejemplo, según el encargo.`,
    evidence: { retrasoMs: ms, lecturaTrasUltimaPeticionMs: sinceRequestMs, peticiones: control.log(), figurasConTextoDeCarga: figuresWithText, figurasHitos: figureTexts.hitos ?? null, figurasNc: figureTexts.nc ?? null },
  });
});

defineBrowserRows({
  story: 'US-MISION-KPI-011',
  surface: 'expo-web',
  tenants: [TENANT_A],
  handlers: new Map<number, BrowserRowHandler>([
    [1, milestoneTable],
    [2, ncTable],
    [3, legendOfChart],
    [4, emptyChart],
    [5, loadingCharts],
  ]),
});
