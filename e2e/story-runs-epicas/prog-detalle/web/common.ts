import type { Locator, Page } from '@playwright/test';
import { DEMO, TENANT_A, type Credentials } from '../../../story-runs/support/prepare';
import { DETALLE_TESTIDS, HITOS_TESTIDS, PROGRAMAS_TESTIDS, PROVEEDORES_TESTIDS } from '../../../../packages/shared/src/testids';
import { ACTION, CEILING_MS, isVisible, waitUntil } from '../../support/browser';
import { check, sleep, type Check } from '../../support/checks';
import { outcome, type BrowserRowHandler, type Outcome } from '../../core/framework';

// Piezas comunes de las filas web de EP-PROG-DETALLE (escritorio 1440 px; diseño responsive por debajo de 1024 px). Los localizadores son de
// rol y de nombre (pestañas, enlaces, botones, encabezados, filas y tarjetas) y solo donde la página no ofrece otro rastro (la cabecera de la
// ficha, el bloque de carga, los campos de datos) se usa un id de prueba de testids.ts.
//
// Dos reglas del marco de esta épica, aplicadas aquí:
//  - toda lectura que decide un veredicto es ESTRICTA: un elemento ausente da «no se ve», uno ambiguo o un error da «sin resolver», y
//    «sin resolver» NO cuenta como cumplido;
//  - cuando un paso de la historia (clic, foco, tecla, navegación) falla, se guardan las TRES primeras líneas del mensaje de Playwright
//    (el call log) y, aparte, las líneas que nombran la causa (p. ej. «intercepts pointer events», «element is not enabled»), para
//    distinguir un fallo de la app de un fallo del manejador. Es un envoltorio propio: `support/browser.ts` no se toca.

/** Ancho de escritorio de la configuración; el corte de diseño está en 1024 px (`LAYOUT_BREAKPOINT_PX`). */
export const DESKTOP_WIDTH = 1440;
export const BREAKPOINT_WIDTH = 1024;
export const LOGIN_URL = `/login?tenant=${TENANT_A}`;
export const TAB_LABELS: readonly string[] = ['Resumen', 'Hitos', 'Requisitos'];
export const DETAIL_SELECT_NAME = 'Detalle del programa';

/** Anchos que citan las filas («1440 px», «390 px»…). Cualquier otro texto lanza. */
export const WIDTHS: ReadonlyMap<string, number> = new Map<string, number>([
  ['1440 px', 1440],
  ['1024 px', 1024],
  ['1023 px', 1023],
  ['390 px', 390],
]);

export const viewportOf = (width: number): { readonly width: number; readonly height: number } => ({ width, height: 900 });

/** Nota que se añade a cada fila web: la preferencia de cookies se fija antes de abrir la app (no es una sesión). */
export const COOKIE_NOTE = 'La prueba fija la preferencia de cookies (sigpro.cookies = accepted) antes de abrir la app; el aviso de cookies no se ejerce aquí.';

/** Envuelve una fila web para añadir la nota de cookies. */
export const onWeb =
  (handler: BrowserRowHandler): BrowserRowHandler =>
  async (row, fixtures) => {
    const result = await handler(row, fixtures);
    return { ...result, note: result.note === undefined ? COOKIE_NOTE : `${result.note} ${COOKIE_NOTE}` };
  };

/** La historia da los textos de la interfaz con «…»; el valor sin comillas (un texto que no está entre «» se devuelve tal cual). */
export const literal = (text: string): string => {
  const match = /^«(.+)»$/.exec(text.trim());
  return match?.[1] ?? text.trim();
};

/**
 * Igualdad de texto. SOLO por tipografía: U+00A0 (espacio de no ruptura) y U+202F (espacio estrecho de no ruptura) se leen como espacio,
 * porque `Intl` (es-ES) los pone en los importes y la historia escribe espacio normal. No relaja ninguna otra diferencia: mayúsculas,
 * signos, tildes y espacios repetidos se comparan tal cual.
 */
export const same = (actual: string, expected: string): boolean => actual.replace(/[\u00a0\u202f]/g, ' ') === expected.replace(/[\u00a0\u202f]/g, ' ');

// --- Pasos con su causa ----------------------------------------------------------------------------------------------------------------

export interface StepFailure {
  /** Qué paso falló, en palabras de la historia. */
  readonly what: string;
  /** Tres primeras líneas del mensaje de Playwright, más las líneas que nombran la causa (si las hay fuera de esas tres). */
  readonly callLog: readonly string[];
}

export type Step = readonly [what: string, action: () => Promise<unknown>];

/** Líneas que nombran la causa en el call log de Playwright (fuera de las tres primeras). */
const CAUSE = /intercepts pointer events|element is not enabled|element is disabled|not visible|resolved to \d+ elements?|strict mode violation|outside of the viewport|not stable|not editable|element is not attached/;

/** Las tres primeras líneas no vacías del mensaje y, aparte, hasta tres líneas que nombran la causa. */
export const callLogOf = (error: unknown): readonly string[] => {
  const lines = (error instanceof Error ? error.message : String(error))
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line !== '');
  const head = lines.slice(0, 3);
  const causes = lines
    .slice(3)
    .filter((line) => CAUSE.test(line))
    .slice(0, 3)
    .map((line) => `[causa] ${line}`);
  return [...head, ...causes];
};

/** Ejecuta los pasos en orden y se detiene en el primero que falla; devuelve ese fallo con su call log, o `undefined` si todos salen. */
export const runSteps = async (steps: readonly Step[]): Promise<StepFailure | undefined> => {
  for (const [what, action] of steps) {
    try {
      await action();
    } catch (error) {
      return { what, callLog: callLogOf(error) };
    }
  }
  return undefined;
};

const NOTE_ACTION =
  'Un paso de la historia no se pudo hacer en la pantalla. Puede ser la app (el elemento no está, no responde o lo tapa otro) o el manejador (un localizador que no resuelve): la causa de Playwright va en la evidencia (callLog).';
const NOTE_PREP =
  'No se llegó al estado inicial que da por hecho la historia. La causa de Playwright va en la evidencia (callLog): distinguir si es la app o el manejador.';

/** Un paso de la historia que la pantalla no permite: discrepancia con su causa de Playwright (la historia manda, no el arnés). */
export const actionMissing = (expected: string, failure: StepFailure): Outcome =>
  outcome(false, expected, `no se pudo ${failure.what}`, { note: NOTE_ACTION, evidence: { callLog: failure.callLog } });

/** El estado inicial de la historia no se produjo (un paso de la preparación falló), con su causa de Playwright. */
export const prepFailed = (expected: string, failure: StepFailure): Outcome =>
  outcome(false, expected, `la preparación no se cumplió: no se pudo ${failure.what}`, { note: NOTE_PREP, evidence: { callLog: failure.callLog } });

/** El estado inicial no se produjo por algo que se ve en la pantalla (no por un paso que falle). */
export const prepFailedText = (expected: string, reason: string): Outcome =>
  outcome(false, expected, `la preparación no se cumplió: ${reason}`, {
    note: 'No se llegó al estado inicial que da por hecho la historia; la app no muestra lo que la preparación describe.',
  });

// --- Lecturas estrictas ----------------------------------------------------------------------------------------------------------------

/** Presencia visible de un elemento: 0 → no está (`false`); 1 → se ve o no; más de uno o error → `undefined` (sin resolver). */
export const seen = async (target: Locator): Promise<boolean | undefined> => {
  try {
    const count = await target.count();
    if (count === 0) return false;
    if (count > 1) return undefined;
    return await target.isVisible({ timeout: 1_000 });
  } catch {
    return undefined;
  }
};

/**
 * Texto visible de un único elemento. `undefined` si no hay exactamente uno, si no se ve (un nodo oculto tiene `innerText` pero no es
 * un dato que la persona vea) o si no se puede leer.
 */
export const textOne = async (target: Locator): Promise<string | undefined> => {
  try {
    if ((await target.count()) !== 1) return undefined;
    if (!(await target.isVisible({ timeout: 1_000 }))) return undefined;
    return (await target.innerText({ timeout: 1_000 })).trim();
  } catch {
    return undefined;
  }
};

/** Un atributo de un único elemento (`undefined` si no hay exactamente uno, o no existe el atributo). */
export const attrOne = async (target: Locator, name: string): Promise<string | undefined> => {
  try {
    if ((await target.count()) !== 1) return undefined;
    return (await target.getAttribute(name, { timeout: 1_000 })) ?? undefined;
  } catch {
    return undefined;
  }
};

/** Estado habilitado de un único elemento (`undefined` si no se puede leer). */
export const enabledOne = async (target: Locator): Promise<boolean | undefined> => {
  try {
    if ((await target.count()) !== 1) return undefined;
    return await target.isEnabled({ timeout: 1_000 });
  } catch {
    return undefined;
  }
};

/** «Se ve» con la lectura estricta: la comprobación se cumple solo si el elemento se ve. */
export const seenCheck = async (target: Locator, expected: string, what: string): Promise<Check> => {
  const value = await seen(target);
  return check(value === true, expected, value === true ? `ve ${what}` : value === false ? `no ve ${what}` : `${what}: lectura sin resolver (ausente o ambiguo)`);
};

/** «No se ve»: solo se cumple si el elemento está y no se ve (o no existe en la página). */
export const notSeenCheck = async (target: Locator, expected: string, what: string): Promise<Check> => {
  const value = await seen(target);
  return check(value === false, expected, value === true ? `ve ${what}` : value === false ? `no ve ${what}` : `${what}: lectura sin resolver (ambiguo)`);
};

/** Un texto visible igual al esperado (con la historia entre «…» quitada y el espacio de no ruptura tratado como espacio). */
export const valueCheck = async (target: Locator, valor: string, what: string): Promise<Check> => {
  const expected = literal(valor);
  const text = await textOne(target);
  return check(text !== undefined && same(text, expected), `${what} ${expected}`, `${what} ${text === undefined ? '(sin leer)' : text}`);
};

// --- Sesión y navegación ---------------------------------------------------------------------------------------------------------------

/** Fija SOLO la preferencia de cookies (no es una sesión, como en las épicas anteriores): el aviso tapa el pie y los clics darían un falso fallo. */
const fixCookiePreference = (): void => {
  try {
    localStorage.setItem('sigpro.cookies', 'accepted');
  } catch {
    // sin almacenamiento: no hay preferencia que fijar
  }
};

/** La lista de programas está montada (tabla en escritorio, lista de tarjetas en responsive). */
const listShown = (page: Page, width: number): Locator => (width >= BREAKPOINT_WIDTH ? page.getByRole('table') : page.getByRole('list', { name: 'Programas', exact: true }));

/**
 * Preparación de cada fila: entra gestor@sigpro.test (u otra cuenta) desde /login de alumno01 en un navegador sin sesión y espera a que la
 * lista de Programas se muestre. La sesión queda guardada en el navegador de la fila, así que abrir la ficha después no vuelve a pedir acceso.
 */
export const signIn = (page: Page, width: number, credentials: Credentials = DEMO.gestor): Promise<StepFailure | undefined> =>
  runSteps([
    ['fijar la preferencia de cookies', () => page.context().addInitScript(fixCookiePreference)],
    ['fijar el ancho de la ventana', () => page.setViewportSize(viewportOf(width))],
    ['abrir /login?tenant=alumno01', () => page.goto(LOGIN_URL, { timeout: CEILING_MS })],
    ['escribir el correo', () => page.getByLabel('Correo electrónico', { exact: true }).fill(credentials.email, ACTION)],
    ['escribir la contraseña', () => page.getByLabel('Contraseña', { exact: true }).fill(credentials.password, ACTION)],
    ['pulsar «Entrar»', () => page.getByRole('button', { name: 'Entrar', exact: true }).click(ACTION)],
    ['llegar a /programs', () => page.waitForURL(/\/programs/, { timeout: CEILING_MS })],
    [
      'ver la lista de programas',
      async () => {
        if (!(await waitUntil(() => isVisible(listShown(page, width)))).reached) throw new Error('la lista de programas no aparece');
      },
    ],
  ]);

/** La ficha está montada: los datos del programa o el aviso de «no encontrado» o de error (la misma sección). */
export const detailSettled = async (page: Page): Promise<boolean> => (await waitUntil(async () => (await isVisible(articleOf(page))) || (await isVisible(alertOf(page))))).reached;

/** Abre una dirección de la app (carga completa, con la sesión guardada) y espera a que la ficha se muestre (datos o aviso). */
export const openPath = (page: Page, path: string): Promise<StepFailure | undefined> =>
  runSteps([
    [`abrir ${path}`, () => page.goto(path, { timeout: CEILING_MS })],
    [
      'ver la ficha del programa',
      async () => {
        if (!(await detailSettled(page))) throw new Error('la ficha no aparece');
      },
    ],
  ]);

// --- Localizadores ---------------------------------------------------------------------------------------------------------------------

/** Artículo de la ficha (solo existe cuando el programa se ha cargado). */
export const articleOf = (page: Page): Locator => page.getByTestId(DETALLE_TESTIDS.PROGRAM_DETAIL);
/** Aviso de la ficha: «No se encontró el programa» o «Ha ocurrido un error inesperado» (la misma sección de alerta). */
export const alertOf = (page: Page): Locator => page.getByTestId(DETALLE_TESTIDS.PROGRAM_DETAIL_NOT_FOUND);
/**
 * Indicador de carga de la ficha (`ProgramDetailPage.tsx`, sin id de prueba): un `role="status"` con `aria-busy="true"` cuyas barras son
 * `span.skeleton` y que NO está dentro del artículo de la ficha. Quedan fuera dos bloques con el mismo rol: la pantalla de arranque de la
 * app (`App.tsx`, sin barras) y el cargador de proveedores (`SuppliersPanel.tsx`, dentro del artículo de la ficha, así que aparece con
 * el programa ya cargado y nunca mientras espera).
 */
export const LOADING_XPATH = '//*[@role="status"][@aria-busy="true"][not(ancestor::article)][span[contains(concat(" ", normalize-space(@class), " "), " skeleton ")]]';
export const loadingOf = (page: Page): Locator => page.locator(`xpath=${LOADING_XPATH}`);
/** Título de la página (la h1 de la ficha o del aviso). */
export const titleOf = (page: Page): Locator => page.getByRole('heading', { level: 1 });
/** Insignia de estado de la cabecera. */
export const stateBadgeOf = (page: Page): Locator => page.getByTestId(DETALLE_TESTIDS.PROGRAM_DETAIL_STATE_BADGE);
/** Barra «Progreso» de la cabecera (role progressbar; su nombre accesible lleva el código y el porcentaje). */
export const progressBarOf = (page: Page): Locator => page.getByTestId(DETALLE_TESTIDS.PROGRAM_DETAIL_PROGRESS);
/** Dato del resumen por su etiqueta («Responsable», «Fechas», …): el `dd` de la pareja `dt`/`dd`. */
export const summaryField = (page: Page, label: string): Locator =>
  page.locator('div.contents', { has: page.locator('dt').filter({ hasText: new RegExp(`^${label}$`) }) }).locator('dd');
/** Lista de datos del resumen (solo está en la pestaña Resumen). */
export const summaryList = (page: Page): Locator => articleOf(page).locator('dl');
/** Enlace «Volver a Programas» (aparece en el aviso y al pie de la ficha). */
export const backLink = (page: Page): Locator => page.getByRole('link', { name: 'Volver a Programas', exact: true });
/** «Editar programa»: enlace si el rol puede (`admin`, `program_manager`), botón deshabilitado si no. */
export const editControl = (page: Page): Locator =>
  page.getByRole('link', { name: 'Editar programa', exact: true }).or(page.getByRole('button', { name: 'Editar programa', exact: true }));
/** Pestaña de escritorio por su nombre. */
export const tabOf = (page: Page, label: string): Locator => page.getByRole('tab', { name: label, exact: true });
/** Lista desplegable de las opciones en responsive («Detalle del programa»). */
export const tabSelect = (page: Page): Locator => page.getByRole('combobox', { name: DETAIL_SELECT_NAME, exact: true });
/** Fila de pestañas de escritorio («Detalle del programa»). */
export const tabList = (page: Page): Locator => page.getByRole('tablist', { name: DETAIL_SELECT_NAME, exact: true });
/** Enlace «Abrir el árbol de requisitos de este programa» de la pestaña Requisitos. */
export const requirementsLink = (page: Page): Locator => page.getByRole('link', { name: 'Abrir el árbol de requisitos de este programa', exact: true });
/** Sección de proveedores del resumen (id de prueba: es una sección sin rol propio con nombre fijo). */
export const suppliersSection = (page: Page): Locator => page.getByTestId(PROVEEDORES_TESTIDS.SUPPLIERS_PANEL);
/** Panel de hitos (id de prueba: la sección no ofrece otro rastro que lo identifique en la página). */
export const milestonesSection = (page: Page): Locator => page.getByTestId(HITOS_TESTIDS.MILESTONES_PANEL);
/** Fila de un programa en la tabla de escritorio (la que tiene el enlace con su código). */
export const programRow = (page: Page, code: string): Locator => page.getByRole('row').filter({ has: page.getByRole('link', { name: code, exact: true }) });
/** Panel lateral de la lista (escritorio): se nombra «Detalle de {código}». */
export const sidePanel = (page: Page): Locator => page.getByTestId(PROGRAMAS_TESTIDS.PROGRAMS_PANEL);
/** «×» del panel lateral (su nombre accesible es «Cerrar panel»; el id de prueba es el mismo botón). */
export const sidePanelClose = (page: Page): Locator =>
  page.getByRole('button', { name: 'Cerrar panel', exact: true }).or(page.getByTestId(PROGRAMAS_TESTIDS.PROGRAMS_PANEL_CLOSE));
/** Enlace «Abrir ficha completa» del panel lateral. */
export const openFullLink = (page: Page): Locator => page.getByRole('link', { name: 'Abrir ficha completa', exact: true });
/** Botón de acciones de la tarjeta de un programa (responsive), con su nombre «Acciones para {código}». */
export const cardMenuOf = (page: Page, code: string): Locator => page.getByRole('button', { name: `Acciones para ${code}`, exact: true });
/**
 * Opción «Ver detalle» de la hoja de acciones de la tarjeta (responsive): la hoja es un `dialog` y sus opciones son enlaces (no `menuitem`).
 */
export const viewDetailItem = (page: Page): Locator => page.getByRole('dialog').getByRole('link', { name: 'Ver detalle', exact: true });

/** Pestaña seleccionada, por la lista de opciones (responsive) o por `aria-selected` (escritorio). `undefined` si no se puede leer. */
export const selectedLabel = async (page: Page, width: number): Promise<string | undefined> => {
  if (width < BREAKPOINT_WIDTH) {
    try {
      return await tabSelect(page).evaluate((element) => (element as HTMLSelectElement).selectedOptions[0]?.textContent?.trim() ?? undefined);
    } catch {
      return undefined;
    }
  }
  const chosen: string[] = [];
  for (const label of TAB_LABELS) {
    if ((await attrOne(tabOf(page, label), 'aria-selected')) === 'true') chosen.push(label);
  }
  return chosen.length === 1 ? chosen[0] : undefined;
};

/** Elige una opción de la ficha: pestaña en escritorio, opción de la lista en responsive. */
export const chooseTab = (page: Page, width: number, label: string): Promise<StepFailure | undefined> =>
  width >= BREAKPOINT_WIDTH
    ? runSteps([[`pulsar la pestaña «${label}»`, () => tabOf(page, label).click(ACTION)]])
    : runSteps([[`elegir «${label}» en «${DETAIL_SELECT_NAME}»`, () => tabSelect(page).selectOption({ label }, ACTION)]]);

// --- Demoras y fallos provocados por la prueba (antes de abrir la ficha) ---------------------------------------------------------------

const detailPathname = (code: string): string => `/api/programs/${code}`;

/** Demora la respuesta de GET /api/programs/:code (la prueba fija el retardo; la historia lo da como dato). */
export const delayDetail = (page: Page, code: string, ms: number): Promise<unknown> =>
  page.route(
    (url) => url.pathname === detailPathname(code),
    async (route) => {
      if (route.request().method() !== 'GET') return route.continue();
      await sleep(ms);
      return route.continue();
    },
  );

/**
 * Responde `status` a GET /api/programs/:code: a todas las peticiones (`times` = 'always') o solo a las primeras `times`. Lleva cabeceras
 * CORS: la web llama a la API desde otro origen, y sin ellas el navegador daría un fallo de red y no el código que describe la historia.
 */
export const failDetail = (page: Page, code: string, status: number, times: number | 'always'): Promise<unknown> => {
  let failed = 0;
  return page.route(
    (url) => url.pathname === detailPathname(code),
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

/** Lo que muestran las dos formas de error de la ficha (la misma sección de alerta). */
export const NOT_FOUND_TITLE = 'No se encontró el programa';
export const ERROR_TITLE = 'Ha ocurrido un error inesperado';

// --- Lectura atómica del DOM durante la carga --------------------------------------------------------------------------------------------------

/** Qué leer en UNA sola ejecución del DOM (una instantánea): el indicador de carga y los datos del programa. */
export interface SnapshotSpec {
  /** XPath del indicador de carga (web: el bloque sin id de prueba). */
  readonly loadingXPath?: string;
  /** Id de prueba del indicador de carga (móvil). */
  readonly loadingTestId?: string;
  /** Id de prueba del artículo de la ficha: lo que está dentro cuenta como «la ficha»; lo de fuera, como migas o subtítulo. */
  readonly articleTestId: string;
  /** Ids de prueba de datos del programa que NO deben verse mientras carga. */
  readonly dataTestIds: readonly string[];
  /** Textos exactos de datos del programa (hojas visibles) que NO deben verse mientras carga. */
  readonly dataTexts: readonly string[];
  /** Código del programa: solo cuenta como dato si está DENTRO de la ficha. */
  readonly code: string;
}

/** Una instantánea: si el indicador se ve y qué datos se ven, en el mismo instante. `atMs` son los ms desde la referencia de la fila. */
export interface Snapshot {
  readonly atMs: number;
  readonly loading: boolean;
  readonly loadingText?: string;
  /** Datos del programa visibles EN ESTA instantánea (vacío si no hay ninguno). */
  readonly present: readonly string[];
  /** Veces que el código aparece visible fuera de la ficha (migas, subtítulo): se anota, no cuenta como dato de la ficha. */
  readonly codeOutsideArticle: number;
}

/**
 * Se ejecuta en el navegador, en una sola llamada: lee el indicador, su texto y los datos visibles a la vez. No usa nada de fuera (se
 * serializa con la función). Las hojas son elementos sin hijos cuyo texto se compara exacto.
 */
const readDom = (spec: SnapshotSpec): Omit<Snapshot, 'atMs'> => {
  const visible = (element: Element): boolean => {
    const box = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    return box.width > 0 && box.height > 0 && style.visibility !== 'hidden' && style.display !== 'none';
  };
  const leaves = Array.from(document.querySelectorAll('body *')).filter((element) => element.children.length === 0 && visible(element));
  const article = document.querySelector(`[data-testid="${spec.articleTestId}"]`);
  const inArticle = (element: Element): boolean => article !== null && article.contains(element);

  const loaders: Element[] = [];
  if (spec.loadingXPath !== undefined) {
    const found = document.evaluate(spec.loadingXPath, document, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
    for (let index = 0; index < found.snapshotLength; index += 1) {
      const node = found.snapshotItem(index);
      if (node instanceof Element && visible(node)) loaders.push(node);
    }
  }
  if (spec.loadingTestId !== undefined) {
    for (const node of Array.from(document.querySelectorAll(`[data-testid="${spec.loadingTestId}"]`))) if (visible(node)) loaders.push(node);
  }
  const loading = loaders.length > 0;
  const first = loaders[0];
  const loadingText = first === undefined ? undefined : first instanceof HTMLElement ? first.innerText.trim() : (first.textContent ?? '').trim();

  const present: string[] = [];
  for (const testId of spec.dataTestIds) {
    if (Array.from(document.querySelectorAll(`[data-testid="${testId}"]`)).some(visible)) present.push(testId);
  }
  for (const text of spec.dataTexts) {
    if (leaves.some((leaf) => (leaf.textContent ?? '').trim() === text)) present.push(`«${text}»`);
  }
  let codeOutsideArticle = 0;
  for (const leaf of leaves) {
    if ((leaf.textContent ?? '').trim() !== spec.code) continue;
    if (inArticle(leaf)) present.push(`código ${spec.code} en la ficha`);
    else codeOutsideArticle += 1;
  }
  return { loading, loadingText, present, codeOutsideArticle };
};

/** Una instantánea del DOM: una sola llamada a la página; el resultado es coherente porque se lee en un mismo instante del navegador. */
export const snapshotDom = async (page: Page, spec: SnapshotSpec, since: number): Promise<Snapshot> => {
  const read = await page.evaluate(readDom, spec);
  return { atMs: Math.round(performance.now() - since), ...read };
};

/** Resultado de vigilar la carga: la primera instantánea con indicador, la primera sin él (fin de la espera) y la primera fuga real. */
export interface LoadingWatch {
  readonly withIndicator?: Snapshot;
  readonly withoutIndicator?: Snapshot;
  /** Instantánea en la que se ven a la vez el indicador y datos del programa: fuga real. */
  readonly leak?: Snapshot;
  readonly snapshots: number;
}

/**
 * Vigila la carga con instantáneas sucesivas. Espera a ver el indicador (con techo) y, a partir de ahí, termina en la primera instantánea sin
 * él: esa es el fin de la espera, no una fuga. Sin esperas por elemento: cada iteración es una sola lectura del DOM.
 */
export const watchLoading = async (page: Page, spec: SnapshotSpec, since: number, ceilingMs: number = CEILING_MS): Promise<LoadingWatch> => {
  const deadline = performance.now() + ceilingMs;
  let snapshots = 0;
  let withIndicator: Snapshot | undefined;
  let withoutIndicator: Snapshot | undefined;
  let leak: Snapshot | undefined;
  while (withoutIndicator === undefined && performance.now() < deadline) {
    const snap = await snapshotDom(page, spec, since);
    snapshots += 1;
    if (snap.loading) {
      withIndicator ??= snap;
      if (snap.present.length > 0) leak ??= snap;
    } else if (withIndicator !== undefined) {
      withoutIndicator = snap;
    }
    if (withoutIndicator === undefined) await sleep(50);
  }
  return { withIndicator, withoutIndicator, leak, snapshots };
};
