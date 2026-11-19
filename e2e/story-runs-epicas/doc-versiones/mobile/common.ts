import type { Locator, Page } from '@playwright/test';
import { DOCUMENTOS_TESTIDS, MOVIL_DOCUMENTS_TESTIDS } from '../../../../packages/shared/src/testids';
import { TENANT_A, type Credentials } from '../../../story-runs/support/prepare';
import { ACTION, CEILING_MS, attrOf, runSteps, safe, textOf, waitUntil, type Step } from '../../support/browser';
import { check, type Check } from '../../support/checks';
import type { BrowserRowHandler } from '../../core/framework';
import { TOAST_KEY, recordToasts, interact, type Blocked } from '../web/common';

// Piezas comunes de las filas de la app móvil de EP-DOC-VERSIONES. La app se ejecuta como web de Expo a 390 × 844: NO es iOS ni Android
// nativo, y cada fila lleva esa salvedad en su nota. Los localizadores son de rol (excluyen lo oculto) salvo donde la pantalla no ofrece
// otro rastro (el diff, las opciones de los selectores, el motivo bajo los botones), que llevan su id de testids.ts.

/** Salvedad de plataforma: el veredicto de una fila móvil vale para Expo web, no para iOS ni Android nativo. */
export const EXPO_NOTE = 'El veredicto vale para Expo web (390 × 844): no se ha comprobado en iOS ni en Android nativo.';

/** Aproximación declarada: abrir una dirección (carga completa) recupera la sesión guardada; no es un enlace profundo nativo. */
export const DIRECT_APPROXIMATION =
  'Abrir una dirección de la app se aproxima con una carga completa de la página en Expo web, que recupera la sesión guardada; en iOS o Android sería un enlace profundo o una navegación interna.';

/** Añade a cada resultado de la fila la salvedad de plataforma y la aproximación de abrir direcciones. */
export const onExpoWeb =
  (handler: BrowserRowHandler): BrowserRowHandler =>
  async (row, fixtures) => {
    const result = await handler(row, fixtures);
    return { ...result, note: [result.note, EXPO_NOTE, DIRECT_APPROXIMATION].filter((part) => part !== undefined).join(' ') };
  };

export const MOBILE_VIEWPORT = { width: 390, height: 844 } as const;
export const LOGIN_PATH = '/login';
export const TENANT_TEXT = 'Tenant de trabajo';

// --- Sesión ------------------------------------------------------------------------------------------------------------------------

export const textbox = (page: Page, name: string): Locator => page.getByRole('textbox', { name, exact: true });
export const buttonNamed = (page: Page, name: string): Locator => page.getByRole('button', { name, exact: true });

/** Inicio de sesión en la app: registro de avisos antes de cargar, 390 px, /login con alumno01 en «Tenant de trabajo» y llegada a /programs. */
export const signInAs = (page: Page, account: Credentials): Promise<string | undefined> => {
  const steps: Step[] = [
    ['instalar el registro de avisos', () => page.context().addInitScript(recordToasts, TOAST_KEY)],
    ['fijar el ancho de la ventana', () => page.setViewportSize(MOBILE_VIEWPORT)],
    ['abrir /login', () => page.goto(LOGIN_PATH, { timeout: CEILING_MS })],
    ['ver el título «Iniciar sesión»', () => page.getByRole('heading', { name: 'Iniciar sesión', level: 1, exact: true }).waitFor({ timeout: CEILING_MS })],
    [`escribir ${TENANT_A} en «${TENANT_TEXT}»`, () => textbox(page, TENANT_TEXT).fill(TENANT_A, ACTION)],
    ['escribir el correo', () => textbox(page, 'Correo electrónico').fill(account.email, ACTION)],
    ['escribir la contraseña', () => textbox(page, 'Contraseña').fill(account.password, ACTION)],
    ['pulsar «Entrar»', () => buttonNamed(page, 'Entrar').click(ACTION)],
    ['llegar a /programs', () => page.getByRole('heading', { name: 'Programas', level: 1, exact: true }).waitFor({ timeout: CEILING_MS })],
  ];
  return runSteps(steps);
};

/** Carga completa de una dirección de la app con la sesión guardada. */
export const gotoApp = (page: Page, path: string): Promise<string | undefined> => runSteps([[`abrir ${path}`, () => page.goto(path, { timeout: CEILING_MS })]]);

// --- Localizadores de la ficha ---------------------------------------------------------------------------------------------------

export const detailTitle = (page: Page): Locator => page.getByTestId(DOCUMENTOS_TESTIDS.DOCUMENT_TITLE);
/** Botón «Publicar nueva versión» (su nombre accesible es el texto visible). */
export const publishButton = (page: Page): Locator => buttonNamed(page, 'Publicar nueva versión');
/** Motivo visible bajo los botones de la ficha cuando el rol no puede publicar (id de prueba: el texto no tiene rol propio). */
export const publishReason = (page: Page): Locator => page.getByTestId(MOVIL_DOCUMENTS_TESTIDS.PUBLISH_REASON);
/** Opción de versión (chip con rol «radio», `aria-checked`) por su nombre visible («Versión 4 · última»). */
export const versionChip = (page: Page, label: string): Locator => page.getByRole('radio', { name: label, exact: true });
/** Diálogo «Publicar nueva versión» (hoja modal de la app). */
export const publishDialog = (page: Page): Locator => page.getByTestId(DOCUMENTOS_TESTIDS.DOCUMENT_PUBLISH_DIALOG);
export const contentField = (page: Page): Locator => textbox(page, 'Contenido (una línea por fila)');
export const noteField = (page: Page): Locator => textbox(page, 'Nota de cambios');
export const submitButton = (page: Page): Locator => buttonNamed(page, 'Publicar versión');
export const cancelButton = (page: Page): Locator => buttonNamed(page, 'Cancelar');
/** Aviso bajo el contenido (id de prueba del texto de error del campo de contenido). */
export const contentError = (page: Page): Locator => page.getByTestId(DOCUMENTOS_TESTIDS.DOCUMENT_PUBLISH_TEXT_ERROR);

/** Esperar a que el contenido de la última versión llegue: el campo editable y sin «Cargando…». */
export const waitDialogLoaded = async (page: Page): Promise<boolean> =>
  (
    await waitUntil(async () => {
      const loading = await safe(() => page.getByTestId(MOVIL_DOCUMENTS_TESTIDS.PUBLISH_LOADING).isVisible({ timeout: 500 }), true);
      return loading === false && (await safe(() => contentField(page).isEditable({ timeout: 500 }), false)) === true;
    })
  ).reached;

/** Pulsa «Publicar nueva versión» y espera a que el diálogo se vea. */
export const openPublishDialog = async (page: Page): Promise<Blocked | undefined> => {
  const pressed = await interact(publishButton(page), 'pulsar «Publicar nueva versión»', (element) => element.click(ACTION));
  if (pressed !== undefined) return pressed;
  const shown = await waitUntil(() => safe(() => publishDialog(page).isVisible({ timeout: 500 }), false));
  return shown.reached ? undefined : { message: 'se pulsó «Publicar nueva versión» y no se abrió el diálogo', note: 'el botón existe y se pulsó, pero el diálogo no apareció' };
};

// --- Selectores de versión y diff apilado ----------------------------------------------------------------------------------------

export const compareFrom = (page: Page): Locator => page.getByTestId(DOCUMENTOS_TESTIDS.DOCUMENT_COMPARE_FROM);
export const compareTo = (page: Page): Locator => page.getByTestId(DOCUMENTOS_TESTIDS.DOCUMENT_COMPARE_TO);
export const diffTable = (page: Page): Locator => page.getByTestId(DOCUMENTOS_TESTIDS.DOCUMENT_DIFF);
export const diffStats = (page: Page): Locator => page.getByTestId(DOCUMENTOS_TESTIDS.DOCUMENT_DIFF_STATS);

/** Valor visible de un selector de versión (sin la flecha «▾»), o `undefined` si no se puede leer. */
export const comboValue = async (combobox: Locator): Promise<string | undefined> => {
  const text = await textOf(combobox);
  return text === undefined ? undefined : text.replace(/▾/g, '').replace(/\s+/g, ' ').trim();
};

/** Elige una versión en «Desde» o «Hasta»: abre el selector y pulsa su opción (id «<selector>-option-N», de testids.ts). */
export const pickVersion = (which: 'Desde' | 'Hasta', option: string): ((page: Page) => Promise<Blocked | undefined>) => async (page) => {
  const selector = which === 'Desde' ? DOCUMENTOS_TESTIDS.DOCUMENT_COMPARE_FROM : DOCUMENTOS_TESTIDS.DOCUMENT_COMPARE_TO;
  const opened = await interact(page.getByTestId(selector), `abrir «${which}»`, (element) => element.click(ACTION));
  if (opened !== undefined) return opened;
  const number = option.replace('Versión ', '');
  return interact(page.getByTestId(`${selector}-option-${number}`), `elegir «${option}» en «${which}»`, (element) => element.click(ACTION));
};

/** Una celda de una fila apilada del diff: número con su signo, texto, tachado y posición vertical. */
export interface MobileCell {
  readonly gutter: string;
  readonly text: string;
  readonly struck: boolean;
  readonly top: number;
  readonly bottom: number;
}

/** Una fila del diff en la app: tipo (`data-diff`), su rótulo visible y sus celdas en orden. */
export interface MobileRow {
  readonly kind: string;
  readonly label: string;
  readonly cells: readonly MobileCell[];
}

/** Filas del diff de la app (con `data-diff`), en orden. `undefined` si la tabla no se puede leer. */
export const readMobileDiff = (page: Page): Promise<readonly MobileRow[] | undefined> =>
  safe(
    () =>
      diffTable(page)
        .locator('[data-diff]')
        .evaluateAll((rows) =>
          rows.map((row) => ({
            kind: row.getAttribute('data-diff') ?? '',
            label: Array.from(row.children)
              .filter((child) => child.getAttribute('role') !== 'cell')
              .map((child) => child.textContent?.trim() ?? '')
              .join(' '),
            cells: Array.from(row.querySelectorAll(':scope > [role="cell"]')).map((cell) => {
              const text = cell.lastElementChild;
              const box = cell.getBoundingClientRect();
              return {
                gutter: cell.firstElementChild?.textContent?.trim() ?? '',
                text: text?.textContent?.trim() ?? '',
                struck: text !== null && text !== undefined && getComputedStyle(text).textDecorationLine.includes('line-through'),
                top: box.top,
                bottom: box.bottom,
              };
            }),
          })),
        ),
    undefined,
  );

/** Estado «ocupado» de la tabla del diff (`aria-busy`): `true` mientras llega el resultado de una elección nueva. */
export const diffBusy = (page: Page): Promise<string | undefined> => attrOf(diffTable(page), 'aria-busy');

/** Comprobación de una celda apilada: su número con signo, su texto y si va tachada. */
export const cellCheck = (label: string, cell: MobileCell | undefined, gutter: string, text: string, struck: boolean): Check => {
  const ok = cell !== undefined && cell.gutter === gutter && cell.text === text && cell.struck === struck;
  const observed = cell === undefined ? '(sin celda)' : `${cell.gutter} «${cell.text}»${cell.struck ? ' tachada' : ''}`;
  return check(ok, `${label}: ${gutter} «${text}»${struck ? ' tachada' : ''}`, `${label}: ${observed}`);
};

