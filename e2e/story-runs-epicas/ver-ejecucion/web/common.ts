import type { Download, Locator, Page } from '@playwright/test';
import { DEMO, TENANT_A, type Credentials } from '../../../story-runs/support/prepare';
import { VERIFICACION_DYNAMIC_TESTIDS, VERIFICACION_TESTIDS } from '../../../../packages/shared/src/testids';
import { ACTION, CEILING_MS, attrOf, isVisible, runSteps, safe, textOf, waitUntil, type Step } from '../../support/browser';
import { sleep } from '../../support/checks';
import { outcome, type BrowserRowHandler, type Outcome } from '../../core/framework';
import type { Upload } from '../api/files';

// Piezas comunes de las filas web de EP-VER-EJECUCION (escritorio 1440 × 900) sobre `/verification/TC-001`. Los localizadores son de
// rol, de nombre y de etiqueta; los ids de prueba solo donde la pantalla no ofrece otro rastro (historial, avisos, bloque de archivos).
// Toda acción pasa por `interact` (si falla, la nota dice si el elemento no existe, si lo tapa otro, o si recibe el clic sin efecto);
// toda lectura tiene un plazo corto y los paneles se leen en UNA sola evaluación para que no se mezclen dos instantes.

/** Ruta del detalle del caso de la historia (`/verification/TC-001`). */
export const CASE_PATH = '/verification/TC-001';
export const LOGIN_URL = `/login?tenant=${TENANT_A}`;
/** Plazo de cada lectura de la pantalla: una lectura no puede colgar la fila. */
export const READ_MS = 2_000;
/** Espera que observa que un aviso NO aparece: mayor que su vida de 3 s. */
export const QUIET_WINDOW_MS = 4_000;
/** Lo que la fila añade a su resultado: la preferencia de cookies se fija antes de abrir la app (el aviso tapa controles). */
export const COOKIE_NOTE = 'La prueba fija la preferencia de cookies (sigpro.cookies = accepted) antes de abrir la app, como el piloto; el aviso de cookies no se ejerce aquí.';

/** Envuelve una fila web para añadir la nota de cookies a su resultado. */
export const onWeb =
  (handler: BrowserRowHandler): BrowserRowHandler =>
  async (row, fixtures) => {
    const result = await handler(row, fixtures);
    return { ...result, note: result.note === undefined ? COOKIE_NOTE : `${result.note} ${COOKIE_NOTE}` };
  };

/** Solo la preferencia de cookies (no es una sesión). */
const fixCookiePreference = (): void => {
  try {
    localStorage.setItem('sigpro.cookies', 'accepted');
  } catch {
    // sin almacenamiento: no hay preferencia que fijar
  }
};

// --- Cuentas e inicio de sesión ---------------------------------------------------------------------------------------------------

/** Cuentas que entran sin segundo factor (las de la historia: consultor, gestor y auditor). */
export type WebAccount = 'consultor' | 'gestor' | 'auditor';

const CREDENTIALS_OF: Readonly<Record<WebAccount, Credentials>> = { consultor: DEMO.consultor, gestor: DEMO.gestor, auditor: DEMO.auditor };

/** Registro de avisos: se instala ANTES de abrir la app, en cada página de la fila. */
export const TOAST_KEY = '__sigproToasts';

/**
 * Preparación de cada fila: fija la preferencia de cookies y el registro de avisos, abre /login?tenant=alumno01, escribe la cuenta y su
 * contraseña y pulsa «Entrar». Termina en /programs. Devuelve el motivo si no llega.
 */
export const signIn = (page: Page, account: WebAccount): Promise<string | undefined> => {
  const credentials = CREDENTIALS_OF[account];
  const steps: Step[] = [
    ['fijar la preferencia de cookies', () => page.context().addInitScript(fixCookiePreference)],
    ['instalar el registro de avisos', () => page.context().addInitScript(recordToasts, TOAST_KEY)],
    ['fijar el ancho de la ventana', () => page.setViewportSize({ width: 1440, height: 900 })],
    ['abrir /login?tenant=alumno01', () => page.goto(LOGIN_URL, { timeout: CEILING_MS })],
    ['escribir el correo', () => page.getByLabel('Correo electrónico', { exact: true }).fill(credentials.email, ACTION)],
    ['escribir la contraseña', () => page.getByLabel('Contraseña', { exact: true }).fill(credentials.password, ACTION)],
    ['pulsar «Entrar»', () => page.getByRole('button', { name: 'Entrar', exact: true }).click(ACTION)],
    ['llegar a /programs', () => page.waitForURL(/\/programs/, { timeout: CEILING_MS })],
  ];
  return runSteps(steps);
};

/** Abre el detalle del caso TC-001 con la sesión de la página. Devuelve el motivo si el detalle no aparece. */
export const openCase = async (page: Page): Promise<string | undefined> => {
  const opened = await runSteps([['abrir /verification/TC-001', () => page.goto(CASE_PATH, { timeout: CEILING_MS })]]);
  if (opened !== undefined) return opened;
  const shown = await waitUntil(() => isVisible(caseDetail(page)));
  return shown.reached ? undefined : 'el detalle del caso TC-001 no aparece';
};

/** Inicia sesión como la cuenta y abre el caso. Devuelve el motivo del primer paso que no se cumple. */
export const prepareCase = async (page: Page, account: WebAccount): Promise<string | undefined> => {
  const signed = await signIn(page, account);
  if (signed !== undefined) return signed;
  return openCase(page);
};

// --- Acciones con diagnóstico -------------------------------------------------------------------------------------------------------

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

/** Lo que se registra de una acción fallida: las primeras líneas del error, quién recibe el clic y si el elemento existe. */
const describeFailure = async (target: Locator, label: string, error: unknown): Promise<Blocked> => {
  const lines = (error instanceof Error ? error.message : String(error)).split('\n').map((line) => line.trim()).filter((line) => line !== '');
  const intercept = lines.find((line) => line.includes('intercepts pointer events'));
  const present = (await safe(() => target.count(), 0)) > 0;
  const message = `no se pudo ${label}: ${lines.slice(0, 3).join(' · ')}${intercept === undefined ? '' : ` · ${intercept}`}`;
  if (!present) return { message, note: 'La historia nombra un elemento que la pantalla no ofrece (no existe con ese nombre).' };
  const probe = await safe<Hit | undefined>(() => target.first().evaluate(hitAtCenter, undefined, { timeout: READ_MS }), undefined);
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

/** Ejecuta las acciones en orden y devuelve el diagnóstico de la primera que falla (`undefined` si todas salen bien). */
export const inOrder = async (...actions: readonly (() => Promise<Blocked | undefined>)[]): Promise<Blocked | undefined> => {
  for (const action of actions) {
    const blocked = await action();
    if (blocked !== undefined) return blocked;
  }
  return undefined;
};

/** Una acción fallida como resultado de la fila: el diagnóstico va en el observado y en la nota. */
export const actionFailed = (expected: string, blocked: Blocked): Outcome =>
  outcome(false, expected, blocked.message, { note: blocked.note, ...(blocked.evidence === undefined ? {} : { evidence: blocked.evidence }) });

// --- Localizadores del detalle del caso --------------------------------------------------------------------------------------------

export const caseDetail = (page: Page): Locator => page.getByTestId(VERIFICACION_TESTIDS.TESTCASE_DETAIL);
/** Último resultado en la cabecera del caso (no la insignia de cada ejecución). */
export const headerBadge = (page: Page): Locator => page.getByTestId(VERIFICACION_TESTIDS.TESTCASE_RESULT_BADGE);
export const runForm = (page: Page): Locator => page.getByTestId(VERIFICACION_TESTIDS.RUN_FORM);
export const runsTable = (page: Page): Locator => page.getByTestId(VERIFICACION_TESTIDS.TESTCASE_RUNS);
export const runRowOf = (page: Page, id: string): Locator => page.getByTestId(VERIFICACION_DYNAMIC_TESTIDS.RUN_ROW(id));
export const resultRadio = (page: Page, label: string): Locator => runForm(page).getByRole('radio', { name: label, exact: true });
export const notesBox = (page: Page): Locator => runForm(page).getByRole('textbox', { name: 'Notas', exact: true });
export const submitButton = (page: Page): Locator => runForm(page).getByTestId(VERIFICACION_TESTIDS.RUN_SUBMIT);
export const evidenceSimpleInput = (page: Page): Locator => runForm(page).getByLabel('Adjuntar un archivo', { exact: true });
export const evidenceMultipleInput = (page: Page): Locator => runForm(page).getByLabel('Adjuntar varios archivos', { exact: true });
export const dropzone = (page: Page): Locator => runForm(page).getByTestId(VERIFICACION_TESTIDS.RUN_DROPZONE);
export const resultErrorText = (page: Page): Locator => runForm(page).getByTestId(VERIFICACION_TESTIDS.RUN_RESULT_ERROR);
/** El aviso de error del servidor se pinta ANTES del `<form>` (fuera de él): se busca en la página entera. */
export const serverErrorBox = (page: Page): Locator => page.getByTestId(VERIFICACION_TESTIDS.RUN_SERVER_ERROR);
export const deniedNote = (page: Page): Locator => page.getByTestId(VERIFICACION_TESTIDS.RUN_DENIED);
export const removeFileButton = (page: Page, name: string): Locator => runForm(page).getByRole('button', { name: `Quitar ${name}`, exact: true });

/** Número de filas del historial (la tabla de ejecuciones). Lectura con plazo; `-1` si no se puede leer. */
export const runRowCount = (page: Page): Promise<number> => safe(() => runsTable(page).locator('tbody tr').count(), -1);

/** Lectura atómica de los archivos elegidos y sus avisos (una sola evaluación en el formulario). */
export interface FilesPanel {
  /** Cada archivo de «Archivos seleccionados»: sus líneas visibles y el texto alternativo de su vista previa, si la tiene. */
  readonly items: readonly { readonly lines: readonly string[]; readonly alt: string | null }[];
  /** Los avisos de archivos que estén visibles (cada uno en una línea). */
  readonly errors: readonly string[];
  /** Si el texto «Ningún archivo seleccionado» está visible. */
  readonly noneText: boolean;
}

export const readFilesPanel = (page: Page): Promise<FilesPanel | undefined> =>
  safe(
    () =>
      runForm(page).evaluate(
        (root) => {
          const list = root.querySelector('[data-testid="run-files"]');
          const errorList = root.querySelector('[data-testid="run-files-error"]');
          const items = list === null ? [] : Array.from(list.querySelectorAll('li')).map((li) => ({ lines: li.innerText.split('\n').map((line) => line.trim()).filter((line) => line !== ''), alt: li.querySelector('img')?.getAttribute('alt') ?? null }));
          const errors = errorList === null ? [] : Array.from(errorList.querySelectorAll('li')).map((li) => (li.textContent ?? '').trim());
          return { items, errors, noneText: (root as HTMLElement).innerText.includes('Ningún archivo seleccionado') };
        },
        undefined,
        { timeout: READ_MS },
      ),
    undefined,
  );

/** Lectura atómica de una fila del historial: sus celdas, sus imágenes (alt, origen y estado) y sus pies de figura. */
export interface RunRowRead {
  readonly cells: readonly string[];
  readonly images: readonly { readonly alt: string | null; readonly src: string | null; readonly state: string | null }[];
  readonly captions: readonly string[];
}

export const readRunRow = (row: Locator): Promise<RunRowRead | undefined> =>
  safe(
    () =>
      row.evaluate(
        (element) => ({
          cells: Array.from(element.querySelectorAll('td')).map((cell) => cell.innerText.trim()),
          images: Array.from(element.querySelectorAll('img')).map((img) => ({ alt: img.getAttribute('alt'), src: img.getAttribute('src'), state: img.getAttribute('data-state') })),
          captions: Array.from(element.querySelectorAll('figcaption')).map((caption) => caption.innerText.trim()),
        }),
        undefined,
        { timeout: READ_MS },
      ),
    undefined,
  );

/** Lo que se ve en la primera fila del historial (su testid `run-row-…`), o `undefined` si no hay filas. */
export const firstRunId = (page: Page): Promise<string | undefined> =>
  safe(async () => {
    const id = await runsTable(page).locator('tbody tr').first().getAttribute('data-testid', { timeout: READ_MS });
    return id?.replace(/^run-row-/, '');
  }, undefined);

/** Texto de la insignia del último resultado de la cabecera (`undefined` si no se puede leer). */
export const headerResult = (page: Page): Promise<string | undefined> => textOf(headerBadge(page));

// --- Archivos: carga por el campo de archivo, arrastre y descarga --------------------------------------------------------------------

/** Forma de un archivo para `setInputFiles` (el tipo que declara el navegador). */
export const payloadOf = (file: Upload): { readonly name: string; readonly mimeType: string; readonly buffer: Buffer } => ({ name: file.name, mimeType: file.type, buffer: file.bytes });

/** Elige archivos en un campo de archivo (un `<input type=file>` dentro de su etiqueta). */
export const chooseFiles = (input: Locator, label: string, files: readonly Upload[]): Promise<Blocked | undefined> =>
  interact(input, label, (element) => element.setInputFiles(files.map(payloadOf), { timeout: CEILING_MS }));

/**
 * Arrastra un archivo a la zona «Arrastra aquí tus evidencias»: se construye un `DataTransfer` dentro de la página y se envía el
 * evento `drop` (Playwright no arrastra archivos del escritorio). Lo que hace el manejador de la zona se observa después.
 */
export const dropFile = (zone: Locator, file: Upload): Promise<Blocked | undefined> =>
  interact(zone, 'arrastrar el archivo a la zona «Arrastra aquí tus evidencias»', (element) =>
    element.evaluate(
      (node, payload) => {
        const transfer = new DataTransfer();
        transfer.items.add(new File([new Uint8Array(payload.data)], payload.name, { type: payload.type }));
        node.dispatchEvent(new DragEvent('drop', { dataTransfer: transfer, bubbles: true, cancelable: true }));
      },
      { name: file.name, type: file.type, data: Array.from(file.bytes) },
      { timeout: CEILING_MS },
    ),
  );

/** Descarga que dispara `trigger`: el nombre sugerido por el navegador. Un fallo de la descarga lanza (la fila lo recoge). */
export const downloadName = async (page: Page, trigger: () => Promise<unknown>): Promise<string> => {
  const pending = page.waitForEvent('download', { timeout: CEILING_MS });
  pending.catch(() => undefined);
  await trigger();
  const download: Download = await pending;
  return download.suggestedFilename();
};

// --- Avisos emergentes: registro desde antes de la acción -----------------------------------------------------------------------------

/** Un aviso registrado: tono, título (primera línea), cuerpo (segunda) y marca de tiempo del navegador. */
export interface ToastEntry {
  readonly tone: string;
  readonly title: string;
  readonly body: string;
  readonly at: number;
}

/** Se ejecuta en el navegador antes de cargar la app: registra cada aparición de un aviso (sin la cruz de cierre). */
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

/** Registro de avisos de la página desde la última «armada». */
export const toastLog = (page: Page): Promise<readonly ToastEntry[]> =>
  safe(() => page.evaluate((key: string) => ((window as unknown as Record<string, unknown>)[key] as ToastEntry[] | undefined) ?? [], TOAST_KEY), []);

export interface ToastResult {
  readonly seen: boolean;
  /** Lo que hay en el registro desde la «armada», en una frase. */
  readonly observed: string;
}

/** Busca en el registro un aviso con ese tono, título y cuerpo (exactos). Espera con techo; consulta el registro, no la pantalla. */
export const toastShown = async (page: Page, tone: 'ok' | 'danger' | 'info' | 'warn', title: string, body: string): Promise<ToastResult> => {
  const matches = (entry: ToastEntry): boolean => entry.tone === tone && entry.title === title && entry.body === body;
  const found = await waitUntil(async () => (await toastLog(page)).some(matches));
  const log = await toastLog(page);
  return { seen: found.reached, observed: log.length === 0 ? 'ningún aviso' : `avisos: ${log.map((entry) => `${entry.tone} «${entry.title}»${entry.body === '' ? '' : ` / «${entry.body}»`}`).join(' | ')}` };
};

/** Tras una acción que termina ahora, espera la ventana de observación y dice si NO apareció ningún aviso de éxito desde la armada. */
export const noOkToast = async (page: Page): Promise<{ readonly held: boolean; readonly seen: string }> => {
  await sleep(QUIET_WINDOW_MS);
  const ok = (await toastLog(page)).filter((entry) => entry.tone === 'ok');
  return { held: ok.length === 0, seen: ok.map((entry) => `«${entry.title}»`).join(', ') };
};

// --- Peticiones: cuántas veces el formulario envió la ejecución ----------------------------------------------------------------------

/** Cuenta las peticiones `POST …/test-cases/TC-001/runs` que sale de la página desde ahora (sin tocar las respuestas). */
export const watchRunPosts = (page: Page): (() => number) => {
  let posts = 0;
  page.on('request', (request) => {
    if (request.method() !== 'POST') return;
    try {
      if (/\/test-cases\/TC-001\/runs$/.test(new URL(request.url()).pathname)) posts += 1;
    } catch {
      // una URL que no se lee no es una petición de ejecución
    }
  });
  return () => posts;
};

/** Lectura de un atributo `title` del control (motivo del botón deshabilitado en la web). */
export const titleOf = (target: Locator): Promise<string | undefined> => attrOf(target, 'title');

/** Lectura visible de un elemento, o `undefined` si no se puede leer en el plazo. */
export const textOfVisible = (target: Locator): Promise<string | undefined> => textOf(target);

/** Motivo de un aviso de error del servidor: el texto tras el último « · » (el código HTTP va delante y no se compara). */
export const motiveOf = (text: string | undefined): string | undefined => (text === undefined ? undefined : text.split(' · ').at(-1)?.trim());

/** Espera a que un locator esté visible, con techo (lo que se espera tras una acción de la interfaz). */
export const visibleSoon = (target: Locator): Promise<boolean> => waitUntil(() => isVisible(target)).then((result) => result.reached);
