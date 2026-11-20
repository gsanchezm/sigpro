import { MISION_TESTIDS } from '../../../../packages/shared/src/testids';
import { CEILING_MS, quoted, safe, waitUntil } from '../../support/browser';
import { conclude } from '../web/common';
import { cell, check, strict, type Check } from '../../support/checks';
import { defineBrowserRows, type BrowserRowHandler } from '../../core/framework';
import { TENANT_A, resetTenants } from '../api/common';
import { DEMO } from '../../../story-runs/support/prepare';
import { runSteps, KPI_OF_LABEL, actionMissing, interceptSummary, kpiCheck, normalized, prepFailed, prepFailedReason, type Mode, type KpiView, type PanelView } from '../web/common';
import { closeSheet, onExpoWeb, openMissionTab, pressKpiInfo, readMobilePanel, readSheet, sheetOpenWithin, signInTo, waitMobileKpisShown } from './common';

// US-MISION-KPI-010 — Cuatro indicadores del panel de misión en la app móvil (web de Expo a 390 px; NO es nativo). Preparación de cada
// fila: reinicio de alumno01 con el token de su administrador; la app se abre sin sesión, se escribe alumno01 en «Tenant de trabajo»,
// la cuenta de la fila inicia sesión y se abre la pestaña «Misión». La demora y el fallo del resumen los provoca la prueba.

/** «3 segundos» → 3000 ms. Otra forma LANZA. */
const delayMsOf = (text: string): number => {
  const match = /^(\d+) segundos$/.exec(text.trim());
  if (!match?.[1]) throw new Error(`celda sin interpretación: retraso «${text}»`);
  return Number(match[1]) * 1_000;
};

const LOADING_VALUE = '…';

// --- Esquema 1: cada tarjeta muestra su cifra y su detalle con los datos del seed ----------------------------------------------

const cardOfSeed: BrowserRowHandler = onExpoWeb(async (row, { page }) => {
  await resetTenants([TENANT_A]);
  const label = quoted(cell(row, 'tarjeta'));
  const value = cell(row, 'cifra');
  const sub = quoted(cell(row, 'detalle'));
  const expected = `la tarjeta «${label}» muestra ${value} y debajo «${sub}»`;
  const opened = await signInTo(page, DEMO.gestor);
  if (opened) return prepFailed(expected, opened);
  const tab = await openMissionTab(page);
  if (tab) return prepFailed(expected, tab);
  await waitMobileKpisShown(page);
  return conclude([kpiCheck(await readMobilePanel(page), strict('tarjeta', KPI_OF_LABEL, label), label, value, sub)]);
});

// --- Esquema 2: el «i» de cada tarjeta abre una hoja que explica el indicador -------------------------------------------------

const sheetOfCard: BrowserRowHandler = onExpoWeb(async (row, { page }) => {
  await resetTenants([TENANT_A]);
  const label = quoted(cell(row, 'tarjeta'));
  const title = quoted(cell(row, 'titulo_hoja'));
  const text = quoted(cell(row, 'texto'));
  const expected = `se abre una hoja titulada «${title}» con el texto «${text}», y al pulsar «Cerrar» la hoja se cierra`;
  const id = strict('tarjeta', KPI_OF_LABEL, label);
  const opened = await signInTo(page, DEMO.gestor);
  if (opened) return prepFailed(expected, opened);
  const tab = await openMissionTab(page);
  if (tab) return prepFailed(expected, tab);
  await waitMobileKpisShown(page);
  const pressed = await runSteps([[`pulsar el «i» de «${label}»`, () => pressKpiInfo(page, label)]]);
  if (pressed) return actionMissing(expected, pressed);
  const sheetOpen = await sheetOpenWithin(page, true);
  const sheet = await readSheet(page, id);
  const sheetChecks: Check[] = [
    check(sheetOpen && sheet.title === title, `se abre una hoja titulada «${title}»`, sheetOpen ? `la hoja se titula «${sheet.title ?? '(sin leer)'}»` : 'no se abre ninguna hoja'),
    check(sheetOpen && normalized(sheet.text) === text, `la hoja dice «${text}»`, `la hoja dice «${normalized(sheet.text) ?? '(sin leer)'}»`),
  ];
  const closed = await runSteps([['pulsar «Cerrar»', () => closeSheet(page)]]);
  if (closed) return actionMissing(expected, closed);
  const gone = await sheetOpenWithin(page, false);
  return conclude([...sheetChecks, check(gone, 'al pulsar «Cerrar» la hoja se cierra', gone ? 'la hoja se cierra' : 'la hoja sigue abierta')]);
});

// --- Esquema 3: antes de llegar el resumen, las tarjetas muestran puntos suspensivos ------------------------------------------

const delayedCards: BrowserRowHandler = onExpoWeb(async (row, { page }) => {
  await resetTenants([TENANT_A]);
  const ms = delayMsOf(cell(row, 'retraso'));
  const expected = `cada tarjeta muestra «${LOADING_VALUE}» en lugar de su cifra y no muestra ningún detalle; cuando llega la respuesta, «Programas activos» muestra 12`;
  const opened = await signInTo(page, DEMO.gestor);
  if (opened) return prepFailed(expected, opened);
  const control = await interceptSummary(page, { kind: 'delay', ms });
  const tab = await openMissionTab(page);
  if (tab) return prepFailed(expected, tab);
  const requested = await waitUntil(async () => control.receivedCount() > 0, CEILING_MS);
  if (!requested.reached) return prepFailedReason(expected, 'la app no pidió el resumen de misión');
  const loading: PanelView | undefined = await readMobilePanel(page);
  const sinceRequestMs = Date.now() - (control.lastReceivedAt() ?? Date.now());
  if (loading?.kpis.some((kpi: KpiView) => kpi.value !== undefined && kpi.value !== LOADING_VALUE)) {
    throw new Error(`la lectura de la carga llegó ${sinceRequestMs} ms después de la petición, con un retraso de ${ms} ms: el plazo de la prueba no permite observar «${LOADING_VALUE}»`);
  }
  const loadingChecks: Check[] = ['programs', 'milestones', 'nc', 'verification'].map((id) => {
    const kpi = loading?.kpis.find((item) => item.id === id);
    return check(
      kpi?.present === true && kpi.value === LOADING_VALUE && kpi.lines.length === 2,
      `la tarjeta ${id} muestra «${LOADING_VALUE}» y no muestra detalle`,
      kpi?.present === true ? `la tarjeta ${id} muestra «${kpi.value ?? '(sin cifra)'}» y lleva ${kpi.lines.length} líneas visibles (${kpi.lines.join(' / ')})` : `la tarjeta ${id} no aparece`,
    );
  });
  await waitMobileKpisShown(page, ms + CEILING_MS);
  const settled = await readMobilePanel(page);
  return conclude([...loadingChecks, kpiCheck(settled, 'programs', 'Programas activos', '12')], {
    evidence: { retrasoMs: ms, lecturaTrasUltimaPeticionMs: sinceRequestMs, peticiones: control.log() },
  });
});

// --- Esquema 4: si el resumen no se puede cargar, aparece el aviso de error y se puede reintentar -----------------------------

const FAULTS: ReadonlyMap<string, Mode> = new Map<string, Mode>([
  ['responde con error 503', { kind: 'http', status: 503 }],
  ['no recibe ninguna respuesta (sin conexión)', { kind: 'abort' }],
]);

const failedCards: BrowserRowHandler = onExpoWeb(async (row, { page }) => {
  await resetTenants([TENANT_A]);
  const mode = strict('fallo', FAULTS, cell(row, 'fallo'));
  const expected = 've el aviso «No se pudo cargar el panel de misión» y el botón «Reintentar»';
  const opened = await signInTo(page, DEMO.gestor);
  if (opened) return prepFailed(expected, opened);
  await interceptSummary(page, mode);
  const tab = await openMissionTab(page);
  if (tab) return prepFailed(expected, tab);
  await waitUntil(async () => (await readMobilePanel(page))?.errorVisible === true, CEILING_MS);
  const view = await readMobilePanel(page);
  const retryText = normalized(await safe(() => page.getByTestId(MISION_TESTIDS.MISSION_ERROR_RETRY).innerText({ timeout: 2_000 }), undefined));
  return conclude([
    check(normalized(view?.errorTitle) === 'No se pudo cargar el panel de misión', 've el aviso «No se pudo cargar el panel de misión»', `el aviso dice «${normalized(view?.errorTitle) ?? '(sin leer)'}»`),
    check(view?.retryVisible === true && retryText === 'Reintentar', 've el botón «Reintentar»', `el botón dice «${retryText ?? '(sin leer)'}»`),
  ]);
});

defineBrowserRows({
  story: 'US-MISION-KPI-010',
  surface: 'expo-web',
  tenants: [TENANT_A],
  handlers: new Map<number, BrowserRowHandler>([
    [1, cardOfSeed],
    [2, sheetOfCard],
    [3, delayedCards],
    [4, failedCards],
  ]),
});
