import type { Locator, Page, Route } from '@playwright/test';
import { ADMIN_DYNAMIC_TESTIDS, ADMIN_TESTIDS, PROGRAMAS_TESTIDS } from '../../../../packages/shared/src/testids';
import { TENANT_A, resetTenants, type Credentials } from '../../../story-runs/support/prepare';
import { ACTION, CEILING_MS, attrOf, runSteps, safe, textOf, waitUntil, type Step } from '../../support/browser';
import { check, sleep, type Check } from '../../support/checks';
import { outcome, type BrowserRowHandler, type Outcome } from '../../core/framework';
import { ACCOUNTS, ADMIN_A, SEED_ID, signIn } from '../api/common';

// Piezas comunes de las filas WEB de EP-ADMIN-USUARIOS (escritorio 1440 × 900). Los localizadores son de rol y de nombre; los ids de
// prueba solo donde la pantalla no ofrece otro rastro (recuento, filas, interruptores, avisos). Los avisos se leen de un REGISTRO
// instalado ANTES de la acción (`recordToasts`): una lectura que falla o un registro ausente NUNCA cuenta como «ningún aviso».

export const WEB_VIEWPORT = { width: 1440, height: 900 } as const;
export const LOGIN_URL = `/login?tenant=${TENANT_A}`;
export const ADMIN_PATH = '/admin';
export const COOKIE_NOTE = 'La prueba fija la preferencia de cookies (sigpro.cookies = accepted) antes de abrir la app, como el piloto; el aviso de cookies no se ejerce aquí.';
/** Espera del producto para un aviso: 3 s; la ventana de «no aparece» es mayor que su vida. */
export const TOAST_LIFE_MS = 3_000;
export const QUIET_MS = 3_500;
/** Tolerancia de la prueba para una reacción local de la pantalla (1 s). */
export const LOCAL_MS = 1_000;

/** Añade la nota de cookies (preferencia fijada por la prueba) al resultado de cada fila web. */
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

/** Contraseña del seed o de alumno01, por correo (las cuentas de estas historias). */
export const credentialsOf = (email: string): Credentials => {
  const found = ACCOUNTS.get(email);
  if (found === undefined) throw new Error(`cuenta sin credenciales en el seed: ${email}`);
  return found;
};

/** Inicio de sesión por el formulario de la web en alumno01 (la contraseña es la de la fila o la del seed). Termina en /programs. */
export const signInWeb = (page: Page, email: string, password?: string): Promise<string | undefined> => {
  const credentials = { email, password: password ?? credentialsOf(email).password };
  const steps: Step[] = [
    ['fijar la preferencia de cookies', () => page.context().addInitScript(fixCookiePreference)],
    ['instalar el registro de avisos', () => page.context().addInitScript(recordToasts, TOAST_KEY)],
    ['fijar el ancho de la ventana', () => page.setViewportSize(WEB_VIEWPORT)],
    ['abrir /login?tenant=alumno01', () => page.goto(LOGIN_URL, { timeout: CEILING_MS })],
    ['escribir el correo', () => page.getByLabel('Correo electrónico', { exact: true }).fill(credentials.email, ACTION)],
    ['escribir la contraseña', () => page.getByLabel('Contraseña', { exact: true }).fill(credentials.password, ACTION)],
    ['pulsar «Entrar»', () => page.getByRole('button', { name: 'Entrar', exact: true }).click(ACTION)],
    ['llegar a /programs', () => page.waitForURL(/\/programs/, { timeout: CEILING_MS })],
  ];
  return runSteps(steps);
};

/** Reinicio de alumno01 con su administrador (antes de cada fila). Un reinicio que no responde lanza: es del arnés. */
export const resetAlumno = (tenants: readonly string[] = [TENANT_A]): Promise<void> => resetTenants(tenants);

/** Token de alumno01@sigpro.lab (administrador del tenant), o `undefined` si no inicia sesión. */
export const adminAccessToken = async (): Promise<string | undefined> => {
  const result = await signIn(ADMIN_A, TENANT_A);
  const token = result.body !== null && typeof result.body === 'object' ? (result.body as Record<string, unknown>).accessToken : undefined;
  return typeof token === 'string' ? token : undefined;
};

/** Id del seed de una cuenta por su correo (u1…u7), o `undefined` si no es del seed. */
export const seedIdOf = (email: string): string | undefined => SEED_ID.get(email);

// --- Navegación del panel ----------------------------------------------------------------------------------------------------

export const openAdminUsers = (page: Page): Promise<string | undefined> =>
  runSteps([
    ['abrir /admin', () => page.goto(ADMIN_PATH, { timeout: CEILING_MS })],
    ['ver la tabla de usuarios', () => usersTable(page).waitFor({ timeout: CEILING_MS })],
  ]);

export const usersTable = (page: Page): Locator => page.getByTestId(ADMIN_TESTIDS.ADMIN_USERS_TABLE);
export const usersCount = (page: Page): Locator => page.getByTestId(ADMIN_TESTIDS.ADMIN_USERS_COUNT);
export const usersSearch = (page: Page): Locator => page.getByRole('searchbox', { name: 'Buscar usuarios', exact: true });
export const usersEmpty = (page: Page): Locator => page.getByTestId(ADMIN_TESTIDS.ADMIN_USERS_EMPTY);
export const usersError = (page: Page): Locator => page.getByTestId(ADMIN_TESTIDS.ADMIN_USERS_ERROR);
export const usersRetry = (page: Page): Locator => page.getByTestId(ADMIN_TESTIDS.ADMIN_USERS_ERROR_RETRY);
export const userRows = (page: Page): Locator => page.locator('tbody [data-testid^="admin-user-row-"]');
export const rowOf = (page: Page, id: string): Locator => page.getByTestId(ADMIN_DYNAMIC_TESTIDS.ADMIN_USER_ROW(id));
export const roleSelectOf = (page: Page, id: string): Locator => page.getByTestId(ADMIN_DYNAMIC_TESTIDS.ADMIN_USER_ROLE(id));
export const activeSwitchOf = (page: Page, id: string): Locator => page.getByTestId(ADMIN_DYNAMIC_TESTIDS.ADMIN_USER_ACTIVE(id));
export const statusBadgeOf = (page: Page, id: string): Locator => page.getByTestId(ADMIN_DYNAMIC_TESTIDS.ADMIN_USER_STATUS(id));
export const tabOf = (page: Page, key: 'users' | 'audit' | 'chaos' | 'data'): Locator => page.getByTestId(ADMIN_DYNAMIC_TESTIDS.ADMIN_TAB(key));
export const panelOf = (page: Page, key: 'users' | 'audit' | 'chaos' | 'data'): Locator => page.getByTestId(ADMIN_DYNAMIC_TESTIDS.ADMIN_PANEL(key));

/** La tabla no está en carga: el recuento no muestra «…», no hay filas de carga y `aria-busy` es falso. */
export const tableReady = async (page: Page): Promise<boolean> => {
  const count = await textOf(usersCount(page));
  const busy = await attrOf(usersTable(page), 'aria-busy');
  const skeletons = await safe(() => page.getByTestId(PROGRAMAS_TESTIDS.SKELETON_ROW).count(), 1);
  return count !== undefined && !count.includes('…') && busy === 'false' && skeletons === 0;
};

/** Espera (con techo) a que la tabla esté lista. Devuelve si se llegó. */
export const waitTableReady = async (page: Page): Promise<boolean> => (await waitUntil(() => tableReady(page))).reached;

/** Correo de cada fila visible (la segunda celda), en el orden de la tabla. */
export const visibleEmails = async (page: Page): Promise<readonly string[]> => {
  const cells = await safe(() => userRows(page).locator('td:nth-child(2)').allTextContents(), []);
  return cells.map((text) => text.trim());
};

/** Texto visible de una fila: nombre y resto de celdas, sin el avatar (su nombre accesible va en `alt`, no en el texto). */
export const rowNameOf = async (page: Page, id: string): Promise<string | undefined> => textOf(rowOf(page, id).locator('td').first().locator('span.font-medium'));

/** Valor visible del selector de rol: la etiqueta de la opción elegida (no el valor técnico). */
export const selectedRoleLabel = (select: Locator): Promise<string | undefined> =>
  safe(() => select.evaluate((node) => (node as HTMLSelectElement).selectedOptions[0]?.textContent?.trim() ?? '', undefined, { timeout: 1_000 }), undefined);

/** Valor técnico del selector de rol (`admin`, `consultant`…), o `undefined` si no se lee. */
export const roleValueOf = (select: Locator): Promise<string | undefined> => safe(() => select.inputValue({ timeout: 1_000 }), undefined);

/** Estado efectivo del interruptor: `aria-checked` como texto («true» / «false»), o `undefined` si no se lee. */
export const switchChecked = (target: Locator): Promise<string | undefined> => attrOf(target, 'aria-checked');

/** Controles de una fila deshabilitados, con su motivo en `title`. */
export const disabledWithTitle = async (target: Locator): Promise<{ readonly disabled: boolean | undefined; readonly title: string | undefined }> => ({
  disabled: await safe(() => target.first().isDisabled({ timeout: 1_000 }), undefined),
  title: await attrOf(target, 'title'),
});

// --- Avisos: registro instalado antes de la acción ---------------------------------------------------------------------------

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

/** Registro de avisos de la página, o `undefined` si no se puede leer (una lectura fallida nunca es «ningún aviso»). */
export const toastLog = (page: Page): Promise<readonly ToastEntry[] | undefined> =>
  safe(
    () =>
      page.evaluate((key: string) => {
        const log = (window as unknown as Record<string, unknown>)[key];
        return Array.isArray(log) ? (log as ToastEntry[]).map((entry) => ({ ...entry })) : undefined;
      }, TOAST_KEY),
    undefined,
  );

/** Vacía el registro y marca el instante de la acción. Devuelve `true` solo si el registro está instalado y armado. */
export const armToasts = (page: Page): Promise<boolean> =>
  safe(
    () =>
      page.evaluate((key: string) => {
        const registry = window as unknown as Record<string, unknown>;
        const log = registry[key];
        if (!Array.isArray(log)) return false;
        log.length = 0;
        registry.__sigproArmedAt = Date.now();
        return true;
      }, TOAST_KEY),
    false,
  );

export interface ToastResult {
  readonly seen: boolean;
  /** Lo que hay en el registro desde la «armada», en una frase (medido). */
  readonly observed: string;
}

const describeLog = (log: readonly ToastEntry[] | undefined): string => {
  if (log === undefined) return '(registro de avisos no legible)';
  if (log.length === 0) return '(ningún aviso)';
  return log.map((entry) => `${entry.tone} «${entry.title}»${entry.body === '' ? '' : ` / «${entry.body}»`}`).join(' | ');
};

/** Espera (con techo) a un aviso del tono y título dados, y opcionalmente de ese cuerpo exacto. Lee el registro, no la pantalla. */
export const toastShown = async (page: Page, tone: 'ok' | 'danger' | 'info' | 'warn', title: string, body?: string): Promise<ToastResult> => {
  const matches = (entry: ToastEntry): boolean => entry.tone === tone && entry.title === title && (body === undefined || entry.body === body);
  const found = await waitUntil(async () => ((await toastLog(page)) ?? []).some(matches));
  const log = await toastLog(page);
  return { seen: found.reached, observed: describeLog(log) };
};

/** Cuerpo del primer aviso de ese tono y título en el registro (o `undefined` si no hay ni se puede leer). */
export const toastBodyOf = async (page: Page, tone: 'ok' | 'danger' | 'info' | 'warn', title: string): Promise<string | undefined> =>
  ((await toastLog(page)) ?? []).find((entry) => entry.tone === tone && entry.title === title)?.body;

/** Tras una acción, espera la ventana de observación y dice si NO apareció ningún aviso ok. `undefined` si el registro no se puede leer. */
export const quietOk = async (page: Page): Promise<{ readonly held: boolean; readonly seen: string } | undefined> => {
  await sleep(QUIET_MS);
  const log = await toastLog(page);
  if (log === undefined) return undefined;
  const ok = log.filter((entry) => entry.tone === 'ok');
  return { held: ok.length === 0, seen: ok.map((entry) => `«${entry.title}»`).join(', ') };
};

// --- Interceptación de peticiones (fallos, esperas y respuestas de la API) ----------------------------------------------------

/** Cabeceras CORS para una respuesta simulada: la web vive en otro origen que la API. */
export const corsFor = (route: Route): Readonly<Record<string, string>> => ({
  'access-control-allow-origin': route.request().headers().origin ?? '*',
  'access-control-allow-headers': '*',
  'access-control-allow-methods': 'GET, PATCH, POST, OPTIONS',
});

/** Cuerpo de error que devuelve la API (`ApiErrorBody`), con el código dado. */
const REASON_OF: ReadonlyMap<number, string> = new Map<number, string>([
  [404, 'Not Found'],
  [409, 'Conflict'],
  [500, 'Internal Server Error'],
  [503, 'Service Unavailable'],
]);

export const errorBody = (status: number, code: string): string => JSON.stringify({ statusCode: status, error: REASON_OF.get(status) ?? 'Error', message: code, code });

export const isApiPath = (url: URL, suffix: string): boolean => url.pathname.endsWith(suffix);

/** Lectura de una columna de texto: el texto visible de la celda, sin el avatar (ver `rowNameOf`). */
export const cellTextOf = (row: Locator, index: number): Promise<string | undefined> => textOf(row.locator('td').nth(index));

/** Un «Entonces» con el texto visible igual al esperado. */
export const textCheck = (observed: string | undefined, expected: string, what: string): Check =>
  check(observed === expected, `${what} «${expected}»`, `${what} «${observed ?? '(sin texto)'}»`);

/** Un resultado de fila de navegador a partir de sus comprobaciones. */
export const verdict = (checks: readonly Check[], note?: string): Outcome =>
  outcome(
    checks.every((entry) => entry.ok),
    checks.map((entry) => entry.expected).join('; '),
    checks.map((entry) => entry.observed).join('; '),
    note === undefined ? {} : { note },
  );

/** Espera (con techo) a que una condición de la pantalla se cumpla y devuelve si se llegó. */
export const reached = async (condition: () => Promise<boolean>, ceilingMs: number = CEILING_MS): Promise<boolean> => (await waitUntil(condition, ceilingMs)).reached;

