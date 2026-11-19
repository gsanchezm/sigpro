import type { Locator, Page } from '@playwright/test';
import { ACTION, CEILING_MS, runSteps, safe, waitUntil } from '../../support/browser';
import { DEMO, TENANT_A } from '../../../story-runs/support/prepare';
import { MOVIL_VERIFICATION_TESTIDS, PROGRAMAS_DYNAMIC_TESTIDS, VERIFICACION_DYNAMIC_TESTIDS, VERIFICACION_TESTIDS } from '../../../../packages/shared/src/testids';
import type { BrowserRowHandler } from '../../core/framework';
import { oneText, pageOf, leavesOf, type SortKey } from '../web/common';

export { concluded } from '../api/common';

// Piezas comunes de las filas de la app móvil de EP-VER-CASOS. La app se ejecuta como web de Expo a 390 × 844: NO es iOS ni Android
// nativo. Los localizadores son de rol y nombre donde la app los da; los ids de prueba solo donde no hay otro rastro (el recuento,
// los bloques de estado, las tarjetas, las opciones de los selectores). Las acciones pasan por `runSteps`.

export { codesOf, codesBetween, describeCodes, sameCodes, oneText, leavesOf, errorLeaves, failGet, failGetWhile, delayGet, waitForList, codesShown, pageOf, SETTLE_MS, onWeb } from '../web/common';
export type { FailSwitch } from '../web/common';
export type { SortKey } from '../web/common';

/** Salvedad de plataforma: el veredicto de una fila móvil vale para Expo web, no para iOS ni Android nativo. */
export const EXPO_NOTE = 'El veredicto vale para Expo web (390 × 844): no se ha comprobado en iOS ni en Android nativo.';

/** Envuelve una fila móvil para añadir la salvedad de plataforma a su nota. */
export const onExpoWeb =
  (handler: BrowserRowHandler): BrowserRowHandler =>
  async (row, fixtures) => {
    const result = await handler(row, fixtures);
    return { ...result, note: result.note === undefined ? EXPO_NOTE : `${result.note} ${EXPO_NOTE}` };
  };

export const LOGIN_PATH = '/login';
export const PROGRAMS_PATH = '/programs';
export const VERIFICATION_PATH = '/verification';
export const TENANT_TEXT = 'Tenant de trabajo';

// --- Localizadores ----------------------------------------------------------------------------------------------------------

export const textbox = (page: Page, name: string): Locator => page.getByRole('textbox', { name, exact: true });
export const buttonNamed = (page: Page, name: string): Locator => page.getByRole('button', { name, exact: true });
export const heading1 = (page: Page, name: string): Locator => page.getByRole('heading', { name, level: 1, exact: true });
/** Buscador de la lista («Buscar casos de prueba», con el texto de ayuda «Buscar código o título…»). */
export const searchBox = (page: Page): Locator => textbox(page, 'Buscar casos de prueba');
/** Selector de «Programa» o de «Último resultado» (botón combobox con su testid; sus opciones van en una hoja). */
export const selectOf = (page: Page, testid: string): Locator => page.getByTestId(testid);
/** Chip de orden (rol radio, nombre = texto con la flecha). */
export const chipOf = (page: Page, key: SortKey): Locator => page.getByTestId(VERIFICACION_DYNAMIC_TESTIDS.TESTCASE_SORT(key));
/** Etiqueta visible de un chip de orden (con su flecha, p. ej. «Código ↓»); `undefined` si no se puede leer. */
export const chipLabelOf = (page: Page, key: SortKey): Promise<string | undefined> =>
  safe(async () => (await chipOf(page, key).getAttribute('aria-label', { timeout: 2000 })) ?? undefined, undefined);
export const loadMoreOf = (page: Page): Locator => page.getByTestId(MOVIL_VERIFICATION_TESTIDS.LOAD_MORE);
export const loadingOf = (page: Page): Locator => page.getByTestId(MOVIL_VERIFICATION_TESTIDS.LOADING);
export const listErrorOf = (page: Page): Locator => page.getByTestId(VERIFICACION_TESTIDS.VERIFICATION_ERROR);
export const listRetryOf = (page: Page): Locator => page.getByTestId(VERIFICACION_TESTIDS.VERIFICATION_ERROR_RETRY);
export const emptyOf = (page: Page): Locator => page.getByTestId(VERIFICACION_TESTIDS.VERIFICATION_EMPTY);
export const emptyClearOf = (page: Page): Locator => page.getByTestId(VERIFICACION_TESTIDS.VERIFICATION_EMPTY_CLEAR);
export const filtersClearOf = (page: Page): Locator => page.getByTestId(VERIFICACION_TESTIDS.VERIFICATION_FILTERS_CLEAR);
export const linkOf = (page: Page, code: string): Locator => page.getByTestId(VERIFICACION_DYNAMIC_TESTIDS.TESTCASE_LINK(code));
export const cardOf = (page: Page, code: string): Locator => page.getByTestId(VERIFICACION_DYNAMIC_TESTIDS.TESTCASE_ROW(code));
export const detailPageOf = (page: Page): Locator => page.getByTestId(MOVIL_VERIFICATION_TESTIDS.DETAIL_PAGE);
export const detailOf = (page: Page): Locator => page.getByTestId(VERIFICACION_TESTIDS.TESTCASE_DETAIL);
export const detailNotFoundOf = (page: Page): Locator => page.getByTestId(VERIFICACION_TESTIDS.TESTCASE_NOT_FOUND);
export const detailLoadingOf = (page: Page): Locator => page.getByTestId(MOVIL_VERIFICATION_TESTIDS.DETAIL_LOADING);
export const detailErrorOf = (page: Page): Locator => page.getByTestId(MOVIL_VERIFICATION_TESTIDS.DETAIL_ERROR);
export const detailRetryOf = (page: Page): Locator => page.getByTestId(MOVIL_VERIFICATION_TESTIDS.DETAIL_ERROR_RETRY);
export const backOf = (page: Page): Locator => page.getByTestId(VERIFICACION_TESTIDS.TESTCASE_BACK);
export const runsOf = (page: Page): Locator => page.getByTestId(VERIFICACION_TESTIDS.TESTCASE_RUNS);
export const requirementsOf = (page: Page): Locator => page.getByTestId(VERIFICACION_TESTIDS.TESTCASE_REQUIREMENTS);
export const stepsOf = (page: Page): Locator => page.getByTestId(VERIFICACION_TESTIDS.TESTCASE_STEPS);
export const expectedOf = (page: Page): Locator => page.getByTestId(VERIFICACION_TESTIDS.TESTCASE_EXPECTED);

/** Opción de un selector: `<testid>-option-<valor>` (la hoja de opciones es un radio con su nombre). */
export const optionOf = (page: Page, testid: string, value: string): Locator => page.getByTestId(`${testid}-option-${value}`);

// --- Lecturas --------------------------------------------------------------------------------------------------------------

export interface MobileSnapshot {
  readonly loading: number;
  readonly cards: number;
  readonly errors: number;
  readonly empty: number;
}

/** Estado de la lista móvil en una sola evaluación: indicador de carga, tarjetas, aviso de error y bloque vacío. */
export const mobileSnapshot = (page: Page): Promise<MobileSnapshot | undefined> =>
  safe(
    () =>
      pageOf(page).evaluate(
        (root: Element) => ({
          loading: root.querySelectorAll('[data-testid="verification-loading"]').length,
          cards: Array.from(root.querySelectorAll('[data-testid]')).filter((node) => /^testcase-row-TC-\d{3}$/.test(node.getAttribute('data-testid') ?? '')).length,
          errors: root.querySelectorAll('[data-testid="verification-error"]').length,
          empty: root.querySelectorAll('[data-testid="verification-empty"]').length,
        }),
        undefined,
        { timeout: 2000 },
      ),
    undefined,
  );

/** Espera (con techo) a que la lista móvil muestre tarjetas, aviso de error o bloque vacío, y no cargue. */
export const mobileSettled = async (page: Page, ceilingMs: number = CEILING_MS): Promise<boolean> =>
  (
    await waitUntil(async () => {
      const snapshot = await mobileSnapshot(page);
      return snapshot !== undefined && snapshot.loading === 0 && (snapshot.cards > 0 || snapshot.errors > 0 || snapshot.empty > 0);
    }, ceilingMs)
  ).reached;

/** Inicio de sesión en la app: alumno01 en «Tenant de trabajo», gestor@sigpro.test y llegar a /programs. */
export const signIn = (page: Page): Promise<string | undefined> =>
  runSteps([
    ['abrir /login', () => page.goto(LOGIN_PATH, { timeout: CEILING_MS })],
    ['ver el título «Iniciar sesión»', () => heading1(page, 'Iniciar sesión').waitFor({ timeout: CEILING_MS })],
    [`escribir ${TENANT_A} en «${TENANT_TEXT}»`, () => textbox(page, TENANT_TEXT).fill(TENANT_A, ACTION)],
    ['escribir el correo', () => textbox(page, 'Correo electrónico').fill(DEMO.gestor.email, ACTION)],
    ['escribir la contraseña', () => textbox(page, 'Contraseña').fill(DEMO.gestor.password, ACTION)],
    ['pulsar «Entrar»', () => buttonNamed(page, 'Entrar').click(ACTION)],
    ['llegar a /programs', () => heading1(page, 'Programas').waitFor({ timeout: CEILING_MS })],
  ]);

/** Abre /verification desde la pestaña «Verificación» (sección de la app) y espera a que la lista se asiente. */
export const openFromTab = (page: Page): Promise<string | undefined> =>
  runSteps([
    ['pulsar la pestaña «Verificación»', () => page.getByRole('tab', { name: 'Verificación', exact: true }).or(page.getByTestId(PROGRAMAS_DYNAMIC_TESTIDS.MOBILE_TAB('verification'))).first().click(ACTION)],
    ['llegar a /verification', () => page.waitForURL(/\/verification/, { timeout: CEILING_MS })],
    ['ver la lista de casos', async () => {
      if (!(await mobileSettled(page))) throw new Error('la lista de casos no se asienta');
    }],
  ]);

/** Salvedad de las filas que abren una dirección: en Expo web es una carga completa, no un enlace profundo ni una navegación interna. */
export const DIRECT_APPROXIMATION =
  'Abrir una dirección de la app se aproxima con una carga completa de la página en Expo web, que recupera la sesión guardada; en iOS o Android sería un enlace profundo o una navegación interna.';

/** Abre una dirección de la app con una carga completa. No espera a la lista: cada fila espera su propio ancla (detalle, aviso, lista). */
export const openDirect = (page: Page, path: string): Promise<string | undefined> => runSteps([[`abrir ${path}`, () => page.goto(path, { timeout: CEILING_MS })]]);

/** Texto del badge de resultado de una tarjeta (una sola lectura por testid dentro de la tarjeta; `undefined` si no es único). */
export const badgeOf = (page: Page, code: string): Promise<string | undefined> =>
  safe(async () => {
    const badge = cardOf(page, code).getByTestId(VERIFICACION_TESTIDS.TESTCASE_RESULT_BADGE);
    if ((await badge.count()) !== 1) return undefined;
    return (await badge.evaluate((element: Element) => (element.textContent ?? '').trim(), undefined, { timeout: 2000 })) || undefined;
  }, undefined);

/** Hojas de texto de la tarjeta de un caso (o `undefined` si no se pudo leer). */
export const cardLeaves = (page: Page, code: string): Promise<readonly string[] | undefined> => leavesOf(cardOf(page, code));

/** Ruta y query de la página actual. */
export const addressOf = (url: string): string => {
  try {
    const parsed = new URL(url);
    return `${parsed.pathname}${parsed.search}`;
  } catch {
    return url;
  }
};

/** Los primeros códigos que se ven empiezan por `prefix`. */
export const startsWithCodes = (codes: readonly string[] | undefined, prefix: readonly string[]): boolean =>
  codes !== undefined && codes.length >= prefix.length && prefix.every((code, index) => codes[index] === code);

/** Recuento de la lista móvil (o `undefined`). */
export const countText = (page: Page): Promise<string | undefined> => oneText(page.getByTestId(VERIFICACION_TESTIDS.VERIFICATION_COUNT));
