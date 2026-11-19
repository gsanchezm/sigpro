import type { Locator, Page } from '@playwright/test';
import { DEMO, TENANT_A, type Credentials } from '../../../story-runs/support/prepare';
import { MOVIL_VERIFICATION_TESTIDS, VERIFICACION_TESTIDS } from '../../../../packages/shared/src/testids';
import { ACTION, CEILING_MS, runSteps, safe, waitUntil, type Step } from '../../support/browser';
import { check, conclude, preparationFailedWeb, type Check } from '../../support/checks';
import { outcome, type BrowserRowHandler, type Outcome } from '../../core/framework';
import { payloadOf, interact, registryArmed, UNARMED_REASON, type Blocked, type ToastResult, recordToasts, TOAST_KEY, toastLog, armToasts, toastShown, noOkToast, watchRunPosts, CASE_PATH } from '../web/common';
import type { Upload } from '../api/files';

// Piezas comunes de las filas de la app móvil de EP-VER-EJECUCION, servida como web de Expo (390 × 844). NO es iOS ni Android nativo: los
// selectores del sistema (fotos, documentos, hoja de compartir) los atiende Playwright con su «filechooser»; la hoja de compartir del
// sistema no se comprueba aquí. Las lecturas del móvil son de texto visible y de atributos (`aria-disabled`, `readonly`, `data-state`,
// `data-reason`), con plazo corto, y los paneles se leen en una sola evaluación.

export const EXPO_NOTE = 'El veredicto vale para Expo web (390 × 844): no se ha comprobado en iOS ni en Android nativo.';
export const LOGIN_PATH = '/login';
export const TENANT_TEXT = 'Tenant de trabajo';
/** Plazo de cada lectura de la pantalla móvil. */
export const READ_MS = 2_000;

/** Añade a cada resultado de la fila la salvedad de plataforma (Expo web no es nativo). */
export const onExpoWeb =
  (handler: BrowserRowHandler): BrowserRowHandler =>
  async (row, fixtures) => {
    const result = await handler(row, fixtures);
    return { ...result, note: result.note === undefined ? EXPO_NOTE : `${result.note} ${EXPO_NOTE}` };
  };

/** Cuentas que entran sin segundo factor en la app móvil. */
export type MobileAccount = 'consultor' | 'gestor' | 'auditor';
const CREDENTIALS_OF: Readonly<Record<MobileAccount, Credentials>> = { consultor: DEMO.consultor, gestor: DEMO.gestor, auditor: DEMO.auditor };

const textbox = (page: Page, name: string): Locator => page.getByRole('textbox', { name, exact: true });
const buttonNamed = (page: Page, name: string): Locator => page.getByRole('button', { name, exact: true });

/**
 * Preparación de cada fila: la app en /login con alumno01 en «Tenant de trabajo», la cuenta con su contraseña y «Entrar». Termina en
 * /programs. Después la fila abre el caso con `openCaseMobile`.
 */
export const signIn = (page: Page, account: MobileAccount): Promise<string | undefined> => {
  const credentials = CREDENTIALS_OF[account];
  const steps: Step[] = [
    ['instalar el registro de avisos', () => page.context().addInitScript(recordToasts, TOAST_KEY)],
    ['fijar el ancho de la ventana', () => page.setViewportSize({ width: 390, height: 844 })],
    ['abrir /login', () => page.goto(LOGIN_PATH, { timeout: CEILING_MS })],
    ['ver el título «Iniciar sesión»', () => page.getByRole('heading', { name: 'Iniciar sesión', level: 1, exact: true }).waitFor({ timeout: CEILING_MS })],
    [`escribir alumno01 en «${TENANT_TEXT}»`, () => textbox(page, TENANT_TEXT).fill(TENANT_A, ACTION)],
    ['escribir el correo', () => textbox(page, 'Correo electrónico').fill(credentials.email, ACTION)],
    ['escribir la contraseña', () => textbox(page, 'Contraseña').fill(credentials.password, ACTION)],
    ['pulsar «Entrar»', () => buttonNamed(page, 'Entrar').click(ACTION)],
    ['llegar a /programs', () => page.waitForURL(/\/programs/, { timeout: CEILING_MS })],
  ];
  return runSteps(steps);
};

/** Abre el detalle del caso TC-001 (`/verification/TC-001`) y espera a que el caso esté pintado. */
export const openCaseMobile = async (page: Page): Promise<string | undefined> => {
  const opened = await runSteps([['abrir /verification/TC-001', () => page.goto(CASE_PATH, { timeout: CEILING_MS })]]);
  if (opened !== undefined) return opened;
  const shown = await waitUntil(async () => (await safe(() => page.getByTestId(VERIFICACION_TESTIDS.TESTCASE_DETAIL).isVisible(), false)) === true);
  return shown.reached ? undefined : 'el detalle del caso TC-001 no aparece';
};

// --- Localizadores de la pantalla del caso (móvil) -------------------------------------------------------------------------------

export const resultRadio = (page: Page, label: string): Locator => page.getByRole('radio', { name: label, exact: true });
export const notesField = (page: Page): Locator => textbox(page, 'Notas');
export const notesErrorText = (page: Page): Locator => page.getByTestId(MOVIL_VERIFICATION_TESTIDS.RUN_NOTES_ERROR);
export const resultErrorText = (page: Page): Locator => page.getByTestId(VERIFICACION_TESTIDS.RUN_RESULT_ERROR);
export const submitButton = (page: Page): Locator => buttonNamed(page, 'Registrar ejecución');
export const pickOneButton = (page: Page): Locator => buttonNamed(page, 'Adjuntar un archivo');
export const pickManyButton = (page: Page): Locator => buttonNamed(page, 'Adjuntar varios archivos');
export const pickPdfButton = (page: Page): Locator => buttonNamed(page, 'Adjuntar PDF');
export const deniedNote = (page: Page): Locator => page.getByTestId(VERIFICACION_TESTIDS.RUN_DENIED);
export const serverErrorBox = (page: Page): Locator => page.getByTestId(VERIFICACION_TESTIDS.RUN_SERVER_ERROR);
export const filesErrorBox = (page: Page): Locator => page.getByTestId(VERIFICACION_TESTIDS.RUN_FILES_ERROR);
export const filesList = (page: Page): Locator => page.getByRole('list', { name: 'Archivos seleccionados', exact: true });
export const historyList = (page: Page): Locator => page.getByRole('list', { name: 'Historial de ejecuciones', exact: true });
/** Tarjeta de una ejecución del historial (su nombre accesible es el identificador). */
export const runCard = (page: Page, id: string): Locator => historyList(page).getByRole('listitem', { name: id, exact: true });
/** Número de tarjetas del historial. */
export const runCardCount = (page: Page): Promise<number> => safe(() => historyList(page).getByRole('listitem').count(), -1);
/** Identificador de la primera tarjeta del historial (`undefined` si no se puede leer). */
export const firstCardId = (page: Page): Promise<string | undefined> => safe(() => historyList(page).getByRole('listitem').first().getAttribute('aria-label', { timeout: READ_MS }).then((value) => value ?? undefined), undefined);

// --- Lecturas con plazo corto ---------------------------------------------------------------------------------------------------------

/** Texto de un elemento solo si se ve de verdad (ni él ni sus ancestros con `hidden`, `display:none` o `visibility:hidden`). Plazo corto. */
export const visibleTextOf = (target: Locator): Promise<string | undefined> =>
  safe(
    () =>
      target.first().evaluate(
        (element) => {
          let node: Element | null = element;
          while (node !== null) {
            const style = getComputedStyle(node);
            if (node.hasAttribute('hidden') || style.display === 'none' || style.visibility === 'hidden') return undefined;
            node = node.parentElement;
          }
          return (element as HTMLElement).innerText.trim();
        },
        undefined,
        { timeout: READ_MS },
      ),
    undefined,
  );

/**
 * Un control bloqueado, leído solo en SUS PROPIOS atributos: `disabled` (propiedad), `readonly` (propiedad) o `aria-disabled="true"`
 * en el propio elemento. No sube por los ancestros: un ancestro deshabilitado no prueba que el control lo esté. `undefined` = sin leer.
 */
export const lockedOf = (target: Locator): Promise<boolean | undefined> =>
  safe(
    () =>
      target.first().evaluate(
        (element) => {
          const field = element as HTMLInputElement;
          return field.disabled === true || field.readOnly === true || element.getAttribute('aria-disabled') === 'true';
        },
        undefined,
        { timeout: READ_MS },
      ),
    undefined,
  );

/**
 * Intento de uso de un control bloqueado: se hace clic FORZADO (sin esperar a que sea usable) y se devuelve el estado de la
 * acción en su efecto, no en su atributo. No lanza: un clic que no llega a nada es el resultado buscado.
 */
export const attemptClick = (target: Locator): Promise<void> => safe(() => target.first().click({ force: true, timeout: READ_MS }), undefined).then(() => undefined);

/**
 * La imagen ampliada de la hoja está CARGADA (no solo presente): si es una `img`, debe estar completa con ancho natural; si es un
 * fondo de imagen, debe tener una imagen de fondo y un tamaño visible. `false` si no carga o no se ve.
 */
export const zoomImageLoaded = (page: Page): Promise<boolean> =>
  safe(
    () =>
      page.getByTestId(MOVIL_VERIFICATION_TESTIDS.EVIDENCE_ZOOM_IMAGE).first().evaluate(
        (element) => {
          if (element instanceof HTMLImageElement) return element.complete && element.naturalWidth > 0;
          const style = getComputedStyle(element);
          return style.backgroundImage !== 'none' && element.getBoundingClientRect().width > 0;
        },
        undefined,
        { timeout: READ_MS },
      ),
    false,
  );

/** Intento de elegir archivos con un botón bloqueado: `true` si el selector del sistema se abrió (no debería). */
export const attemptPicker = async (page: Page, button: Locator): Promise<boolean> => {
  const opened = page.waitForEvent('filechooser', { timeout: READ_MS }).then(
    () => true,
    () => false,
  );
  await attemptClick(button);
  return opened;
};

/** Intento de escribir en un campo de solo lectura: se fuerza el foco y se teclea; el valor no debe cambiar. */
export const attemptTyping = async (page: Page, field: Locator, text: string): Promise<void> => {
  await attemptClick(field);
  await safe(() => page.keyboard.type(text), undefined);
};

/** Valor de `aria-checked` de una opción (`true`, `false`), o `undefined` si no se lee. */
export const checkedOf = (target: Locator): Promise<boolean | undefined> =>
  safe(async () => {
    const value = await target.first().getAttribute('aria-checked', { timeout: READ_MS });
    return value === 'true' ? true : value === 'false' ? false : undefined;
  }, undefined);

/** Motivo que el botón expone como atributo `data-reason` (la app móvil no emite `aria-description` en Expo web). */
export const reasonOf = (target: Locator): Promise<string | undefined> =>
  safe(() => target.first().getAttribute('data-reason', { timeout: READ_MS }).then((value) => value ?? undefined), undefined);

/** Lectura del bloque de evidencias: los archivos elegidos (con sus líneas y su vista previa) y los avisos de archivos visibles. */
export interface MobilePanel {
  readonly items: readonly { readonly lines: readonly string[]; readonly preview: boolean }[];
  readonly errors: readonly string[];
}

/**
 * Lectura ATÓMICA del bloque de evidencias (archivos y avisos) en UNA sola evaluación sobre el formulario de la ejecución, para que
 * los dos datos correspondan al mismo instante. Sin archivos la app no pinta la lista: es una lista vacía, no una lectura fallida.
 */
export const readMobilePanel = (page: Page): Promise<MobilePanel | undefined> =>
  safe(
    () =>
      page.getByTestId(VERIFICACION_TESTIDS.RUN_FORM).evaluate(
        (form) => {
          const list = form.querySelector('[data-testid="run-files"]');
          const box = form.querySelector('[data-testid="run-files-error"]');
          const items = list === null ? [] : Array.from(list.querySelectorAll('[role="listitem"]')).map((item) => ({ lines: (item as HTMLElement).innerText.split('\n').map((line) => line.trim()).filter((line) => line !== ''), preview: item.querySelector('[data-testid^="run-file-preview-"]') !== null }));
          const errors = box === null ? [] : Array.from(box.querySelectorAll('*')).filter((node) => node.children.length === 0).map((node) => (node as HTMLElement).innerText.trim()).filter((text) => text !== '');
          return { items, errors };
        },
        undefined,
        { timeout: READ_MS },
      ),
    undefined,
  );

/** Preparación de una fila móvil: sesión, caso abierto y registro de avisos instalado (si no, la fila es preparationFailed). */
export const prepareMobileRow = async (page: Page, account: MobileAccount, expected: string): Promise<Outcome | undefined> => {
  const signed = await signIn(page, account);
  const opened = signed ?? (await openCaseMobile(page));
  if (opened !== undefined) return preparationFailedWeb(expected, opened);
  if (!(await registryArmed(page))) return preparationFailedWeb(expected, UNARMED_REASON);
  return undefined;
};

/** Lectura atómica de una tarjeta del historial: sus líneas visibles, sus miniaturas (estado y texto) y si tiene botón de ampliar. */
export interface CardRead {
  readonly lines: readonly string[];
  readonly thumbs: readonly { readonly testid: string | null; readonly state: string | null; readonly label: string | null; readonly role: string | null }[];
  readonly enlargeButtons: number;
  readonly images: number;
}

export const readCard = (card: Locator): Promise<CardRead | undefined> =>
  safe(
    () =>
      card.evaluate(
        (element) => ({
          lines: (element as HTMLElement).innerText.split('\n').map((line) => line.trim()).filter((line) => line !== ''),
          thumbs: Array.from(element.querySelectorAll('[data-testid^="evidence-thumb-"]')).map((node) => ({ testid: node.getAttribute('data-testid'), state: node.getAttribute('data-state'), label: node.getAttribute('aria-label'), role: node.getAttribute('role') })),
          enlargeButtons: Array.from(element.querySelectorAll('[aria-label^="Ampliar"]')).length,
          images: element.querySelectorAll('img').length,
        }),
        undefined,
        { timeout: READ_MS },
      ),
    undefined,
  );

/** Espera (con techo) a que las miniaturas de la tarjeta dejen de cargar, y devuelve su lectura. */
export const settledCard = async (card: Locator): Promise<CardRead | undefined> => {
  await waitUntil(async () => {
    const read = await readCard(card);
    return read !== undefined && read.thumbs.every((thumb) => thumb.state !== 'loading' && thumb.state !== null);
  });
  return readCard(card);
};

// --- Archivos: el selector del sistema (filechooser) ----------------------------------------------------------------------------------

/**
 * Pulsa un botón que abre un selector de archivos del sistema y entrega los archivos elegidos. El «filechooser» se arma ANTES del clic.
 * Si el selector no aparece, el motivo se devuelve como diagnóstico (no lanza).
 */
export const pickWith = async (page: Page, button: Locator, label: string, files: readonly Upload[]): Promise<Blocked | undefined> => {
  const chooser = page.waitForEvent('filechooser', { timeout: CEILING_MS });
  chooser.catch(() => undefined);
  const clicked = await interact(button, label, (element) => element.click(ACTION));
  if (clicked !== undefined) return clicked;
  try {
    const picker = await chooser;
    await picker.setFiles(files.map(payloadOf));
    return undefined;
  } catch (error) {
    const reason = error instanceof Error ? (error.message.split('\n')[0] ?? 'error') : String(error);
    return { message: `no se abrió el selector de archivos al pulsar «${label}»: ${reason}`, note: 'El botón existe pero no abrió el selector del navegador (Expo web abre un «input» de archivos tras el clic).' };
  }
};

// --- Resultados y comprobaciones ------------------------------------------------------------------------------------------------------

/** Acción fallida como resultado de la fila (el diagnóstico va en el observado y en la nota). */
export const actionFailedMobile = (expected: string, blocked: Blocked): Outcome =>
  outcome(false, expected, blocked.message, { note: blocked.note, ...(blocked.evidence === undefined ? {} : { evidence: blocked.evidence }) });

/** Veredicto de una fila móvil: coincide si todas se cumplen; si no, la nota dice en qué difiere. La evidencia se anota, nunca se juzga. */
export const mobileVerdict = (checks: readonly Check[], extra: { readonly note?: string; readonly evidence?: Readonly<Record<string, unknown>> } = {}): Outcome => {
  const failed = checks.filter((entry) => !entry.ok).map((entry) => entry.observed);
  const note = [failed.length === 0 ? undefined : `difiere en: ${failed.join('; ')}`, extra.note].filter((part): part is string => part !== undefined && part !== '').join('. ');
  return conclude(checks, { ...(note === '' ? {} : { note }), ...(extra.evidence === undefined ? {} : { evidence: extra.evidence }) });
};

/** Comprobación de un aviso de éxito: el registro de avisos lo ve, con el texto exacto. */
export const savedToast = (page: Page, body: string): Promise<ToastResult> => toastShown(page, 'ok', 'Ejecución registrada', body);

/** Comprobación de un control bloqueado: el valor es «bloqueado» en el sentido de la historia (no se puede usar). */
export const lockedCheck = (label: string, locked: boolean | undefined): Check =>
  check(locked === true, `${label} no se puede usar`, locked === undefined ? `${label} sin leer` : locked ? `${label} bloqueado` : `${label} se puede usar`);

export { armToasts, noOkToast, toastLog, watchRunPosts, TOAST_KEY, VERIFICACION_TESTIDS };
export type { Blocked, ToastResult, Upload };
