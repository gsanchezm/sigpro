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
// pantalla los ofrece; los ids de prueba, donde no hay otro rastro. Cada lectura de la pantalla va en UNA sola evaluación atómica.
//
// CORTE («el servidor no responde»). Es un fallo de conexión SIMULADO DENTRO DE LA PÁGINA (aproximación): `installSocketWrapper` sustituye
// `window.WebSocket` antes de que cargue la app. Solo toca las conexiones de socket.io (URL con `/socket.io/`):
//  - sin corte, pasan al servidor real y cada mensaje de texto se reenvía a Node (`__sigproFrame`: saludos y eventos);
//  - con corte, las conexiones abiertas se cierran (close 4000 al servidor y error + close 1006 a la app) y cada intento nuevo falla como
//    una conexión rechazada (error y luego close 1006, de forma asíncrona). El cliente reintenta según su backoff y falla otra vez;
//  - al restablecer, el siguiente intento abre un WebSocket real.
// No hay proxy de red (routeWebSocket) ni intercepción de polling: la app usa solo WebSocket (transports: ['websocket']).
// CONTROL: tras cortar, el indicador debe salir de «En vivo» en 5 s. PERMANENCIA: muestreo de 3 s; nunca «En vivo» y la mayoría de las
// lecturas «Sin conexión». Si no es estable, la fila sale notExecutable con los recuentos.

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
/** Espera de reconexión tras restablecer: el backoff de socket.io llega a 5 s por intento; el techo deja margen. */
export const RECONNECT_CEILING_MS = 15_000;
/** Plazo del control: el indicador debe salir de «En vivo» tras cortar. */
export const CONTROL_MS = 5_000;
/** Ventana de permanencia y muestreo (la historia habla de permanencia; el muestreo evita leer solo un instante). */
export const PERMANENCIA_MS = 3_000;
const PERMANENCIA_PASO_MS = 100;
/** Fracción mínima de muestras con «Sin conexión» para afirmar que el corte es estable. */
export const ESTABLE_MINIMO = 0.8;

/** Nombre del binding por el que la página envía al Node los mensajes de texto que recibe de socket.io. */
const FRAME_BINDING = '__sigproFrame';

/** Nota de todo corte: aproximación (fallo simulado dentro de la página, no un corte de red real). */
export const CUT_NOTE =
  'Aproximación: el corte es un fallo de conexión simulado dentro de la página (las conexiones de socket.io se cierran con 1006 y los intentos nuevos fallan como una conexión rechazada); no es un corte de red real.';

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

// --- Conexión en tiempo real: envoltorio de WebSocket dentro de la página ---------------------------------------------

/** Control de la conexión en tiempo real de la página: saludos aceptados, eventos recibidos y el corte simulado. */
export interface RealtimeLink {
  /** Saludos aceptados (paquete `40{…}` del servidor) desde que se instaló el control. */
  readonly accepted: () => number;
  /** Tipos de los `mission:event` que llegaron por la conexión, en orden. */
  readonly eventTypes: () => readonly string[];
  /** Corta: los intentos de socket.io fallan (y las conexiones abiertas se cierran) hasta `restore`. */
  readonly cut: () => Promise<void>;
  /** Restablece: el siguiente intento abre un WebSocket real. */
  readonly restore: () => Promise<void>;
}

const parseJson = (text: string): unknown => {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return undefined;
  }
};

/**
 * Se ejecuta EN LA PÁGINA antes que la app (addInitScript): sustituye `window.WebSocket` por un envoltorio que solo toca las conexiones de
 * socket.io (la URL contiene `/socket.io/`); el resto (p. ej., el HMR de Vite) pasa tal cual. No usa variables de fuera: se serializa.
 */
const installSocketWrapper = (): void => {
  const win = window as unknown as Record<string, unknown>;
  if (win.__sigproWrapped === true) return;
  win.__sigproWrapped = true;
  const Native = window.WebSocket;
  let cut = false;
  const kills = new Set<() => void>();
  const frame = (text: string): void => {
    const send = win.__sigproFrame;
    if (typeof send === 'function') (send as (value: string) => void)(text);
  };
  type Handler = (event: Event) => void;
  const makeSocket = (url: string, protocols: string | string[] | undefined): Record<string, unknown> => {
    const listeners = new Map<string, Handler[]>();
    let inner: WebSocket | undefined = undefined;
    let fakeState = 0;
    let muted = false;
    let binary: BinaryType = 'blob';
    const fire = (type: string, event: Event): void => {
      const handler = sock[`on${type}`];
      if (typeof handler === 'function') (handler as Handler).call(sock, event);
      for (const listener of listeners.get(type) ?? []) listener.call(sock, event);
    };
    // Fallo de conexión: error y luego close 1006, de forma asíncrona (como un intento rechazado)
    const dropped = (): void => {
      setTimeout(() => {
        fakeState = 3;
        fire('error', new Event('error'));
        fire('close', new CloseEvent('close', { code: 1006, reason: '', wasClean: false }));
      }, 0);
    };
    // Corte de una conexión abierta: se libera el socket real y la app ve un 1006
    const kill = (): void => {
      if (muted) return;
      muted = true;
      try {
        if (inner !== undefined) inner.close(4000, 'corte de la prueba');
      } catch {
        // ya cerrado
      }
      dropped();
    };
    const sock: Record<string, unknown> = {
      url,
      protocol: '',
      extensions: '',
      bufferedAmount: 0,
      onopen: null,
      onmessage: null,
      onerror: null,
      onclose: null,
      get readyState(): number {
        return inner === undefined ? fakeState : inner.readyState;
      },
      get binaryType(): BinaryType {
        return binary;
      },
      set binaryType(value: BinaryType) {
        binary = value;
        if (inner !== undefined) inner.binaryType = value;
      },
      send(data: string): void {
        if (inner !== undefined && !muted) inner.send(data);
      },
      close(code?: number, reason?: string): void {
        if (inner !== undefined && !muted) inner.close(code, reason);
        else fakeState = 3;
      },
      addEventListener(type: string, handler: Handler): void {
        listeners.set(type, [...(listeners.get(type) ?? []), handler]);
      },
      removeEventListener(type: string, handler: Handler): void {
        listeners.set(
          type,
          (listeners.get(type) ?? []).filter((item) => item !== handler),
        );
      },
      dispatchEvent(event: Event): boolean {
        fire(event.type, event);
        return true;
      },
    };
    if (cut) {
      dropped();
      return sock;
    }
    inner = protocols === undefined ? new Native(url) : new Native(url, protocols);
    inner.binaryType = binary;
    inner.onopen = (): void => {
      if (!muted) fire('open', new Event('open'));
    };
    inner.onmessage = (event: MessageEvent): void => {
      if (muted) return;
      if (typeof event.data === 'string') frame(event.data);
      fire('message', new MessageEvent('message', { data: event.data }));
    };
    inner.onerror = (): void => {
      if (!muted) fire('error', new Event('error'));
    };
    inner.onclose = (event: CloseEvent): void => {
      kills.delete(kill);
      if (!muted) fire('close', new CloseEvent('close', { code: event.code, reason: event.reason, wasClean: event.wasClean }));
    };
    kills.add(kill);
    return sock;
  };
  const Wrapped = function (url: string | URL, protocols?: string | string[]): unknown {
    const text = String(url);
    if (!text.includes('/socket.io/')) return protocols === undefined ? new Native(text) : new Native(text, protocols);
    return makeSocket(text, protocols);
  };
  Object.assign(Wrapped, { CONNECTING: 0, OPEN: 1, CLOSING: 2, CLOSED: 3 });
  window.WebSocket = Wrapped as unknown as typeof WebSocket;
  win.__sigproSetCut = (on: boolean): void => {
    cut = on;
    if (on) for (const kill of [...kills]) kill();
  };
};

/** Instala el control ANTES de abrir la página (la conexión se crea al iniciar sesión). */
export const installRealtimeLink = async (page: Page): Promise<RealtimeLink> => {
  let accepted = 0;
  const types: string[] = [];
  const record = (text: string): void => {
    if (text.startsWith('40{')) accepted += 1;
    if (!text.startsWith('42')) return;
    const packet = parseJson(text.slice(2));
    if (!Array.isArray(packet) || packet[0] !== MISSION_SOCKET_EVENT) return;
    const type = field(packet[1], 'type');
    if (typeof type === 'string') types.push(type);
  };
  await page.exposeFunction(FRAME_BINDING, (text: string) => record(text));
  await page.addInitScript(installSocketWrapper);
  const setCut = (on: boolean): Promise<void> =>
    page.evaluate((value: boolean) => {
      const win = window as unknown as Record<string, unknown>;
      const set = win.__sigproSetCut;
      if (typeof set === 'function') (set as (v: boolean) => void)(value);
    }, on);
  return {
    accepted: () => accepted,
    eventTypes: () => [...types],
    cut: () => setCut(true),
    restore: () => setCut(false),
  };
};

/** Espera (con techo) a que el saludo aceptado aumente respecto a `before`: la conexión está establecida. */
export const waitAccepted = async (link: RealtimeLink, before: number, ceilingMs = SHOW_CEILING_MS): Promise<boolean> => (await waitUntil(async () => link.accepted() > before, ceilingMs)).reached;

/** Un corte aplicado y su control: si el indicador salió de «En vivo» en el plazo, y lo que se leyó (evidencia). */
export interface Cut {
  readonly controlOk: boolean;
  readonly leftLiveMs: number;
  readonly reconnectMs: number;
  readonly evidence: string;
}

/**
 * Corta la conexión («el servidor no responde») y comprueba el control: el indicador debe salir de «En vivo» en 5 s. Si no sale, la fila
 * se declara no ejecutable con la lectura (`cut.controlOk === false`).
 */
export const cutLink = async (page: Page, link: RealtimeLink): Promise<Cut> => {
  const started = Date.now();
  await link.cut();
  const left = await waitUntil(async () => {
    const text = await readConnectionText(page);
    return text !== undefined && text !== 'En vivo';
  }, CONTROL_MS);
  const last = await readConnectionText(page);
  return {
    controlOk: left.reached,
    leftLiveMs: Date.now() - started,
    reconnectMs: RECONNECT_CEILING_MS,
    evidence: `indicador «${last ?? '(sin leer)'}» ${left.reached ? `sale de «En vivo» a los ${Date.now() - started} ms` : `sigue en «En vivo» tras ${CONTROL_MS / 1000} s`}`,
  };
};

/** Restablece la conexión cortada: el siguiente intento abre un WebSocket real. */
export const restoreLink = async (_page: Page, link: RealtimeLink, _cut: Cut): Promise<void> => {
  await link.restore();
};

/** Nota de un corte: aproximación (fallo simulado dentro de la página). */
export const cutNote = (_cut: Cut): string => CUT_NOTE;

/** Una muestra de permanencia: cuántas veces se leyó cada estado durante la ventana y la lectura final. */
export interface Permanence {
  readonly liveSeen: boolean;
  readonly samples: number;
  readonly offSamples: number;
  readonly connectingSamples: number;
  readonly endText?: string;
  readonly endRetry?: boolean;
}

/** Muestrea el indicador durante `PERMANENCIA_MS` (cada 100 ms, una lectura atómica por muestra) y lee el estado final. */
export const observePermanence = async (page: Page): Promise<Permanence> => {
  let liveSeen = false;
  let samples = 0;
  let off = 0;
  let connecting = 0;
  const started = Date.now();
  while (Date.now() - started < PERMANENCIA_MS) {
    const view = await readWeb(page);
    samples += 1;
    if (view?.connectionText === 'En vivo') liveSeen = true;
    if (view?.connectionText === 'Sin conexión') off += 1;
    if (view?.connectionText === 'Conectando…') connecting += 1;
    await sleep(PERMANENCIA_PASO_MS);
  }
  const end = await readWeb(page);
  return { liveSeen, samples, offSamples: off, connectingSamples: connecting, endText: end?.connectionText, endRetry: end?.retryPresent };
};

/** ¿Es el corte estable? (la mayoría de las muestras dicen «Sin conexión»). */
export const isStable = (permanence: Permanence): boolean => permanence.samples > 0 && permanence.offSamples / permanence.samples >= ESTABLE_MINIMO;

/** Resumen de la permanencia para lo observado y las notas. */
export const describePermanence = (permanence: Permanence): string =>
  `muestras ${permanence.samples}: «Sin conexión» ${permanence.offSamples}, «Conectando…» ${permanence.connectingSamples}, «En vivo» ${permanence.liveSeen ? 'sí' : 'no'}; al final «${permanence.endText ?? '(sin leer)'}»`;

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
  /** Etiqueta visible del indicador (el nombre accesible del botón de la web, sin el texto de un tooltip abierto). */
  readonly connectionText?: string;
  /** ¿Está el botón «Reintentar» del aviso de conexión en el DOM (solo se ve con la conexión caída)? */
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
          const nbsp = new RegExp(String.fromCharCode(160), 'g');
          const textOf = (element: Element | null | undefined): string | undefined => (element ? (element.textContent ?? '').replace(nbsp, ' ').trim() : undefined);
          const feedRows = Array.from(document.querySelectorAll<HTMLElement>(`[data-testid="${ids.feed}"] [data-testid^="${ids.row}"]`)).map((element) => {
            const lines = element.innerText
              .split('\n')
              .map((line) => line.replace(nbsp, ' ').trim())
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
        const nbsp = new RegExp(String.fromCharCode(160), 'g');
        return Array.from(table.querySelectorAll('tbody tr')).map((row) => ({
          key: (row.querySelector('th')?.textContent ?? '').replace(nbsp, ' ').trim(),
          cells: Array.from(row.querySelectorAll('td')).map((cell) => (cell.textContent ?? '').replace(nbsp, ' ').trim()),
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
export const normalized = (text: string | undefined): string | undefined => text?.split(String.fromCharCode(160)).join(' ').trim();

/** Una comprobación de texto exacto: `observed` ya leído (undefined = no legible, y eso NO cumple). */
export const textCheck = (observed: string | undefined, expected: string, what: string): Check =>
  check(normalized(observed) === expected, `${what} «${expected}»`, `${what} «${normalized(observed) ?? '(sin leer)'}»`);

/** Veredicto de una fila: cumple solo si todas las comprobaciones se cumplen; la nota dice qué no se cumple y qué se midió. */
export const conclude = (checks: readonly Check[], extra: Pick<Outcome, 'note' | 'evidence'> = {}): Outcome => {
  const failing = checks.filter((entry) => !entry.ok);
  const automatic = failing.length === 0 ? undefined : `No se cumple: ${failing.map((entry) => entry.expected).join('; ')}. Observado: ${failing.map((entry) => entry.observed).join('; ')}.`;
  // La nota explícita (mecanismo del corte, regla sin fila) se añade a la automática: nunca la sustituye
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
 * Deja la página lista como la historia la da por hecho: inicio de sesión del gestor, /mission abierto y la conexión en tiempo real
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
