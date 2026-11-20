import type { Locator, Page } from '@playwright/test';
import { MISION_DYNAMIC_TESTIDS, MISION_TESTIDS } from '../../../../packages/shared/src/testids';
import { MISSION_SOCKET_EVENT } from '../../../../packages/shared/src/mission';
import { ACTION, CEILING_MS, safe, waitUntil } from '../../support/browser';
import { check, sleep, type Check } from '../../support/checks';
import { outcome, type BrowserRowHandler, type Outcome } from '../../core/framework';
import { TENANT_A, type Credentials } from '../../../story-runs/support/prepare';
import { field, type ApiResult } from '../../../story-runs/support/api';
import { gestorSession, simulatorMsOf, summaryOf } from '../api/common';

// Piezas comunes de las filas WEB de EP-MISION-FEED (escritorio 1440 px). Los localizadores son de rol y nombre accesible cuando la
// pantalla los ofrece (botones, indicador, lista); los ids de prueba, donde no hay otro rastro (filas, cifras, barras). Cada lectura
// de la pantalla va en UNA sola evaluación atómica; una lectura fallida es «no legible», nunca «vacío» ni «0». La conexión en tiempo
// real se controla con `page.routeWebSocket`: se ve cada saludo y cada evento, y el corte cierra la conexión del navegador.

export const LOGIN_URL = `/login?tenant=${TENANT_A}`;
export const MISSION_PATH = '/mission';
/** Pathname del resumen en la URL de la página (la web llama a `/api/mission/summary`). */
export const SUMMARY_PATH = '/api/mission/summary';
export const TICK_PATH = '/api/mission/tick';

/** Salvedad de la fila: la prueba fija la preferencia de cookies para que el aviso no tape los controles de pie de página. */
export const COOKIE_NOTE = 'La prueba fija la preferencia de cookies (sigpro.cookies = accepted) antes de abrir la app; el aviso de cookies no se ejerce aquí.';

/** Ventana de observación para afirmar que algo NO ocurre (la historia no fija plazos; 4 s cubren el reintento de la conexión). */
export const QUIET_MS = 4_000;
/** Espera con techo a que la pantalla llegue a lo que la historia dice (la red local tarda menos de 1 s; el reintento, hasta ~5 s). */
export const SHOW_CEILING_MS = 8_000;

/** Añade a cada resultado de una fila web la salvedad de cookies. */
export const onWeb =
  (handler: BrowserRowHandler): BrowserRowHandler =>
  async (row, fixtures) => {
    const result = await handler(row, fixtures);
    return { ...result, note: result.note === undefined ? COOKIE_NOTE : `${result.note} ${COOKIE_NOTE}` };
  };

/** Fija SOLO la preferencia de cookies (no es una sesión). */
const fixCookiePreference = (): void => {
  try {
    localStorage.setItem('sigpro.cookies', 'accepted');
  } catch {
    // sin almacenamiento: no hay preferencia que fijar
  }
};

// --- Pasos con diagnóstico ------------------------------------------------------------------------------------------------

/** Un paso que falló: qué se intentaba y las primeras líneas del mensaje de Playwright (más el registro de llamada). */
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

/** Ejecuta pasos en orden y se detiene en el primero que falla. */
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

/** Inicia sesión desde /login?tenant=alumno01 con la cuenta de la fila y espera a llegar a /programs. */
export const signIn = (page: Page, credentials: Credentials): Promise<StepFailure | undefined> =>
  runSteps([
    ['fijar la preferencia de cookies', () => page.context().addInitScript(fixCookiePreference)],
    ['abrir /login?tenant=alumno01', () => page.goto(LOGIN_URL, { timeout: CEILING_MS })],
    ['escribir el correo', () => page.getByLabel('Correo electrónico', { exact: true }).fill(credentials.email, ACTION)],
    ['escribir la contraseña', () => page.getByLabel('Contraseña', { exact: true }).fill(credentials.password, ACTION)],
    ['pulsar «Entrar»', () => page.getByRole('button', { name: 'Entrar', exact: true }).click(ACTION)],
    ['llegar a /programs', () => page.waitForURL(/\/programs/, { timeout: CEILING_MS })],
  ]);

/** Abre /mission con la sesión ya iniciada y espera a que la pantalla exista (la carga es parte de cada fila). */
export const openMission = (page: Page): Promise<StepFailure | undefined> =>
  runSteps([
    ['abrir /mission', () => page.goto(MISSION_PATH, { timeout: CEILING_MS })],
    ['ver la pantalla del panel de misión', () => page.getByTestId(MISION_TESTIDS.MISSION_PAGE).waitFor({ timeout: CEILING_MS })],
  ]);

// --- Conexión en tiempo real: registro y corte ----------------------------------------------------------------------------

/** Ruta de WebSocket del lado del navegador (el tipo de `page.routeWebSocket`). */
type ClientRoute = Parameters<Parameters<Page['routeWebSocket']>[1]>[0];

/** Control de la conexión en tiempo real de la página: cuántos saludos aceptados llegaron, qué eventos y cómo cortarla. */
export interface RealtimeLink {
  /** Saludos aceptados (paquete `40{…}` del servidor) desde que se instaló el control. */
  readonly accepted: () => number;
  /** Tipos de los `mission:event` que llegaron por la conexión, en orden. */
  readonly eventTypes: () => readonly string[];
  /** Corta: cierra las conexiones abiertas y rechaza las nuevas hasta `restore`. */
  readonly cut: () => Promise<void>;
  /** Vuelve a dejar pasar las conexiones (la conexión se restablece sola con su reintento). */
  readonly restore: () => void;
  readonly isCut: () => boolean;
}

const parseJson = (text: string): unknown => {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return undefined;
  }
};

/** Instala el control ANTES de abrir la página (la conexión se crea al iniciar sesión). Solo afecta a las rutas `/socket.io/`. */
export const installRealtimeLink = async (page: Page): Promise<RealtimeLink> => {
  let cut = false;
  let accepted = 0;
  const types: string[] = [];
  const open = new Set<ClientRoute>();
  const record = (text: string): void => {
    if (text.startsWith('40{')) accepted += 1;
    if (!text.startsWith('42')) return;
    const packet = parseJson(text.slice(2));
    if (!Array.isArray(packet) || packet[0] !== MISSION_SOCKET_EVENT) return;
    const type = field(packet[1], 'type');
    if (typeof type === 'string') types.push(type);
  };
  await page.routeWebSocket(/\/socket\.io\//, (route) => {
    if (cut) {
      void route.close({ code: 4000, reason: 'corte de la prueba' }).catch(() => undefined);
      return;
    }
    const server = route.connectToServer();
    open.add(route);
    // Los mensajes del servidor pasan por aquí (se registran y se reenvían tal cual); los de la página se reenvían solos
    server.onMessage((message) => {
      record(typeof message === 'string' ? message : message.toString('utf8'));
      route.send(message);
    });
  });
  return {
    accepted: () => accepted,
    eventTypes: () => [...types],
    cut: async () => {
      cut = true;
      const routes = [...open];
      open.clear();
      await Promise.all(routes.map((route) => route.close({ code: 4000, reason: 'corte de la prueba' }).catch(() => undefined)));
    },
    restore: () => {
      cut = false;
    },
    isCut: () => cut,
  };
};

/** Espera (con techo) a que el saludo aceptado aumente respecto a `before`: la conexión está establecida. */
export const waitAccepted = async (link: RealtimeLink, before: number, ceilingMs = SHOW_CEILING_MS): Promise<boolean> => (await waitUntil(async () => link.accepted() > before, ceilingMs)).reached;

// --- Registro de recargas y marcador «sin recargar» ----------------------------------------------------------------------

/** Pone el marcador `__sinRecarga` y cuenta las cargas completas de la página desde ese momento. */
export const markNoReload = async (page: Page): Promise<() => Promise<{ readonly marker: boolean; readonly loads: number }>> => {
  let loads = 0;
  page.on('load', () => {
    loads += 1;
  });
  await page.evaluate(() => {
    (window as unknown as Record<string, unknown>).__sinRecarga = true;
  });
  return async () => {
    const marker = await safe(
      () =>
        page.evaluate(() => (window as unknown as Record<string, unknown>).__sinRecarga === true),
      false,
    );
    return { marker, loads };
  };
};

// --- Resumen en error (503) ----------------------------------------------------------------------------------------------

/** Responde 503 a `GET /api/mission/summary` en el navegador; el resto de peticiones siguen. */
export const failSummary = async (page: Page): Promise<void> => {
  await page.route(
    (url) => url.pathname === SUMMARY_PATH,
    (route) => {
      const request = route.request();
      if (request.method() !== 'GET') return route.continue().catch(() => undefined);
      const origin = request.headers().origin ?? '*';
      return route.fulfill({
        status: 503,
        contentType: 'application/json',
        headers: { 'access-control-allow-origin': origin, 'access-control-expose-headers': '*' },
        body: JSON.stringify({ statusCode: 503, error: 'Service Unavailable', message: 'Error provocado por la prueba' }),
      });
    },
  );
};

// --- Lectura atómica del panel ------------------------------------------------------------------------------------------

/** Una fila del feed: su número de secuencia, sus líneas de texto visibles, su origen y su tipo. */
export interface FeedRow {
  readonly seq: number;
  readonly lines: readonly string[];
  readonly origin?: string;
  readonly type?: string;
}

/** Lo que muestra el panel en un instante. Un campo sin valor es «no leído» (no cuenta como vacío). */
export interface WebView {
  readonly ncValue?: string;
  readonly milestonesValue?: string;
  readonly milestonesSub?: string;
  readonly count?: string;
  readonly pauseLabel?: string;
  readonly pausedNote?: string;
  readonly connection?: string;
  readonly connectionText?: string;
  readonly feed: readonly FeedRow[];
  readonly empty?: string;
  readonly milestoneBars: readonly { readonly code: string; readonly done: number; readonly total: number }[];
  readonly ncBars: readonly { readonly severity: string; readonly value: number }[];
}

/** Lee el panel en UNA evaluación. Devuelve `undefined` si la lectura falla (no cuenta como «sin filas»). */
export const readWeb = (page: Page): Promise<WebView | undefined> =>
  safe(
    () =>
      page.evaluate(
        (ids: { readonly feed: string; readonly row: string; readonly count: string; readonly pause: string; readonly note: string; readonly empty: string; readonly connection: string; readonly ncValue: string; readonly msValue: string; readonly msCard: string; readonly msBar: string; readonly ncBar: string }) => {
          const byTestId = (id: string): HTMLElement | null => document.querySelector<HTMLElement>(`[data-testid="${id}"]`);
          const textOf = (element: Element | null | undefined): string | undefined => (element ? (element.textContent ?? '').replace(/\u00a0/g, ' ').trim() : undefined);
          const feedRows = Array.from(document.querySelectorAll<HTMLElement>(`[data-testid="${ids.feed}"] [data-testid^="${ids.row}"]`)).map((element) => ({
            seq: Number((element.getAttribute('data-testid') ?? '').slice(ids.row.length)),
            lines: element.innerText
              .split('\n')
              .map((line) => line.replace(/\u00a0/g, ' ').trim())
              .filter((line) => line !== ''),
            origin: element.getAttribute('data-origin') ?? undefined,
            type: element.getAttribute('data-type') ?? undefined,
          }));
          const msCard = byTestId(ids.msCard);
          const connection = byTestId(ids.connection);
          const milestoneBars = Array.from(document.querySelectorAll<HTMLElement>(`[data-testid^="${ids.msBar}"]`)).map((element) => ({
            code: (element.getAttribute('data-testid') ?? '').slice(ids.msBar.length),
            done: Number(element.getAttribute('data-done')),
            total: Number(element.getAttribute('data-total')),
          }));
          const ncBars = Array.from(document.querySelectorAll<HTMLElement>(`[data-testid^="${ids.ncBar}"]`)).map((element) => ({
            severity: element.getAttribute('data-severity') ?? '',
            value: Number(element.getAttribute('data-value')),
          }));
          return {
            ncValue: textOf(byTestId(ids.ncValue)),
            milestonesValue: textOf(byTestId(ids.msValue)),
            milestonesSub: textOf(msCard?.lastElementChild),
            count: textOf(byTestId(ids.count)),
            pauseLabel: textOf(byTestId(ids.pause)),
            pausedNote: textOf(byTestId(ids.note)),
            connection: connection?.getAttribute('data-state') ?? undefined,
            connectionText: textOf(connection),
            feed: feedRows,
            empty: textOf(byTestId(ids.empty)),
            milestoneBars,
            ncBars,
          };
        },
        {
          feed: MISION_TESTIDS.MISSION_FEED,
          row: 'mission-event-',
          count: MISION_TESTIDS.MISSION_FEED_COUNT,
          pause: MISION_TESTIDS.MISSION_PAUSE,
          note: MISION_TESTIDS.MISSION_FEED_PAUSED_NOTE,
          empty: MISION_TESTIDS.MISSION_FEED_EMPTY,
          connection: MISION_TESTIDS.MISSION_CONNECTION,
          ncValue: MISION_DYNAMIC_TESTIDS.MISSION_KPI_VALUE('nc'),
          msValue: MISION_DYNAMIC_TESTIDS.MISSION_KPI_VALUE('milestones'),
          msCard: MISION_DYNAMIC_TESTIDS.MISSION_KPI('milestones'),
          // Prefijos de las barras (cada una lleva el código o la severidad tras el guion)
          msBar: MISION_DYNAMIC_TESTIDS.MISSION_BAR_MILESTONES(''),
          ncBar: MISION_DYNAMIC_TESTIDS.MISSION_BAR_NC(''),
        },
      ) as Promise<WebView>,
    undefined,
  );

/** Espera (con techo) a que la lectura cumpla `predicate`; devuelve la última lectura y si se cumplió. */
export const waitView = async (page: Page, predicate: (view: WebView) => boolean, ceilingMs = SHOW_CEILING_MS): Promise<{ readonly reached: boolean; readonly view: WebView | undefined }> => {
  const reached = await waitUntil(async () => {
    const view = await readWeb(page);
    return view !== undefined && predicate(view);
  }, ceilingMs);
  return { reached: reached.reached, view: await readWeb(page) };
};

/** Filas del feed en orden (la primera es la más reciente). */
export const feedTexts = (view: WebView | undefined): readonly FeedRow[] => view?.feed ?? [];

/** ¿Alguna línea de la fila es exactamente el texto? (comparación exacta, sin «contiene») */
export const rowHas = (row: FeedRow | undefined, text: string): boolean => row !== undefined && row.lines.some((line) => line === text);

/** Una fila en una frase, con todas sus líneas visibles (para lo observado). */
export const describeRow = (item: FeedRow | undefined): string => (item === undefined ? '(sin fila)' : `«${item.lines.join(' / ')}»`);

/** Lectura de la tabla de una gráfica (la vista de tabla): filas con su clave (`th`) y sus celdas (`td`). */
export const readTable = (page: Page, tableTestId: string): Promise<readonly { readonly key: string; readonly cells: readonly string[] }[] | undefined> =>
  safe(
    () =>
      page.evaluate((id: string) => {
        const table = document.querySelector<HTMLElement>(`[data-testid="${id}"]`);
        if (!table) return undefined;
        return Array.from(table.querySelectorAll('tbody tr')).map((row) => ({
          key: (row.querySelector('th')?.textContent ?? '').replace(/\u00a0/g, ' ').trim(),
          cells: Array.from(row.querySelectorAll('td')).map((cell) => (cell.textContent ?? '').replace(/\u00a0/g, ' ').trim()),
        }));
      }, tableTestId),
    undefined,
  );

// --- Acciones y comprobaciones ----------------------------------------------------------------------------------------

/** Lo que el manejador devuelve cuando un paso de la historia no se puede hacer en la pantalla (la historia manda). */
export const actionFailed = (expected: string, failure: StepFailure): Outcome =>
  outcome(false, expected, failure.message, {
    note: 'La historia nombra un elemento o una acción que la pantalla no ofrece. Revisar el registro de llamada: «intercepts pointer events» o «not enabled» apuntan a la app; «resolved to 0 elements», al manejador.',
    evidence: { callLog: failure.callLog },
  });

/** La preparación de la fila (inicio de sesión, cambios previos, conexión) no se cumplió. */
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

/** Veredicto de una fila: cumple solo si todas las comprobaciones se cumplen; la nota dice qué no se cumple y qué se midió. */
export const conclude = (checks: readonly Check[], extra: Pick<Outcome, 'note' | 'evidence'> = {}): Outcome => {
  const failing = checks.filter((entry) => !entry.ok);
  const note = extra.note ?? (failing.length === 0 ? undefined : `No se cumple: ${failing.map((entry) => entry.expected).join('; ')}. Observado: ${failing.map((entry) => entry.observed).join('; ')}.`);
  return outcome(failing.length === 0, checks.map((entry) => entry.expected).join('; '), checks.map((entry) => entry.observed).join('; '), {
    ...(note === undefined ? {} : { note }),
    ...(extra.evidence === undefined ? {} : { evidence: extra.evidence }),
  });
};

/** Espera (con techo) a que un locator esté visible; dice si llegó. */
export const visibleWithin = async (target: Locator, ceilingMs: number = SHOW_CEILING_MS): Promise<boolean> => (await waitUntil(() => safe(() => target.isVisible(), false), ceilingMs)).reached;

/** Texto de un tooltip al pasar el cursor por el disparador (`undefined` si no aparece). */
export const hoverText = async (page: Page, trigger: Locator, tooltipTestId: string): Promise<{ readonly text?: string; readonly failure?: StepFailure }> => {
  const failure = await runSteps([['pasar el cursor por el icono', () => trigger.hover({ timeout: CEILING_MS })]]);
  if (failure) return { failure };
  const bubble = page.getByTestId(tooltipTestId);
  const shown = await visibleWithin(bubble, 3_000);
  if (!shown) return {};
  return { text: normalized(await safe(() => bubble.innerText({ timeout: 1_000 }), undefined)) };
};

/** Pausa breve para dejar asentar la pantalla antes de observar que algo NO cambia (la historia no fija plazos). */
export const settle = (ms = QUIET_MS): Promise<void> => sleep(ms);

/** Credenciales del gestor (las usan todas las filas web de la épica). */
export const GESTOR_WEB: Credentials = { email: 'gestor@sigpro.test', password: 'Gestor1234!' };

/**
 * Deja la página lista como la historia la da por hecha: inicio de sesión del gestor, /mission abierto y la conexión en tiempo real
 * establecida (saludo aceptado y indicador «En vivo»). Devuelve el fallo si algo de eso no se produce.
 */
export const startWeb = async (page: Page, link: RealtimeLink): Promise<StepFailure | undefined> => {
  const simulator = await simulatorOffFailure();
  if (simulator) return simulator;
  const signed = await signIn(page, GESTOR_WEB);
  if (signed) return signed;
  const opened = await openMission(page);
  if (opened) return opened;
  if (!(await waitAccepted(link, 0))) return { message: 'la conexión en tiempo real no se estableció (ningún saludo aceptado en 8 s)', callLog: [] };
  const live = await waitView(page, (view) => view.connection === 'live');
  if (!live.reached) return { message: `el indicador no dice «En vivo» (dice «${live.view?.connectionText ?? '(sin leer)'}»)`, callLog: [] };
  return undefined;
};

/** La API debe arrancar con SIMULATOR_MS 0 (la historia lo da por hecho); el fallo de preparación si no lo está. */
export const simulatorOffFailure = async (): Promise<StepFailure | undefined> => {
  const gestor = await gestorSession(TENANT_A);
  if (gestor.session === undefined) return { message: 'gestor@sigpro.test no inicia sesión (lectura del resumen)', callLog: [] };
  const ms = simulatorMsOf(await summaryOf(gestor.session.accessToken, TENANT_A));
  return ms === 0 ? undefined : { message: `la API no arrancó con SIMULATOR_MS 0 (resumen: ${String(ms ?? '(sin leer)')})`, callLog: [] };
};

/** Pulsa «Pausar feed» o «Reanudar feed» (el mismo botón). */
export const togglePause = (page: Page): Promise<StepFailure | undefined> =>
  runSteps([['pulsar el botón de pausa del feed', () => page.getByTestId(MISION_TESTIDS.MISSION_PAUSE).click(ACTION)]]);

/** Pulsa «Ver como tabla» de una gráfica (su botón tiene el id de prueba del toggle). */
export const toggleChartTable = (page: Page, toggleTestId: string): Promise<StepFailure | undefined> => runSteps([['pulsar «Ver como tabla»', () => page.getByTestId(toggleTestId).click(ACTION)]]);

/** Número de NC abiertas del resumen, leído de la respuesta de la API (`kpis.ncOpen`). */
export const ncOpenFrom = (result: ApiResult): number | undefined => {
  const value = field(field(result.body, 'kpis'), 'ncOpen');
  return typeof value === 'number' ? value : undefined;
};
