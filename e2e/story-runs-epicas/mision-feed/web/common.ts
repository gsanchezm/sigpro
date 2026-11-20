import type { Locator, Page } from '@playwright/test';
import { MISION_DYNAMIC_TESTIDS, MISION_TESTIDS, MOVIL_MISSION_TESTIDS } from '../../../../packages/shared/src/testids';
import { MISSION_SOCKET_EVENT, type MissionEventDto } from '../../../../packages/shared/src/mission';
import { ACTION, CEILING_MS, safe, waitUntil } from '../../support/browser';
import { check, sleep, type Check } from '../../support/checks';
import { notExecutable, outcome, type BrowserRowHandler, type Outcome } from '../../core/framework';
import { TENANT_A, type Credentials } from '../../../story-runs/support/prepare';
import { field, type ApiResult } from '../../../story-runs/support/api';
import { gestorSession, recentOf, simulatorMsOf, summaryOf } from '../api/common';

// Piezas comunes de las filas WEB de EP-MISION-FEED (escritorio 1440 px). Los localizadores son de rol y nombre accesible cuando la
// pantalla los ofrece (botones, indicador, lista); los ids de prueba, donde no hay otro rastro (filas, cifras, barras). Cada lectura
// de la pantalla va en UNA sola evaluación atómica; una lectura fallida es «no legible», nunca «vacío» ni «0».
//
// CORTE DE LA CONEXIÓN. La historia 008 dice «poniendo el navegador sin conexión»: el corte real es `context.setOffline(true)`. Se
// comprueba con un control (el indicador debe salir de «En vivo» en 5 s); si no sale, el corte se hace cerrando el socket con
// `routeWebSocket` y la fila lo declara como aproximación en su nota. Los reintentos de Socket.IO tardan más tras un cierre de la ruta
// (su intento colgado expira a los 20 s), así que la espera de reconexión depende del método.

export const LOGIN_URL = `/login?tenant=${TENANT_A}`;
export const MISSION_PATH = '/mission';
/** Pathname del resumen en la URL de la página (la web llama a `/api/mission/summary`). */
export const SUMMARY_PATH = '/api/mission/summary';

/** Salvedad de la fila: la prueba fija la preferencia de cookies para que el aviso no tape los controles de pie de página. */
export const COOKIE_NOTE = 'La prueba fija la preferencia de cookies (sigpro.cookies = accepted) antes de abrir la app; el aviso de cookies no se ejerce aquí.';

/** Ventana de observación para afirmar que algo NO ocurre (la historia no fija plazos). */
export const QUIET_MS = 4_000;
/** Espera con techo a que la pantalla llegue a lo que la historia dice (la red local tarda menos de 1 s). */
export const SHOW_CEILING_MS = 8_000;
/** Espera de reconexión tras restablecer: con `setOffline` los reintentos fallan deprisa (backoff de Socket.IO, máximo ~5 s). */
export const RECONNECT_OFFLINE_MS = 12_000;
/** Espera de reconexión tras un corte con `routeWebSocket`: el intento colgado expira a los 20 s de Socket.IO. */
export const RECONNECT_ROUTE_MS = 25_000;

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

// --- Conexión en tiempo real: registro y corte por la ruta ----------------------------------------------------------------

/** Ruta de WebSocket del lado del navegador (el tipo de `page.routeWebSocket`). */
type ClientRoute = Parameters<Parameters<Page['routeWebSocket']>[1]>[0];

/** Control de la conexión en tiempo real de la página: saludos aceptados, eventos recibidos y el corte por la ruta (respaldo). */
export interface RealtimeLink {
  /** Saludos aceptados (paquete `40{…}` del servidor) desde que se instaló el control. */
  readonly accepted: () => number;
  /** Tipos de los `mission:event` que llegaron por la conexión, en orden. */
  readonly eventTypes: () => readonly string[];
  /** Corte por la ruta: cierra las conexiones abiertas y rechaza las nuevas hasta `restore`. */
  readonly cut: () => Promise<void>;
  /** Vuelve a dejar pasar las conexiones por la ruta. */
  readonly restore: () => void;
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
  };
};

/** Espera (con techo) a que el saludo aceptado aumente respecto a `before`: la conexión está establecida. */
export const waitAccepted = async (link: RealtimeLink, before: number, ceilingMs = SHOW_CEILING_MS): Promise<boolean> => (await waitUntil(async () => link.accepted() > before, ceilingMs)).reached;

/** Un corte aplicado: el método que funcionó, lo que tardó el indicador en salir de «En vivo» y la espera de reconexión que le toca. */
export interface Cut {
  readonly method: 'setOffline' | 'routeWebSocket';
  readonly leftLiveMs: number;
  /** Aproximación que la fila declara en su nota (vacío si el corte fue el de la historia: sin conexión del navegador). */
  readonly approximation?: string;
  readonly reconnectMs: number;
}

/**
 * Corta la conexión como dice la historia («poniendo el navegador sin conexión»): `setOffline(true)`, y un control de que el
 * indicador sale de «En vivo» en 5 s. Si no sale, se revierte y se corta el socket con la ruta, declarándolo en la nota.
 */
export const cutLink = async (page: Page, link: RealtimeLink): Promise<Cut> => {
  const started = Date.now();
  await page.context().setOffline(true);
  const left = await waitUntil(async () => {
    const text = (await readWeb(page))?.connectionText;
    return text !== undefined && text !== 'En vivo';
  }, 5_000);
  if (left.reached) return { method: 'setOffline', leftLiveMs: Date.now() - started, reconnectMs: RECONNECT_OFFLINE_MS };
  await page.context().setOffline(false);
  await link.cut();
  return {
    method: 'routeWebSocket',
    leftLiveMs: Date.now() - started,
    approximation: 'setOffline no sacó el indicador de «En vivo» en 5 s: el corte se hizo cerrando el socket con routeWebSocket (aproximación; los reintentos pueden tardar hasta 20 s).',
    reconnectMs: RECONNECT_ROUTE_MS,
  };
};

/** Restablece la conexión cortada por `cutLink`: vuelve a la red (o a dejar pasar el socket). */
export const restoreLink = async (page: Page, link: RealtimeLink, cut: Cut): Promise<void> => {
  if (cut.method === 'setOffline') await page.context().setOffline(false);
  else link.restore();
};

/** Nota de un corte: la aproximación, si la hubo. */
export const cutNote = (cut: Cut): string | undefined => cut.approximation;

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

/** Una fila del feed: su número de secuencia, sus líneas visibles, su origen, su tipo, su gravedad y su hora (atributo y texto). */
export interface FeedRow {
  readonly seq: number;
  readonly lines: readonly string[];
  readonly origin?: string;
  readonly type?: string;
  readonly severity?: string;
  readonly datetime?: string;
  readonly timeText?: string;
}

/** Lo que muestra el panel en un instante. Un campo sin valor es «no leído» (no cuenta como vacío). */
export interface WebView {
  readonly ncValue?: string;
  readonly milestonesValue?: string;
  readonly milestonesSub?: string;
  readonly count?: string;
  readonly pauseLabel?: string;
  readonly pausedNote?: string;
  /** Texto visible del indicador de conexión (solo la etiqueta, no el texto de un tooltip abierto). */
  readonly connectionText?: string;
  /** ¿Está el botón «Reintentar» del aviso de conexión en el DOM (visible cuando la conexión está caída)? */
  readonly retryPresent?: boolean;
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
        (ids: { readonly feed: string; readonly row: string; readonly count: string; readonly pause: string; readonly note: string; readonly empty: string; readonly connection: string; readonly retry: string; readonly ncValue: string; readonly msValue: string; readonly msCard: string; readonly msBar: string; readonly ncBar: string }) => {
          const byTestId = (id: string): HTMLElement | null => document.querySelector<HTMLElement>(`[data-testid="${id}"]`);
          const textOf = (element: Element | null | undefined): string | undefined => (element ? (element.textContent ?? '').replace(/\u00a0/g, ' ').trim() : undefined);
          const feedRows = Array.from(document.querySelectorAll<HTMLElement>(`[data-testid="${ids.feed}"] [data-testid^="${ids.row}"]`)).map((element) => {
            const lines = element.innerText
              .split('\n')
              .map((line) => line.replace(/\u00a0/g, ' ').trim())
              .filter((line) => line !== '');
            const time = element.querySelector('time');
            return {
              seq: Number((element.getAttribute('data-testid') ?? '').slice(ids.row.length)),
              lines,
              origin: element.getAttribute('data-origin') ?? undefined,
              type: element.getAttribute('data-type') ?? undefined,
              severity: element.getAttribute('data-severity') ?? undefined,
              datetime: time?.getAttribute('datetime') ?? undefined,
              timeText: textOf(time) ?? lines.find((line) => /^\d{1,2}:\d{2}:\d{2}$/.test(line)),
            };
          });
          const msCard = byTestId(ids.msCard);
          const connection = byTestId(ids.connection);
          // La etiqueta del indicador: el botón de la web lleva su nombre accesible (sin el tooltip); la app móvil, su propio texto
          const connectionLabel = connection?.querySelector('button')?.getAttribute('aria-label') ?? textOf(connection);
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
            connectionText: connectionLabel,
            retryPresent: byTestId(ids.retry) !== null,
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
          retry: MOVIL_MISSION_TESTIDS.MISSION_CONNECTION_RETRY,
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

/** Solo la etiqueta del indicador de conexión (`undefined` si no se lee). */
export const readConnectionText = async (page: Page): Promise<string | undefined> => (await readWeb(page))?.connectionText;

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

/** Hora de un evento tal como la muestra la app (es-ES, zona de Madrid, dos cifras por campo). */
export const formatTime = (at: string): string =>
  new Date(at).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'Europe/Madrid' });

/** Los eventos recientes del tenant (historial del resumen, el más reciente primero), leídos con el token del gestor; `undefined` si no se leen. */
export const recentEvents = async (): Promise<readonly MissionEventDto[] | undefined> => {
  const gestor = await gestorSession(TENANT_A);
  if (gestor.session === undefined) return undefined;
  return recentOf(await summaryOf(gestor.session.accessToken, TENANT_A));
};

/**
 * Comprobaciones de una fila del feed contra el evento que la produjo (Regla 3 de la historia: «la hora del evento, su gravedad y su
 * texto»). La gravedad sale del atributo de la fila; la hora, del elemento `time` (web) o del texto de la hora (móvil).
 */
export const eventRowChecks = (row: FeedRow | undefined, event: MissionEventDto | undefined, surface: 'web' | 'movil'): readonly Check[] => {
  const severity = row?.severity;
  const hourOk = row !== undefined && event !== undefined && (surface === 'web' ? row.datetime === event.at && row.timeText === formatTime(event.at) : row.timeText === formatTime(event.at));
  return [
    check(event !== undefined && severity === event.severity, `la fila del evento ${String(event?.seq ?? '(sin evento)')} muestra la gravedad ${event?.severity ?? '(sin leer)'}`, `la fila muestra la gravedad ${severity ?? '(sin leer)'}`),
    check(hourOk, `la fila muestra la hora del evento (${event === undefined ? '(sin evento)' : formatTime(event.at)})`, `la fila muestra la hora ${row?.timeText ?? '(sin leer)'}${surface === 'web' ? ` (datetime ${row?.datetime ?? '(sin leer)'})` : ''}`),
  ];
};

/** Comprobaciones de hora y gravedad de una fila contra su evento en el historial (el evento se busca por su `seq`). */
export const rowChecksOf = async (row: FeedRow | undefined, surface: 'web' | 'movil'): Promise<readonly Check[]> => {
  if (row === undefined) return [check(false, 'la fila del evento existe en la lista', '(sin fila)')];
  const events = await recentEvents();
  return eventRowChecks(row, events?.find((item) => item.seq === row.seq), surface);
};

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

/**
 * Un paso de la acción de la historia (Cuando) falló en la pantalla o en su respuesta: la acción no se pudo hacer y el paso dice cuál.
 * Es un hallazgo sobre la app solo si la historia afirma que la acción funciona; el resto de preparaciones van por `prepFailed`.
 */
export const actionFailed = (expected: string, failure: StepFailure): Outcome =>
  outcome(false, expected, failure.message, {
    note: 'La historia nombra un elemento o una acción que la pantalla no ofrece. Revisar el registro de llamada: «intercepts pointer events» o «not enabled» apuntan a la app; «resolved to 0 elements», al manejador.',
    evidence: { callLog: failure.callLog },
  });

/**
 * La preparación de la fila (inicio de sesión, conexión, cifras de partida, un apoyo que no responde 2xx) no se cumplió. NO se atribuye a
 * la app: la fila no se pudo ejecutar y sale `no-ejecutable` con el motivo.
 */
export const prepFailed = (expected: string, failure: StepFailure): Outcome =>
  notExecutable(expected, `La preparación no se cumplió: ${failure.message}. La fila no se pudo ejecutar; no se atribuye a la app.`);

/** Igual, con un motivo que no viene de un paso del navegador. */
export const prepFailedReason = (expected: string, reason: string): Outcome =>
  notExecutable(expected, `La preparación no se cumplió: ${reason}. La fila no se pudo ejecutar; no se atribuye a la app.`);

/** Texto normalizado para comparar: los espacios no separables cuentan como espacios; el texto no cambia. */
export const normalized = (text: string | undefined): string | undefined => text?.replace(/\u00a0/g, ' ').trim();

/** Una comprobación de texto exacto: `observed` ya leído (undefined = no legible, y eso NO cumple). */
export const textCheck = (observed: string | undefined, expected: string, what: string): Check =>
  check(normalized(observed) === expected, `${what} «${expected}»`, `${what} «${normalized(observed) ?? '(sin leer)'}»`);

/** Veredicto de una fila: cumple solo si todas las comprobaciones se cumplen; la nota dice qué no se cumple y qué se midió. */
export const conclude = (checks: readonly Check[], extra: Pick<Outcome, 'note' | 'evidence'> = {}): Outcome => {
  const failing = checks.filter((entry) => !entry.ok);
  const automatic = failing.length === 0 ? undefined : `No se cumple: ${failing.map((entry) => entry.expected).join('; ')}. Observado: ${failing.map((entry) => entry.observed).join('; ')}.`;
  // La nota explícita (aproximación del corte, regla sin fila) se añade a la automática: nunca la sustituye
  const note = extra.note === undefined ? automatic : automatic === undefined ? extra.note : `${automatic} ${extra.note}`;
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
  const live = await waitView(page, (view) => view.connectionText === 'En vivo');
  if (!live.reached) return { message: `el indicador no dice «En vivo» (dice «${live.view?.connectionText ?? '(sin leer)'}»)`, callLog: [] };
  return undefined;
};

/**
 * La API debe arrancar con SIMULATOR_MS 0 (la historia lo da por hecho; el arnés no cambia la configuración de la pila). Si no es 0, el
 * fallo es de la pila: la fila sale `no-ejecutable` (ver `prepFailed`), no `discrepa`.
 */
export const simulatorOffFailure = async (): Promise<StepFailure | undefined> => {
  const gestor = await gestorSession(TENANT_A);
  if (gestor.session === undefined) return { message: 'gestor@sigpro.test no inicia sesión (lectura del resumen)', callLog: [] };
  const ms = simulatorMsOf(await summaryOf(gestor.session.accessToken, TENANT_A));
  return ms === 0 ? undefined : { message: `requiere una pila con SIMULATOR_MS=0; la pila aislada usa ${String(ms ?? '(sin leer)')}`, callLog: [] };
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

/** Una nota de fila: la regla de la historia que la fila no puede comprobar (se anota, no se juzga). */
export const withNoteWeb =
  (handler: BrowserRowHandler, text: string): BrowserRowHandler =>
  async (row, fixtures) => {
    const result = await handler(row, fixtures);
    return { ...result, note: result.note === undefined ? text : `${result.note} ${text}` };
  };
