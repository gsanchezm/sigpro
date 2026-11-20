import type { Page } from '@playwright/test';
import { MISION_TESTIDS, MOVIL_MISSION_TESTIDS, PROGRAMAS_DYNAMIC_TESTIDS, MISION_DYNAMIC_TESTIDS } from '../../../../packages/shared/src/testids';
import { ACTION, CEILING_MS, safe, waitUntil } from '../../support/browser';
import { check, type Check } from '../../support/checks';
import type { BrowserRowHandler } from '../../core/framework';
import { TENANT_A, type Credentials } from '../../../story-runs/support/prepare';
import { recordToasts, runSteps, TOAST_KEY, type PanelView, type StepFailure, type ChartView, type KpiView, normalized } from '../web/common';

// Piezas comunes de las filas de la app móvil de EP-MISION-KPI. La app se ejecuta como web de Expo a 390 × 844: NO es iOS ni Android
// nativo, y cada veredicto vale para Expo web. Las tarjetas son grupos con su nombre accesible; las gráficas, figuras con su título; la
// tabla y la leyenda, vistas con sus roles. Los avisos se leen del registro instalado antes de la acción (`recordToasts`).

/** Salvedad de plataforma: el veredicto de una fila móvil vale para Expo web, no para iOS ni Android nativo. */
export const EXPO_NOTE = 'El veredicto vale para Expo web (390 × 844): no se ha comprobado en iOS ni en Android nativo.';

/** Añade a cada resultado de la fila la salvedad de plataforma. */
export const onExpoWeb =
  (handler: BrowserRowHandler): BrowserRowHandler =>
  async (row, fixtures) => {
    const result = await handler(row, fixtures);
    return { ...result, note: result.note === undefined ? EXPO_NOTE : `${result.note} ${EXPO_NOTE}` };
  };

export const LOGIN_PATH = '/login';
export const TENANT_TEXT = 'Tenant de trabajo';
export const TAB_KEY = 'mission';
/** Nombre accesible del botón de emitir (el mismo texto que el visible). */
export const EMIT_LABEL = 'Emitir evento de prueba';

/** Clave de la pestaña «Misión» (su id de prueba: `mobile-tab-mission`). */
const tabOf = (page: Page) => page.getByRole('tab', { name: 'Panel de misión', exact: true }).or(page.getByTestId(PROGRAMAS_DYNAMIC_TESTIDS.MOBILE_TAB(TAB_KEY)));

const textbox = (page: Page, name: string) => page.getByRole('textbox', { name, exact: true });
const buttonNamed = (page: Page, name: string) => page.getByRole('button', { name, exact: true });

/**
 * Inicio de sesión en la app: instala antes el registro de avisos, escribe alumno01 en «Tenant de trabajo», la cuenta de la fila, y llega
 * a /programs. NO espera a que el panel de misión cargue: cada fila decide qué observa y cuándo.
 */
export const signInTo = (page: Page, credentials: Credentials): Promise<StepFailure | undefined> =>
  runSteps([
    ['instalar el registro de avisos', () => page.context().addInitScript(recordToasts, TOAST_KEY)],
    ['abrir /login', () => page.goto(LOGIN_PATH, { timeout: CEILING_MS })],
    ['ver el título «Iniciar sesión»', () => page.getByRole('heading', { name: 'Iniciar sesión', level: 1, exact: true }).waitFor({ timeout: CEILING_MS })],
    [`escribir ${TENANT_TEXT}`, () => textbox(page, TENANT_TEXT).fill(TENANT_A, ACTION)],
    ['escribir el correo', () => textbox(page, 'Correo electrónico').fill(credentials.email, ACTION)],
    ['escribir la contraseña', () => textbox(page, 'Contraseña').fill(credentials.password, ACTION)],
    ['pulsar «Entrar»', () => buttonNamed(page, 'Entrar').click(ACTION)],
    ['llegar a /programs', () => page.getByRole('heading', { name: 'Programas', level: 1, exact: true }).waitFor({ timeout: CEILING_MS })],
  ]);

/** Abre la pestaña «Misión» de la barra inferior (la pantalla se monta al pulsarla). */
export const openMissionTab = (page: Page): Promise<StepFailure | undefined> =>
  runSteps([
    ['pulsar la pestaña «Misión»', () => tabOf(page).click(ACTION)],
    ['ver la pantalla del panel de misión', () => page.getByTestId(MISION_TESTIDS.MISSION_PAGE).waitFor({ timeout: CEILING_MS })],
  ]);

// --- Lectura atómica del panel móvil ----------------------------------------------------------------------------------------

const MOBILE_IDS = {
  kpis: MISION_TESTIDS.MISSION_KPIS,
  kpi: 'mission-kpi-',
  value: 'mission-kpi-value-',
  info: 'mission-kpi-info-',
  kpiIds: ['programs', 'milestones', 'nc', 'verification'] as const,
  figMilestones: MISION_TESTIDS.MISSION_CHART_MILESTONES,
  figNc: MISION_TESTIDS.MISSION_CHART_NC,
  emptyMilestones: MISION_TESTIDS.MISSION_CHART_EMPTY,
  emptyNc: MOVIL_MISSION_TESTIDS.MISSION_CHART_NC_EMPTY,
  barMilestones: 'mission-bar-milestones-',
  barNc: 'mission-bar-nc-',
  loading: MOVIL_MISSION_TESTIDS.MISSION_CHARTS_LOADING,
  error: MISION_TESTIDS.MISSION_ERROR,
  retry: MISION_TESTIDS.MISSION_ERROR_RETRY,
} as const;

/**
 * Lee el panel móvil en UNA evaluación, con la misma forma que la web (`PanelView`): tarjetas (su nombre accesible, sus líneas visibles
 * sin el icono «i», su cifra y si tiene su icono), orden de las tarjetas, gráficas (figura, barras con su texto, título, texto vacío y
 * texto completo) y bloque de carga y aviso de error. Un fallo de lectura devuelve `undefined`.
 */
export const readMobilePanel = (page: Page): Promise<PanelView | undefined> =>
  safe(
    () =>
      page.evaluate((ids: typeof MOBILE_IDS) => {
        const byTestId = (id: string): HTMLElement | null => document.querySelector<HTMLElement>(`[data-testid="${id}"]`);
        const textOf = (element: Element | null | undefined): string | undefined => (element ? (element.textContent ?? '').replace(/\u00a0/g, ' ').trim() : undefined);
        // El icono «i» de cada tarjeta es texto visible: no forma parte de la línea de la cifra ni del detalle
        const linesOf = (element: HTMLElement | null | undefined): string[] =>
          element
            ? element.innerText
                .split('\n')
                .map((line) => line.replace(/\s+/g, ' ').trim())
                .filter((line) => line !== '' && line !== 'i')
            : [];
        const kpis = ids.kpiIds.map((id) => {
          const group = byTestId(`${ids.kpi}${id}`);
          if (!group) return { id, present: false, lines: [] as string[], info: false };
          return {
            id,
            present: true,
            label: group.getAttribute('aria-label') ?? undefined,
            value: textOf(byTestId(`${ids.value}${id}`)),
            lines: linesOf(group),
            info: byTestId(`${ids.info}${id}`) !== null,
          };
        });
        const order = Array.from(document.querySelectorAll<HTMLElement>('[data-testid]'))
          .map((element) => element.getAttribute('data-testid') ?? '')
          .filter((testId) => ids.kpiIds.some((id) => testId === `${ids.kpi}${id}`))
          .map((testId) => testId.slice(ids.kpi.length));
        const chart = (figureId: string, barPrefix: string, emptyId: string) => {
          const figure = byTestId(figureId);
          if (!figure) return { present: false, bars: 0, barTexts: [] as string[] };
          // Cada barra móvil es una imagen con su texto de valor en el nombre accesible («PRG-001: 1 de 9 hitos cumplidos»)
          const bars = Array.from(figure.querySelectorAll<HTMLElement>(`[data-testid^="${barPrefix}"]`));
          return {
            present: true,
            bars: bars.length,
            barTexts: bars.map((bar) => bar.getAttribute('aria-label') ?? ''),
            empty: textOf(figure.querySelector(`[data-testid="${emptyId}"]`)),
            title: figure.getAttribute('aria-label') ?? undefined,
            text: linesOf(figure).join(' | '),
          };
        };
        const errorElement = byTestId(ids.error);
        const errorLines = linesOf(errorElement);
        const kpiSection = byTestId(ids.kpis);
        return {
          kpis,
          order,
          kpisBusy: kpiSection?.getAttribute('aria-busy') ?? undefined,
          milestones: chart(ids.figMilestones, ids.barMilestones, ids.emptyMilestones),
          nc: chart(ids.figNc, ids.barNc, ids.emptyNc),
          loadingBlocks: byTestId(ids.loading) === null ? 0 : 1,
          skeletons: 0,
          errorVisible: errorElement !== null,
          errorTitle: errorLines[0],
          errorTrace: errorLines[1],
          retryVisible: byTestId(ids.retry) !== null,
        };
      }, MOBILE_IDS) as Promise<PanelView>,
    undefined,
  );

/** Lo que se ve mientras llega el resumen, leído en UNA evaluación: el bloque compartido y el texto de cada figura (`undefined` si no existe). */
export interface LoadingSnapshot {
  readonly shared?: string;
  readonly milestonesFigure?: string;
  readonly ncFigure?: string;
}

export const readLoadingSnapshot = (page: Page): Promise<LoadingSnapshot | undefined> =>
  safe(
    () =>
      page.evaluate(
        (ids: { readonly loading: string; readonly milestones: string; readonly nc: string }) => {
          const textOf = (testId: string): string | undefined => {
            const element = document.querySelector<HTMLElement>(`[data-testid="${testId}"]`);
            return element ? element.innerText.replace(/\s+/g, ' ').trim() : undefined;
          };
          return { shared: textOf(ids.loading), milestonesFigure: textOf(ids.milestones), ncFigure: textOf(ids.nc) };
        },
        { loading: MOVIL_MISSION_TESTIDS.MISSION_CHARTS_LOADING, milestones: MISION_TESTIDS.MISSION_CHART_MILESTONES, nc: MISION_TESTIDS.MISSION_CHART_NC },
      ),
    undefined,
  );

/**
 * Espera (con techo) a que las cuatro tarjetas tengan la cifra del resumen: ni «…» (carga) ni ausencia (error). Sin esto, la espera
 * terminaría en el primer sondeo, porque «…» también es un valor pintado.
 */
export const waitMobileKpisShown = async (page: Page, ceilingMs: number = CEILING_MS): Promise<boolean> =>
  (
    await waitUntil(async () => {
      const view = await readMobilePanel(page);
      return view !== undefined && !view.errorVisible && view.kpis.every((kpi) => kpi.present && kpi.value !== undefined && kpi.value !== '…');
    }, ceilingMs)
  ).reached;

// --- Simulador: botón y motivo -----------------------------------------------------------------------------------------------

export interface SimulateReading {
  readonly enabled: boolean | undefined;
  /** Texto visible del motivo debajo del botón (solo si lo hay). */
  readonly reasonText: string | undefined;
  /** Motivo debajo del botón: ¿está más abajo que el propio botón? (`undefined` si no se puede medir). */
  readonly reasonBelow: boolean | undefined;
  /** Atributo `aria-busy` del botón («true» mientras la emisión está en curso). */
  readonly busy: string | undefined;
}

export const readSimulate = (page: Page): Promise<SimulateReading | undefined> =>
  safe(
    async () => {
      const button = page.getByRole('button', { name: EMIT_LABEL, exact: true });
      const disabled = await safe(() => button.isDisabled({ timeout: 2_000 }), undefined);
      const reason = page.getByTestId(MOVIL_MISSION_TESTIDS.MISSION_SIMULATE_REASON);
      const reasonCount = await safe(() => reason.count(), -1);
      const reasonText = reasonCount === 1 ? normalized(await safe(() => reason.innerText({ timeout: 1_000 }), undefined)) : undefined;
      const buttonBox = await safe(() => button.boundingBox({ timeout: 1_000 }), null);
      const reasonBox = reasonCount === 1 ? await safe(() => reason.boundingBox({ timeout: 1_000 }), null) : null;
      const reasonBelow = buttonBox !== null && reasonBox !== null ? reasonBox.y >= buttonBox.y + buttonBox.height - 1 : undefined;
      const busy = await safe(() => button.getAttribute('aria-busy', { timeout: 1_000 }), undefined);
      return { enabled: disabled === undefined ? undefined : !disabled, reasonText, reasonBelow, busy: busy ?? undefined };
    },
    undefined,
  );

/** Estado del botón de emitir: habilitado, o deshabilitado con su motivo debajo. */
export const simulateStateCheck = (reading: SimulateReading | undefined, enabled: boolean, reason: string | undefined, label: string): Check => {
  if (enabled) {
    return check(reading?.enabled === true && reading.reasonText === undefined, `el botón «${label}» está habilitado`, `el botón «${label}» ${reading?.enabled === undefined ? '(sin leer)' : reading.enabled ? 'está habilitado' : 'está deshabilitado'}`);
  }
  return check(
    reading?.enabled === false && reading.reasonText === reason && reading.reasonBelow === true,
    `el botón «${label}» está deshabilitado y debajo se lee «${reason ?? ''}»`,
    `el botón «${label}» ${reading?.enabled === undefined ? '(sin leer)' : reading.enabled ? 'está habilitado' : 'está deshabilitado'}; debajo se lee «${reading?.reasonText ?? '(nada)'}»${reading?.reasonBelow === false ? ' (encima del botón)' : ''}`,
  );
};

// --- Hojas, tablas y leyendas ---------------------------------------------------------------------------------------------

/** Filas de una tabla de la vista de tabla móvil: su cabecera de fila y sus celdas. */
export interface MobileRow {
  readonly key: string;
  readonly cells: readonly string[];
}

/** Filas (role=row) de una tabla móvil, excluida la fila de cabeceras. */
export const readMobileTable = (page: Page, tableTestId: string): Promise<readonly MobileRow[] | undefined> =>
  safe(
    () =>
      page.evaluate((id: string) => {
        const table = document.querySelector<HTMLElement>(`[data-testid="${id}"]`);
        if (!table) return undefined;
        return Array.from(table.querySelectorAll('[role="row"]'))
          .filter((row) => row.querySelector('[role="rowheader"]') !== null)
          .map((row) => ({
            key: (row.querySelector('[role="rowheader"]')?.textContent ?? '').trim(),
            cells: Array.from(row.querySelectorAll('[role="cell"]')).map((cell) => (cell.textContent ?? '').trim()),
          }));
      }, tableTestId),
    undefined,
  );

/** Textos de la leyenda de una gráfica, en orden. */
export const readLegend = (page: Page, legendTestId: string): Promise<readonly string[] | undefined> =>
  safe(async () => {
    const text = await page.getByTestId(legendTestId).innerText({ timeout: 1_000 });
    return text
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line !== '');
  }, undefined);

/** Pulsa «Ver como tabla» dentro de la tarjeta de la gráfica con ese título (localizada por su grupo con nombre accesible). */
export const toggleTable = (page: Page, chartTitle: string): Promise<void> => page.getByRole('group', { name: chartTitle, exact: true }).getByRole('button', { name: 'Ver como tabla', exact: true }).click(ACTION);

/** Pulsa el botón «i» de un indicador (su nombre accesible es «Qué mide» seguido del nombre de la tarjeta). */
export const pressKpiInfo = (page: Page, label: string): Promise<void> => page.getByRole('button', { name: `Qué mide ${label}`, exact: true }).click(ACTION);

/** Lo que muestra la hoja abierta: su título (`aria-label` del diálogo), su texto y si está en pantalla. */
export interface SheetView {
  readonly title?: string;
  readonly text?: string;
  readonly open: boolean;
}

/** Lectura de la hoja de un indicador en un instante (un fallo de lectura deja el campo sin valor). */
export const readSheet = (page: Page, id: string): Promise<SheetView> =>
  Promise.all([
    safe(() => page.getByTestId(MOVIL_MISSION_TESTIDS.MISSION_KPI_SHEET).getAttribute('aria-label', { timeout: 1_000 }), undefined),
    safe(async () => normalized(await page.getByTestId(MISION_DYNAMIC_TESTIDS.MISSION_KPI_TOOLTIP(id)).innerText({ timeout: 1_000 })), undefined),
    safe(() => page.getByTestId(MOVIL_MISSION_TESTIDS.MISSION_KPI_SHEET).isVisible(), false),
  ]).then(([title, text, open]) => ({ title: title ?? undefined, text, open }));

/** Pulsa «Cerrar» en la hoja abierta. */
export const closeSheet = (page: Page): Promise<void> => page.getByRole('dialog').getByRole('button', { name: 'Cerrar', exact: true }).click(ACTION);

/** Espera (con techo) a que la hoja esté en pantalla o deje de estarlo. */
export const sheetOpenWithin = async (page: Page, open: boolean, ceilingMs = 4_000): Promise<boolean> =>
  (await waitUntil(async () => (await safe(() => page.getByTestId(MOVIL_MISSION_TESTIDS.MISSION_KPI_SHEET).isVisible(), !open)) === open, ceilingMs)).reached;

export type { ChartView, KpiView, PanelView };
