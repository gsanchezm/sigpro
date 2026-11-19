import type { Locator, Page, Route } from '@playwright/test';
import { DEMO, TENANT_A, type Credentials } from '../../../story-runs/support/prepare';
import { REQUISITOS_DYNAMIC_TESTIDS, REQUISITOS_TESTIDS } from '../../../../packages/shared/src/testids';
import { ACTION, CEILING_MS, isVisible, runSteps, safe, waitUntil, type Step } from '../../support/browser';
import { check, sleep, type Check } from '../../support/checks';
import { outcome, type BrowserRowHandler, type Outcome } from '../../core/framework';
import { AUDITOR, CONSULTOR, GESTOR, type Account } from '../api/common';

// Piezas comunes de las filas web de EP-REQ-TRAZA (escritorio 1440 px). Los localizadores son de rol y de nombre accesible; los ids
// de prueba solo donde la pantalla no ofrece otro rastro (la leyenda, la tabla, la fila de cada requisito y el cuerpo vacío). Cada
// lectura tiene plazo corto (2 s) y cada acción sobre un elemento pasa por `interact`, que devuelve el diagnóstico si falla.

/** Plazo de cada lectura de la pantalla: una lectura que no llega en este tiempo queda «sin leer», nunca cumplida. */
export const READ_MS = 2_000;
/** Ventana que se observa tras una acción para afirmar que NO aparece un aviso de éxito (mayor que su vida, 3 s). */
export const QUIET_MS = 4_000;

export const LOGIN_URL = `/login?tenant=${TENANT_A}`;
export const MATRIX_TITLE = 'Matriz de trazabilidad';
export const COOKIE_NOTE = 'La prueba fija la preferencia de cookies (sigpro.cookies = accepted) antes de abrir la app, como el piloto; el aviso de cookies no se ejerce aquí.';

/** Añade a cada resultado la nota de cookies (la preferencia se fija por adelantado para que el aviso no tape controles). */
export const onWeb =
  (handler: BrowserRowHandler): BrowserRowHandler =>
  async (row, fixtures) => {
    const result = await handler(row, fixtures);
    return { ...result, note: result.note === undefined ? COOKIE_NOTE : `${result.note} ${COOKIE_NOTE}` };
  };

/** Solo la preferencia de cookies: no es una sesión. */
const fixCookiePreference = (): void => {
  try {
    localStorage.setItem('sigpro.cookies', 'accepted');
  } catch {
    // sin almacenamiento: no hay preferencia que fijar
  }
};

// --- Cuentas de la pantalla ----------------------------------------------------------------------------------------------------

/** Cuenta de la celda (correo) → credenciales de la pantalla y cuenta de la API (para leer y reiniciar por HTTP). */
export interface UiAccount {
  readonly credentials: Credentials;
  readonly api: Account;
}

export const UI_ACCOUNTS: ReadonlyMap<string, UiAccount> = new Map<string, UiAccount>([
  ['gestor@sigpro.test', { credentials: DEMO.gestor, api: GESTOR }],
  ['consultor@sigpro.test', { credentials: DEMO.consultor, api: CONSULTOR }],
  ['auditor@sigpro.test', { credentials: DEMO.auditor, api: AUDITOR }],
]);

// --- Inicio de sesión y navegación ---------------------------------------------------------------------------------------------

/**
 * Preparación de cada fila: abre /login?tenant=alumno01 en un navegador sin sesión, escribe el correo y la contraseña de la cuenta
 * y pulsa «Entrar». Termina cuando la app llega a /programs con la lista de programas asentada.
 */
export const signIn = (page: Page, credentials: Credentials): Promise<string | undefined> => {
  const steps: Step[] = [
    ['fijar la preferencia de cookies', () => page.context().addInitScript(fixCookiePreference)],
    ['instalar el registro de avisos', () => page.context().addInitScript(recordToasts, TOAST_KEY)],
    ['fijar el ancho de la ventana', () => page.setViewportSize({ width: 1440, height: 900 })],
    ['abrir /login?tenant=alumno01', () => page.goto(LOGIN_URL, { timeout: CEILING_MS })],
    ['escribir el correo', () => page.getByLabel('Correo electrónico', { exact: true }).fill(credentials.email, ACTION)],
    ['escribir la contraseña', () => page.getByLabel('Contraseña', { exact: true }).fill(credentials.password, ACTION)],
    ['pulsar «Entrar»', () => page.getByRole('button', { name: 'Entrar', exact: true }).click(ACTION)],
    ['llegar a /programs', () => page.waitForURL(/\/programs/, { timeout: CEILING_MS })],
    ['ver la lista de programas', async () => {
      if (!(await waitUntil(() => isVisible(page.getByRole('table')))).reached) throw new Error('la lista de programas no aparece');
    }],
    ['armar el registro de avisos', () => armToasts(page)],
  ];
  return runSteps(steps);
};

/** Abre la pantalla de requisitos del programa (pestaña «Árbol» por defecto) y pulsa la pestaña «Matriz de trazabilidad». */
export const openMatrix = (page: Page, program: string): Promise<string | undefined> =>
  runSteps([
    [`abrir /programs/${program}/requirements`, () => page.goto(`/programs/${program}/requirements`, { timeout: CEILING_MS })],
    ['ver las pestañas de requisitos', async () => {
      if (!(await waitUntil(() => isVisible(matrixTab(page)))).reached) throw new Error('las pestañas de requisitos no aparecen');
    }],
    ['pulsar «Matriz de trazabilidad»', () => matrixTab(page).click(ACTION)],
  ]);

// --- Localizadores de la pantalla ------------------------------------------------------------------------------------------------

export const matrixTab = (page: Page): Locator => page.getByRole('tab', { name: MATRIX_TITLE, exact: true });
export const matrixPanel = (page: Page): Locator => page.getByTestId(REQUISITOS_TESTIDS.REQUIREMENTS_PANEL_MATRIX);
export const matrixTable = (page: Page): Locator => matrixPanel(page).getByRole('table', { name: MATRIX_TITLE, exact: true });
export const legendOf = (page: Page): Locator => matrixPanel(page).getByTestId(REQUISITOS_TESTIDS.MATRIX_LEGEND);
export const emptyBlockOf = (page: Page): Locator => matrixPanel(page).getByTestId(REQUISITOS_TESTIDS.MATRIX_EMPTY);
export const rowOf = (page: Page, code: string): Locator => matrixPanel(page).getByTestId(REQUISITOS_DYNAMIC_TESTIDS.MATRIX_ROW(code));
/** Casilla de un cruce: su nombre accesible empieza por «REQ ↔ CASO,» y cambia con el resultado; se localiza por ese prefijo. */
export const cellOf = (page: Page, requirement: string, testCase: string): Locator =>
  matrixPanel(page).getByRole('checkbox', { name: new RegExp(`^${requirement} ↔ ${testCase},`) });
export const headerLink = (page: Page, testCase: string): Locator => matrixTable(page).getByRole('link', { name: testCase, exact: true });
export const loadingOf = (page: Page): Locator => matrixPanel(page).getByRole('status');
export const alertOf = (page: Page): Locator => matrixPanel(page).getByRole('alert');
export const retryButton = (page: Page): Locator => matrixPanel(page).getByRole('button', { name: 'Reintentar', exact: true });

/** Texto normalizado de un elemento (espacios de cualquier clase colapsados), o `undefined` si no se puede leer en el plazo. */
export const textOf = (target: Locator): Promise<string | undefined> =>
  safe(async () => ((await target.first().innerText({ timeout: READ_MS })) ?? '').replace(/\s+/g, ' ').trim(), undefined);

/** Texto visible tal cual (con los saltos de línea), con plazo corto: para leer las líneas de un bloque. */
export const rawTextOf = (target: Locator): Promise<string | undefined> =>
  safe(async () => (await target.first().innerText({ timeout: READ_MS })) ?? undefined, undefined);

/** Líneas visibles de un elemento (título y cuerpo de un aviso, o de un bloque). */
export const linesOf = (text: string | undefined): readonly string[] => (text ?? '').split('\n').map((line) => line.trim()).filter((line) => line !== '');

/** Texto de la leyenda (cifra de cobertura), o `undefined` si no se lee. */
export const coverageText = (page: Page): Promise<string | undefined> => textOf(legendOf(page));

/** Símbolo que pinta la casilla (contenido de su `::after`): «✓», «✕», «!», «·», o «(sin símbolo)» si no pinta nada. */
export const symbolOf = (cell: Locator): Promise<string | undefined> =>
  safe(
    () =>
      cell.first().evaluate(
        (element) => {
          const content = getComputedStyle(element, '::after').content;
          const text = content.replace(/^"(.*)"$/, '$1');
          return text === '' || text === 'none' || text === 'normal' ? '(sin símbolo)' : text;
        },
        undefined,
        { timeout: READ_MS },
      ),
    undefined,
  );

/** Estado de una casilla: marcada, deshabilitada, título, resultado (`data-result`) y símbolo. Cada lectura tiene plazo corto. */
export interface CellState {
  readonly checked: boolean | undefined;
  readonly disabled: boolean | undefined;
  readonly title: string | undefined;
  readonly result: string | undefined;
  readonly symbol: string | undefined;
}

export const cellState = async (cell: Locator): Promise<CellState> => ({
  checked: await safe<boolean | undefined>(() => cell.isChecked({ timeout: READ_MS }), undefined),
  disabled: await safe<boolean | undefined>(() => cell.isDisabled({ timeout: READ_MS }), undefined),
  title: await safe<string | undefined>(async () => (await cell.getAttribute('title', { timeout: READ_MS })) ?? undefined, undefined),
  result: await safe<string | undefined>(async () => (await cell.getAttribute('data-result', { timeout: READ_MS })) ?? undefined, undefined),
  symbol: await symbolOf(cell),
});

/** Estado de una casilla en lenguaje de la historia: «marcado» o «sin marcar» (una lectura fallida no es ninguno de los dos). */
export const markedWord = (checked: boolean | undefined): string | undefined => (checked === undefined ? undefined : checked ? 'marcado' : 'sin marcar');

/** Etiqueta «Sin cobertura» visible en la fila de un requisito (texto de su cabecera). */
export const uncoveredLabelOf = (page: Page, requirement: string): Promise<boolean | undefined> =>
  safe(
    async () => {
      const header = rowOf(page, requirement).getByRole('rowheader');
      const text = ((await header.first().innerText({ timeout: READ_MS })) ?? '').replace(/\s+/g, ' ');
      return text.includes('Sin cobertura');
    },
    undefined,
  );

/** Códigos de los requisitos cuya fila muestra la etiqueta «Sin cobertura» (lectura de todas las filas de la tabla). */
export const labeledRows = (page: Page): Promise<readonly string[] | undefined> =>
  safe(
    async () => {
      const headers = await matrixPanel(page).getByRole('rowheader').allInnerTexts();
      return headers.map((text) => text.replace(/\s+/g, ' ').trim()).filter((text) => text.includes('Sin cobertura')).map((text) => /^(REQ-\d{3})/.exec(text)?.[1] ?? text);
    },
    undefined,
  );

// --- Avisos emergentes: registro desde antes de la acción ----------------------------------------------------------------------

/** Clave del registro de avisos en la ventana del navegador. */
export const TOAST_KEY = '__sigproToasts';

export interface ToastEntry {
  readonly tone: string;
  readonly title: string;
  readonly body: string;
  readonly at: number;
}

/** Se ejecuta en el navegador antes de cargar la app: registra cada aparición de un aviso (sin la cruz de cierre). No usa variables de fuera. */
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
export const armToasts = (page: Page): Promise<unknown> =>
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

/** Registro de avisos desde la última «armada». */
export const toastLog = (page: Page): Promise<readonly ToastEntry[]> =>
  safe(() => page.evaluate((key: string) => ((window as unknown as Record<string, unknown>)[key] as ToastEntry[] | undefined) ?? [], TOAST_KEY), []);

/** Resultado de buscar un aviso: si apareció (con espera de techo) y lo que hay en el registro, en una frase. */
export interface ToastResult {
  readonly seen: boolean;
  readonly observed: string;
}

/** Espera (con techo) a un aviso del tono y título dados, con el cuerpo si se pide; consulta el registro, no la pantalla. */
export const toastShown = async (page: Page, tone: 'ok' | 'danger' | 'info' | 'warn', title: string, body?: string): Promise<ToastResult> => {
  const matches = (entry: ToastEntry): boolean => entry.tone === tone && entry.title === title && (body === undefined || entry.body === body);
  const found = await waitUntil(async () => (await toastLog(page)).some(matches));
  const log = await toastLog(page);
  const observed = log.length === 0 ? '(ningún aviso)' : log.map((entry) => `${entry.tone} «${entry.title}»${entry.body === '' ? '' : ` / «${entry.body}»`}`).join(' | ');
  return { seen: found.reached, observed };
};

/** Tras una acción, espera la ventana de observación y dice si NO apareció ningún aviso de éxito desde la última «armada». */
export const noOkToast = async (page: Page): Promise<{ readonly held: boolean; readonly seen: string }> => {
  await sleep(QUIET_MS);
  const ok = (await toastLog(page)).filter((entry) => entry.tone === 'ok');
  return { held: ok.length === 0, seen: ok.map((entry) => `«${entry.title}»`).join(', ') };
};

// --- Acciones con diagnóstico ----------------------------------------------------------------------------------------------------

export interface Blocked {
  readonly message: string;
  readonly note: string;
}

/** Quién recibe el clic en el centro del elemento, y si es el propio elemento o uno de sus descendientes. */
const hitAtCenter = (node: Element): { readonly hit: string; readonly inside: boolean } => {
  const box = node.getBoundingClientRect();
  const hit = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
  if (hit === null) return { hit: '(ninguno)', inside: false };
  const testid = hit.getAttribute('data-testid');
  return { hit: `${hit.tagName.toLowerCase()}${testid === null ? '' : `[data-testid="${testid}"]`}`, inside: hit === node || node.contains(hit) };
};

/** Diagnóstico de un fallo: primeras líneas del error, la línea «intercepts pointer events» y quién recibe el clic. */
const describeFailure = async (target: Locator, label: string, error: unknown): Promise<Blocked> => {
  const lines = (error instanceof Error ? error.message : String(error)).split('\n').map((line) => line.trim()).filter((line) => line !== '');
  const intercept = lines.find((line) => line.includes('intercepts pointer events'));
  const present = (await safe(() => target.count(), 0)) > 0;
  const message = `no se pudo ${label}: ${lines.slice(0, 3).join(' · ')}${intercept === undefined ? '' : ` · ${intercept}`}`;
  if (!present) return { message, note: `el elemento de «${label}» no existe en la pantalla` };
  const probe = await safe<{ readonly hit: string; readonly inside: boolean } | undefined>(() => target.first().evaluate(hitAtCenter, undefined, { timeout: READ_MS }), undefined);
  if (probe === undefined) return { message: `${message} · recibe el clic: (no se pudo leer)`, note: 'el elemento existe pero no se pudo comprobar qué lo tapa' };
  const note = probe.inside ? 'el elemento existe y recibe el clic en su centro, pero la acción no se completó' : `el elemento existe pero otro lo tapa: ${probe.hit}`;
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

/** Concluye la fila: si alguna comprobación falla, la nota dice lo esperado frente a lo observado (además de la nota de la fila). */
export const concluirWeb = (checks: readonly Check[], extra: { readonly note?: string; readonly evidence?: Readonly<Record<string, unknown>> } = {}): Outcome => {
  const failed = checks.filter((entry) => !entry.ok).map((entry) => `esperaba «${entry.expected}»; se observó «${entry.observed}»`);
  const note = [extra.note, ...failed].filter((part): part is string => part !== undefined && part !== '').join(' · ');
  const expected = checks.map((entry) => entry.expected).join('; ');
  const observed = checks.map((entry) => entry.observed).join('; ');
  return outcome(checks.every((entry) => entry.ok), expected, observed, {
    ...(note === '' ? {} : { note }),
    ...(extra.evidence === undefined ? {} : { evidence: extra.evidence }),
  });
};

/** Texto de una comprobación sobre la leyenda o un aviso: igual exacto, o «sin leer» si no hay texto. */
export const textCheck = (observed: string | undefined, expected: string, what: string): Check =>
  check(observed === expected, `${what} «${expected}»`, `${what} «${observed ?? '(sin leer)'}»`);

// --- Intercepción de la matriz (la prueba fija el retardo o el fallo; la historia lo da como dato) ----------------------------

/** Coincide con GET /api/programs/:code/traceability. */
export const traceabilityRoute =
  (program: string) =>
  (url: URL): boolean =>
    url.pathname.endsWith(`/programs/${program}/traceability`);

/** Cabeceras CORS de una respuesta fabricada: la web llama a la API desde otro origen y sin ellas el navegador daría un fallo de red. */
const corsOf = (route: Route): Record<string, string> => ({ 'access-control-allow-origin': route.request().headers().origin ?? '*', 'access-control-expose-headers': '*' });

/** Control de la demora: `released` pasa a verdadero justo antes de dejar pasar la respuesta (la fila comprueba que el cargador se leyó antes). */
export interface DelayControl {
  released: boolean;
}

/** Demora la respuesta de la matriz (la historia da la espera como dato). Las peticiones que no son GET siguen su curso. */
export const delayMatrix = (page: Page, program: string, ms: number, control: DelayControl): Promise<unknown> =>
  page.route(traceabilityRoute(program), async (route) => {
    if (route.request().method() !== 'GET') return route.continue();
    await sleep(ms);
    control.released = true;
    return route.continue();
  });

/** La matriz ya no carga: aparece la tabla, el estado vacío o el aviso de error (con plazo de techo). */
export const settledMatrix = async (page: Page): Promise<boolean> =>
  (await waitUntil(async () => (await isVisible(matrixTable(page))) || (await isVisible(emptyBlockOf(page))) || (await isVisible(alertOf(page))))).reached;

/**
 * Responde un fallo a la matriz mientras `failing.on` sea verdadero (la prueba lo apaga justo antes de «Reintentar»). `kind` = `500`
 * devuelve un cuerpo de error del servidor; `sin respuesta` corta la conexión. Las demás peticiones pasan.
 */
export const failMatrix = (page: Page, program: string, kind: 'responda 500' | 'no obtenga respuesta', failing: { on: boolean }): Promise<unknown> =>
  page.route(traceabilityRoute(program), async (route) => {
    if (route.request().method() !== 'GET' || !failing.on) return route.continue();
    if (kind === 'no obtenga respuesta') return route.abort('failed');
    return route.fulfill({
      status: 500,
      contentType: 'application/json',
      headers: corsOf(route),
      body: JSON.stringify({ statusCode: 500, error: 'Internal Server Error', message: 'Error provocado por la prueba', code: 'internal_error' }),
    });
  });

/** Texto de la leyenda de un resultado (la etiqueta junto al símbolo), para comprobar qué significa un símbolo. */
export const legendLabelOf = async (page: Page, result: string): Promise<string | undefined> => {
  const text = await safe(async () => ((await matrixPanel(page).locator(`li[data-result="${result}"]`).first().innerText({ timeout: READ_MS })) ?? ''), undefined);
  if (text === undefined) return undefined;
  const lines = linesOf(text);
  return lines[lines.length - 1];
};

