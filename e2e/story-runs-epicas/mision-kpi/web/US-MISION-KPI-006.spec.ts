import type { Page } from '@playwright/test';
import { MISION_DYNAMIC_TESTIDS } from '../../../../packages/shared/src/testids';
import { quoted, waitUntil } from '../../support/browser';
import { cell, check, preparationFailed, strict, type Check } from '../../support/checks';
import { defineBrowserRows, type BrowserRowHandler } from '../../core/framework';
import { NC_CHANGES, PROGRAM_CHANGES, RUN_CHANGES, TENANT_A, adminSession, failedPreparation, isOk, resetTenants, type Change } from '../api/common';
import { DEMO } from '../../../story-runs/support/prepare';
import { KPI_IDS, KPI_OF_LABEL, SUBTITLE, actionMissing, conclude, kpiCheck, onWeb, openMission, prepFailed, readPanel, runSteps, signIn, textCheck, waitKpisShown, type PanelView, type StepFailure } from './common';

// US-MISION-KPI-006 — Cuatro indicadores del panel de misión en la web (escritorio 1440 px). Preparación de cada fila: reinicio de
// alumno01 con el token de su administrador; los cambios de una fila (programas, ejecuciones, NC) se hacen con la API y ese mismo
// token antes de abrir la página; gestor@sigpro.test entra desde /login?tenant=alumno01 y abre /mission. Lo esperado sale de la
// historia; la cifra y el detalle se leen de la tarjeta.

/** Cambios de la historia 006 (Esquema 2), por el texto exacto de la celda `cambio`. */
const CHANGES: ReadonlyMap<string, Change> = new Map<string, Change>([...PROGRAM_CHANGES, ...RUN_CHANGES, ...NC_CHANGES]);

// --- Esquema 1: cada tarjeta muestra su cifra y su detalle con los datos del seed ------------------------------------------

const cardOfSeed: BrowserRowHandler = onWeb(async (row, { page }) => {
  await resetTenants([TENANT_A]);
  const label = quoted(cell(row, 'tarjeta'));
  const value = cell(row, 'cifra');
  const sub = quoted(cell(row, 'detalle'));
  const expected = `la tarjeta «${label}» muestra ${value} y debajo «${sub}»; la página se titula «Panel de misión»`;
  const opened = await signIn(page, DEMO.gestor);
  if (opened) return prepFailed(expected, opened);
  const failed = await openMission(page);
  if (failed) return prepFailed(expected, failed);
  await waitKpisShown(page);
  const view = await readPanel(page);
  // Regla 23: cada tarjeta tiene su icono y cada icono muestra un texto (se mide al pasar el puntero, sin fijar su redacción)
  const hovers: Check[] = [];
  for (const [cardLabel, id] of KPI_OF_LABEL) {
    const hovered = await tooltipOfInfo(page, cardLabel, id);
    const shownText = hovered.text ?? '';
    const observed = hovered.failure !== undefined ? hovered.failure.message : shownText === '' ? 'no aparece ningún texto' : 'aparece un texto de explicación';
    hovers.push(check(hovered.failure === undefined && shownText !== '', `el icono de «${cardLabel}» muestra un texto explicativo`, observed));
  }
  const iconCount = view?.kpis.filter((kpi) => kpi.info).length ?? 0;
  return conclude([
    kpiCheck(view, strict('tarjeta', KPI_OF_LABEL, label), label, value, sub),
    textCheck(view?.title, 'Panel de misión', 'la página se titula'),
    textCheck(view?.subtitle, SUBTITLE, 'debajo dice'),
    check(order(view) === KPI_IDS.join(','), 'las cuatro tarjetas van en el orden de la historia: Programas activos, Hitos cumplidos, NC abiertas y Verificación superada', `orden en pantalla: ${view?.order.join(', ') ?? '(sin leer)'}`),
    check(iconCount === 4, 'las cuatro tarjetas tienen su icono de información', `iconos de información: ${iconCount} de 4`),
    ...hovers,
  ]);
});

// --- Esquema 2: las cifras reflejan el tenant cuando se abre la página ----------------------------------------------------

const afterChange: BrowserRowHandler = onWeb(async (row, { page }) => {
  await resetTenants([TENANT_A]);
  const expected = `«Programas activos» muestra ${cell(row, 'activos')}, «Hitos cumplidos» muestra ${cell(row, 'hitos')}, «NC abiertas» muestra ${cell(row, 'nc')} y «Verificación superada» muestra ${cell(row, 'verificacion')}`;
  const change = strict('cambio', CHANGES, cell(row, 'cambio'));
  const admin = await adminSession(TENANT_A);
  if (admin.token === undefined) return preparationFailed(expected, 'alumno01@sigpro.lab inicia sesión', admin.last);
  const done = await change(admin.token);
  if (done !== undefined && !isOk(done)) return failedPreparation(expected, { step: cell(row, 'cambio'), result: done });
  const opened = await signIn(page, DEMO.gestor);
  if (opened) return prepFailed(expected, opened);
  const failed = await openMission(page);
  if (failed) return prepFailed(expected, failed);
  await waitKpisShown(page);
  const view = await readPanel(page);
  return conclude(
    [
      kpiCheck(view, 'programs', 'Programas activos', cell(row, 'activos')),
      kpiCheck(view, 'milestones', 'Hitos cumplidos', cell(row, 'hitos')),
      kpiCheck(view, 'nc', 'NC abiertas', cell(row, 'nc')),
      kpiCheck(view, 'verification', 'Verificación superada', cell(row, 'verificacion')),
    ],
    {
      // Sin eventos en vivo: el cambio se hace con la API antes de abrir la página y la cifra sale del resumen. La conexión Socket.IO y
      // los eventos de misión no se comprueban aquí (son de EP-MISION-FEED).
      note: 'Esta fila no depende de un evento en vivo: el cambio se hace con la API antes de abrir la página. La conexión en tiempo real no se comprueba aquí.',
    },
  );
});

// --- Esquema 3: el icono de información explica cada indicador --------------------------------------------------------------

/**
 * Pasa el puntero sobre el icono «Qué mide …» de la tarjeta (localizado por su nombre accesible) y lee el texto de su tooltip. Un paso
 * que no llega devuelve su fallo; un tooltip que no aparece queda sin texto.
 */
const order = (view: PanelView | undefined): string => view?.order.join(',') ?? '';

const tooltipOfInfo = async (page: Page, label: string, id: string): Promise<{ readonly text?: string; readonly failure?: StepFailure }> => {
  const info = page.getByRole('button', { name: `Qué mide ${label}`, exact: true });
  const failure = await runSteps([[`pasar el puntero sobre el icono de información de «${label}»`, () => info.hover({ timeout: 4_000 })]]);
  if (failure) return { failure };
  const tooltip = page.getByTestId(MISION_DYNAMIC_TESTIDS.MISSION_KPI_TOOLTIP(id));
  const shown = await waitUntil(async () => (await tooltip.count().catch(() => 0)) === 1, 4_000);
  if (!shown.reached) return {};
  return { text: await tooltip.innerText({ timeout: 2_000 }).then((value) => value.trim()).catch(() => undefined) };
};

const infoTooltip: BrowserRowHandler = onWeb(async (row, { page }) => {
  await resetTenants([TENANT_A]);
  const label = quoted(cell(row, 'tarjeta'));
  const text = quoted(cell(row, 'texto'));
  const expected = `al pasar el puntero sobre el icono de información de «${label}» aparece el texto «${text}»`;
  const id = strict('tarjeta', KPI_OF_LABEL, label);
  const opened = await signIn(page, DEMO.gestor);
  if (opened) return prepFailed(expected, opened);
  const failed = await openMission(page);
  if (failed) return prepFailed(expected, failed);
  await waitKpisShown(page);
  const hovered = await tooltipOfInfo(page, label, id);
  if (hovered.failure) return actionMissing(expected, hovered.failure);
  return conclude([check(hovered.text === text, `aparece el texto «${text}»`, hovered.text === undefined ? 'no aparece ningún texto al pasar el puntero' : `aparece «${hovered.text}»`)]);
});

defineBrowserRows({
  story: 'US-MISION-KPI-006',
  surface: 'web',
  tenants: [TENANT_A],
  handlers: new Map<number, BrowserRowHandler>([
    [1, cardOfSeed],
    [2, afterChange],
    [3, infoTooltip],
  ]),
});
