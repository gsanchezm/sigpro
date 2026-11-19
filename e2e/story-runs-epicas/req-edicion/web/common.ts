import type { Locator, Page } from '@playwright/test';
import { DEMO, TENANT_A, type Credentials } from '../../../story-runs/support/prepare';
import { REQUISITOS_DYNAMIC_TESTIDS, REQUISITOS_TESTIDS } from '../../../../packages/shared/src/testids';
import { ACTION, CEILING_MS, holdsFor, runSteps, safe, textOf, waitUntil, type Step } from '../../support/browser';
import { check, sleep, type Check } from '../../support/checks';
import { outcome, type BrowserRowHandler, type Outcome } from '../../core/framework';

// Piezas comunes de las filas web de EP-REQ-EDICION (escritorio 1440 × 900). Los localizadores son de rol y de nombre; los ids de
// prueba solo donde la pantalla no ofrece otro rastro (filas del árbol, menú de la fila, diálogo, panel). Toda acción sobre un
// elemento de la historia pasa por `interact`: si falla, la nota dice si el elemento no existe, si lo tapa otro, o si recibe el clic
// pero no ocurre la acción. Los avisos se leen de un registro instalado ANTES de la acción (dura 3 s).

export const VIEWPORT = { width: 1440, height: 900 } as const;
export const LOGIN_URL = `/login?tenant=${TENANT_A}`;
export const REQUIREMENTS_PATH = '/programs/PRG-001/requirements';
const SETTLE_MS = 1_000;

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

// --- Cuentas e inicio de sesión por el formulario -----------------------------------------------------------------------------

export type AccountName = 'gestor' | 'consultor' | 'auditor';

/** Correo de la celda → cuenta del seed (cualquier otro correo LANZA al usarse con `strict`). */
export const ACCOUNT_BY_EMAIL: ReadonlyMap<string, AccountName> = new Map<string, AccountName>([
  ['gestor@sigpro.test', 'gestor'],
  ['consultor@sigpro.test', 'consultor'],
  ['auditor@sigpro.test', 'auditor'],
]);

const CREDENTIALS_OF: Readonly<Record<AccountName, Credentials>> = { gestor: DEMO.gestor, consultor: DEMO.consultor, auditor: DEMO.auditor };

/**
 * Preparación de cada fila: instala el registro de avisos y la preferencia de cookies, fija el ancho de la ventana, abre
 * /login?tenant=alumno01, escribe la cuenta con su contraseña y pulsa «Entrar». Termina con la lista de requisitos en pantalla.
 */
export const signIn = (page: Page, account: AccountName): Promise<string | undefined> => {
  const credentials = CREDENTIALS_OF[account];
  const steps: Step[] = [
    ['fijar la preferencia de cookies', () => page.context().addInitScript(fixCookiePreference)],
    ['instalar el registro de avisos', () => page.context().addInitScript(recordToasts, TOAST_KEY)],
    ['fijar el ancho de la ventana', () => page.setViewportSize(VIEWPORT)],
    ['abrir /login?tenant=alumno01', () => page.goto(LOGIN_URL, { timeout: CEILING_MS })],
    ['escribir el correo', () => page.getByLabel('Correo electrónico', { exact: true }).fill(credentials.email, ACTION)],
    ['escribir la contraseña', () => page.getByLabel('Contraseña', { exact: true }).fill(credentials.password, ACTION)],
    ['pulsar «Entrar»', () => page.getByRole('button', { name: 'Entrar', exact: true }).click(ACTION)],
    ['llegar a /programs', () => page.waitForURL(/\/programs/, { timeout: CEILING_MS })],
  ];
  return runSteps(steps);
};

/** Abre el árbol de requisitos de PRG-001 y espera a que la lista esté cargada. */
export const openRequirements = (page: Page): Promise<string | undefined> =>
  runSteps([
    ['abrir /programs/PRG-001/requirements', () => page.goto(REQUIREMENTS_PATH, { timeout: CEILING_MS })],
    ['ver el árbol de requisitos', () => tree(page).waitFor({ timeout: CEILING_MS })],
    ['ver la lista cargada', () => sleep(SETTLE_MS)],
    ['armar el registro de avisos', () => armToasts(page)],
  ]);

// --- Acciones con diagnóstico ----------------------------------------------------------------------------------------------------

export interface Blocked {
  readonly message: string;
  readonly note: string;
  readonly evidence?: Readonly<Record<string, unknown>>;
}

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

/** Pulsa un elemento localizado por `locate`. */
export const clickIn = (locate: (page: Page) => Locator, label: string): WebAction => (page) => interact(locate(page), label, (element) => element.click(ACTION));

// --- Localizadores del árbol y del menú de la fila --------------------------------------------------------------------------------

export const tree = (page: Page): Locator => page.getByRole('tree', { name: 'Árbol de requisitos', exact: true });
/** Fila del árbol de un requisito: rol `treeitem` cuyo nombre empieza por su código. */
export const rowOf = (page: Page, code: string): Locator => page.getByRole('treeitem', { name: `${code} ` }).or(page.getByTestId(REQUISITOS_DYNAMIC_TESTIDS.REQUIREMENT_ROW(code)));
/** Botón ⋯ de la fila (nombre «Acciones para REQ-…»). */
export const rowMenuOf = (page: Page, code: string): Locator => page.getByRole('button', { name: `Acciones para ${code}`, exact: true }).or(page.getByTestId(REQUISITOS_DYNAMIC_TESTIDS.REQUIREMENT_ROW_MENU(code)));
/** Menú de la fila abierto (rol `menu` con el nombre «Acciones para REQ-…»). */
export const menuOf = (page: Page, code: string): Locator => page.getByRole('menu', { name: `Acciones para ${code}`, exact: true });
/** Elemento del menú de la fila por su nombre. */
export const menuItem = (page: Page, code: string, name: string): Locator => menuOf(page, code).getByRole('menuitem', { name, exact: true });
/** Título de la fila (botón que abre el detalle y, con doble clic, edita en línea). */
export const titleButtonOf = (page: Page, code: string): Locator => page.getByTestId(REQUISITOS_DYNAMIC_TESTIDS.REQUIREMENT_OPEN(code));
/** Diálogo «Nuevo requisito». */
export const newDialog = (page: Page): Locator => page.getByRole('dialog', { name: 'Nuevo requisito', exact: true }).or(page.getByTestId(REQUISITOS_TESTIDS.REQUIREMENT_NEW_DIALOG));
/** Botón «Nuevo requisito» de la cabecera de la lista. */
/** Nombre accesible del botón es «+ Nuevo requisito» (el «+» es texto; la «N» de atajo va oculta): se compara el nombre entero. */
export const newButton = (page: Page): Locator => page.getByRole('button', { name: /^\+ ?Nuevo requisito$/ }).or(page.getByTestId(REQUISITOS_TESTIDS.REQUIREMENTS_NEW));
/** Panel de detalle del requisito abierto. */
export const detailPanel = (page: Page): Locator => page.getByTestId(REQUISITOS_TESTIDS.REQUIREMENT_DETAIL);

/** Nombre de un elemento del árbol sin el prefijo de su código (la vista del título). */
export const titleOfRow = async (page: Page, code: string): Promise<string | undefined> => textOf(titleButtonOf(page, code));

// --- Avisos emergentes: registro desde antes de la acción ------------------------------------------------------------------------

export const TOAST_KEY = '__sigproToasts';
/** Ventana que se observa para afirmar que NO aparece un aviso: mayor que su vida (3 s). */
export const QUIET_WINDOW_MS = 4_000;

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

/** Vacía el registro y marca el instante de la acción que se va a probar. */
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

/** Un aviso del tono y título (y cuerpo, si se da) aparece en el registro desde la «armada»; espera con techo. */
export const toastShown = async (page: Page, tone: 'ok' | 'danger' | 'info' | 'warn', title: string, body?: string): Promise<{ readonly seen: boolean; readonly observed: string }> => {
  const matches = (entry: ToastEntry): boolean => entry.tone === tone && entry.title === title && (body === undefined || entry.body === body);
  const found = await waitUntil(async () => (await toastLog(page)).some(matches));
  const log = await toastLog(page);
  const observed = log.length === 0 ? '(ninguno)' : log.map((entry) => `${entry.tone} «${entry.title}»${entry.body === '' ? '' : ` / «${entry.body}»`}`).join(' | ');
  return { seen: found.reached, observed };
};

/** Tras una acción que termina en `endedAt`, espera la ventana de observación y dice si NO apareció ningún aviso de éxito. */
export const noOkToast = async (page: Page, endedAt: number): Promise<{ readonly held: boolean; readonly seen: string }> => {
  const remaining = endedAt + QUIET_WINDOW_MS - Date.now();
  if (remaining > 0) await sleep(remaining);
  const ok = (await toastLog(page)).filter((entry) => entry.tone === 'ok');
  return { held: ok.length === 0, seen: ok.map((entry) => `«${entry.title}»`).join(', ') };
};

// --- Comprobaciones reutilizables -------------------------------------------------------------------------------------------------

/** «Habilitado» / «deshabilitado» con su explicación (atributo `title`), leídos del elemento. */
export const stateCheck = async (target: Locator, expected: 'habilitado' | 'deshabilitado', reason?: string): Promise<Check> => {
  const disabled = await safe(() => target.first().isDisabled({ timeout: 500 }), undefined);
  if (disabled === undefined) return check(false, `${expected}${reason === undefined ? '' : ` con «${reason}»`}`, 'el elemento no se pudo leer');
  const title = (await safe(() => target.first().getAttribute('title', { timeout: 500 }), null)) ?? '(sin explicación)';
  const state = disabled ? 'deshabilitado' : 'habilitado';
  const explained = reason === undefined || title === reason;
  return check(state === expected && explained, `${expected}${reason === undefined ? '' : ` con «${reason}»`}`, `${state}${disabled ? ` con «${title}»` : ''}`);
};

/** Texto de una lectura frente al esperado (comparación exacta). */
export const textCheck = (observed: string | undefined, expected: string, what: string): Check =>
  check(observed === expected, `${what} ${expected}`, `${what} ${observed === undefined ? '(sin leer)' : observed}`);

/** Espera corta de asentamiento tras una acción sin respuesta visible propia. */
export const settle = (): Promise<void> => sleep(SETTLE_MS);

/** Lee un texto visible con plazo; `undefined` si no se puede leer. */
export const readText = (target: Locator): Promise<string | undefined> => textOf(target);

/** Comprobación de que una ventana de observación no ve nada: se usa con `holdsFor` sobre una condición. */
export const absentFor = async (condition: () => Promise<boolean>): Promise<boolean> => (await holdsFor(async () => !(await condition()))).held;

// --- Lecturas acotadas: insignia del panel, ausencia y presencia comprobadas, orden de la UI y arrastre medido ------------

/** Insignia de estado del PANEL abierto (la del árbol no cuenta). */
export const panelBadge = (page: Page): Locator => detailPanel(page).getByTestId(REQUISITOS_TESTIDS.REQUIREMENT_STATE_BADGE);

/** Ausencia comprobada: 0 coincidencias. Un error de lectura NO cuenta como ausencia (queda «no cumplido»). */
export const isAbsent = async (target: Locator): Promise<boolean> => (await safe(() => target.count(), -1)) === 0;

/** Presencia comprobada: la primera coincidencia es visible. Un error de lectura NO cuenta como presencia. */
export const isShown = (target: Locator): Promise<boolean> => safe(() => target.first().isVisible({ timeout: 500 }), false);

/** Fila de la UI en orden de pantalla: código (del nombre accesible), nivel (`aria-level`). */
export interface UiRow {
  readonly code: string;
  readonly level: number;
}

/** Filas `treeitem` o `listitem` de un ámbito, tal como están en el DOM (orden de pantalla). Se lee en el navegador. */
export const uiRowsIn = (scope: Locator, role: 'treeitem' | 'listitem'): Promise<readonly UiRow[]> =>
  safe(
    () =>
      scope.getByRole(role).evaluateAll((nodes) =>
        nodes.map((node) => ({
          code: (node.getAttribute('aria-label') ?? '').split(' ')[0] ?? '',
          level: Number(node.getAttribute('aria-level') ?? '0'),
        })),
      ),
    [],
  );

/** Raíces en orden de pantalla (nivel 1). */
export const uiRootsOf = (rows: readonly UiRow[]): readonly string[] => rows.filter((row) => row.level === 1).map((row) => row.code);

/** Hijos directos de `parent` en orden de pantalla: los que siguen a su fila con un nivel más, hasta la siguiente fila de su nivel o menor. */
export const uiChildrenOf = (rows: readonly UiRow[], parent: string): readonly string[] => {
  const index = rows.findIndex((row) => row.code === parent);
  if (index < 0) return [];
  const start = rows[index];
  if (start === undefined) return [];
  const children: string[] = [];
  for (const row of rows.slice(index + 1)) {
    if (row.level <= start.level) break;
    if (row.level === start.level + 1) children.push(row.code);
  }
  return children;
};

/** Registra en la página los inicios de arrastre reales del navegador (`dragstart`). Se arma antes del gesto. */
export const armDragLog = async (page: Page): Promise<void> => {
  await page.evaluate(() => {
    const registry = window as unknown as Record<string, unknown>;
    registry.__sigproDragStarts = [];
    document.addEventListener('dragstart', (event) => {
      const origin = (event.target as Element | null)?.closest('[data-testid^="requirement-row-"]');
      (registry.__sigproDragStarts as string[]).push(origin?.getAttribute('data-testid') ?? '(ninguno)');
    });
  });
};

/** Inicios de arrastre registrados desde `armDragLog` (ids de prueba de las filas de origen). */
export const dragStarts = (page: Page): Promise<readonly string[]> =>
  safe(() => page.evaluate(() => ((window as unknown as Record<string, unknown>).__sigproDragStarts as string[] | undefined) ?? []), []);

/** Resultado de un gesto de arrastre: si el navegador arrancó el arrastre sobre el origen, qué marca tenía el destino con el puntero encima y si el punto es de la fila destino. */
export interface DragOutcome {
  readonly started: boolean;
  readonly dropOnTarget: string;
  readonly pointerOnTarget: boolean;
}

/**
 * Arrastra la fila `from` sobre la fila `to` (soltando a `zone` de su altura: 0 arriba, 1 abajo) con el puntero en 10 pasos desde el asa.
 * Devuelve lo medido, o el diagnóstico si el gesto del puntero falla.
 */
export const performDrag = async (page: Page, from: string, to: string, zone: number): Promise<DragOutcome | Blocked> => {
  const handle = page.getByTestId(REQUISITOS_DYNAMIC_TESTIDS.REQUIREMENT_HANDLE(from));
  const target = page.getByTestId(REQUISITOS_DYNAMIC_TESTIDS.REQUIREMENT_ROW(to));
  try {
    await handle.scrollIntoViewIfNeeded({ timeout: 2_000 });
    await target.scrollIntoViewIfNeeded({ timeout: 2_000 });
    const origin = await handle.boundingBox({ timeout: 2_000 });
    const destination = await target.boundingBox({ timeout: 2_000 });
    if (origin === null || destination === null) return { message: `no se pudo medir el asa de ${from} o la fila ${to}`, note: 'el asa de arrastre o la fila destino no tienen caja visible' };
    const start = [origin.x + origin.width / 2, origin.y + origin.height / 2] as const;
    const end = [destination.x + destination.width / 2, destination.y + destination.height * zone] as const;
    await page.mouse.move(start[0], start[1]);
    await page.mouse.down();
    await page.mouse.move(end[0], end[1], { steps: 10 });
    const dropOnTarget = (await target.getAttribute('data-drop', { timeout: 1_000 })) ?? '(ninguno)';
    const pointerOnTarget = await target.evaluate((node, point) => node.contains(document.elementFromPoint(point[0], point[1])), end, { timeout: 2_000 });
    await page.mouse.up();
    const started = (await dragStarts(page)).includes(`requirement-row-${from}`);
    return { started, dropOnTarget, pointerOnTarget };
  } catch (error) {
    await page.mouse.up().catch(() => undefined);
    return { message: `no se pudo arrastrar ${from} sobre ${to}: ${String(error).split('\n')[0] ?? 'error'}`, note: 'el gesto del puntero falló en el arnés' };
  }
};
