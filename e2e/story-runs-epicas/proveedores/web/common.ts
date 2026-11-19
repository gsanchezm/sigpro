import type { Locator, Page, Route } from '@playwright/test';
import { DEMO, TENANT_A, type Credentials } from '../../../story-runs/support/prepare';
import { DETALLE_TESTIDS, PROVEEDORES_DYNAMIC_TESTIDS, PROVEEDORES_TESTIDS } from '../../../../packages/shared/src/testids';
import { ACTION, CEILING_MS, pathOf, safe, waitUntil } from '../../support/browser';
import { check, sleep, type Check } from '../../support/checks';
import { outcome, type BrowserRowHandler, type Outcome } from '../../core/framework';

// Piezas comunes de las filas web de EP-PROVEEDORES (escritorio 1440 px). Los localizadores son de rol y de nombre (encabezados, filas,
// botones, campos, opciones, enlaces) y solo donde la sección no ofrece otro rastro (el contador, los avisos de carga y de error, el
// buscador, la ficha de proveedor) se usa un id de prueba de testids.ts.
//
// Reglas de este módulo:
//  - toda lectura que decide un veredicto es ESTRICTA: un elemento ausente da «no se ve», uno ambiguo o un error da «sin resolver», y
//    «sin resolver» NO cuenta como cumplido;
//  - lo que cambia durante una espera (carga, búsqueda) se lee en UNA sola ejecución del DOM (`page.evaluate`), para que el indicador,
//    las filas y el contador se comparen en el mismo instante;
//  - cuando un paso de la historia falla (clic, foco, tecla), se guardan las tres primeras líneas del mensaje de Playwright y, aparte,
//    las que nombran la causa (`callLogOf`), para distinguir un fallo de la app de uno del manejador.
//  - `support/browser.ts` y `support/checks.ts` se usan tal cual; este archivo no edita nada común.

export const DESKTOP_WIDTH = 1440;
export const LOGIN_URL = `/login?tenant=${TENANT_A}`;
export const SUPPLIERS_PATH = '/api/suppliers';
/** Ruta de la ficha de un programa (la sección «Proveedores» vive en su Resumen). */
export const programPath = (code: string): string => `/programs/${code}`;

/** Nota que se añade a cada fila web: la preferencia de cookies se fija antes de abrir la app (no es una sesión). */
export const COOKIE_NOTE = 'La prueba fija la preferencia de cookies (sigpro.cookies = accepted) antes de abrir la app; el aviso de cookies no se ejerce aquí.';

/** Envuelve una fila web para añadir la nota de cookies. */
export const onWeb =
  (handler: BrowserRowHandler): BrowserRowHandler =>
  async (row, fixtures) => {
    const result = await handler(row, fixtures);
    return { ...result, note: result.note === undefined ? COOKIE_NOTE : `${result.note} ${COOKIE_NOTE}` };
  };

/** Texto entre «…» de una celda (sin las comillas de la historia). Un texto sin «…» se devuelve tal cual, recortado. */
export const literal = (text: string): string => {
  const match = /^«(.+)»$/.exec(text.trim());
  return match?.[1] ?? text.trim();
};

/** Espacios de no ruptura (U+00A0 y U+202F): `Intl` los pone en los importes, y la historia escribe espacio normal. */
const SPACES = new RegExp('[' + String.fromCharCode(160, 8239) + ']', 'g');

/** Igualdad de texto: solo la tipografía de los espacios; no relaja mayúsculas, signos, tildes ni números. */
export const same = (actual: string, expected: string): boolean => actual.replace(SPACES, ' ') === expected.replace(SPACES, ' ');

// --- Pasos con su causa ----------------------------------------------------------------------------------------------------------------

export interface StepFailure {
  /** Qué paso falló, en palabras de la historia. */
  readonly what: string;
  /** Tres primeras líneas del mensaje de Playwright, más las líneas que nombran la causa. */
  readonly callLog: readonly string[];
}

export type Step = readonly [what: string, action: () => Promise<unknown>];

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

const NOTE_ACTION = 'Un paso de la historia no se pudo hacer en la pantalla. Puede ser la app (el elemento no está, no responde o lo tapa otro) o el manejador (un localizador que no resuelve): la causa de Playwright va en la evidencia (callLog).';
const NOTE_PREP = 'No se llegó al estado inicial que da por hecho la historia. La causa de Playwright va en la evidencia (callLog): distinguir si es la app o el manejador.';

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

// --- Lecturas estrictas de un elemento -------------------------------------------------------------------------------------------------

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

/** Texto visible de un único elemento; `undefined` si no hay exactamente uno, si no se ve o si no se puede leer. */
export const textOne = async (target: Locator): Promise<string | undefined> => {
  try {
    if ((await target.count()) !== 1) return undefined;
    if (!(await target.isVisible({ timeout: 1_000 }))) return undefined;
    return (await target.innerText({ timeout: 1_000 })).trim();
  } catch {
    return undefined;
  }
};

/** Un «Entonces» de visibilidad: solo se cumple si el elemento se ve. */
export const seenCheck = async (target: Locator, expected: string, what: string): Promise<Check> => {
  const value = await seen(target);
  return check(value === true, expected, value === true ? `ve ${what}` : value === false ? `no ve ${what}` : `${what}: lectura sin resolver (ausente o ambiguo)`);
};

/** «No se ve»: solo se cumple si el elemento está en la página y no se ve, o no existe. Una lectura ambigua no cuenta. */
export const notSeenCheck = async (target: Locator, expected: string, what: string): Promise<Check> => {
  const value = await seen(target);
  return check(value === false, expected, value === true ? `ve ${what}` : value === false ? `no ve ${what}` : `${what}: lectura sin resolver (ambiguo)`);
};

/** Un texto visible igual al esperado (con «…» quitadas de la historia). */
export const textCheck = async (target: Locator, expectedText: string, what: string): Promise<Check> => {
  const expected = literal(expectedText);
  const text = await textOne(target);
  return check(text !== undefined && same(text, expected), `${what} ${expected}`, `${what} ${text === undefined ? '(sin leer)' : text}`);
};

// --- Sesión y navegación ---------------------------------------------------------------------------------------------------------------

/** Fija SOLO la preferencia de cookies (no es una sesión): el aviso tapa el pie y los clics darían un falso fallo. */
const fixCookiePreference = (): void => {
  try {
    localStorage.setItem('sigpro.cookies', 'accepted');
  } catch {
    // sin almacenamiento: no hay preferencia que fijar
  }
};

/**
 * Preparación de cada fila: entra con la cuenta desde /login de alumno01 en un navegador sin sesión y espera a que la lista de
 * Programas se muestre. La sesión queda guardada en el navegador de la fila.
 */
export const signIn = (page: Page, credentials: Credentials = DEMO.gestor): Promise<StepFailure | undefined> =>
  runSteps([
    ['fijar la preferencia de cookies', () => page.context().addInitScript(fixCookiePreference)],
    ['fijar el ancho de la ventana', () => page.setViewportSize({ width: DESKTOP_WIDTH, height: 900 })],
    ['abrir /login?tenant=alumno01', () => page.goto(LOGIN_URL, { timeout: CEILING_MS })],
    ['escribir el correo', () => page.getByLabel('Correo electrónico', { exact: true }).fill(credentials.email, ACTION)],
    ['escribir la contraseña', () => page.getByLabel('Contraseña', { exact: true }).fill(credentials.password, ACTION)],
    ['pulsar «Entrar»', () => page.getByRole('button', { name: 'Entrar', exact: true }).click(ACTION)],
    ['llegar a /programs', () => page.waitForURL(/\/programs/, { timeout: CEILING_MS })],
    [
      'ver la lista de programas',
      async () => {
        if (!(await waitUntil(() => page.getByRole('table').isVisible().catch(() => false))).reached) throw new Error('la lista de programas no aparece');
      },
    ],
  ]);

/** La ficha está montada: el artículo con sus datos o el aviso de «no encontrado» o de error. */
export const detailSettled = async (page: Page): Promise<boolean> =>
  (await waitUntil(async () => (await safe(() => articleOf(page).isVisible(), false)) || (await safe(() => alertOf(page).isVisible(), false)))).reached;

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

// --- Localizadores de la ficha y de la sección -----------------------------------------------------------------------------------------

/** Artículo de la ficha (solo existe cuando el programa se ha cargado). */
export const articleOf = (page: Page): Locator => page.getByTestId(DETALLE_TESTIDS.PROGRAM_DETAIL);
/** Aviso de la ficha («No se encontró el programa» o «Ha ocurrido un error inesperado»). */
export const alertOf = (page: Page): Locator => page.getByTestId(DETALLE_TESTIDS.PROGRAM_DETAIL_NOT_FOUND);
/** Sección «Proveedores» del Resumen (un solo bloque, dentro del artículo de la ficha). */
export const panelOf = (page: Page): Locator => page.getByTestId(PROVEEDORES_TESTIDS.SUPPLIERS_PANEL);
/** Campo «Proveedor del tenant» (combobox ARIA; su nombre accesible es la etiqueta visible). */
export const searchInputOf = (page: Page): Locator => page.getByRole('combobox', { name: 'Proveedor del tenant', exact: true });
/** Lista de opciones del buscador («Proveedores encontrados»). */
export const listboxOf = (page: Page): Locator => page.getByRole('listbox', { name: 'Proveedores encontrados', exact: true });
/** Ficha del proveedor elegido. */
export const fichaOf = (page: Page): Locator => page.getByTestId(PROVEEDORES_TESTIDS.SUPPLIER_DETAIL);
/** Dato del Resumen por su etiqueta («Responsable»): el `dd` de la pareja `dt`/`dd`. */
export const summaryField = (page: Page, label: string): Locator =>
  page.locator('div.contents', { has: page.locator('dt').filter({ hasText: new RegExp(`^${label}$`) }) }).locator('dd');

// --- Selectores de la sección y del buscador (para las lecturas de una sola ejecución del DOM) -------------------------------------------

export interface PanelSelectors {
  readonly root: string;
  /** Filas de proveedores contratados (una por proveedor). */
  readonly rows: string;
  /** Indicador de carga de la lista. */
  readonly loading: string;
  readonly counter: string;
  readonly error: string;
  readonly empty: string;
}

export interface SearchSelectors {
  readonly input: string;
  readonly list: string;
  /** Opciones dentro de la lista. */
  readonly option: string;
  readonly status: string;
  readonly ficha: string;
}

export const PANEL_WEB: PanelSelectors = {
  root: `[data-testid="${PROVEEDORES_TESTIDS.SUPPLIERS_PANEL}"]`,
  rows: '[data-testid^="supplier-row-"]',
  loading: '[role="status"][aria-busy="true"]',
  counter: `[data-testid="${PROVEEDORES_TESTIDS.SUPPLIERS_COUNT}"]`,
  error: `[data-testid="${PROVEEDORES_TESTIDS.SUPPLIERS_ERROR}"]`,
  empty: `[data-testid="${PROVEEDORES_TESTIDS.SUPPLIERS_EMPTY}"]`,
};

export const SEARCH_WEB: SearchSelectors = {
  input: `[data-testid="${PROVEEDORES_TESTIDS.SUPPLIER_SEARCH}"]`,
  list: `[data-testid="${PROVEEDORES_TESTIDS.SUPPLIER_SEARCH_LIST}"]`,
  option: '[role="option"]',
  status: `[data-testid="${PROVEEDORES_TESTIDS.SUPPLIER_SEARCH_STATUS}"]`,
  ficha: `[data-testid="${PROVEEDORES_TESTIDS.SUPPLIER_DETAIL}"]`,
};

// --- Lecturas en una sola ejecución del DOM -------------------------------------------------------------------------------------------

export interface PanelSnapshot {
  readonly atMs: number;
  /** La sección está montada. */
  readonly present: boolean;
  readonly loading: boolean;
  readonly loadingText: string | null;
  /** Nombres de las filas de contratados que se ven. */
  readonly rowNames: readonly string[];
  /** Texto del contador (`null` si no se ve). */
  readonly counter: string | null;
  readonly error: boolean;
  readonly empty: boolean;
  readonly emptyText: string | null;
}

/** Se serializa y se ejecuta en el navegador: no usa nada de fuera. Lee la sección entera en un mismo instante. */
const readPanel = (selectors: PanelSelectors): Omit<PanelSnapshot, 'atMs'> => {
  const visible = (element: Element): boolean => {
    const box = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    return box.width > 0 && box.height > 0 && style.visibility !== 'hidden' && style.display !== 'none';
  };
  const root = document.querySelector(selectors.root);
  if (root === null) return { present: false, loading: false, loadingText: null, rowNames: [], counter: null, error: false, empty: false, emptyText: null };
  const loader = Array.from(root.querySelectorAll(selectors.loading)).find(visible);
  const counterText = (root.querySelector(selectors.counter)?.textContent ?? '').trim();
  const emptyElement = Array.from(root.querySelectorAll(selectors.empty)).find(visible);
  return {
    present: true,
    loading: loader !== undefined,
    loadingText: loader === undefined ? null : (loader.textContent ?? '').trim(),
    rowNames: Array.from(root.querySelectorAll(selectors.rows))
      .filter(visible)
      .map((row) => row.getAttribute('aria-label') ?? (row.querySelector('th')?.textContent ?? '').trim()),
    counter: counterText === '' ? null : counterText,
    error: Array.from(root.querySelectorAll(selectors.error)).some(visible),
    empty: emptyElement !== undefined,
    emptyText: emptyElement === undefined ? null : (emptyElement.textContent ?? '').trim(),
  };
};

/** Una instantánea de la sección: una sola llamada a la página. */
export const panelSnapshot = async (page: Page, selectors: PanelSelectors, since: number): Promise<PanelSnapshot> => {
  const read = await safe(() => page.evaluate(readPanel, selectors), { present: false, loading: false, loadingText: null, rowNames: [], counter: null, error: false, empty: false, emptyText: null });
  return { atMs: Math.round(performance.now() - since), ...read };
};

/** La lista terminó: la sección está montada, no carga y muestra filas, contador, vacío o error. */
export const isSettled = (snap: PanelSnapshot): boolean => snap.present && !snap.loading && (snap.rowNames.length > 0 || snap.counter !== null || snap.error || snap.empty);

/** Observa la sección con instantáneas sucesivas hasta que termina la carga (o hasta el techo). Devuelve todas las instantáneas. */
export const watchPanel = async (page: Page, selectors: PanelSelectors, ceilingMs: number = CEILING_MS): Promise<readonly PanelSnapshot[]> => {
  const since = performance.now();
  const snaps: PanelSnapshot[] = [];
  let last = await panelSnapshot(page, selectors, since);
  snaps.push(last);
  while (!isSettled(last) && performance.now() - since < ceilingMs) {
    await sleep(50);
    last = await panelSnapshot(page, selectors, since);
    snaps.push(last);
  }
  return snaps;
};

/** La última instantánea de la sección tras esperar a que termine la carga. */
export const settledPanel = async (page: Page, selectors: PanelSelectors = PANEL_WEB): Promise<PanelSnapshot> => {
  const snaps = await watchPanel(page, selectors);
  return snaps[snaps.length - 1] ?? (await panelSnapshot(page, selectors, performance.now()));
};

/** Espera (con techo) a que la sección cumpla `done` y devuelve esa instantánea, cumpla o no. Para leer después de una acción que recarga. */
export const waitPanelUntil = async (page: Page, done: (snap: PanelSnapshot) => boolean, selectors: PanelSelectors = PANEL_WEB, ceilingMs: number = CEILING_MS): Promise<PanelSnapshot> => {
  const since = performance.now();
  let last = await panelSnapshot(page, selectors, since);
  while (!done(last) && performance.now() - since < ceilingMs) {
    await sleep(50);
    last = await panelSnapshot(page, selectors, since);
  }
  return last;
};

/** La lista de contratados no cambió entre dos instantáneas (mismos nombres en el mismo orden y el mismo contador). */
export const unchangedCheck = (before: PanelSnapshot, after: PanelSnapshot): Check => {
  const same = before.rowNames.length === after.rowNames.length && before.rowNames.every((name, index) => name === after.rowNames[index]) && before.counter === after.counter;
  const describe = (snap: PanelSnapshot): string => `${snap.rowNames.join(', ') || '(ninguno)'} (${snap.counter ?? 'sin contador'})`;
  return check(same, 'la lista de contratados no cambia', same ? 'la lista de contratados no cambia' : `antes ${describe(before)}; después ${describe(after)}`);
};

export interface SearchSnapshot {
  readonly atMs: number;
  /** Valor actual del campo. */
  readonly value: string | null;
  /** La lista de opciones se ve. */
  readonly listVisible: boolean;
  /** Nombres de las opciones visibles, en orden. */
  readonly options: readonly string[];
  /** Texto del aviso de la búsqueda (`null` si no se ve el bloque). */
  readonly status: string | null;
  /** La ficha de proveedor se ve. */
  readonly fichaVisible: boolean;
  /** Nombre de la opción activa (la que señala `aria-activedescendant`), o `null` si no hay ninguna. */
  readonly active: string | null;
}

/** Se serializa y se ejecuta en el navegador. Lee campo, lista, aviso y ficha en un mismo instante. */
const readSearch = (selectors: SearchSelectors): Omit<SearchSnapshot, 'atMs'> => {
  const visible = (element: Element): boolean => {
    const box = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    return box.width > 0 && box.height > 0 && style.visibility !== 'hidden' && style.display !== 'none';
  };
  const input = document.querySelector(selectors.input);
  const list = document.querySelector(selectors.list);
  const status = document.querySelector(selectors.status);
  const ficha = document.querySelector(selectors.ficha);
  const activeId = input?.getAttribute('aria-activedescendant') ?? null;
  const activeElement = activeId === null ? null : document.getElementById(activeId);
  return {
    value: input instanceof HTMLInputElement ? input.value : null,
    listVisible: list !== null && visible(list),
    options:
      list === null
        ? []
        : Array.from(list.querySelectorAll(selectors.option)).map((option) => option.getAttribute('aria-label') ?? (option.firstElementChild?.textContent ?? '').trim()),
    status: status === null ? null : (status.textContent ?? '').trim(),
    fichaVisible: ficha !== null && visible(ficha),
    active: activeElement === null ? null : (activeElement.getAttribute('aria-label') ?? (activeElement.firstElementChild?.textContent ?? '').trim()),
  };
};

/** Una instantánea del buscador: una sola llamada a la página. */
export const searchSnapshot = async (page: Page, selectors: SearchSelectors, since: number): Promise<SearchSnapshot> => {
  const read = await safe(() => page.evaluate(readSearch, selectors), { value: null, listVisible: false, options: [], status: null, fichaVisible: false, active: null });
  return { atMs: Math.round(performance.now() - since), ...read };
};

/** Espera (con techo) a que el buscador cumpla `done`; devuelve la última instantánea, cumpla o no. */
export const waitSearch = async (page: Page, done: (snap: SearchSnapshot) => boolean, selectors: SearchSelectors = SEARCH_WEB, ceilingMs: number = CEILING_MS): Promise<SearchSnapshot> => {
  const since = performance.now();
  let last = await searchSnapshot(page, selectors, since);
  while (!done(last) && performance.now() - since < ceilingMs) {
    await sleep(50);
    last = await searchSnapshot(page, selectors, since);
  }
  return last;
};

/** Observa el buscador durante la espera y devuelve todas sus instantáneas (hasta que `done` se cumple o se agota el techo). */
export const watchSearch = async (page: Page, done: (snap: SearchSnapshot) => boolean, selectors: SearchSelectors = SEARCH_WEB, ceilingMs: number = CEILING_MS): Promise<readonly SearchSnapshot[]> => {
  const since = performance.now();
  const snaps: SearchSnapshot[] = [];
  let last = await searchSnapshot(page, selectors, since);
  snaps.push(last);
  while (!done(last) && performance.now() - since < ceilingMs) {
    await sleep(50);
    last = await searchSnapshot(page, selectors, since);
    snaps.push(last);
  }
  return snaps;
};

/** Cuadrícula de texto de las celdas de una fila de proveedor contratado (`undefined` si no hay exactamente una fila con ese nombre). */
export const rowCellsOf = async (page: Page, name: string): Promise<readonly string[] | undefined> => {
  const rows = panelOf(page).getByRole('row').filter({ hasText: name });
  return safe(async () => {
    if ((await rows.count()) !== 1) return undefined;
    return (await rows.first().getByRole('cell').allTextContents()).map((text) => text.trim());
  }, undefined);
};

/** Textos de los botones de la sección (`undefined` si no se pueden leer: una lectura fallida no cuenta como «sin botones»). */
export const buttonNamesOf = (page: Page): Promise<readonly string[] | undefined> =>
  safe(() => panelOf(page).getByRole('button').evaluateAll((buttons) => buttons.map((button) => button.getAttribute('aria-label') ?? (button.textContent ?? '').trim())), undefined);

/** Hojas (elementos sin hijos) de un elemento, con su texto: la lectura de una línea de contrato o de una tarjeta. */
export const leavesOf = (target: Locator): Promise<readonly string[]> =>
  safe(
    () => target.first().evaluate((element) => Array.from(element.querySelectorAll('*')).filter((child) => child.children.length === 0).map((child) => (child.textContent ?? '').trim())),
    [],
  );

// --- Acciones con su espera -------------------------------------------------------------------------------------------------------------

/** Clic en una fila o control; devuelve el fallo con su call log si no sale. */
export const clickOn = (target: Locator, what: string): Promise<StepFailure | undefined> => runSteps([[what, () => target.click(ACTION)]]);

/** Escribe texto en el buscador como una persona (una tecla tras otra). */
export const typeInto = (target: Locator, text: string): Promise<StepFailure | undefined> => runSteps([[`escribir «${text}»`, () => target.pressSequentially(text, ACTION)]]);

// --- Demoras y fallos provocados por la prueba (solo para la petición de la historia) -------------------------------------------------

export type Match = (params: URLSearchParams) => boolean;

/** Coincide con GET /api/suppliers cuyos parámetros cumplen `match`. */
const suppliersRoute =
  (match: Match) =>
  (url: URL): boolean =>
    url.pathname === SUPPLIERS_PATH && match(url.searchParams);

/** Lista de contratados del programa (`?program=…` sin `q`). */
export const matchProgram =
  (code: string): Match =>
  (params) =>
    params.get('program') === code && !params.has('q');

/** Búsqueda del buscador (`?q=…` sin `program`). */
export const matchQuery =
  (text: string): Match =>
  (params) =>
    params.get('q') === text && !params.has('program');

/** Demora la respuesta de las peticiones que cumplan `match`; la prueba fija el retardo, la historia lo da como dato. */
export const delaySuppliers = (page: Page, match: Match, ms: number): Promise<unknown> =>
  page.route(suppliersRoute(match), async (route: Route) => {
    if (route.request().method() !== 'GET') return route.continue();
    await sleep(ms);
    return route.continue();
  });

/** Control de los fallos provocados: se suelta (`release`) cuando la fila ya ha visto el aviso, y dice cuántas peticiones llegaron. */
export interface FaultControl {
  /** Deja de fallar: desde ahora las peticiones que cumplen la coincidencia llegan al servidor. */
  readonly release: () => void;
  /** Peticiones que cumplen la coincidencia y cuántas se respondieron con el error provocado. */
  readonly counts: () => { readonly matched: number; readonly failed: number };
}

/**
 * Responde `status` a las peticiones que cumplan `match` mientras la prueba no las suelte. Así no depende de cuántas peticiones haga la
 * sección (en desarrollo, React repite el efecto y una sola petición fallida podría perderse): todas fallan hasta que la fila ve el aviso.
 * Lleva cabeceras CORS: la web llama a la API desde otro origen, y sin ellas el navegador daría un fallo de red y no el código de la historia.
 */
export const injectFailures = async (page: Page, match: Match, status: number): Promise<FaultControl> => {
  let failing = true;
  let matched = 0;
  let failed = 0;
  await page.route(suppliersRoute(match), async (route: Route) => {
    const request = route.request();
    if (request.method() !== 'GET') return route.continue();
    matched += 1;
    if (!failing) return route.continue();
    failed += 1;
    const origin = request.headers().origin ?? '*';
    return route.fulfill({
      status,
      contentType: 'application/json',
      headers: { 'access-control-allow-origin': origin, 'access-control-expose-headers': '*' },
      body: JSON.stringify({ statusCode: status, error: 'Error', message: 'Error provocado por la prueba' }),
    });
  });
  return {
    release: () => {
      failing = false;
    },
    counts: () => ({ matched, failed }),
  };
};

/** Lo que dice la evidencia de los fallos provocados (para distinguir «no llegó la petición» de «la app no mostró el aviso»). */
export const faultEvidence = (faults: FaultControl): Readonly<Record<string, unknown>> => ({ peticionesProvocadas: faults.counts() });

// --- Comprobaciones compartidas ----------------------------------------------------------------------------------------------------------

/** Campos de la ficha de proveedor (título, NIF, correo y estado), cada uno con su comprobación. */
export const fichaChecks = async (page: Page, name: string, nif: string, correo: string, estado: string): Promise<readonly Check[]> => [
  await seenCheck(fichaOf(page).getByText(`Ficha de proveedor: ${name}`, { exact: true }), `la ficha de proveedor de ${name}`, `la ficha de proveedor de ${name}`),
  await textCheck(page.getByTestId(PROVEEDORES_TESTIDS.SUPPLIER_DETAIL_NIF), nif, 'el NIF'),
  await textCheck(page.getByTestId(PROVEEDORES_TESTIDS.SUPPLIER_DETAIL_EMAIL), correo, 'el «Correo de contacto»'),
  await textCheck(page.getByTestId(PROVEEDORES_TESTIDS.SUPPLIER_DETAIL_BADGE), estado, 'el estado'),
];

/** Línea del contrato `codigo` dentro de la ficha: su nombre, su importe y su fecha de firma, cada uno con su comprobación. */
export const contractChecks = async (page: Page, codigo: string, nombrePrograma: string, importe: string, firma: string): Promise<readonly Check[]> => {
  const leaves = await leavesOf(page.getByTestId(PROVEEDORES_DYNAMIC_TESTIDS.SUPPLIER_CONTRACT(codigo)));
  const has = (text: string): boolean => leaves.some((leaf) => same(leaf, text));
  return [
    check(has(codigo), `el código ${codigo}`, has(codigo) ? `el código ${codigo}` : `códigos y textos de la línea: ${leaves.join(' | ') || '(sin leer)'}`),
    check(has(nombrePrograma), `el nombre de programa ${nombrePrograma}`, has(nombrePrograma) ? `el nombre de programa ${nombrePrograma}` : `no se ve ${nombrePrograma}`),
    check(has(literal(importe)), `el importe ${literal(importe)}`, has(literal(importe)) ? `el importe ${literal(importe)}` : `no se ve el importe ${literal(importe)}`),
    check(has(literal(firma)), `la firma «${literal(firma)}»`, has(literal(firma)) ? `ve «${literal(firma)}»` : `no se ve «${literal(firma)}»`),
  ];
};

/** Enlace del código de una línea de contrato de la ficha (lleva a `/programs/<código>`). */
export const contractLink = (page: Page, codigo: string): Locator => page.getByTestId(PROVEEDORES_DYNAMIC_TESTIDS.SUPPLIER_CONTRACT(codigo)).getByRole('link', { name: codigo, exact: true });

/** Ruta en la que está el navegador (sin dominio). */
export const currentPath = (page: Page): string => pathOf(page);
