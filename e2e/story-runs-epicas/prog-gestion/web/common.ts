import type { Download, Locator, Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { DEMO, TENANT_A, type Credentials } from '../../../story-runs/support/prepare';
import { PROGRAMAS_DYNAMIC_TESTIDS, PROGRAMAS_TESTIDS, RESPONSIVE_DYNAMIC_TESTIDS } from '../../../../packages/shared/src/testids';
import { ACTION, CEILING_MS, attrOf, isVisible, runSteps, safe, textOf, waitUntil, type Step } from '../../support/browser';
import { check, sleep, type Check } from '../../support/checks';
import { outcome, type BrowserRowHandler, type Outcome } from '../../core/framework';
import { rawExport, sessionFor } from '../api/common';

// Piezas comunes de las filas web de EP-PROG-GESTION (escritorio 1440 px; diseño responsive 390 px, por debajo de 1024). Los
// localizadores son de rol y de nombre; los ids de prueba solo donde la pantalla no ofrece otro rastro (recuento, barra de
// acciones masivas, filas, avisos). Toda acción sobre un elemento de la historia pasa por `interact`: si falla, la nota dice si
// el elemento no existe, si lo tapa otro, o si recibe el clic pero no ocurre la acción.

/** Diseño de la fila: «escritorio» (≥ 1024 px) o «responsive» (< 1024 px). */
export type Layout = 'escritorio' | 'responsive';

export const LAYOUTS: ReadonlyMap<string, Layout> = new Map<string, Layout>([
  ['escritorio', 'escritorio'],
  ['responsive', 'responsive'],
]);

export const viewportOf = (layout: Layout): { readonly width: number; readonly height: number } => (layout === 'escritorio' ? { width: 1440, height: 900 } : { width: 390, height: 844 });

export const LOGIN_URL = `/login?tenant=${TENANT_A}`;
export const PROGRAMS_PATH = '/programs';
export const CSV_NAME = 'sigpro-programas.csv';
const CODE = /^PRG-\d{3}/;
/** Espera tras una acción que no tiene respuesta visible propia (la lista se relee en segundo plano). */
const SETTLE_MS = 1_000;

// --- Preferencia de cookies (no es una sesión) y nota de cada fila web ---------------------------------------------------

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

// --- Cuentas e inicio de sesión por el formulario ------------------------------------------------------------------------

export type AccountName = 'gestor' | 'consultor' | 'auditor' | 'admin';

/** Cuenta de la celda (correo) → credenciales del seed. */
export const ACCOUNT_BY_EMAIL: ReadonlyMap<string, AccountName> = new Map<string, AccountName>([
  ['gestor@sigpro.test', 'gestor'],
  ['consultor@sigpro.test', 'consultor'],
  ['auditor@sigpro.test', 'auditor'],
  ['admin@sigpro.test', 'admin'],
]);

const CREDENTIALS_OF: Readonly<Record<AccountName, Credentials>> = { gestor: DEMO.gestor, consultor: DEMO.consultor, auditor: DEMO.auditor, admin: DEMO.admin };

export const MFA_CODE = '123456';
const mfaHeading = (page: Page): Locator => page.getByRole('heading', { name: 'Verificación en dos pasos', exact: true });
const mfaField = (page: Page): Locator => page.getByLabel('Código de verificación', { exact: true });

/**
 * Preparación de cada fila: fija la preferencia de cookies, el ancho de la ventana, abre /login?tenant=alumno01, escribe la cuenta
 * con su contraseña y pulsa «Entrar». El administrador pasa por «Verificación en dos pasos» con 123456. Termina en /programs con
 * la lista asentada.
 */
export const signIn = (page: Page, layout: Layout, account: AccountName): Promise<string | undefined> => {
  const credentials = CREDENTIALS_OF[account];
  const steps: Step[] = [
    ['fijar la preferencia de cookies', () => page.context().addInitScript(fixCookiePreference)],
    ['instalar el registro de avisos', () => page.context().addInitScript(recordToasts, TOAST_KEY)],
    ['fijar el ancho de la ventana', () => page.setViewportSize(viewportOf(layout))],
    ['abrir /login?tenant=alumno01', () => page.goto(LOGIN_URL, { timeout: CEILING_MS })],
    ['escribir el correo', () => page.getByLabel('Correo electrónico', { exact: true }).fill(credentials.email, ACTION)],
    ['escribir la contraseña', () => page.getByLabel('Contraseña', { exact: true }).fill(credentials.password, ACTION)],
    ['pulsar «Entrar»', () => page.getByRole('button', { name: 'Entrar', exact: true }).click(ACTION)],
  ];
  if (account === 'admin') {
    steps.push(
      ['ver «Verificación en dos pasos»', () => mfaHeading(page).waitFor({ timeout: CEILING_MS })],
      ['escribir el código 123456', () => mfaField(page).pressSequentially(MFA_CODE, { delay: 0 })],
      ['pulsar «Verificar»', () => page.getByRole('button', { name: 'Verificar', exact: true }).click(ACTION)],
    );
  }
  steps.push(
    ['llegar a /programs', () => page.waitForURL(/\/programs/, { timeout: CEILING_MS })],
    ['ver la lista de programas', () => settledOrThrow(page, layout)],
    ['armar el registro de avisos', () => armToasts(page)],
  );
  return runSteps(steps);
};

/** Abre /programs con una sesión ya iniciada en la misma página (sin quitar filtros). */
export const openPrograms = (page: Page, layout: Layout): Promise<string | undefined> =>
  runSteps([
    ['abrir /programs', () => page.goto(PROGRAMS_PATH, { timeout: CEILING_MS })],
    ['ver la lista de programas', () => settledOrThrow(page, layout)],
  ]);

const settledOrThrow = async (page: Page, layout: Layout): Promise<void> => {
  if (!(await waitSettled(page, layout))) throw new Error('la lista de programas no aparece');
};

// --- Acciones con diagnóstico --------------------------------------------------------------------------------------------

export interface Blocked {
  readonly message: string;
  readonly note: string;
  /** Datos crudos del fallo (quién recibe el clic, si está dentro del elemento). */
  readonly evidence?: Readonly<Record<string, unknown>>;
}

/** Quién recibe el clic en el centro de un elemento, y si ese elemento es el propio objetivo o uno de sus descendientes. */
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

/** Lo que se registra de un clic o escritura fallida: primeras líneas del error, la línea «intercepts pointer events» y quién recibe el clic. */
const describeFailure = async (target: Locator, label: string, error: unknown): Promise<Blocked> => {
  const lines = (error instanceof Error ? error.message : String(error)).split('\n').map((line) => line.trim()).filter((line) => line !== '');
  const intercept = lines.find((line) => line.includes('intercepts pointer events'));
  const present = (await safe(() => target.count(), 0)) > 0;
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

// --- Localizadores de la lista ----------------------------------------------------------------------------------------------

export const listOf = (page: Page, layout: Layout): Locator => (layout === 'escritorio' ? page.getByRole('table') : page.getByRole('list', { name: 'Programas', exact: true }));
export const searchBox = (page: Page, layout: Layout): Locator => page.getByRole('searchbox', { name: layout === 'escritorio' ? 'Búsqueda global' : 'Buscar programas', exact: true });
export const statusSelect = (page: Page): Locator => page.getByRole('combobox', { name: 'Estado', exact: true });
export const ownerCombobox = (page: Page): Locator => page.getByRole('combobox', { name: 'Responsable', exact: true });
export const nextPageButton = (page: Page): Locator => page.getByRole('button', { name: 'Página siguiente', exact: true });
export const exportButton = (page: Page): Locator => page.getByTestId(PROGRAMAS_TESTIDS.PROGRAMS_EXPORT_CSV);
export const recountOf = (page: Page): Locator => page.getByTestId(PROGRAMAS_TESTIDS.PROGRAMS_COUNT);
export const bulkBar = (page: Page): Locator => page.getByTestId(PROGRAMAS_TESTIDS.PROGRAMS_BULK_BAR);
export const bulkCount = (page: Page): Locator => page.getByTestId(PROGRAMAS_TESTIDS.PROGRAMS_BULK_COUNT);

/** Fila de un programa: la de la tabla (escritorio) o la tarjeta (responsive). */
export const rowOf = (page: Page, layout: Layout, code: string): Locator =>
  layout === 'escritorio' ? page.getByTestId(PROGRAMAS_DYNAMIC_TESTIDS.PROGRAMS_ROW(code)) : page.getByTestId(RESPONSIVE_DYNAMIC_TESTIDS.PROGRAMS_ROW(code));

export const checkboxOf = (page: Page, code: string): Locator => page.getByRole('checkbox', { name: `Seleccionar ${code}`, exact: true });
export const headerCheckbox = (page: Page): Locator => page.getByRole('checkbox', { name: 'Seleccionar todos los programas de la página', exact: true });
export const menuButtonOf = (page: Page, code: string): Locator => page.getByRole('button', { name: `Acciones para ${code}`, exact: true });
export const deleteDialog = (page: Page): Locator => page.getByRole('alertdialog', { name: 'Eliminar programa', exact: true });

/** La lista está montada y ya no muestra filas de carga (la primera respuesta llegó, sea buena o de error). */
const waitSettled = async (page: Page, layout: Layout): Promise<boolean> =>
  (await waitUntil(async () => (await isVisible(listOf(page, layout))) && (await safe(() => page.getByTestId(PROGRAMAS_TESTIDS.SKELETON_ROW).count(), 1)) === 0)).reached;

/** Códigos de los programas que se ven, en el orden de la pantalla. */
export const listedCodes = async (page: Page, layout: Layout): Promise<readonly string[]> => {
  const texts = await listOf(page, layout).getByRole('link', { name: CODE }).allTextContents();
  return texts.map((text) => CODE.exec(text.trim())?.[0]).filter((code): code is string => code !== undefined);
};

export const sameList = (actual: readonly string[], expected: readonly string[]): boolean => actual.length === expected.length && actual.every((code, index) => code === expected[index]);

/** Espera (con techo) a que la lista muestre `codes` y el recuento `count`, si se da; devuelve lo que se ve al final. */
export const waitForList = async (page: Page, layout: Layout, codes: readonly string[], count?: string): Promise<{ readonly codes: readonly string[]; readonly count: string | undefined }> => {
  await waitUntil(async () => sameList(await listedCodes(page, layout), codes) && (count === undefined || (await recountText(page)) === count));
  return { codes: await listedCodes(page, layout), count: await recountText(page) };
};

export const recountText = (page: Page): Promise<string | undefined> => textOf(recountOf(page));

/** Trozos de un texto visible: las celdas de una tabla van separadas por tabulador y los bloques por salto de línea. */
export const tokensOf = (text: string | undefined): readonly string[] =>
  (text ?? '')
    .split(/[\n\t]+/)
    .map((piece) => piece.trim())
    .filter((piece) => piece !== '');

/** Bloque «Sin programas» (id de prueba: el bloque vacío es el único contenedor que lo agrupa). */
export const emptyBlock = (page: Page): Locator => page.getByTestId(PROGRAMAS_TESTIDS.PROGRAMS_EMPTY);

/** Recuento que muestra la lista (página 1 de 10) para `total` programas que cumplen los filtros. */
export const recountFor = (total: number): string => (total === 0 ? '0–0 de 0' : `1–${Math.min(10, total)} de ${total}`);

/** Estado (texto) de una fila, leído de su contenido: una línea exacta entre los estados del catálogo. */
const STATE_LABELS: readonly string[] = ['Borrador', 'Activo', 'En pausa', 'Cerrado', 'Cancelado'];
export const stateOfRow = async (page: Page, layout: Layout, code: string): Promise<string | undefined> => {
  const badge = await textOf(rowOf(page, layout, code).getByTestId(PROGRAMAS_TESTIDS.PROGRAMS_STATE_BADGE));
  return badge !== undefined && STATE_LABELS.includes(badge) ? badge : undefined;
};

/** Texto visible de una fila (sus líneas), para comprobar el nombre de un programa. */
export const rowLines = async (page: Page, layout: Layout, code: string): Promise<readonly string[]> => tokensOf(await textOf(rowOf(page, layout, code)));

// --- Avisos emergentes y descargas -------------------------------------------------------------------------------------------

// --- Avisos emergentes: registro desde antes de la acción ----------------------------------------------------------------------

/** Clave del registro de avisos en la ventana del navegador. */
export const TOAST_KEY = '__sigproToasts';
/** Ventana que se observa tras una acción para afirmar que NO aparece un aviso de éxito: mayor que su vida (3 s). */
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

/** Registro de avisos de la página desde la última «armada». */
export const toastLog = (page: Page): Promise<readonly ToastEntry[]> =>
  safe(() => page.evaluate((key: string) => ((window as unknown as Record<string, unknown>)[key] as ToastEntry[] | undefined) ?? [], TOAST_KEY), []);

/** Instante (hora de la página) en que se armó el registro: el de la acción que se prueba. */
const armedAt = (page: Page): Promise<number> => safe(() => page.evaluate(() => Number((window as unknown as Record<string, unknown>).__sigproArmedAt ?? 0)), 0);

/** Vacía el registro y marca el instante de la acción que se va a probar. Devuelve ese instante. */
export const armToasts = (page: Page): Promise<number> =>
  safe(
    () =>
      page.evaluate((key: string) => {
        const registry = window as unknown as Record<string, unknown>;
        const log = registry[key];
        if (Array.isArray(log)) log.length = 0;
        const at = Date.now();
        registry.__sigproArmedAt = at;
        return at;
      }, TOAST_KEY),
    Date.now(),
  );

export interface ToastResult {
  readonly seen: boolean;
  /** Lo que hay en el registro desde la «armada», en una frase. */
  readonly observed: string;
  /** Marca de tiempo de la primera aparición del aviso buscado. */
  readonly firstAt?: number;
  /** Milisegundos desde la «armada» hasta esa primera aparición. */
  readonly delayMs?: number;
}

/**
 * Busca en el registro un aviso del tono con ese título y, si se da, ese cuerpo. Consulta el registro, no la pantalla: el aviso dura
 * 3 s y el registro lo guarda aunque ya no se vea. Espera (con techo) a que aparezca.
 */
export const toastShown = async (page: Page, tone: 'ok' | 'danger' | 'info' | 'warn', title: string, body?: string): Promise<ToastResult> => {
  const matches = (entry: ToastEntry): boolean => entry.tone === tone && entry.title === title && (body === undefined || entry.body === body);
  const found = await waitUntil(async () => (await toastLog(page)).some(matches));
  const log = await toastLog(page);
  const hit = log.find(matches);
  const armed = await armedAt(page);
  const observed = log.length === 0 ? '(ninguno)' : log.map((entry) => `${entry.tone} «${entry.title}»${entry.body === '' ? '' : ` / «${entry.body}»`}`).join(' | ');
  return { seen: found.reached, observed, ...(hit === undefined ? {} : { firstAt: hit.at, delayMs: hit.at - armed }) };
};

/**
 * Tras una acción que termina en `endedAt`, espera la ventana de observación (mayor que la vida del aviso) y dice si NO apareció
 * ningún aviso de éxito desde la última «armada». Consulta el registro, así que un aviso ya cerrado también cuenta.
 */
export const noOkToast = async (page: Page, endedAt: number): Promise<{ readonly held: boolean; readonly seen: string }> => {
  const remaining = endedAt + QUIET_WINDOW_MS - Date.now();
  if (remaining > 0) await sleep(remaining);
  const ok = (await toastLog(page)).filter((entry) => entry.tone === 'ok');
  return { held: ok.length === 0, seen: ok.map((entry) => `«${entry.title}»`).join(', ') };
};

/** Marca de la primera aparición de un aviso del tono y título dados en el registro (undefined si no aparece). */
export const firstToastAt = async (page: Page, tone: 'ok' | 'danger' | 'info' | 'warn', title: string): Promise<number | undefined> =>
  (await toastLog(page)).find((entry) => entry.tone === tone && entry.title === title)?.at;

/** Evidencia de tiempos: clic de la acción, respuesta de la API y primera aparición del aviso (ms desde el clic). Más de 10 s se anota. */
export const timingOf = (clickAt: number, firstAt: number | undefined, responseAt?: number): { readonly evidence: Readonly<Record<string, unknown>>; readonly note?: string } => {
  const firstMs = firstAt === undefined ? undefined : firstAt - clickAt;
  const late = firstMs !== undefined && firstMs > 10_000;
  return {
    evidence: { clicMs: clickAt, respuestaApiMs: responseAt === undefined ? undefined : responseAt - clickAt, primeraAparicionAvisoMs: firstMs },
    ...(late ? { note: `el aviso aparece tarde: ${firstMs} ms desde el clic (más de 10 s)` } : {}),
  };
};

/** Instante de la primera respuesta de la API con ese método sobre una ruta que empieza por `prefix`, desde que se llama. */
export const watchResponse = (page: Page, method: string, prefix: string): (() => number | undefined) => {
  let at: number | undefined;
  page.on('response', (response) => {
    if (at === undefined && response.request().method() === method && new URL(response.url()).pathname.startsWith(prefix)) at = Date.now();
  });
  return () => at;
};

/** Texto de la exportación de la API con esos filtros y la cuenta dada: la misma descarga que hace la web. `undefined` si no hay sesión. */
export const apiExport = async (account: AccountName, query: string | undefined): Promise<string | undefined> => {
  const session = await sessionFor(account);
  if (session.token === undefined) return undefined;
  return (await rawExport(query, session.token)).text;
};

/** Descarga que dispara `trigger`: devuelve el nombre sugerido y el texto del archivo. Un fallo lanza (la fila lo recoge). */
export const downloadAfter = async (page: Page, trigger: () => Promise<unknown>): Promise<{ readonly name: string; readonly text: string }> => {
  const pending = page.waitForEvent('download', { timeout: CEILING_MS });
  // Si la acción falla antes de la descarga, la promesa no se deja sin atender
  pending.catch(() => undefined);
  await trigger();
  const download: Download = await pending;
  const path = await download.path();
  if (path === null) throw new Error('la descarga no dejó archivo');
  return { name: download.suggestedFilename(), text: await readFile(path, 'utf8') };
};

/** Códigos de las filas de un CSV de programas (primera columna, sin la cabecera). */
export const codesOfCsv = (text: string): readonly string[] =>
  text
    .split('\n')
    .slice(1)
    .map((line) => line.split(';')[0] ?? '')
    .filter((code) => code !== '');

// --- Comprobaciones ----------------------------------------------------------------------------------------------------------

/** Un «Entonces» con el texto visible igual al esperado (`observed` ya leído). */
export const textCheck = (observed: string | undefined, expected: string, what: string): Check =>
  check(observed === expected, `${what} «${expected}»`, `${what} «${observed ?? '(sin texto)'}»`);

/** Un control habilitado o deshabilitado; si se pide deshabilitado, con su motivo en `title`. */
export const stateCheck = async (target: Locator, expected: 'habilitado' | 'deshabilitado', reason?: string): Promise<Check> => {
  const disabled = await safe(() => target.first().isDisabled({ timeout: 500 }), undefined);
  const title = await attrOf(target, 'title');
  const enabledNow = disabled === undefined ? undefined : !disabled;
  const observed = enabledNow === undefined ? '(sin leer)' : enabledNow ? 'habilitado' : `deshabilitado${title ? `, con el motivo «${title}»` : ''}`;
  const reasonOk = reason === undefined || title === reason;
  const ok = expected === 'habilitado' ? enabledNow === true : enabledNow === false && reasonOk;
  return check(ok, reason === undefined ? expected : `${expected}, con el motivo «${reason}»`, observed);
};

/** Tolerancia de la prueba para una reacción local de la pantalla (1 s): no es un plazo del producto. */
export const settle = (): Promise<void> => sleep(SETTLE_MS);

/** Valor de una celda de estado de la historia: «habilitada» / «deshabilitada, con el motivo «X»». Otra forma LANZA. */
export const parseEnabled = (text: string): { readonly enabled: boolean; readonly reason?: string } => {
  if (text === 'habilitada' || text === 'habilitado') return { enabled: true };
  const match = /^deshabilitad[ao], con el motivo «(.+)»$/.exec(text);
  if (match?.[1]) return { enabled: false, reason: match[1] };
  throw new Error(`celda sin interpretación: estado «${text}»`);
};

/** Cuenta de la fila → nombre de cuenta; cualquier otro correo LANZA. */
export const accountOf = (email: string): AccountName => {
  const account = ACCOUNT_BY_EMAIL.get(email);
  if (account === undefined) throw new Error(`celda sin interpretación: cuenta «${email}»`);
  return account;
};

/** Códigos de una celda: «PRG-001 a PRG-024», «PRG-004, PRG-012 y PRG-020» o «PRG-001». Otra forma lanza. */
export const codesOf = (text: string): readonly string[] => {
  const range = /^(PRG-\d{3}) a (PRG-\d{3})$/.exec(text);
  if (range?.[1] !== undefined && range[2] !== undefined) {
    const from = Number(range[1].slice(4));
    const to = Number(range[2].slice(4));
    return Array.from({ length: to - from + 1 }, (_, index) => `PRG-${String(from + index).padStart(3, '0')}`);
  }
  const parts = text.split(/, | y /);
  if (!parts.every((code) => /^PRG-\d{3}$/.test(code))) throw new Error(`celda sin interpretación: códigos «${text}»`);
  return parts;
};

// --- Acciones componibles ----------------------------------------------------------------------------------------------------

/** Una acción de la fila sobre la pantalla: devuelve su diagnóstico si falla, o `undefined` si sale bien. */
export type WebAction = (page: Page) => Promise<Blocked | undefined>;

/** Ejecuta las acciones en orden; a la primera que falla devuelve su diagnóstico. */
export const inOrder =
  (...actions: readonly WebAction[]): WebAction =>
  async (page) => {
    for (const action of actions) {
      const blocked = await action(page);
      if (blocked !== undefined) return blocked;
    }
    return undefined;
  };

/** Pulsa un elemento localizado por `locate` (con su nombre en el diagnóstico). */
export const clickIn = (locate: (page: Page) => Locator, label: string): WebAction => (page) => interact(locate(page), label, (element) => element.click(ACTION));

/** Marca o desmarca la casilla de la fila de un programa. */
export const toggleRow = (code: string, on: boolean): WebAction => (page) =>
  interact(checkboxOf(page, code), `${on ? 'marcar' : 'desmarcar'} «Seleccionar» de ${code}`, (element) => (on ? element.check(ACTION) : element.uncheck(ACTION)));

/** Marca o desmarca la casilla cabecera (todas las filas de la página). */
export const toggleHeader = (on: boolean): WebAction => (page) =>
  interact(headerCheckbox(page), `${on ? 'marcar' : 'desmarcar'} «Seleccionar todos los programas de la página»`, (element) => (on ? element.check(ACTION) : element.uncheck(ACTION)));

/** Abre el menú de acciones de un programa (⋯ en escritorio, hoja en responsive). */
export const openRowActions = (code: string): WebAction => clickIn((page) => menuButtonOf(page, code), `abrir «Acciones para ${code}»`);

/** Una acción del menú o de la hoja abierta de un programa (botón o enlace con ese nombre). */
export const actionItem = (page: Page, layout: Layout, code: string, name: string): Locator =>
  layout === 'escritorio'
    ? page.getByRole('menu', { name: `Acciones para ${code}`, exact: true }).getByRole('menuitem', { name, exact: true })
    : page.getByRole('dialog', { name: `Acciones para ${code}`, exact: true }).getByRole('button', { name, exact: true }).or(page.getByRole('dialog', { name: `Acciones para ${code}`, exact: true }).getByRole('link', { name, exact: true }));

/** Pulsa una acción del menú abierto de un programa. */
export const pressAction = (layout: Layout, code: string, name: string): WebAction => clickIn((page) => actionItem(page, layout, code, name), `pulsar «${name}» en las acciones de ${code}`);

/** Acciones de la barra de acciones masivas (botón con ese nombre dentro de la barra). */
export const bulkButton = (name: string): WebAction => clickIn((page) => bulkBar(page).getByRole('button', { name, exact: true }), `pulsar «${name}» en la barra de acciones masivas`);

/** Botón de «Eliminar» o «Cancelar» dentro del diálogo de borrado abierto. */
export const dialogButton = (name: string): WebAction => clickIn((page) => deleteDialog(page).getByRole('button', { name, exact: true }), `pulsar «${name}» en el diálogo`);

/** Texto (normalizado: espacios colapsados) de un elemento, o `undefined`. */
export const normalized = async (target: Locator): Promise<string | undefined> => {
  const text = await textOf(target);
  return text === undefined ? undefined : text.replace(/\s+/g, ' ').trim();
};

/** Elige un estado en «Estado» (el selector del filtro de la lista). */
export const chooseStatus = (label: string): WebAction => (page) => interact(statusSelect(page), `elegir «${label}» en «Estado»`, (element) => element.selectOption({ label }, ACTION));

// --- Lecturas para las reglas de la lista: selección, panel lateral y página ----------------------------------------------------

/** Casillas de programa marcadas en la página (-1 si no se pudo leer). */
export const checkedRowCount = (page: Page): Promise<number> =>
  safe(() => page.getByRole('checkbox', { name: /^Seleccionar PRG-\d{3}$/ }).evaluateAll((elements) => elements.filter((element) => (element as HTMLInputElement).checked).length), -1);

/** ¿Hay un panel lateral de detalle abierto? Su nombre accesible es «Detalle de PRG-…». */
export const detailPanelOpen = (page: Page): Promise<boolean> => isVisible(page.locator('[aria-label^="Detalle de PRG-"]'));

/** La página sigue en /programs sin cambiar de página (sin «page» en la dirección). */
export const stillOnPrograms = (page: Page): boolean => {
  const url = new URL(page.url());
  return url.pathname === '/programs' && !url.searchParams.has('page');
};
