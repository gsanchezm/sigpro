import type { Locator, Page } from '@playwright/test';
import { field } from '../../../story-runs/support/api';
import { ACCESO_DYNAMIC_TESTIDS, PROGRAMAS_TESTIDS } from '../../../../packages/shared/src/testids';
import { MISSION_SOCKET_EVENT } from '../../../../packages/shared/src/mission';
import { ACTION, CEILING_MS, attrOf, safe, waitUntil } from '../../support/browser';
import { check, sleep, type Check } from '../../support/checks';
import { outcome, type Outcome } from '../../core/framework';
import { TENANT_A, type Credentials } from '../../../story-runs/support/prepare';

// Piezas comunes de las filas web de EP-PROG-METRICAS (escritorio 1440 px, por la configuración del proyecto `web`). Los
// localizadores son de rol y de nombre accesible (región «Resumen de programas», tarjetas con su etiqueta, barra «Avance medio»,
// menú «Acciones para PRG-001»). El texto de cada tarjeta se lee de sus hijos, no del diseño; las cifras pintadas de la barra se
// miden en píxeles. Ninguna espera de red se traga: si una petición que la fila necesita no llega, la fila lo dice.

export const LOGIN_URL = `/login?tenant=${TENANT_A}`;
export const SUMMARY_PATH = '/api/mission/summary';
export const PROGRAMS_API_PATH = '/api/programs';
/** Texto de una tarjeta mientras el resumen no llega, y de una tarjeta si el resumen falla (las dos cifras de la historia). */
export const LOADING = '…';
export const FAILED = '—';
/** Etiquetas de las cuatro tarjetas, en el orden de la cabecera. */
export const CARD_LABELS: readonly string[] = ['Programas', 'Activos', 'Avance medio', 'NC abiertas'];

/** Tolerancia de la prueba para un aviso que debe NO aparecer (la historia no fija el plazo). */
export const QUIET_MS = 2_000;

// --- Ejecución de pasos con diagnóstico propio --------------------------------------------------------------------------------
// Envoltorio propio de `runSteps` (no se toca support/browser.ts): además de la primera línea, guarda las tres primeras del
// mensaje de Playwright en la nota y un registro de llamada acotado en la evidencia. Así se distingue un fallo de la app (un
// «intercepts pointer events» o «element is not enabled») de uno del manejador (un selector que no localiza nada).

export type Step = readonly [what: string, action: () => Promise<unknown>];

export interface StepFailure {
  /** Qué se intentaba y las tres primeras líneas del mensaje de error. */
  readonly message: string;
  /** Hasta quince líneas del mensaje (incluye el «Call log:» de Playwright), sin códigos de color. */
  readonly callLog: readonly string[];
}

const TRACE_LINES = 3;
const CALL_LOG_LINES = 15;
// Los códigos de color ANSI que Playwright añade al registro de llamada
// eslint-disable-next-line no-control-regex
const ANSI = /\u001b\[[0-9;]*m/g;

const linesOfError = (error: unknown): string[] => {
  const text = error instanceof Error ? error.message : String(error);
  return text
    .replace(ANSI, '')
    .split('\n')
    .map((line) => line.trimEnd())
    .filter((line) => line.trim() !== '');
};

export const runSteps = async (steps: readonly Step[]): Promise<StepFailure | undefined> => {
  for (const [what, action] of steps) {
    try {
      await action();
    } catch (error) {
      const lines = linesOfError(error);
      return { message: `no se pudo ${what}: ${lines.slice(0, TRACE_LINES).join(' | ')}`, callLog: lines.slice(0, CALL_LOG_LINES) };
    }
  }
  return undefined;
};

const NOT_EVALUATED_NOTE = 'No se pudo reproducir el estado inicial que da por hecho la historia; la app no hace lo que la preparación describe.';

/** Un paso de la historia que la pantalla no ofrece: la historia manda, pero el registro de llamada dice si fue la app o el manejador. */
export const actionMissing = (expected: string, failure: StepFailure): Outcome =>
  outcome(false, expected, failure.message, {
    note: 'La historia nombra un elemento que la pantalla no ofrece. Revisar el registro de llamada: «intercepts pointer events» o «not enabled» apuntan a la app; «resolved to 0 elements» o un selector ambiguo, al manejador.',
    evidence: { callLog: failure.callLog },
  });

/** La preparación de la fila (inicio de sesión, cambios previos) no se cumplió. */
export const prepFailed = (expected: string, failure: StepFailure): Outcome =>
  outcome(false, expected, `la preparación no se cumplió: ${failure.message}`, { note: NOT_EVALUATED_NOTE, evidence: { callLog: failure.callLog } });

/** Igual, con un motivo que no viene de un paso del navegador. */
export const prepFailedReason = (expected: string, reason: string): Outcome => outcome(false, expected, `la preparación no se cumplió: ${reason}`, { note: NOT_EVALUATED_NOTE });

// --- Inicio de sesión ---------------------------------------------------------------------------------------------------------

/** Fija SOLO la preferencia de cookies (no es una sesión): el aviso de cookies tapa los controles de pie de página. */
const fixCookiePreference = (): void => {
  try {
    localStorage.setItem('sigpro.cookies', 'accepted');
  } catch {
    // sin almacenamiento: no hay preferencia que fijar
  }
};

/**
 * Inicia sesión en alumno01 desde /login?tenant=alumno01 con la cuenta de la fila y espera a llegar a /programs. NO espera a que
 * las tarjetas ni la lista se carguen: cada fila decide qué observa y cuándo (la carga y el retraso son parte de la prueba).
 */
export const signIn = (page: Page, credentials: Credentials): Promise<StepFailure | undefined> =>
  runSteps([
    ['fijar la preferencia de cookies', () => page.context().addInitScript(fixCookiePreference)],
    ['abrir /login?tenant=alumno01', () => page.goto(LOGIN_URL, { timeout: CEILING_MS })],
    ['escribir el correo', () => page.getByLabel('Correo electrónico', { exact: true }).fill(credentials.email, ACTION)],
    ['escribir la contraseña', () => page.getByLabel('Contraseña', { exact: true }).fill(credentials.password, ACTION)],
    ['pulsar «Entrar»', () => page.getByRole('button', { name: 'Entrar', exact: true }).click(ACTION)],
    ['llegar a /programs', () => page.waitForURL(/\/programs/, { timeout: CEILING_MS })],
  ]);

// --- Localizadores de la pantalla de programas -----------------------------------------------------------------------------------

/** Cabecera de métricas: la región con nombre «Resumen de programas». */
export const summaryBlock = (page: Page): Locator => page.getByRole('region', { name: 'Resumen de programas', exact: true });
/** Título de la página (h1 de escritorio); su contenedor lleva el subtítulo «N programas · M activo». */
export const pageHeading = (page: Page): Locator => page.getByRole('heading', { name: 'Programas', level: 1, exact: true });
/** Tabla de la lista (escritorio). */
export const programsTable = (page: Page): Locator => page.getByRole('table');
/** Bloque «Sin programas» de la lista (id de prueba: es el único contenedor que lo agrupa). */
export const emptyBlock = (page: Page): Locator => page.getByTestId(PROGRAMAS_TESTIDS.PROGRAMS_EMPTY);
/** Buscador de la cabecera («Búsqueda global»). */
export const globalSearch = (page: Page): Locator => page.getByRole('searchbox', { name: 'Búsqueda global', exact: true });
/** Filtro de estado de la lista. */
export const statusFilter = (page: Page): Locator => page.getByRole('combobox', { name: 'Estado', exact: true });
/** Botón ⋯ de la fila de un programa (su nombre accesible es «Acciones para PRG-001»). */
export const rowActionsButton = (page: Page, code: string): Locator => page.getByRole('button', { name: `Acciones para ${code}`, exact: true });

/** Visible de verdad: exactamente un elemento que se ve. Cero, varios (ambiguo) o no visible cuentan como «no visible». */
export const strictlyVisible = async (target: Locator): Promise<boolean> => {
  const found = await safe(() => target.count(), -1);
  if (found !== 1) return false;
  return safe(() => target.isVisible(), false);
};

/** La lista de programas sigue visible (tabla de escritorio). */
export const listStillVisible = (page: Page): Promise<boolean> => strictlyVisible(programsTable(page));
/** El bloque «Sin programas» se ve. */
export const emptyVisible = (page: Page): Promise<boolean> => strictlyVisible(emptyBlock(page));

/** Espera (con techo) a que la lista esté montada: la tabla o el bloque vacío se ven. Devuelve si llegó. */
export const waitListLoaded = async (page: Page): Promise<boolean> =>
  (await waitUntil(async () => (await listStillVisible(page)) || (await emptyVisible(page)), CEILING_MS)).reached;

const CODE = /^PRG-\d{3}/;
/** Códigos de los programas de la tabla que se ven, en el orden de la pantalla. */
export const listedCodes = (page: Page): Promise<readonly string[]> =>
  safe(async () => {
    const texts = await programsTable(page).getByRole('link', { name: CODE }).allTextContents();
    return texts.map((text) => CODE.exec(text.trim())?.[0]).filter((code): code is string => code !== undefined);
  }, []);

export const sameCodes = (actual: readonly string[], expected: readonly string[]): boolean => actual.length === expected.length && actual.every((code, index) => code === expected[index]);

// --- Lectura de las tarjetas --------------------------------------------------------------------------------------------------

export interface CardReading {
  readonly label: string;
  /** La tarjeta existe y hay exactamente una con esa etiqueta. */
  readonly found: boolean;
  /** Segundo texto de la tarjeta: la cifra grande. */
  readonly value: string | undefined;
  /** Último texto de la tarjeta: la línea auxiliar (la barra no tiene texto). */
  readonly aux: string | undefined;
}

const NOT_FOUND = (label: string): CardReading => ({ label, found: false, value: undefined, aux: undefined });

/**
 * Lee las cuatro tarjetas del bloque de una vez (la etiqueta, la cifra, la barra vacía y la línea auxiliar son hijos del grupo).
 * Una lectura fallida o ambigua devuelve `found: false`: nunca cuenta como cumplida.
 */
export const readCards = (block: Locator): Promise<readonly CardReading[]> =>
  safe(
    async () => {
      const raw = await block.evaluate(
        (root, labels: readonly string[]) =>
          labels.map((label) => {
            const groups = Array.from(root.querySelectorAll('[role="group"]')).filter((element) => element.getAttribute('aria-label') === label);
            const [only] = groups;
            if (groups.length !== 1 || only === undefined) return { label, found: false, texts: [] as string[] };
            const texts = Array.from(only.children, (child) => (child.textContent ?? '').trim()).filter((text) => text !== '');
            return { label, found: true, texts };
          }),
        CARD_LABELS,
        { timeout: 500 },
      );
      return raw.map(({ label, found, texts }): CardReading => {
        if (!found) return NOT_FOUND(label);
        const aux = texts.length >= 3 ? texts[texts.length - 1] : undefined;
        return { label, found: true, value: texts[1], aux };
      });
    },
    CARD_LABELS.map(NOT_FOUND),
  );

/** Lectura de una tarjeta por su etiqueta. */
export const readCard = async (block: Locator, label: string): Promise<CardReading> => (await readCards(block)).find((reading) => reading.label === label) ?? NOT_FOUND(label);

/** Espera (con techo) a que las cuatro tarjetas tengan cifra distinta de «…»: cargadas, o con el guion largo si el resumen falló. */
export const waitCardsSettled = async (block: Locator, ceilingMs: number = CEILING_MS): Promise<boolean> =>
  (
    await waitUntil(async () => {
      const readings = await readCards(block);
      return readings.every((reading) => reading.found && reading.value !== LOADING);
    }, ceilingMs)
  ).reached;

/** Una tarjeta igual a lo que dice la historia: cifra y línea auxiliar. */
export interface CardSpec {
  readonly label: string;
  readonly value: string;
  readonly aux: string;
}

export const cardCheck = (reading: CardReading, spec: CardSpec): Check =>
  check(
    reading.found && reading.value === spec.value && reading.aux === spec.aux,
    `la tarjeta «${spec.label}» muestra ${spec.value} y debajo la línea «${spec.aux}»`,
    reading.found ? `la tarjeta «${spec.label}» muestra ${reading.value ?? '(sin leer)'} y debajo la línea «${reading.aux ?? '(sin leer)'}»` : `la tarjeta «${spec.label}» no aparece`,
  );

/** Una tarjeta con solo su cifra (las filas que solo nombran la cifra). */
export const valueCheck = (reading: CardReading, value: string): Check =>
  check(reading.found && reading.value === value, `la tarjeta «${reading.label}» muestra ${value}`, `la tarjeta «${reading.label}» muestra ${reading.value ?? '(sin leer)'}`);

/** Una tarjeta con el guion largo en la cifra y en la línea auxiliar (el resumen falló). */
export const dashCheck = (reading: CardReading): Check =>
  check(
    reading.found && reading.value === FAILED && reading.aux === FAILED,
    `la tarjeta «${reading.label}» muestra «—» en la cifra y en la línea auxiliar`,
    reading.found ? `la tarjeta «${reading.label}» muestra ${reading.value ?? '(sin leer)'} y ${reading.aux ?? '(sin leer)'}` : `la tarjeta «${reading.label}» no aparece`,
  );

// --- Barra de «Avance medio» -----------------------------------------------------------------------------------------------------

export interface BarReading {
  readonly found: boolean;
  /** `aria-valuenow` de la barra. */
  readonly valueNow: string | undefined;
  /** Ancho que pide el estilo del relleno (evidencia: lo que la hoja de estilo declara). */
  readonly fill: string | undefined;
  /** Ancho PINTADO de la pista (la barra completa), en píxeles. */
  readonly trackPx: number | undefined;
  /** Ancho PINTADO del relleno, en píxeles. */
  readonly paintedPx: number | undefined;
}

const NO_BAR: BarReading = { found: false, valueNow: undefined, fill: undefined, trackPx: undefined, paintedPx: undefined };

export const readBar = (block: Locator, label: string): Promise<BarReading> =>
  safe(async () => {
    const bar = block.getByRole('progressbar', { name: label, exact: true });
    if ((await bar.count()) !== 1) return NO_BAR;
    const valueNow = await attrOf(bar, 'aria-valuenow');
    const fill = await bar.evaluate((element) => (element.firstElementChild as HTMLElement | null)?.style.width ?? '', undefined, { timeout: 500 });
    const track = await bar.boundingBox({ timeout: 500 }).catch(() => null);
    const painted = await bar.locator('span').first().boundingBox({ timeout: 500 }).catch(() => null);
    return { found: true, valueNow, fill, trackPx: track?.width, paintedPx: painted?.width };
  }, NO_BAR);

/** El relleno pintado llega al porcentaje de la pista, con una tolerancia de ±1 px. */
export const barPainted = (reading: BarReading, percent: number): boolean =>
  reading.trackPx !== undefined && reading.paintedPx !== undefined && reading.trackPx > 0 && Math.abs(reading.paintedPx - (reading.trackPx * percent) / 100) <= 1;

/** Barra igual al porcentaje de la historia: `aria-valuenow` y ancho pintado. */
export const barCheck = (reading: BarReading, percent: string): Check => {
  const ok = reading.found && reading.valueNow === percent && barPainted(reading, Number(percent));
  const painted = reading.trackPx === undefined || reading.paintedPx === undefined ? 'sin medir' : `${reading.paintedPx.toFixed(1)} px de ${reading.trackPx.toFixed(1)} px`;
  return check(
    ok,
    `la barra de «Avance medio» está llena hasta el ${percent} % (ancho pintado con ±1 px) y su valor es ${percent}`,
    reading.found ? `valor ${reading.valueNow ?? '(sin leer)'}; ancho pintado ${painted}; estilo del relleno ${reading.fill ?? '(sin leer)'}` : 'la barra no aparece',
  );
};

// --- Subtítulo ------------------------------------------------------------------------------------------------------------------

/** Subtítulo de la cabecera: segundo texto del contenedor del título («Programas»). Undefined si no es una lectura limpia. */
export const readSubtitle = (page: Page): Promise<string | undefined> =>
  safe(
    async () => {
      const heading = pageHeading(page);
      if ((await heading.count()) !== 1) return undefined;
      const texts = await heading.locator('xpath=..').evaluate((parent) => Array.from(parent.children, (child) => (child.textContent ?? '').trim()).filter((text) => text !== ''), undefined, {
        timeout: 500,
      });
      return texts[1];
    },
    undefined,
  );

// --- Resumen: retraso, fallo y peticiones ---------------------------------------------------------------------------------------

/** Lo que la prueba provoca en el resumen: demora, error HTTP o ninguna respuesta (corte de una sola petición). */
export type SummaryFault = { readonly kind: 'delay'; readonly ms: number } | { readonly kind: 'http'; readonly status: number } | { readonly kind: 'abort' };

export interface SummaryProbe {
  /** Instante (ms de `performance.now()`) de la primera petición del resumen, o `undefined` si aún no hubo. */
  readonly firstRequestAt: () => number | undefined;
  /** Instante de la última petición GET del resumen (la que pinta las tarjetas de la pantalla que se observa). */
  readonly lastRequestAt: () => number | undefined;
  /** Peticiones GET del resumen recibidas en la página. */
  readonly hits: () => number;
}

/**
 * Instala la falla en TODAS las peticiones GET del resumen de la página (la de la cabecera del login y la de las tarjetas): antes
 * de iniciar sesión, para que la fila no la pueda ver antes de tiempo. Las demás peticiones (y las OPTIONS) pasan sin tocar.
 */
export const interceptSummary = async (page: Page, fault: SummaryFault): Promise<SummaryProbe> => {
  let first: number | undefined;
  let last: number | undefined;
  let hits = 0;
  await page.route(
    (url) => url.pathname === SUMMARY_PATH,
    async (route) => {
      const request = route.request();
      if (request.method() !== 'GET') return route.continue();
      hits += 1;
      last = performance.now();
      if (first === undefined) first = last;
      if (fault.kind === 'delay') {
        await sleep(fault.ms);
        return route.continue().catch(() => undefined);
      }
      if (fault.kind === 'abort') return route.abort('internetdisconnected');
      // Con cabeceras CORS: la página llama a la API desde otro origen, y sin ellas el navegador daría un fallo de red y no el error
      const origin = request.headers().origin ?? '*';
      return route.fulfill({
        status: fault.status,
        contentType: 'application/json',
        headers: { 'access-control-allow-origin': origin, 'access-control-expose-headers': '*' },
        body: JSON.stringify({ statusCode: fault.status, error: 'Service Unavailable', message: 'Error provocado por la prueba' }),
      });
    },
  );
  return { firstRequestAt: () => first, lastRequestAt: () => last, hits: () => hits };
};

/** Respuesta del resumen que provoca una acción: estado y las dos cifras de NC del `kpis` que devuelve. */
export interface SummaryReply {
  readonly status: number;
  readonly ncOpen: unknown;
  readonly ncTotal: unknown;
}

/**
 * Espera (con techo) a la primera respuesta GET del resumen que llegue DESPUÉS de crear la espera: se llama antes de la acción.
 * Devuelve `undefined` si no llega (quien llama decide; no se traga). Lee el `kpis` de esa respuesta como observación.
 */
export const summaryReply = (page: Page): Promise<SummaryReply | undefined> =>
  page
    .waitForResponse((reply) => new URL(reply.url()).pathname === SUMMARY_PATH && reply.request().method() === 'GET', { timeout: CEILING_MS })
    .then(
      async (reply) => {
        const body: unknown = await reply.json().catch(() => undefined);
        const kpis = field(body, 'kpis');
        return { status: reply.status(), ncOpen: field(kpis, 'ncOpen'), ncTotal: field(kpis, 'ncTotal') };
      },
      () => undefined,
    );

/**
 * Ejecuta la acción y devuelve si llegó la petición de LISTA (GET /api/programs) que provoca. Si no llega en el techo, devuelve
 * `false`: quien llama lo convierte en un fallo con motivo (no se traga el timeout).
 */
export const afterListResponse = async (page: Page, act: () => Promise<unknown>): Promise<boolean> => {
  const reply = page
    .waitForResponse((response) => new URL(response.url()).pathname === PROGRAMS_API_PATH && response.request().method() === 'GET', { timeout: CEILING_MS })
    .then(
      () => true,
      () => false,
    );
  await act();
  return reply;
};

// --- Recarga de la página ---------------------------------------------------------------------------------------------------------

export interface ReloadVerdict {
  /** El marcador `window.__sinRecarga` que se puso antes de la acción sigue en la página. */
  readonly kept: boolean;
  /** Cargas completas del documento (evento `load`) desde que se puso el marcador. */
  readonly loads: number;
  /** Navegaciones del marco principal (`framenavigated`), incluidas las de la aplicación (sin recarga) que cambian la URL. */
  readonly navigations: number;
}

export interface ReloadGuard {
  /** Pone el marcador (número aleatorio) y empieza a contar. Devuelve si el marcador quedó puesto. */
  readonly arm: () => Promise<boolean>;
  /** Lee el marcador y los contadores desde el armado. */
  readonly verdict: () => Promise<ReloadVerdict>;
}

const MARKER_KEY = '__sinRecarga';

/**
 * Guarda «sin recargar la página»: el marcador vive en `window`, así que una recarga completa lo borra. Los eventos `load` del
 * documento principal cuentan las cargas completas; `framenavigated` se registra como evidencia.
 */
export const reloadGuard = (page: Page): ReloadGuard => {
  let armed = false;
  let marker: number | undefined;
  let loads = 0;
  let navigations = 0;
  page.on('load', () => {
    if (armed) loads += 1;
  });
  page.on('framenavigated', (frame) => {
    if (armed && frame === page.mainFrame()) navigations += 1;
  });
  return {
    arm: async () => {
      const stamp = Math.floor(Math.random() * 1_000_000_000) + 1;
      try {
        // La clave viaja como argumento: dentro de la función del navegador no existe la constante del módulo
        await page.evaluate(
          ([key, value]: [string, number]) => {
            (window as unknown as Record<string, number>)[key] = value;
          },
          [MARKER_KEY, stamp] as [string, number],
        );
      } catch {
        return false;
      }
      marker = stamp;
      armed = true;
      return true;
    },
    verdict: async () => {
      const seen = await safe(
        () =>
          page.evaluate((key: string) => (window as unknown as Record<string, number | undefined>)[key], MARKER_KEY),
        undefined,
      );
      return { kept: marker !== undefined && seen === marker, loads, navigations };
    },
  };
};

/** «Sin recargar»: el marcador sigue y no hubo cargas completas del documento. */
export const reloadCheck = (verdict: ReloadVerdict): Check =>
  check(
    verdict.kept && verdict.loads === 0,
    'sin recargar la página: el mismo documento tras la acción (el marcador sigue y no hay cargas completas)',
    verdict.kept ? (verdict.loads === 0 ? 'sin recargar: el marcador sigue en la página' : `la página se recargó: ${verdict.loads} carga(s) completa(s)`) : 'la página se recargó: el marcador desapareció',
  );

// --- Socket de misión (eventos en vivo) -----------------------------------------------------------------------------------------

export interface LiveTap {
  /** Ha llegado el acuse de conexión de Socket.IO al espacio por defecto (la conexión en vivo está abierta). */
  readonly connected: () => boolean;
  /** Tipos de los eventos `mission:event` recibidos, en orden (`nc_created`, `nc_updated`…). */
  readonly events: () => readonly string[];
}

/** Tipo del evento de una trama de Socket.IO (`42["mission:event",{…}]`), o `undefined` si la trama no es un evento de misión. */
const eventTypeOf = (frame: string): string | undefined => {
  if (!frame.startsWith('42')) return undefined;
  try {
    const packet = JSON.parse(frame.slice(2)) as unknown;
    if (!Array.isArray(packet) || packet[0] !== MISSION_SOCKET_EVENT) return undefined;
    const body: unknown = packet[1];
    const type = typeof body === 'object' && body !== null ? (body as { readonly type?: unknown }).type : undefined;
    return typeof type === 'string' ? type : undefined;
  } catch {
    return undefined;
  }
};

/**
 * Escucha el WebSocket de la página (Socket.IO) para saber si la conexión en vivo está abierta y qué eventos de misión llegan. Debe
 * llamarse ANTES de iniciar sesión. La lista de programas no tiene indicador de conexión: las tramas son la única observación.
 */
export const tapLive = (page: Page): LiveTap => {
  let connected = false;
  const events: string[] = [];
  page.on('websocket', (socket) => {
    if (!socket.url().includes('/socket.io')) return;
    socket.on('framereceived', (frame) => {
      const text = typeof frame.payload === 'string' ? frame.payload : frame.payload.toString('utf8');
      // «40» es el acuse de conexión al espacio por defecto de Socket.IO
      if (text.startsWith('40')) connected = true;
      const type = eventTypeOf(text);
      if (type !== undefined) events.push(type);
    });
  });
  return { connected: () => connected, events: () => events };
};

// --- Avisos emergentes -----------------------------------------------------------------------------------------------------------

/** Cuántos avisos de ese tono hay en pantalla (-1 si la lectura falla: no cuenta como «ninguno»). */
export const toastCount = (page: Page, tone: 'ok' | 'danger' | 'info' | 'warn'): Promise<number> =>
  safe(() => page.getByTestId(ACCESO_DYNAMIC_TESTIDS.TOAST(tone)).count(), -1);

/** Avisos de error o de advertencia (`danger` y `warn`) en pantalla; -1 si alguna lectura falla. */
export const warningToastCount = async (page: Page): Promise<number> => {
  const danger = await toastCount(page, 'danger');
  const warn = await toastCount(page, 'warn');
  return danger < 0 || warn < 0 ? -1 : danger + warn;
};

// --- Menú de acciones de una fila -----------------------------------------------------------------------------------------------

/**
 * Acción del menú ⋯ de una fila; `confirm` indica que el diálogo «Eliminar programa» pide confirmar con «Eliminar». La respuesta del
 * resumen que provoca se espera con techo y se devuelve (o `undefined` si no llegó).
 */
export const rowAction = async (page: Page, code: string, item: string, confirm: boolean): Promise<SummaryReply | undefined> => {
  const reply = summaryReply(page);
  await rowActionsButton(page, code).click(ACTION);
  await page.getByRole('menu', { name: `Acciones para ${code}`, exact: true }).getByRole('menuitem', { name: item, exact: true }).click(ACTION);
  if (confirm) await page.getByRole('alertdialog', { name: 'Eliminar programa', exact: true }).getByRole('button', { name: 'Eliminar', exact: true }).click(ACTION);
  return reply;
};

// --- Códigos y celdas ------------------------------------------------------------------------------------------------------------

export const progCodeOf = (text: string): string => {
  if (!/^PRG-\d{3}$/.test(text)) throw new Error(`celda sin interpretación: código de programa «${text}»`);
  return text;
};

export const ncCodeOf = (text: string): string => {
  if (!/^NC-\d{3}$/.test(text)) throw new Error(`celda sin interpretación: código de NC «${text}»`);
  return text;
};

/** Cuerpo JSON de una celda entre comillas invertidas (`{"to": "closed"}`). Otra forma lanza. */
export const jsonBodyOf = (text: string): unknown => {
  const match = /^`(.+)`$/.exec(text.trim());
  if (!match?.[1]) throw new Error(`celda sin interpretación: cuerpo «${text}» sin comillas invertidas`);
  return JSON.parse(match[1]) as unknown;
};

/** Un número de una celda de texto (`3 segundos` → 3000 ms). Cualquier otra forma lanza. */
export const delayMsOf = (text: string): number => {
  const match = /^(\d+) segundos$/.exec(text.trim());
  if (!match?.[1]) throw new Error(`celda sin interpretación: retraso «${text}»`);
  return Number(match[1]) * 1_000;
};

/** Un valor de texto exacto (subtítulo, filtro). */
export const textCheck = (observed: string | undefined, expected: string, what: string): Check =>
  check(observed === expected, `${what} «${expected}»`, `${what} «${observed ?? '(sin leer)'}»`);

/** Helper de los Esquemas: el resultado de conclude() con la nota de discrepancia cuando hay una. */
export const withNote = (result: Outcome, note: string): Outcome => (result.verdict === 'coincide' ? result : { ...result, note });
