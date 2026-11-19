import type { Download, Locator, Page, Route } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { DEMO, TENANT_A } from '../../../story-runs/support/prepare';
import { PROGRAMAS_TESTIDS, VERIFICACION_TESTIDS } from '../../../../packages/shared/src/testids';
import { ACTION, CEILING_MS, runSteps, safe, textOf, waitUntil, type Step } from '../../support/browser';
import { check, sleep, type Check } from '../../support/checks';
import { outcome, type BrowserRowHandler, type Outcome } from '../../core/framework';
import { isPdf, pdfLines } from '../api/pdf';

// Piezas comunes de las filas web de EP-VER-INFORME (escritorio 1440 px; el ancho de la historia 004 E6 lo fija la fila). Los
// localizadores son de rol y de nombre; los ids de prueba solo donde la pantalla no ofrece otro rastro (recuento, barra, detalle).
// Toda acción sobre un elemento de la historia pasa por `interact`: si falla, la nota dice si el elemento no existe, si lo tapa
// otro, o si recibe el clic pero no ocurre la acción.

// --- Tolerancias de la prueba (no son plazos del producto: la historia no los fija) -----------------------------------------------

/** Espera por algo que llega por red o cambia de pantalla (la README fija 5 s como referencia). */
export const WAIT_MS = 5_000;
/** Ventana en la que se observa que NO pasa nada (descarga, entrega). Mayor que la vida del aviso (3 s). */
export const QUIET_MS = 4_000;
/** Plazo de una lectura del DOM: las lecturas nunca cuelgan la fila. */
export const READ_MS = 2_000;

// --- Preferencia de cookies (no es una sesión) y nota de cada fila web ----------------------------------------------------------

export const COOKIE_NOTE = 'La prueba fija la preferencia de cookies (sigpro.cookies = accepted) antes de abrir la app, como el piloto; el aviso de cookies no se ejerce aquí.';

/** Envuelve una fila web para añadir la nota de cookies a su resultado. */
export const onWeb =
  (handler: BrowserRowHandler): BrowserRowHandler =>
  async (row, fixtures) => {
    const result = await handler(row, fixtures);
    return { ...result, note: result.note === undefined ? COOKIE_NOTE : `${result.note} ${COOKIE_NOTE}` };
  };

/** Fija SOLO la preferencia de cookies: el aviso tapa zonas de la página y no es una sesión. */
const fixCookiePreference = (): void => {
  try {
    localStorage.setItem('sigpro.cookies', 'accepted');
  } catch {
    // sin almacenamiento: no hay preferencia que fijar
  }
};

// --- Registro de avisos (desde antes de la acción) --------------------------------------------------------------------------------

/** Clave del registro de avisos en la ventana del navegador. */
export const TOAST_KEY = '__sigproToasts';

/** Un aviso registrado: tono, título (primera línea), cuerpo (segunda) y marca de tiempo del navegador. */
export interface ToastEntry {
  readonly tone: string;
  readonly title: string;
  readonly body: string;
  readonly at: number;
}

/** Se ejecuta en el navegador antes de cargar la app: registra cada aparición de un aviso, sin la cruz de cierre. No usa variables de fuera. */
export const recordToasts = (key: string): void => {
  const registry = window as unknown as Record<string, unknown>;
  if (Array.isArray(registry[key])) return;
  const log: { tone: string; title: string; body: string; at: number }[] = [];
  registry[key] = log;
  const toneOf = (element: Element): string | undefined => /^toast-(ok|danger|info|warn)$/.exec(element.getAttribute('data-testid') ?? '')?.[1];
  const record = (element: Element, tone: string): void => {
    const lines = (element as HTMLElement).innerText
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line !== '' && line !== '×');
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

/** Vacía el registro justo antes de la acción que se prueba (y la marca). */
export const armToasts = (page: Page): Promise<void> =>
  safe(
    () =>
      page.evaluate((key: string) => {
        const registry = window as unknown as Record<string, unknown>;
        const log = registry[key];
        if (Array.isArray(log)) log.length = 0;
        registry.__sigproArmedAt = Date.now();
      }, TOAST_KEY),
    undefined,
  );

/** Registro de avisos de la página desde la última «armada». */
export const toastLog = (page: Page): Promise<readonly ToastEntry[]> =>
  safe(() => page.evaluate((key: string) => ((window as unknown as Record<string, unknown>)[key] as ToastEntry[] | undefined) ?? [], TOAST_KEY), []);

/** Texto del registro, en una frase: `tono «título» / «cuerpo»`, o «(ninguno)». */
export const describeToasts = (log: readonly ToastEntry[]): string =>
  log.length === 0 ? '(ninguno)' : log.map((entry) => `${entry.tone} «${entry.title}»${entry.body === '' ? '' : ` / «${entry.body}»`}`).join(' | ');

/**
 * Espera (con techo de red) a que aparezca un aviso con ese título; devuelve el primero y lo que hay en el registro. La historia
 * no fija el tono del aviso: se busca por título y el tono queda en lo observado.
 */
export const toastShown = async (page: Page, title: string): Promise<{ readonly entry?: ToastEntry; readonly observed: string }> => {
  const matches = (entry: ToastEntry): boolean => entry.title === title;
  await waitUntil(async () => (await toastLog(page)).some(matches), WAIT_MS);
  const log = await toastLog(page);
  return { entry: log.find(matches), observed: describeToasts(log) };
};

// --- Descargas ---------------------------------------------------------------------------------------------------------------------

export interface Downloaded {
  readonly name: string;
  readonly bytes: Buffer;
}

/** Una lectura con plazo: si no llega a tiempo, lanza (la lectura queda sin leer, nunca cuelga la fila). */
const withDeadline = <T>(read: Promise<T>, ms: number): Promise<T> => Promise.race([read, sleep(ms).then(() => Promise.reject(new Error(`plazo de ${ms} ms`)))]);

/** Vigila las descargas de la página desde ahora: el contador y el primer archivo (nombre sugerido por el servidor y bytes). */
export const watchDownloads = (page: Page): { readonly count: () => number; readonly first: () => Promise<Downloaded | undefined> } => {
  const list: Download[] = [];
  page.on('download', (download) => list.push(download));
  return {
    count: () => list.length,
    first: async () => {
      const download = list[0];
      if (download === undefined) return undefined;
      const path = await safe<string | null>(() => withDeadline(download.path(), WAIT_MS), null);
      if (path === null) return undefined;
      return { name: download.suggestedFilename(), bytes: await readFile(path) };
    },
  };
};

/** Espera (con techo de red) a la primera descarga y la devuelve. */
export const firstDownload = async (watch: ReturnType<typeof watchDownloads>): Promise<Downloaded | undefined> => {
  await waitUntil(async () => watch.count() > 0, WAIT_MS);
  return watch.first();
};

// --- Fallos provocados por la prueba (solo la petición del informe) ------------------------------------------------------------

export type ReportFailure = 'status500' | 'noResponse';

const CORS_HEADERS = 'authorization,content-type,x-tenant';

/** Respuesta de la prueba con cabeceras CORS (la web llama a la API desde otro origen). */
const fulfillWith = (route: Route, status: number, body: unknown): Promise<void> => {
  const origin = route.request().headers().origin ?? '*';
  return route.fulfill({
    status,
    contentType: 'application/json',
    headers: { 'access-control-allow-origin': origin, 'access-control-allow-methods': 'GET,OPTIONS', 'access-control-allow-headers': CORS_HEADERS, 'access-control-expose-headers': '*' },
    body: body === undefined ? '' : JSON.stringify(body),
  });
};

/**
 * La siguiente petición GET del informe (y solo esa) responde 500 o no obtiene respuesta. Las demás pasan a la red. Lo arma la fila
 * después de cargar la lista y antes de pulsar el botón.
 */
export const failNextReport = (page: Page, mode: ReportFailure): Promise<unknown> => {
  let served = false;
  return page.route(
    (url) => url.pathname === '/api/verification/report',
    async (route) => {
      const request = route.request();
      if (request.method() === 'OPTIONS') return fulfillWith(route, 204, undefined);
      if (request.method() !== 'GET' || served) return route.continue();
      served = true;
      if (mode === 'noResponse') return route.abort();
      return fulfillWith(route, 500, { statusCode: 500, error: 'Internal Server Error', message: 'internal_error' });
    },
  );
};

// --- Sesión y navegación -------------------------------------------------------------------------------------------------------------

export const LOGIN_URL = `/login?tenant=${TENANT_A}`;
export const VERIFICATION_PATH = '/verification';

/** Cuenta de la historia (gestor@sigpro.test): sin segundo factor. */
const GESTOR = DEMO.gestor;

/** Fila de la lista lista: el contador de la lista muestra «a–b de n» (no «…»). */
const COUNT_PATTERN = /^\d+–\d+ de \d+$/;

/** Preparación de cada fila: fija la preferencia de cookies, el ancho, abre /login?tenant=alumno01 y entra como gestor@sigpro.test. */
export const signIn = (page: Page, width: number): Promise<string | undefined> => {
  const steps: Step[] = [
    ['fijar la preferencia de cookies', () => page.context().addInitScript(fixCookiePreference)],
    ['instalar el registro de avisos', () => page.context().addInitScript(recordToasts, TOAST_KEY)],
    ['fijar el ancho de la ventana', () => page.setViewportSize({ width, height: 900 })],
    ['abrir /login?tenant=alumno01', () => page.goto(LOGIN_URL, { timeout: CEILING_MS })],
    ['escribir el correo', () => page.getByLabel('Correo electrónico', { exact: true }).fill(GESTOR.email, ACTION)],
    ['escribir la contraseña', () => page.getByLabel('Contraseña', { exact: true }).fill(GESTOR.password, ACTION)],
    ['pulsar «Entrar»', () => page.getByRole('button', { name: 'Entrar', exact: true }).click(ACTION)],
    ['llegar a /programs', () => page.waitForURL(/\/programs/, { timeout: CEILING_MS })],
    ['ver la lista de programas', () => waitProgramsShown(page)],
  ];
  return runSteps(steps);
};

/** La pantalla de Programas ya tiene su lista (el recuento deja de ser «…»): con ella se llega sin depender del ancho. */
const waitProgramsShown = async (page: Page): Promise<void> => {
  const shown = await waitUntil(async () => /^\d+–\d+ de \d+$/.test((await textOf(page.getByTestId(PROGRAMAS_TESTIDS.PROGRAMS_COUNT))) ?? ''), WAIT_MS);
  if (!shown.reached) throw new Error('la lista de programas no aparece');
};

/** ¿Está la lista de casos asentada (el contador ya no muestra «…»)? */
export const waitListSettled = async (page: Page): Promise<boolean> => (await waitUntil(async () => COUNT_PATTERN.test((await countText(page)) ?? ''), WAIT_MS)).reached;

/** Abre una ruta de la web con la sesión ya iniciada y espera a su estado de lista o de detalle. */
export const openPath = (page: Page, path: string, ready: 'list' | 'detail'): Promise<string | undefined> =>
  runSteps([
    [`abrir ${path}`, () => page.goto(path, { timeout: CEILING_MS })],
    [ready === 'list' ? 'ver la lista de casos' : 'ver el detalle del caso', async () => {
      const shown = ready === 'list' ? await waitListSettled(page) : (await waitUntil(async () => (await safe(() => detailOf(page).isVisible(), false)) === true, WAIT_MS)).reached;
      if (!shown) throw new Error(ready === 'list' ? 'la lista de casos no aparece' : 'el detalle del caso no aparece');
    }],
  ]);

// --- Localizadores -----------------------------------------------------------------------------------------------------------------

/** Filas de casos de la lista (tabla en escritorio, tarjetas por debajo de 1024 px): sin los botones de menú, que también empiezan por el prefijo. */
const ROW_SELECTOR = '[data-testid^="testcase-row-"]:not([data-testid^="testcase-row-menu-"])';

export const verificationRoot = (page: Page): Locator => page.getByTestId(VERIFICACION_TESTIDS.VERIFICATION_PAGE);
/** Rol primero (nombre exacto); el id de prueba solo como respaldo del mismo botón. */
export const reportButton = (page: Page): Locator =>
  verificationRoot(page).getByRole('button', { name: 'Descargar informe PDF', exact: true }).or(verificationRoot(page).getByTestId(VERIFICACION_TESTIDS.VERIFICATION_REPORT));
export const searchBox = (page: Page): Locator => page.getByRole('searchbox', { name: 'Buscar casos de prueba', exact: true });
export const programSelect = (page: Page): Locator => page.getByRole('combobox', { name: 'Programa', exact: true });
export const resultSelect = (page: Page): Locator => page.getByRole('combobox', { name: 'Último resultado', exact: true });
export const countLabel = (page: Page): Locator => page.getByTestId(VERIFICACION_TESTIDS.VERIFICATION_COUNT);
export const rowsOf = (page: Page): Locator => verificationRoot(page).locator(ROW_SELECTOR);
export const checkboxOf = (page: Page, code: string): Locator => verificationRoot(page).getByRole('checkbox', { name: `Seleccionar ${code}`, exact: true });
export const selectAllCheckbox = (page: Page): Locator => verificationRoot(page).getByRole('checkbox', { name: 'Seleccionar todos los casos de la página', exact: true });
export const rowMenuButton = (page: Page, code: string): Locator => verificationRoot(page).getByRole('button', { name: `Acciones para ${code}`, exact: true });
export const rowMenu = (page: Page): Locator => page.getByTestId(VERIFICACION_TESTIDS.TESTCASE_MENU);
export const menuItem = (page: Page, name: string): Locator => rowMenu(page).getByRole('menuitem', { name, exact: true });
export const bulkBar = (page: Page): Locator => verificationRoot(page).getByRole('region', { name: 'Acciones masivas', exact: true });
export const bulkReportButton = (page: Page): Locator => bulkBar(page).getByRole('button', { name: 'Informe de la selección', exact: true }).or(bulkBar(page).getByTestId(VERIFICACION_TESTIDS.VERIFICATION_BULK_REPORT));
export const detailOf = (page: Page): Locator => page.getByTestId(VERIFICACION_TESTIDS.TESTCASE_DETAIL);
export const detailReportButton = (page: Page): Locator =>
  detailOf(page).getByRole('button', { name: 'Descargar informe PDF', exact: true }).or(detailOf(page).getByTestId(VERIFICACION_TESTIDS.TESTCASE_REPORT));

/** Texto visible del contador («1–10 de 25»), o `undefined` si no se lee. */
export const countText = (page: Page): Promise<string | undefined> => textOf(countLabel(page));

/** Contador de la primera página de un total de casos: «1–9 de 9», «1–10 de 25» (guion largo, página de 10). */
export const pageCount = (total: number): string => `1–${Math.min(10, total)} de ${total}`;

/** Espera (con techo de red) a que el contador muestre el total dado: tras cambiar el programa, la lista ya es la nueva. */
export const waitCountFor = (read: () => Promise<string | undefined>, total: number): Promise<boolean> =>
  waitUntil(async () => (await read()) === pageCount(total), WAIT_MS).then((result) => result.reached);

/** Número de casos que la lista muestra ahora (filas de la tabla o de las tarjetas), o -1 si no se puede leer. */
export const shownRows = (page: Page): Promise<number> => safe(() => rowsOf(page).count(), -1);

/** Estado de un botón en UNA sola lectura: deshabilitado (propiedad o `aria-disabled`), `title` y texto visible. */
export interface ButtonState {
  readonly disabled: boolean;
  readonly title: string | undefined;
  readonly text: string;
}

export const buttonState = (target: Locator): Promise<ButtonState | undefined> =>
  safe(
    () =>
      target.first().evaluate(
        (element) => {
          const control = element as HTMLButtonElement;
          return {
            disabled: control.disabled === true || control.getAttribute('aria-disabled') === 'true',
            title: control.getAttribute('title') ?? undefined,
            text: (control as HTMLElement).innerText.trim(),
          };
        },
        undefined,
        { timeout: READ_MS },
      ),
    undefined,
  );

// --- Acciones con diagnóstico ------------------------------------------------------------------------------------------------------

export interface Blocked {
  readonly message: string;
  readonly note: string;
  /** Datos crudos del fallo (quién recibe el clic, si está dentro del elemento). */
  readonly evidence?: Readonly<Record<string, unknown>>;
}

/** Una acción de la historia: `undefined` si sale bien, o el diagnóstico del primer paso que falla. */
export type WebAction = (page: Page) => Promise<Blocked | undefined>;

interface Hit {
  readonly hit: string;
  readonly inside: boolean;
}

/** Se ejecuta en el navegador: qué recibe el clic en el centro del elemento. No usa variables de fuera. */
const hitAtCenter = (node: Element): Hit => {
  const box = node.getBoundingClientRect();
  const hit = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
  if (hit === null) return { hit: '(ninguno)', inside: false };
  const testid = hit.getAttribute('data-testid');
  const name = `${hit.tagName.toLowerCase()}${testid === null ? '' : `[data-testid="${testid}"]`}`;
  return { hit: name, inside: hit === node || node.contains(hit) };
};

/** Lo que se registra de un clic fallido: primeras líneas del error, la línea «intercepts pointer events» y quién recibe el clic. */
const describeFailure = async (target: Locator, label: string, error: unknown): Promise<Blocked> => {
  const lines = (error instanceof Error ? error.message : String(error))
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line !== '');
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

/** Una acción fallida con su diagnóstico, como resultado de la fila (la historia pide algo que la pantalla no permite). */
export const actionFailed = (expected: string, blocked: Blocked): Outcome =>
  outcome(false, expected, blocked.message, { note: blocked.note, ...(blocked.evidence === undefined ? {} : { evidence: blocked.evidence }) });

/** Pulsar un elemento localizado en la página. */
export const clickIn = (locate: (page: Page) => Locator, label: string): WebAction => (page) => interact(locate(page), label, (element) => element.click(ACTION));

/** Marcar una casilla (la historia dice «marca»; las casillas empiezan sin marcar). */
export const checkIn = (locate: (page: Page) => Locator, label: string): WebAction => (page) => interact(locate(page), label, (element) => element.click(ACTION));

/** Escribir un texto en un campo (la historia dice qué se escribe en cada campo). */
export const fillIn = (locate: (page: Page) => Locator, label: string, text: string): WebAction => (page) => interact(locate(page), `escribir «${text}» en «${label}»`, (element) => element.fill(text, ACTION));

/** Pulsa un botón cuando ya está habilitado (la carga de la lista lo deshabilita un momento); si no se habilita, el clic falla con diagnóstico. */
export const pressWhenEnabled = async (locate: (page: Page) => Locator, label: string, page: Page): Promise<Blocked | undefined> => {
  await waitUntil(async () => {
    const state = await buttonState(locate(page));
    return state !== undefined && !state.disabled;
  }, WAIT_MS);
  return clickIn(locate, label)(page);
};

/** Elegir una opción de un desplegable por su texto visible. */
export const chooseIn = (locate: (page: Page) => Locator, label: string, option: string): WebAction => (page) =>
  interact(locate(page), `elegir «${option}» en «${label}»`, (element) => element.selectOption({ label: option }, ACTION));

/** Ejecuta las acciones en orden y se detiene en la primera que falla. */
export const inOrder =
  (...actions: readonly WebAction[]): WebAction =>
  async (page) => {
    for (const action of actions) {
      const blocked = await action(page);
      if (blocked !== undefined) return blocked;
    }
    return undefined;
  };

// --- Comprobaciones ----------------------------------------------------------------------------------------------------------------

/** Un PDF leído de la descarga: sus líneas de texto, o `undefined` si no es un PDF. */
export const linesOfPdf = (bytes: Buffer | undefined): readonly string[] | undefined => (bytes !== undefined && isPdf(bytes) ? pdfLines(bytes) : undefined);

/** Línea exacta del PDF; lo observado es la línea medida con ese prefijo (o que no aparece ninguna). */
export const pdfLineCheck = (lines: readonly string[] | undefined, expected: string, prefix: string): Check => {
  if (lines === undefined) return check(false, `el PDF dice «${expected}»`, 'no hay PDF que leer');
  const found = lines.includes(expected);
  const measured = lines.find((line) => line.startsWith(prefix));
  return check(found, `el PDF dice «${expected}»`, found ? `el PDF dice «${expected}»` : `el PDF dice «${measured ?? '(ninguna línea de ese tipo)'}»`);
};

/** Un aviso con ese título y el cuerpo exacto (el tono no lo fija la historia; lo observado lo muestra). */
export const toastCheck = (reading: { readonly entry?: ToastEntry; readonly observed: string }, title: string, body: string): Check =>
  check(reading.entry !== undefined && reading.entry.body === body, `aviso «${title}» con «${body}»`, reading.observed);

/** Códigos de caso de un texto (`TC-001`, `TC-010`…), en orden de aparición y sin repetir. */
export const codesIn = (text: string): readonly string[] => [...new Set(text.match(/TC-\d{3}/g) ?? [])];

/** Códigos de caso de las fichas del PDF (la línea de cada ficha empieza por su código y « · »). */
export const codesOfPdf = (lines: readonly string[] | undefined): readonly string[] => (lines ?? []).map((line) => /^(TC-\d{3}) · /.exec(line)?.[1]).filter((code): code is string => code !== undefined);

/** Dos listas de códigos son el mismo conjunto (sin importar el orden). */
export const sameSet = (actual: readonly string[], expected: readonly string[]): boolean => actual.length === expected.length && [...actual].sort().join(',') === [...expected].sort().join(',');

/** Códigos de los casos que muestra la lista ahora (una lectura del DOM: `testcase-row-TC-001`, sin los menús), o `undefined` si no se lee. */
export const visibleCodes = (scope: Locator): Promise<readonly string[] | undefined> =>
  safe(
    () =>
      scope.evaluate(
        (root) =>
          Array.from(root.querySelectorAll('[data-testid^="testcase-row-"]'))
            .map((element) => element.getAttribute('data-testid') ?? '')
            .filter((id) => /^testcase-row-TC-\d{3}$/.test(id))
            .map((id) => id.slice('testcase-row-'.length)),
        undefined,
        { timeout: READ_MS },
      ),
    undefined,
  );

/** Texto de los códigos que espera la fila (o «(ninguno)»), para la nota y el observado. */
export const listed = (codes: readonly string[] | undefined): string => (codes === undefined ? '(no se pudo leer)' : codes.length === 0 ? '(ninguno)' : codes.join(', '));

/** Una lista de comprobaciones se queda en el resultado de la fila; si una es incumplida, la nota dice en qué. */
export const quietCheck = (count: number, expected: string): Check => check(count === 0, expected, `${count} descarga(s)`);

/** Espera de la ventana en la que se observa que NO pasa nada. */
export const quietWindow = (): Promise<void> => sleep(QUIET_MS);

/** Nota de la prueba de fallo: la traza de la petición fallida (línea de método, ruta y estado). */
export const TRACE_READING =
  'La historia dice «la traza de la petición fallida» sin fijar el texto exacto. Se lee como el detalle técnico de esa petición: método, ruta y código de estado (lo que la README llama «línea de detalle técnico»). Se comprueban esos tres datos; el resto del texto no cuenta.';

/** Comprobación de la traza de la petición fallida: método GET, ruta /api/verification/report y estado 500 en el aviso. */
export const traceCheck = (body: string | undefined): Check =>
  check(
    body !== undefined && /^GET \/api\/verification\/report\s/.test(body) && /\b500\b/.test(body),
    'la traza de la petición: GET, /api/verification/report y estado 500',
    body === undefined ? '(sin aviso de error)' : `el aviso dice «${body}»`,
  );

/** Causa (por lectura del código) de que el aviso muestre la traza de una petición sin respuesta en vez del texto de red. */
export const NETWORK_CAUSE =
  'Causa por lectura del código: el cliente compartido convierte un fallo de red en un ApiError de estado 0 con la traza «… → network error» (packages/shared/src/client.ts:146-149), y formatTrace la devuelve (packages/shared/src/error-view.ts:40-42); el texto «No se pudo contactar con el servidor» solo saldría si el error no fuera un ApiError.';

/** Comprobación de un texto exacto en el cuerpo de un aviso. */
export const exactTextCheck = (body: string | undefined, expected: string): Check =>
  check(body === expected, `el texto «${expected}»`, body === undefined ? '(sin aviso de error)' : `el aviso dice «${body}»`);

