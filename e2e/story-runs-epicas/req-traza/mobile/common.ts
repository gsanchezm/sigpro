import type { Locator, Page } from '@playwright/test';
import { DEMO, TENANT_A } from '../../../story-runs/support/prepare';
import { MOVIL_PROGRAMS_TESTIDS, MOVIL_REQUIREMENTS_TESTIDS, REQUISITOS_DYNAMIC_TESTIDS, REQUISITOS_TESTIDS } from '../../../../packages/shared/src/testids';
import { ACTION, CEILING_MS, runSteps, safe, waitUntil, type Step } from '../../support/browser';
import { check, type Check } from '../../support/checks';
import { outcome, type BrowserRowHandler, type Outcome } from '../../core/framework';
import { AUDITOR, CONSULTOR, GESTOR, type Account } from '../api/common';
import { READ_MS, TOAST_KEY, armToasts, recordToasts, textOf } from '../web/common';

// Piezas comunes de las filas de la app móvil de EP-REQ-TRAZA, servida como web de Expo (390 × 844). NO es iOS ni Android nativo: el
// veredicto vale para Expo web. Los localizadores son de rol y de nombre; los ids de prueba solo donde la app no ofrece otro rastro.

export const EXPO_NOTE = 'El veredicto vale para Expo web (390 × 844): no se ha comprobado en iOS ni en Android nativo.';
export const TENANT_TEXT = 'Tenant de trabajo';
export const LOGIN_PATH = '/login';

/** Añade a cada resultado la salvedad de plataforma (Expo web no es nativo). */
export const onExpoWeb =
  (handler: BrowserRowHandler): BrowserRowHandler =>
  async (row, fixtures) => {
    const result = await handler(row, fixtures);
    return { ...result, note: result.note === undefined ? EXPO_NOTE : `${result.note} ${EXPO_NOTE}` };
  };

/** Cuenta de la celda de la historia → cuenta de la pantalla móvil (la misma que la web) y cuenta de la API. */
export const MOBILE_ACCOUNTS: ReadonlyMap<string, { readonly credentials: { readonly email: string; readonly password: string }; readonly api: Account }> = new Map([
  ['gestor@sigpro.test', { credentials: DEMO.gestor, api: GESTOR }],
  ['consultor@sigpro.test', { credentials: DEMO.consultor, api: CONSULTOR }],
  ['auditor@sigpro.test', { credentials: DEMO.auditor, api: AUDITOR }],
]);

// --- Localizadores ----------------------------------------------------------------------------------------------------------------

export const textbox = (page: Page, name: string): Locator => page.getByRole('textbox', { name, exact: true });
export const buttonNamed = (page: Page, name: string): Locator => page.getByRole('button', { name, exact: true });
export const heading1 = (page: Page, name: string): Locator => page.getByRole('heading', { name, level: 1, exact: true });
export const programsHeading = (page: Page): Locator => heading1(page, 'Programas');
/** Conmutador de vistas de Requisitos: en la app es un grupo de opciones (`role="radio"`), no pestañas. */
export const viewRadio = (page: Page, name: string): Locator => page.getByRole('radio', { name, exact: true });
export const matrixPanel = (page: Page): Locator => page.getByTestId(REQUISITOS_TESTIDS.REQUIREMENTS_PANEL_MATRIX);
export const matrixTable = (page: Page): Locator => matrixPanel(page).getByTestId(REQUISITOS_TESTIDS.MATRIX_TABLE);
export const legendOf = (page: Page): Locator => matrixPanel(page).getByTestId(REQUISITOS_TESTIDS.MATRIX_LEGEND);
export const hintOf = (page: Page): Locator => matrixPanel(page).getByTestId(MOVIL_REQUIREMENTS_TESTIDS.MATRIX_HINT);
export const reasonOf = (page: Page): Locator => matrixPanel(page).getByTestId(MOVIL_REQUIREMENTS_TESTIDS.MATRIX_REASON);
export const emptyOf = (page: Page): Locator => matrixPanel(page).getByTestId(REQUISITOS_TESTIDS.MATRIX_EMPTY);
export const errorOf = (page: Page): Locator => matrixPanel(page).getByTestId(MOVIL_REQUIREMENTS_TESTIDS.MATRIX_ERROR);
export const loadingOf = (page: Page): Locator => matrixPanel(page).getByTestId(MOVIL_REQUIREMENTS_TESTIDS.LOADING);
export const rowOf = (page: Page, code: string): Locator => matrixPanel(page).getByTestId(REQUISITOS_DYNAMIC_TESTIDS.MATRIX_ROW(code));
/** Casilla de un cruce: su nombre accesible empieza por «REQ ↔ CASO,» y cambia con el resultado; se localiza por ese prefijo. */
export const cellOf = (page: Page, requirement: string, testCase: string): Locator =>
  matrixPanel(page).getByRole('checkbox', { name: new RegExp(`^${requirement} ↔ ${testCase},`) });
export const retryOf = (page: Page): Locator => errorOf(page).getByRole('button', { name: 'Reintentar', exact: true });

/** Recuento de la leyenda («N de M requisitos con cobertura»), o `undefined` si no se lee. */
export const coverageText = (page: Page): Promise<string | undefined> => textOf(legendOf(page));

// --- Sesión y navegación ----------------------------------------------------------------------------------------------------------

const settled = async (page: Page): Promise<boolean> =>
  (await waitUntil(async () => (await safe(() => programsHeading(page).isVisible(), false)) && !(await safe(() => page.getByTestId(MOVIL_PROGRAMS_TESTIDS.PROGRAMS_LOADING).isVisible(), false)))).reached;

/**
 * Preparación de cada fila: la app en /login sin sesión guardada, con «alumno01» en «Tenant de trabajo», la cuenta con su contraseña y
 * «Entrar». Termina cuando /programs está asentada.
 */
export const signIn = (page: Page, credentials: { readonly email: string; readonly password: string }): Promise<string | undefined> => {
  const steps: Step[] = [
    ['instalar el registro de avisos', () => page.context().addInitScript(recordToasts, TOAST_KEY)],
    ['fijar el ancho de la ventana', () => page.setViewportSize({ width: 390, height: 844 })],
    ['abrir /login', () => page.goto(LOGIN_PATH, { timeout: CEILING_MS })],
    ['ver el título «Iniciar sesión»', () => heading1(page, 'Iniciar sesión').waitFor({ timeout: CEILING_MS })],
    [`escribir ${TENANT_A} en «${TENANT_TEXT}»`, () => textbox(page, TENANT_TEXT).fill(TENANT_A, ACTION)],
    ['escribir el correo', () => textbox(page, 'Correo electrónico').fill(credentials.email, ACTION)],
    ['escribir la contraseña', () => textbox(page, 'Contraseña').fill(credentials.password, ACTION)],
    ['pulsar «Entrar»', () => buttonNamed(page, 'Entrar').click(ACTION)],
    ['llegar a /programs', () => programsHeading(page).waitFor({ timeout: CEILING_MS })],
    [
      'ver la lista de programas',
      async () => {
        if (!(await settled(page))) throw new Error('la lista de programas no aparece');
      },
    ],
    ['armar el registro de avisos', () => armToasts(page)],
  ];
  return runSteps(steps);
};

/** Abre la pantalla de requisitos del programa y elige la vista «Matriz de trazabilidad». */
export const openMatrixMobile = (page: Page, program: string): Promise<string | undefined> =>
  runSteps([
    [`abrir /programs/${program}/requirements`, () => page.goto(`/programs/${program}/requirements`, { timeout: CEILING_MS })],
    ['ver el conmutador de vistas', async () => {
      if (!(await waitUntil(() => safe(() => viewRadio(page, 'Matriz de trazabilidad').isVisible(), false))).reached) throw new Error('el conmutador de vistas no aparece');
    }],
    ['elegir «Matriz de trazabilidad»', () => viewRadio(page, 'Matriz de trazabilidad').click(ACTION)],
  ]);

/** La matriz ya no carga: aparece la tabla, el estado vacío o el error (con plazo de techo). */
export const settledMatrixMobile = async (page: Page): Promise<boolean> =>
  (await waitUntil(async () => (await safe(() => matrixTable(page).isVisible(), false)) || (await safe(() => emptyOf(page).isVisible(), false)) || (await safe(() => errorOf(page).isVisible(), false)))).reached;

// --- Estado de cada cruce (lectura de atributos, con plazo corto) -----------------------------------------------------------

export interface MobileCell {
  /** `aria-checked` de la casilla: `true` / `false`, o `undefined` si no se lee. */
  readonly checked: boolean | undefined;
  /** Deshabilitada (`aria-disabled` o propiedad `disabled`). */
  readonly disabled: boolean | undefined;
  readonly result: string | undefined;
}

export const mobileCellState = async (box: Locator): Promise<MobileCell> => {
  const checkedText = await safe(async () => (await box.first().getAttribute('aria-checked', { timeout: READ_MS })) ?? undefined, undefined);
  const disabledText = await safe(async () => (await box.first().getAttribute('aria-disabled', { timeout: READ_MS })) ?? undefined, undefined);
  const result = await safe(async () => (await box.first().getAttribute('data-result', { timeout: READ_MS })) ?? undefined, undefined);
  return {
    checked: checkedText === undefined ? undefined : checkedText === 'true',
    disabled: disabledText === undefined ? undefined : disabledText === 'true',
    result,
  };
};

/** «marcado» o «sin marcar» en lenguaje de la historia. */
export const mobileWord = (checked: boolean | undefined): string | undefined => (checked === undefined ? undefined : checked ? 'marcado' : 'sin marcar');

/** Toque sobre la casilla con diagnóstico; `force` para tocar una casilla deshabilitada (el toque no debe tener efecto). */
export const tapCell = (box: Locator, label: string, force: boolean): Promise<string | undefined> =>
  runSteps([[label, () => box.first().click({ ...ACTION, force })]]);

/** Un «Entonces» con el texto de la app (exacto) frente a lo leído. */
export const exactText = (observed: string | undefined, expected: string, what: string): Check =>
  check(observed === expected, `${what} «${expected}»`, `${what} «${observed ?? '(sin leer)'}»`);

/** Resultado de una fila móvil a partir de comprobaciones y su nota de plataforma. */
export const outcomeOf = (checks: readonly Check[], note: string | undefined, evidence?: Readonly<Record<string, unknown>>): Outcome => {
  const failed = checks.filter((entry) => !entry.ok).map((entry) => `esperaba «${entry.expected}»; se observó «${entry.observed}»`);
  const parts = [note, ...failed].filter((part): part is string => part !== undefined && part !== '');
  return outcome(checks.every((entry) => entry.ok), checks.map((entry) => entry.expected).join('; '), checks.map((entry) => entry.observed).join('; '), {
    ...(parts.length === 0 ? {} : { note: parts.join(' · ') }),
    ...(evidence === undefined ? {} : { evidence }),
  });
};

/** Espera de una condición con techo; devuelve si se cumplió. */
export const within = (condition: () => Promise<boolean>, ceilingMs: number = CEILING_MS): Promise<boolean> => waitUntil(condition, ceilingMs).then((result) => result.reached);

