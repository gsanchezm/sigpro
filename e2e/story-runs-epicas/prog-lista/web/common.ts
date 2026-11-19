import type { Locator, Page } from '@playwright/test';
import { DEMO, TENANT_A } from '../../../story-runs/support/prepare';
import { PROGRAMAS_TESTIDS } from '../../../../packages/shared/src/testids';
import { ACTION, CEILING_MS, attrOf, isVisible, runSteps, safe, textOf, waitUntil } from '../../support/browser';
import { check, sleep, type Check } from '../../support/checks';
import { outcome, type Outcome } from '../../core/framework';

// Piezas comunes de las filas web de EP-PROG-LISTA (escritorio 1440 px; diseño responsive 390 px, por debajo de 1024). Los
// localizadores son de rol y de nombre («Página siguiente», «Limpiar filtros», «Responsable»…); solo donde la pantalla no ofrece
// otro rastro (el recuento, la fila de skeleton, la lista vacía) se usa un id de prueba de testids.ts.
// Cada acción que pide la lista (orden, filtro, página, búsqueda con su debounce) se espera a su respuesta de GET /api/programs:
// así una lectura no se hace sobre los datos anteriores.

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

/** Espera a que la lista esté montada y asentada; si no aparece, lanza (la preparación no se dio por buena). */
const settledOrThrow = async (page: Page, layout: Layout): Promise<void> => {
  if (!(await waitSettled(page, layout))) throw new Error('la lista no aparece');
};

/**
 * Fija SOLO la preferencia de cookies (no es una sesión, como en el piloto): el aviso de cookies tapa el pie de la tabla y, sin
 * esto, los clics de paginación darían un falso «no se pudo pulsar». No escribe tenant, tema ni idioma.
 */
const fixCookiePreference = (): void => {
  try {
    localStorage.setItem('sigpro.cookies', 'accepted');
  } catch {
    // sin almacenamiento: no hay preferencia que fijar
  }
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

// --- Localizadores ----------------------------------------------------------------------------------------------------------

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

// --- Espera y lectura -------------------------------------------------------------------------------------------------------

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

/** Espera (con techo) a que la lista muestre `codes` y, si se da, el recuento; devuelve lo que se ve al final. */
export const waitForList = async (page: Page, layout: Layout, codes: readonly string[], count?: string): Promise<{ readonly codes: readonly string[]; readonly count: string | undefined }> => {
  await waitUntil(async () => sameCodes(await listedCodes(page, layout), codes) && (count === undefined || (await recountText(page)) === count));
  return { codes: await listedCodes(page, layout), count: await recountText(page) };
};

/** Un «Entonces» de la lista: los códigos visibles son exactamente los esperados (o ninguno, con «(ningún programa)»). */
export const listCheck = (shown: readonly string[], expected: readonly string[]): Check =>
  check(sameCodes(shown, expected), `la lista muestra ${expected.length === 0 ? '(ningún programa)' : expected.join(', ')}`, `la lista muestra ${shown.length === 0 ? '(ningún programa)' : shown.join(', ')}`);

/** Un «Entonces» del recuento: el texto visible igual al esperado. */
export const countCheck = (count: string | undefined, expected: string): Check => check(count === expected, `el recuento dice «${expected}»`, `el recuento dice «${count ?? '(sin recuento)'}»`);

/** Espera la respuesta de GET /api/programs que provoca la acción (la lista ya está al día cuando vuelve). */
export const afterListResponse = async (page: Page, act: () => Promise<unknown>): Promise<void> => {
  const response = page.waitForResponse((reply) => new URL(reply.url()).pathname === '/api/programs' && reply.request().method() === 'GET', { timeout: CEILING_MS }).catch(() => undefined);
  await act();
  await response;
};

/** Escribe en el buscador de la lista (espera a la respuesta: el texto llega a la URL tras 250 ms). */
export const typeSearch = (page: Page, layout: Layout, text: string): Promise<void> => afterListResponse(page, () => searchBox(page, layout).fill(text, ACTION));

// --- Filtros y paginación ---------------------------------------------------------------------------------------------------

export const chooseStatus = (page: Page, label: string): Promise<void> => afterListResponse(page, () => statusSelect(page).selectOption({ label }, ACTION));

export const fillDate = (page: Page, campo: string, fecha: string): Promise<void> => afterListResponse(page, () => page.getByLabel(campo, { exact: true }).fill(fecha, ACTION));

/** Elige una persona en «Responsable»: escribe la búsqueda y pulsa la opción (su nombre accesible lleva el recuento de programas). */
export const pickOwner = (page: Page, search: string, persona: string): Promise<string | undefined> =>
  runSteps([
    ['escribir en «Responsable»', () => ownerCombobox(page).fill(search, ACTION)],
    [`elegir «${persona}»`, () => afterListResponse(page, () => page.getByRole('listbox', { name: 'Responsable', exact: true }).getByRole('option', { name: persona }).click(ACTION))],
  ]);

/** Abre el panel «Filtros» del responsive y espera a que se vea (lanza si no se abre: es un paso de una acción). */
export const openFilters = async (page: Page): Promise<void> => {
  await page.getByRole('button', { name: 'Filtros', exact: true }).click(ACTION);
  // El diálogo de filtros se nombra por su título «Filtros» (aria-labelledby): otro diálogo de la página no cuenta
  await page.getByRole('dialog', { name: 'Filtros', exact: true }).waitFor({ timeout: CEILING_MS });
};

/** Cierra el panel «Filtros» con «Listo». */
export const closeFilters = async (page: Page): Promise<void> => {
  await page.getByRole('button', { name: 'Listo', exact: true }).click(ACTION);
};

/** Códigos de una celda de la historia: «(ninguno)», «(ningún programa)», un rango «PRG-001 a PRG-010» o una lista. Otra forma lanza. */
const EMPTY_CODES: ReadonlySet<string> = new Set(['(ninguno)', '(ningún programa)']);
const RANGE = /^(PRG-\d{3}) a (PRG-\d{3})$/;
const CODE_ONLY = /^PRG-\d{3}$/;
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

/** Un paso de la historia que la pantalla no ofrece: discrepancia (la historia manda), no error del arnés. */
export const actionMissing = (expected: string, failure: string): Outcome => outcome(false, expected, failure, { note: 'La historia nombra un elemento que la pantalla no ofrece.' });

// --- Columnas y filas de la tabla de escritorio -----------------------------------------------------------------------------

/** Cabecera de una columna ordenable (el nombre accesible empieza por el texto de la columna). */
export const headerOf = (page: Page, name: string): Locator => page.getByRole('columnheader', { name: new RegExp(`^${name}`) });

/** Índice de una columna por el texto de su cabecera (-1 si la tabla no la tiene). */
export const columnIndex = async (page: Page, name: string): Promise<number> => {
  const headers = await page.getByRole('columnheader').allTextContents();
  return headers.findIndex((text) => text.trim().startsWith(name));
};

export const rowOf = (page: Page, code: string): Locator => page.getByRole('row').filter({ has: page.getByRole('link', { name: code, exact: true }) });

/** Textos visibles de las celdas de una fila, en orden. */
export const cellsOf = async (row: Locator): Promise<readonly string[]> => (await row.getByRole('cell').allInnerTexts()).map((text) => text.trim());

/** Tarjeta de un programa en el responsive (el `listitem` cuyo enlace empieza por el código). */
export const cardOf = (page: Page, code: string): Locator =>
  page.getByRole('list', { name: 'Programas', exact: true }).getByRole('listitem').filter({ has: page.getByRole('link', { name: new RegExp(`^${code}`) }) });

// --- Rutas de la prueba (demoras y errores provocados antes de abrir la lista) ---------------------------------------------

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

/** Texto de un atributo de la cabecera de columna (`aria-sort`) o «(sin atributo)». */
export const ariaSortOf = (page: Page, name: string): Promise<string | undefined> => attrOf(headerOf(page, name), 'aria-sort');
