import type { Locator, Page } from '@playwright/test';
import { DEMO, TENANT_A, type Credentials } from '../../../story-runs/support/prepare';
import { DETALLE_TESTIDS, HITOS_DYNAMIC_TESTIDS, HITOS_TESTIDS, MOVIL_PROGRAMS_DYNAMIC_TESTIDS, MOVIL_PROGRAMS_TESTIDS } from '../../../../packages/shared/src/testids';
import { ACTION, CEILING_MS, waitUntil } from '../../support/browser';
import { check, type Check } from '../../support/checks';
import type { BrowserRowHandler } from '../../core/framework';
import { attrOne, deleteAllMilestones, delayMilestones, failMilestoneWrite, failingMilestones, gestorToken, hasToast, literal, noToastFor, runSteps, seen, textOne, toastsOf, waitToast, type StepFailure } from '../web/common';

// Piezas comunes de las filas de la app móvil de EP-HITOS, servida como web (Expo web a 390 px). El veredicto vale para Expo web: no se ha
// comprobado en iOS ni en Android nativo. Los localizadores son de rol y de nombre donde la app los da (botones, deslizadores, tarjetas,
// menús, hojas) y, si no, de testids de `testids.ts` como respaldo.

export { TENANT_A, literal, toastsOf, hasToast, waitToast, noToastFor, failMilestoneWrite, delayMilestones, failingMilestones, deleteAllMilestones, gestorToken };

export const EXPO_NOTE = 'El veredicto vale para Expo web (390 × 844): no se ha comprobado en iOS ni en Android nativo.';
/** Aproximación declarada: abrir una dirección (carga completa) no es un enlace profundo ni una navegación interna. */
export const DIRECT_APPROXIMATION = 'Abrir una dirección de la app se aproxima con una carga completa de la página en Expo web, que recupera la sesión guardada; en iOS o Android sería un enlace profundo o una navegación interna.';
export const TENANT_TEXT = 'Tenant de trabajo';
export const MINUS = '−';

/** Añade a cada resultado la salvedad de plataforma. */
export const onExpoWeb =
  (handler: BrowserRowHandler): BrowserRowHandler =>
  async (row, fixtures) => {
    const result = await handler(row, fixtures);
    return { ...result, note: result.note === undefined ? EXPO_NOTE : `${result.note} ${EXPO_NOTE}` };
  };

export const textbox = (page: Page, name: string): Locator => page.getByRole('textbox', { name, exact: true });
export const buttonNamed = (page: Page, name: string): Locator => page.getByRole('button', { name, exact: true });

// --- Sesión y apertura ---------------------------------------------------------------------------------------------------------

/** Inicio de sesión en la app: alumno01 en «Tenant de trabajo», la cuenta de la fila y llegar a la lista de programas. */
export const signIn = (page: Page, credentials: Credentials = DEMO.gestor): Promise<StepFailure | undefined> =>
  runSteps([
    ['abrir /login', () => page.goto('/login', { timeout: CEILING_MS })],
    ['ver el título «Iniciar sesión»', () => page.getByRole('heading', { name: 'Iniciar sesión', level: 1, exact: true }).waitFor({ timeout: CEILING_MS })],
    [`escribir ${TENANT_A} en «${TENANT_TEXT}»`, () => textbox(page, TENANT_TEXT).fill(TENANT_A, ACTION)],
    ['escribir el correo', () => textbox(page, 'Correo electrónico').fill(credentials.email, ACTION)],
    ['escribir la contraseña', () => textbox(page, 'Contraseña').fill(credentials.password, ACTION)],
    ['pulsar «Entrar»', () => buttonNamed(page, 'Entrar').click(ACTION)],
    ['llegar a la lista de programas', () => page.getByRole('heading', { name: 'Programas', level: 1, exact: true }).waitFor({ timeout: CEILING_MS })],
  ]);

/** Abre la ficha (carga completa, con la sesión guardada) y elige la opción «Hitos» del grupo «Detalle del programa». */
export const openHitos = (page: Page, code: string): Promise<StepFailure | undefined> =>
  runSteps([
    [`abrir /programs/${code}`, () => page.goto(`/programs/${code}`, { timeout: CEILING_MS })],
    [
      'ver la ficha del programa',
      async () => {
        if (!(await waitUntil(async () => (await seen(page.getByTestId(DETALLE_TESTIDS.PROGRAM_DETAIL))) === true)).reached) throw new Error('la ficha no aparece');
      },
    ],
    ['elegir «Hitos»', () => page.getByRole('radio', { name: 'Hitos', exact: true }).click(ACTION)],
    [
      'ver el panel de hitos',
      async () => {
        if (!(await waitUntil(async () => (await seen(page.getByTestId(HITOS_TESTIDS.MILESTONES_PANEL))) === true)).reached) throw new Error('el panel de hitos no aparece');
      },
    ],
  ]);

/** Preparación de cada fila: sesión y ficha con la pestaña «Hitos». */
export const enterAndOpen = async (page: Page, credentials: Credentials, code: string): Promise<StepFailure | undefined> => (await signIn(page, credentials)) ?? (await openHitos(page, code));

/** Espera a que la lista esté cargada: tarjetas, aviso de vacío o aviso de error. */
export const settledCards = async (page: Page): Promise<boolean> =>
  (
    await waitUntil(async () => {
      const cards = await page.locator('[data-testid^="milestone-row-"]').count();
      return cards > 0 || (await seen(page.getByTestId(HITOS_TESTIDS.MILESTONES_EMPTY))) === true || (await seen(page.getByTestId(HITOS_TESTIDS.MILESTONES_ERROR))) === true;
    })
  ).reached;

/** Número de tarjetas de hito visibles. */
export const cardCount = (page: Page): Promise<number> => page.locator('[data-testid^="milestone-row-"]').count();

// --- Localizadores de la pestaña ---------------------------------------------------------------------------------------------

/** Tarjeta de un hito (su nombre accesible es el nombre del hito). */
export const cardOf = (page: Page, name: string): Locator => page.getByRole('listitem', { name, exact: true });
export const sliderOf = (page: Page, name: string): Locator => page.getByRole('slider', { name: `Avance de ${name}`, exact: true });
export const decOf = (page: Page, name: string): Locator => page.getByRole('button', { name: `Avance de ${name} ${MINUS}5`, exact: true });
export const incOf = (page: Page, name: string): Locator => page.getByRole('button', { name: `Avance de ${name} +5`, exact: true });
export const menuOf = (page: Page, name: string): Locator => page.getByRole('button', { name: `Acciones para el hito ${name}`, exact: true });
export const renameItem = (page: Page): Locator => page.getByRole('button', { name: 'Renombrar', exact: true }).or(page.getByTestId(HITOS_TESTIDS.MILESTONE_MENU_RENAME));
export const deleteItem = (page: Page): Locator => page.getByRole('button', { name: 'Eliminar', exact: true }).or(page.getByTestId(HITOS_TESTIDS.MILESTONE_MENU_DELETE));
export const newButton = (page: Page): Locator => buttonNamed(page, 'Nuevo hito');
export const countLine = (page: Page): Locator => page.getByTestId(HITOS_TESTIDS.MILESTONES_COUNT);
export const emptyLine = (page: Page): Locator => page.getByTestId(HITOS_TESTIDS.MILESTONES_EMPTY);
export const errorBlock = (page: Page): Locator => page.getByTestId(HITOS_TESTIDS.MILESTONES_ERROR);
export const loadingBlock = (page: Page): Locator => page.getByTestId(MOVIL_PROGRAMS_TESTIDS.MILESTONES_LOADING);
export const progressHeader = (page: Page): Locator => page.getByTestId(DETALLE_TESTIDS.PROGRAM_DETAIL_PROGRESS);
/** Insignia de estado de una tarjeta («Cumplido», «En curso», «Pendiente»). */
export const statusInCard = (page: Page, name: string): Promise<string | undefined> => textOne(cardOf(page, name).getByTestId(/^milestone-status-/));
/** Texto de la razón visible bajo un control (permiso), por su testid de acción. */
export const reasonOf = (page: Page, testId: string): Promise<string | undefined> => textOne(page.getByTestId(testId));
export const ACTION_REASON = (kind: 'milestone-rename' | 'milestone-delete'): string => MOVIL_PROGRAMS_DYNAMIC_TESTIDS.ACTION_REASON(kind);
export const PROGRESS_REASON = (id: string): string => MOVIL_PROGRAMS_DYNAMIC_TESTIDS.MILESTONE_PROGRESS_REASON(id);
export const NEW_REASON = MOVIL_PROGRAMS_TESTIDS.MILESTONES_NEW_REASON;
export const CARD_TESTID = (id: string): string => HITOS_DYNAMIC_TESTIDS.MILESTONE_ROW(id);

/** Lectura estricta de un atributo de un único elemento, sin lanzar (re-exportada para las filas). */
export { attrOne };

/** Comprobación de un texto visible igual al esperado (la historia lo da entre «…» o sin comillas). */
export const visibleText = async (target: Locator, expected: string, what: string): Promise<Check> => {
  const want = literal(expected);
  const text = await textOne(target);
  return check(text === want, `${what} ${want}`, `${what} ${text ?? '(sin leer)'}`);
};

/** Una lectura de la pestaña en un solo paso mientras carga: indicador, tarjetas y recuento. */
export const loadingMoment = (page: Page) =>
  page.evaluate(
    ({ loading, prefix }) => ({
      indicator: document.querySelector(`[data-testid="${loading}"]`) !== null,
      cards: document.querySelectorAll(`[data-testid^="${prefix}"]`).length,
    }),
    { loading: MOVIL_PROGRAMS_TESTIDS.MILESTONES_LOADING, prefix: 'milestone-row-' },
  );

export { CEILING_MS };
