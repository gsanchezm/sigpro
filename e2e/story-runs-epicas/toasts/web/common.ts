import type { Dialog, Locator, Page, Request as PlaywrightRequest } from '@playwright/test';
import { programasEs } from '../../../../packages/shared/src/i18n/programas';
import { PROGRAMAS_DYNAMIC_TESTIDS, PROGRAMAS_TESTIDS } from '../../../../packages/shared/src/testids';
import { NO_CHAOS, adminToken, call, field, setChaos } from '../../../story-runs/support/api';
import { TENANT_A } from '../../../story-runs/support/prepare';
import { ACTION, CEILING_MS, pathOf, runSteps, safe, textOf, waitUntil, type Step } from '../../support/browser';
import { check, conclude as concludeChecks, sleep, type Check } from '../../support/checks';
import { notExecutable, outcome, type BrowserRowHandler, type Outcome } from '../../core/framework';

// Piezas comunes de las filas de AVISOS de EP-TOASTS. Criterio: el registro de avisos se instala ANTES de cargar la app y se
// «arma» justo antes de la acción, así que cada aviso que aparece queda anotado con su marca de tiempo aunque ya no se vea (dura 3 s).
// Las comprobaciones de «se ve» miran el DOM en el instante indicado por la fila; las de «qué dice» miran el registro.
// Toda acción pasa por `clickAt`: si falla, distingue «la pantalla correcta no ofrece el elemento» (discrepa) de «error de
// localizador o de clic del arnés» (no ejecutable, con el error como evidencia).

export type ToastTone = 'ok' | 'danger' | 'info' | 'warn';
export interface Viewport {
  readonly width: number;
  readonly height: number;
}

export const DESKTOP: Viewport = { width: 1440, height: 900 };
export const NARROW: Viewport = { width: 390, height: 844 };
export const LOGIN_URL = `/login?tenant=${TENANT_A}`;
export const TOAST_KEY = '__sigproToasts';
export const COOKIE_NOTE = 'La prueba fija la preferencia de cookies (sigpro.cookies = accepted) antes de abrir la app, como el piloto; el aviso de cookies no se ejerce aquí.';
/** Salvedad de las historias transversales: sus filas se miran en la web; la app móvil se mira en la historia móvil de la épica. */
export const TRANSVERSAL_NOTE = 'Historia transversal: su fila se mira en la web (1440 px); la app móvil no tiene fila propia en esta historia (sus avisos se miran en US-TOASTS-006).';
/** Métodos que escriben en la API: solo estos cuentan como «escritura» (no los GET, OPTIONS ni HEAD). */
const WRITE_METHODS: ReadonlySet<string> = new Set<string>(['POST', 'PUT', 'PATCH', 'DELETE']);

/** Texto de la historia para el tono (celda) → tono del registro (`data-testid="toast-<tono>"`). */
export const TONE_OF_CELL: ReadonlyMap<string, ToastTone> = new Map<string, ToastTone>([
  ['éxito', 'ok'],
  ['error', 'danger'],
  ['informativo', 'info'],
  ['advertencia', 'warn'],
]);
/** Tono del registro → nombre que usan las historias. */
const TONE_NAME: ReadonlyMap<string, string> = new Map<string, string>([
  ['ok', 'éxito'],
  ['danger', 'error'],
  ['info', 'informativo'],
  ['warn', 'advertencia'],
]);
/** Token del design system de cada tono (la franja del aviso se pinta con él). */
const TOKEN_OF_TONE: ReadonlyMap<string, string> = new Map<string, string>([
  ['ok', '--ok'],
  ['danger', '--danger'],
  ['info', '--info'],
  ['warn', '--warn'],
]);
/** Rol de la celda («estado» / «alerta») → atributo `role` que se espera. */
export const ROLE_OF_CELL: ReadonlyMap<string, string> = new Map<string, string>([
  ['estado', 'status'],
  ['alerta', 'alert'],
]);
const ROLE_NAME: ReadonlyMap<string, string> = new Map<string, string>([
  ['status', 'estado'],
  ['alert', 'alerta'],
]);

export const nameOfTone = (tone: string): string => TONE_NAME.get(tone) ?? tone;
export const nameOfRole = (role: string): string => (role === '' ? '(sin rol)' : (ROLE_NAME.get(role) ?? role));

// --- Registro de avisos (se ejecuta en la página, antes de cargar la app) ----------------------------------------------------

/** Un aviso registrado: tono, título (primera línea), cuerpo (segunda), rol, franja y tamaños de letra, y su marca de tiempo. */
export interface ToastEntry {
  readonly tone: string;
  readonly title: string;
  readonly body: string;
  readonly role: string;
  /** Color de la franja izquierda, tal como lo pinta el navegador. */
  readonly border: string;
  readonly titleSize: number;
  /** -1 si el aviso no tiene cuerpo. */
  readonly bodySize: number;
  readonly at: number;
}

/** Se ejecuta en el navegador: anota cada aparición de un aviso (`data-testid="toast-<tono>"`), también los que se solapan. Sin variables de fuera. */
export const recordToasts = (key: string): void => {
  const registry = window as unknown as Record<string, unknown>;
  if (Array.isArray(registry[key])) return;
  const log: Record<string, unknown>[] = [];
  registry[key] = log;
  const toneOf = (element: Element): string | undefined => /^toast-(ok|danger|info|warn)$/.exec(element.getAttribute('data-testid') ?? '')?.[1];
  const sizeOf = (element: HTMLElement, text: string): number => {
    const node = Array.from(element.querySelectorAll('div')).find((div) => div.innerText.trim() === text);
    return node === undefined ? -1 : parseFloat(getComputedStyle(node).fontSize);
  };
  const record = (element: Element, tone: string): void => {
    const box = element as HTMLElement;
    const lines = box.innerText
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line !== '' && line !== '×');
    const title = lines[0] ?? '';
    const body = lines[1] ?? '';
    log.push({
      tone,
      title,
      body,
      role: box.getAttribute('role') ?? '',
      border: getComputedStyle(box).borderLeftColor,
      titleSize: sizeOf(box, title),
      bodySize: body === '' ? -1 : sizeOf(box, body),
      at: Date.now(),
    });
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

/** Se ejecuta en el navegador: pone la preferencia de cookies para que el aviso de cookies no tape controles. Sin variables de fuera. */
export const fixCookiePreference = (): void => {
  try {
    localStorage.setItem('sigpro.cookies', 'accepted');
  } catch {
    // sin almacenamiento: no hay preferencia que fijar
  }
};

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

/** Registro de avisos desde la última «armada». */
export const toastLog = (page: Page): Promise<readonly ToastEntry[]> =>
  safe(() => page.evaluate((key: string) => ((window as unknown as Record<string, unknown>)[key] as ToastEntry[] | undefined) ?? [], TOAST_KEY), []);

/** Lo que hay en el registro, en una frase derivada del estado leído. */
export const describeLog = (log: readonly ToastEntry[]): string =>
  log.length === 0
    ? '(ningún aviso desde la acción)'
    : log.map((entry) => `aviso de ${nameOfTone(entry.tone)} «${entry.title}»${entry.body === '' ? '' : ` con «${entry.body}»`}`).join('; ');

export interface Seen {
  /** Primer aviso del registro con ese título (cualquier tono), si apareció. */
  readonly entry: ToastEntry | undefined;
  readonly observed: string;
  readonly log: readonly ToastEntry[];
}

/** Espera (con techo) a que aparezca un aviso con ese título y devuelve el primero con lo que hay en el registro. */
export const awaitTitle = async (page: Page, title: string): Promise<Seen> => {
  await waitUntil(async () => (await toastLog(page)).some((entry) => entry.title === title));
  const log = await toastLog(page);
  return { entry: log.find((entry) => entry.title === title), observed: describeLog(log), log };
};

/** El aviso del tono y título dados que está en el DOM ahora (filtro por texto exacto de su título). */
export const toastOf = (page: Page, tone: ToastTone, title: string): Locator =>
  page.locator(`[data-testid="toast-${tone}"]`).filter({ has: page.getByText(title, { exact: true }) });

export interface Box {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export const boxOf = (target: Locator): Promise<Box | undefined> =>
  safe(async () => {
    const box = await target.first().boundingBox({ timeout: 2_000 });
    return box === null ? undefined : box;
  }, undefined);

/** Tamaño de la zona visible de la ventana (sin barras de desplazamiento): el sitio de los avisos fijos se mide frente a ella. */
export const viewportOf = (page: Page): Promise<Viewport | undefined> =>
  safe(() => page.evaluate(() => ({ width: document.documentElement.clientWidth, height: document.documentElement.clientHeight })), undefined);

/** Color de un token del design system tal como lo pinta el navegador (para comparar con la franja de un aviso). */
export const tokenColor = (page: Page, token: string): Promise<string | undefined> =>
  safe(
    () =>
      page.evaluate((name: string) => {
        const probe = document.createElement('span');
        probe.style.color = `var(${name})`;
        document.body.append(probe);
        const color = getComputedStyle(probe).color;
        probe.remove();
        return color;
      }, token),
    undefined,
  );

// --- Comprobaciones del aviso --------------------------------------------------------------------------------------------------

/** Tono y título del aviso (y su cuerpo si la fila lo da: `(sin cuerpo)` es la cadena vacía). */
export const toastChecks = (seen: Seen, tone: ToastTone, title: string, body?: string): Check[] => {
  const entry = seen.entry;
  const checks: Check[] = [
    check(entry !== undefined && entry.tone === tone, `aviso de ${nameOfTone(tone)} con el título «${title}»`, entry === undefined ? seen.observed : `aviso de ${nameOfTone(entry.tone)} con el título «${entry.title}»`),
  ];
  if (body !== undefined) {
    const expected = body === '' ? 'el aviso no tiene cuerpo' : `el aviso tiene el cuerpo «${body}»`;
    const observed = entry === undefined ? '(sin aviso)' : entry.body === '' ? 'el aviso no tiene cuerpo' : `el aviso tiene el cuerpo «${entry.body}»`;
    checks.push(check(entry !== undefined && entry.body === body, expected, observed));
  }
  return checks;
};

/** Rol con el que se anuncia el aviso (atributo `role`), frente al que dice la historia. */
export const roleCheck = (seen: Seen, role: string): Check => {
  const entry = seen.entry;
  return check(entry !== undefined && entry.role === role, `se anuncia con el rol de ${nameOfRole(role)}`, entry === undefined ? seen.observed : `se anuncia con el rol de ${nameOfRole(entry.role)}`);
};

/** La franja izquierda del aviso tiene el color de su tono (regla de la historia transversal de tonos). */
export const franjaCheck = async (page: Page, seen: Seen, tone: ToastTone): Promise<Check> => {
  const token = TOKEN_OF_TONE.get(tone) ?? '';
  const color = await tokenColor(page, token);
  const entry = seen.entry;
  const ok = entry !== undefined && color !== undefined && entry.border === color;
  return check(ok, `la franja del borde izquierdo con el color del tono (${token})`, entry === undefined ? '(sin aviso)' : `franja ${entry.border}, color del tono ${color ?? '(no leído)'}`);
};

/** El cuerpo, si lo hay, va con letra más pequeña que el título (regla de la historia transversal de tonos). */
export const bodySmallerCheck = (seen: Seen): Check => {
  const entry = seen.entry;
  const ok = entry !== undefined && entry.bodySize > 0 && entry.titleSize > 0 && entry.bodySize < entry.titleSize;
  return check(ok, 'el cuerpo con letra más pequeña que el título', entry === undefined ? '(sin aviso)' : `letra del cuerpo ${entry.bodySize} px y del título ${entry.titleSize} px`);
};

// --- Acciones con diagnóstico ----------------------------------------------------------------------------------------------------

export interface Blocked {
  /** `missing`: la pantalla correcta no ofrece el elemento. `covered`: lo tapa otro. `harness`: error de localizador/clic o pantalla no alcanzada. */
  readonly kind: 'missing' | 'covered' | 'harness';
  readonly message: string;
  readonly hit?: string;
}

export type Act = (page: Page) => Promise<Blocked | undefined>;

const errorLines = (error: unknown): readonly string[] =>
  (error instanceof Error ? error.message : String(error))
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line !== '');

/** Se ejecuta en el navegador: qué recibe el clic en el centro del elemento. Sin variables de fuera. */
const hitAtCenter = (node: Element): string => {
  const box = node.getBoundingClientRect();
  const hit = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
  if (hit === null) return '(ninguno)';
  const testid = hit.getAttribute('data-testid');
  return `${hit.tagName.toLowerCase()}${testid === null ? '' : `[data-testid="${testid}"]`}`;
};

/** Pulsa un elemento; si falla, clasifica el fallo. `screen` dice si la pantalla es la que la fila necesita. */
export const clickAt =
  (locate: (page: Page) => Locator, label: string, screen: (page: Page) => boolean): Act =>
  async (page) => {
    const target = locate(page);
    try {
      await target.click(ACTION);
      return undefined;
    } catch (error) {
      const lines = errorLines(error);
      if (!screen(page)) return { kind: 'harness', message: `no se pudo ${label}: la pantalla no es la esperada (ruta ${pathOf(page)}): ${lines[0] ?? ''}` };
      const count = await safe(() => target.count(), -1);
      if (count === 0) {
        // «La pantalla no ofrece el elemento» solo si la lista de la pantalla ya cargó (si no, el fallo es de carga, no de la app)
        const rowMenus = await safe(() => page.getByRole('button', { name: /^Acciones para / }).count(), 0);
        if (rowMenus === 0) return { kind: 'harness', message: `no se pudo ${label}: la lista de la pantalla no ha cargado` };
        return { kind: 'missing', message: `no se pudo ${label}: no hay ningún elemento que lo cumpla` };
      }
      const covered = lines.find((line) => line.includes('intercepts pointer events'));
      if (covered !== undefined) {
        const hit = await safe(() => target.first().evaluate(hitAtCenter, undefined, { timeout: 2_000 }), undefined);
        return { kind: 'covered', message: `no se pudo ${label}: ${covered}`, hit: hit ?? '(no leído)' };
      }
      return { kind: 'harness', message: `no se pudo ${label}: ${lines.slice(0, 3).join(' · ')}` };
    }
  };

/** Ejecuta las acciones en orden y devuelve el primer fallo. */
export const inOrder =
  (...acts: readonly Act[]): Act =>
  async (page) => {
    for (const act of acts) {
      const blocked = await act(page);
      if (blocked !== undefined) return blocked;
    }
    return undefined;
  };

/** Una navegación con su llegada: la ruta debe quedar en `path` (si no, la pantalla no se alcanzó). */
export const goTo = (locate: (page: Page) => Locator, label: string, path: string): Act =>
  inOrder(
    clickAt(locate, label, () => true),
    async (page) => {
      const arrived = await waitUntil(async () => pathOf(page) === path);
      return arrived.reached ? undefined : { kind: 'harness', message: `no se llegó a ${path} tras «${label}» (ruta ${pathOf(page)})` };
    },
  );

/** Un fallo de acción convertido en resultado de la fila (discrepa, o no ejecutable con el error como evidencia). */
export const actionFailed = (expected: string, blocked: Blocked): Outcome => {
  const evidence = { error: blocked.message, ...(blocked.hit === undefined ? {} : { recibeElClic: blocked.hit }) };
  if (blocked.kind === 'missing')
    return outcome(false, expected, blocked.message, { note: 'La historia nombra un elemento que la pantalla no ofrece (la pantalla correcta está visible).', evidence });
  if (blocked.kind === 'covered') return outcome(false, expected, blocked.message, { note: `el elemento existe, pero lo tapa otro: ${blocked.hit ?? '(no leído)'}`, evidence });
  return { ...notExecutable(expected, 'error de localizador o de clic del arnés (o pantalla no alcanzada): la fila no llegó a la acción; no es un hallazgo sobre la app'), evidence };
};

/** Resultado de una fila a partir de sus comprobaciones; si alguna falla, la nota dice en qué difiere (lo que la historia espera frente a lo observado). */
export const conclude = (checks: readonly Check[], extra: Pick<Outcome, 'note' | 'evidence'> = {}): Outcome => {
  const failing = checks.filter((entry) => !entry.ok);
  const difference = failing.length === 0 ? undefined : `difiere en: ${failing.map((entry) => `${entry.expected} (observado: ${entry.observed})`).join('; ')}`;
  const note = [extra.note, difference].filter((part): part is string => part !== undefined).join(' ');
  return concludeChecks(checks, { ...extra, ...(note === '' ? {} : { note }) });
};

/**
 * «Mientras el aviso sigue a la vista» no se dio al pulsar la siguiente acción. Si ya pasaron 3 s desde su aparición, la prueba llegó
 * tarde: no ejecutable, con el tiempo como evidencia (no es un hallazgo sobre la app). Si no, la app lo retiró antes de su plazo.
 */
export const premiseLost = (expected: string, title: string, entry: ToastEntry | undefined, observed: string): Outcome => {
  const elapsed = entry === undefined ? undefined : Date.now() - entry.at;
  const evidence = { msDesdeAparicion: elapsed ?? '(sin aparición)' };
  if (elapsed !== undefined && elapsed >= 3_000)
    return { ...notExecutable(expected, `el arnés llegó tarde: «${title}» llevaba ${elapsed} ms (más de 3 s) cuando debía seguir a la vista; no es un hallazgo sobre la app`), evidence };
  return outcome(false, expected, `«${title}» ya no está a la vista (${observed})`, {
    note: 'El aviso se retiró antes de su plazo de 3 s, y la condición «mientras sigue a la vista» no se dio.',
    evidence,
  });
};

/** Enlace de la navegación lateral por su nombre o por su id de prueba (el de «No conformidades» trae además el contador de abiertas). */
export const sidebarLink = (page: Page, key: 'documents' | 'nc', name: RegExp): Locator =>
  page.getByRole('link', { name }).or(page.getByTestId(PROGRAMAS_DYNAMIC_TESTIDS.NAV(key)));

/** Estado (insignia) de una fila de programa, tal como lo muestra la tabla de escritorio. */
export const badgeOf = (page: Page, code: string): Promise<string | undefined> =>
  textOf(page.getByTestId(PROGRAMAS_DYNAMIC_TESTIDS.PROGRAMS_ROW(code)).getByTestId(PROGRAMAS_TESTIDS.PROGRAMS_STATE_BADGE));

// --- Pantallas y menús (escritorio y ventana estrecha) -------------------------------------------------------------------------

export const onPrograms = (page: Page): boolean => pathOf(page) === '/programs';
export const onDocuments = (page: Page): boolean => pathOf(page) === '/documents';
export const onNc = (page: Page): boolean => pathOf(page) === '/nc';

/** Botón ⋯ de una fila (programa, documento o no conformidad): «Acciones para CODIGO». */
export const menuOf = (page: Page, code: string): Locator => page.getByRole('button', { name: `Acciones para ${code}`, exact: true });

/** Elemento de un menú de escritorio (`role="menu"`) con ese nombre. */
export const menuItemOf = (page: Page, code: string, item: string): Locator =>
  page.getByRole('menu', { name: `Acciones para ${code}`, exact: true }).getByRole('menuitem', { name: item, exact: true });

/** Botón de una hoja de acciones (ventana estrecha: `role="dialog"` con ese nombre). */
export const sheetItemOf = (page: Page, code: string, item: string): Locator =>
  page
    .getByRole('dialog', { name: `Acciones para ${code}`, exact: true })
    .getByRole('button', { name: item, exact: true })
    .or(page.getByRole('dialog', { name: `Acciones para ${code}`, exact: true }).getByRole('link', { name: item, exact: true }));

/** Abre el ⋯ de una fila y pulsa una de sus acciones. `sheet` si la ventana es estrecha. */
export const rowAction = (code: string, item: string, screen: (page: Page) => boolean, sheet = false): Act =>
  inOrder(
    clickAt((page) => menuOf(page, code), `abrir «Acciones para ${code}»`, screen),
    clickAt((page) => (sheet ? sheetItemOf(page, code, item) : menuItemOf(page, code, item)), `pulsar «${item}» en las acciones de ${code}`, screen),
  );

/** Pulsa «Cerrar» del aviso con ese título (el botón con ese nombre dentro del aviso). */
export const closeToast = (title: string): Act =>
  clickAt((page) => toastOf(page, 'ok', title).first().getByRole('button', { name: 'Cerrar', exact: true }), `pulsar «Cerrar» del aviso «${title}»`, onPrograms);

// --- Sesión y preparación ------------------------------------------------------------------------------------------------------

/** Abre /login?tenant=alumno01 con la cuenta y espera a la lista de programas (con el registro de avisos ya instalado). */
export const signInWeb = (page: Page, viewport: Viewport, email: string, password: string): Promise<string | undefined> => {
  const steps: Step[] = [
    ['fijar la preferencia de cookies', () => page.context().addInitScript(fixCookiePreference)],
    ['instalar el registro de avisos', () => page.context().addInitScript(recordToasts, TOAST_KEY)],
    ['fijar el tamaño de la ventana', () => page.setViewportSize(viewport)],
    ['abrir /login?tenant=alumno01', () => page.goto(LOGIN_URL, { timeout: CEILING_MS })],
    ['escribir el correo', () => page.getByLabel('Correo electrónico', { exact: true }).fill(email, ACTION)],
    ['escribir la contraseña', () => page.getByLabel('Contraseña', { exact: true }).fill(password, ACTION)],
    ['pulsar «Entrar»', () => page.getByRole('button', { name: 'Entrar', exact: true }).click(ACTION)],
    ['llegar a /programs', () => page.waitForURL(/\/programs/, { timeout: CEILING_MS })],
    ['ver la lista de programas', () => menuOf(page, 'PRG-001').waitFor({ state: 'visible', timeout: CEILING_MS })],
  ];
  return runSteps(steps);
};

/** Llega a /documents desde la navegación lateral y espera a la lista. */
export const openDocumentsList = async (page: Page): Promise<string | undefined> =>
  runSteps([
    ['ir a «Documentos» desde la navegación', () => sidebarLink(page, 'documents', /^Documentos/).click(ACTION)],
    ['llegar a /documents', () => page.waitForURL(/\/documents/, { timeout: CEILING_MS })],
    ['ver la lista de documentos', () => menuOf(page, 'DOC-001').waitFor({ state: 'visible', timeout: CEILING_MS })],
  ]);

/** Llega a /nc desde la navegación lateral y espera al tablero. */
export const openNcBoard = async (page: Page): Promise<string | undefined> =>
  runSteps([
    ['ir a «No conformidades» desde la navegación', () => sidebarLink(page, 'nc', /^No conformidades/).click(ACTION)],
    ['llegar a /nc', () => page.waitForURL(/\/nc/, { timeout: CEILING_MS })],
    ['ver la tarjeta NC-001', () => menuOf(page, 'NC-001').waitFor({ state: 'visible', timeout: CEILING_MS })],
  ]);

// --- Caos y API -----------------------------------------------------------------------------------------------------------------

/** Fija la tasa de error de las escrituras del tenant (latencia 0). Devuelve el estado de la respuesta. */
export const setErrorRate = async (rate: number): Promise<number> => (await setChaos(TENANT_A, { latencyMs: 0, errorRate: rate, flakyLabels: false })).status;

/** Apaga el caos al terminar la fila, también si la fila falla. */
export const restoringChaos =
  (handler: BrowserRowHandler): BrowserRowHandler =>
  async (row, fixtures) => {
    try {
      return await handler(row, fixtures);
    } finally {
      await setChaos(TENANT_A, NO_CHAOS);
    }
  };

/** Añade una salvedad a la nota de la fila. */
export const withNote =
  (handler: BrowserRowHandler, note: string): BrowserRowHandler =>
  async (row, fixtures) => {
    const result = await handler(row, fixtures);
    return { ...result, note: result.note === undefined ? note : `${result.note} ${note}` };
  };

const STATUS_LABEL: ReadonlyMap<string, string> = new Map<string, string>([
  ['active', programasEs.st_active],
  ['closed', programasEs.st_closed],
  ['draft', programasEs.st_draft],
  ['on_hold', programasEs.st_on_hold],
  ['cancelled', programasEs.st_cancelled],
]);

/** Estado de un programa tal como lo muestra la app (etiqueta del catálogo), leído por API con el administrador del tenant. */
export const programStateLabel = async (code: string): Promise<string | undefined> => {
  const token = await adminToken(TENANT_A);
  const result = await call('GET', `/programs/${code}`, { tenant: TENANT_A, token });
  const status = field(result.body, 'status');
  if (result.status !== 200 || typeof status !== 'string') return undefined;
  return STATUS_LABEL.get(status) ?? `(estado ${status})`;
};

/** Identificadores de los comentarios de una no conformidad, leídos por API. */
export const ncCommentIds = async (code: string): Promise<readonly string[] | undefined> => {
  const token = await adminToken(TENANT_A);
  const result = await call('GET', `/nc/${code}`, { tenant: TENANT_A, token });
  const comments = field(result.body, 'comments');
  if (result.status !== 200 || !Array.isArray(comments)) return undefined;
  return comments.map((comment: unknown) => String(field(comment, 'id')));
};

/** Reacción local de la pantalla (1 s de referencia): la animación de entrada del aviso dura 180 ms y mueve el aviso 6 px. */
export const SETTLE_MS = 500;
export const settle = (): Promise<void> => sleep(SETTLE_MS);

/** ¿Se ve ahora el aviso? `false` si no está en el DOM; `undefined` si la lectura falla (una lectura fallida no cuenta como cumplida). */
export const shownNow = async (target: Locator): Promise<boolean | undefined> => {
  const count = await safe(() => target.count(), -1);
  if (count < 0) return undefined;
  if (count === 0) return false;
  return safe<boolean | undefined>(() => target.first().isVisible(), undefined);
};

/** Espera un tiempo de la prueba hasta un instante del reloj (el del aviso, medido desde que apareció). */
export const sleepUntil = async (at: number): Promise<void> => {
  const wait = at - Date.now();
  if (wait > 0) await sleep(wait);
};

/** Peticiones de escritura (no GET) que el navegador hace a la API desde que se instala el escucha. */
export const writesTo = (page: Page): { readonly writes: string[]; readonly stop: () => void } => {
  const writes: string[] = [];
  const listener = (request: PlaywrightRequest): void => {
    if (request.url().includes('/api/') && WRITE_METHODS.has(request.method())) writes.push(`${request.method()} ${new URL(request.url()).pathname}`);
  };
  page.on('request', listener);
  return { writes, stop: () => page.off('request', listener) };
};

/** Responde al cuadro `prompt()` del navegador con este texto; devuelve los tipos de diálogo que llegaron y el escucha para retirarlo. */
export const answerPrompt = (page: Page, text: string): { readonly kinds: string[]; readonly stop: () => void } => {
  const kinds: string[] = [];
  const listener = (dialog: Dialog): void => {
    kinds.push(dialog.type());
    void dialog.accept(text);
  };
  page.on('dialog', listener);
  return { kinds, stop: () => page.off('dialog', listener) };
};
