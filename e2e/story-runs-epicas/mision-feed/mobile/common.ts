import type { Page } from '@playwright/test';
import { MISION_TESTIDS, MOVIL_MISSION_TESTIDS, PROGRAMAS_DYNAMIC_TESTIDS } from '../../../../packages/shared/src/testids';
import { ACTION, CEILING_MS, safe } from '../../support/browser';
import { check, type Check } from '../../support/checks';
import type { BrowserRowHandler } from '../../core/framework';
import { TENANT_A, type Credentials } from '../../../story-runs/support/prepare';
import { GESTOR_WEB, readWeb, runSteps, simulatorOffFailure, waitAccepted, waitView, type RealtimeLink, type StepFailure, type WebView } from '../web/common';
import { adminAccess, tickMany } from '../api/common';

// Piezas comunes de las filas de la app móvil de EP-MISION-FEED. La app se ejecuta como web de Expo a 390 × 844: NO es iOS ni Android
// nativo, y cada veredicto vale para Expo web. El indicador de conexión de la app lleva `data-state` = connected | connecting |
// disconnected (no «live»), por eso aquí el estado se lee por su texto visible («En vivo», «Conectando…», «Sin conexión»).

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
/** Nombre accesible de la pestaña del panel de misión (la pantalla se monta al pulsarla). */
const MISSION_TAB = 'Panel de misión';

const textbox = (page: Page, name: string) => page.getByRole('textbox', { name, exact: true });

/** Inicio de sesión en la app: escribe alumno01 en «Tenant de trabajo», la cuenta de la fila, y llega a /programs. */
export const signInTo = (page: Page, credentials: Credentials): Promise<StepFailure | undefined> =>
  runSteps([
    ['abrir /login', () => page.goto(LOGIN_PATH, { timeout: CEILING_MS })],
    ['ver el título «Iniciar sesión»', () => page.getByRole('heading', { name: 'Iniciar sesión', level: 1, exact: true }).waitFor({ timeout: CEILING_MS })],
    [`escribir ${TENANT_TEXT}`, () => textbox(page, TENANT_TEXT).fill(TENANT_A, ACTION)],
    ['escribir el correo', () => textbox(page, 'Correo electrónico').fill(credentials.email, ACTION)],
    ['escribir la contraseña', () => textbox(page, 'Contraseña').fill(credentials.password, ACTION)],
    ['pulsar «Entrar»', () => page.getByRole('button', { name: 'Entrar', exact: true }).click(ACTION)],
    ['llegar a /programs', () => page.getByRole('heading', { name: 'Programas', level: 1, exact: true }).waitFor({ timeout: CEILING_MS })],
  ]);

/** Abre la pestaña «Panel de misión» de la barra inferior y espera a que la pantalla exista. */
export const openMissionTab = (page: Page): Promise<StepFailure | undefined> =>
  runSteps([
    [
      'pulsar la pestaña «Panel de misión»',
      () => page.getByRole('tab', { name: MISSION_TAB, exact: true }).or(page.getByTestId(PROGRAMAS_DYNAMIC_TESTIDS.MOBILE_TAB('mission'))).click(ACTION),
    ],
    ['ver la pantalla del panel de misión', () => page.getByTestId(MISION_TESTIDS.MISSION_PAGE).waitFor({ timeout: CEILING_MS })],
  ]);

/**
 * Deja la app lista como la historia la da por hecha: sesión del gestor, pestaña «Panel de misión» abierta y la conexión en vivo
 * («En vivo» en la cabecera y un saludo aceptado). Devuelve el fallo si algo de eso no se produce.
 */
export const startMobile = async (page: Page, link: RealtimeLink): Promise<StepFailure | undefined> => {
  const simulator = await simulatorOffFailure();
  if (simulator) return simulator;
  const signed = await signInTo(page, GESTOR_WEB);
  if (signed) return signed;
  const opened = await openMissionTab(page);
  if (opened) return opened;
  if (!(await waitAccepted(link, 0))) return { message: 'la conexión en tiempo real no se estableció (ningún saludo aceptado en 8 s)', callLog: [] };
  const live = await waitView(page, (view) => view.connectionText === 'En vivo');
  if (!live.reached) return { message: `el indicador no dice «En vivo» (dice «${live.view?.connectionText ?? '(sin leer)'}»)`, callLog: [] };
  return undefined;
};

/** Provoca `count` eventos con `POST /api/mission/tick` (token de alumno01@sigpro.lab). Devuelve el fallo si alguno no responde 200. */
export const tickFeedFor = async (count: number): Promise<StepFailure | undefined> => {
  const admin = await adminAccess(TENANT_A);
  if (admin.token === undefined) return { message: 'alumno01@sigpro.lab no inicia sesión', callLog: [] };
  const ticks = await tickMany(admin.token, TENANT_A, count);
  if (ticks.failed) return { message: `${ticks.failed.step} respondió ${ticks.failed.result.status}`, callLog: [] };
  return undefined;
};

/** Botón «Reintentar» de la pantalla (el del aviso de conexión, no el del error del resumen). */
export const retryButton = (page: Page) => page.getByTestId(MOVIL_MISSION_TESTIDS.MISSION_CONNECTION_RETRY);

/** ¿Está el botón «Reintentar» del aviso de conexión en pantalla? (una lectura fallida no cuenta como «no está»). */
export const retryVisible = (page: Page): Promise<boolean | undefined> => safe(() => retryButton(page).isVisible(), undefined);

/** Pulsa «Ver como tabla» de la tarjeta de gráfica con ese título (el grupo tiene su título como nombre accesible). */
export const toggleMobileTable = (page: Page, chartTitle: string): Promise<StepFailure | undefined> =>
  runSteps([
    [`pulsar «Ver como tabla» de «${chartTitle}»`, () => page.getByRole('group', { name: chartTitle, exact: true }).getByRole('button', { name: 'Ver como tabla', exact: true }).click(ACTION)],
  ]);

/** Filas de una tabla móvil (role=row con cabecera de fila): la clave y las celdas. Un fallo de lectura es `undefined`. */
export interface MobileRowView {
  readonly key: string;
  readonly cells: readonly string[];
}

export const readMobileRows = (page: Page, tableTestId: string): Promise<readonly MobileRowView[] | undefined> =>
  safe(
    () =>
      page.evaluate((id: string) => {
        const table = document.querySelector<HTMLElement>(`[data-testid="${id}"]`);
        if (!table) return undefined;
        return Array.from(table.querySelectorAll('[role="row"]'))
          .filter((row) => row.querySelector('[role="rowheader"]') !== null)
          .map((row) => ({
            key: (row.querySelector('[role="rowheader"]')?.textContent ?? '').replace(/\u00a0/g, ' ').trim(),
            cells: Array.from(row.querySelectorAll('[role="cell"]')).map((cell) => (cell.textContent ?? '').replace(/\u00a0/g, ' ').trim()),
          }));
      }, tableTestId),
    undefined,
  );

/** Filas de la tabla de NC por severidad («Menor», «Mayor», «Crítica») con su número. */
export const mobileNcCounts = async (page: Page): Promise<Readonly<Record<string, string | undefined>>> => {
  const rows = (await readMobileRows(page, MISION_TESTIDS.MISSION_CHART_NC_TABLE)) ?? [];
  const valueOf = (label: string): string | undefined => rows.find((item) => item.key === label)?.cells[0];
  return { Menor: valueOf('Menor'), Mayor: valueOf('Mayor'), Crítica: valueOf('Crítica') };
};

/** Filas de la tabla de hitos por programa: el número de cumplidos y el total del programa dado. */
export const mobileMilestoneRow = async (page: Page, code: string): Promise<{ readonly done?: string; readonly total?: string } | undefined> => {
  const rows = await readMobileRows(page, MISION_TESTIDS.MISSION_CHART_MILESTONES_TABLE);
  if (rows === undefined) return undefined;
  const row = rows.find((item) => item.key === code);
  return { done: row?.cells[0], total: row?.cells[1] };
};

/** Comprobación de un valor de la tabla o de la tarjeta, con lo que la historia dice y lo leído. */
export const valueCheck = (observed: string | undefined, expected: string, what: string): Check =>
  check(observed === expected, `${what} ${expected}`, `${what} ${observed ?? '(sin leer)'}`);

/** Lectura de la pantalla móvil (la misma forma que la web: mismas ids de prueba para cifras, feed y estado). */
export const readMobile = (page: Page): Promise<WebView | undefined> => readWeb(page);

/**
 * Explicación del estado y posición del botón, leídas en UNA evaluación: la explicación debe ir bajo el título «Eventos en directo» y el
 * botón «Reintentar» debajo de la explicación (Reglas 18 y 19 de la historia 011). Las posiciones son del rectángulo de cada nodo.
 */
export interface MobileExplanation {
  readonly indicator?: string;
  readonly explanation?: string;
  readonly titleBottom?: number;
  readonly explanationTop?: number;
  readonly explanationBottom?: number;
  readonly retryTop?: number;
  readonly retryPresent: boolean;
}

export const readMobileExplanation = (page: Page): Promise<MobileExplanation | undefined> =>
  safe(
    () =>
      page.evaluate(() => {
        const byTestId = (id: string): HTMLElement | null => document.querySelector<HTMLElement>(`[data-testid="${id}"]`);
        const textOf = (element: Element | null | undefined): string | undefined => (element ? (element.textContent ?? '').replace(/\u00a0/g, ' ').trim() : undefined);
        const region = document.querySelector<HTMLElement>('[role="region"][aria-label="Eventos en directo"]');
        const title = region
          ? Array.from(region.querySelectorAll<HTMLElement>('*')).find((element) => element.children.length === 0 && (element.textContent ?? '').trim() === 'Eventos en directo')
          : undefined;
        const explanationElement = byTestId('mission-connection-tooltip');
        const retryElement = byTestId('mission-connection-retry');
        const explanationRect = explanationElement?.getBoundingClientRect();
        return {
          indicator: textOf(byTestId('mission-connection')),
          explanation: textOf(explanationElement),
          titleBottom: title?.getBoundingClientRect().bottom,
          explanationTop: explanationRect?.top,
          explanationBottom: explanationRect?.bottom,
          retryTop: retryElement?.getBoundingClientRect().top,
          retryPresent: retryElement !== null,
        };
      }) as Promise<MobileExplanation>,
    undefined,
  );
