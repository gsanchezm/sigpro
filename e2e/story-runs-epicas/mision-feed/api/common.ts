import { API_URL, adminCredentials, call, field, login, resetTenant, type ApiResult } from '../../../story-runs/support/api';
import { DEMO, TENANT_A, TENANT_B, resetTenants, startSession, type Credentials, type StartedSession } from '../../../story-runs/support/prepare';
import { MISSION_SOCKET_EVENT, MISSION_SOCKET_PATH, type MissionEventDto } from '../../../../packages/shared/src/mission';
import { misionEs } from '../../../../packages/shared/src/i18n/mision';
import { waitUntil } from '../../support/browser';
import { check, sleep, type Check } from '../../support/checks';
import { notExecutable, outcome, type ApiRowHandler, type Outcome } from '../../core/framework';

// Piezas comunes de las filas de API de EP-MISION-FEED: la conexión en tiempo real (Socket.IO en su protocolo de texto, con
// `WebSocket` de Node), las acciones que las historias nombran («alumno01@sigpro.lab crea con POST /api/nc…»), la lectura del
// resumen y el texto de cada evento renderizado con el catálogo de la app. Lo esperado sale de la historia; lo observado, de lo medido.

export { API_URL, TENANT_A, TENANT_B, call, field, resetTenants, resetTenant, login, type ApiResult, type MissionEventDto };

/** Ventana de observación para afirmar que algo NO ocurre (la historia no fija plazos; 4 s cubren dos ciclos de 1 s del feed). */
export const OBSERVE_MS = 4_000;
/** Espera con techo a un evento que la historia dice que llega (la red local tarda menos de 1 s). */
export const EVENT_CEILING_MS = 5_000;

/** Cabecera `x-tenant` y la descripción que usan las historias para crear una no conformidad de prueba. */
export const TEST_DESCRIPTION = 'Desviación de prueba en la ejecución';

/** Veredicto de una fila a partir de sus comprobaciones: cumple solo si todas se cumplen. La nota dice qué no se cumple y qué se midió. */
export const conclude = (checks: readonly Check[], extra: { readonly note?: string; readonly evidence?: Readonly<Record<string, unknown>> } = {}): Outcome => {
  const failing = checks.filter((entry) => !entry.ok);
  const note = extra.note ?? (failing.length === 0 ? undefined : `No se cumple: ${failing.map((entry) => entry.expected).join('; ')}. Observado: ${failing.map((entry) => entry.observed).join('; ')}.`);
  return outcome(failing.length === 0, checks.map((entry) => entry.expected).join('; '), checks.map((entry) => entry.observed).join('; '), {
    ...(note === undefined ? {} : { note }),
    ...(extra.evidence === undefined ? {} : { evidence: extra.evidence }),
  });
};

/**
 * Un paso de preparación que no se cumplió (una petición que la historia da por hecha no responde 2xx). NO es un hallazgo de la app:
 * la fila no se pudo ejecutar, así que sale `no-ejecutable` con el paso y la respuesta cruda (recortada, sin tokens) en la nota.
 */
export const prepFailure = (expected: string, step: string, result: ApiResult): Outcome =>
  notExecutable(expected, `La preparación no se cumplió: ${step} → ${result.status}. La fila no se pudo ejecutar; no se atribuye a la app.`);

/** Igual, para un motivo que no viene de una respuesta HTTP (la pila no tiene la configuración que la historia da por hecha). */
export const prepFailureReason = (expected: string, reason: string): Outcome =>
  notExecutable(expected, `La preparación no se cumplió: ${reason}. La fila no se pudo ejecutar; no se atribuye a la app.`);

/** Respuesta 2xx. */
export const isOk = (result: ApiResult): boolean => result.status >= 200 && result.status < 300;

/**
 * La historia da por hecho que la API arrancó con un SIMULATOR_MS concreto. El arnés no cambia esa configuración de la pila: se lee del
 * resumen (`simulatorMs`) con el token del gestor. Si no es el valor que la fila necesita, la fila es `no-ejecutable` (no es un fallo de la app).
 */
export const simulatorMsOutcome = async (expected: string, want: number): Promise<Outcome | undefined> => {
  const gestor = await gestorSession(TENANT_A);
  if (gestor.session === undefined) return prepFailure(expected, 'gestor@sigpro.test inicia sesión (lectura del resumen)', gestor.result);
  const ms = simulatorMsOf(await summaryOf(gestor.session.accessToken, TENANT_A));
  return ms === want ? undefined : notExecutable(expected, `requiere una pila con SIMULATOR_MS=${want}; la pila aislada usa ${String(ms ?? '(sin leer)')}`);
};

/** La fila que necesita el simulador apagado (SIMULATOR_MS 0). */
export const simulatorOffOutcome = (expected: string): Promise<Outcome | undefined> => simulatorMsOutcome(expected, 0);

/**
 * Control positivo tras una ventana de silencio: la MISMA conexión recibe un evento propio del tenant. Prueba que el silencio de la fila
 * no se debe a una conexión muerta (sin este control, «no recibe ningún evento» podría ser verdadero por una conexión rota).
 */
export const positiveControl = async (client: RealtimeClient, adminToken: string | undefined, tenant: string): Promise<Check> => {
  if (adminToken === undefined) return check(false, 'control: la conexión escuchada recibe un evento propio del tenant', 'control: sin token de administrador');
  const before = client.events().length;
  const result = await tickOf(adminToken, tenant);
  const event = await client.waitEvent((item) => item.origin === 'simulator' && client.events().length > before);
  return check(
    event !== undefined && isOk(result),
    'control: la misma conexión recibe un evento propio del tenant tras la ventana',
    `control: POST /api/mission/tick ${result.status}; ${event === undefined ? 'la conexión no recibe su evento propio' : `recibe ${describeEvent(event)}`}`,
  );
};

/** Añade una nota (una regla de la historia que la fila no puede comprobar) al resultado de un manejador de API. */
export const withNote = (handler: ApiRowHandler, text: string): ApiRowHandler => async (row) => {
  const result = await handler(row);
  return { ...result, note: result.note === undefined ? text : `${result.note} ${text}` };
};

/** Evidencia de una respuesta que no es 2xx (estado y cuerpo recortado). Vacía si fue 2xx. */
export const notOkEvidence = (result: ApiResult): Readonly<Record<string, unknown>> =>
  isOk(result) ? {} : { respuestaNo2xx: { status: result.status, cuerpo: JSON.stringify(result.body ?? null).slice(0, 300) } };

// --- Cuentas y sesiones -----------------------------------------------------------------------------------------------------------

/** Gestor del seed: `gestor@sigpro.test` (`Gestor1234!`), con su `accessToken` y su `refreshToken`. */
export const GESTOR: Credentials = DEMO.gestor;
/** Administrador de un tenant de la épica: `alumnoNN@sigpro.lab` (sin segundo factor). */
export const adminOf = (tenant: string): Credentials => adminCredentials(tenant);

/** Inicio de sesión del gestor en un tenant (con `remember`, como la API por defecto). */
export const gestorSession = (tenant: string): Promise<StartedSession> => startSession(tenant, GESTOR);

/** `accessToken` del administrador de un tenant, o `undefined` si el inicio de sesión no lo dio. */
export const adminAccess = async (tenant: string): Promise<{ readonly token: string | undefined; readonly last: ApiResult }> => {
  const started = await startSession(tenant, adminOf(tenant));
  return { token: started.session?.accessToken, last: started.result };
};

/** `mfaToken` que devuelve el inicio de sesión de `admin@sigpro.test` (cuenta con segundo factor del seed). */
export const mfaTokenOf = async (tenant: string): Promise<{ readonly token: string | undefined; readonly last: ApiResult }> => {
  const result = await login({ tenant, email: DEMO.admin.email, password: DEMO.admin.password });
  const token = field(result.body, 'mfaToken');
  return { token: typeof token === 'string' ? token : undefined, last: result };
};

// --- Conexión en tiempo real (Socket.IO v4 sobre WebSocket, protocolo de texto) --------------------------------------------------

/** Resultado del saludo: aceptada (con su `sid`), rechazada por el middleware (con su mensaje) o sin respuesta a tiempo. */
export type Handshake =
  | { readonly status: 'accepted'; readonly sid: string }
  | { readonly status: 'rejected'; readonly message: string }
  | { readonly status: 'sin-respuesta'; readonly detail: string };

export interface RealtimeClient {
  readonly handshake: Handshake;
  /** Eventos `mission:event` recibidos por esta conexión, en orden. */
  readonly events: () => readonly MissionEventDto[];
  /** ¿Sigue abierta la conexión? */
  readonly isOpen: () => boolean;
  /** Espera (con techo) al primer evento que cumpla el predicado; `undefined` si no llega. */
  readonly waitEvent: (match: (event: MissionEventDto) => boolean, ceilingMs?: number) => Promise<MissionEventDto | undefined>;
  readonly close: () => Promise<void>;
}

/** Tipo mínimo del constructor de `WebSocket` de Node (acepta un inicio con cabeceras, como el de undici). */
type WsInit = { readonly headers?: Readonly<Record<string, string>> };
type WsConstructor = new (url: string, init?: WsInit) => WebSocket;
const NodeWebSocket = globalThis.WebSocket as unknown as WsConstructor;

/** URL del socket: el mismo servidor de la API, en `/socket.io` (no bajo `/api`), con el transporte WebSocket que usa la app. */
export const realtimeUrl = (base: string = API_URL): string => `${new URL(base).origin.replace(/^http/, 'ws')}${MISSION_SOCKET_PATH}/?EIO=4&transport=websocket`;

const parseJson = (text: string): unknown => {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return undefined;
  }
};

/** Mensaje del error de conexión: la API lo manda como texto o como `{ message }`. */
const errorMessageOf = (raw: string): string => {
  const parsed = parseJson(raw);
  if (typeof parsed === 'string') return parsed;
  const message = field(parsed, 'message');
  return typeof message === 'string' ? message : raw;
};

const waitFor = async <T>(find: () => T | undefined, ceilingMs: number): Promise<T | undefined> => {
  const started = Date.now();
  for (;;) {
    const found = find();
    if (found !== undefined) return found;
    if (Date.now() - started >= ceilingMs) return undefined;
    await sleep(50);
  }
};

/**
 * Abre una conexión en tiempo real con `auth` (el campo `auth.token` del handshake; `{}` si no se da token) y cabeceras opcionales.
 * Resuelve cuando la API acepta o rechaza el saludo, o a los 5 s. Los eventos `mission:event` se acumulan en orden.
 */
export const openRealtime = (auth: { readonly token?: string }, headers: Readonly<Record<string, string>> = {}, base: string = API_URL): Promise<RealtimeClient> =>
  new Promise<RealtimeClient>((resolve) => {
    const events: MissionEventDto[] = [];
    const state: { handshake: Handshake; open: boolean; settled: boolean } = {
      handshake: { status: 'sin-respuesta', detail: 'la API no respondió al saludo en 5 s' },
      open: false,
      settled: false,
    };
    const socket = new NodeWebSocket(realtimeUrl(base), { headers });
    const client: RealtimeClient = {
      get handshake() {
        return state.handshake;
      },
      events: () => [...events],
      isOpen: () => state.open,
      waitEvent: (match, ceilingMs = EVENT_CEILING_MS) => waitFor(() => events.find(match), ceilingMs),
      close: () =>
        new Promise<void>((done) => {
          state.open = false;
          if (socket.readyState === WebSocket.CLOSED) return done();
          const timer = setTimeout(done, 2_000);
          socket.addEventListener('close', () => {
            clearTimeout(timer);
            done();
          });
          socket.close(1000, 'fin de la prueba');
        }),
    };
    const settle = (value: Handshake): void => {
      if (state.settled) return;
      state.settled = true;
      state.handshake = value;
      clearTimeout(timeout);
      resolve(client);
    };
    const timeout = setTimeout(() => settle({ status: 'sin-respuesta', detail: 'la API no respondió al saludo en 5 s' }), 5_000);

    socket.addEventListener('open', () => {
      state.open = true;
      // Paquete de conexión al espacio por defecto (`40`) con el objeto `auth`: `{ token }` o `{}` si la historia omite el campo
      socket.send(`40${JSON.stringify(auth.token === undefined ? {} : { token: auth.token })}`);
    });
    socket.addEventListener('message', (message: MessageEvent<unknown>) => {
      const text = typeof message.data === 'string' ? message.data : '';
      if (text === '2') return socket.send('3');
      if (text.startsWith('40')) return settle({ status: 'accepted', sid: String(field(parseJson(text.slice(2)), 'sid') ?? '(sin sid)') });
      if (text.startsWith('44')) return settle({ status: 'rejected', message: errorMessageOf(text.slice(2)) });
      if (text.startsWith('42')) {
        const packet = parseJson(text.slice(2));
        if (Array.isArray(packet) && packet[0] === MISSION_SOCKET_EVENT) events.push(packet[1] as MissionEventDto);
      }
    });
    socket.addEventListener('close', () => {
      state.open = false;
      settle({ status: 'sin-respuesta', detail: 'la conexión se cerró antes del saludo' });
    });
    socket.addEventListener('error', () => settle({ status: 'sin-respuesta', detail: 'error de red al abrir la conexión' }));
  });

/** Lo que dice el saludo, en una frase para lo observado. */
export const describeHandshake = (handshake: Handshake): string =>
  handshake.status === 'accepted' ? 'la conexión se abre' : handshake.status === 'rejected' ? `la API rechaza la conexión con el error ${handshake.message}` : `sin respuesta: ${handshake.detail}`;

/** Un evento, en una frase con sus datos (para lo observado y las notas). */
export const describeEvent = (event: MissionEventDto | undefined): string =>
  event === undefined ? 'ningún evento' : `evento ${event.type} con seq ${event.seq}, origen ${event.origin}${event.programCode === null ? '' : `, programCode ${event.programCode}`}`;

// --- Acciones de la historia (cada una con el token y la cabecera del tenant que la nombra) -----------------------------------

/** `POST /api/nc` con el token de un administrador: alta de una no conformidad en `PRG-002` (o en el programa dado). */
export const createNc = (token: string | undefined, tenant: string, severity: string, description: string = TEST_DESCRIPTION, programCode = 'PRG-002'): Promise<ApiResult> =>
  call('POST', '/nc', { tenant, ...(token === undefined ? {} : { token }), body: { programCode, severity, description } });

/** `POST /api/nc/<code>/transition` con `to` (y el comentario de cierre si se da). */
export const transitionNc = (token: string | undefined, tenant: string, code: string, to: string, comment?: string): Promise<ApiResult> =>
  call('POST', `/nc/${code}/transition`, { tenant, ...(token === undefined ? {} : { token }), body: comment === undefined ? { to } : { to, comment } });

/** `PATCH /api/nc/<code>` con una gravedad nueva. */
export const patchNcSeverity = (token: string | undefined, tenant: string, code: string, severity: string): Promise<ApiResult> =>
  call('PATCH', `/nc/${code}`, { tenant, ...(token === undefined ? {} : { token }), body: { severity } });

/** `POST /api/nc/<code>/comments` con el texto del comentario. */
export const commentNc = (token: string | undefined, tenant: string, code: string, body: string): Promise<ApiResult> =>
  call('POST', `/nc/${code}/comments`, { tenant, ...(token === undefined ? {} : { token }), body: { body } });

/** `PATCH /api/milestones/<id>` con el avance (100 = cumplido). */
export const patchMilestone = (token: string | undefined, tenant: string, id: string, progress: number): Promise<ApiResult> =>
  call('PATCH', `/milestones/${id}`, { tenant, ...(token === undefined ? {} : { token }), body: { progress } });

/** `DELETE /api/programs/<code>`. */
export const deleteProgram = (token: string | undefined, tenant: string, code: string): Promise<ApiResult> =>
  call('DELETE', `/programs/${code}`, { tenant, ...(token === undefined ? {} : { token }) });

/** `POST /api/mission/tick`: emite ya el siguiente evento del simulador del tenant (solo administradores). */
export const tickOf = (token: string | undefined, tenant: string): Promise<ApiResult> => call('POST', '/mission/tick', { tenant, ...(token === undefined ? {} : { token }) });

/** El evento de una respuesta de `tick` (`undefined` si no trae uno). */
export const tickEvent = (result: ApiResult): MissionEventDto | undefined => {
  const event = field(result.body, 'event');
  return typeof event === 'object' && event !== null ? (event as MissionEventDto) : undefined;
};

/** `GET /api/mission/summary` con el token del gestor (o del que se dé) y la cabecera del tenant. */
export const summaryOf = (token: string | undefined, tenant: string): Promise<ApiResult> =>
  call('GET', '/mission/summary', { tenant, ...(token === undefined ? {} : { token }) });

/** Lista `recent` del resumen (más reciente primero); `undefined` si no es una lista. */
export const recentOf = (summary: ApiResult): readonly MissionEventDto[] | undefined => {
  const recent = field(summary.body, 'recent');
  return Array.isArray(recent) ? (recent as MissionEventDto[]) : undefined;
};

/** `simulatorMs` del resumen: el intervalo con el que arrancó la API (0 = simulador apagado), o `undefined` si no se lee. */
export const simulatorMsOf = (summary: ApiResult): number | undefined => {
  const value = field(summary.body, 'simulatorMs');
  return typeof value === 'number' ? value : undefined;
};

/** Número de NC abiertas del resumen (`kpis.ncOpen`), o `undefined` si no se lee. */
export const ncOpenOf = (summary: ApiResult): number | undefined => {
  const value = field(field(summary.body, 'kpis'), 'ncOpen');
  return typeof value === 'number' ? value : undefined;
};

/** Pasos de preparación que emiten `count` eventos con `tick`; falla con el primero que no responde 200 (o el primero sin evento). */
export const tickMany = async (token: string, tenant: string, count: number): Promise<{ readonly failed?: { readonly step: string; readonly result: ApiResult }; readonly last?: MissionEventDto }> => {
  let last: MissionEventDto | undefined;
  for (let index = 0; index < count; index += 1) {
    const result = await tickOf(token, tenant);
    if (!isOk(result)) return { failed: { step: `emitir el evento ${index + 1} con POST /api/mission/tick`, result } };
    last = tickEvent(result);
  }
  return { last };
};

// --- Texto de cada evento, con el catálogo de la app -----------------------------------------------------------------------------

const MISION_TEXTS: Readonly<Record<string, string>> = misionEs;

/**
 * Texto que muestra la app para un evento: la plantilla `mision.ev_<tipo>` con sus variables. Las variables de no conformidades
 * (gravedad, estados) van en bruto aquí; la web y la app las localizan antes de interpolar (`nc.sev_*`, `nc.state_*`).
 */
export const renderEventText = (event: MissionEventDto): string => {
  const template = MISION_TEXTS[`ev_${event.type}`];
  if (template === undefined) return `(sin plantilla para ${event.type})`;
  return template.replace(/\{(\w+)\}/g, (_match, key: string) => String(event.vars[key] ?? `{${key}}`));
};

// --- Lectura de celdas --------------------------------------------------------------------------------------------------------

/** Pares «clave valor» separados por coma («code NC-001, from open, to in_analysis»). Otra forma LANZA. */
export const pairsOf = (text: string): Readonly<Record<string, string>> => {
  const entries = text.split(', ').map((pair): readonly [string, string] => {
    const match = /^(\S+) (.+)$/.exec(pair.trim());
    if (!match?.[1] || !match[2]) throw new Error(`celda sin interpretación: pares «${text}»`);
    return [match[1], match[2]];
  });
  return Object.fromEntries(entries);
};

/** Número de no conformidades por severidad («minor 3, major 2, critical 4»). */
export const countsOf = (text: string): { readonly minor: number; readonly major: number; readonly critical: number } => {
  const pairs = pairsOf(text);
  return { minor: Number(pairs.minor), major: Number(pairs.major), critical: Number(pairs.critical) };
};

/** Un entero de una celda («9», «-1»). Otra forma LANZA. */
export const intOf = (text: string): number => {
  if (!/^-?\d+$/.test(text.trim())) throw new Error(`celda sin interpretación: «${text}» no es un entero`);
  return Number(text.trim());
};

/** Un código de programa de una celda («PRG-013»), o `null` para «(ninguno)». Otra forma LANZA. */
export const programOf = (text: string): string | null => {
  if (text === '(ninguno)') return null;
  if (!/^PRG-\d{3}$/.test(text)) throw new Error(`celda sin interpretación: programa «${text}»`);
  return text;
};

/** Compara una variable del evento con su valor de la celda (el número cuenta como texto). */
export const varCheck = (event: MissionEventDto | undefined, key: string, expected: string): Check => {
  const observed = event?.vars[key];
  return check(observed !== undefined && String(observed) === expected, `vars.${key} ${expected}`, `vars.${key} ${observed === undefined ? '(sin leer)' : String(observed)}`);
};

/** Compara un campo del evento con su valor (los nulos cuentan como «(ninguno)»). */
export const eventFieldCheck = (event: MissionEventDto | undefined, key: 'type' | 'severity' | 'origin' | 'programCode' | 'seq', expected: string | number | null): Check => {
  const observed: unknown = event === undefined ? undefined : event[key];
  const shown = (value: unknown): string => (value === null ? '(ninguno)' : value === undefined ? '(sin leer)' : String(value));
  return check(event !== undefined && observed === expected, `${key} ${shown(expected)}`, `${key} ${shown(observed)}`);
};

/** Espera una cifra del resumen (`kpis.ncOpen`) o un `seq` del historial hasta que coincidan o se agote el techo. */
export const waitSummary = async (read: () => Promise<boolean>, ceilingMs = 5_000): Promise<boolean> => (await waitUntil(read, ceilingMs)).reached;

/** Observa una ventana sin acciones; `true` si durante ella no llegó ningún evento a la conexión. */
export const quietWindow = async (client: RealtimeClient | undefined, ms = OBSERVE_MS): Promise<number> => {
  await sleep(ms);
  return client?.events().length ?? 0;
};
