import type { Locator, Page } from '@playwright/test';
import { MISION_DYNAMIC_TESTIDS, MISION_TESTIDS, PROGRAMAS_TESTIDS, RESPONSIVE_TESTIDS } from '../../../../packages/shared/src/testids';
import { call, field, type ApiResult } from '../../../story-runs/support/api';
import { TENANT_A, type Credentials } from '../../../story-runs/support/prepare';
import { ACTION, CEILING_MS, attrOf, runSteps, safe, textOf, waitUntil } from '../../support/browser';
import { check, type Check } from '../../support/checks';
import { outcome, type BrowserRowHandler, type Outcome } from '../../core/framework';

// Piezas comunes de las filas web (escritorio 1440 px) y responsive (390 px) de EP-NAVEGACION. Localizadores de rol y de nombre
// accesible; los ids de prueba solo donde la pantalla no ofrece otro rastro (la barra por `aside`, la insignia, las migas).
// Toda acción pasa por `clickAction`: si falla, la nota dice si el elemento no existe, si lo tapa otro o si el clic no produce
// efecto. Las lecturas van con plazo (`safe`, `evaluate` con timeout) y los avisos se registran ANTES de la acción.

export const DESKTOP = { width: 1440, height: 900 } as const;
export const RESPONSIVE = { width: 390, height: 844 } as const;

/** Nota común de las filas web: la prueba fija la preferencia de cookies para que el aviso no tape los controles. */
export const COOKIE_NOTE = 'La prueba fija la preferencia de cookies (sigpro.cookies = accepted) antes de abrir la app; el aviso de cookies no se ejerce aquí.';

const COOKIE_KEY = 'sigpro.cookies';
const TOAST_LOG = '__navToastLog';
/** Ventana de los avisos emergentes: 3 s la pantalla, 2 s de margen de lectura. */
export const TOAST_CEILING_MS = 2_000;

/** Preferencia de cookies: solo si no hay ninguna (se serializa en la página: no usa nada del módulo). */
const acceptCookies = (key: string): void => {
  try {
    if (window.localStorage.getItem(key) === null) window.localStorage.setItem(key, 'accepted');
  } catch {
    // Sin almacenamiento disponible el aviso de cookies simplemente aparece.
  }
};

/** Registro de avisos emergentes instalado antes de cargar la app (se serializa: no usa nada del módulo). */
const recordToasts = (key: string): void => {
  const registry = window as unknown as Record<string, unknown>;
  if (Array.isArray(registry[key])) return;
  const log: { tone: string; title: string; body: string }[] = [];
  registry[key] = log;
  const toneOf = (element: Element): string | undefined => /^toast-(ok|danger|info|warn)$/.exec(element.getAttribute('data-testid') ?? '')?.[1];
  const record = (element: Element, tone: string): void => {
    const lines = (element as HTMLElement).innerText
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line !== '' && line !== '×');
    log.push({ tone, title: lines[0] ?? '', body: lines[1] ?? '' });
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
};

/** Instala la preferencia de cookies y el registro de avisos en la página ANTES de la primera carga. */
export const prepareWeb = async (page: Page, size: { readonly width: number; readonly height: number }): Promise<void> => {
  await page.addInitScript(acceptCookies, COOKIE_KEY);
  await page.addInitScript(recordToasts, TOAST_LOG);
  await page.setViewportSize(size);
};

export interface ToastEntry {
  readonly tone: string;
  readonly title: string;
  readonly body: string;
}

/** Vacía el registro de avisos justo antes de la acción («armado»): lo que aparezca después es lo que la acción produjo. */
export const armToasts = (page: Page): Promise<void> =>
  safe(
    () =>
      page.evaluate((key: string) => {
        const log = (window as unknown as Record<string, ToastEntry[] | undefined>)[key];
        if (Array.isArray(log)) log.length = 0;
      }, TOAST_LOG),
    undefined,
  );

/** Avisos registrados desde la última «armada». */
export const toastsOf = (page: Page): Promise<readonly ToastEntry[]> =>
  safe(
    () =>
      page.evaluate((key: string) => {
        const log = (window as unknown as Record<string, ToastEntry[] | undefined>)[key];
        return Array.isArray(log) ? log.map((entry) => ({ tone: entry.tone, title: entry.title, body: entry.body })) : [];
      }, TOAST_LOG),
    [],
  );

/** Espera (con techo corto) a que aparezca un aviso con ese tono, título y cuerpo. */
export const waitToast = async (page: Page, tone: string, title: string, body: string): Promise<boolean> =>
  (await waitUntil(async () => (await toastsOf(page)).some((entry) => entry.tone === tone && entry.title === title && entry.body === body), TOAST_CEILING_MS)).reached;

/** Seguimiento del canal en tiempo real: Socket.IO responde `40{…}` cuando el cliente ya está dentro del room del tenant. */
export interface Realtime {
  readonly connected: () => boolean;
}

export const trackRealtime = (page: Page): Realtime => {
  let connected = false;
  page.on('websocket', (socket) => {
    socket.on('framereceived', (frame) => {
      if (typeof frame.payload === 'string' && frame.payload.startsWith('40{')) connected = true;
    });
  });
  return { connected: () => connected };
};

/** Techo para que el canal se conecte tras iniciar sesión (la red local tarda menos de 1 s; el techo es de la prueba). */
const REALTIME_CEILING_MS = 10_000;

/** Espera a que el canal esté conectado. */
export const waitRealtime = async (link: Realtime): Promise<boolean> => (await waitUntil(async () => link.connected(), REALTIME_CEILING_MS)).reached;

/** Inicio de sesión como lo haría una persona: formulario de /login del tenant y espera a /programs. */
export const signIn = (page: Page, credentials: Credentials, tenant: string = TENANT_A): Promise<string | undefined> =>
  runSteps([
    ['abrir /login', () => page.goto(`/login?tenant=${tenant}`, { timeout: CEILING_MS })],
    ['escribir el correo', () => page.getByLabel('Correo electrónico', { exact: true }).fill(credentials.email, ACTION)],
    ['escribir la contraseña', () => page.getByLabel('Contraseña', { exact: true }).fill(credentials.password, ACTION)],
    ['pulsar «Entrar»', () => page.getByRole('button', { name: 'Entrar', exact: true }).click(ACTION)],
    ['llegar a /programs', () => page.waitForURL(/\/programs(\?.*)?$/, { timeout: CEILING_MS })],
  ]);

// --- Acciones con diagnóstico ----------------------------------------------------------------------------------------------

export interface Diagnosed {
  readonly message: string;
  readonly note: string;
}

/** Quién recibe el clic en el centro del elemento (la pista de «está tapado»). */
const coveringOf = (target: Locator): Promise<string | undefined> =>
  safe(
    () =>
      target.first().evaluate(
        (element) => {
          const box = element.getBoundingClientRect();
          const hit = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
          if (!hit) return '(nada)';
          const testid = hit.getAttribute('data-testid');
          return `${hit.tagName.toLowerCase()}${testid ? ` [data-testid=${testid}]` : ''} «${(hit.textContent ?? '').trim().slice(0, 40)}»`;
        },
        undefined,
        { timeout: 2_000 },
      ),
    undefined,
  );

/** Clic como una persona. Ante el fallo dice si el elemento no existe, si lo tapa otro, o si está deshabilitado. */
export const clickAction = async (_page: Page, target: Locator, what: string): Promise<Diagnosed | undefined> => {
  try {
    await target.click(ACTION);
    return undefined;
  } catch (error) {
    const text = error instanceof Error ? error.message : String(error);
    const head = text.split('\n').map((line) => line.trim()).filter((line) => line !== '').slice(0, 3).join(' | ');
    const count = await safe(() => target.count(), -1);
    const covered = /intercepts pointer events/.test(text) ? await coveringOf(target) : undefined;
    const disabled = /not enabled|disabled/.test(text);
    const reason =
      count === 0
        ? 'el elemento no existe en la pantalla'
        : covered !== undefined
          ? `existe pero lo tapa ${covered}`
          : disabled
            ? 'existe pero está deshabilitado'
            : count === -1
              ? 'no se pudo leer el elemento'
              : 'recibe el clic pero no ocurre la acción esperada';
    return { message: `no se pudo ${what}`, note: `${reason}. Playwright: ${head}` };
  }
};

/** Resultado de una fila que no llegó a su acción: la historia nombra algo que la pantalla no ofrece (discrepancia, no error del arnés). */
export const actionFailed = (expected: string, failure: Diagnosed): Outcome =>
  outcome(false, expected, failure.message, { note: `La historia nombra un elemento o un paso que la pantalla no ofrece: ${failure.note}` });

/** Fallo de preparación de la fila (el estado que la historia da por hecho no se produjo). */
export const prepFailed = (expected: string, reason: string): Outcome =>
  outcome(false, expected, `la preparación no se cumplió: ${reason}`, { note: 'No se pudo reproducir el estado inicial que da por hecho la historia; la app no hace lo que la preparación describe.' });

/** Anota una nota en el resultado de una fila (sin cambiar su veredicto). */
export const withNote = (result: Outcome, note: string): Outcome => ({ ...result, note: result.note === undefined ? note : `${result.note} ${note}` });

/** Envuelve el manejador de una fila web para anotar la nota de cookies en todas sus filas. */
export const noted = (handler: BrowserRowHandler): BrowserRowHandler => async (row, fixtures) => withNote(await handler(row, fixtures), COOKIE_NOTE);

// --- Lecturas de la interfaz -----------------------------------------------------------------------------------------------

/** Un texto visible en la página (una sola coincidencia exacta). */
export const seenText = async (page: Page, text: string): Promise<boolean> => {
  const exact = page.getByText(text, { exact: true });
  const found = await safe(() => exact.count(), 0);
  return found === 1 && (await safe(() => exact.first().isVisible(), false));
};

/** Cuadro «Búsqueda global» de la cabecera de escritorio (combobox fuera de /programs, searchbox en /programs). */
export const headerSearch = (page: Page): Locator =>
  page.getByRole('combobox', { name: 'Búsqueda global', exact: true }).or(page.getByRole('searchbox', { name: 'Búsqueda global', exact: true }));

/** Opción de la lista de resultados cuyo nombre empieza por el código (el nombre incluye código, título y subtítulo). */
export const optionOf = (page: Page, code: string): Locator => page.getByRole('option', { name: new RegExp(`^${code}`) });

// --- Barra lateral, migas y menús ------------------------------------------------------------------------------------------

/** Barra lateral de escritorio (`aside` con la navegación) y cajón del diseño responsive: el id de prueba del `aside`. */
export const DESKTOP_ASIDE = PROGRAMAS_TESTIDS.LAYOUT_SIDEBAR;
export const DRAWER_ASIDE = RESPONSIVE_TESTIDS.LAYOUT_SIDEBAR;

export interface NavEntry {
  readonly title: string | null;
  readonly current: boolean;
  readonly text: string;
}

/** Entradas de la lista de navegación de un `aside`, en orden: título (la etiqueta), si es la página actual y el texto visible. */
export const navEntries = (page: Page, asideTestId: string): Promise<readonly NavEntry[]> =>
  safe(
    () =>
      page
        .getByTestId(asideTestId)
        .locator('nav')
        .first()
        .getByRole('link')
        .evaluateAll((links) => links.map((link) => ({ title: link.getAttribute('title'), current: link.getAttribute('aria-current') === 'page', text: (link as HTMLElement).innerText }))),
    [],
  );

/** Migas de pan de escritorio: el texto de cada elemento de la lista, sin el separador «/». */
export const crumbsOf = (page: Page): Promise<readonly string[] | undefined> =>
  safe(
    () =>
      page
        .getByTestId(PROGRAMAS_TESTIDS.LAYOUT_BREADCRUMBS)
        .evaluate((nav) => Array.from(nav.children, (child) => (child.textContent ?? '').replace(/^\s*\/\s*/, '').trim()), undefined, { timeout: 2_000 }),
    undefined,
  );

/** Orden vertical (de arriba abajo) de un conjunto de elementos: cada uno con su caja; `undefined` si alguno no se lee. */
export const topsOf = async (targets: readonly Locator[]): Promise<readonly number[] | undefined> => {
  const tops: number[] = [];
  for (const target of targets) {
    const box = await safe(() => target.first().boundingBox({ timeout: 2_000 }), null);
    if (box === null) return undefined;
    tops.push(box.y);
  }
  return tops;
};

export const isAscending = (values: readonly number[] | undefined): boolean =>
  values !== undefined && values.every((value, index) => index === 0 || (values[index - 1] ?? Number.NEGATIVE_INFINITY) < value);

// --- Historial y redirecciones ---------------------------------------------------------------------------------------------

export const historyLength = (page: Page): Promise<number | undefined> => safe(() => page.evaluate(() => window.history.length), undefined);

/** Una redirección sustituye la dirección pedida: la navegación gana una sola entrada (no dos). */
export const historyCheck = (before: number | undefined, after: number | undefined): Check => {
  const delta = before === undefined || after === undefined ? undefined : after - before;
  return check(delta === 1, 'la redirección sustituye la dirección pedida en el historial (una sola entrada nueva)', delta === undefined ? 'historial no legible' : `entradas nuevas en el historial: ${String(delta)}`);
};

// --- Campana, insignia y panel de avisos -----------------------------------------------------------------------------------

export const bellButton = (page: Page): Locator => page.getByRole('button', { name: /^Notificaciones/ });
export const bellBadge = (page: Page): Locator => page.getByTestId(MISION_TESTIDS.LAYOUT_NOTIFICATIONS_COUNT);
export const notificationsPanel = (page: Page): Locator => page.getByTestId(PROGRAMAS_TESTIDS.LAYOUT_NOTIFICATIONS_POPOVER);
export const markReadButton = (page: Page): Locator => page.getByRole('button', { name: 'Marcar leídas', exact: true });

/** Texto que describe la campana (su nombre accesible), o `undefined` si no se lee. */
export const bellName = (page: Page): Promise<string | undefined> => attrOf(bellButton(page), 'aria-label');

/** Insignia visible: su número como texto, o `undefined` si no hay insignia. */
export const badgeText = async (page: Page): Promise<string | undefined> => {
  const text = await textOf(bellBadge(page));
  return text;
};

/** Filas del panel de avisos, en orden: el id de prueba de cada una y su gravedad. */
export const panelRows = (page: Page): Promise<readonly { readonly testid: string | null; readonly severity: string | null; readonly lines: readonly string[] }[]> =>
  safe(
    () =>
      page
        .getByRole('dialog', { name: 'Notificaciones', exact: true })
        .locator('[data-testid^="layout-notification-"]')
        .evaluateAll((rows) =>
          rows.map((row) => ({
            testid: row.getAttribute('data-testid'),
            severity: row.getAttribute('data-severity'),
            lines: (row as HTMLElement).innerText.split('\n').map((line) => line.trim()).filter((line) => line !== ''),
          })),
        ),
    [],
  );

/** Hora con horas, minutos y segundos (`hh:mm:ss`). */
export const TIME_OF = /^\d{2}:\d{2}:\d{2}$/;

// --- Simulador de misión: eventos con POST /api/mission/tick ----------------------------------------------------------------

export interface TickEvent {
  readonly seq: number | undefined;
  readonly severity: string | undefined;
}

/** Pulsaciones del simulador con el token del administrador; devuelve cada evento (su número y su gravedad) o la respuesta fallida. */
export const emitTicks = async (token: string, count: number): Promise<{ readonly events: readonly TickEvent[]; readonly failed?: ApiResult }> => {
  const events: TickEvent[] = [];
  for (let index = 0; index < count; index += 1) {
    const result = await call('POST', '/mission/tick', { tenant: TENANT_A, token });
    if (result.status !== 200) return { events, failed: result };
    const event = field(result.body, 'event');
    const seq = field(event, 'seq');
    const severity = field(event, 'severity');
    events.push({ seq: typeof seq === 'number' ? seq : undefined, severity: typeof severity === 'string' ? severity : undefined });
  }
  return { events };
};

/** Avisos de la campana según la historia: gravedad aviso (`warn`) o peligro (`danger`), el más reciente primero. */
export const notifiableSeqs = (events: readonly TickEvent[]): readonly number[] =>
  events
    .filter((event) => event.severity === 'warn' || event.severity === 'danger')
    .map((event) => event.seq)
    .filter((seq): seq is number => seq !== undefined)
    .sort((left, right) => right - left);

/** El testid de cada aviso del panel, como lo pinta la app, para un número de evento. */
export const rowTestIdOf = (seq: number): string => MISION_DYNAMIC_TESTIDS.LAYOUT_NOTIFICATION(seq);

// --- Búsqueda de escritorio: teclado y resultados --------------------------------------------------------------------------

/** Opción activa (`aria-selected` verdadero) de la lista de resultados, con su nombre; `undefined` si no hay ninguna. */
export const activeOption = (page: Page): Promise<string | undefined> =>
  safe(
    () =>
      page
        .getByRole('option')
        .and(page.locator('[aria-selected="true"]'))
        .first()
        .evaluate((option) => (option.textContent ?? '').trim(), undefined, { timeout: 2_000 }),
    undefined,
  );

/** El valor actual de un campo de texto (propiedad `value`), o `undefined` si no se lee. */
export const fieldValue = (target: Locator): Promise<string | undefined> => safe(() => target.first().inputValue({ timeout: 2_000 }), undefined);
