import type { Locator, Page } from '@playwright/test';
import { DEMO, TENANT_A, resetTenants, type Credentials } from '../../../story-runs/support/prepare';
import { NC_DYNAMIC_TESTIDS, NC_TESTIDS } from '../../../../packages/shared/src/testids';
import { ACTION, CEILING_MS, attrOf, runSteps, safe, textOf, waitUntil, type Step } from '../../support/browser';
import { check, conclude, preparationFailedWeb, sleep, type Check } from '../../support/checks';
import { outcome, type BrowserRowHandler, type Outcome } from '../../core/framework';
import { adminCredentials } from '../../../story-runs/support/api';
import { actorOf, detailNc, stateOfBody } from '../api/common';

// Piezas comunes de las filas WEB de EP-NC-TABLERO (escritorio 1440 px; diseño responsive 390 px, por debajo de 1024). Los
// localizadores son de testid de la pantalla (las columnas, las tarjetas y los avisos no tienen otro rastro único) y de nombre
// accesible para los controles de texto. Las lecturas del tablero van en UNA sola evaluación atómica; las acciones pasan por
// `interact` (si fallan, la nota dice si el elemento no existe, si lo tapa otro o si el clic no produce la acción).

export type Layout = 'escritorio' | 'responsive';
export const LAYOUT_OF: ReadonlyMap<string, Layout> = new Map<string, Layout>([
  ['escritorio', 'escritorio'],
  ['responsive', 'responsive'],
]);

export const viewportOf = (layout: Layout): { readonly width: number; readonly height: number } => (layout === 'escritorio' ? { width: 1440, height: 900 } : { width: 390, height: 844 });

export const LOGIN_URL = `/login?tenant=${TENANT_A}`;
/** Plazo corto para una lectura de la pantalla (una lectura no puede colgar la fila). */
export const READ_MS = 2_000;
/** Ruta del tablero y sus variantes. */
export const BOARD_PATH = '/nc';

/** Estados en orden del tablero; cada uno con su título visible. */
export const STATES: readonly string[] = ['open', 'in_analysis', 'corrective_action', 'closed', 'rejected'];

/** Nota que se añade a cada fila web: la preferencia de cookies se fija por adelantado, como en el resto de épicas. */
export const COOKIE_NOTE = 'La prueba fija la preferencia de cookies (sigpro.cookies = accepted) antes de abrir la app; el aviso de cookies no se ejerce aquí.';

export const onWeb =
  (handler: BrowserRowHandler): BrowserRowHandler =>
  async (row, fixtures) => {
    const result = await handler(row, fixtures);
    return { ...result, note: result.note === undefined ? COOKIE_NOTE : `${result.note} ${COOKIE_NOTE}` };
  };

const fixCookiePreference = (): void => {
  try {
    localStorage.setItem('sigpro.cookies', 'accepted');
  } catch {
    // sin almacenamiento: no hay preferencia que fijar
  }
};

// --- Cuentas e inicio de sesión por el formulario ------------------------------------------------------------------------------

/** Cuenta de la celda (correo) → credenciales del seed; cualquier otro correo LANZA al usarse con `strict`. */
export const ACCOUNT_BY_EMAIL: ReadonlyMap<string, Credentials> = new Map<string, Credentials>([
  ['gestor@sigpro.test', DEMO.gestor],
  ['consultor@sigpro.test', DEMO.consultor],
  ['auditor@sigpro.test', DEMO.auditor],
]);

/** Registro de avisos en la ventana (se arma antes de cada acción que produce un aviso). */
export const TOAST_KEY = '__ncToasts';

/** Un aviso registrado: tono, título (primera línea), cuerpo (segunda) y marca de tiempo del navegador. */
export interface ToastEntry {
  readonly tone: string;
  readonly title: string;
  readonly body: string;
  readonly at: number;
}

/** Se ejecuta en el navegador antes de cargar la app: registra cada aparición de un aviso. No usa variables de fuera. */
export const recordToasts = (key: string): void => {
  const registry = window as unknown as Record<string, unknown>;
  if (Array.isArray(registry[key])) return;
  const log: { tone: string; title: string; body: string; at: number }[] = [];
  registry[key] = log;
  const toneOf = (element: Element): string | undefined => /^toast-(ok|danger|info|warn)$/.exec(element.getAttribute('data-testid') ?? '')?.[1];
  const record = (element: Element, tone: string): void => {
    const lines = (element as HTMLElement).innerText.split('\n').map((line) => line.trim()).filter((line) => line !== '' && line !== '×');
    log.push({ tone, title: lines[0] ?? '', body: lines[1] ?? '', at: Date.now() });
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

/** Vacía el registro y marca el instante de la acción que se va a probar. */
export const armToasts = (page: Page): Promise<number> =>
  safe(
    () =>
      page.evaluate((key: string) => {
        const registry = window as unknown as Record<string, unknown>;
        const log = registry[key];
        if (Array.isArray(log)) log.length = 0;
        const at = Date.now();
        registry.__ncArmedAt = at;
        return at;
      }, TOAST_KEY),
    Date.now(),
  );

/** Registro de avisos desde la última «armada»; `undefined` si el registro no se puede leer (no es lo mismo que «ningún aviso»). */
export const toastLog = (page: Page): Promise<readonly ToastEntry[] | undefined> =>
  withLimit<readonly ToastEntry[] | undefined>(page.evaluate((key: string) => ((window as unknown as Record<string, unknown>)[key] as ToastEntry[] | undefined) ?? [], TOAST_KEY), undefined);

export interface ToastResult {
  readonly seen: boolean;
  /** Lo que hay en el registro desde la «armada», en una frase. */
  readonly observed: string;
}

/** Espera (con techo) a que aparezca un aviso del tono y título dados (y cuerpo, si se da). Consulta el registro, no la pantalla. */
export const toastShown = async (page: Page, tone: 'ok' | 'danger' | 'info' | 'warn', title: string, body?: string): Promise<ToastResult> => {
  const matches = (entry: ToastEntry): boolean => entry.tone === tone && entry.title === title && (body === undefined || entry.body === body);
  const found = await waitUntil(async () => ((await toastLog(page)) ?? []).some(matches), CEILING_MS);
  const log = await toastLog(page);
  const observed = log === undefined ? '(registro de avisos sin leer)' : log.length === 0 ? '(ninguno)' : log.map((entry) => `${entry.tone} «${entry.title}»${entry.body === '' ? '' : ` / «${entry.body}»`}`).join(' | ');
  return { seen: found.reached, observed };
};

/**
 * Preparación de cada fila: fija la preferencia de cookies, el ancho de la ventana, abre /login?tenant=alumno01, escribe la cuenta
 * con su contraseña y pulsa «Entrar». Termina en /programs (la página no pide la lista del tablero). Las rutas de la fila se
 * arman DESPUÉS de este paso y ANTES de abrir /nc.
 */
export const signIn = (page: Page, layout: Layout, email: string): Promise<string | undefined> => {
  const credentials = ACCOUNT_BY_EMAIL.get(email);
  const steps: Step[] = [
    ['fijar la preferencia de cookies', () => page.context().addInitScript(fixCookiePreference)],
    ['instalar el registro de avisos', () => page.context().addInitScript(recordToasts, TOAST_KEY)],
    ['fijar el ancho de la ventana', () => page.setViewportSize(viewportOf(layout))],
    ['abrir /login?tenant=alumno01', () => page.goto(LOGIN_URL, { timeout: CEILING_MS })],
    ['escribir el correo', () => page.getByLabel('Correo electrónico', { exact: true }).fill(credentials?.email ?? email, ACTION)],
    ['escribir la contraseña', () => page.getByLabel('Contraseña', { exact: true }).fill(credentials?.password ?? '', ACTION)],
    ['pulsar «Entrar»', () => page.getByRole('button', { name: 'Entrar', exact: true }).click(ACTION)],
    ['llegar a /programs', () => page.waitForURL(/\/programs/, { timeout: CEILING_MS })],
  ];
  return runSteps(steps);
};

/** Abre una ruta con la sesión ya iniciada en la misma página, y espera a que el tablero (o su aviso de error) esté asentado. */
export const openPath = (page: Page, path: string, layout: Layout): Promise<string | undefined> =>
  runSteps([
    [`abrir ${path}`, () => page.goto(path, { timeout: CEILING_MS })],
    ['ver el tablero asentado', async () => {
      const reached = (await waitUntil(async () => settled(await readBoard(page, layout)))).reached;
      if (!reached) throw new Error('el tablero no se asienta');
    }],
  ]);

// --- Acciones con diagnóstico ----------------------------------------------------------------------------------------------------

export interface Blocked {
  readonly message: string;
  readonly note: string;
  readonly evidence?: Readonly<Record<string, unknown>>;
}

/** Quién recibe el clic en el centro de un elemento, y si ese elemento es el propio objetivo o uno de sus descendientes. */
interface Hit {
  readonly hit: string;
  readonly inside: boolean;
}

const hitAtCenter = (node: Element): Hit => {
  const box = node.getBoundingClientRect();
  const hit = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
  if (hit === null) return { hit: '(ninguno)', inside: false };
  const testid = hit.getAttribute('data-testid');
  const name = `${hit.tagName.toLowerCase()}${testid === null ? '' : `[data-testid="${testid}"]`}`;
  return { hit: name, inside: hit === node || node.contains(hit) };
};

const describeFailure = async (target: Locator, label: string, error: unknown): Promise<Blocked> => {
  const lines = (error instanceof Error ? error.message : String(error)).split('\n').map((line) => line.trim()).filter((line) => line !== '');
  const intercept = lines.find((line) => line.includes('intercepts pointer events'));
  const present = (await safe(() => target.count(), 0)) > 0;
  const message = `no se pudo ${label}: ${lines.slice(0, 3).join(' · ')}${intercept === undefined ? '' : ` · ${intercept}`}`;
  if (!present) return { message, note: 'La historia nombra un elemento que la pantalla no ofrece (no existe con ese nombre).' };
  const probe = await safe<Hit | undefined>(() => target.first().evaluate(hitAtCenter, undefined, { timeout: READ_MS }), undefined);
  if (probe === undefined) return { message: `${message} · recibe el clic: (no se pudo leer)`, note: 'el elemento existe pero no se pudo comprobar qué lo tapa' };
  const note = probe.inside
    ? 'el elemento existe y recibe el clic en su centro, pero la acción no se completó (ver el mensaje de Playwright)'
    : `el elemento existe pero otro lo tapa: ${probe.hit}`;
  return { message: `${message} · recibe el clic: ${probe.hit}`, note, evidence: { recibeElClic: probe.hit, dentroDelElemento: probe.inside } };
};

/** Ejecuta una acción sobre un elemento; si falla, devuelve el diagnóstico (no lanza). */
export const interact = async (target: Locator, label: string, run: (element: Locator) => Promise<unknown>): Promise<Blocked | undefined> => {
  try {
    await run(target);
    return undefined;
  } catch (error) {
    return describeFailure(target, label, error);
  }
};

export const actionFailed = (expected: string, blocked: Blocked): Outcome =>
  outcome(false, expected, blocked.message, { note: blocked.note, ...(blocked.evidence === undefined ? {} : { evidence: blocked.evidence }) });

/** Una acción de la fila sobre la pantalla: devuelve su diagnóstico si falla, o `undefined` si sale bien. */
export type WebAction = (page: Page) => Promise<Blocked | undefined>;

export const clickIn = (locate: (page: Page) => Locator, label: string): WebAction => (page) => interact(locate(page), label, (element) => element.click(ACTION));

export const fillIn = (locate: (page: Page) => Locator, label: string, text: string): WebAction => (page) => interact(locate(page), label, (element) => element.fill(text, ACTION));

export const chooseIn = (locate: (page: Page) => Locator, label: string, option: { readonly value: string } | { readonly label: string }): WebAction => (page) =>
  interact(locate(page), label, async (element) => {
    // La opción puede llegar tarde (el desplegable se llena con la lista de programas): se espera a que exista
    const value = 'value' in option ? option.value : undefined;
    if (value !== undefined) await element.locator(`option[value="${value}"]`).waitFor({ state: 'attached', timeout: CEILING_MS });
    await element.selectOption(option, ACTION);
  });

export const checkIn = (locate: (page: Page) => Locator, label: string): WebAction => (page) => interact(locate(page), label, (element) => element.check(ACTION));

/** Ejecuta las acciones en orden; a la primera que falla devuelve su diagnóstico. */
export const inOrder =
  (...actions: readonly WebAction[]): WebAction =>
  async (page) => {
    for (const action of actions) {
      const blocked = await action(page);
      if (blocked !== undefined) return blocked;
    }
    return undefined;
  };

// --- Localizadores ---------------------------------------------------------------------------------------------------------------

export const searchBox = (page: Page): Locator => page.getByRole('searchbox', { name: 'Buscar no conformidades', exact: true });
export const programSelect = (page: Page): Locator => page.getByRole('combobox', { name: 'Programa', exact: true });
export const severitySelect = (page: Page): Locator => page.getByRole('combobox', { name: 'Severidad', exact: true });
export const unassignedBox = (page: Page): Locator => page.getByRole('checkbox', { name: 'Solo sin asignar', exact: true });
/** «Limpiar filtros» de la barra de filtros (con el tablero vacío hay un segundo botón del mismo nombre en el aviso). */
export const filtersClearButton = (page: Page): Locator => page.getByTestId(NC_TESTIDS.NC_FILTERS_CLEAR);
export const emptyClearButton = (page: Page): Locator => page.getByTestId(NC_TESTIDS.NC_EMPTY_CLEAR);
export const cardOf = (page: Page, code: string): Locator => page.getByTestId(NC_DYNAMIC_TESTIDS.NC_CARD(code));
export const cardMenuButton = (page: Page, code: string): Locator => page.getByTestId(NC_DYNAMIC_TESTIDS.NC_CARD_MENU(code));
export const detailDialog = (page: Page, code: string): Locator => page.getByRole('dialog', { name: `Detalle de ${code}`, exact: true });

// --- Lectura atómica del tablero -------------------------------------------------------------------------------------------------

export interface ColumnView {
  readonly state: string;
  /** La columna (o el panel de la pestaña elegida) está en la pantalla. */
  readonly present: boolean;
  /** Título visible (el texto suelto del encabezado o de la pestaña, sin el contador). */
  readonly title: string;
  readonly count: string;
  readonly cards: readonly string[];
  readonly empty: string | undefined;
}

export interface BoardView {
  readonly hasBoard: boolean;
  readonly busy: string | undefined;
  readonly total: string | undefined;
  readonly columns: readonly ColumnView[];
  /** Estados de las columnas en el ORDEN DEL DOM (izquierda a derecha), tal como están pintadas. */
  readonly domOrder: readonly string[];
  readonly cardsTotal: number;
  readonly skeletons: number;
  readonly errorText: string | undefined;
  readonly at: number;
}

/** Se ejecuta en el navegador: todo el tablero en una sola lectura. `mobile` cambia el sufijo de los testids (-mobile). */
const boardReader = (mobile: boolean): BoardView => {
  const suffix = mobile ? '-mobile' : '';
  const states = ['open', 'in_analysis', 'corrective_action', 'closed', 'rejected'];
  const textNodes = (node: Element | null): string =>
    node === null
      ? ''
      : Array.from(node.childNodes)
          .filter((child) => child.nodeType === 3)
          .map((child) => child.textContent ?? '')
          .join('')
          .trim();
  const cardCodes = (root: Element | null): string[] =>
    root === null
      ? []
      : Array.from(root.querySelectorAll('li[data-testid^="nc-card-NC-"]')).map((item) => (item.getAttribute('data-testid') ?? '').replace(/^nc-card-/, '').replace(/-mobile$/, ''));
  const board = document.querySelector(`[data-testid="nc-board${suffix}"]`);
  const columns = states.map((state) => {
    const column = document.querySelector(`[data-testid="nc-column-${state}${suffix}"]`);
    const count = document.querySelector(`[data-testid="nc-column-count-${state}${suffix}"]`);
    const titleNode = mobile ? document.querySelector(`[data-testid="nc-tab-${state}${suffix}"]`) : column === null ? null : column.querySelector('h2');
    const empty = document.querySelector(`[data-testid="nc-column-empty-${state}${suffix}"]`);
    return {
      state,
      present: column !== null,
      title: textNodes(titleNode),
      count: count === null ? '' : (count.textContent ?? '').trim(),
      cards: cardCodes(column),
      empty: empty === null ? undefined : (empty.textContent ?? '').trim(),
    };
  });
  const countNode = document.querySelector('[data-testid="nc-count"]');
  const errorNode = document.querySelector('[data-testid="nc-error"]');
  return {
    domOrder: Array.from(document.querySelectorAll('section[data-testid]'))
      .map((node) => node.getAttribute('data-testid') ?? '')
      .filter((id) => /^nc-column-(open|in_analysis|corrective_action|closed|rejected)$/.test(id))
      .map((id) => id.replace('nc-column-', '')),
    hasBoard: board !== null,
    busy: board === null ? undefined : board.getAttribute('aria-busy') ?? undefined,
    total: countNode === null ? undefined : (countNode.textContent ?? '').trim(),
    columns,
    cardsTotal: document.querySelectorAll('li[data-testid^="nc-card-NC-"]').length,
    skeletons: document.querySelectorAll('[data-testid="skeleton-row"]').length,
    errorText: errorNode === null ? undefined : (errorNode.textContent ?? '').trim(),
    at: Date.now(),
  };
};

/** Techo de una lectura de la página (la evaluación no admite plazo propio). */
export const withLimit = <T>(read: Promise<T>, fallback: T): Promise<T> =>
  Promise.race([read.catch(() => fallback), sleep(READ_MS).then(() => fallback)]);

/** Lectura del tablero (undefined si la lectura no llega en el plazo). */
export const readBoard = (page: Page, layout: Layout): Promise<BoardView | undefined> =>
  withLimit<BoardView | undefined>(page.evaluate(boardReader, layout === 'responsive'), undefined);

/** Asentado: hay tablero no ocupado con recuento, o hay aviso de error. */
export const settled = (view: BoardView | undefined): boolean => view !== undefined && (view.errorText !== undefined || (view.hasBoard && view.busy === 'false' && view.total !== undefined && !view.total.includes('…')));

/** Códigos de todas las tarjetas que se ven (en orden de columna), como conjunto ordenado. */
export const cardsOnScreen = (view: BoardView): readonly string[] => view.columns.flatMap((column) => column.cards);

/** Columna por estado de la lectura. */
export const columnOf = (view: BoardView, state: string): ColumnView | undefined => view.columns.find((column) => column.state === state);

/** Dos listas iguales por conjunto (sin importar el orden), sin duplicados. */
export const sameSet = (left: readonly string[], right: readonly string[]): boolean => {
  const a = [...left].sort();
  const b = [...right].sort();
  return a.length === b.length && a.every((code, index) => code === b[index]);
};

/** Dos listas iguales en el mismo orden. */
export const sameOrder = (left: readonly string[], right: readonly string[]): boolean => left.length === right.length && left.every((code, index) => code === right[index]);

/** Texto visible de un elemento (o `undefined` si no se lee en el plazo), con espacios colapsados. */
export const textNow = async (target: Locator): Promise<string | undefined> => {
  const text = await textOf(target);
  return text === undefined ? undefined : text.replace(/\s+/g, ' ').trim();
};

/** Texto de un elemento por testid, leído con plazo corto. */
export const testidText = (page: Page, testid: string): Promise<string | undefined> => textNow(page.getByTestId(testid));

/**
 * Nombre que lee una persona de un elemento: su texto SIN los avatares (`role="img"` en la app móvil, `<img>` en la web), con los
 * espacios normalizados. Así un avatar con iniciales («AM») no se pega al nombre («AMAndrés Molina»).
 */
export const nameTextOf = (target: Locator): Promise<string | undefined> =>
  withLimit<string | undefined>(
    target.first().evaluate(
      (node) => {
        const copy = node.cloneNode(true) as Element;
        copy.querySelectorAll('[role="img"], img').forEach((avatar) => avatar.remove());
        return (copy.textContent ?? '').replace(/\s+/g, ' ').trim();
      },
      undefined,
      { timeout: READ_MS },
    ),
    undefined,
  );

// --- Interceptación de peticiones a la API ---------------------------------------------------------------------------------------

/** Comportamiento de la prueba ante una petición: fallar la primera, fallar todas, o retrasarla un tiempo. */
export type Behaviour = { readonly kind: 'failFirst'; readonly status: number } | { readonly kind: 'failAll'; readonly status: number } | { readonly kind: 'delay'; readonly ms: number };

export interface Interception {
  /** Cada petición que llegó a la ruta, en orden, con lo que se hizo con ella. */
  readonly hits: () => readonly string[];
  /** Instante (ms) en que la PETICIÓN llegó a la ruta: el retraso se mide desde aquí, no desde la navegación. */
  readonly receivedAt: () => number | undefined;
  /** Instante (ms) en que la prueba entregó la respuesta retrasada (`undefined` si no hubo retraso o aún no). */
  readonly deliveredAt: () => number | undefined;
}

/**
 * Ruta de la API por su ruta EXACTA (pathname) y método. Las respuestas que la prueba fabrica no llegan al servidor (se anota en
 * el registro); las respuestas retrasadas sí llegan, tras el retardo. Las cabeceras CORS siguen a la petición (origen de la web).
 */
export const intercept = async (page: Page, method: 'GET' | 'POST', pathname: string, behaviour: Behaviour): Promise<Interception> => {
  const log: string[] = [];
  let failures = 0;
  let delivered: number | undefined;
  let received: number | undefined;
  await page.route(
    (url) => url.pathname === pathname,
    async (route) => {
      const request = route.request();
      if (request.method() !== method) return route.continue();
      if (received === undefined) received = Date.now();
      const number = log.length + 1;
      if (behaviour.kind === 'delay') {
        await sleep(behaviour.ms);
        delivered = Date.now();
        log.push(`#${number} ${method} ${pathname}: retrasada ${behaviour.ms} ms y entregada al servidor`);
        return route.continue();
      }
      const shouldFail = behaviour.kind === 'failAll' || failures === 0;
      if (!shouldFail) {
        log.push(`#${number} ${method} ${pathname}: pasa al servidor (ya se respondió ${behaviour.status} antes)`);
        return route.continue();
      }
      failures += 1;
      log.push(`#${number} ${method} ${pathname}: respondida ${behaviour.status} por la prueba (no llega al servidor)`);
      const origin = request.headers().origin ?? '*';
      return route.fulfill({
        status: behaviour.status,
        contentType: 'application/json',
        headers: { 'access-control-allow-origin': origin, 'access-control-expose-headers': '*' },
        body: JSON.stringify({ statusCode: behaviour.status, error: 'Error', message: 'Error provocado por la prueba' }),
      });
    },
  );
  return { hits: () => [...log], deliveredAt: () => delivered, receivedAt: () => received };
};

// --- Arrastre (HTML5) con el puntero, como el piloto: el arrastre se registra por `dragstart` ------------------------------------

/** Registra en la página los inicios de arrastre reales del navegador (`dragstart` sobre una tarjeta). Se arma antes del gesto. */
export const armDragLog = (page: Page): Promise<void> =>
  page.evaluate(() => {
    const registry = window as unknown as Record<string, unknown>;
    registry.__ncDragStarts = [];
    document.addEventListener('dragstart', (event) => {
      const card = (event.target as Element | null)?.closest('li[data-testid^="nc-card-NC-"]');
      (registry.__ncDragStarts as string[]).push(card?.getAttribute('data-testid') ?? '(ninguno)');
    });
  });

export const dragStarts = (page: Page): Promise<readonly string[]> =>
  withLimit(page.evaluate(() => ((window as unknown as Record<string, unknown>).__ncDragStarts as string[] | undefined) ?? []), []);

export interface DragOutcome {
  /** El navegador arrancó el arrastre sobre la tarjeta de origen (`dragstart`). */
  readonly started: boolean;
  /** Marca de la columna de destino con el puntero encima (`data-drop`: valid, invalid o ausente). */
  readonly dropOnTarget: string;
  readonly pointerOnTarget: boolean;
  /** Atributo `draggable` de la tarjeta (`true` o `false`). */
  readonly draggable: string | undefined;
}

/**
 * Arrastra la tarjeta `code` sobre la columna `to` con el puntero: se pulsa sobre el párrafo de la descripción (no sobre un
 * botón), se mueve en 10 pasos y se suelta en el centro de la columna. Devuelve lo medido o el diagnóstico si el gesto falla.
 */
export const performDrag = async (page: Page, code: string, to: string): Promise<DragOutcome | Blocked> => {
  const card = cardOf(page, code);
  const handle = card.locator('p').first();
  const target = page.getByTestId(NC_DYNAMIC_TESTIDS.NC_COLUMN(to));
  try {
    await handle.scrollIntoViewIfNeeded({ timeout: READ_MS });
    await target.scrollIntoViewIfNeeded({ timeout: READ_MS });
    const origin = await handle.boundingBox({ timeout: READ_MS });
    const destination = await target.boundingBox({ timeout: READ_MS });
    if (origin === null || destination === null) return { message: `no se pudo medir la descripción de ${code} o la columna ${to}`, note: 'la tarjeta o la columna destino no tienen caja visible' };
    const start = [origin.x + origin.width / 2, origin.y + origin.height / 2] as const;
    const end = [destination.x + destination.width / 2, destination.y + destination.height / 2] as const;
    await page.mouse.move(start[0], start[1]);
    await page.mouse.down();
    await page.mouse.move(end[0], end[1], { steps: 10 });
    const dropOnTarget = (await target.getAttribute('data-drop', { timeout: READ_MS })) ?? '(ninguno)';
    const pointerOnTarget = await target.evaluate((node, point) => node.contains(document.elementFromPoint(point[0], point[1])), end, { timeout: READ_MS });
    await page.mouse.up();
    const started = (await dragStarts(page)).includes(`nc-card-${code}`);
    const draggable = (await attrOf(card, 'draggable')) ?? undefined;
    return { started, dropOnTarget, pointerOnTarget, draggable };
  } catch (error) {
    await page.mouse.up().catch(() => undefined);
    return { message: `no se pudo arrastrar ${code} a ${to}: ${String(error).split('\n')[0] ?? 'error'}`, note: 'el gesto del puntero falló en el arnés' };
  }
};

export const isDragOutcome = (value: DragOutcome | Blocked): value is DragOutcome => 'started' in value;

// --- Menú de la tarjeta y botones del detalle ------------------------------------------------------------------------------------

export interface MenuEntry {
  readonly text: string;
  readonly disabled: boolean;
  readonly title: string | undefined;
}

/** Abre el menú ⋯ de la tarjeta y lee sus opciones en orden (texto, deshabilitada y motivo en `title`). */
export const readCardMenu = async (page: Page, code: string): Promise<{ readonly entries: readonly MenuEntry[] | undefined; readonly blocked?: Blocked }> => {
  const opened = await interact(cardMenuButton(page, code), `abrir el menú de acciones de ${code}`, (element) => element.click(ACTION));
  if (opened !== undefined) return { entries: undefined, blocked: opened };
  const menu = page.getByTestId(NC_TESTIDS.NC_MENU);
  const read = await waitUntil(async () => (await safe(() => menu.getByRole('menuitem').count(), 0)) > 0);
  if (!read.reached) return { entries: undefined };
  const entries = await withLimit<readonly MenuEntry[] | undefined>(
    menu.getByRole('menuitem').evaluateAll((items) =>
      items.map((item) => ({
        text: (item.textContent ?? '').replace(/\s+/g, ' ').trim(),
        disabled: (item as HTMLButtonElement).disabled === true || item.getAttribute('aria-disabled') === 'true',
        title: item.getAttribute('title') ?? undefined,
      })),
    ),
    undefined,
  );
  return { entries };
};

export interface TransitionButton {
  readonly state: string;
  readonly text: string;
  readonly disabled: boolean;
  readonly title: string | undefined;
}

/** Botones «Pasar a …» del detalle: en orden, con su estado y su motivo (`title`). Una lectura que no llega devuelve `undefined`. */
export const readDetailTransitions = (page: Page): Promise<{ readonly buttons: readonly TransitionButton[]; readonly sectionText: string } | undefined> =>
  withLimit(
    page.evaluate(() => {
      const section = document.querySelector('[data-testid="nc-transitions"]');
      const buttons = Array.from(document.querySelectorAll('[data-testid^="nc-transition-"]')).map((button) => {
        const testid = button.getAttribute('data-testid') ?? '';
        return {
          state: testid.replace(/^nc-transition-/, ''),
          text: (button.textContent ?? '').replace(/\s+/g, ' ').trim(),
          disabled: (button as HTMLButtonElement).disabled === true,
          title: button.getAttribute('title') ?? undefined,
        };
      });
      return { buttons, sectionText: (section?.textContent ?? '').replace(/\s+/g, ' ').trim() };
    }),
    undefined,
  );

// --- Comprobaciones ----------------------------------------------------------------------------------------------------------------

/** Una frase de texto visible igual a la esperada (`observed` ya leído). */
export const textCheck = (observed: string | undefined, expected: string, what: string): Check =>
  check(observed === expected, `${what} «${expected}»`, `${what} «${observed ?? '(sin texto)'}»`);

/** Un control habilitado o deshabilitado; si se pide deshabilitado, con su motivo en `title`. */
export const controlCheck = (entry: { readonly disabled: boolean; readonly title: string | undefined } | undefined, expected: 'habilitado' | 'deshabilitado', reason: string | undefined, what: string): Check => {
  if (entry === undefined) return check(false, `${what} ${expected}${reason ? `, con el motivo «${reason}»` : ''}`, `${what} (sin leer)`);
  const observed = entry.disabled ? `deshabilitado${entry.title ? `, con el motivo «${entry.title}»` : ''}` : 'habilitado';
  const ok = expected === 'habilitado' ? !entry.disabled : entry.disabled && entry.title === reason;
  return check(ok, `${what} ${expected}${reason ? `, con el motivo «${reason}»` : ''}`, `${what} ${observed}`);
};

/** Celda de un texto de la historia entre «…»: el texto sin las comillas; otra forma LANZA. */
export const quotedText = (text: string): string => {
  const match = /^«(.+)»$/.exec(text.trim());
  if (!match?.[1]) throw new Error(`celda sin interpretación: texto de la interfaz «${text}» sin comillas «…»`);
  return match[1];
};

/** Un lapso breve para estabilizar una reacción local de la pantalla (no es un plazo del producto). */
export const settleLocal = (): Promise<void> => sleep(1_000);

/**
 * Estado de una no conformidad TAL COMO LO GUARDA LA API: lectura con el administrador de alumno01, después de la acción de
 * interfaz y de su aviso (nunca antes). `undefined` si la lectura no da estado.
 */
export const persistedState = async (code: string): Promise<string | undefined> => {
  const admin = await actorOf(TENANT_A, adminCredentials(TENANT_A));
  if (admin.token === undefined) return undefined;
  return stateOfBody(await detailNc(TENANT_A, admin.token, code));
};


/** Gotos del tablero sin esperar a que se asiente (las lecturas «mientras carga» necesitan la ventana de la espera). */
export const gotoBoard = (page: Page, path: string): Promise<string | undefined> =>
  runSteps([
    [`abrir ${path}`, () => page.goto(path, { waitUntil: 'commit', timeout: CEILING_MS })],
    ['ver el tablero montado', async () => {
      // El grupo del tablero tiene el mismo nombre accesible en los dos diseños (escritorio y responsive)
      const mounted = await waitUntil(async () => (await safe(() => page.getByRole('group', { name: 'Tablero de no conformidades', exact: true }).count(), 0)) > 0);
      if (!mounted.reached) throw new Error('el tablero no aparece');
    }],
  ]);

/**
 * Preparación común de una fila web: reinicio de alumno01 con el token de su administrador (desde Node), inicio de sesión de la
 * cuenta en el navegador y apertura de /nc. `beforeOpen` arma las rutas de la fila DESPUÉS del inicio de sesión y ANTES de abrir /nc.
 */
export const prepareWeb = async (page: Page, layout: Layout, email: string, expected: string, beforeOpen?: () => Promise<unknown>): Promise<Outcome | undefined> => {
  await resetTenants([TENANT_A]);
  const signedIn = await signIn(page, layout, email);
  if (signedIn !== undefined) return preparationFailedWeb(expected, `iniciar sesión como ${email}: ${signedIn}`);
  if (beforeOpen !== undefined) await beforeOpen();
  const opened = await openPath(page, BOARD_PATH, layout);
  if (opened !== undefined) return preparationFailedWeb(expected, `abrir ${BOARD_PATH}: ${opened}`);
  return undefined;
};

/** Resultado de una fila web: coincide si todas las comprobaciones se cumplen; si no, la nota dice en qué difiere. */
export const verdictWeb = (checks: readonly Check[], extraNote?: string): Outcome => {
  const failing = checks.filter((entry) => !entry.ok);
  const difference = failing.length === 0 ? undefined : `difiere de la historia en: ${failing.map((entry) => `${entry.expected} (observado: ${entry.observed})`).join('; ')}`;
  const note = [extraNote, difference].filter((text): text is string => text !== undefined && text !== '').join(' ');
  return conclude(checks, note === '' ? {} : { note });
};

/** Valor de un control de texto o de selección (`undefined` si no se lee en el plazo). */
export const controlValue = (page: Page, locate: (page: Page) => Locator): Promise<string | undefined> => safe(() => locate(page).inputValue({ timeout: READ_MS }), undefined);

/** Estado marcado de una casilla (`undefined` si no se lee en el plazo). */
export const checkedOf = (locate: (page: Page) => Locator): ((page: Page) => Promise<boolean | undefined>) => (page) => safe(() => locate(page).isChecked({ timeout: READ_MS }), undefined);

/** Espera (con techo) a que una lectura del tablero cumpla `ok`; devuelve la última lectura. */
export const waitBoard = async (page: Page, layout: Layout, ok: (view: BoardView) => boolean, ceilingMs: number = CEILING_MS): Promise<BoardView | undefined> => {
  let last: BoardView | undefined;
  await waitUntil(async () => {
    last = await readBoard(page, layout);
    return last !== undefined && ok(last);
  }, ceilingMs);
  return last;
};
