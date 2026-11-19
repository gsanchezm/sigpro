import type { Locator, Page } from '@playwright/test';
import { DEMO, TENANT_A } from '../../../story-runs/support/prepare';
import { MOVIL_PROGRAMS_TESTIDS, MOVIL_TESTIDS, PROGRAMAS_TESTIDS } from '../../../../packages/shared/src/testids';
import { ACTION, CEILING_MS, isVisible, runSteps, safe, waitUntil } from '../../support/browser';
import { check, sleep, type Check } from '../../support/checks';
import type { BrowserRowHandler } from '../../core/framework';

// Piezas comunes de las filas de la app móvil de EP-PROG-LISTA. La app se ejecuta como web de Expo a 390 × 844: NO es iOS ni
// Android nativo. Todo localizador es de ROL (excluye lo oculto) salvo donde la pantalla no ofrece otro rastro (el recuento, el
// bloque vacío, el estado de carga y el contenedor de tarjetas llevan su id de testids.ts). Las lecturas de presencia son estrictas:
// si un elemento es ambiguo lanzan, y un fallo de lectura nunca cuenta como «no aparece» ni «ninguna tarjeta».
// Las acciones sobre elementos usan el envoltorio de la web (`interact`/`interactAndAwait`): si fallan, la nota distingue «no existe»
// de «existe pero otro elemento lo tapa».

export { actionFailed, actionMissing, codesOf, interact, interactAndAwait, type Blocked } from '../web/common';

/** Salvedad de plataforma: el veredicto de una fila móvil vale para Expo web, no para iOS ni Android nativo. */
export const EXPO_NOTE = 'El veredicto vale para Expo web (390 × 844): no se ha comprobado en iOS ni en Android nativo.';

/** Aproximación declarada: abrir una dirección (carga completa de la página) no es un enlace profundo ni una navegación interna. */
export const DIRECT_APPROXIMATION =
  'Abrir una dirección de la app se aproxima con una carga completa de la página en Expo web, que recupera la sesión guardada; en iOS o Android sería un enlace profundo o una navegación interna.';

/** Añade a cada resultado de la fila la salvedad de plataforma. */
export const onExpoWeb =
  (handler: BrowserRowHandler): BrowserRowHandler =>
  async (row, fixtures) => {
    const result = await handler(row, fixtures);
    return { ...result, note: result.note === undefined ? EXPO_NOTE : `${result.note} ${EXPO_NOTE}` };
  };

export const LOGIN_PATH = '/login';
export const PROGRAMS_PATH = '/programs';
export const TENANT_TEXT = 'Tenant de trabajo';

// --- Localizadores de rol ---------------------------------------------------------------------------------------------------

export const textbox = (page: Page, name: string): Locator => page.getByRole('textbox', { name, exact: true });
export const buttonNamed = (page: Page, name: string): Locator => page.getByRole('button', { name, exact: true });
export const heading1 = (page: Page, name: string): Locator => page.getByRole('heading', { name, level: 1, exact: true });
export const loginHeading = (page: Page): Locator => heading1(page, 'Iniciar sesión');
export const programsHeading = (page: Page): Locator => heading1(page, 'Programas');
/** Buscador de la lista («Buscar programas», con el texto de ayuda «Buscar código o nombre…»). */
export const searchBox = (page: Page): Locator => textbox(page, 'Buscar programas');
/** Opción del grupo «Estado» (chips de selección única con rol de radio). */
export const statusChoice = (page: Page, label: string): Locator => page.getByRole('radio', { name: label, exact: true });
export const clearButton = (page: Page): Locator => buttonNamed(page, 'Limpiar filtros');
export const loadMoreButton = (page: Page): Locator => buttonNamed(page, 'Cargar más');
/** Estado de carga de la primera página («Cargando…» con indicador de actividad): el de la propia lista (id de prueba). */
export const loadingState = (page: Page): Locator => page.getByTestId(MOVIL_PROGRAMS_TESTIDS.PROGRAMS_LOADING);
/** Tarjetas de programa (contenedor con id de prueba: la lista no tiene nombre accesible). */
export const cardsOf = (page: Page): Locator => page.getByTestId(MOVIL_TESTIDS.PROGRAMS_CARDS);
/** Recuento «1–20 de 24» (id de prueba: el texto no tiene rol propio). */
export const recountOf = (page: Page): Locator => page.getByTestId(PROGRAMAS_TESTIDS.PROGRAMS_COUNT);
/** Bloque «Sin programas» (id de prueba: el bloque vacío es el único contenedor que lo agrupa). */
export const emptyBlock = (page: Page): Locator => page.getByTestId(PROGRAMAS_TESTIDS.PROGRAMS_EMPTY);
/** Aviso de error de la lista: rol alerta con el título y el botón «Reintentar». */
export const errorAlert = (page: Page): Locator => page.getByRole('alert').filter({ hasText: 'No se pudieron cargar los programas' });

// --- Sesión y espera ------------------------------------------------------------------------------------------------------

/** La pantalla de programas está montada y ya no muestra «Cargando…» (la primera página llegó). */
export const waitSettled = async (page: Page): Promise<boolean> =>
  (await waitUntil(async () => (await isVisible(programsHeading(page))) && !(await isVisible(loadingState(page))))).reached;

const settledOrThrow = async (page: Page): Promise<void> => {
  if (!(await waitSettled(page))) throw new Error('la lista de programas no aparece');
};

/** Inicio de sesión en la app (sin inyectar nada): alumno01 en «Tenant de trabajo», gestor@sigpro.test y llegar a /programs. */
export const signIn = (page: Page): Promise<string | undefined> =>
  runSteps([
    ['abrir /login', () => page.goto(LOGIN_PATH, { timeout: CEILING_MS })],
    ['ver el título «Iniciar sesión»', () => loginHeading(page).waitFor({ timeout: CEILING_MS })],
    [`escribir ${TENANT_A} en «${TENANT_TEXT}»`, () => textbox(page, TENANT_TEXT).fill(TENANT_A, ACTION)],
    ['escribir el correo', () => textbox(page, 'Correo electrónico').fill(DEMO.gestor.email, ACTION)],
    ['escribir la contraseña', () => textbox(page, 'Contraseña').fill(DEMO.gestor.password, ACTION)],
    ['pulsar «Entrar»', () => buttonNamed(page, 'Entrar').click(ACTION)],
    ['llegar a /programs', () => programsHeading(page).waitFor({ timeout: CEILING_MS })],
    ['ver la lista de programas', () => settledOrThrow(page)],
  ]);

/** Abre una dirección de la app (carga completa, que recupera la sesión guardada) y espera a que la lista se asiente. */
export const openPath = (page: Page, path: string): Promise<string | undefined> =>
  runSteps([
    [`abrir ${path}`, () => page.goto(path, { timeout: CEILING_MS })],
    ['ver la lista de programas', () => settledOrThrow(page)],
  ]);

// --- Lectura de la lista --------------------------------------------------------------------------------------------------

const CARD_LINK = /^PRG-\d{3} · /;
const CODE = /^PRG-\d{3}/;

/** Códigos de las tarjetas que se ven, en orden (el enlace de cada tarjeta empieza por el código). */
export const listedCodes = async (page: Page): Promise<readonly string[]> => {
  const texts = await page.getByRole('link', { name: CARD_LINK }).allTextContents();
  return texts.map((text) => CODE.exec(text.trim())?.[0]).filter((code): code is string => code !== undefined);
};

/** Número de tarjetas en pantalla (0 si no hay ninguna). Sin red de seguridad: un fallo de lectura lanza, no cuenta como «ninguna». */
export const cardCount = (page: Page): Promise<number> => cardsOf(page).getByRole('listitem').count();

/** Hay exactamente un elemento y se ve. Más de uno es lectura ambigua y LANZA; sin elemento, no se ve. */
export const strictSeen = async (target: Locator): Promise<boolean> => {
  const found = await target.count();
  if (found > 1) throw new Error(`lectura ambigua: ${found} elementos`);
  return found === 1 && (await target.isVisible());
};

export const recountText = (page: Page): Promise<string | undefined> => safe(async () => (await recountOf(page).first().innerText({ timeout: 500 })).trim(), undefined);

export const sameCodes = (actual: readonly string[], expected: readonly string[]): boolean => actual.length === expected.length && actual.every((code, index) => code === expected[index]);

/** Texto de una lista de códigos para los mensajes («(ningún programa)» si está vacía). */
const describe = (codes: readonly string[]): string => (codes.length === 0 ? '(ningún programa)' : codes.join(', '));

/** Espera (con techo) a que se vean `codes` y, si se da, el recuento; devuelve lo que se ve al final. */
export const waitForList = async (page: Page, codes: readonly string[], count?: string): Promise<{ readonly codes: readonly string[]; readonly count: string | undefined }> => {
  await waitUntil(async () => sameCodes(await listedCodes(page), codes) && (count === undefined || (await recountText(page)) === count));
  return { codes: await listedCodes(page), count: await recountText(page) };
};

/** «Entonces» de la lista: los códigos visibles son exactamente los esperados (o ninguno). */
export const listCheck = (shown: readonly string[], expected: readonly string[]): Check =>
  check(sameCodes(shown, expected), `ve ${describe(expected)}`, `ve ${describe(shown)}`);

/** «Entonces» del recuento. */
export const countCheck = (count: string | undefined, expected: string): Check => check(count === expected, `el recuento «${expected}»`, `el recuento «${count ?? '(sin recuento)'}»`);

/** Visibilidad de un elemento con lectura estricta: una ambigüedad lanza; un elemento ausente no se ve. */
export const seenCheck = async (target: Locator, expected: string, label: string): Promise<Check> => {
  const seen = await strictSeen(target);
  return check(seen, expected, seen ? `${label} visible` : `${label} no visible`);
};

/** Un valor de búsqueda o de un control: texto exacto. */
export const valueCheck = (actual: string | undefined, expected: string, label: string): Check =>
  check(actual === expected, `${label} «${expected}»`, `${label} «${actual ?? '(sin leer)'}»`);

/** Un retardo de la respuesta de GET /api/programs (la prueba lo fija; la historia lo da como dato). */
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
 * Responde 500 a GET /api/programs (solo a las primeras `times` que cumplen `match`). Lleva cabeceras CORS: Expo web llama a la
 * API desde otro origen, y sin ellas el navegador daría un fallo de red y no el 500 que describe la historia.
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
