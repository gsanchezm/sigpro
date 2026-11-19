import type { Page } from '@playwright/test';
import { MISION_DYNAMIC_TESTIDS, MISION_TESTIDS } from '../../../../packages/shared/src/testids';
import { ACTION, quoted, waitUntil } from '../../support/browser';
import { cell, check, strict, type Check } from '../../support/checks';
import { defineBrowserRows, type BrowserRowHandler } from '../../core/framework';
import { TENANT_A, resetTenants } from '../api/common';
import { DEMO } from '../../../story-runs/support/prepare';
import { barWidthPercent, hoverTooltip, onWeb, openMission, prepFailed, readChartTable, runSteps, signIn, waitKpisShown, actionMissing, conclude, type StepFailure } from './common';

// US-MISION-KPI-007 — Gráficas del panel de misión en la web: hitos por programa y NC abiertas por severidad, con su vista de tabla
// (escritorio 1440 px). Preparación de cada fila: reinicio de alumno01 con el token de su administrador; gestor@sigpro.test entra desde
// /login?tenant=alumno01 y abre /mission. Los números de la tabla y de los tooltips salen de la historia, no de la pantalla.

/** Severidad de la celda (con sus comillas) → clave de la NC y clave del tooltip. */
const SEVERITY_KEY: ReadonlyMap<string, string> = new Map<string, string>([
  ['Menor', 'minor'],
  ['Mayor', 'major'],
  ['Crítica', 'critical'],
]);

/**
 * Pulsa «Ver como tabla» en la figura indicada (localizada por rol y nombre dentro de su figura) y espera a que la tabla esté a la vista.
 * Un clic que no llega devuelve su fallo; una tabla que no aparece queda como lectura vacía (la comprobación la recoge).
 */
const openTable = async (page: Page, figureTestId: string, tableTestId: string): Promise<StepFailure | undefined> => {
  const failure = await runSteps([['pulsar «Ver como tabla»', () => page.getByTestId(figureTestId).getByRole('button', { name: 'Ver como tabla', exact: true }).click(ACTION)]]);
  if (failure) return failure;
  await waitUntil(async () => (await readChartTable(page, tableTestId)) !== undefined);
  return undefined;
};

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
  const pressed = await openTable(page, MISION_TESTIDS.MISSION_CHART_MILESTONES, MISION_TESTIDS.MISSION_CHART_MILESTONES_TABLE);
  if (pressed) return actionMissing(expected, pressed);
  const rows = await readChartTable(page, MISION_TESTIDS.MISSION_CHART_MILESTONES_TABLE);
  const found = rows?.find((item) => item.key === code);
  const done = found?.cells[0];
  const total = found?.cells[1];
  return conclude([
    check(found !== undefined, `la tabla tiene la fila de ${code}`, rows === undefined ? 'la tabla no se pudo leer' : found === undefined ? `sin fila de ${code}` : `fila de ${code}`),
    check(done === cell(row, 'cumplidos'), `${code} muestra ${cell(row, 'cumplidos')} en «Cumplidos»`, `«Cumplidos» ${done ?? '(sin leer)'}`),
    check(total === cell(row, 'total'), `${code} muestra ${cell(row, 'total')} en «Total»`, `«Total» ${total ?? '(sin leer)'}`),
  ]);
});

// --- Esquema 2: al pasar el puntero sobre una barra aparece su texto y se ve su anchura ----------------------------------

const barTooltipAndWidth: BrowserRowHandler = onWeb(async (row, { page }) => {
  await resetTenants([TENANT_A]);
  const code = cell(row, 'programa');
  const text = quoted(cell(row, 'texto'));
  const widthText = cell(row, 'anchura');
  if (!/^\d+$/.test(widthText)) throw new Error(`celda sin interpretación: anchura «${widthText}» no es un porcentaje`);
  const width = Number(widthText);
  const expected = `al pasar el puntero sobre la barra de ${code} aparece el texto «${text}» y la barra ocupa el ${width} % del ancho de la gráfica`;
  const opened = await signIn(page, DEMO.gestor);
  if (opened) return prepFailed(expected, opened);
  const failed = await openMission(page);
  if (failed) return prepFailed(expected, failed);
  await waitKpisShown(page);
  const barTestId = MISION_DYNAMIC_TESTIDS.MISSION_BAR_MILESTONES(code);
  const hovered = await hoverTooltip(page, barTestId, `milestones-${code}`);
  if (hovered.failure) return actionMissing(expected, hovered.failure);
  const painted = await barWidthPercent(page, barTestId);
  const widthCheck: Check = check(
    painted !== undefined && Math.abs(painted - width) <= 1,
    `la barra ocupa el ${width} % de la pista (±1 %)`,
    painted === undefined ? 'el ancho no se pudo medir' : `la barra ocupa el ${painted} % de la pista`,
  );
  return conclude([check(hovered.text === text, `aparece el texto «${text}»`, hovered.text === undefined ? 'no aparece ningún texto al pasar el puntero' : `aparece «${hovered.text}»`), widthCheck], {
    note: 'El «ancho de la gráfica» se mide como la pista de la barra (la zona entre la etiqueta del programa y el «D/T»): PRG-009, con el máximo de hitos, ocupa la pista entera.',
  });
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
  const pressed = await openTable(page, MISION_TESTIDS.MISSION_CHART_NC, MISION_TESTIDS.MISSION_CHART_NC_TABLE);
  if (pressed) return actionMissing(expected, pressed);
  const rows = await readChartTable(page, MISION_TESTIDS.MISSION_CHART_NC_TABLE);
  const found = rows?.find((item) => item.key === severity);
  const count = found?.cells[0];
  return conclude([
    check(found !== undefined, `la tabla tiene la fila de «${severity}»`, rows === undefined ? 'la tabla no se pudo leer' : found === undefined ? `sin fila de «${severity}»` : `fila de «${severity}»`),
    check(count === cell(row, 'cantidad'), `«${severity}» muestra ${cell(row, 'cantidad')} en «NC abiertas»`, `«NC abiertas» ${count ?? '(sin leer)'}`),
  ]);
});

// --- Esquema 4: al pasar el puntero sobre una columna de NC aparece su texto --------------------------------------------------

const columnTooltip: BrowserRowHandler = onWeb(async (row, { page }) => {
  await resetTenants([TENANT_A]);
  const severity = quoted(cell(row, 'severidad'));
  const text = quoted(cell(row, 'texto'));
  const expected = `al pasar el puntero sobre la columna de «${severity}» aparece el texto «${text}»`;
  const key = strict('severidad', SEVERITY_KEY, severity);
  const opened = await signIn(page, DEMO.gestor);
  if (opened) return prepFailed(expected, opened);
  const failed = await openMission(page);
  if (failed) return prepFailed(expected, failed);
  await waitKpisShown(page);
  const hovered = await hoverTooltip(page, MISION_DYNAMIC_TESTIDS.MISSION_BAR_NC(key), `nc-${key}`);
  if (hovered.failure) return actionMissing(expected, hovered.failure);
  return conclude([check(hovered.text === text, `aparece el texto «${text}»`, hovered.text === undefined ? 'no aparece ningún texto al pasar el puntero' : `aparece «${hovered.text}»`)]);
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
