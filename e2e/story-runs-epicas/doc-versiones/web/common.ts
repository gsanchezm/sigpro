import type { Locator, Page } from '@playwright/test';
import { DOCUMENTOS_DYNAMIC_TESTIDS, DOCUMENTOS_TESTIDS } from '../../../../packages/shared/src/testids';
import { TENANT_A, type Credentials } from '../../../story-runs/support/prepare';
import { ACTION, CEILING_MS, attrOf, isVisible, runSteps, safe, textOf, waitUntil, type Step } from '../../support/browser';
import { check, sleep, type Check } from '../../support/checks';
import { outcome, type BrowserRowHandler, type Outcome } from '../../core/framework';
import { documentOf, loginAs, type DocumentState } from '../api/common';

// Piezas comunes de las filas web de EP-DOC-VERSIONES (escritorio 1440 px). Los localizadores son de rol y de nombre; los ids de
// prueba solo donde la pantalla no ofrece otro rastro (la tabla del diff, su recuento, el historial, las filas de la lista). Cada
// acción pasa por `interact`, que registra si el elemento no existe, si lo tapa otro, o si el clic no tiene efecto. Los avisos se
// leen de un registro instalado ANTES de cargar la app: un registro ausente nunca cuenta como «ningún aviso».

export const DESKTOP_VIEWPORT = { width: 1440, height: 900 } as const;
export const LOGIN_URL = `/login?tenant=${TENANT_A}`;

// --- Preferencia de cookies (no es una sesión) y nota de cada fila web -------------------------------------------------------------

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

// --- Avisos: registro instalado antes de la acción ---------------------------------------------------------------------------------

/** Clave del registro de avisos en la ventana del navegador. */
export const TOAST_KEY = '__sigproToasts';
/** Ventana que se observa tras una acción para afirmar que NO aparece un aviso: mayor que su vida (3 s). */
export const QUIET_WINDOW_MS = 4_000;

export type Tone = 'ok' | 'danger' | 'info' | 'warn';

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

/** Registro de avisos desde la última «armada»: `null` si el registro no está instalado, `undefined` si no se pudo leer. */
export const toastLog = (page: Page): Promise<readonly ToastEntry[] | null | undefined> =>
  safe(
    () =>
      page.evaluate((key: string) => {
        const log = (window as unknown as Record<string, unknown>)[key];
        return Array.isArray(log) ? (log as ToastEntry[]).map((entry) => ({ ...entry })) : null;
      }, TOAST_KEY),
    undefined,
  );

/** Vacía el registro y marca el instante de la acción que se va a probar. `undefined` si el registro no está instalado (no se puede afirmar nada). */
export const armToasts = (page: Page): Promise<number | undefined> =>
  safe(
    () =>
      page.evaluate((key: string) => {
        const registry = window as unknown as Record<string, unknown>;
        const log = registry[key];
        if (!Array.isArray(log)) return undefined;
        log.length = 0;
        const at = Date.now();
        registry.__sigproArmedAt = at;
        return at;
      }, TOAST_KEY),
    undefined,
  );

const describeLog = (log: readonly ToastEntry[] | null | undefined): string => {
  if (log === null) return 'el registro de avisos no está instalado';
  if (log === undefined) return 'no se pudo leer el registro de avisos';
  return log.length === 0 ? 'ningún aviso' : `avisos: ${log.map((entry) => `${entry.tone} «${entry.title}»${entry.body === '' ? '' : ` / «${entry.body}»`}`).join(' | ')}`;
};

/** Busca en el registro un aviso con ese tono, título y cuerpo. Espera con techo; consulta el registro, no la pantalla. */
export const toastShown = async (page: Page, tone: Tone, title: string, body: string): Promise<{ readonly seen: boolean; readonly observed: string }> => {
  const matches = (entry: ToastEntry): boolean => entry.tone === tone && entry.title === title && entry.body === body;
  const found = await waitUntil(async () => {
    const log = await toastLog(page);
    return log !== null && log !== undefined && log.some(matches);
  });
  return { seen: found.reached, observed: describeLog(await toastLog(page)) };
};

/** Ventana de silencio: tras esperar `QUIET_WINDOW_MS`, no debe haber ningún aviso de ese tono. `unarmed` si el registro no se puede leer. */
export const quietWindow = async (page: Page, tone: Tone): Promise<{ readonly held: boolean; readonly seen: string; readonly unarmed: boolean }> => {
  await sleep(QUIET_WINDOW_MS);
  const log = await toastLog(page);
  if (log === null) return { held: false, seen: 'el registro de avisos no está instalado', unarmed: true };
  if (log === undefined) return { held: false, seen: 'no se pudo leer el registro de avisos', unarmed: false };
  const shown = log.filter((entry) => entry.tone === tone);
  return { held: shown.length === 0, seen: shown.map((entry) => `«${entry.title}»`).join(', '), unarmed: false };
};

// --- Sesión y navegación ----------------------------------------------------------------------------------------------------------

/** Inicio de sesión de una cuenta (sin segundo factor) en /login?tenant=alumno01 y llegada a /programs. */
export const signIn = (page: Page, account: Credentials): Promise<string | undefined> => {
  const steps: Step[] = [
    ['fijar la preferencia de cookies', () => page.context().addInitScript(fixCookiePreference)],
    ['instalar el registro de avisos', () => page.context().addInitScript(recordToasts, TOAST_KEY)],
    ['fijar el ancho de la ventana', () => page.setViewportSize(DESKTOP_VIEWPORT)],
    ['abrir /login?tenant=alumno01', () => page.goto(LOGIN_URL, { timeout: CEILING_MS })],
    ['escribir el correo', () => page.getByLabel('Correo electrónico', { exact: true }).fill(account.email, ACTION)],
    ['escribir la contraseña', () => page.getByLabel('Contraseña', { exact: true }).fill(account.password, ACTION)],
    ['pulsar «Entrar»', () => page.getByRole('button', { name: 'Entrar', exact: true }).click(ACTION)],
    ['llegar a /programs', () => page.waitForURL(/\/programs/, { timeout: CEILING_MS })],
  ];
  return runSteps(steps);
};

/** Abre la ficha de un documento con carga completa y espera a que muestre su título. */
export const openDetail = (page: Page, code: string): Promise<string | undefined> =>
  runSteps([
    [`abrir /documents/${code}`, () => page.goto(`/documents/${code}`, { timeout: CEILING_MS })],
    ['ver la ficha del documento', () => detailTitle(page).waitFor({ timeout: CEILING_MS })],
  ]);

// --- Localizadores ----------------------------------------------------------------------------------------------------------------

export const publishButton = (page: Page): Locator => page.getByRole('button', { name: 'Publicar nueva versión', exact: true });
export const dialogOf = (page: Page, code: string): Locator => page.getByRole('dialog', { name: `Nueva versión de ${code}`, exact: true });
export const contentField = (page: Page): Locator => page.getByRole('textbox', { name: 'Contenido (una línea por fila)', exact: true });
export const noteField = (page: Page): Locator => page.getByRole('textbox', { name: 'Nota de cambios', exact: true });
export const submitButton = (page: Page): Locator => page.getByRole('button', { name: 'Publicar versión', exact: true });
export const cancelButton = (page: Page): Locator => page.getByRole('button', { name: 'Cancelar', exact: true });
/** Aviso bajo el contenido (id de prueba: el aviso no tiene nombre accesible propio). */
export const contentError = (page: Page): Locator => page.getByTestId(DOCUMENTOS_TESTIDS.DOCUMENT_PUBLISH_TEXT_ERROR);
export const detailTitle = (page: Page): Locator => page.getByTestId(DOCUMENTOS_TESTIDS.DOCUMENT_TITLE);
/** Selector «Versión» de la ficha (el que muestra la versión elegida por el visor). */
export const versionSelect = (page: Page): Locator => page.getByRole('combobox', { name: 'Versión', exact: true });
export const backLink = (page: Page): Locator => page.getByTestId(DOCUMENTOS_TESTIDS.DOCUMENT_BACK);
export const historyList = (page: Page): Locator => page.getByTestId(DOCUMENTOS_TESTIDS.DOCUMENT_VERSIONS);
export const compareRegion = (page: Page): Locator => page.getByRole('region', { name: 'Comparar versiones', exact: true });
export const compareFrom = (page: Page): Locator => page.getByRole('combobox', { name: 'Desde', exact: true });
export const compareTo = (page: Page): Locator => page.getByRole('combobox', { name: 'Hasta', exact: true });
export const diffTable = (page: Page): Locator => page.getByTestId(DOCUMENTOS_TESTIDS.DOCUMENT_DIFF);
/** Contenedor de la tabla del diff: su `aria-busy` dice si el resultado mostrado corresponde a la elección actual. */
export const diffWrapper = (page: Page): Locator => diffTable(page).locator('xpath=..');
export const diffStats = (page: Page): Locator => page.getByTestId(DOCUMENTOS_TESTIDS.DOCUMENT_DIFF_STATS);
export const rowOf = (page: Page, code: string): Locator => page.getByTestId(DOCUMENTOS_DYNAMIC_TESTIDS.DOCUMENT_ROW(code));

// --- Lectura de textos y de controles ---------------------------------------------------------------------------------------------

/** Texto normalizado (espacios colapsados) de un elemento, o `undefined`. */
export const normalizedText = async (target: Locator): Promise<string | undefined> => {
  const text = await textOf(target);
  return text === undefined ? undefined : text.replace(/\s+/g, ' ').trim();
};

/** Texto de la opción seleccionada de un desplegable nativo, o `undefined` si no se puede leer. */
export const selectedOptionText = (target: Locator): Promise<string | undefined> =>
  safe(() => target.first().evaluate((element) => (element as HTMLSelectElement).selectedOptions[0]?.textContent?.trim() ?? '', undefined, { timeout: 500 }), undefined);

/** Un control habilitado o deshabilitado; si se pide deshabilitado, con su motivo en `title`. Lectura fallida = no cumple. */
export const stateCheck = async (target: Locator, expected: 'habilitado' | 'deshabilitado', reason?: string): Promise<Check> => {
  const disabled = await safe(() => target.first().isDisabled({ timeout: 500 }), undefined);
  const title = await attrOf(target, 'title');
  const enabledNow = disabled === undefined ? undefined : !disabled;
  const observed = enabledNow === undefined ? '(sin leer)' : enabledNow ? 'habilitado' : `deshabilitado${title ? `, con el motivo «${title}»` : ''}`;
  const ok = expected === 'habilitado' ? enabledNow === true : enabledNow === false && (reason === undefined || title === reason);
  return check(ok, reason === undefined ? expected : `${expected}, con el motivo «${reason}»`, observed);
};

/** Caja de un elemento (sus bordes verticales), o `undefined` si no se puede leer. */
export const verticalBox = (target: Locator): Promise<{ readonly top: number; readonly bottom: number } | undefined> =>
  safe(
    async () => {
      const box = await target.first().boundingBox({ timeout: 500 });
      return box === null ? undefined : { top: box.y, bottom: box.y + box.height };
    },
    undefined,
  );

/** Un aviso de campo: visible, con el texto exacto y debajo del control al que pertenece. */
export const fieldAlertCheck = async (alert: Locator, field: Locator, text: string, label: string): Promise<Check> => {
  const shown = await textOf(alert);
  const alertBox = await verticalBox(alert);
  const fieldBox = await verticalBox(field);
  const below = alertBox !== undefined && fieldBox !== undefined && alertBox.top >= fieldBox.bottom - 1;
  const ok = shown === text && below;
  return check(ok, `ve el aviso «${text}» bajo ${label}`, shown === undefined ? `no se ve ningún aviso bajo ${label}` : `ve el aviso «${shown}»${below ? '' : `, no debajo de ${label}`}`);
};

// --- Acciones con diagnóstico -----------------------------------------------------------------------------------------------------

export interface Blocked {
  readonly message: string;
  readonly note: string;
  readonly evidence?: Readonly<Record<string, unknown>>;
}

/** Se ejecuta en el navegador: qué recibe el clic en el centro del elemento. No usa variables de fuera. */
const hitAtCenter = (node: Element): { readonly hit: string; readonly inside: boolean } => {
  const box = node.getBoundingClientRect();
  const hit = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
  if (hit === null) return { hit: '(ninguno)', inside: false };
  const testid = hit.getAttribute('data-testid');
  return { hit: `${hit.tagName.toLowerCase()}${testid === null ? '' : `[data-testid="${testid}"]`}`, inside: hit === node || node.contains(hit) };
};

/** Lo que se registra de una acción fallida: primeras líneas del error, la línea «intercepts pointer events» y quién recibe el clic. */
const describeFailure = async (target: Locator, label: string, error: unknown): Promise<Blocked> => {
  const lines = (error instanceof Error ? error.message : String(error)).split('\n').map((line) => line.trim()).filter((line) => line !== '');
  const intercept = lines.find((line) => line.includes('intercepts pointer events'));
  const present = (await safe(() => target.count(), 0)) > 0;
  const message = `no se pudo ${label}: ${lines.slice(0, 3).join(' · ')}${intercept === undefined ? '' : ` · ${intercept}`}`;
  if (!present) return { message, note: 'La historia nombra un elemento que la pantalla no ofrece (no existe con ese nombre).' };
  const probe = await safe(() => target.first().evaluate(hitAtCenter, undefined, { timeout: 2_000 }), undefined);
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

/** Pulsa el botón «Publicar nueva versión» y espera a que el diálogo se vea. */
export const openPublishDialog = async (page: Page, code: string): Promise<Blocked | undefined> => {
  const pressed = await interact(publishButton(page), 'pulsar «Publicar nueva versión»', (element) => element.click(ACTION));
  if (pressed !== undefined) return pressed;
  const shown = await waitUntil(() => isVisible(dialogOf(page, code)));
  return shown.reached ? undefined : { message: 'se pulsó «Publicar nueva versión» y no se abrió el diálogo', note: 'el botón existe y se pulsó, pero el diálogo no apareció' };
};

/** Espera (con techo) a que el contenido de la última versión esté cargado y el campo habilitado. */
export const waitContentLoaded = async (page: Page): Promise<boolean> =>
  (await waitUntil(async () => (await safe(() => contentField(page).isEnabled({ timeout: 500 }), false)) === true)).reached;

// --- Filas, historial y diff -------------------------------------------------------------------------------------------------------

/** Textos de las celdas de la fila de un documento en la lista (escritorio), en orden. `undefined` si no se pueden leer. */
export const rowCells = async (page: Page, code: string): Promise<readonly string[] | undefined> => {
  const texts = await safe(() => rowOf(page, code).getByRole('cell').allInnerTexts(), undefined);
  return texts?.map((text) => text.replace(/\s+/g, ' ').trim());
};

/** Filas del historial de la ficha, cada una como la lista de textos de sus hijos (versión, nota, autor y fecha), en orden. */
export const readHistory = (page: Page): Promise<readonly (readonly string[])[] | undefined> =>
  safe(
    () =>
      historyList(page)
        .locator(':scope > li')
        .evaluateAll((items) => items.map((item) => Array.from(item.children, (child) => child.textContent?.trim() ?? ''))),
    undefined,
  );

/** Una línea de una celda del diff: número, texto, si está tachada (eliminada) o resaltada (añadida). */
export interface DiffSide {
  readonly line: string;
  readonly text: string;
  readonly struck: boolean;
  readonly marked: boolean;
}

/** Una fila de la tabla del diff: su tipo (`data-diff`) y sus dos lados. `undefined` si la tabla no se puede leer. */
export interface DiffRead {
  readonly kind: string;
  readonly left: DiffSide;
  readonly right: DiffSide;
}

/** Filas de la tabla del diff. Se lee el número y el texto de cada celda, y si lleva `del` (tachada) o `ins` (resaltada). */
export const readDiff = (page: Page): Promise<readonly DiffRead[] | undefined> =>
  safe(
    () =>
      diffTable(page)
        .locator('tbody > tr')
        .evaluateAll((rows) =>
          rows.map((row) => {
            const sideOf = (cell: Element | undefined): { line: string; text: string; struck: boolean; marked: boolean } => {
              const flex = cell?.querySelector('span.flex');
              return {
                line: flex?.firstElementChild?.textContent?.trim() ?? '',
                text: flex?.lastElementChild?.textContent?.trim() ?? '',
                struck: cell?.querySelector('del') !== null && cell?.querySelector('del') !== undefined,
                marked: cell?.querySelector('ins') !== null && cell?.querySelector('ins') !== undefined,
              };
            };
            const [leftCell, rightCell] = Array.from(row.querySelectorAll(':scope > td'));
            return { kind: row.getAttribute('data-diff') ?? '', left: sideOf(leftCell), right: sideOf(rightCell) };
          }),
        ),
    undefined,
  );

/**
 * Espera a que la elección de «Desde»/«Hasta» haya llegado al DOM y la tabla del diff esté VISIBLE y no «ocupada». Las llamadas
 * siempre piden dos versiones distintas, así que la tabla debe existir: un `aria-busy` ilegible o una tabla ausente no cuentan.
 */
export const waitDiffSettled = async (page: Page, from: string, to: string): Promise<boolean> =>
  (
    await waitUntil(
      async () =>
        (await selectedOptionText(compareFrom(page))) === from &&
        (await selectedOptionText(compareTo(page))) === to &&
        (await visibleOrUnknown(diffTable(page))) === true &&
        (await attrOf(diffWrapper(page), 'aria-busy')) === 'false',
    )
  ).reached;

/** Textos de las cabeceras de la tabla del diff («Versión N» desde y hasta), en orden. `undefined` si no se pueden leer. */
export const readHeaders = (page: Page): Promise<readonly string[] | undefined> =>
  safe(() => diffTable(page).locator('thead th').allInnerTexts(), undefined).then((texts) => texts?.map((text) => text.replace(/\s+/g, ' ').trim()));

/** Elige una opción de «Desde» o «Hasta» por su texto visible. */
export const chooseVersion = (which: 'Desde' | 'Hasta', option: string): ((page: Page) => Promise<Blocked | undefined>) => (page) =>
  interact(which === 'Desde' ? compareFrom(page) : compareTo(page), `elegir «${option}» en «${which}»`, (element) => element.selectOption({ label: option }, ACTION));

// --- Visibilidad estricta de una lectura ------------------------------------------------------------------------------------------

/** Visibilidad de un elemento: `undefined` si no se puede leer (una lectura fallida nunca cuenta como oculto). */
export const visibleOrUnknown = (target: Locator): Promise<boolean | undefined> => safe(() => target.first().isVisible({ timeout: 500 }), undefined);

/** Comprobación de visibilidad: «no se ve» solo si la lectura se pudo hacer y el elemento no se ve. */
export const hiddenCheck = async (target: Locator, what: string): Promise<Check> => {
  const seen = await visibleOrUnknown(target);
  return check(seen === false, `no se ve ${what}`, seen === undefined ? `no se puede leer si se ve ${what}` : seen ? `se ve ${what}` : `no se ve ${what}`);
};

/** Resultado de una fila con sus comprobaciones: `coincide` si todas se cumplen; si no, la nota dice en qué difiere. */
export const finish = (checks: readonly Check[], extra: { readonly note?: string; readonly evidence?: Readonly<Record<string, unknown>> } = {}): Outcome => {
  const differences = checks.filter((entry) => !entry.ok).map((entry) => `«${entry.expected}» no se cumple (${entry.observed})`);
  const note = extra.note ?? (differences.length === 0 ? undefined : `Difiere en: ${differences.join('; ')}`);
  return outcome(differences.length === 0, checks.map((entry) => entry.expected).join('; '), checks.map((entry) => entry.observed).join('; '), {
    ...(note === undefined ? {} : { note }),
    ...(extra.evidence === undefined ? {} : { evidence: extra.evidence }),
  });
};

// --- Persistencia por API ---------------------------------------------------------------------------------------------------------

/**
 * Lee la ficha por API con la cuenta hasta que la versión vigente sea `version` (techo de 5 s). Se llama DESPUÉS de esperar el aviso,
 * nunca antes: la persistencia se comprueba contra el servidor, no contra la pantalla.
 */
export const apiVersionReached = async (account: Credentials, doc: string, version: number): Promise<{ readonly reached: boolean; readonly state: DocumentState | undefined }> => {
  const login = await loginAs(TENANT_A, account);
  if (login.token === undefined) return { reached: false, state: undefined };
  const token = login.token;
  let latest: DocumentState | undefined;
  const found = await waitUntil(async () => {
    latest = await documentOf(TENANT_A, token, doc);
    return latest.version === version;
  }, 5_000);
  return { reached: found.reached, state: latest };
};

/** Cuenta las peticiones POST cuya ruta termina en `suffix` que salen de la página desde ahora («no se envía nada»). */
export const countPosts = (page: Page, suffix: string): (() => number) => {
  let posts = 0;
  page.on('request', (request) => {
    if (request.method() === 'POST' && new URL(request.url()).pathname.endsWith(suffix)) posts += 1;
  });
  return () => posts;
};

/** Versión vigente de un documento leída por API con la cuenta (`undefined` = no legible). Lectura única: no espera. */
export const apiVersionOf = async (account: Credentials, doc: string): Promise<number | undefined> => {
  const login = await loginAs(TENANT_A, account);
  if (login.token === undefined) return undefined;
  return (await documentOf(TENANT_A, login.token, doc)).version;
};

/** Pausa de tolerancia para una reacción local de la pantalla (1 s): no es un plazo del producto. */
export const settle = (): Promise<void> => sleep(1_000);
