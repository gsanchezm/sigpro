import type { Page } from '@playwright/test';
import { MISION_DYNAMIC_TESTIDS, MISION_TESTIDS } from '../../../../packages/shared/src/testids';
import { ACTION, quoted, waitUntil } from '../../support/browser';
import { cell, check, strict, type Check } from '../../support/checks';
import { defineBrowserRows, type BrowserRowHandler } from '../../core/framework';
import { TENANT_A, resetTenants } from '../api/common';
import { DEMO } from '../../../story-runs/support/prepare';
import { actionMissing, barWidthPercent, conclude, hoverTooltip, onWeb, openMission, prepFailed, readChartStructure, readChartTable, readPanel, runSteps, signIn, waitKpisShown, type StepFailure } from './common';

// US-MISION-KPI-007 — Gráficas del panel de misión en la web: hitos por programa y NC abiertas por severidad, con su vista de tabla
// (escritorio 1440 px). Preparación de cada fila: reinicio de alumno01 con el token de su administrador; gestor@sigpro.test entra desde
// /login?tenant=alumno01 y abre /mission. Los números de la tabla y de los tooltips salen de la historia, no de la pantalla.

const MILESTONES_TITLE = 'Hitos cumplidos por programa';
const NC_TITLE = 'NC abiertas por severidad';
const FIG_MILESTONES = MISION_TESTIDS.MISSION_CHART_MILESTONES;
const TABLE_MILESTONES = MISION_TESTIDS.MISSION_CHART_MILESTONES_TABLE;
const FIG_NC = MISION_TESTIDS.MISSION_CHART_NC;
const TABLE_NC = MISION_TESTIDS.MISSION_CHART_NC_TABLE;

/** Severidad de la celda (con sus comillas) → clave de la NC y clave del tooltip. */
const SEVERITY_KEY: ReadonlyMap<string, string> = new Map<string, string>([
  ['Menor', 'minor'],
  ['Mayor', 'major'],
  ['Crítica', 'critical'],
]);

/**
 * Pulsa «Ver como tabla» dentro de la figura indicada (localizado por rol y nombre). Un clic que no llega devuelve su fallo; la tabla que
 * no aparece queda como lectura vacía, y la comprobación la recoge.
 */
const openTable = async (page: Page, figureTestId: string, tableTestId: string): Promise<StepFailure | undefined> => {
  const failure = await runSteps([['pulsar «Ver como tabla»', () => page.getByTestId(figureTestId).getByRole('button', { name: 'Ver como tabla', exact: true }).click(ACTION)]]);
  if (failure) return failure;
  await waitUntil(async () => (await readChartTable(page, tableTestId)) !== undefined);
  return undefined;
};

/** Las dos vistas de una gráfica (gráfica y tabla) tienen su título, su leyenda, sus columnas y su botón de vista. */
const structureChecks = (before: Awaited<ReturnType<typeof readChartStructure>>, after: Awaited<ReturnType<typeof readChartStructure>>, title: string, headers: string, rows: number): Check[] => [
  check(before?.title === title && after?.title === title, `la gráfica se titula «${title}»`, `título: ${before?.title ?? '(sin leer)'}`),
  check(after?.toggleText === 'Ver como gráfica', 'tras pulsar «Ver como tabla», el botón dice «Ver como gráfica»', `el botón dice «${after?.toggleText ?? '(sin leer)'}»`),
  check(after?.tableHeaders.join('|') === headers, `la tabla tiene las columnas ${headers.split('|').map((item) => `«${item}»`).join(', ')}`, `columnas: ${after?.tableHeaders.join(', ') ?? '(sin tabla)'}`),
  check(after?.tableRows === rows, `la tabla tiene ${rows} filas`, `la tabla tiene ${after?.tableRows ?? 0} filas`),
];

// --- Esquema 1: la tabla de hitos muestra cada programa con sus hitos ----------------------------------------------------

const milestoneTableRow: BrowserRowHandler = onWeb(async (row, { page }) => {
  await resetTenants([TENANT_A]);
  const code = cell(row, 'programa');
  const expected = `la fila de ${code} muestra ${cell(row, 'cumplidos')} en «Cumplidos» y ${cell(row, 'total')} en «Total»`;
  const opened = await signIn(page, DEMO.gestor);
  if (opened) return prepFailed(expected, opened);
  const failed = await openMission(page);
  if (failed) return prepFailed(expected, failed);
  await waitKpisShown(page);
  // Antes de pulsar: la gráfica con su leyenda y el texto «D/T» de cada barra
  const panel = await readPanel(page);
  const before = await readChartStructure(page, FIG_MILESTONES, TABLE_MILESTONES);
  const pressed = await openTable(page, FIG_MILESTONES, TABLE_MILESTONES);
  if (pressed) return actionMissing(expected, pressed);
  const rows = await readChartTable(page, TABLE_MILESTONES);
  const after = await readChartStructure(page, FIG_MILESTONES, TABLE_MILESTONES);
  const found = rows?.find((item) => item.key === code);
  const done = found?.cells[0];
  const total = found?.cells[1];
  const dtText = `${cell(row, 'cumplidos')}/${cell(row, 'total')}`;
  const dt = panel?.milestones.barTexts.find((text) => text.startsWith(code));
  return conclude(
    [
      check(found !== undefined, `la tabla tiene la fila de ${code}`, rows === undefined ? 'la tabla no se pudo leer' : found === undefined ? `sin fila de ${code}` : `fila de ${code}`),
      check(done === cell(row, 'cumplidos'), `${code} muestra ${cell(row, 'cumplidos')} en «Cumplidos»`, `«Cumplidos» ${done ?? '(sin leer)'}`),
      check(total === cell(row, 'total'), `${code} muestra ${cell(row, 'total')} en «Total»`, `«Total» ${total ?? '(sin leer)'}`),
      check(before?.lines.includes('Cumplidos') === true && before.lines.includes('Pendientes') === true, 'la gráfica de hitos tiene la leyenda «Cumplidos» y «Pendientes»', `líneas de la gráfica: ${before?.lines.join(' / ') ?? '(sin leer)'}`),
      check(dt !== undefined && dt.endsWith(dtText), `a la derecha de ${code} aparece el texto «${dtText}»`, `barra: ${dt ?? '(sin leer)'}`),
      ...structureChecks(before, after, MILESTONES_TITLE, 'Programa|Cumplidos|Total', 8),
    ],
    { note: 'La tabla de hitos muestra una fila por programa de la gráfica: la historia lista ocho y la gráfica tiene ocho barras.' },
  );
});

// --- Esquema 2: al pasar el puntero sobre una barra aparece su texto y se ve su anchura ----------------------------------

const barTooltipAndWidth: BrowserRowHandler = onWeb(async (row, { page }) => {
  await resetTenants([TENANT_A]);
  const code = cell(row, 'programa');
  const text = quoted(cell(row, 'texto'));
  const widthText = cell(row, 'anchura');
  if (!/^\d+$/.test(widthText)) throw new Error(`celda sin interpretación: anchura «${widthText}» no es un porcentaje`);
  const width = Number(widthText);
  const dtFromText = /(\d+) de (\d+) hitos/.exec(text);
  if (!dtFromText?.[1] || !dtFromText[2]) throw new Error(`celda sin interpretación: texto «${text}» sin «D de T hitos»`);
  const dtText = `${dtFromText[1]}/${dtFromText[2]}`;
  const expected = `al pasar el puntero sobre la barra de ${code} aparece el texto «${text}» y la barra ocupa el ${width} % del ancho de la gráfica`;
  const opened = await signIn(page, DEMO.gestor);
  if (opened) return prepFailed(expected, opened);
  const failed = await openMission(page);
  if (failed) return prepFailed(expected, failed);
  await waitKpisShown(page);
  const barTestId = MISION_DYNAMIC_TESTIDS.MISSION_BAR_MILESTONES(code);
  const panel = await readPanel(page);
  const hovered = await hoverTooltip(page, barTestId, `milestones-${code}`);
  if (hovered.failure) return actionMissing(expected, hovered.failure);
  const painted = await barWidthPercent(page, barTestId);
  const dt = panel?.milestones.barTexts.find((item) => item.startsWith(code));
  return conclude(
    [
      check(hovered.text === text, `aparece el texto «${text}»`, hovered.text === undefined ? 'no aparece ningún texto al pasar el puntero' : `aparece «${hovered.text}»`),
      check(painted !== undefined && Math.abs(painted - width) <= 1, `la barra ocupa el ${width} % de la pista (±1 %)`, painted === undefined ? 'el ancho no se pudo medir' : `la barra ocupa el ${painted} % de la pista`),
      check(dt !== undefined && dt.endsWith(dtText), `a la derecha de ${code} aparece el texto «${dtText}»`, `barra: ${dt ?? '(sin leer)'}`),
    ],
    {
      note: 'Lectura elegida para el ancho: «el ancho de la gráfica» (Esquema) se mide contra la pista de la barra (la zona entre la etiqueta y el «D/T», el contenedor flexible `Tooltip`), no contra la gráfica entera, porque PRG-009 ocupa la pista entera según la Regla («todo el ancho disponible»). Ambas frases son ambiguas en la historia; la tolerancia de ±1 punto no sale de la historia. Ver el informe.',
    },
  );
});

// --- Esquema 3: la tabla de NC muestra el número de cada severidad ------------------------------------------------------------

const ncTableRow: BrowserRowHandler = onWeb(async (row, { page }) => {
  await resetTenants([TENANT_A]);
  const severity = quoted(cell(row, 'severidad'));
  const expected = `la fila de «${severity}» muestra ${cell(row, 'cantidad')} en «NC abiertas»`;
  strict('severidad', SEVERITY_KEY, severity);
  const opened = await signIn(page, DEMO.gestor);
  if (opened) return prepFailed(expected, opened);
  const failed = await openMission(page);
  if (failed) return prepFailed(expected, failed);
  await waitKpisShown(page);
  const before = await readChartStructure(page, FIG_NC, TABLE_NC);
  const pressed = await openTable(page, FIG_NC, TABLE_NC);
  if (pressed) return actionMissing(expected, pressed);
  const rows = await readChartTable(page, TABLE_NC);
  const after = await readChartStructure(page, FIG_NC, TABLE_NC);
  const found = rows?.find((item) => item.key === severity);
  const count = found?.cells[0];
  return conclude(
    [
      check(found !== undefined, `la tabla tiene la fila de «${severity}»`, rows === undefined ? 'la tabla no se pudo leer' : found === undefined ? `sin fila de «${severity}»` : `fila de «${severity}»`),
      check(count === cell(row, 'cantidad'), `«${severity}» muestra ${cell(row, 'cantidad')} en «NC abiertas»`, `«NC abiertas» ${count ?? '(sin leer)'}`),
      ...structureChecks(before, after, NC_TITLE, 'Severidad|NC abiertas', 3),
    ],
    { note: 'Las tres severidades de la tabla son «Menor», «Mayor» y «Crítica», una fila cada una, como dice la historia.' },
  );
});

// --- Esquema 4: al pasar el puntero sobre una columna de NC aparece su texto --------------------------------------------------

const columnTooltip: BrowserRowHandler = onWeb(async (row, { page }) => {
  await resetTenants([TENANT_A]);
  const severity = quoted(cell(row, 'severidad'));
  const text = quoted(cell(row, 'texto'));
  const expected = `al pasar el puntero sobre la columna de «${severity}» aparece el texto «${text}»`;
  const key = strict('severidad', SEVERITY_KEY, severity);
  const countFromText = /: (\d+) NC abiertas/.exec(text)?.[1];
  if (countFromText === undefined) throw new Error(`celda sin interpretación: texto «${text}» sin «: N NC abiertas»`);
  const opened = await signIn(page, DEMO.gestor);
  if (opened) return prepFailed(expected, opened);
  const failed = await openMission(page);
  if (failed) return prepFailed(expected, failed);
  await waitKpisShown(page);
  const panel = await readPanel(page);
  const hovered = await hoverTooltip(page, MISION_DYNAMIC_TESTIDS.MISSION_BAR_NC(key), `nc-${key}`);
  if (hovered.failure) return actionMissing(expected, hovered.failure);
  // Regla 21: el número de cada columna va encima de ella, y coincide con la cifra de su texto
  const above = panel?.nc.barTexts.find((item) => item.endsWith(` ${severity.replace(/^«|»$/g, '')}`));
  return conclude(
    [
      check(hovered.text === text, `aparece el texto «${text}»`, hovered.text === undefined ? 'no aparece ningún texto al pasar el puntero' : `aparece «${hovered.text}»`),
      check(above !== undefined && above.split(' ')[0] === countFromText, `encima de la columna de «${severity}» aparece ${countFromText}`, `la columna muestra «${above ?? '(sin leer)'}»`),
      check(panel?.nc.title === NC_TITLE, `la gráfica se titula «${NC_TITLE}»`, `título: ${panel?.nc.title ?? '(sin leer)'}`),
    ],
  );
});

defineBrowserRows({
  story: 'US-MISION-KPI-007',
  surface: 'web',
  tenants: [TENANT_A],
  handlers: new Map<number, BrowserRowHandler>([
    [1, milestoneTableRow],
    [2, barTooltipAndWidth],
    [3, ncTableRow],
    [4, columnTooltip],
  ]),
});
