import type { Locator, Page } from '@playwright/test';
import { DEMO, TENANT_A, type Credentials } from '../../../story-runs/support/prepare';
import { DETALLE_DYNAMIC_TESTIDS, DETALLE_TESTIDS, EDITAR_PROGRAMA_TESTIDS, HITOS_TESTIDS, MOVIL_PROGRAMS_DYNAMIC_TESTIDS, MOVIL_PROGRAMS_TESTIDS, PROVEEDORES_TESTIDS } from '../../../../packages/shared/src/testids';
import { ACTION, CEILING_MS, waitUntil } from '../../support/browser';
import { check, type Check } from '../../support/checks';
import type { BrowserRowHandler } from '../../core/framework';
import { attrOne, runSteps, seen, type StepFailure } from '../web/common';

// Piezas comunes de las filas de la app móvil de EP-PROG-DETALLE. La app se ejecuta como web de Expo a 390 × 844: NO es iOS ni Android nativo.
// Los localizadores son de ROL (botones, encabezados, opciones de grupo, enlaces de tarjeta) y, donde la pantalla no ofrece otro rastro (la
// carga, el aviso de error, los datos de la cabecera), el id de prueba de testids.ts. Las lecturas son estrictas (ver `web/common.ts`), y los
// pasos que fallan se registran con su call log. Las demoras y los fallos de la petición son los mismos que en la web (`web/common.ts`).

/** Salvedad de plataforma: el veredicto de una fila móvil vale para Expo web, no para iOS ni Android nativo. */
export const EXPO_NOTE = 'El veredicto vale para Expo web (390 × 844): no se ha comprobado en iOS ni en Android nativo.';

/** Aproximación declarada: abrir una dirección (carga completa de la página) no es un enlace profundo ni una navegación interna. */
export const DIRECT_APPROXIMATION =
  'Abrir una dirección de la app se aproxima con una carga completa de la página en Expo web, que recupera la sesión guardada; en iOS o Android sería un enlace profundo o una navegación interna.';

/** Añade a cada resultado de la fila la salvedad de plataforma. */
export const onExpoWeb =
  (handler: BrowserRowHandler): BrowserRowHandler =>
  async (row, fixtures) => {
    const result = await handler(row, fixtures);
    return { ...result, note: result.note === undefined ? EXPO_NOTE : `${result.note} ${EXPO_NOTE}` };
  };

export const TENANT_TEXT = 'Tenant de trabajo';
/** Título de la ficha mientras carga, y nombre del grupo de opciones. */
export const DETAIL_TITLE = 'Detalle del programa';

// --- Localizadores de rol --------------------------------------------------------------------------------------------------------------

export const textbox = (page: Page, name: string): Locator => page.getByRole('textbox', { name, exact: true });
export const buttonNamed = (page: Page, name: string): Locator => page.getByRole('button', { name, exact: true });
export const heading1 = (page: Page, name: string): Locator => page.getByRole('heading', { name, level: 1, exact: true });
/** Encabezado de nivel 1 de la pantalla de la ficha: el nombre del programa, o «Detalle del programa» mientras carga o si no existe. */
export const screenTitle = (page: Page): Locator => page.getByRole('heading', { level: 1 });

/** Cabecera de la ficha: el artículo con sus datos (solo existe cuando el programa se ha cargado). */
export const articleOf = (page: Page): Locator => page.getByTestId(DETALLE_TESTIDS.PROGRAM_DETAIL);
/** Aviso «Programa no encontrado» (la vista con `role="alert"` del 404). */
export const notFoundOf = (page: Page): Locator => page.getByTestId(DETALLE_TESTIDS.PROGRAM_DETAIL_NOT_FOUND);
/** «Cargando…» de la ficha (rol status con aria-busy). */
export const loadingOf = (page: Page): Locator => page.getByTestId(MOVIL_PROGRAMS_TESTIDS.PROGRAM_DETAIL_LOADING);
/** Aviso de error de la ficha («No se pudo cargar el programa» con «Reintentar»). */
export const errorOf = (page: Page): Locator => page.getByTestId(MOVIL_PROGRAMS_TESTIDS.PROGRAM_DETAIL_ERROR);
export const retryButton = (page: Page): Locator => buttonNamed(page, 'Reintentar');
export const stateBadgeOf = (page: Page): Locator => page.getByTestId(DETALLE_TESTIDS.PROGRAM_DETAIL_STATE_BADGE);
/** Barra «Progreso» de la cabecera (role progressbar con aria-valuenow). */
export const progressBarOf = (page: Page): Locator => page.getByTestId(DETALLE_TESTIDS.PROGRAM_DETAIL_PROGRESS);
export const ownerOf = (page: Page): Locator => page.getByTestId(MOVIL_PROGRAMS_TESTIDS.PROGRAM_DETAIL_OWNER);
export const datesOf = (page: Page): Locator => page.getByTestId(MOVIL_PROGRAMS_TESTIDS.PROGRAM_DETAIL_DATES);
export const budgetOf = (page: Page): Locator => page.getByTestId(MOVIL_PROGRAMS_TESTIDS.PROGRAM_DETAIL_BUDGET);
export const descriptionOf = (page: Page): Locator => page.getByTestId(MOVIL_PROGRAMS_TESTIDS.PROGRAM_DETAIL_DESCRIPTION);
/** Botón «Editar programa»: rol button; deshabilitado con su motivo si el rol no puede. */
export const editButton = (page: Page): Locator => buttonNamed(page, 'Editar programa').or(page.getByTestId(EDITAR_PROGRAMA_TESTIDS.PROGRAM_DETAIL_EDIT));
/** Motivo que se lee debajo del botón «Editar programa» cuando está deshabilitado. */
export const editReasonOf = (page: Page): Locator => page.getByTestId(MOVIL_PROGRAMS_DYNAMIC_TESTIDS.ACTION_REASON('edit'));
/** Grupo de opciones «Detalle del programa» (cada opción es un radio con su nombre). */
export const optionGroup = (page: Page): Locator => page.getByRole('radiogroup', { name: DETAIL_TITLE, exact: true });
export const optionOf = (page: Page, label: string): Locator => page.getByRole('radio', { name: label, exact: true });
/** Panel de «Resumen» e «Hitos» (ids de la ficha compartidos con la web). */
export const summaryPanel = (page: Page): Locator => page.getByTestId(DETALLE_DYNAMIC_TESTIDS.PROGRAM_DETAIL_PANEL('summary'));
export const milestonesOptionPanel = (page: Page): Locator => page.getByTestId(DETALLE_DYNAMIC_TESTIDS.PROGRAM_DETAIL_PANEL('milestones'));
export const suppliersOptionPanel = (page: Page): Locator => page.getByTestId(MOVIL_PROGRAMS_TESTIDS.PROGRAM_DETAIL_PANEL_SUPPLIERS);
/** Panel de hitos y de proveedores que monta cada opción (mismos ids que la web). */
export const milestonesPanel = (page: Page): Locator => page.getByTestId(HITOS_TESTIDS.MILESTONES_PANEL);
export const suppliersPanel = (page: Page): Locator => page.getByTestId(PROVEEDORES_TESTIDS.SUPPLIERS_PANEL);
export const requirementsButton = (page: Page): Locator => buttonNamed(page, 'Ver requisitos');
export const backButton = (page: Page): Locator => buttonNamed(page, 'Volver a Programas');
/** Tarjeta de un programa en la lista: su enlace empieza por el código y el separador «·». */
export const programCardLink = (page: Page, code: string): Locator => page.getByRole('link', { name: new RegExp(`^${code} · `) });

// --- Sesión y apertura -----------------------------------------------------------------------------------------------------------------

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
    await waitUntil(async () => (await seen(articleOf(page))) === true || (await seen(notFoundOf(page))) === true || (await seen(errorOf(page))) === true)
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

/** La opción del grupo «Detalle del programa» que está marcada (`aria-checked`). */
export const optionChecked = async (page: Page, label: string): Promise<Check> => {
  const checked = await attrOne(optionOf(page, label), 'aria-checked');
  return check(checked === 'true', `la opción seleccionada es ${label}`, `la opción seleccionada es ${checked === 'true' ? label : '(otra o sin leer)'}`);
};
