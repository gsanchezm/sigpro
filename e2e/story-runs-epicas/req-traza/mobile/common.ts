import type { Locator, Page } from '@playwright/test';
import { DEMO, TENANT_A } from '../../../story-runs/support/prepare';
import { MOVIL_PROGRAMS_TESTIDS, MOVIL_REQUIREMENTS_TESTIDS, REQUISITOS_TESTIDS } from '../../../../packages/shared/src/testids';
import { ACTION, CEILING_MS, runSteps, safe, waitUntil, type Step } from '../../support/browser';
import { check, type Check } from '../../support/checks';
import { outcome, type BrowserRowHandler, type Outcome } from '../../core/framework';
import { AUDITOR, CONSULTOR, GESTOR, type Account } from '../api/common';
import { READ_MS, TOAST_KEY, armToasts, recordToasts, textOf } from '../web/common';

// Piezas comunes de las filas de la app móvil de EP-REQ-TRAZA, servida como web de Expo (390 × 844). NO es iOS ni Android nativo: el
// veredicto vale para Expo web. Los localizadores son de rol y de nombre; los ids de prueba solo donde la app no ofrece otro rastro.
// La matriz y sus avisos son los de la web (`web/common.ts`); aquí solo lo que cambia en la app: el inicio de sesión, el conmutador de
// vistas (un grupo de opciones, no pestañas), el texto de la pista y el motivo visible del auditor.

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

/** Cuenta de la celda de la historia → credenciales de la pantalla móvil (las mismas que la web) y cuenta de la API. */
export const MOBILE_ACCOUNTS: ReadonlyMap<string, { readonly credentials: { readonly email: string; readonly password: string }; readonly api: Account }> = new Map<
  string,
  { readonly credentials: { readonly email: string; readonly password: string }; readonly api: Account }
>([
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
export const hintOf = (page: Page): Locator => matrixPanel(page).getByTestId(MOVIL_REQUIREMENTS_TESTIDS.MATRIX_HINT);
export const reasonOf = (page: Page): Locator => matrixPanel(page).getByTestId(MOVIL_REQUIREMENTS_TESTIDS.MATRIX_REASON);
export const emptyOf = (page: Page): Locator => matrixPanel(page).getByTestId(REQUISITOS_TESTIDS.MATRIX_EMPTY);
export const errorOf = (page: Page): Locator => matrixPanel(page).getByTestId(MOVIL_REQUIREMENTS_TESTIDS.MATRIX_ERROR);
/** Casilla de un cruce: su nombre accesible empieza por «REQ ↔ CASO,» y cambia con el resultado; se localiza por ese prefijo. */
export const cellOf = (page: Page, requirement: string, testCase: string): Locator =>
  matrixPanel(page).getByRole('checkbox', { name: new RegExp(`^${requirement} ↔ ${testCase},`) });
export const retryOf = (page: Page): Locator => errorOf(page).getByRole('button', { name: 'Reintentar', exact: true });

// --- Sesión y navegación ----------------------------------------------------------------------------------------------------------

const settled = async (page: Page): Promise<boolean> =>
  (
    await waitUntil(
      async () =>
        (await safe(() => programsHeading(page).isVisible(), false)) && !(await safe(() => page.getByTestId(MOVIL_PROGRAMS_TESTIDS.PROGRAMS_LOADING).isVisible(), false)),
    )
  ).reached;

/**
 * Preparación de cada fila: la app en /login sin sesión guardada, con «alumno01» en «Tenant de trabajo», la cuenta con su contraseña y
 * «Entrar». Termina cuando /programs está asentada y el registro de avisos armado.
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

/** Abre la pantalla de requisitos del programa (dirección directa, con la sesión ya iniciada) y elige la vista «Matriz de trazabilidad». */
export const openMatrixMobile = (page: Page, program: string): Promise<string | undefined> =>
  runSteps([
    [`abrir /programs/${program}/requirements`, () => page.goto(`/programs/${program}/requirements`, { timeout: CEILING_MS })],
    [
      'ver el conmutador de vistas',
      async () => {
        if (!(await waitUntil(() => safe(() => viewRadio(page, 'Matriz de trazabilidad').isVisible(), false))).reached) throw new Error('el conmutador de vistas no aparece');
      },
    ],
    ['elegir «Matriz de trazabilidad»', () => viewRadio(page, 'Matriz de trazabilidad').click(ACTION)],
  ]);

/** La matriz ya no carga: aparece la tabla, el estado vacío o el error (con plazo de techo). */
export const settledMatrixMobile = async (page: Page): Promise<boolean> =>
  (
    await waitUntil(
      async () =>
        (await safe(() => matrixTable(page).isVisible(), false)) ||
        (await safe(() => emptyOf(page).isVisible(), false)) ||
        (await safe(() => errorOf(page).isVisible(), false)),
    )
  ).reached;

/** Texto visible de un elemento: solo si se ve de verdad (un nodo no renderizado no tiene texto visible). Plazo corto. */
export const visibleTextOf = async (target: Locator): Promise<string | undefined> => ((await safe(() => target.first().isVisible(), false)) ? textOf(target) : undefined);

// --- Estado de cada cruce (lectura de atributos, con plazo corto) -----------------------------------------------------------

export interface MobileCell {
  /** `aria-checked` de la casilla: `true` / `false`, o `undefined` si no se lee. */
  readonly checked: boolean | undefined;
  /** Deshabilitada (`aria-disabled`). */
  readonly disabled: boolean | undefined;
}

export const mobileCellState = async (box: Locator): Promise<MobileCell> => {
  const checkedText = await safe(async () => (await box.first().getAttribute('aria-checked', { timeout: READ_MS })) ?? undefined, undefined);
  const disabledText = await safe(async () => (await box.first().getAttribute('aria-disabled', { timeout: READ_MS })) ?? undefined, undefined);
  return {
    checked: checkedText === undefined ? undefined : checkedText === 'true',
    disabled: disabledText === undefined ? undefined : disabledText === 'true',
  };
};

/** «marcado» o «sin marcar» en lenguaje de la historia. */
export const mobileWord = (checked: boolean | undefined): string | undefined => (checked === undefined ? undefined : checked ? 'marcado' : 'sin marcar');

/** Toque sobre la casilla, con su diagnóstico si falla. `force` para tocar una casilla deshabilitada (el toque no debe tener efecto). */
export const tapCell = (box: Locator, label: string, force: boolean): Promise<string | undefined> =>
  runSteps([[label, () => box.first().click({ ...ACTION, force })]]);

/** Una comprobación con texto exacto frente a lo leído (lo no leído no cuenta como cumplido). */
export const exactText = (observed: string | undefined, expected: string, what: string): Check =>
  check(observed === expected, `${what} «${expected}»`, `${what} «${observed ?? '(sin leer)'}»`);

/** Resultado de una fila móvil a partir de sus comprobaciones, con la nota de la fila (si la hay) y la evidencia. */
export const outcomeOf = (checks: readonly Check[], note: string | undefined, evidence?: Readonly<Record<string, unknown>>): Outcome => {
  const failed = checks.filter((entry) => !entry.ok).map((entry) => `esperaba «${entry.expected}»; se observó «${entry.observed}»`);
  const parts = [note, ...failed].filter((part): part is string => part !== undefined && part !== '');
  return outcome(checks.every((entry) => entry.ok), checks.map((entry) => entry.expected).join('; '), checks.map((entry) => entry.observed).join('; '), {
    ...(parts.length === 0 ? {} : { note: parts.join(' · ') }),
    ...(evidence === undefined ? {} : { evidence }),
  });
};
