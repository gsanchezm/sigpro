import type { Locator, Page } from '@playwright/test';
import { DEMO, TENANT_A } from '../../../story-runs/support/prepare';
import { PROGRAMAS_TESTIDS } from '../../../../packages/shared/src/testids';
import { ACTION, CEILING_MS, attrOf, isVisible, runSteps, safe, textOf, waitUntil } from '../../support/browser';
import { check, sleep, type Check } from '../../support/checks';
import { outcome, type BrowserRowHandler, type Outcome } from '../../core/framework';

// Piezas comunes de las filas web de EP-PROG-LISTA (escritorio 1440 px; diseño responsive 390 px, por debajo de 1024). Los
// localizadores son de rol y de nombre; solo donde la pantalla no ofrece otro rastro (recuento, filas de carga, bloque vacío)
// se usa un id de prueba de testids.ts. Toda acción sobre un elemento de la historia pasa por `interact`/`interactAndAwait`: si
// falla, registra si el elemento existe, qué recibe el clic en su centro y la geometría, para que la nota distinga «no existe»
// de «existe pero otro elemento lo tapa».

/** Diseño de la fila: «escritorio» (≥ 1024 px) o «responsive» (< 1024 px). */
export type Layout = 'escritorio' | 'responsive';

export const LAYOUTS: ReadonlyMap<string, Layout> = new Map<string, Layout>([
  ['escritorio', 'escritorio'],
  ['responsive', 'responsive'],
]);

export const viewportOf = (layout: Layout): { readonly width: number; readonly height: number } => (layout === 'escritorio' ? { width: 1440, height: 900 } : { width: 390, height: 844 });

export const LOGIN_URL = `/login?tenant=${TENANT_A}`;
export const PROGRAMS_PATH = '/programs';
const CODE = /^PRG-\d{3}/;

// --- Preferencia de cookies (no es una sesión) y nota de cada fila web ----------------------------------------------------

/** Nota que se añade a cada fila web: la preferencia de cookies se fija por adelantado. */
export const COOKIE_NOTE = 'La prueba fija la preferencia de cookies (sigpro.cookies = accepted) antes de abrir la app, como el piloto; el aviso de cookies no se ejerce aquí.';

/** Envuelve una fila web para añadir la nota de cookies (las filas web fijan esa preferencia en `signIn`). */
export const onWeb =
  (handler: BrowserRowHandler): BrowserRowHandler =>
  async (row, fixtures) => {
    const result = await handler(row, fixtures);
    return { ...result, note: result.note === undefined ? COOKIE_NOTE : `${result.note} ${COOKIE_NOTE}` };
  };

/**
 * Fija SOLO la preferencia de cookies (no es una sesión, como en el piloto): el aviso de cookies tapa zonas de la página y, sin
 * esto, una acción podría fallar por otra razón. No escribe tenant, tema ni idioma.
 */
const fixCookiePreference = (): void => {
  try {
    localStorage.setItem('sigpro.cookies', 'accepted');
  } catch {
    // sin almacenamiento: no hay preferencia que fijar
  }
};

// --- Acciones con diagnóstico --------------------------------------------------------------------------------------------

/** Resultado de una acción fallida: si el elemento existe, lo observado y la nota de la fila. */
export interface Blocked {
  readonly present: boolean;
  readonly message: string;
  readonly note: string;
}

interface Rect {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

interface Probe {
  readonly target: string;
  readonly rect: Rect;
  readonly center: readonly [number, number];
  readonly hit: string;
  readonly inside: boolean;
}

/** Se ejecuta en el navegador: describe el elemento y el que recibe el clic en su centro. No usa variables de fuera. */
const probeElement = (node: Element): Probe => {
  const describe = (element: Element): string => {
    const testid = element.getAttribute('data-testid');
    const aria = element.getAttribute('aria-label');
    const text = (element.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 40);
    return `${element.tagName.toLowerCase()}${testid === null ? '' : `[data-testid="${testid}"]`}${aria === null ? '' : ` aria-label="${aria}"`}${text === '' ? '' : ` «${text}»`}`;
  };
  const box = node.getBoundingClientRect();
  const cx = box.left + box.width / 2;
  const cy = box.top + box.height / 2;
  const hit = document.elementFromPoint(cx, cy);
  return {
    target: describe(node),
    rect: { x: Math.round(box.left), y: Math.round(box.top), w: Math.round(box.width), h: Math.round(box.height) },
    center: [Math.round(cx), Math.round(cy)],
    hit: hit === null ? '(ninguno)' : describe(hit),
    inside: hit !== null && (hit === node || node.contains(hit)),
  };
};

const fmtRect = (rect: Rect | undefined): string => (rect === undefined ? '(sin caja)' : `${rect.x},${rect.y} ${rect.w}×${rect.h}`);

const rectOf = (box: { readonly x: number; readonly y: number; readonly width: number; readonly height: number } | null): Rect | undefined =>
  box === null ? undefined : { x: Math.round(box.x), y: Math.round(box.y), w: Math.round(box.width), h: Math.round(box.height) };

/** Lo que se observa de un clic o escritura que falla: índice, primeras líneas del error, geometría y lo que recibe el clic. */
const describeFailure = async (page: Page, target: Locator, label: string, index: number, error: unknown): Promise<Blocked> => {
  const text = error instanceof Error ? error.message : String(error);
  const lines = text.split('\n').map((line) => line.trim()).filter((line) => line !== '');
  const head = lines.slice(0, 3).join(' · ');
  const intercept = lines.find((line) => line.includes('intercepts pointer events'));
  const present = (await safe(() => target.count(), 0)) > 0;
  const message = `no se pudo ${label} (intento ${index}): ${head}${intercept === undefined ? '' : ` · llamada: ${intercept}`}`;
  if (!present) return { present, message, note: 'La historia nombra un elemento que la pantalla no ofrece.' };
  const probe = await safe<Probe | undefined>(() => target.first().evaluate(probeElement), undefined);
  const newProgram = await safe<Rect | undefined>(async () => rectOf(await page.getByRole('button', { name: /Nuevo programa/ }).first().boundingBox({ timeout: 500 })), undefined);
  const scroll = await safe<{ readonly y: number; readonly max: number } | undefined>(() => page.evaluate(() => ({ y: window.scrollY, max: document.documentElement.scrollHeight - window.innerHeight })), undefined);
  const scrollText = scroll === undefined ? '(sin leer)' : `${scroll.y} de ${scroll.max}`;
  if (probe === undefined) {
    return { present, message: `${message} · elemento: no se pudo leer su geometría · scrollY ${scrollText}`, note: 'el elemento existe pero no se pudo comprobar qué lo tapa' };
  }
  const geometry = `elemento ${fmtRect(probe.rect)} · centro (${probe.center[0]}, ${probe.center[1]}) recibe: ${probe.hit} · «+ Nuevo programa» ${fmtRect(newProgram)} · scrollY ${scrollText}`;
  const note = probe.inside
    ? 'el elemento existe y recibe el clic en su centro, pero la acción no se completó (ver el mensaje de Playwright)'
    : `el botón existe pero otro elemento lo tapa: ${probe.hit}`;
  return { present, message: `${message} · ${geometry}`, note };
};

/** Ejecuta una acción sobre un elemento de la historia; si falla, devuelve el diagnóstico (no lanza). */
export const interact = async (page: Page, target: Locator, label: string, run: (element: Locator) => Promise<unknown>, index = 1): Promise<Blocked | undefined> => {
  try {
    await run(target);
    return undefined;
  } catch (error) {
    return describeFailure(page, target, label, index, error);
  }
};

/**
 * Como `interact`, pero espera además la respuesta de GET /api/programs que provoca la acción (la lista ya está al día cuando vuelve).
 * Si la acción falla, no espera esa respuesta: el diagnóstico sale enseguida.
 */
export const interactAndAwait = async (page: Page, target: Locator, label: string, run: (element: Locator) => Promise<unknown>, index = 1): Promise<Blocked | undefined> => {
  const response = page.waitForResponse((reply) => new URL(reply.url()).pathname === '/api/programs' && reply.request().method() === 'GET', { timeout: CEILING_MS }).catch(() => undefined);
  const failure = await interact(page, target, label, run, index);
  if (failure !== undefined) return failure;
  await response;
  return undefined;
};

/** Una acción fallida con su diagnóstico: el Outcome usa la nota que distingue «no existe» de «existe pero no es pulsable». */
export const actionFailed = (expected: string, blocked: Blocked): Outcome => outcome(false, expected, blocked.message, { note: blocked.note });

/** Un paso que no es una acción sobre un elemento (navegación, teclado): fallo genérico con su mensaje. */
export const actionMissing = (expected: string, failure: string): Outcome =>
  outcome(false, expected, failure, { note: 'La historia nombra un elemento que la pantalla no ofrece, o la acción no se completó (ver el mensaje).' });

// --- Preparación ---------------------------------------------------------------------------------------------------------

/** Espera a que la lista esté montada y asentada; si no aparece, lanza (la preparación no se dio por buena). */
const settledOrThrow = async (page: Page, layout: Layout): Promise<void> => {
  if (!(await waitSettled(page, layout))) throw new Error('la lista no aparece');
};

/** Preparación de cada fila: entra gestor@sigpro.test desde /login de alumno01 y espera a que la lista de Programas se cargue. */
export const signIn = (page: Page, layout: Layout): Promise<string | undefined> =>
  runSteps([
    ['fijar la preferencia de cookies', () => page.context().addInitScript(fixCookiePreference)],
    ['fijar el ancho de la ventana', () => page.setViewportSize(viewportOf(layout))],
    ['abrir /login?tenant=alumno01', () => page.goto(LOGIN_URL, { timeout: CEILING_MS })],
    ['escribir el correo', () => page.getByLabel('Correo electrónico', { exact: true }).fill(DEMO.gestor.email, ACTION)],
    ['escribir la contraseña', () => page.getByLabel('Contraseña', { exact: true }).fill(DEMO.gestor.password, ACTION)],
    ['pulsar «Entrar»', () => page.getByRole('button', { name: 'Entrar', exact: true }).click(ACTION)],
    ['llegar a /programs', () => page.waitForURL(/\/programs/, { timeout: CEILING_MS })],
    ['ver la lista de programas', () => settledOrThrow(page, layout)],
  ]);

/** Abre una dirección de la app (carga completa) y espera a que la lista se asiente. */
export const openPath = (page: Page, layout: Layout, path: string): Promise<string | undefined> =>
  runSteps([
    [`abrir ${path}`, () => page.goto(path, { timeout: CEILING_MS })],
    ['ver la lista de programas', () => settledOrThrow(page, layout)],
  ]);

// --- Localizadores -------------------------------------------------------------------------------------------------------

/** Tabla de escritorio o lista de tarjetas del responsive (la que está montada en ese diseño). */
export const listOf = (page: Page, layout: Layout): Locator => (layout === 'escritorio' ? page.getByRole('table') : page.getByRole('list', { name: 'Programas', exact: true }));

/** Buscador de la lista: «Búsqueda global» de la cabecera en escritorio; «Buscar programas» de la página en responsive. */
export const searchBox = (page: Page, layout: Layout): Locator => page.getByRole('searchbox', { name: layout === 'escritorio' ? 'Búsqueda global' : 'Buscar programas', exact: true });

/** Recuento «inicio–fin de total» (id de prueba: el texto no tiene rol propio). */
export const recountOf = (page: Page): Locator => page.getByTestId(PROGRAMAS_TESTIDS.PROGRAMS_COUNT);
export const skeletonRows = (page: Page): Locator => page.getByTestId(PROGRAMAS_TESTIDS.SKELETON_ROW);
/** Bloque «Sin programas» (id de prueba: el bloque vacío es el único contenedor que lo agrupa). */
export const emptyBlock = (page: Page): Locator => page.getByTestId(PROGRAMAS_TESTIDS.PROGRAMS_EMPTY);
export const clearButton = (page: Page): Locator => page.getByRole('button', { name: 'Limpiar filtros', exact: true });
export const ownerCombobox = (page: Page): Locator => page.getByRole('combobox', { name: 'Responsable', exact: true });
export const statusSelect = (page: Page): Locator => page.getByRole('combobox', { name: 'Estado', exact: true });

export const pageButton = (page: Page, n: number): Locator => page.getByRole('button', { name: `Página ${n}`, exact: true });
export const prevButton = (page: Page): Locator => page.getByRole('button', { name: 'Página anterior', exact: true });
export const nextButton = (page: Page): Locator => page.getByRole('button', { name: 'Página siguiente', exact: true });

/** Un elemento: exactamente uno y visible. Más de uno es lectura ambigua y LANZA; sin elemento, no se ve. */
export const strictSeen = async (target: Locator): Promise<boolean> => {
  const found = await target.count();
  if (found > 1) throw new Error(`lectura ambigua: ${found} elementos`);
  return found === 1 && (await target.isVisible());
};

// --- Espera y lectura ----------------------------------------------------------------------------------------------------

/** La lista está montada y ya no muestra filas de carga (la primera respuesta llegó, sea buena o de error). */
export const waitSettled = async (page: Page, layout: Layout): Promise<boolean> =>
  (
    await waitUntil(async () => (await isVisible(listOf(page, layout))) && (await safe(() => skeletonRows(page).count(), 1)) === 0)
  ).reached;

/** Códigos de los programas que se ven, en el orden de la pantalla (tabla o tarjetas). */
export const listedCodes = async (page: Page, layout: Layout): Promise<readonly string[]> => {
  const texts = await listOf(page, layout).getByRole('link', { name: CODE }).allTextContents();
  return texts.map((text) => CODE.exec(text.trim())?.[0]).filter((code): code is string => code !== undefined);
};

export const recountText = (page: Page): Promise<string | undefined> => textOf(recountOf(page));

export const sameCodes = (actual: readonly string[], expected: readonly string[]): boolean => actual.length === expected.length && actual.every((code, index) => code === expected[index]);

/** Texto de una lista de códigos para los mensajes («(ningún programa)» si está vacía). */
export const describeCodes = (codes: readonly string[]): string => (codes.length === 0 ? '(ningún programa)' : codes.join(', '));

/** Espera (con techo) a que la lista muestre `codes` y, si se da, el recuento; devuelve lo que se ve al final. */
export const waitForList = async (page: Page, layout: Layout, codes: readonly string[], count?: string): Promise<{ readonly codes: readonly string[]; readonly count: string | undefined }> => {
  await waitUntil(async () => sameCodes(await listedCodes(page, layout), codes) && (count === undefined || (await recountText(page)) === count));
  return { codes: await listedCodes(page, layout), count: await recountText(page) };
};

/** Un «Entonces» de la lista: los códigos visibles son exactamente los esperados (o ninguno, con «(ningún programa)»). */
export const listCheck = (shown: readonly string[], expected: readonly string[]): Check =>
  check(sameCodes(shown, expected), `la lista muestra ${describeCodes(expected)}`, `la lista muestra ${describeCodes(shown)}`);

/** Un «Entonces» del recuento: el texto visible igual al esperado. */
export const countCheck = (count: string | undefined, expected: string): Check => check(count === expected, `el recuento dice «${expected}»`, `el recuento dice «${count ?? '(sin recuento)'}»`);

/**
 * Lista esperada vacía: además de no haber filas, debe verse el bloque «Sin programas» (un estado de carga o de error sin filas no
 * cumple). Para listas no vacías no añade nada.
 */
export const emptyBlockChecks = async (page: Page, expected: readonly string[]): Promise<readonly Check[]> => {
  if (expected.length > 0) return [];
  const seen = await strictSeen(emptyBlock(page));
  return [check(seen, 'se ve el bloque «Sin programas»', seen ? 'se ve el bloque «Sin programas»' : 'no se ve el bloque «Sin programas»')];
};

// --- Acciones de la lista -------------------------------------------------------------------------------------------------

/** Escribe en el buscador de la lista y espera la respuesta (el texto llega a la URL tras 250 ms). */
export const typeSearch = (page: Page, layout: Layout, text: string, index = 1): Promise<Blocked | undefined> =>
  interactAndAwait(page, searchBox(page, layout), `escribir «${text}» en el buscador de la lista`, (element) => element.fill(text, ACTION), index);

/** Elige un estado en «Estado» y espera la respuesta. */
export const chooseStatus = (page: Page, label: string): Promise<Blocked | undefined> =>
  interactAndAwait(page, statusSelect(page), `elegir «${label}» en «Estado»`, (element) => element.selectOption({ label }, ACTION));

/** Escribe una fecha en «Inicio desde» o «Fin hasta» y espera la respuesta (una cadena vacía quita el filtro). */
export const fillDate = (page: Page, campo: string, fecha: string): Promise<Blocked | undefined> =>
  interactAndAwait(page, page.getByLabel(campo, { exact: true }), `escribir «${fecha}» en «${campo}»`, (element) => element.fill(fecha, ACTION));

/** Elige una persona en «Responsable»: escribe la búsqueda y pulsa la opción (su nombre accesible lleva el recuento de programas). */
export const pickOwner = async (page: Page, search: string, persona: string): Promise<Blocked | undefined> => {
  const typed = await interact(page, ownerCombobox(page), 'escribir en «Responsable»', (element) => element.fill(search, ACTION));
  if (typed !== undefined) return typed;
  return interactAndAwait(page, page.getByRole('listbox', { name: 'Responsable', exact: true }).getByRole('option', { name: persona }), `elegir «${persona}»`, (element) => element.click(ACTION));
};

/** Abre el panel «Filtros» del responsive. Si el botón se pulsa pero no aparece el panel con ese nombre, también es un fallo. */
export const openFilters = async (page: Page): Promise<Blocked | undefined> => {
  const clicked = await interact(page, page.getByRole('button', { name: 'Filtros', exact: true }), 'pulsar «Filtros»', (element) => element.click(ACTION));
  if (clicked !== undefined) return clicked;
  const dialog = page.getByRole('dialog', { name: 'Filtros', exact: true });
  const opened = (await waitUntil(() => isVisible(dialog))).reached;
  return opened
    ? undefined
    : { present: true, message: 'se pulsó «Filtros» y no se abrió el diálogo «Filtros»', note: 'el botón «Filtros» existe y se pulsó, pero no se abrió el panel con ese nombre' };
};

/** Cierra el panel «Filtros» con «Listo». */
export const closeFilters = (page: Page): Promise<Blocked | undefined> =>
  interact(page, page.getByRole('button', { name: 'Listo', exact: true }), 'pulsar «Listo»', (element) => element.click(ACTION));

// --- Columnas y filas de la tabla de escritorio ---------------------------------------------------------------------------

/** Cabecera de una columna ordenable (el nombre accesible empieza por el texto de la columna). */
export const headerOf = (page: Page, name: string): Locator => page.getByRole('columnheader', { name: new RegExp(`^${name}`) });

/** Índice de una columna por el texto de su cabecera (-1 si la tabla no la tiene). */
export const columnIndex = async (page: Page, name: string): Promise<number> => {
  const headers = await page.getByRole('columnheader').allTextContents();
  return headers.findIndex((text) => text.trim().startsWith(name));
};

export const rowOf = (page: Page, code: string): Locator => page.getByRole('row').filter({ has: page.getByRole('link', { name: code, exact: true }) });

/** Textos de las celdas de una fila, en orden (sin la transformación de CSS: el contenido tal cual). */
export const cellsOf = async (row: Locator): Promise<readonly string[]> => (await row.getByRole('cell').allTextContents()).map((text) => text.trim());

/** Tarjeta de un programa en el responsive (el `listitem` cuyo enlace empieza por el código). */
export const cardOf = (page: Page, code: string): Locator =>
  page.getByRole('list', { name: 'Programas', exact: true }).getByRole('listitem').filter({ has: page.getByRole('link', { name: new RegExp(`^${code}`) }) });

// --- Rutas de la prueba (demoras y errores provocados antes de abrir la lista) --------------------------------------------

/** Demora la respuesta de GET /api/programs (la prueba fija el retardo; la historia lo da como dato). */
export const delayPrograms = (page: Page, ms: number): Promise<unknown> =>
  page.route(
    (url) => url.pathname === '/api/programs',
    async (route) => {
      if (route.request().method() !== 'GET') return route.continue();
      await sleep(ms);
      return route.continue();
    },
  );

/**
 * Responde 500 a GET /api/programs: a todas las peticiones (`times` = 'always') o solo a las primeras `times`, y solo a las que
 * cumplen `match`. Las demás pasan a la red sin tocar.
 */
export const failPrograms = (page: Page, times: number | 'always', match: (url: URL) => boolean = () => true): Promise<unknown> => {
  let failed = 0;
  return page.route(
    (url) => url.pathname === '/api/programs',
    async (route) => {
      const request = route.request();
      if (request.method() !== 'GET' || !match(new URL(request.url())) || (times !== 'always' && failed >= times)) return route.continue();
      failed += 1;
      const origin = request.headers().origin ?? '*';
      return route.fulfill({
        status: 500,
        contentType: 'application/json',
        headers: { 'access-control-allow-origin': origin, 'access-control-expose-headers': '*' },
        body: JSON.stringify({ statusCode: 500, error: 'Internal Server Error', message: 'Error provocado por la prueba' }),
      });
    },
  );
};

// --- Comprobaciones -------------------------------------------------------------------------------------------------------

/** Un «Entonces» de visibilidad: el elemento se ve (o no) en ese momento. */
export const visibleCheck = async (target: Locator, what: string): Promise<Check> => {
  const seen = await isVisible(target);
  return check(seen, `ve ${what}`, seen ? `ve ${what}` : `no ve ${what}`);
};

/** Estado habilitado o deshabilitado de un botón (lectura fallida = no cumple). */
export const buttonState = async (target: Locator, expectEnabled: boolean, label: string): Promise<Check> => {
  const enabled = await safe(() => target.first().isEnabled({ timeout: 500 }), undefined);
  const wanted = expectEnabled ? 'habilitado' : 'deshabilitado';
  return check(enabled === expectEnabled, `«${label}» está ${wanted}`, `«${label}» está ${enabled === undefined ? '(sin leer)' : enabled ? 'habilitado' : 'deshabilitado'}`);
};

/** Atributo `aria-sort` de la cabecera de una columna, o `undefined` si no se puede leer. */
export const ariaSortOf = (page: Page, name: string): Promise<string | undefined> => attrOf(headerOf(page, name), 'aria-sort');

// --- Códigos de las celdas de la historia ---------------------------------------------------------------------------------

const EMPTY_CODES: ReadonlySet<string> = new Set(['(ninguno)', '(ningún programa)']);
const RANGE = /^(PRG-\d{3}) a (PRG-\d{3})$/;
const CODE_ONLY = /^PRG-\d{3}$/;

/** Códigos de una celda: «(ninguno)», «(ningún programa)», un rango «PRG-001 a PRG-010» o una lista «PRG-003, PRG-011». Otra forma lanza. */
export const codesOf = (text: string): readonly string[] => {
  if (EMPTY_CODES.has(text)) return [];
  const range = RANGE.exec(text);
  if (range?.[1] !== undefined && range[2] !== undefined) {
    const from = Number(range[1].slice(4));
    const to = Number(range[2].slice(4));
    return Array.from({ length: to - from + 1 }, (_, index) => `PRG-${String(from + index).padStart(3, '0')}`);
  }
  const list = text.split(', ');
  if (!list.every((code) => CODE_ONLY.test(code))) throw new Error(`celda sin interpretación: códigos «${text}»`);
  return list;
};
