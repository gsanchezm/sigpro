import type { Locator, Page } from '@playwright/test';
import { DEMO, TENANT_A, type Credentials } from '../../../story-runs/support/prepare';
import { DETALLE_TESTIDS, MOVIL_PROGRAMS_TESTIDS, PROVEEDORES_TESTIDS } from '../../../../packages/shared/src/testids';
import { ACTION, CEILING_MS, safe, waitUntil } from '../../support/browser';
import type { BrowserRowHandler } from '../../core/framework';
import { runSteps, searchSnapshot, settledPanel, watchPanel, watchSearch, waitSearch, type PanelSelectors, type PanelSnapshot, type SearchSelectors, type SearchSnapshot, type StepFailure } from '../web/common';

// Piezas comunes de las filas de la app móvil de EP-PROVEEDORES. La app se ejecuta como web de Expo a 390 × 844: NO es iOS ni Android
// nativo. Los localizadores son de ROL (botones, campos de texto, opciones de grupo, enlaces de tarjeta, tarjetas) y, donde la pantalla
// no ofrece otro rastro (el contador, la carga, el aviso de error, el buscador y la ficha), el id de prueba de testids.ts. Las lecturas
// de una espera se hacen en una sola ejecución del DOM (las funciones genéricas de `web/common.ts`).

/** Salvedad de plataforma: el veredicto de una fila móvil vale para Expo web, no para iOS ni Android nativo. */
export const EXPO_NOTE = 'El veredicto vale para Expo web (390 × 844): no se ha comprobado en iOS ni en Android nativo.';

/** Aproximación declarada: abrir una dirección (carga completa de la página) no es un enlace profundo ni una navegación interna. */
export const DIRECT_APPROXIMATION =
  'Abrir una dirección de la app se aproxima con una carga completa de la página en Expo web, que recupera la sesión guardada; en iOS o Android sería un enlace profundo o una navegación interna.';

/** Salvedades de cada fila móvil: la plataforma (Expo web) y la aproximación con que se abre la ruta de la ficha. */
const MOBILE_NOTES = `${EXPO_NOTE} ${DIRECT_APPROXIMATION}`;

/** Añade a cada resultado de la fila las salvedades móviles. */
export const onExpoWeb =
  (handler: BrowserRowHandler): BrowserRowHandler =>
  async (row, fixtures) => {
    const result = await handler(row, fixtures);
    return { ...result, note: result.note === undefined ? MOBILE_NOTES : `${result.note} ${MOBILE_NOTES}` };
  };

export const TENANT_TEXT = 'Tenant de trabajo';
/** Nombre del grupo de opciones del detalle del programa (la pestaña «Proveedores» es una de sus opciones). */
export const DETAIL_TITLE = 'Detalle del programa';
/** Nombre de la lista de contratados (la lista del panel). */
export const CONTRACTED_LIST_NAME = 'Contratados en este programa';

// --- Localizadores de rol ----------------------------------------------------------------------------------------------------------

export const textbox = (page: Page, name: string): Locator => page.getByRole('textbox', { name, exact: true });
export const buttonNamed = (page: Page, name: string): Locator => page.getByRole('button', { name, exact: true });
export const heading1 = (page: Page, name: string): Locator => page.getByRole('heading', { name, level: 1, exact: true });
/** Opción «Proveedores» del grupo «Detalle del programa» (cada opción es un radio con su nombre). */
export const suppliersOption = (page: Page): Locator => page.getByRole('radiogroup', { name: DETAIL_TITLE, exact: true }).getByRole('radio', { name: 'Proveedores', exact: true });
/** Artículo de la ficha (solo existe con el programa cargado). */
export const articleOf = (page: Page): Locator => page.getByTestId(DETALLE_TESTIDS.PROGRAM_DETAIL);
/** Aviso «Programa no encontrado». */
export const notFoundOf = (page: Page): Locator => page.getByTestId(DETALLE_TESTIDS.PROGRAM_DETAIL_NOT_FOUND);
/** Sección «Proveedores» de la pestaña (el panel). */
export const panelOfMobile = (page: Page): Locator => page.getByTestId(PROVEEDORES_TESTIDS.SUPPLIERS_PANEL);
/** Campo «Proveedor del tenant» (campo de texto con su etiqueta). */
export const searchFieldOf = (page: Page): Locator => textbox(page, 'Proveedor del tenant');
/** Lista de opciones del buscador («Proveedores encontrados»). */
export const resultsOf = (page: Page): Locator => page.getByTestId(PROVEEDORES_TESTIDS.SUPPLIER_SEARCH_LIST);
/** Tarjeta de un proveedor contratado, por su nombre (rol «listitem» con el nombre como `aria-label`). */
export const cardOf = (page: Page, name: string): Locator => panelOfMobile(page).getByRole('listitem', { name, exact: true });
/** Lista de contratados del panel (solo existe cuando hay proveedores). */
export const contractedListOf = (page: Page): Locator => panelOfMobile(page).getByRole('list', { name: CONTRACTED_LIST_NAME, exact: true });

// --- Selectores para las lecturas de una sola ejecución ----------------------------------------------------------------------------

export const PANEL_MOVIL: PanelSelectors = {
  root: `[data-testid="${PROVEEDORES_TESTIDS.SUPPLIERS_PANEL}"]`,
  rows: `[role="list"][aria-label="${CONTRACTED_LIST_NAME}"] [role="listitem"]`,
  loading: `[data-testid="${MOVIL_PROGRAMS_TESTIDS.SUPPLIERS_LOADING}"]`,
  counter: `[data-testid="${PROVEEDORES_TESTIDS.SUPPLIERS_COUNT}"]`,
  error: `[data-testid="${PROVEEDORES_TESTIDS.SUPPLIERS_ERROR}"]`,
  empty: `[data-testid="${PROVEEDORES_TESTIDS.SUPPLIERS_EMPTY}"]`,
};

export const SEARCH_MOVIL: SearchSelectors = {
  input: `[data-testid="${PROVEEDORES_TESTIDS.SUPPLIER_SEARCH}"]`,
  list: `[data-testid="${PROVEEDORES_TESTIDS.SUPPLIER_SEARCH_LIST}"]`,
  option: '[role="option"]',
  status: `[data-testid="${PROVEEDORES_TESTIDS.SUPPLIER_SEARCH_STATUS}"]`,
  ficha: `[data-testid="${PROVEEDORES_TESTIDS.SUPPLIER_DETAIL}"]`,
};

/** Lectura del panel de la pestaña (una ejecución del DOM por instantánea). */
export const settledMobilePanel = (page: Page): Promise<PanelSnapshot> => settledPanel(page, PANEL_MOVIL);
export const watchMobilePanel = (page: Page): Promise<readonly PanelSnapshot[]> => watchPanel(page, PANEL_MOVIL);
/** Lectura del buscador de la pestaña. */
export const mobileSearch = (page: Page): Promise<SearchSnapshot> => searchSnapshot(page, SEARCH_MOVIL, performance.now());
export const waitMobileSearch = (page: Page, done: (snap: SearchSnapshot) => boolean): Promise<SearchSnapshot> => waitSearch(page, done, SEARCH_MOVIL);
export const watchMobileSearch = (page: Page, done: (snap: SearchSnapshot) => boolean): Promise<readonly SearchSnapshot[]> => watchSearch(page, done, SEARCH_MOVIL);

// --- Sesión y apertura -------------------------------------------------------------------------------------------------------------

/** Inicio de sesión en la app: alumno01 en «Tenant de trabajo», la cuenta de la fila y llegar a la lista de programas. */
export const signIn = (page: Page, credentials: Credentials = DEMO.gestor): Promise<StepFailure | undefined> =>
  runSteps([
    ['abrir /login', () => page.goto('/login', { timeout: CEILING_MS })],
    ['ver el título «Iniciar sesión»', () => heading1(page, 'Iniciar sesión').waitFor({ timeout: CEILING_MS })],
    [`escribir ${TENANT_A} en «${TENANT_TEXT}»`, () => textbox(page, TENANT_TEXT).fill(TENANT_A, ACTION)],
    ['escribir el correo', () => textbox(page, 'Correo electrónico').fill(credentials.email, ACTION)],
    ['escribir la contraseña', () => textbox(page, 'Contraseña').fill(credentials.password, ACTION)],
    ['pulsar «Entrar»', () => buttonNamed(page, 'Entrar').click(ACTION)],
    ['llegar a la lista de programas', () => heading1(page, 'Programas').waitFor({ timeout: CEILING_MS })],
  ]);

/** La ficha está montada: los datos, el aviso de no encontrado o el de error (el título solo no basta: también aparece mientras carga). */
export const detailSettled = async (page: Page): Promise<boolean> =>
  (
    await waitUntil(
      async () =>
        (await safe(() => articleOf(page).isVisible(), false)) ||
        (await safe(() => notFoundOf(page).isVisible(), false)) ||
        (await safe(() => page.getByTestId(MOVIL_PROGRAMS_TESTIDS.PROGRAM_DETAIL_ERROR).isVisible(), false)),
    )
  ).reached;

/** Abre una dirección de la app (carga completa, que recupera la sesión guardada) y espera a que la ficha se muestre. */
export const openDetail = (page: Page, path: string): Promise<StepFailure | undefined> =>
  runSteps([
    [`abrir ${path}`, () => page.goto(path, { timeout: CEILING_MS })],
    [
      'ver la ficha del programa',
      async () => {
        if (!(await detailSettled(page))) throw new Error('la ficha no aparece');
      },
    ],
  ]);

/** Elige la pestaña «Proveedores» del detalle. */
export const chooseSuppliers = (page: Page): Promise<StepFailure | undefined> => runSteps([['elegir la opción «Proveedores»', () => suppliersOption(page).click(ACTION)]]);

