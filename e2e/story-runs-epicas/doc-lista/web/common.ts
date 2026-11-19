import type { BrowserContext, Download, Locator, Page, Route } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { DOCUMENTOS_DYNAMIC_TESTIDS, DOCUMENTOS_TESTIDS, PROGRAMAS_TESTIDS } from '../../../../packages/shared/src/testids';
import { call } from '../../../story-runs/support/api';
import { DEMO, TENANT_A, startSession } from '../../../story-runs/support/prepare';
import { rawGet } from '../api/common';
import { ACTION, CEILING_MS, attrOf, isVisible, runSteps, safe, textOf, waitUntil } from '../../support/browser';
import { check, conclude, sleep, type Check } from '../../support/checks';
import { outcome, type BrowserRowHandler, type ManifestRow, type Outcome } from '../../core/framework';

// Piezas comunes de las filas web de EP-DOC-LISTA (escritorio 1440 px; diseño responsive 390 px, por debajo de 1024). Los
// localizadores son de rol y de nombre; los ids de prueba solo donde la pantalla no ofrece otro rastro (filas, enlaces, recuento,
// avisos). Cada lectura es estricta: un fallo de lectura es «no leído», nunca «vacío» ni «oculto». Cada acción pasa por `interact`,
// que registra si el elemento no existe, si lo tapa otro, o si recibe el clic pero no ocurre la acción.

/** Diseño de la fila: «escritorio» (≥ 1024 px) o «responsive» (< 1024 px). */
export type Layout = 'escritorio' | 'responsive';

export const LAYOUTS: ReadonlyMap<string, Layout> = new Map<string, Layout>([
  ['de escritorio', 'escritorio'],
  ['responsive (menos de 1024 px)', 'responsive'],
]);

export const viewportOf = (layout: Layout): { readonly width: number; readonly height: number } => (layout === 'escritorio' ? { width: 1440, height: 900 } : { width: 390, height: 844 });

export const LOGIN_URL = `/login?tenant=${TENANT_A}`;
export const DOCUMENTS_PATH = '/documents';
const CODE_LINK = 'document-link-';

// --- Preferencia de cookies (no es una sesión) y nota de cada fila web ---------------------------------------------------------------

/** Nota que se añade a cada fila web: la preferencia de cookies se fija por adelantado, como en el piloto. */
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

// --- Preparación: inicio de sesión de gestor@sigpro.test y apertura de /documents --------------------------------------------------

/**
 * Preparación de cada fila: fija la preferencia de cookies, instala el registro de avisos ANTES de cargar la app, fija el ancho,
 * abre /login?tenant=alumno01, escribe el correo y la contraseña de gestor@sigpro.test y pulsa «Entrar». Termina en /programs.
 */
export const signIn = (page: Page, layout: Layout): Promise<string | undefined> =>
  runSteps([
    ['fijar la preferencia de cookies', () => page.context().addInitScript(fixCookiePreference)],
    ['instalar el registro de avisos', () => page.context().addInitScript(recordToasts, TOAST_KEY)],
    ['fijar el ancho de la ventana', () => page.setViewportSize(viewportOf(layout))],
    ['abrir /login?tenant=alumno01', () => page.goto(LOGIN_URL, { timeout: CEILING_MS })],
    ['escribir el correo', () => page.getByLabel('Correo electrónico', { exact: true }).fill(DEMO.gestor.email, ACTION)],
    ['escribir la contraseña', () => page.getByLabel('Contraseña', { exact: true }).fill(DEMO.gestor.password, ACTION)],
    ['pulsar «Entrar»', () => page.getByRole('button', { name: 'Entrar', exact: true }).click(ACTION)],
    ['llegar a /programs', () => page.waitForURL(/\/programs/, { timeout: CEILING_MS })],
  ]);

/** Abre /documents con la sesión ya iniciada en la misma página y espera a que la lista se asiente (o muestre su error). */
export const openDocuments = (page: Page): Promise<string | undefined> =>
  runSteps([
    ['abrir /documents', () => page.goto(DOCUMENTS_PATH, { timeout: CEILING_MS })],
    ['ver la lista de documentos', async () => {
      if (!(await listSettled(page))) throw new Error('la lista de documentos no se asienta');
    }],
  ]);

/** Apertura de una dirección de la app con la sesión ya guardada (carga completa), sin esperar a la lista. */
export const gotoPath = (page: Page, path: string): Promise<string | undefined> => runSteps([[`abrir ${path}`, () => page.goto(path, { timeout: CEILING_MS })]]);

// --- Localizadores ----------------------------------------------------------------------------------------------------------------

/** Buscador «Buscar documentos» (tipo búsqueda: rol searchbox). */
export const searchBox = (page: Page): Locator => page.getByRole('searchbox', { name: 'Buscar documentos', exact: true });
/** Desplegable «Programa» de la lista. */
export const programSelect = (page: Page): Locator => page.getByRole('combobox', { name: 'Programa', exact: true });
/** Desplegable «Clasificación» de la lista. */
export const classSelect = (page: Page): Locator => page.getByRole('combobox', { name: 'Clasificación', exact: true });
/** Botón «Limpiar filtros» de la barra de filtros (no el del bloque vacío). */
export const toolbarClear = (page: Page): Locator => page.getByTestId(DOCUMENTOS_TESTIDS.DOCUMENTS_FILTERS_CLEAR);
/** Bloque «Sin documentos» (id de prueba: el bloque vacío es el único contenedor que lo agrupa). */
export const emptyBlock = (page: Page): Locator => page.getByTestId(DOCUMENTOS_TESTIDS.DOCUMENTS_EMPTY);
/** Botón «Limpiar filtros» dentro del bloque vacío. */
export const emptyClear = (page: Page): Locator => emptyBlock(page).getByRole('button', { name: 'Limpiar filtros', exact: true });
/** Aviso de error de la lista (rol alerta). */
export const listError = (page: Page): Locator => page.getByTestId(DOCUMENTOS_TESTIDS.DOCUMENTS_ERROR);
/** Botón «Reintentar» del aviso de error de la lista. */
export const listRetry = (page: Page): Locator => page.getByTestId(DOCUMENTOS_TESTIDS.DOCUMENTS_ERROR_RETRY);
/** Recuento de la lista debajo de la tabla (id de prueba). */
export const countBelow = (page: Page): Locator => page.getByTestId(DOCUMENTOS_TESTIDS.DOCUMENTS_COUNT);
/** Recuento «N documentos» encima de la lista: el primer párrafo vivo de la página de documentos. */
export const subtitleAbove = (page: Page): Locator => page.getByTestId(DOCUMENTOS_TESTIDS.DOCUMENTS_PAGE).locator('p[aria-live="polite"]').first();
/** Tabla de escritorio (aria-busy de la lista). */
export const table = (page: Page): Locator => page.getByTestId(DOCUMENTOS_TESTIDS.DOCUMENTS_TABLE);
/** Filas de carga (la lista muestra filas de carga mientras llega la primera respuesta). */
export const skeletonRows = (page: Page): Locator => page.getByTestId(PROGRAMAS_TESTIDS.SKELETON_ROW);
/** Fila de la tabla (escritorio) de un documento. Exacta: no casa con el botón ⋯ de la fila. */
export const rowOf = (page: Page, code: string): Locator => page.getByTestId(DOCUMENTOS_DYNAMIC_TESTIDS.DOCUMENT_ROW(code));
/** Enlace al código de un documento (tabla o tarjeta). */
export const linkOf = (page: Page, code: string): Locator => page.getByTestId(DOCUMENTOS_DYNAMIC_TESTIDS.DOCUMENT_LINK(code));
/** Botón ⋯ de la fila de un documento (escritorio). */
export const rowMenuButton = (page: Page, code: string): Locator => page.getByTestId(DOCUMENTOS_DYNAMIC_TESTIDS.DOCUMENT_ROW_MENU(code));
/** Menú de acciones abierto de un documento (rol menú, nombre «Acciones para CODE»). */
export const rowMenu = (page: Page, code: string): Locator => page.getByRole('menu', { name: `Acciones para ${code}`, exact: true });
/** Una opción del menú abierto de un documento. */
export const menuItem = (page: Page, code: string, name: string): Locator => rowMenu(page, code).getByRole('menuitem', { name, exact: true });

// --- Ficha y visor --------------------------------------------------------------------------------------------------------------

export const detailOf = (page: Page): Locator => page.getByTestId(DOCUMENTOS_TESTIDS.DOCUMENT_DETAIL);
export const detailTitle = (page: Page): Locator => page.getByTestId(DOCUMENTOS_TESTIDS.DOCUMENT_TITLE);
export const versionSelect = (page: Page): Locator => page.getByTestId(DOCUMENTOS_TESTIDS.DOCUMENT_VERSION_SELECT);
export const openTabLink = (page: Page): Locator => page.getByTestId(DOCUMENTOS_TESTIDS.DOCUMENT_OPEN_TAB);
export const detailDownload = (page: Page): Locator => page.getByTestId(DOCUMENTOS_TESTIDS.DOCUMENT_DOWNLOAD);
export const historyList = (page: Page): Locator => page.getByTestId(DOCUMENTOS_TESTIDS.DOCUMENT_VERSIONS);
export const historyRow = (page: Page, version: number): Locator => page.getByTestId(DOCUMENTOS_DYNAMIC_TESTIDS.DOCUMENT_VERSION_ROW(version));
export const detailNotFound = (page: Page): Locator => page.getByTestId(DOCUMENTOS_TESTIDS.DOCUMENT_NOT_FOUND);
export const detailBack = (page: Page): Locator => page.getByTestId(DOCUMENTOS_TESTIDS.DOCUMENT_BACK);
/** Visor embebido de la ficha (iframe de la misma aplicación). */
export const embeddedViewer = (page: Page): Locator => page.getByTestId(DOCUMENTOS_TESTIDS.DOCUMENT_VIEWER);
export const viewerPage = (page: Page): Locator => page.getByTestId(DOCUMENTOS_TESTIDS.VIEWER_PAGE);
export const viewerLoading = (page: Page): Locator => page.getByTestId(DOCUMENTOS_TESTIDS.VIEWER_LOADING);
export const viewerError = (page: Page): Locator => page.getByTestId(DOCUMENTOS_TESTIDS.VIEWER_ERROR);
export const viewerVersion = (page: Page): Locator => page.getByTestId(DOCUMENTOS_TESTIDS.VIEWER_VERSION);
export const viewerTitle = (page: Page): Locator => page.getByTestId(DOCUMENTOS_TESTIDS.VIEWER_TITLE);
export const viewerClass = (page: Page): Locator => page.getByTestId(DOCUMENTOS_TESTIDS.VIEWER_CLASS);
export const viewerPageN = (page: Page, n: number): Locator => page.getByTestId(DOCUMENTOS_DYNAMIC_TESTIDS.VIEWER_PAGE_N(n));

// --- Lectura de textos -------------------------------------------------------------------------------------------------------------

/** Líneas visibles de un elemento (innerText, sin vacías). `undefined` si no se puede leer. */
export const linesOf = async (target: Locator): Promise<readonly string[] | undefined> => {
  const text = await textOf(target);
  return text === undefined ? undefined : text.split('\n').map((line) => line.replace(/\s+/g, ' ').trim()).filter((line) => line !== '');
};

/** Texto normalizado (espacios colapsados) de un elemento, o `undefined`. */
export const normalizedText = async (target: Locator): Promise<string | undefined> => {
  const text = await textOf(target);
  return text === undefined ? undefined : text.replace(/\s+/g, ' ').trim();
};

/** Valor visible del control (select o input), o `undefined` si no se puede leer. */
export const controlValue = (target: Locator): Promise<string | undefined> =>
  safe(() => target.first().evaluate((element) => (element as HTMLInputElement | HTMLSelectElement).value, undefined, { timeout: 500 }), undefined);

/** Texto de la opción seleccionada de un desplegable, o `undefined`. */
export const selectedOptionText = (target: Locator): Promise<string | undefined> =>
  safe(() => target.first().evaluate((element) => (element as HTMLSelectElement).selectedOptions[0]?.textContent?.trim() ?? '', undefined, { timeout: 500 }), undefined);

/** Códigos de los documentos que se ven, en el orden de la pantalla (lectura de los enlaces `document-link-…`). */
export const shownCodes = (page: Page): Promise<readonly string[] | undefined> =>
  safe(async () => {
    const ids = await page.locator(`[data-testid^="${CODE_LINK}"]`).evaluateAll((elements) => elements.map((element) => element.getAttribute('data-testid') ?? ''));
    return ids.map((id) => id.slice(CODE_LINK.length)).filter((code) => /^DOC-\d{3}$/.test(code));
  }, undefined);

/** Recuento de la lista debajo de la tabla («N documentos»), o `undefined`. */
export const countText = (page: Page): Promise<string | undefined> => normalizedText(countBelow(page));

/** Recuento encima de la lista («N documentos»), o `undefined`. */
export const subtitleText = (page: Page): Promise<string | undefined> => normalizedText(subtitleAbove(page));

/** ¿La lista ya se asentó? Recuento con cifra (o aviso de error) y sin filas de carga. */
export const listSettled = async (page: Page): Promise<boolean> =>
  (
    await waitUntil(async () => {
      const count = await countText(page);
      const failed = await isVisible(listError(page));
      return ((count !== undefined && /^\d+ documentos$/.test(count)) || failed) && (await safe(() => skeletonRows(page).count(), 1)) === 0;
    })
  ).reached;

/** Espera (con techo) a que la lista muestre `codes` y, si se da, el recuento; devuelve lo que se ve al final. */
export const waitForList = async (page: Page, codes: readonly string[], count?: string): Promise<{ readonly codes: readonly string[] | undefined; readonly count: string | undefined }> => {
  await waitUntil(async () => sameCodes(await shownCodes(page), codes) && (count === undefined || (await countText(page)) === count));
  return { codes: await shownCodes(page), count: await countText(page) };
};

/** Igualdad exacta de dos listas de códigos, en orden. `undefined` (no leída) nunca es igual. */
export const sameCodes = (actual: readonly string[] | undefined, expected: readonly string[]): boolean =>
  actual !== undefined && actual.length === expected.length && actual.every((code, index) => code === expected[index]);

/** Texto de una lista de códigos para los mensajes. */
export const describeCodes = (codes: readonly string[] | undefined): string => (codes === undefined ? '(sin leer)' : codes.length === 0 ? '(ninguno)' : codes.join(', '));

/** Códigos de una celda: «DOC-001 a DOC-012», «DOC-003 y DOC-004», «DOC-003, DOC-006, DOC-009 y DOC-012», «(ninguno)» o «ningún documento». */
export const codesOf = (text: string): readonly string[] => {
  if (text === '(ninguno)' || text === 'ningún documento') return [];
  const range = /^(DOC-\d{3}) a (DOC-\d{3})$/.exec(text);
  if (range?.[1] !== undefined && range[2] !== undefined) {
    const from = Number(range[1].slice(4));
    const to = Number(range[2].slice(4));
    return Array.from({ length: to - from + 1 }, (_, index) => `DOC-${String(from + index).padStart(3, '0')}`);
  }
  const parts = text.split(/, | y /);
  if (!parts.every((code) => /^DOC-\d{3}$/.test(code))) throw new Error(`celda sin interpretación: códigos «${text}»`);
  return parts;
};

/** Comprobación de la lista: los códigos que se ven son exactamente los esperados (en orden). */
export const listCheck = (shown: readonly string[] | undefined, expected: readonly string[]): Check =>
  check(sameCodes(shown, expected), `la lista muestra ${describeCodes(expected)}`, `la lista muestra ${describeCodes(shown)}`);

/** Comprobación del recuento: el texto visible igual al esperado. */
export const countCheck = (observed: string | undefined, expected: string, what = 'el recuento'): Check =>
  check(observed === expected, `${what} dice «${expected}»`, `${what} dice «${observed ?? '(sin leer)'}»`);

/** Un «Entonces» de visibilidad estricta: el elemento se ve (lectura ambigua lanza; ausente = no se ve). */
export const seenCheck = async (target: Locator, expected: string, label: string): Promise<Check> => {
  const found = await safe(() => target.count(), -1);
  if (found > 1) throw new Error(`lectura ambigua de ${label}: ${found} elementos`);
  const seen = found === 1 && (await isVisible(target));
  return check(seen, expected, seen ? `${label} visible` : `${label} no visible`);
};

/** Un valor de control exacto (texto de la opción o valor del campo). */
export const valueCheck = (observed: string | undefined, expected: string, what: string): Check =>
  check(observed === expected, `${what} «${expected}»`, `${what} «${observed ?? '(sin leer)'}»`);

/** Estado habilitado o deshabilitado de un botón (lectura fallida = no cumple). */
export const buttonEnabledCheck = async (target: Locator, expectEnabled: boolean, label: string): Promise<Check> => {
  const enabled = await safe(() => target.first().isEnabled({ timeout: 500 }), undefined);
  return check(enabled === expectEnabled, `«${label}» está ${expectEnabled ? 'habilitado' : 'deshabilitado'}`, `«${label}» está ${enabled === undefined ? '(sin leer)' : enabled ? 'habilitado' : 'deshabilitado'}`);
};

/** Atributo `aria-busy` de un elemento (`true`/`false`), o `undefined` si no se puede leer. */
export const busyOf = async (target: Locator): Promise<string | undefined> => attrOf(target, 'aria-busy');

// --- Acciones con diagnóstico -----------------------------------------------------------------------------------------------------

export interface Blocked {
  readonly message: string;
  readonly note: string;
  readonly evidence?: Readonly<Record<string, unknown>>;
}

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

/** Lo que se registra de una acción fallida: primeras líneas del error, «intercepts pointer events» y quién recibe el clic. */
const describeFailure = async (target: Locator, label: string, error: unknown): Promise<Blocked> => {
  const lines = (error instanceof Error ? error.message : String(error)).split('\n').map((line) => line.trim()).filter((line) => line !== '');
  const intercept = lines.find((line) => line.includes('intercepts pointer events'));
  const present = (await safe(() => target.count(), -1)) > 0;
  const message = `no se pudo ${label}: ${lines.slice(0, 3).join(' · ')}${intercept === undefined ? '' : ` · ${intercept}`}`;
  if (!present) return { message, note: 'La historia nombra un elemento que la pantalla no ofrece (no existe con ese nombre).' };
  const probe = await safe<Hit | undefined>(() => target.first().evaluate(hitAtCenter, undefined, { timeout: 2_000 }), undefined);
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

/** Una acción fallida con su diagnóstico, como resultado de la fila. */
export const actionFailed = (expected: string, blocked: Blocked): Outcome =>
  outcome(false, expected, blocked.message, { note: blocked.note, ...(blocked.evidence === undefined ? {} : { evidence: blocked.evidence }) });

/** Pulsa un elemento localizado por `locate` (con su nombre en el diagnóstico). */
export const clickIn = (locate: (page: Page) => Locator, label: string): ((page: Page) => Promise<Blocked | undefined>) => (page) => interact(locate(page), label, (element) => element.click(ACTION));

/** Elige una opción de un desplegable por su texto visible. */
export const chooseIn = (locate: (page: Page) => Locator, option: string, label: string): ((page: Page) => Promise<Blocked | undefined>) => (page) =>
  interact(locate(page), `elegir «${option}» en «${label}»`, (element) => element.selectOption({ label: option }, ACTION));

/** Escribe un texto en un campo (la búsqueda se aplica tras el retardo de 250 ms del campo). */
export const typeIn = (locate: (page: Page) => Locator, text: string, label: string): ((page: Page) => Promise<Blocked | undefined>) => (page) =>
  interact(locate(page), `escribir «${text}» en «${label}»`, (element) => element.fill(text, ACTION));

/** Ejecuta las acciones en orden; a la primera que falla devuelve su diagnóstico. */
export const inOrder =
  (...actions: readonly ((page: Page) => Promise<Blocked | undefined>)[]) =>
  async (page: Page): Promise<Blocked | undefined> => {
    for (const action of actions) {
      const blocked = await action(page);
      if (blocked !== undefined) return blocked;
    }
    return undefined;
  };

// --- Rutas de la prueba (demoras y errores provocados antes de abrir la pantalla) ----------------------------------------------

/** Cabeceras CORS de una respuesta provocada: la web llama a la API desde otro origen y sin ellas el navegador daría un fallo de red. */
const corsHeaders = (origin: string | undefined): Record<string, string> => ({ 'access-control-allow-origin': origin ?? '*', 'access-control-expose-headers': '*' });

/** Demora `ms` las respuestas GET de la ruta exacta (la prueba fija el retardo; la historia lo da como dato). */
export const delayGet = (page: Page, pathname: string, ms: number): Promise<unknown> =>
  page.route(
    (url) => url.pathname === pathname,
    async (route: Route) => {
      if (route.request().method() !== 'GET') return route.continue();
      await sleep(ms);
      return route.continue();
    },
  );

/** Recuento de una ruta de fallo: peticiones GET que se han fallado y que se han dejado pasar. */
export interface FailTally {
  failed: number;
  passed: number;
}

/**
 * Falla SOLO la primera petición GET de la ruta exacta (la historia habla de «la primera petición»); las siguientes pasan a la red.
 * Cuenta en `tally` las que se fallan y las que se dejan pasar: la evidencia dice cuántas hizo la pantalla.
 */
export const failFirstGet = (page: Page, pathname: string, status: number, tally: FailTally): Promise<unknown> =>
  page.route(
    (url) => url.pathname === pathname,
    async (route: Route) => {
      const request = route.request();
      if (request.method() !== 'GET') return route.continue();
      if (tally.failed >= 1) {
        tally.passed += 1;
        return route.continue();
      }
      tally.failed += 1;
      return route.fulfill({
        status,
        contentType: 'application/json',
        headers: corsHeaders(request.headers().origin),
        body: JSON.stringify({ statusCode: status, error: 'Error', message: 'Error provocado por la prueba' }),
      });
    },
  );

/** Responde `status` a TODAS las peticiones GET de la ruta exacta (el aviso de error de la lista). */
export const failAllGet = (page: Page, pathname: string, status: number): Promise<unknown> =>
  page.route(
    (url) => url.pathname === pathname,
    async (route: Route) => {
      const request = route.request();
      if (request.method() !== 'GET') return route.continue();
      return route.fulfill({
        status,
        contentType: 'application/json',
        headers: corsHeaders(request.headers().origin),
        body: JSON.stringify({ statusCode: status, error: 'Error', message: 'Error provocado por la prueba' }),
      });
    },
  );

// --- Avisos emergentes: registro instalado antes de la acción ---------------------------------------------------------------------

/** Clave del registro de avisos en la ventana del navegador. */
export const TOAST_KEY = '__sigproToasts';
/** Ventana que se observa tras una acción para afirmar que NO aparece un aviso: mayor que su vida (3 s). */
export const QUIET_WINDOW_MS = 4_000;

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

/** Vacía el registro y marca el instante de la acción que se va a probar. Devuelve ese instante, o `undefined` si no se pudo armar. */
export const armToasts = (page: Page): Promise<number | undefined> =>
  safe(
    () =>
      page.evaluate((key: string) => {
        const registry = window as unknown as Record<string, unknown>;
        const log = registry[key];
        if (!Array.isArray(log)) return undefined;
        log.length = 0;
        const at = Date.now();
        registry.__sigproArmedAt = at;
        return at;
      }, TOAST_KEY),
    undefined,
  );

/**
 * Lee el registro de avisos. Devuelve `null` si el registro NO está instalado (no se puede afirmar nada), `undefined` si la lectura
 * falló (tampoco se afirma nada), o la lista de avisos desde la última «armada». Un fallo de lectura nunca es «ningún aviso».
 */
export const toastLog = (page: Page): Promise<readonly ToastEntry[] | null | undefined> =>
  safe(
    () =>
      page.evaluate((key: string) => {
        const log = (window as unknown as Record<string, unknown>)[key];
        return Array.isArray(log) ? (log as ToastEntry[]).map((entry) => ({ ...entry })) : null;
      }, TOAST_KEY),
    undefined,
  );

/** Resultado de buscar un aviso: si apareció, lo observado en una frase y el tiempo hasta su primera aparición. */
export interface ToastResult {
  readonly seen: boolean;
  readonly observed: string;
  readonly firstAt?: number;
  readonly delayMs?: number;
}

const describeLog = (log: readonly ToastEntry[] | null | undefined): string => {
  if (log === null) return 'el registro de avisos no está instalado';
  if (log === undefined) return 'no se pudo leer el registro de avisos';
  return log.length === 0 ? 'ningún aviso' : `avisos: ${log.map((entry) => `${entry.tone} «${entry.title}»${entry.body === '' ? '' : ` / «${entry.body}»`}`).join(' | ')}`;
};

/** Busca en el registro un aviso con ese tono, título y cuerpo (exactos). Espera con techo; consulta el registro, no la pantalla. */
export const toastShown = async (page: Page, tone: 'ok' | 'danger' | 'info' | 'warn' | undefined, title: string, body: string, armedAt?: number): Promise<ToastResult> => {
  // Sin tono: el tono no lo fija la historia; el tono que se registró va en la evidencia (`observed`).
  const matches = (entry: ToastEntry): boolean => (tone === undefined || entry.tone === tone) && entry.title === title && entry.body === body;
  const found = await waitUntil(async () => {
    const log = await toastLog(page);
    return log !== null && log !== undefined && log.some(matches);
  });
  const log = await toastLog(page);
  const hit = log === null || log === undefined ? undefined : log.find(matches);
  return {
    seen: found.reached,
    observed: describeLog(log),
    ...(hit === undefined ? {} : { firstAt: hit.at, ...(armedAt === undefined ? {} : { delayMs: hit.at - armedAt }) }),
  };
};

/** Ventana de silencio tras una acción: `held` solo si el registro estaba instalado, se leyó, y no salió ningún aviso (de ese tono). */
export interface QuietWindow {
  readonly held: boolean;
  readonly seen: string;
  readonly unarmed: boolean;
}

export const quietWindow = async (page: Page, tone?: 'ok' | 'danger' | 'info' | 'warn'): Promise<QuietWindow> => {
  await sleep(QUIET_WINDOW_MS);
  const log = await toastLog(page);
  if (log === null) return { held: false, seen: 'el registro de avisos no está instalado', unarmed: true };
  if (log === undefined) return { held: false, seen: 'no se pudo leer el registro de avisos', unarmed: false };
  const shown = tone === undefined ? log : log.filter((entry) => entry.tone === tone);
  return { held: shown.length === 0, seen: shown.map((entry) => `${entry.tone} «${entry.title}»`).join(', '), unarmed: false };
};

/** Comprobación de una ventana de silencio: «no aparece…» solo si el registro estaba instalado y no salió nada. */
export const quietCheck = (quiet: QuietWindow, what: string): Check =>
  check(quiet.held, `no aparece ${what}`, quiet.held ? `no aparece ${what}` : quiet.unarmed || quiet.seen.startsWith('no se pudo') ? `no se puede afirmar (${quiet.seen})` : `aparece ${quiet.seen}`);

// --- Descargas ---------------------------------------------------------------------------------------------------------------------

/** Descarga que dispara `trigger`: el nombre sugerido y los bytes del archivo. Un fallo lanza (la fila lo recoge). */
export const downloadBytes = async (page: Page, trigger: () => Promise<unknown>): Promise<{ readonly name: string; readonly bytes: Buffer }> => {
  const pending = page.waitForEvent('download', { timeout: CEILING_MS });
  // Si la acción falla antes de la descarga, la promesa no se deja sin atender
  pending.catch(() => undefined);
  await trigger();
  const download: Download = await pending;
  const path = await download.path();
  if (path === null) throw new Error('la descarga no dejó archivo');
  return { name: download.suggestedFilename(), bytes: await readFile(path) };
};

/** Pestaña nueva que abre `trigger` (el enlace con `target=_blank`): la página nueva ya cargada. */
export const newTabFrom = async (context: BrowserContext, trigger: () => Promise<unknown>): Promise<{ readonly page: Page } | { readonly failure: string }> => {
  const pending = context.waitForEvent('page', { timeout: CEILING_MS });
  pending.catch(() => undefined);
  try {
    await trigger();
  } catch (error) {
    return { failure: `no se pudo pulsar la opción: ${(error instanceof Error ? error.message : String(error)).split('\n')[0] ?? ''}` };
  }
  try {
    const page = await pending;
    await page.waitForLoadState('domcontentloaded', { timeout: CEILING_MS });
    return { page };
  } catch {
    return { failure: 'no se abrió una pestaña nueva' };
  }
};

// --- Celdas de la historia -------------------------------------------------------------------------------------------------------

/** Frase de lo que la historia espera de la fila (sus pasos «Entonces» y «Y»). */
export const thenOf = (row: ManifestRow): string => row.resolvedSteps.filter((step) => /^(Entonces|Y) /.test(step)).join('; ');


// --- Filas, menús y navegación de la lista ---------------------------------------------------------------------------------------

/** Textos de las celdas de la fila de la tabla (escritorio), en orden. `undefined` si no se pueden leer. */
export const rowCells = async (page: Page, code: string): Promise<readonly string[] | undefined> => {
  const texts = await safe(() => rowOf(page, code).getByRole('cell').allInnerTexts(), undefined);
  return texts?.map((text) => text.replace(/\s+/g, ' ').trim());
};

/** Abre el menú ⋯ de la fila del documento (escritorio) y espera a que se vea. */
export const openRowMenu = async (page: Page, code: string): Promise<Blocked | undefined> => {
  const blocked = await interact(rowMenuButton(page, code), `abrir «Acciones para ${code}»`, (element) => element.click(ACTION));
  if (blocked !== undefined) return blocked;
  const opened = await waitUntil(() => isVisible(rowMenu(page, code)));
  return opened.reached ? undefined : { message: `se pulsó «Acciones para ${code}» y no se abrió el menú`, note: 'el botón existe y se pulsó, pero no se abrió el menú de acciones' };
};

/** Pulsa una opción del menú abierto de la fila. */
export const pressMenuItem = (page: Page, code: string, name: string): Promise<Blocked | undefined> =>
  interact(menuItem(page, code, name), `pulsar «${name}» en las acciones de ${code}`, (element) => element.click(ACTION));

/** Abre la ficha de un documento desde la lista (clic en su código) y espera a que la ficha se vea. */
export const openDetailFromList = async (page: Page, code: string): Promise<Blocked | undefined> => {
  const blocked = await interact(linkOf(page, code), `abrir la ficha de ${code} desde la lista`, (element) => element.click(ACTION));
  if (blocked !== undefined) return blocked;
  const shown = await waitUntil(() => isVisible(detailOf(page)));
  return shown.reached ? undefined : { message: `se pulsó el código ${code} y no se abrió la ficha`, note: 'el enlace existe y se pulsó, pero la ficha no apareció' };
};

/** PDF de una versión (o de la última) tal como lo sirve la API al mismo gestor. `undefined` si no hay sesión o no es 200. */
export const apiPdfOf = async (tenant: string, id: string, version?: number): Promise<Buffer | undefined> => {
  const started = await startSession(tenant, DEMO.gestor);
  if (started.session === undefined) return undefined;
  const raw = await rawGet(`/documents/${id}/download`, tenant, started.session.accessToken, version === undefined ? undefined : `version=${version}`);
  return raw.status === 200 ? raw.bytes : undefined;
};

/** Comprobación de bytes: el archivo descargado es el mismo que sirve la API (`undefined` en la API = no se pudo leer). */
export const sameBytes = (downloaded: Buffer, api: Buffer | undefined, what: string): Check =>
  check(
    api !== undefined && downloaded.equals(api),
    `el archivo descargado es el PDF de ${what}`,
    api === undefined ? `no se pudo leer el PDF de ${what} en la API` : downloaded.equals(api) ? `el archivo descargado es el PDF de ${what}` : `el archivo descargado (${downloaded.length} bytes) no es el PDF de ${what} (${api.length} bytes)`,
  );

/** Trazas de los avisos de error: «GET … → 404 …» (la línea de traza que muestra la pantalla). */
export const hasTrace = (text: string | undefined, status: number): Check =>
  check(text !== undefined && text.includes(`→ ${status}`), `la traza de la petición (→ ${status})`, text === undefined ? 'la traza no se pudo leer' : text.includes(`→ ${status}`) ? `la traza de la petición (→ ${status})` : `sin la traza (→ ${status}): «${text}»`);

/** Comprobaciones de una fila: `coincide` si todas se cumplen; si no, la nota dice en qué difiere. */
export const finish = (checks: readonly Check[], extra: Pick<Outcome, 'note' | 'evidence'> = {}): Outcome => {
  const result = conclude(checks, extra);
  if (result.verdict === 'coincide' || result.note !== undefined) return result;
  const differences = checks.filter((entry) => !entry.ok).map((entry) => `«${entry.expected}» no se cumple (${entry.observed})`);
  return { ...result, note: `Difiere en: ${differences.join('; ')}` };
};

/**
 * Nota de las filas que piden la traza de la petición (la línea de detalle técnico). El README («Detalle técnico visible») dice que el
 * veredicto no depende de ella: se anota en la evidencia y no se compara. Las historias que la piden la dejan en «Decisiones pendientes».
 */
export const TRACE_NOTE =
  "La historia pide la traza de la petición en el paso y la deja en «Decisiones pendientes»; el veredicto es independiente de la traza según el README («Detalle técnico visible»): la traza va a la evidencia y no se compara.";

/**
 * Fila que pide la traza: el veredicto sale solo de las demás comprobaciones (coincide si se cumplen, discrepa si no). La traza
 * observada (presente o no) va a la evidencia y la nota dice que no decide el veredicto.
 */
export const traceDependent = (expected: string, others: readonly Check[], trace: Check, evidence: Readonly<Record<string, unknown>> = {}): Outcome => {
  const result = conclude(others, { evidence: { ...evidence, trazaPresente: trace.ok, trazaObservada: trace.observed } });
  const differences = others.filter((entry) => !entry.ok).map((entry) => `«${entry.expected}» no se cumple (${entry.observed})`);
  return { ...result, expected, note: differences.length === 0 ? TRACE_NOTE : `${TRACE_NOTE} Difiere en: ${differences.join("; ")}` };
};

/** Motivo de preparación cuando el registro de avisos no está instalado: la fila no puede comprobar el aviso que pide. */
export const UNARMED = 'el registro de avisos no está instalado en la página: no se puede comprobar el aviso';

/** Visibilidad leída para una comprobación de «no ve…»: `undefined` si no se puede leer (una lectura fallida nunca cuenta como oculto). */
export const visibleOrUnknown = (target: Locator): Promise<boolean | undefined> => safe(() => target.first().isVisible({ timeout: 500 }), undefined);

/** Resultado de intentar una descarga: el archivo, o el error que la impidió (no lanza: la fila lo convierte en `discrepa`). */
export type DownloadTry = { readonly download: Awaited<ReturnType<typeof downloadBytes>> } | { readonly error: unknown };

/** Intenta la descarga que dispara `trigger` y devuelve el archivo o el error, sin lanzar. */
export const tryDownload = async (page: Page, trigger: () => Promise<unknown>): Promise<DownloadTry> => {
  try {
    return { download: await downloadBytes(page, trigger) };
  } catch (error) {
    return { error };
  }
};

/** Fila que no logró la descarga: discrepa con el motivo y los avisos registrados como evidencia. */
export const noDownload = async (expected: string, page: Page, error: unknown): Promise<Outcome> => {
  const log = await toastLog(page);
  const message = error instanceof Error ? (error.message.split('\n')[0] ?? 'error') : String(error);
  return outcome(false, expected, `no se inició la descarga: ${message}`, {
    note: 'La descarga no llegó a la página: ver el motivo y los avisos registrados (evidencia).',
    evidence: { avisosRegistrados: log ?? null },
  });
};

/** Hijos del contenedor de una página del visor: el encabezado y luego cada línea (`p`) o hueco vacío (`div`), con su grosor de fuente. */
export interface ViewerChild {
  readonly tag: string;
  readonly text: string;
  readonly weight: string;
}

/** Lee los hijos de la sección de una página, en una sola lectura del navegador. `undefined` si no se puede leer. */
export const sectionChildren = (target: Locator): Promise<readonly ViewerChild[] | undefined> =>
  safe<readonly ViewerChild[] | undefined>(
    () =>
      target.first().evaluate((section: Element) =>
        Array.from(section.children).map((child) => ({
          tag: child.tagName,
          text: (child as HTMLElement).innerText.trim(),
          weight: getComputedStyle(child).fontWeight,
        })),
      { timeout: 2_000 }),
    undefined,
  );

/** Páginas de un documento tal como las sirve la API al gestor (la última versión si no se pasa versión). `undefined` si falla. */
export const apiPagesOf = async (id: string, version?: number): Promise<readonly (readonly string[])[] | undefined> => {
  const started = await startSession(TENANT_A, DEMO.gestor);
  if (started.session === undefined) return undefined;
  const content = await call('GET', `/documents/${id}/content`, { tenant: TENANT_A, token: started.session.accessToken, ...(version === undefined ? {} : { query: `version=${version}` }) });
  const pages = (content.body as { readonly pages?: unknown } | null)?.pages;
  return Array.isArray(pages) ? (pages as string[][]) : undefined;
};

/** Estado de carga de la lista leído en una sola lectura del navegador: filas de carga y `aria-busy` del mismo instante. */
export interface LoadingSnapshot {
  readonly skeleton: number;
  readonly busy: string | undefined;
}

export const loadingSnapshot = (page: Page): Promise<LoadingSnapshot> =>
  safe<LoadingSnapshot>(
    () =>
      page.evaluate(
        ([pageId, skeletonId]: readonly string[]) => {
          const root = document.querySelector(`[data-testid="${pageId}"]`);
          if (root === null) return { skeleton: -1, busy: undefined };
          const busy = root.querySelector('[aria-busy]');
          return { skeleton: root.querySelectorAll(`[data-testid="${skeletonId}"]`).length, busy: busy?.getAttribute('aria-busy') ?? undefined };
        },
        [DOCUMENTOS_TESTIDS.DOCUMENTS_PAGE, PROGRAMAS_TESTIDS.SKELETON_ROW],
      ),
    { skeleton: -1, busy: undefined },
  );
