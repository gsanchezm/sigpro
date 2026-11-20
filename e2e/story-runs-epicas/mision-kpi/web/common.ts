import type { Locator, Page, Route } from '@playwright/test';
import { MISION_DYNAMIC_TESTIDS, MISION_TESTIDS } from '../../../../packages/shared/src/testids';
import { ACTION, CEILING_MS, safe, waitUntil } from '../../support/browser';
import { check, sleep, type Check } from '../../support/checks';
import { outcome, type BrowserRowHandler, type Outcome } from '../../core/framework';
import { TENANT_A, type Credentials } from '../../../story-runs/support/prepare';

// Piezas comunes de las filas WEB de EP-MISION-KPI (escritorio 1440 px, por la configuración del proyecto `web`). Los localizadores
// son de rol y nombre accesible cuando la pantalla los ofrece (título, botones, avisos); los ids de prueba se usan donde no hay otro
// rastro (tarjetas, barras, columnas y avisos del feed). Toda lectura de la pantalla va en UNA sola evaluación atómica; un registro
// de avisos que no se puede leer es «no legible», nunca «ningún aviso». El retraso y el fallo del resumen los provoca la prueba.

export const LOGIN_URL = `/login?tenant=${TENANT_A}`;
export const MISSION_PATH = '/mission';
/** Pathname de la API (la web llama a `${API}/mission/summary` con el prefijo `/api`). */
export const SUMMARY_PATH = '/api/mission/summary';
export const TICK_PATH = '/api/mission/tick';
/** Texto de la traza de la respuesta: método, ruta y estado (la línea que muestra la pantalla). */
export const SUMMARY_TRACE = 'GET /api/mission/summary';
export const TICK_TRACE = 'POST /api/mission/tick';

/** Identificadores de las cuatro tarjetas, por el texto de su etiqueta. */
export const KPI_OF_LABEL: ReadonlyMap<string, string> = new Map<string, string>([
  ['Programas activos', 'programs'],
  ['Hitos cumplidos', 'milestones'],
  ['NC abiertas', 'nc'],
  ['Verificación superada', 'verification'],
]);
/** Orden de las cuatro tarjetas en la historia («Programas activos», «Hitos cumplidos», «NC abiertas» y «Verificación superada»). */
export const KPI_IDS: readonly string[] = ['programs', 'milestones', 'nc', 'verification'];

/** Título y subtítulo que la historia nombra para la pantalla. */
export const TITLE = 'Panel de misión';
export const SUBTITLE = 'Estado del tenant en tiempo real: hitos, no conformidades y verificación.';

/** Ventana que se observa tras una acción para afirmar que NO aparece un aviso: mayor que su vida (3 s). */
export const QUIET_WINDOW_MS = 4_000;
/** Tolerancia de la prueba para una lectura de la cifra mientras la respuesta tarda (la historia no fija el plazo). */
const READ_MS = 2_000;

/**
 * Lo que dice la prueba del resumen o de la emisión: respuesta normal, demora (y después se entrega al servidor), demora seguida de un
 * error HTTP, error HTTP inmediato o ninguna respuesta.
 */
export type Mode =
  | { readonly kind: 'ok' }
  | { readonly kind: 'delay'; readonly ms: number }
  | { readonly kind: 'delayHttp'; readonly ms: number; readonly status: number }
  | { readonly kind: 'http'; readonly status: number }
  | { readonly kind: 'abort' };

/** Texto de un modo para el registro de la prueba. */
const describeMode = (mode: Mode): string => {
  if (mode.kind === 'ok') return 'pasa al servidor';
  if (mode.kind === 'delay') return `retrasada ${mode.ms} ms y entregada al servidor`;
  if (mode.kind === 'delayHttp') return `retrasada ${mode.ms} ms y respondida ${mode.status} por la prueba (no llega al servidor)`;
  if (mode.kind === 'http') return `respondida ${mode.status} por la prueba (no llega al servidor)`;
  return 'cortada por la prueba (sin respuesta)';
};

/** Control de una ruta de la API: el modo se puede cambiar en mitad de la fila (p. ej. para el reintento). */
export interface Intercept {
  readonly set: (mode: Mode) => void;
  /** Cada petición que llegó a la ruta, en orden, con lo que se hizo con ella. */
  readonly log: () => readonly string[];
  /** Instante (ms) en que llegó la última petición a la ruta; `undefined` si ninguna. */
  readonly lastReceivedAt: () => number | undefined;
  readonly receivedCount: () => number;
}

/** Respuesta de error que la prueba fabrica (sin llegar al servidor). Las cabeceras CORS siguen a la petición. */
const fulfillError = (request: { readonly headers: () => Record<string, string> }, status: number): Parameters<Route['fulfill']>[0] => {
  const origin = request.headers().origin ?? '*';
  return {
    status,
    contentType: 'application/json',
    headers: { 'access-control-allow-origin': origin, 'access-control-expose-headers': '*' },
    body: JSON.stringify({ statusCode: status, error: 'Error', message: 'Error provocado por la prueba' }),
  };
};

/**
 * Ruta de la API por su pathname y método. Las respuestas que la prueba fabrica no llegan al servidor (se anota en el registro). Las
 * cabeceras CORS siguen a la petición, porque la página llama a la API desde otro origen.
 */
export const interceptApi = async (page: Page, method: 'GET' | 'POST', pathname: string, initial: Mode): Promise<Intercept> => {
  let mode: Mode = initial;
  let count = 0;
  let received: number | undefined;
  const log: string[] = [];
  await page.route(
    (url) => url.pathname === pathname,
    async (route) => {
      const request = route.request();
      if (request.method() !== method) return route.continue();
      count += 1;
      received = Date.now();
      const current = mode;
      log.push(`#${count} ${method} ${pathname}: ${describeMode(current)}`);
      if (current.kind === 'ok') return route.continue().catch(() => undefined);
      if (current.kind === 'delay') {
        await sleep(current.ms);
        return route.continue().catch(() => undefined);
      }
      if (current.kind === 'delayHttp') {
        await sleep(current.ms);
        return route.fulfill(fulfillError(request, current.status)).catch(() => undefined);
      }
      if (current.kind === 'abort') return route.abort('internetdisconnected');
      return route.fulfill(fulfillError(request, current.status)).catch(() => undefined);
    },
  );
  return {
    set: (next) => {
      mode = next;
    },
    log: () => [...log],
    lastReceivedAt: () => received,
    receivedCount: () => count,
  };
};

/** Resumen del panel: el control de sus peticiones GET (todas: la app lo pide desde la cabecera, desde las tarjetas y desde /mission). */
export const interceptSummary = (page: Page, initial: Mode): Promise<Intercept> => interceptApi(page, 'GET', SUMMARY_PATH, initial);

// --- Avisos: registro instalado antes de la acción ---------------------------------------------------------------------------

/** Clave del registro de avisos en la ventana del navegador. */
export const TOAST_KEY = '__misionToasts';

/**
 * Un aviso registrado: tono, título (primera línea), cuerpo (segunda), marca de tiempo del navegador en que apareció y, si ya se cerró,
 * la marca en que salió del documento (`goneAt`: sirve para medir cuánto tiempo estuvo a la vista).
 */
export interface ToastEntry {
  readonly tone: string;
  readonly title: string;
  readonly body: string;
  readonly at: number;
  readonly goneAt?: number;
}

/** Se ejecuta en el navegador antes de cargar la app: registra cada aparición de un aviso y cuándo sale. No usa variables de fuera. */
export const recordToasts = (key: string): void => {
  const registry = window as unknown as Record<string, unknown>;
  if (Array.isArray(registry[key])) return;
  const log: { tone: string; title: string; body: string; at: number; goneAt?: number }[] = [];
  registry[key] = log;
  const pending: { readonly element: Element; readonly entry: { goneAt?: number } }[] = [];
  const toneOf = (element: Element): string | undefined => /^toast-(ok|danger|info|warn)$/.exec(element.getAttribute('data-testid') ?? '')?.[1];
  const record = (element: Element, tone: string): void => {
    const lines = (element as HTMLElement).innerText
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line !== '' && line !== '×');
    const entry: { tone: string; title: string; body: string; at: number; goneAt?: number } = { tone, title: lines[0] ?? '', body: lines[1] ?? '', at: Date.now() };
    log.push(entry);
    pending.push({ element, entry });
  };
  const scan = (node: Node): void => {
    if (!(node instanceof Element)) return;
    const own = toneOf(node);
    if (own !== undefined) record(node, own);
    node.querySelectorAll('[data-testid^="toast-"]').forEach((element) => {
      const tone = toneOf(element);
      if (tone !== undefined) record(element, tone);
    });
  };
  new MutationObserver((mutations) => mutations.forEach((mutation) => mutation.addedNodes.forEach(scan))).observe(document, { childList: true, subtree: true });
  // Marca de salida: cuando el aviso deja el documento, se anota su instante (la vida del aviso es la diferencia)
  window.setInterval(() => {
    for (let index = pending.length - 1; index >= 0; index -= 1) {
      const item = pending[index];
      if (item !== undefined && !item.element.isConnected) {
        item.entry.goneAt = Date.now();
        pending.splice(index, 1);
      }
    }
  }, 50);
};

/** Vacía el registro y marca el instante de la acción que se va a probar. Devuelve `false` si el registro no está armado. */
export const armToasts = (page: Page): Promise<boolean> =>
  safe(
    () =>
      page.evaluate((key: string) => {
        const registry = window as unknown as Record<string, unknown>;
        const log = registry[key];
        if (!Array.isArray(log)) return false;
        log.length = 0;
        registry.__misionArmedAt = Date.now();
        return true;
      }, TOAST_KEY),
    false,
  );

/** Registro de avisos desde la última «armada»; `undefined` si no se puede leer (no cuenta como «ningún aviso»). */
export const toastLog = (page: Page): Promise<readonly ToastEntry[] | undefined> =>
  safe(
    () =>
      page.evaluate((key: string) => {
        const log = (window as unknown as Record<string, unknown>)[key];
        return Array.isArray(log) ? (log as ToastEntry[]).map((entry) => ({ ...entry })) : undefined;
      }, TOAST_KEY),
    undefined,
  );

/** Espera (con techo) a un aviso del tono y título dados (y cuerpo, si se da). Consulta el registro, no la pantalla. */
export const toastShown = async (page: Page, tone: 'ok' | 'danger' | 'info' | 'warn', title: string, body?: string): Promise<{ readonly seen: boolean; readonly entry?: ToastEntry; readonly readable: boolean; readonly observed: string }> => {
  const matches = (entry: ToastEntry): boolean => entry.tone === tone && entry.title === title && (body === undefined || entry.body === body);
  const found = await waitUntil(async () => (await toastLog(page))?.some(matches) ?? false);
  const log = await toastLog(page);
  if (log === undefined) return { seen: false, readable: false, observed: 'el registro de avisos no se pudo leer' };
  const entry = log.find(matches);
  const observed = log.length === 0 ? '(ningún aviso)' : log.map((item) => `${item.tone} «${item.title}»${item.body === '' ? '' : ` / «${item.body}»`}`).join(' | ');
  return { seen: found.reached, readable: true, observed, ...(entry === undefined ? {} : { entry }) };
};

/**
 * Vida de un aviso del tono y título dados: milisegundos entre su aparición y su salida del documento (el último que coincide). Espera
 * (con techo) a que salga. Sin salida en el plazo, lo dice.
 */
export const toastLifetime = async (page: Page, tone: 'ok' | 'danger' | 'info' | 'warn', title: string): Promise<{ readonly lifetimeMs?: number; readonly observed: string }> => {
  const latest = async (): Promise<ToastEntry | undefined> => ((await toastLog(page)) ?? []).filter((entry) => entry.tone === tone && entry.title === title).pop();
  await waitUntil(async () => (await latest())?.goneAt !== undefined, 8_000);
  const entry = await latest();
  if (entry === undefined) return { observed: `no aparece el aviso «${title}»` };
  if (entry.goneAt === undefined) return { observed: `el aviso «${title}» sigue visible tras 8 s` };
  return { lifetimeMs: entry.goneAt - entry.at, observed: `el aviso «${title}» estuvo visible ${entry.goneAt - entry.at} ms` };
};

/** Registro completo de avisos tras la ventana de observación (mayor que la vida del aviso); `undefined` si no se puede leer. */
export const toastsAfterWindow = async (page: Page, endedAt: number): Promise<readonly ToastEntry[] | undefined> => {
  const remaining = endedAt + QUIET_WINDOW_MS - Date.now();
  if (remaining > 0) await sleep(remaining);
  return toastLog(page);
};

/** Texto de los avisos de un registro, para la evidencia («info «Evento emitido»», «danger «Ha ocurrido…» / «traza»»…). */
export const describeToasts = (log: readonly ToastEntry[] | undefined): string =>
  log === undefined ? '(el registro de avisos no se pudo leer)' : log.length === 0 ? '(ningún aviso)' : log.map((entry) => `${entry.tone} «${entry.title}»${entry.body === '' ? '' : ` / «${entry.body}»`}`).join(' | ');

// --- Inicio de sesión y navegación ---------------------------------------------------------------------------------------------

/** Fija SOLO la preferencia de cookies (no es una sesión): el aviso de cookies tapa los controles de pie de página. */
const fixCookiePreference = (): void => {
  try {
    localStorage.setItem('sigpro.cookies', 'accepted');
  } catch {
    // sin almacenamiento: no hay preferencia que fijar
  }
};

/** Un paso que falló: qué se intentaba y las tres primeras líneas del mensaje de Playwright (más el registro de llamada). */
export interface StepFailure {
  readonly message: string;
  readonly callLog: readonly string[];
}

// Los códigos de color ANSI que Playwright añade al mensaje de error
// eslint-disable-next-line no-control-regex
const ANSI = /\u001b\[[0-9;]*m/g;
const linesOfError = (error: unknown): string[] =>
  (error instanceof Error ? error.message : String(error))
    .replace(ANSI, '')
    .split('\n')
    .map((line) => line.trimEnd())
    .filter((line) => line.trim() !== '');

/** Ejecuta pasos en orden y se detiene en el primero que falla. El fallo dice qué se intentaba y las líneas del error de Playwright. */
export const runSteps = async (steps: readonly (readonly [string, () => Promise<unknown>])[]): Promise<StepFailure | undefined> => {
  for (const [what, action] of steps) {
    try {
      await action();
    } catch (error) {
      const lines = linesOfError(error);
      return { message: `no se pudo ${what}: ${lines.slice(0, 3).join(' | ')}`, callLog: lines.slice(0, 15) };
    }
  }
  return undefined;
};

/**
 * Inicia sesión desde /login?tenant=alumno01 con la cuenta de la fila y espera a llegar a /programs. Instala antes el registro de
 * avisos. NO espera a que el panel de misión cargue: cada fila decide qué observa y cuándo.
 */
export const signIn = (page: Page, credentials: Credentials): Promise<StepFailure | undefined> =>
  runSteps([
    ['fijar la preferencia de cookies', () => page.context().addInitScript(fixCookiePreference)],
    ['instalar el registro de avisos', () => page.context().addInitScript(recordToasts, TOAST_KEY)],
    ['abrir /login?tenant=alumno01', () => page.goto(LOGIN_URL, { timeout: CEILING_MS })],
    ['escribir el correo', () => page.getByLabel('Correo electrónico', { exact: true }).fill(credentials.email, ACTION)],
    ['escribir la contraseña', () => page.getByLabel('Contraseña', { exact: true }).fill(credentials.password, ACTION)],
    ['pulsar «Entrar»', () => page.getByRole('button', { name: 'Entrar', exact: true }).click(ACTION)],
    ['llegar a /programs', () => page.waitForURL(/\/programs/, { timeout: CEILING_MS })],
  ]);

/** Abre /mission con la sesión ya iniciada en la misma página y espera solo a que la pantalla exista (la carga es parte de cada fila). */
export const openMission = (page: Page): Promise<StepFailure | undefined> =>
  runSteps([
    ['abrir /mission', () => page.goto(MISSION_PATH, { timeout: CEILING_MS })],
    ['ver la pantalla del panel de misión', () => page.getByTestId(MISION_TESTIDS.MISSION_PAGE).waitFor({ timeout: CEILING_MS })],
  ]);

// --- Lectura atómica de la pantalla -----------------------------------------------------------------------------------------

/**
 * Lectura de una tarjeta: presente, etiqueta (su primera línea de texto visible), cifra (si está pintada), todas sus líneas de texto
 * visible (etiqueta, cifra y detalle, en ese orden), si tiene el icono de información y su `aria-busy`.
 */
export interface KpiView {
  readonly id: string;
  readonly present: boolean;
  readonly label?: string;
  readonly value?: string;
  readonly lines: readonly string[];
  readonly info: boolean;
  readonly busy?: string;
}

/** Lectura de una gráfica: su figura, sus barras o columnas (con su texto visible), su texto vacío, su título y su texto completo. */
export interface ChartView {
  readonly present: boolean;
  readonly bars: number;
  readonly barTexts: readonly string[];
  readonly empty?: string;
  readonly title?: string;
  /** Texto visible de toda la figura, con las líneas separadas por « | » (para comparar que no cambia). */
  readonly text?: string;
}

/** Lectura completa del panel en un instante. */
export interface PanelView {
  readonly title?: string;
  readonly subtitle?: string;
  readonly kpis: readonly KpiView[];
  /** Ids de las tarjetas en el orden en que aparecen en la pantalla. */
  readonly order: readonly string[];
  readonly kpisBusy?: string;
  readonly milestones: ChartView;
  readonly nc: ChartView;
  /** Bloques de carga sin testid dentro de la pantalla (la zona de gráficas mientras llega el resumen). */
  readonly loadingBlocks: number;
  readonly skeletons: number;
  readonly errorVisible: boolean;
  readonly errorTitle?: string;
  readonly errorTrace?: string;
  readonly retryVisible: boolean;
}


/**
 * Lee el panel de misión en UNA evaluación: títulos, tarjetas (con sus líneas visibles), orden, gráficas, aviso de error y bloques de
 * carga. Un fallo de lectura devuelve `undefined` (no cuenta como «sin cifra» ni como «ningún error»).
 */
export const readPanel = (page: Page): Promise<PanelView | undefined> =>
  safe(
    () =>
      page.evaluate(
        (ids: { readonly page: string; readonly kpis: string; readonly figMilestones: string; readonly figNc: string; readonly empty: string; readonly error: string; readonly retry: string; readonly kpiIds: readonly string[]; readonly kpi: string; readonly value: string; readonly info: string; readonly bar: string; readonly ncBar: string }) => {
          const byTestId = (id: string): HTMLElement | null => document.querySelector<HTMLElement>(`[data-testid="${id}"]`);
          const textOf = (element: Element | null | undefined): string | undefined => (element ? (element.textContent ?? '').replace(/\s+/g, ' ').trim() : undefined);
          const linesOf = (element: HTMLElement | null | undefined): string[] =>
            element
              ? element.innerText
                  .split('\n')
                  .map((line) => line.replace(/\s+/g, ' ').trim())
                  .filter((line) => line !== '')
              : [];
          const root = byTestId(ids.page);
          const kpis = ids.kpiIds.map((id) => {
            const card = byTestId(`${ids.kpi}${id}`);
            if (!card) return { id, present: false, lines: [] as string[], info: false };
            const valueElement = byTestId(`${ids.value}${id}`);
            return {
              id,
              present: true,
              label: textOf(card.querySelector('h3')),
              value: valueElement ? textOf(valueElement) : undefined,
              lines: linesOf(card),
              info: byTestId(`${ids.info}${id}`) !== null,
              busy: card.getAttribute('aria-busy') ?? undefined,
            };
          });
          const order = Array.from(document.querySelectorAll<HTMLElement>('[data-testid]'))
            .map((element) => element.getAttribute('data-testid') ?? '')
            .filter((testId) => ids.kpiIds.some((id) => testId === `${ids.kpi}${id}`))
            .map((testId) => testId.slice(ids.kpi.length));
          const chart = (figureId: string, barPrefix: string): { present: boolean; bars: number; barTexts: string[]; empty?: string; title?: string; text?: string } => {
            const figure = byTestId(figureId);
            if (!figure) return { present: false, bars: 0, barTexts: [] };
            const bars = Array.from(figure.querySelectorAll<HTMLElement>(`[data-testid^="${barPrefix}"]`));
            return {
              present: true,
              bars: bars.length,
              barTexts: bars.map((bar) => linesOf(bar).join(' ')),
              empty: textOf(figure.querySelector(`[data-testid="${ids.empty}"]`)),
              title: textOf(figure.querySelector('figcaption')),
              text: linesOf(figure).join(' | '),
            };
          };
          const busyWithoutTestId = Array.from(root?.querySelectorAll('[aria-busy="true"]') ?? []).filter((element) => !element.hasAttribute('data-testid'));
          const errorElement = byTestId(ids.error);
          const kpisSection = byTestId(ids.kpis);
          return {
            title: textOf(root?.querySelector('h1')),
            subtitle: textOf(root?.querySelector('h1 + p')),
            kpis,
            order,
            kpisBusy: kpisSection?.getAttribute('aria-busy') ?? undefined,
            milestones: chart(ids.figMilestones, ids.bar),
            nc: chart(ids.figNc, ids.ncBar),
            loadingBlocks: busyWithoutTestId.length,
            skeletons: busyWithoutTestId.reduce((sum, element) => sum + element.querySelectorAll('.skeleton').length, 0),
            errorVisible: errorElement !== null,
            errorTitle: textOf(errorElement?.querySelector('.font-semibold')),
            errorTrace: textOf(errorElement?.querySelector('.trace')),
            retryVisible: byTestId(ids.retry) !== null,
          };
        },
        {
          page: MISION_TESTIDS.MISSION_PAGE,
          kpis: MISION_TESTIDS.MISSION_KPIS,
          figMilestones: MISION_TESTIDS.MISSION_CHART_MILESTONES,
          figNc: MISION_TESTIDS.MISSION_CHART_NC,
          empty: MISION_TESTIDS.MISSION_CHART_EMPTY,
          error: MISION_TESTIDS.MISSION_ERROR,
          retry: MISION_TESTIDS.MISSION_ERROR_RETRY,
          kpiIds: KPI_IDS,
          kpi: 'mission-kpi-',
          value: 'mission-kpi-value-',
          info: 'mission-kpi-info-',
          bar: 'mission-bar-milestones-',
          ncBar: 'mission-bar-nc-',
        },
      ) as Promise<PanelView>,
    undefined,
  );

/**
 * Espera (con techo) a que las cuatro tarjetas tengan cifra pintada Y la respuesta haya llegado. En error la web pinta ceros (0, 0 %),
 * así que el aviso de error cuenta como «no está lista»: sin esto, un «0» de error se tomaría por la cifra.
 */
export const waitKpisShown = async (page: Page, ceilingMs: number = CEILING_MS): Promise<boolean> =>
  (
    await waitUntil(async () => {
      const view = await readPanel(page);
      return view !== undefined && !view.errorVisible && view.kpis.every((kpi) => kpi.present && kpi.value !== undefined);
    }, ceilingMs)
  ).reached;

// --- Gráficas: estructura, tablas, tooltips y anchura de barras ---------------------------------------------------------------

export interface TableRowView {
  readonly key: string;
  readonly cells: readonly string[];
}

/** Filas de una tabla de gráfica (la vista de tabla): la primera columna es la clave (programa o severidad), el resto las cifras. */
export const readChartTable = (page: Page, tableTestId: string): Promise<readonly TableRowView[] | undefined> =>
  safe(
    () =>
      page.evaluate((id: string) => {
        const table = document.querySelector<HTMLElement>(`[data-testid="${id}"]`);
        if (!table) return undefined;
        return Array.from(table.querySelectorAll('tbody tr')).map((row) => ({
          key: (row.querySelector('th')?.textContent ?? '').trim(),
          cells: Array.from(row.querySelectorAll('td')).map((cell) => (cell.textContent ?? '').trim()),
        }));
      }, tableTestId),
    undefined,
  );

/** Estructura visible de una gráfica: su título, el texto de su botón de vista, las líneas de su figura y, si hay tabla, sus cabeceras y filas. */
export interface ChartStructure {
  readonly title?: string;
  readonly toggleText?: string;
  readonly lines: readonly string[];
  readonly tableVisible: boolean;
  readonly tableHeaders: readonly string[];
  readonly tableRows: number;
}

/** Lee la estructura de una figura y de su tabla (si está a la vista) en UNA evaluación. */
export const readChartStructure = (page: Page, figureTestId: string, tableTestId: string): Promise<ChartStructure | undefined> =>
  safe(
    () =>
      page.evaluate(
        (ids: { readonly figure: string; readonly table: string }) => {
          const figure = document.querySelector<HTMLElement>(`[data-testid="${ids.figure}"]`);
          if (!figure) return undefined;
          const textOf = (element: Element | null | undefined): string | undefined => (element ? (element.textContent ?? '').replace(/\s+/g, ' ').trim() : undefined);
          const buttons = Array.from(figure.querySelectorAll('button')).map((button) => textOf(button) ?? '');
          const table = document.querySelector<HTMLElement>(`[data-testid="${ids.table}"]`);
          return {
            title: textOf(figure.querySelector('figcaption')),
            toggleText: buttons.find((text) => text === 'Ver como tabla' || text === 'Ver como gráfica'),
            lines: (figure.innerText ?? '')
              .split('\n')
              .map((line) => line.replace(/\s+/g, ' ').trim())
              .filter((line) => line !== ''),
            tableVisible: table !== null,
            tableHeaders: table ? Array.from(table.querySelectorAll('thead th')).map((cell) => textOf(cell) ?? '') : [],
            tableRows: table ? table.querySelectorAll('tbody tr').length : 0,
          };
        },
        { figure: figureTestId, table: tableTestId },
      ),
    undefined,
  );

/**
 * Texto del tooltip de una barra o columna tras pasar el puntero (hover). Si el puntero no llega a la barra, devuelve el fallo del paso
 * (para que la fila lo diga); si el tooltip no aparece en el plazo, `text` queda sin valor.
 */
export const hoverTooltip = async (page: Page, barTestId: string, tooltipKey: string): Promise<{ readonly text?: string; readonly failure?: StepFailure }> => {
  const bar = page.getByTestId(barTestId).locator('button').first();
  const failure = await runSteps([['pasar el puntero sobre la barra', () => bar.hover({ timeout: READ_MS * 2 })]]);
  if (failure) return { failure };
  const tooltip = page.getByTestId(MISION_DYNAMIC_TESTIDS.MISSION_BAR_TOOLTIP(tooltipKey));
  const shown = await waitUntil(async () => (await safe(() => tooltip.count(), 0)) === 1, READ_MS * 2);
  if (!shown.reached) return {};
  return { text: await safe(async () => (await tooltip.innerText({ timeout: READ_MS })).trim(), undefined) };
};

/** Ancho de la barra del programa como porcentaje de su pista (la zona entre la etiqueta y el «D/T»), medido en píxeles pintados. */
export const barWidthPercent = (page: Page, barTestId: string): Promise<number | undefined> =>
  safe(
    () =>
      page.evaluate((id: string) => {
        const button = document.querySelector<HTMLElement>(`[data-testid="${id}"] button`);
        const track = button?.parentElement;
        if (!button || !track) return undefined;
        const width = track.getBoundingClientRect().width;
        return width > 0 ? Math.round((button.getBoundingClientRect().width / width) * 1000) / 10 : undefined;
      }, barTestId),
    undefined,
  );

// --- Acciones y evaluación ---------------------------------------------------------------------------------------------------

/** Lo que el manejador devuelve cuando un paso de la historia no se puede hacer en la pantalla (la historia manda). */
export const actionMissing = (expected: string, failure: StepFailure): Outcome =>
  outcome(false, expected, failure.message, {
    note: 'La historia nombra un elemento que la pantalla no ofrece. Revisar el registro de llamada: «intercepts pointer events» o «not enabled» apuntan a la app; «resolved to 0 elements», al manejador.',
    evidence: { callLog: failure.callLog },
  });

/** La preparación de la fila (inicio de sesión, cambios previos) no se cumplió. */
export const prepFailed = (expected: string, failure: StepFailure): Outcome =>
  outcome(false, expected, `la preparación no se cumplió: ${failure.message}`, {
    note: 'No se pudo reproducir el estado inicial que da por hecho la historia; la app no hace lo que la preparación describe.',
    evidence: { callLog: failure.callLog },
  });

/** Igual, con un motivo que no viene de un paso del navegador. */
export const prepFailedReason = (expected: string, reason: string): Outcome =>
  outcome(false, expected, `la preparación no se cumplió: ${reason}`, {
    note: 'No se pudo reproducir el estado inicial que da por hecho la historia; la app no hace lo que la preparación describe.',
  });

/** Texto normalizado para comparar: los espacios no separables cuentan como espacios; el texto no cambia. */
export const normalized = (text: string | undefined): string | undefined => text?.replace(/\u00a0/g, ' ').trim();

/** Una comprobación de texto exacto: `observed` ya leído (undefined = no legible, y eso NO cumple). */
export const textCheck = (observed: string | undefined, expected: string, what: string): Check =>
  check(normalized(observed) === expected, `${what} «${expected}»`, `${what} «${normalized(observed) ?? '(sin leer)'}»`);

/**
 * Una tarjeta con su etiqueta, su cifra y, si se da, su detalle, leídos de las líneas visibles de la propia tarjeta (no de sus hijos):
 * la primera línea es la etiqueta, la segunda la cifra y la tercera el detalle.
 */
export const kpiCheck = (view: PanelView | undefined, id: string, label: string, value: string, sub?: string): Check => {
  const kpi = view?.kpis.find((item) => item.id === id);
  const lines = (kpi?.lines ?? []).map((line) => normalized(line) ?? '');
  const ok = kpi?.present === true && lines[0] === label && normalized(kpi.value) === value && (sub === undefined || lines[2] === sub);
  const observed = kpi?.present === true ? `muestra «${lines[0] ?? '(sin etiqueta)'}», cifra ${normalized(kpi.value) ?? '(sin cifra)'}${sub === undefined ? '' : ` y debajo «${lines[2] ?? '(sin detalle)'}»`}` : 'no aparece';
  return check(ok, `la tarjeta «${label}» muestra ${value}${sub === undefined ? '' : ` y debajo «${sub}»`}`, `la tarjeta ${observed}`);
};

/**
 * Veredicto de una fila a partir de sus comprobaciones: cumple solo si todas se cumplen. Si hay discrepancias, la nota dice qué
 * comprobaciones no se cumplen y qué se observó en su lugar; la nota del manejador (si la hay) va delante de ese resumen.
 */
export const conclude = (checks: readonly Check[], extra: Pick<Outcome, 'note' | 'evidence'> = {}): Outcome => {
  const failing = checks.filter((entry) => !entry.ok);
  const summary = failing.length === 0 ? undefined : 'No se cumple: ' + failing.map((entry) => entry.expected).join('; ') + '. Observado: ' + failing.map((entry) => entry.observed).join('; ') + '.';
  const note = [extra.note, summary].filter((text): text is string => text !== undefined).join(' ');
  return outcome(failing.length === 0, checks.map((entry) => entry.expected).join('; '), checks.map((entry) => entry.observed).join('; '), {
    ...(note === '' ? {} : { note }),
    ...(extra.evidence === undefined ? {} : { evidence: extra.evidence }),
  });
};

/** Resultado de una fila que depende de la traza de la respuesta: el veredicto sale de las otras comprobaciones y la traza va a la evidencia. */
export const traceDependent = (_expected: string, others: readonly Check[], trace: Check, evidence: Readonly<Record<string, unknown>> = {}): Outcome =>
  conclude(others, { evidence: { ...evidence, trazaObservada: trace.observed } });

/** Nota de la fila: la prueba fija la preferencia de cookies para que el aviso no tape los controles. */
export const COOKIE_NOTE = 'La prueba fija la preferencia de cookies (sigpro.cookies = accepted) antes de abrir la app; el aviso de cookies no se ejerce aquí.';

/** Añade la nota de cookies a cada resultado de una fila web. */
export const onWeb =
  (handler: BrowserRowHandler): BrowserRowHandler =>
  async (row, fixtures) => {
    const result = await handler(row, fixtures);
    return { ...result, note: result.note === undefined ? COOKIE_NOTE : `${result.note} ${COOKIE_NOTE}` };
  };

/** Espera a que un locator esté visible (con techo) y dice si llegó. */
export const visibleWithin = async (target: Locator, ceilingMs: number = CEILING_MS): Promise<boolean> => (await waitUntil(() => safe(() => target.isVisible(), false), ceilingMs)).reached;
/** Espera a que un locator NO esté visible (con techo). */
export const goneWithin = async (target: Locator, ceilingMs: number = CEILING_MS): Promise<boolean> => (await waitUntil(async () => !(await safe(() => target.isVisible(), true)), ceilingMs)).reached;
