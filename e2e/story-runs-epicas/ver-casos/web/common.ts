import type { Locator, Page, Route } from '@playwright/test';
import { DEMO, TENANT_A } from '../../../story-runs/support/prepare';
import { ACTION, CEILING_MS, runSteps, safe, waitUntil } from '../../support/browser';
import { sleep } from '../../support/checks';
import { outcome, type BrowserRowHandler, type Outcome } from '../../core/framework';
import { VERIFICACION_DYNAMIC_TESTIDS, VERIFICACION_TESTIDS } from '../../../../packages/shared/src/testids';

export { concluded } from '../api/common';

// Piezas comunes de las filas web de EP-VER-CASOS (escritorio 1440 px; diseño responsive por debajo de 1024 px). Los localizadores
// son de rol y de nombre donde la pantalla los da; los ids de prueba solo donde no hay otro rastro (el recuento, la tabla, el
// bloque vacío, el aviso de error, los detalles). Las lecturas son estrictas: un elemento ambiguo o ausente no cuenta como visto.
// Las acciones pasan por `runSteps` o `interact`: si fallan, la nota distingue «no existe» de «existe pero no se completó».

/** Clave de orden de una cabecera o de un chip (la del id de prueba `testcase-sort-<clave>`). */
export type SortKey = 'code' | 'title' | 'program' | 'result' | 'runs';

export const LOGIN_URL = `/login?tenant=${TENANT_A}`;
export const VERIFICATION_PATH = '/verification';
/** Esperas de la lista tras una acción de filtro o de página (la respuesta de red llega en menos de ~5 s). */
export const SETTLE_MS = 4_000;

// --- Preferencia de cookies (no es una sesión) y nota de cada fila web --------------------------------------------------------

export const COOKIE_NOTE = 'La prueba fija la preferencia de cookies (sigpro.cookies = accepted) antes de abrir la app, como el piloto; el aviso de cookies no se ejerce aquí.';

/** Añade a cada resultado de la fila la nota de la preferencia de cookies. */
export const onWeb =
  (handler: BrowserRowHandler): BrowserRowHandler =>
  async (row, fixtures) => {
    const result = await handler(row, fixtures);
    return { ...result, note: result.note === undefined ? COOKIE_NOTE : `${result.note} ${COOKIE_NOTE}` };
  };

/** Fija SOLO la preferencia de cookies: el aviso tapa zonas de la página y no es una sesión (no escribe tenant, tema ni idioma). */
const fixCookiePreference = (): void => {
  try {
    localStorage.setItem('sigpro.cookies', 'accepted');
  } catch {
    // sin almacenamiento: no hay preferencia que fijar
  }
};

/** Viewport de la fila: el ancho lo fija la celda «ancho» (1440 por defecto, como el resto de filas web). */
export const viewportAt = (width: number): { readonly width: number; readonly height: number } => ({ width, height: 900 });

// --- Acciones con diagnóstico ----------------------------------------------------------------------------------------------

export interface Blocked {
  readonly present: boolean;
  readonly message: string;
  readonly note: string;
}

/** Ejecuta una acción sobre un elemento de la historia; si falla, devuelve el diagnóstico (no lanza). */
export const interact = async (target: Locator, label: string, run: (element: Locator) => Promise<unknown>): Promise<Blocked | undefined> => {
  try {
    await run(target);
    return undefined;
  } catch (error) {
    const text = error instanceof Error ? error.message : String(error);
    const lines = text.split('\n').map((line) => line.trim()).filter((line) => line !== '');
    const intercept = lines.find((line) => line.includes('intercepts pointer events'));
    const present = (await safe(() => target.count(), 0)) > 0;
    const head = lines.slice(0, 3).join(' · ');
    return {
      present,
      message: `no se pudo ${label}: ${head}${intercept === undefined ? '' : ` · llamada: ${intercept}`}`,
      note: present ? 'el elemento existe pero la acción no se completó (ver el mensaje de Playwright)' : 'la historia nombra un elemento que la pantalla no ofrece',
    };
  }
};

/** Una acción fallida con su diagnóstico, como resultado de la fila. */
export const actionFailed = (expected: string, blocked: Blocked): Outcome => outcome(false, expected, blocked.message, { note: blocked.note });

// --- Preparación -------------------------------------------------------------------------------------------------------------

/** Inicio de sesión de gestor@sigpro.test en alumno01 con la ventana dada; termina en /programs. */
export const signIn = (page: Page, width: number): Promise<string | undefined> =>
  runSteps([
    ['fijar la preferencia de cookies', () => page.context().addInitScript(fixCookiePreference)],
    ['fijar el ancho de la ventana', () => page.setViewportSize(viewportAt(width))],
    ['abrir /login?tenant=alumno01', () => page.goto(LOGIN_URL, { timeout: CEILING_MS })],
    ['escribir el correo', () => page.getByLabel('Correo electrónico', { exact: true }).fill(DEMO.gestor.email, ACTION)],
    ['escribir la contraseña', () => page.getByLabel('Contraseña', { exact: true }).fill(DEMO.gestor.password, ACTION)],
    ['pulsar «Entrar»', () => page.getByRole('button', { name: 'Entrar', exact: true }).click(ACTION)],
    ['llegar a /programs', () => page.waitForURL(/\/programs/, { timeout: CEILING_MS })],
  ]);

/** Abre /verification (carga completa) y espera a que la lista esté asentada (con filas, con error o vacía). */
export const openVerification = (page: Page): Promise<string | undefined> =>
  runSteps([
    ['abrir /verification', () => page.goto(VERIFICATION_PATH, { timeout: CEILING_MS })],
    ['ver la lista de casos', async () => {
      if (!(await listSettled(page))) throw new Error('la lista de casos no se asienta');
    }],
  ]);

// --- Localizadores -----------------------------------------------------------------------------------------------------------

export const pageOf = (page: Page): Locator => page.getByTestId(VERIFICACION_TESTIDS.VERIFICATION_PAGE);
export const tableOf = (page: Page): Locator => page.getByTestId(VERIFICACION_TESTIDS.VERIFICATION_TABLE);
export const countOf = (page: Page): Locator => page.getByTestId(VERIFICACION_TESTIDS.VERIFICATION_COUNT);
export const errorOf = (page: Page): Locator => page.getByTestId(VERIFICACION_TESTIDS.VERIFICATION_ERROR);
export const retryOf = (page: Page): Locator => page.getByTestId(VERIFICACION_TESTIDS.VERIFICATION_ERROR_RETRY);
export const emptyOf = (page: Page): Locator => page.getByTestId(VERIFICACION_TESTIDS.VERIFICATION_EMPTY);
export const emptyClearOf = (page: Page): Locator => page.getByTestId(VERIFICACION_TESTIDS.VERIFICATION_EMPTY_CLEAR);
export const filtersClearOf = (page: Page): Locator => page.getByTestId(VERIFICACION_TESTIDS.VERIFICATION_FILTERS_CLEAR);
export const searchOf = (page: Page): Locator => page.getByRole('searchbox', { name: 'Buscar casos de prueba', exact: true });
export const programSelectOf = (page: Page): Locator => page.getByRole('combobox', { name: 'Programa', exact: true });
export const resultSelectOf = (page: Page): Locator => page.getByRole('combobox', { name: 'Último resultado', exact: true });
export const sortOf = (page: Page, key: SortKey): Locator => page.getByTestId(VERIFICACION_DYNAMIC_TESTIDS.TESTCASE_SORT(key));
export const nextOf = (page: Page): Locator => page.getByRole('button', { name: 'Página siguiente', exact: true });
export const rowOf = (page: Page, code: string): Locator => page.getByTestId(VERIFICACION_DYNAMIC_TESTIDS.TESTCASE_ROW(code));
export const linkOf = (page: Page, code: string): Locator => page.getByTestId(VERIFICACION_DYNAMIC_TESTIDS.TESTCASE_LINK(code));
export const detailOf = (page: Page): Locator => page.getByTestId(VERIFICACION_TESTIDS.TESTCASE_DETAIL);
export const notFoundOf = (page: Page): Locator => page.getByTestId(VERIFICACION_TESTIDS.TESTCASE_NOT_FOUND);
export const backOf = (page: Page): Locator => page.getByTestId(VERIFICACION_TESTIDS.TESTCASE_BACK);

// --- Lecturas (con plazo; una lectura ambigua o ausente no cuenta como visto) ---------------------------------------------

/** Texto de un único elemento (si hay cero o varios, devuelve `undefined`: nunca se lee el primero a ciegas). */
export const oneText = (target: Locator): Promise<string | undefined> =>
  safe(async () => {
    if ((await target.count()) !== 1) return undefined;
    return (await target.innerText({ timeout: 2000 })).trim();
  }, undefined);

/** Hojas de texto de un elemento (nodos sin hijos con texto), en orden: lo que la pantalla muestra como fragmentos. */
export const leavesOf = (target: Locator): Promise<readonly string[] | undefined> =>
  safe(
    () =>
      target.evaluate(
        (element: Element) =>
          Array.from(element.querySelectorAll('*'))
            .filter((node) => node.children.length === 0)
            .map((node) => (node.textContent ?? '').trim())
            .filter((text) => text !== ''),
        undefined,
        { timeout: 2000 },
      ),
    undefined,
  );

/** Códigos de las filas (tabla o tarjetas) que se ven, en orden. `undefined` si no se pudo leer. */
export const codesShown = (page: Page): Promise<readonly string[] | undefined> =>
  safe(
    () =>
      pageOf(page).evaluate(
        (root: Element) =>
          Array.from(root.querySelectorAll('[data-testid]'))
            .map((node) => node.getAttribute('data-testid') ?? '')
            .filter((id) => /^testcase-row-TC-\d{3}$/.test(id))
            .map((id) => id.slice('testcase-row-'.length)),
        undefined,
        { timeout: 2000 },
      ),
    undefined,
  );

export interface ListSnapshot {
  readonly skeleton: number;
  readonly rows: number;
  readonly errors: number;
  readonly empty: number;
  readonly busy: string | null;
}

/** Estado de la lista leído en UNA sola evaluación (filas de carga, filas, aviso de error, bloque vacío y `aria-busy`). */
export const snapshotOf = (page: Page): Promise<ListSnapshot | undefined> =>
  safe(
    () =>
      pageOf(page).evaluate(
        (root: Element) => ({
          skeleton: root.querySelectorAll('[data-testid="skeleton-row"]').length,
          rows: Array.from(root.querySelectorAll('[data-testid]')).filter((node) => /^testcase-row-TC-\d{3}$/.test(node.getAttribute('data-testid') ?? '')).length,
          errors: root.querySelectorAll('[data-testid="verification-error"]').length,
          empty: root.querySelectorAll('[data-testid="verification-empty"]').length,
          busy: root.querySelector('table')?.getAttribute('aria-busy') ?? null,
        }),
        undefined,
        { timeout: 2000 },
      ),
    undefined,
  );

/** Espera (con techo) a que la lista deje de cargar y muestre filas, aviso de error o bloque vacío. */
export const listSettled = async (page: Page, ceilingMs: number = CEILING_MS): Promise<boolean> =>
  (
    await waitUntil(async () => {
      const snapshot = await snapshotOf(page);
      return snapshot !== undefined && snapshot.skeleton === 0 && snapshot.busy !== 'true' && (snapshot.rows > 0 || snapshot.errors > 0 || snapshot.empty > 0);
    }, ceilingMs)
  ).reached;

/** Espera a que se vean exactamente `codes` (en orden) y, si se da, el recuento. Devuelve lo que se ve al final. */
export const waitForList = async (page: Page, codes: readonly string[], count?: string, ceilingMs: number = SETTLE_MS): Promise<{ readonly codes: readonly string[] | undefined; readonly count: string | undefined }> => {
  await waitUntil(async () => sameCodes(await codesShown(page), codes) && (count === undefined || (await countOf(page).innerText({ timeout: 500 }).catch(() => '')).trim() === count), ceilingMs);
  return { codes: await codesShown(page), count: await oneText(countOf(page)) };
};

export const sameCodes = (actual: readonly string[] | undefined, expected: readonly string[]): boolean =>
  actual !== undefined && actual.length === expected.length && actual.every((code, index) => code === expected[index]);

/** Texto de una lista de códigos para los mensajes («(ninguno)» si está vacía; «(sin leer)» si no se pudo leer). */
export const describeCodes = (codes: readonly string[] | undefined): string => (codes === undefined ? '(sin leer)' : codes.length === 0 ? '(ninguno)' : codes.join(', '));

/** Estado efectivo de un botón: se puede pulsar, no se puede pulsar, o `undefined` si no hay exactamente uno o la lectura falla. */
export const buttonReach = (target: Locator): Promise<string | undefined> =>
  safe(async () => {
    if ((await target.count()) !== 1) return undefined;
    return (await target.isDisabled({ timeout: 2000 })) ? 'no se puede pulsar' : 'se puede pulsar';
  }, undefined);

const CASE_CODE = /^TC-\d{3}$/;

/** Códigos de casos separados por «, » (o «(ninguno)»); cualquier otra forma LANZA. */
export const codesOf = (text: string): readonly string[] => {
  if (text === '(ninguno)') return [];
  const list = text.split(', ');
  if (!list.every((code) => CASE_CODE.test(code))) throw new Error(`celda sin interpretación: códigos «${text}»`);
  return list;
};

/** Códigos entre dos extremos, ambos incluidos (TC-001 a TC-010 → diez códigos). */
export const codesBetween = (first: string, last: string): readonly string[] => {
  const from = Number(first.slice(3));
  const to = Number(last.slice(3));
  return Array.from({ length: to - from + 1 }, (_, index) => `TC-${String(from + index).padStart(3, '0')}`);
};

/** Página en la que cae un caso con 10 casos por página (orden por código, sin filtros). */
export const pageOfCode = (code: string): number => Math.ceil(Number(code.slice(3)) / 10);

/**
 * Abre el caso desde la lista de Verificación (sin filtros): va a la página del caso con «Página siguiente» y pulsa su enlace.
 * No abre la dirección del caso directamente. Devuelve el fallo del paso o `undefined`.
 */
export const openCaseFromList = async (page: Page, code: string): Promise<string | undefined> => {
  const pages = pageOfCode(code);
  const steps: [string, () => Promise<unknown>][] = [['abrir /verification', () => page.goto(VERIFICATION_PATH, { timeout: CEILING_MS })]];
  steps.push(['ver la lista de casos', async () => {
    if (!(await listSettled(page))) throw new Error('la lista de casos no se asienta');
  }]);
  for (let index = 1; index < pages; index += 1) {
    steps.push([`pasar a la página ${index + 1}`, async () => {
      const before = await oneText(countOf(page));
      await nextOf(page).click(ACTION);
      await waitUntil(async () => (await oneText(countOf(page))) !== before, SETTLE_MS);
    }]);
  }
  steps.push([`abrir el enlace de ${code}`, () => linkOf(page, code).click(ACTION)]);
  steps.push(['ver el detalle del caso', async () => {
    if (!(await waitUntil(() => detailOf(page).isVisible(), CEILING_MS)).reached) throw new Error('el detalle no aparece');
  }]);
  return runSteps(steps);
};

// --- Rutas de red de las pruebas ---------------------------------------------------------------------------------------------

const corsHeaders = (origin: string | undefined): Record<string, string> => ({ 'access-control-allow-origin': origin ?? '*', 'access-control-expose-headers': '*' });

export type FailureMode = 'status500' | 'noResponse';

/**
 * Hace fallar las primeras `times` peticiones GET de `pathname` que cumplan `match` (o todas, con `'always'`): responde 500 o no
 * responde. El resto pasa a la red sin tocar. El nombre de ruta es exacto: `/api/test-cases` no atrapa `/api/test-cases/TC-001`.
 */
export const failGet = (page: Page, pathname: string, mode: FailureMode, times: number | 'always', match: (url: URL) => boolean = () => true): Promise<unknown> => {
  let failed = 0;
  return page.route(
    (url) => url.pathname === pathname,
    async (route: Route) => {
      const request = route.request();
      if (request.method() !== 'GET' || !match(new URL(request.url())) || (times !== 'always' && failed >= times)) return route.continue();
      failed += 1;
      if (mode === 'noResponse') return route.abort('failed');
      return route.fulfill({
        status: 500,
        contentType: 'application/json',
        headers: corsHeaders(request.headers().origin),
        body: JSON.stringify({ statusCode: 500, error: 'Internal Server Error', message: 'Error provocado por la prueba' }),
      });
    },
  );
};

/** Interruptor de una ruta de fallo: mientras `active` es true, las peticiones que cumplen la regla fallan; la prueba lo apaga. */
export interface FailSwitch {
  active: boolean;
}

/**
 * Como `failGet`, pero falla mientras el interruptor esté encendido: la prueba lo apaga cuando ya ha visto el aviso y pulsa
 * «Reintentar» (así no depende de cuántas peticiones haga la pantalla antes de mostrar el error).
 */
export const failGetWhile = (page: Page, pathname: string, mode: FailureMode, control: FailSwitch, match: (url: URL) => boolean = () => true): Promise<unknown> =>
  page.route(
    (url) => url.pathname === pathname,
    async (route: Route) => {
      const request = route.request();
      if (!control.active || request.method() !== 'GET' || !match(new URL(request.url()))) return route.continue();
      if (mode === 'noResponse') return route.abort('failed');
      return route.fulfill({
        status: 500,
        contentType: 'application/json',
        headers: corsHeaders(request.headers().origin),
        body: JSON.stringify({ statusCode: 500, error: 'Internal Server Error', message: 'Error provocado por la prueba' }),
      });
    },
  );

/** Retrasa `ms` las respuestas GET de `pathname` (la prueba fija el retraso; la historia lo da como dato). */
export const delayGet = (page: Page, pathname: string, ms: number): Promise<unknown> =>
  page.route(
    (url) => url.pathname === pathname,
    async (route: Route) => {
      if (route.request().method() !== 'GET') return route.continue();
      await sleep(ms);
      return route.continue();
    },
  );

/** Diagnóstico de la lista: título y traza del aviso de error, leídos como fragmentos del aviso. */
export const errorLeaves = async (page: Page): Promise<{ readonly title: string | undefined; readonly fragments: readonly string[] | undefined; readonly retry: string | undefined }> => {
  const alert = errorOf(page);
  const leaves = await leavesOf(alert);
  return {
    title: leaves?.[0],
    fragments: leaves?.slice(1).filter((text) => text !== 'Reintentar'),
    retry: await oneText(retryOf(page)),
  };
};
