import type { Locator, Page } from '@playwright/test';
import { NC_DYNAMIC_TESTIDS, NC_TESTIDS } from '../../../../packages/shared/src/testids';
import { DEMO, TENANT_A, resetTenants, type Credentials } from '../../../story-runs/support/prepare';
import { adminCredentials } from '../../../story-runs/support/api';
import { ACTION, CEILING_MS, attrOf, runSteps, safe, textOf, waitUntil, type Step } from '../../support/browser';
import { check, conclude, preparationFailedWeb, sleep, type Check } from '../../support/checks';
import { outcome, type BrowserRowHandler, type Outcome } from '../../core/framework';
import { actorOf, detailNc, fieldsOf, listNc, type NcFields } from '../api/common';

// Piezas comunes de las filas WEB de EP-NC-GESTION (escritorio 1440 px). Los localizadores van por rol y nombre accesible, acotados al
// diálogo que los contiene (detrás del modal hay filtros con las mismas opciones), y los textos de la pantalla se leen en UNA evaluación.
// Los avisos (toasts) se leen de un REGISTRO instalado ANTES de la acción, con control positivo de que está armado: un registro ausente
// no es «ningún aviso», es un fallo del arnés.

export type Layout = 'escritorio';
export const viewportOf = (): { readonly width: number; readonly height: number } => ({ width: 1440, height: 900 });

export const LOGIN_URL = `/login?tenant=${TENANT_A}`;
/** Plazo corto para una lectura de la pantalla (una lectura no puede colgar la fila). */
export const READ_MS = 2_000;
/** Plazo máximo para que una lectura de la red o de la pantalla asiente (la historia no fija plazos). */
export const SETTLE_MS = 5_000;

/** Cuentas de las celdas «correo» de la web (la administradora de alumno01 también tiene su correo de celda). */
export const ACCOUNT_BY_EMAIL: ReadonlyMap<string, Credentials> = new Map<string, Credentials>([
  ['gestor@sigpro.test', DEMO.gestor],
  ['consultor@sigpro.test', DEMO.consultor],
  ['auditor@sigpro.test', DEMO.auditor],
  ['alumno01@sigpro.lab', adminCredentials(TENANT_A)],
]);

/** Nota que se añade a cada veredicto web: la prueba fija la preferencia de cookies (no lo dice la historia). */
export const COOKIE_NOTE = 'La prueba fija la preferencia de cookies (localStorage «sigpro.cookies») para que el aviso de cookies no tape los controles; la historia no lo dice.';

/** Añade la nota de la preferencia de cookies al resultado de cada fila web. */
export const onWeb =
  (handler: BrowserRowHandler): BrowserRowHandler =>
  async (row, fixtures) => {
    const result = await handler(row, fixtures);
    return { ...result, note: result.note === undefined ? COOKIE_NOTE : `${result.note} ${COOKIE_NOTE}` };
  };

const fixCookiePreference = (): void => {
  try {
    localStorage.setItem('sigpro.cookies', 'accepted');
  } catch {
    // sin almacenamiento: no hay preferencia que fijar
  }
};

// --- Avisos: registro desde antes de la acción, con control positivo -----------------------------------------------------------

/** Clave del registro de avisos en la ventana del navegador. */
export const TOAST_KEY = '__ncGestionToasts';

/** Un aviso registrado: tono, título (primera línea), cuerpo (segunda) y marca de tiempo del navegador. */
export interface ToastEntry {
  readonly tone: string;
  readonly title: string;
  readonly body: string;
  readonly at: number;
}

/** Se ejecuta en el navegador antes de cargar la app: registra cada aparición de un aviso. No usa variables de fuera. */
export const recordToasts = (key: string): void => {
  const registry = window as unknown as Record<string, unknown>;
  if (Array.isArray(registry[key])) return;
  const log: { tone: string; title: string; body: string; at: number }[] = [];
  registry[key] = log;
  const toneOf = (element: Element): string | undefined => /^toast-(ok|danger|info|warn)$/.exec(element.getAttribute('data-testid') ?? '')?.[1];
  const record = (element: Element, tone: string): void => {
    const lines = (element as HTMLElement).innerText
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line !== '' && line !== '×');
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

/** Vacía el registro y comprueba que existe (control positivo). `false` = el registro no está instalado: fallo del arnés. */
export const armToasts = (page: Page): Promise<boolean> =>
  safe(
    () =>
      page.evaluate((key: string) => {
        const registry = window as unknown as Record<string, unknown>;
        const log = registry[key];
        if (!Array.isArray(log)) return false;
        log.length = 0;
        return true;
      }, TOAST_KEY),
    false,
  );

/** Registro de avisos desde la última «armada»; `undefined` si el registro no se puede leer (no es lo mismo que «ningún aviso»). */
export const toastLog = (page: Page): Promise<readonly ToastEntry[] | undefined> =>
  safe(
    () =>
      page.evaluate((key: string) => {
        const log = (window as unknown as Record<string, unknown>)[key];
        return Array.isArray(log) ? (log as ToastEntry[]).map((entry) => ({ ...entry })) : undefined;
      }, TOAST_KEY),
    undefined,
  );

export interface ToastResult {
  /** `true` solo si el registro se pudo leer y contiene el aviso. */
  readonly seen: boolean;
  readonly readable: boolean;
  /** Lo que hay en el registro desde la «armada», en una frase. */
  readonly observed: string;
}

/** Espera (con techo) a que aparezca un aviso del tono y título dados (y cuerpo, si se da). Consulta el registro, no la pantalla. */
export const toastShown = async (page: Page, tone: 'ok' | 'danger' | 'info' | 'warn', title: string, body?: string): Promise<ToastResult> => {
  const matches = (entry: ToastEntry): boolean => entry.tone === tone && entry.title === title && (body === undefined || entry.body === body);
  const found = await waitUntil(async () => ((await toastLog(page)) ?? []).some(matches), CEILING_MS);
  const log = await toastLog(page);
  if (log === undefined) return { seen: false, readable: false, observed: '(registro de avisos sin leer)' };
  const observed = log.length === 0 ? '(ningún aviso)' : log.map((entry) => `${entry.tone} «${entry.title}»${entry.body === '' ? '' : ` / «${entry.body}»`}`).join(' | ');
  return { seen: found.reached, readable: true, observed };
};

// --- Inicio de sesión, apertura de rutas y preparación de cada fila --------------------------------------------------------------

/** Inicio de sesión por el formulario en /login?tenant=alumno01. Termina en /programs. Instala el registro de avisos antes de cargar. */
export const signIn = (page: Page, email: string): Promise<string | undefined> => {
  const credentials = ACCOUNT_BY_EMAIL.get(email);
  const steps: Step[] = [
    ['fijar la preferencia de cookies', () => page.context().addInitScript(fixCookiePreference)],
    ['instalar el registro de avisos', () => page.context().addInitScript(recordToasts, TOAST_KEY)],
    ['fijar el ancho de la ventana', () => page.setViewportSize(viewportOf())],
    ['abrir /login?tenant=alumno01', () => page.goto(LOGIN_URL, { timeout: CEILING_MS })],
    ['escribir el correo', () => page.getByLabel('Correo electrónico', { exact: true }).fill(credentials?.email ?? email, ACTION)],
    ['escribir la contraseña', () => page.getByLabel('Contraseña', { exact: true }).fill(credentials?.password ?? '', ACTION)],
    ['pulsar «Entrar»', () => page.getByRole('button', { name: 'Entrar', exact: true }).click(ACTION)],
    ['llegar a /programs', () => page.waitForURL(/\/programs/, { timeout: CEILING_MS })],
  ];
  return runSteps(steps);
};

/** Abre una ruta con la sesión ya iniciada en la misma página y espera a que la página asiente (la lista de no conformidades o el detalle). */
export const openPath = (page: Page, path: string): Promise<string | undefined> =>
  runSteps([
    [`abrir ${path}`, () => page.goto(path, { timeout: CEILING_MS })],
    ['ver el tablero montado', async () => {
      const mounted = await waitUntil(async () => (await safe(() => page.getByTestId(NC_TESTIDS.NC_PAGE).count(), 0)) > 0);
      if (!mounted.reached) throw new Error('la página de no conformidades no aparece');
    }],
  ]);

/** Preparación de una fila web: reinicio de alumno01 con su administrador, inicio de sesión de la cuenta y apertura de la ruta. */
export const prepareWeb = async (page: Page, email: string, expected: string, path: string): Promise<Outcome | undefined> => {
  await resetTenants([TENANT_A]);
  const signedIn = await signIn(page, email);
  if (signedIn !== undefined) return preparationFailedWeb(expected, `iniciar sesión como ${email}: ${signedIn}`);
  const opened = await openPath(page, path);
  if (opened !== undefined) return preparationFailedWeb(expected, `abrir ${path}: ${opened}`);
  // Control positivo: el registro de avisos existe antes de la acción (si no, es un fallo del arnés, no «ningún aviso»)
  if (!(await armToasts(page))) throw new Error('registro de avisos no instalado en la página: fallo del arnés');
  return undefined;
};

// --- Acciones con diagnóstico ----------------------------------------------------------------------------------------------------

export interface Blocked {
  readonly message: string;
  readonly note: string;
}

/** Quién recibe el clic en el centro de un elemento, y si es el propio elemento o uno de sus descendientes. */
const hitAtCenter = (node: Element): { readonly hit: string; readonly inside: boolean } => {
  const box = node.getBoundingClientRect();
  const hit = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
  if (hit === null) return { hit: '(ninguno)', inside: false };
  const testid = hit.getAttribute('data-testid');
  const name = `${hit.tagName.toLowerCase()}${testid === null ? '' : `[data-testid="${testid}"]`}`;
  return { hit: name, inside: hit === node || node.contains(hit) };
};

const describeFailure = async (target: Locator, label: string, error: unknown): Promise<Blocked> => {
  const lines = (error instanceof Error ? error.message : String(error))
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line !== '');
  const intercept = lines.find((line) => line.includes('intercepts pointer events'));
  const present = (await safe(() => target.count(), 0)) > 0;
  const message = `no se pudo ${label}: ${lines.slice(0, 3).join(' · ')}${intercept === undefined ? '' : ` · ${intercept}`}`;
  if (!present) return { message, note: 'La historia nombra un elemento que la pantalla no ofrece con ese nombre (no existe).' };
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

export const actionFailed = (expected: string, blocked: Blocked): Outcome => outcome(false, expected, blocked.message, { note: blocked.note });

/** Una acción de la fila sobre la pantalla: devuelve su diagnóstico si falla, o `undefined` si sale bien. */
export type WebAction = (page: Page) => Promise<Blocked | undefined>;

export const clickIn = (locate: (page: Page) => Locator, label: string): WebAction => (page) => interact(locate(page), label, (element) => element.click(ACTION));
export const fillIn = (locate: (page: Page) => Locator, label: string, text: string): WebAction => (page) => interact(locate(page), label, (element) => element.fill(text, ACTION));

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

/** Acciones de la fila: sin diagnóstico previo, se ejecutan en orden y se corta en la primera que falla. */
export const runActions = async (page: Page, actions: readonly WebAction[]): Promise<Blocked | undefined> => inOrder(...actions)(page);

// --- Localizadores (acotados al diálogo que los contiene) -------------------------------------------------------------------------

export const newButton = (page: Page): Locator => page.getByRole('button', { name: 'Nueva no conformidad', exact: true });
export const newDialog = (page: Page): Locator => page.getByRole('dialog', { name: 'Nueva no conformidad', exact: true });
export const detailDialog = (page: Page, code: string): Locator => page.getByRole('dialog', { name: `Detalle de ${code}`, exact: true });
export const closeDialog = (page: Page, code: string): Locator => page.getByRole('dialog', { name: `Cerrar ${code}`, exact: true });
export const cardOf = (page: Page, code: string): Locator => page.getByTestId(NC_DYNAMIC_TESTIDS.NC_CARD(code));
export const columnOf = (page: Page, state: string): Locator => page.getByTestId(NC_DYNAMIC_TESTIDS.NC_COLUMN(state));
export const countOf = (page: Page): Locator => page.getByTestId(NC_TESTIDS.NC_COUNT);

// --- Lecturas de la pantalla (una evaluación) ------------------------------------------------------------------------------------

/** Lectura del formulario de alta (solo los textos de error y si está abierto). */
export interface NewView {
  readonly open: boolean;
  readonly programError: string | undefined;
  readonly severityError: string | undefined;
  readonly descriptionError: string | undefined;
  readonly serverError: string | undefined;
}

const newReader = (): NewView => {
  const normalized = (node: Element | null): string | undefined => (node === null ? undefined : (node.textContent ?? '').replace(/\s+/g, ' ').trim());
  const dialog = document.querySelector('[data-testid="nc-new-dialog"]');
  const inside = (testid: string): Element | null => (dialog === null ? null : dialog.querySelector(`[data-testid="${testid}"]`));
  return {
    open: dialog !== null,
    programError: normalized(inside('nc-new-program-error')),
    severityError: normalized(inside('nc-new-severity-error')),
    descriptionError: normalized(inside('nc-new-description-error')),
    serverError: normalized(inside('nc-new-server-error')),
  };
};

export const readNew = (page: Page): Promise<NewView | undefined> => safe<NewView | undefined>(() => page.evaluate(newReader), undefined);

/** Lectura del detalle abierto: encabezado, badges, controles de edición, avisos, botones de estado y comentarios. */
export interface CommentView {
  readonly author: string | undefined;
  readonly kindLabel: string | undefined;
  readonly kind: string | undefined;
  readonly body: string | undefined;
}

export interface DetailView {
  readonly open: boolean;
  readonly heading: string | undefined;
  readonly state: string | undefined;
  readonly stateText: string | undefined;
  readonly severityText: string | undefined;
  readonly severityValue: string | undefined;
  /** Opción elegida dentro del selector de severidad (su texto), o `undefined` si no hay ninguna. */
  readonly pickedSeverity: string | undefined;
  readonly pickerDisabled: boolean | undefined;
  readonly description: string | undefined;
  readonly descriptionReadonly: boolean | undefined;
  readonly assigneeValue: string | undefined;
  readonly assigneeReadonly: boolean | undefined;
  readonly assigneePlaceholder: string | undefined;
  readonly deniedNotice: string | undefined;
  readonly notFound: string | undefined;
  readonly serverError: string | undefined;
  readonly descriptionError: string | undefined;
  readonly transitionsText: string | undefined;
  readonly commentsHeading: string | undefined;
  readonly comments: readonly CommentView[];
  readonly commentsEmpty: string | undefined;
  readonly commentError: string | undefined;
  readonly commentValue: string | undefined;
  readonly closeError: string | undefined;
  readonly closeCounter: string | undefined;
  readonly closeComment: string | undefined;
}

const detailReader = (): DetailView => {
  const normalized = (node: Element | null): string | undefined => (node === null ? undefined : (node.textContent ?? '').replace(/\s+/g, ' ').trim());
  const dialog = document.querySelector('[data-testid="nc-detail"]');
  const inside = (testid: string): Element | null => (dialog === null ? null : dialog.querySelector(`[data-testid="${testid}"]`));
  const picker = inside('nc-severity-picker');
  const pickerShadow = picker === null ? null : (picker as HTMLElement).shadowRoot;
  const picked = pickerShadow === null ? null : pickerShadow.querySelector('[role="option"][aria-selected="true"]');
  const listbox = pickerShadow === null ? null : pickerShadow.querySelector('[role="listbox"]');
  const comments = Array.from(dialog === null ? [] : dialog.querySelectorAll('[data-testid="nc-comments"] > li'));
  const assignee = inside('nc-assignee') as HTMLInputElement | null;
  const editor = inside('nc-description');
  const savedEditor = editor === null ? null : (editor as HTMLElement);
  return {
    open: dialog !== null,
    heading: normalized(document.getElementById('nc-detail-heading')),
    state: inside('nc-state-badge')?.getAttribute('data-state') ?? undefined,
    stateText: normalized(inside('nc-state-badge')),
    severityText: normalized(inside('nc-severity-badge')),
    severityValue: inside('nc-severity-badge')?.getAttribute('data-severity') ?? undefined,
    pickedSeverity: picked === null ? undefined : normalized(picked as Element),
    pickerDisabled: listbox === null ? undefined : listbox.getAttribute('aria-disabled') === 'true',
    description: savedEditor === null ? undefined : (savedEditor.innerText ?? '').replace(/\s+/g, ' ').trim(),
    descriptionReadonly: editor === null ? undefined : editor.getAttribute('aria-readonly') === 'true',
    assigneeValue: assignee === null ? undefined : assignee.value,
    assigneeReadonly: assignee === null ? undefined : assignee.readOnly,
    assigneePlaceholder: assignee === null ? undefined : (assignee.getAttribute('placeholder') ?? undefined),
    deniedNotice: normalized(inside('nc-detail-denied')),
    notFound: normalized(inside('nc-detail-not-found')),
    serverError: normalized(inside('nc-server-error')),
    descriptionError: normalized(inside('nc-description-error')),
    transitionsText: normalized(inside('nc-transitions')),
    commentsHeading: normalized(document.getElementById('nc-comments-title')),
    comments: comments.map((item) => {
      const author = item.querySelector('span.font-medium');
      const body = item.querySelector('p');
      const kindNode = Array.from(item.querySelectorAll('span')).find((node) => node.className.includes('font-mono') && node.className.includes('rounded-full')) ?? null;
      return {
        author: normalized(author),
        kindLabel: normalized(kindNode),
        kind: item.getAttribute('data-kind') ?? undefined,
        body: normalized(body),
      };
    }),
    commentsEmpty: normalized(inside('nc-comments-empty')),
    commentError: normalized(inside('nc-comment-error')),
    commentValue: (inside('nc-comment-input') as HTMLTextAreaElement | null)?.value ?? undefined,
    closeError: normalized(inside('nc-close-error')),
    closeCounter: normalized(inside('nc-close-counter')),
    closeComment: inside('nc-close-comment') === null ? undefined : ((inside('nc-close-comment') as HTMLTextAreaElement).value ?? undefined),
  };
};

export const readDetail = (page: Page): Promise<DetailView | undefined> => safe<DetailView | undefined>(() => page.evaluate(detailReader), undefined);

/** Espera (con techo) a que el detalle cumpla `ok`; devuelve la última lectura. */
export const waitDetail = async (page: Page, ok: (view: DetailView) => boolean, ceilingMs: number = SETTLE_MS): Promise<DetailView | undefined> => {
  let last: DetailView | undefined;
  await waitUntil(async () => {
    last = await readDetail(page);
    return last !== undefined && ok(last);
  }, ceilingMs);
  return last;
};

/** Texto visible de la cuenta de recuento (`nc-count`), normalizado; `undefined` si no se lee. */
export const countNow = (page: Page): Promise<string | undefined> =>
  safe(async () => {
    const text = await textOf(countOf(page));
    return text === undefined ? undefined : text.replace(/\s+/g, ' ').trim();
  }, undefined);

/** Espera (con techo) a que el recuento sea `expected`; devuelve el último valor leído. */
export const waitCount = async (page: Page, expected: string, ceilingMs: number = SETTLE_MS): Promise<string | undefined> => {
  let last: string | undefined;
  await waitUntil(async () => {
    last = await countNow(page);
    return last === expected;
  }, ceilingMs);
  return last;
};

/** Control (botón, campo) leído con su estado efectivo: deshabilitado (propiedad), atributo `title` y el `aria-disabled`. */
export interface ControlView {
  readonly disabled: boolean;
  readonly title: string | undefined;
}

/** Estado de un botón por su nombre accesible; `undefined` si no se lee en el plazo. */
export const controlOf = async (locator: Locator): Promise<ControlView | undefined> => {
  const disabled = await safe(() => locator.first().isDisabled({ timeout: READ_MS }), undefined);
  if (disabled === undefined) return undefined;
  const title = (await attrOf(locator, 'title')) ?? undefined;
  return { disabled, title };
};

/** Comprobación de un control: habilitado, o deshabilitado con su motivo en `title`. */
export const controlCheck = (view: ControlView | undefined, expected: 'habilitado' | 'deshabilitado', reason: string | undefined, what: string): Check => {
  if (view === undefined) return check(false, `${what} ${expected}${reason ? `, con el motivo «${reason}»` : ''}`, `${what} (sin leer)`);
  const observed = view.disabled ? `deshabilitado${view.title ? `, con el motivo «${view.title}»` : ''}` : 'habilitado';
  const ok = expected === 'habilitado' ? !view.disabled : view.disabled && view.title === reason;
  return check(ok, `${what} ${expected}${reason ? `, con el motivo «${reason}»` : ''}`, `${what} ${observed}`);
};

// --- Lectura de la base de datos (API) con la cuenta administradora: persistencia ------------------------------------------------

/** Campos de una no conformidad tal como están en el servidor (la cuenta administradora lee). `undefined` si no se lee. */
export const persistedNc = async (code: string): Promise<NcFields | undefined> => {
  const admin = await actorOf(adminCredentials(TENANT_A));
  if (admin.token === undefined) return undefined;
  return fieldsOf(await detailNc(admin.token, code));
};

/** Total de no conformidades del tenant (`totalAll` de GET /api/nc) leído con la cuenta administradora; `undefined` si no se lee. */
export const persistedTotalAll = async (): Promise<number | undefined> => {
  const admin = await actorOf(adminCredentials(TENANT_A));
  if (admin.token === undefined) return undefined;
  const listed = await listNc(admin.token);
  const total = (listed.body as { readonly totalAll?: unknown } | null)?.totalAll;
  return listed.status === 200 && typeof total === 'number' ? total : undefined;
};

/** Espera (con sondeo, techo de 5 s) a que la lectura del servidor cumpla `ok`; devuelve la última lectura. */
export const pollPersisted = async (code: string, ok: (fields: NcFields) => boolean): Promise<NcFields | undefined> => {
  let last: NcFields | undefined;
  await waitUntil(async () => {
    last = await persistedNc(code);
    return last !== undefined && ok(last);
  }, SETTLE_MS);
  return last;
};

// --- Registro de peticiones (para «no se envía ninguna petición») -------------------------------------------------------------

export interface RequestLog {
  /** Peticiones de ese método a esa ruta (pathname), desde que se instaló el registro. */
  readonly count: (method: string, pathname: string) => number;
  /** Peticiones registradas, en una frase. */
  readonly seen: () => string;
}

/** Instala el registro de peticiones de la página: se llama ANTES de la acción. */
export const watchRequests = (page: Page): RequestLog => {
  const log: string[] = [];
  page.on('request', (request) => {
    try {
      log.push(`${request.method()} ${new URL(request.url()).pathname}`);
    } catch {
      // una URL que no se lee no cuenta
    }
  });
  return {
    count: (method, pathname) => log.filter((entry) => entry === `${method} ${pathname}`).length,
    seen: () => (log.length === 0 ? '(ninguna)' : log.join(', ')),
  };
};

/** Espera de observación: deja pasar el tiempo para que una petición que fuera a salir ya haya salido. */
export const observe = (ms = 2_000): Promise<void> => sleep(ms);

// --- Arrastre (HTML5) con el puntero, como en EP-NC-TABLERO: el arrastre se registra por `dragstart` -------------------------

/** Registra en la página los inicios de arrastre reales del navegador (`dragstart` sobre una tarjeta). Se arma antes del gesto. */
export const armDragLog = (page: Page): Promise<void> =>
  page.evaluate(() => {
    const registry = window as unknown as Record<string, unknown>;
    registry.__ncGestionDragStarts = [];
    document.addEventListener('dragstart', (event) => {
      const card = (event.target as Element | null)?.closest('li[data-testid^="nc-card-NC-"]');
      (registry.__ncGestionDragStarts as string[]).push(card?.getAttribute('data-testid') ?? '(ninguno)');
    });
  });

export const dragStarts = (page: Page): Promise<readonly string[]> =>
  safe(() => page.evaluate(() => ((window as unknown as Record<string, unknown>).__ncGestionDragStarts as string[] | undefined) ?? []), []);

export interface DragOutcome {
  /** El navegador arrancó el arrastre sobre la tarjeta de origen (`dragstart`). */
  readonly started: boolean;
  /** Marca de la columna de destino con el puntero encima (`data-drop`: valid, invalid o ausente). */
  readonly dropOnTarget: string;
  readonly pointerOnTarget: boolean;
  /** Atributo `draggable` de la tarjeta (`true` o `false`). */
  readonly draggable: string | undefined;
}

/** Arrastra la tarjeta `code` sobre la columna `to` con el puntero (se pulsa sobre la descripción, se mueve en 10 pasos y se suelta). */
export const performDrag = async (page: Page, code: string, to: string): Promise<DragOutcome | Blocked> => {
  const card = cardOf(page, code);
  const handle = card.locator('p').first();
  const target = columnOf(page, to);
  try {
    await handle.scrollIntoViewIfNeeded({ timeout: READ_MS });
    await target.scrollIntoViewIfNeeded({ timeout: READ_MS });
    const origin = await handle.boundingBox({ timeout: READ_MS });
    const destination = await target.boundingBox({ timeout: READ_MS });
    if (origin === null || destination === null) return { message: `no se pudo medir la descripción de ${code} o la columna ${to}`, note: 'la tarjeta o la columna destino no tienen caja visible' };
    const start = [origin.x + origin.width / 2, origin.y + origin.height / 2] as const;
    const end = [destination.x + destination.width / 2, destination.y + destination.height / 2] as const;
    await page.mouse.move(start[0], start[1]);
    await page.mouse.down();
    await page.mouse.move(end[0], end[1], { steps: 10 });
    const dropOnTarget = (await target.getAttribute('data-drop', { timeout: READ_MS })) ?? '(ninguno)';
    const pointerOnTarget = await target.evaluate((node, point) => node.contains(document.elementFromPoint(point[0], point[1])), end, { timeout: READ_MS });
    await page.mouse.up();
    const started = (await dragStarts(page)).includes(`nc-card-${code}`);
    const draggable = (await attrOf(card, 'draggable')) ?? undefined;
    return { started, dropOnTarget, pointerOnTarget, draggable };
  } catch (error) {
    await page.mouse.up().catch(() => undefined);
    return { message: `no se pudo arrastrar ${code} a ${to}: ${String(error).split('\n')[0] ?? 'error'}`, note: 'el gesto del puntero falló en el arnés' };
  }
};

export const isDragOutcome = (value: DragOutcome | Blocked): value is DragOutcome => 'started' in value;

// --- Veredictos ------------------------------------------------------------------------------------------------------------------

/** Resultado de una fila: coincide si todas las comprobaciones se cumplen; si no, la nota dice en qué difiere. */
export const verdictWeb = (checks: readonly Check[], extraNote?: string): Outcome => {
  const failing = checks.filter((entry) => !entry.ok);
  const difference = failing.length === 0 ? undefined : `difiere de la historia en: ${failing.map((entry) => `${entry.expected} (observado: ${entry.observed})`).join('; ')}`;
  const note = [extraNote, difference].filter((text): text is string => text !== undefined && text !== '').join(' ');
  return conclude(checks, note === '' ? {} : { note });
};

/** Un texto de la historia entre «…»: el texto sin las comillas; otra forma LANZA (celda sin interpretación). */
export const quotedText = (text: string): string => {
  const match = /^«(.+)»$/.exec(text.trim());
  if (!match?.[1]) throw new Error(`celda sin interpretación: texto de la interfaz «${text}» sin comillas «…»`);
  return match[1];
};

/** Texto visible normalizado de un localizador (o `undefined` si no se lee). */
export const visibleText = (locator: Locator): Promise<string | undefined> =>
  safe(async () => {
    const text = await textOf(locator);
    return text === undefined ? undefined : text.replace(/\s+/g, ' ').trim();
  }, undefined);

/** Lectura de un campo de texto o selección por su nombre accesible; `undefined` si no se lee. */
export const valueOfLocator = (locator: Locator): Promise<string | undefined> => safe(() => locator.first().inputValue({ timeout: READ_MS }), undefined);

/** Un resultado «no ejecutable» de una fila, con su motivo, para las filas que el arnés no puede hacer. */
export const notRun = (expected: string, note: string): Outcome => outcome(false, expected, '(no se ejecutó)', { note });

/** Espera a que el aviso del tono y título dados aparezca o al techo: devuelve el resultado con `toastShown`. */
export const expectToast = (page: Page, tone: 'ok' | 'danger' | 'info' | 'warn', title: string, body?: string): Promise<ToastResult> => toastShown(page, tone, title, body);

/** Muestra el nombre visible de un locator con plazo corto (sin avatares), o `undefined`. */
export const nameOf = (locator: Locator): Promise<string | undefined> =>
  safe(
    () =>
      locator.first().evaluate(
        (node) => {
          const copy = node.cloneNode(true) as Element;
          copy.querySelectorAll('[role="img"], img').forEach((avatar) => avatar.remove());
          return (copy.textContent ?? '').replace(/\s+/g, ' ').trim();
        },
        undefined,
        { timeout: READ_MS },
      ),
    undefined,
  );

/** Texto de un HTML guardado (sin etiquetas, espacios normalizados): la descripción puede llegar envuelta en párrafos. */
export const plainOf = (html: string): string => html.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();

/** Cuerpos de las peticiones de ese método y ruta que salen de la página, desde que se llama. */
export const captureBodies = (page: Page, method: string, pathname: string): (() => readonly string[]) => {
  const bodies: string[] = [];
  page.on('request', (request) => {
    try {
      if (request.method() === method && new URL(request.url()).pathname === pathname) bodies.push(request.postData() ?? '(sin cuerpo)');
    } catch {
      // una URL que no se lee no cuenta
    }
  });
  return () => [...bodies];
};

/** Nombres de los campos de un cuerpo JSON, ordenados (`undefined` si no es JSON). */
export const keysOf = (raw: string): readonly string[] | undefined => {
  try {
    return Object.keys(JSON.parse(raw) as Record<string, unknown>).sort();
  } catch {
    return undefined;
  }
};
