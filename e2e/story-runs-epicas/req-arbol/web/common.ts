import type { Download, Locator, Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { adminCredentials } from '../../../story-runs/support/api';
import { DEMO, TENANT_A, type Credentials } from '../../../story-runs/support/prepare';
import { REQUISITOS_DYNAMIC_TESTIDS, REQUISITOS_TESTIDS } from '../../../../packages/shared/src/testids';
import { ACTION, CEILING_MS, isVisible, runSteps, safe, waitUntil, type Step } from '../../support/browser';
import { check, preparationFailedWeb, sleep, type Check } from '../../support/checks';
import { outcome, type BrowserRowHandler, type Outcome } from '../../core/framework';

// Piezas comunes de las filas web de EP-REQ-ARBOL (escritorio 1440 px; diseño responsive 390 px, por debajo de 1024). Los localizadores son
// de rol y de nombre accesible; los ids de prueba solo donde la pantalla no ofrece otro rastro (recuento, cifras, avisos, cabecera del árbol
// oculta a lectores de pantalla, botón de descarga). Toda acción sobre un elemento de la historia pasa por `interact`: si falla, la nota
// dice si el elemento no existe, si lo tapa otro o si recibe el clic pero la acción no ocurre.

/** Ventanas de la historia («1440 px» y «390 px»). Cualquier otro texto LANZA al consultarlo. */
export const WINDOW: ReadonlyMap<string, { readonly width: number; readonly height: number }> = new Map([
  ['1440 px', { width: 1440, height: 900 }],
  ['390 px', { width: 390, height: 844 }],
]);

export const LOGIN_URL = `/login?tenant=${TENANT_A}`;
export const CSV_NAME = 'sigpro-requisitos.csv';
/** Nota que se añade a cada fila web: la preferencia de cookies se fija por adelantado, como en el piloto. */
export const COOKIE_NOTE = 'La prueba fija la preferencia de cookies (sigpro.cookies = accepted) antes de abrir la app, como el piloto; el aviso de cookies no se ejerce aquí.';

/**
 * Envuelve una fila web: si la pantalla no se asentó al abrirla, la fila es una preparación fallida (sin comprobar nada sobre una pantalla
 * a medias); un «discrepa» sin nota recibe lo observado como nota; y se añade la nota de cookies.
 */
export const onWeb =
  (handler: BrowserRowHandler): BrowserRowHandler =>
  async (row, fixtures) => {
    const result = await handler(row, fixtures);
    const opened = fixtures === undefined ? undefined : openFailures.get(fixtures.page);
    if (opened !== undefined) return preparationFailedWeb(row.resolvedSteps.filter((step) => /^(Entonces|Y) /.test(step)).join('; '), opened);
    return withNotes(result, COOKIE_NOTE);
  };

/** Añade una nota común al resultado y, si difiere de la historia, lo observado como nota (nunca un veredicto sin explicación). */
export const withNotes = (result: Outcome, common: string): Outcome => {
  const base = result.verdict === 'discrepa' && result.note === undefined ? { ...result, note: `La app no cumple lo que dice la historia: ${result.observed}` } : result;
  return { ...base, note: base.note === undefined ? common : `${base.note} ${common}` };
};

/** Fallo al abrir una ruta (no se asienta la pantalla): la fila entera es una preparación fallida, con este motivo. */
export const openFailures = new WeakMap<Page, string>();

/** Recuento real de requisitos: «N de M requisitos» (no «…» ni vacío). */
const COUNT_SHAPE = /^\d+ de \d+ requisitos$/;

/** Fija SOLO la preferencia de cookies: el aviso tapa zonas de la página y no es una sesión. */
const fixCookiePreference = (): void => {
  try {
    localStorage.setItem('sigpro.cookies', 'accepted');
  } catch {
    // sin almacenamiento: no hay preferencia que fijar
  }
};

// --- Cuentas e inicio de sesión por el formulario ---------------------------------------------------------------------------------------------

/** Cuentas de las filas (celda «cuenta» o «gestor» por defecto). Ninguna pasa por el segundo factor. */
export const ACCOUNTS: ReadonlyMap<string, Credentials> = new Map<string, Credentials>([
  ['gestor@sigpro.test', DEMO.gestor],
  ['consultor@sigpro.test', DEMO.consultor],
  ['auditor@sigpro.test', DEMO.auditor],
  ['alumno01@sigpro.lab', adminCredentials(TENANT_A)],
]);

/** Registro de avisos instalado ANTES de cargar la app: cada aparición de `toast-*` con su marca de tiempo. */
export const TOAST_KEY = '__sigproToasts';

/** Se ejecuta en el navegador antes de cargar la app. No usa variables de fuera. */
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

export interface ToastEntry {
  readonly tone: string;
  readonly title: string;
  readonly body: string;
  readonly at: number;
}

/** Avisos registrados en la página (la historia no fija plazos: el aviso dura 3 s y se registra al aparecer). */
export const toastLog = (page: Page): Promise<readonly ToastEntry[]> =>
  safe(() => page.evaluate((key: string) => ((window as unknown as Record<string, unknown>)[key] as ToastEntry[] | undefined) ?? [], TOAST_KEY), []);

/** Espera (con techo) a un aviso con ese tono, título y cuerpo; devuelve lo registrado con ese tono y título. */
export const waitToast = async (page: Page, tone: string, title: string, body?: string): Promise<{ readonly found: boolean; readonly seen: readonly ToastEntry[] }> => {
  const matches = (entries: readonly ToastEntry[]): boolean => entries.some((entry) => entry.tone === tone && entry.title === title && (body === undefined || entry.body === body));
  const waited = await waitUntil(async () => matches(await toastLog(page)));
  const entries = await toastLog(page);
  return { found: waited.reached, seen: entries.filter((entry) => entry.tone === tone) };
};

// --- Preparación y navegación -----------------------------------------------------------------------------------------------------------------

/** Abre /login?tenant=alumno01 en un contexto sin sesión, escribe la cuenta y pulsa «Entrar»; termina en /programs. */
export const signIn = (page: Page, credentials: Credentials, width: string): Promise<string | undefined> => {
  const size = WINDOW.get(width);
  const steps: Step[] = [
    ['fijar la preferencia de cookies', () => page.context().addInitScript(fixCookiePreference)],
    ['instalar el registro de avisos', () => page.context().addInitScript(recordToasts, TOAST_KEY)],
    ['fijar el ancho de la ventana', () => page.setViewportSize(size ?? { width: 1440, height: 900 })],
    ['abrir /login?tenant=alumno01', () => page.goto(LOGIN_URL, { timeout: CEILING_MS })],
    ['escribir el correo', () => page.getByLabel('Correo electrónico', { exact: true }).fill(credentials.email, ACTION)],
    ['escribir la contraseña', () => page.getByLabel('Contraseña', { exact: true }).fill(credentials.password, ACTION)],
    ['pulsar «Entrar»', () => page.getByRole('button', { name: 'Entrar', exact: true }).click(ACTION)],
    ['llegar a /programs', () => page.waitForURL(/\/programs/, { timeout: CEILING_MS })],
  ];
  return runSteps(steps);
};

/** Abre una ruta de la app con la sesión ya iniciada y espera a que la lista de requisitos (o su estado) se asiente. */
export const openPath = async (page: Page, path: string): Promise<string | undefined> => {
  const failure = await runSteps([
    [`abrir ${path}`, () => page.goto(path, { timeout: CEILING_MS })],
    [
      'ver el árbol o su estado',
      async () => {
        if (!(await settled(page))) throw new Error('la pantalla de requisitos no se asienta');
      },
    ],
  ]);
  if (failure !== undefined) openFailures.set(page, failure);
  return failure;
};

/** La lista ya no está cargando: un recuento real («N de M requisitos»), o un estado de error o de no encontrado. */
export const settled = async (page: Page): Promise<boolean> =>
  (
    await waitUntil(
      async () =>
        COUNT_SHAPE.test(norm(await countText(page)) ?? '') || (await isVisible(page.getByTestId(REQUISITOS_TESTIDS.REQUIREMENTS_NOT_FOUND))) || (await isVisible(page.getByTestId(REQUISITOS_TESTIDS.REQUIREMENTS_ERROR))),
    )
  ).reached;

/** Caja de un elemento tras esperar (con plazo) a que sea visible; `null` si no aparece. */
export const boxOf = async (target: Locator): Promise<{ readonly x: number; readonly y: number } | null> => {
  await target
    .first()
    .waitFor({ state: 'visible', timeout: 2000 })
    .catch(() => undefined);
  return target
    .first()
    .boundingBox()
    .catch(() => null);
};

// --- Lecturas --------------------------------------------------------------------------------------------------------------------------------

/** Espacios tipográficos (U+00A0 y U+202F) equivalentes a un espacio: solo se normalizan ellos, nunca el número ni el símbolo. */
export const norm = (text: string | undefined): string | undefined => text?.replace(/[\u00A0\u202F]/g, ' ').trim();

/** Texto visible de un elemento (o `undefined` si no se puede leer). */
export const textOf = (target: Locator): Promise<string | undefined> => safe(async () => norm(await target.first().innerText({ timeout: 2000 })), undefined);

/** Texto de un elemento de una lista de nombres: el texto de cada uno, en orden. */
export const textsOf = (target: Locator): Promise<readonly string[]> => safe(() => target.allInnerTexts(), [] as string[]).then((texts) => texts.map((text) => norm(text) ?? ''));

/** Recuento «N de M requisitos» (o «…» mientras carga; `undefined` si no se puede leer). */
export const countText = (page: Page): Promise<string | undefined> => textOf(page.getByTestId(REQUISITOS_TESTIDS.REQUIREMENTS_COUNT));

/** Una fila del árbol: código (del nombre accesible «REQ-001 título»), nivel, `aria-expanded` y su posición. */
export interface TreeRow {
  readonly code: string;
  readonly level: string | undefined;
  readonly expanded: string | undefined;
}

/** Filas visibles del árbol en orden. Un nombre que no empieza por un código se devuelve tal cual (y no casa con ningún código). */
export const treeRows = async (page: Page): Promise<readonly TreeRow[]> => {
  const items = await safe(() => page.getByRole('treeitem').all(), []);
  return Promise.all(
    items.map(async (item): Promise<TreeRow> => {
      const label = (await safe(() => item.getAttribute('aria-label', { timeout: 2000 }), null)) ?? '';
      const level = await safe(() => item.getAttribute('aria-level', { timeout: 2000 }), null);
      const expanded = await safe(() => item.getAttribute('aria-expanded', { timeout: 2000 }), null);
      return { code: /^(REQ-\d{3})/.exec(label)?.[1] ?? label, level: level ?? undefined, expanded: expanded ?? undefined };
    }),
  );
};

/** Códigos visibles del árbol, en orden. */
export const visibleCodes = async (page: Page): Promise<readonly string[]> => (await treeRows(page)).map((row) => row.code);

/** Fila del árbol por su código (nombre accesible que empieza por el código y un espacio). */
export const treeItem = (page: Page, code: string): Locator => page.getByRole('treeitem', { name: new RegExp(`^${code} `) });

/** Botón de plegado de una fila («Contraer REQ-015» / «Expandir REQ-015»). */
export const toggleOf = (page: Page, label: string): Locator => page.getByRole('button', { name: label, exact: true });

/** Botón que abre el detalle desde el título de la fila (testid de la fila: el título no tiene otro rastro propio). */
export const titleButtonOf = (page: Page, code: string): Locator => page.getByTestId(REQUISITOS_DYNAMIC_TESTIDS.REQUIREMENT_OPEN(code));

/** Lista de códigos separados por «, » y « y » (la forma en que las celdas escriben varios códigos). */
export const listOf = (text: string): readonly string[] => (text === '(vacío)' || text === '(ninguno)' ? [] : text.split(' y ').flatMap((part) => part.split(', ')));

export const sameList = (actual: readonly string[], expected: readonly string[]): boolean => actual.length === expected.length && actual.every((code, index) => code === expected[index]);

/** Mismo conjunto de códigos (sin importar el orden). */
export const sameSet = (actual: readonly string[], expected: readonly string[]): boolean => actual.length === expected.length && expected.every((code) => actual.includes(code));

/** Un valor observado frente a lo que la historia espera, en una frase cada uno. */
export const eq = (label: string, actual: string | undefined, expected: string): Check =>
  check(actual === expected, `${label} «${expected}»`, `${label} «${actual ?? '(no legible)'}»`);

/** Texto de una lista para las frases («(ninguno)» si está vacía). */
export const describe = (codes: readonly string[]): string => (codes.length === 0 ? '(ninguno)' : codes.join(', '));

/** Un nodo visible (o no) con lectura estricta: sin elemento, no se ve; con más de uno, la lectura es ambigua y LANZA. */
export const seenStrict = async (target: Locator, label: string): Promise<Check> => {
  const found = await target.count();
  if (found > 1) throw new Error(`lectura ambigua de ${label}: ${found} elementos`);
  const seen = found === 1 && (await target.isVisible());
  return check(seen, `ve ${label}`, seen ? `ve ${label}` : `no ve ${label}`);
};

// --- Acciones con diagnóstico -----------------------------------------------------------------------------------------------------------------

export interface Blocked {
  readonly message: string;
  readonly note: string;
}

/** Quién recibe el clic en el centro de un elemento, y si ese elemento es el propio objetivo o uno de sus descendientes. */
const hitAtCenter = (node: Element): { readonly hit: string; readonly inside: boolean } => {
  const box = node.getBoundingClientRect();
  const hit = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
  if (hit === null) return { hit: '(ninguno)', inside: false };
  const testid = hit.getAttribute('data-testid');
  const name = `${hit.tagName.toLowerCase()}${testid === null ? '' : `[data-testid="${testid}"]`}`;
  return { hit: name, inside: hit === node || node.contains(hit) };
};

/** Diagnóstico de un fallo: primeras líneas del error, «intercepts pointer events» y quién recibe el clic. */
const describeFailure = async (target: Locator, label: string, error: unknown): Promise<Blocked> => {
  const lines = (error instanceof Error ? error.message : String(error)).split('\n').map((line) => line.trim()).filter((line) => line !== '');
  const intercept = lines.find((line) => line.includes('intercepts pointer events'));
  const present = (await safe(() => target.count(), 0)) > 0;
  const message = `no se pudo ${label}: ${lines.slice(0, 3).join(' · ')}${intercept === undefined ? '' : ` · ${intercept}`}`;
  if (!present) return { message, note: 'La historia nombra un elemento que la pantalla no ofrece (no existe con ese nombre).' };
  const probe = await safe<{ readonly hit: string; readonly inside: boolean } | undefined>(() => target.first().evaluate(hitAtCenter, undefined, { timeout: 2000 }), undefined);
  if (probe === undefined) return { message: `${message} · recibe el clic: (no se pudo leer)`, note: 'el elemento existe pero no se pudo comprobar qué lo tapa' };
  const note = probe.inside ? 'el elemento existe y recibe el clic en su centro, pero la acción no se completó (ver el mensaje de Playwright)' : `el elemento existe pero otro lo tapa: ${probe.hit}`;
  return { message: `${message} · recibe el clic: ${probe.hit}`, note };
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
export const actionFailed = (expected: string, blocked: Blocked): Outcome => outcome(false, expected, blocked.message, { note: blocked.note });

// --- Respuestas de la API interceptadas (la prueba fija el retardo o el fallo; la historia lo da como dato) -------------------------------

const listPath = (code: string): string => `/api/programs/${code}/requirements`;

/** Demora la respuesta de GET /api/programs/:code/requirements (la historia da la espera como dato). */
export const delayList = (page: Page, code: string, ms: number): Promise<unknown> =>
  page.route(
    (url) => url.pathname === listPath(code),
    async (route) => {
      if (route.request().method() !== 'GET') return route.continue();
      await sleep(ms);
      return route.continue();
    },
  );

/** Responde `status` a GET /api/programs/:code/requirements, a todas las peticiones o solo a las primeras `times`, con cabeceras CORS. */
export const failList = (page: Page, code: string, status: number, times: number | 'always'): Promise<unknown> => {
  let failed = 0;
  return page.route(
    (url) => url.pathname === listPath(code),
    async (route) => {
      const request = route.request();
      if (request.method() !== 'GET' || (times !== 'always' && failed >= times)) return route.continue();
      failed += 1;
      const origin = request.headers().origin ?? '*';
      return route.fulfill({
        status,
        contentType: 'application/json',
        headers: { 'access-control-allow-origin': origin, 'access-control-expose-headers': '*' },
        body: JSON.stringify({ statusCode: status, error: 'Error', message: 'Error provocado por la prueba' }),
      });
    },
  );
};

/** Lectura del CSV descargado (la primera descarga tras armar el evento). */
export const csvOf = async (download: Download | undefined): Promise<{ readonly name: string; readonly text: string } | undefined> => {
  if (download === undefined) return undefined;
  const path = await download.path();
  if (path === null) return undefined;
  return { name: download.suggestedFilename(), text: await readFile(path, 'utf8') };
};

/** Espera (con techo) la descarga que dispara una acción; el evento se arma ANTES de la acción por quien lo llama. */
export const armDownload = (page: Page): Promise<Download | undefined> => page.waitForEvent('download', { timeout: CEILING_MS }).catch(() => undefined);

/** Dato de una fila: el valor de la celda entre «…» (texto de la interfaz) o tal cual (dato). */
export const quotedOr = (cell: string): string => (cell.startsWith('«') ? (/^«(.+)»$/.exec(cell)?.[1] ?? cell) : cell);

/** Estado del árbol antes de la acción (para comprobar «no pasa nada» con una comparación, no con un texto fijo). */
export const snapshot = async (page: Page): Promise<{ readonly codes: readonly string[]; readonly expanded: readonly string[] }> => {
  const rows = await treeRows(page);
  return { codes: rows.map((row) => row.code), expanded: rows.map((row) => `${row.code}:${row.expanded ?? '-'}`) };
};

/** Alta de la comparación de un estado antes y después (listas y `aria-expanded` idénticos). */
export const sameSnapshot = (before: { readonly codes: readonly string[]; readonly expanded: readonly string[] }, after: { readonly codes: readonly string[]; readonly expanded: readonly string[] }): boolean =>
  sameList(before.codes, after.codes) && sameList(before.expanded, after.expanded);
