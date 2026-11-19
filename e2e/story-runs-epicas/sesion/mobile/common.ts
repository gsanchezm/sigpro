import type { Locator, Page } from '@playwright/test';
import { TENANT_A, type Credentials } from '../../../story-runs/support/prepare';
import { NC_DYNAMIC_TESTIDS, PROGRAMAS_DYNAMIC_TESTIDS } from '../../../../packages/shared/src/testids';
import { ACTION, CEILING_MS, isVisible, pathOf } from '../../support/browser';
import type { BrowserRowHandler, Outcome } from '../../core/framework';
import { visibilityOf, runStepsLogged } from '../web/common';

// Piezas comunes de las filas de la app móvil de EP-SESION. La app se ejecuta como web de Expo a 390 × 844: NO es iOS ni Android nativo.
// Los localizadores son de rol («tab», «textbox», «heading» de nivel 1, «listitem» con el código); el id de prueba solo como respaldo
// de la misma pestaña o tarjeta. Las pantallas que Expo web deja montadas fuera de vista se descartan por visibilidad.

/** Salvedad de plataforma: el veredicto de una fila móvil vale para Expo web, no para iOS ni Android nativo. */
export const EXPO_NOTE = 'El veredicto vale para Expo web (390 × 844): no se ha comprobado en iOS ni en Android nativo.';
/** Aproximación declarada: abrir una dirección es una carga completa de la página, no un enlace profundo. */
export const DIRECT_NOTE = 'Abrir una dirección de la app se aproxima con una carga completa de la página en Expo web, que recupera la sesión guardada; en iOS o Android sería un enlace profundo o una navegación interna.';
/** Aproximación declarada: «cerrar la app y volverla a abrir» se simula con otra página en el mismo contexto (el almacenamiento se conserva). */
export const REOPEN_NOTE = 'Cerrar la app y volver a abrirla se aproxima cerrando la página y abriendo otra en el mismo contexto de navegador (la sesión y el tenant guardados se conservan); no reinicia el proceso de la app.';

/** Añade una salvedad a la nota del resultado, sin borrar la que ya tenga. */
export const withNote = (result: Outcome, extra: string): Outcome => ({ ...result, note: result.note === undefined ? extra : `${result.note} ${extra}` });

/** Añade a cada resultado de una fila móvil la salvedad de plataforma (Expo web, no nativo). */
export const onExpoWeb =
  (handler: BrowserRowHandler): BrowserRowHandler =>
  async (row, fixtures) =>
    withNote(await handler(row, fixtures), EXPO_NOTE);

// --- Localizadores ----------------------------------------------------------------------------------------------------------

export const textbox = (page: Page, name: string): Locator => page.getByRole('textbox', { name, exact: true });
export const tenantBox = (page: Page): Locator => textbox(page, 'Tenant de trabajo');
export const emailBox = (page: Page): Locator => textbox(page, 'Correo electrónico');
export const passwordBox = (page: Page): Locator => textbox(page, 'Contraseña');
export const enterButton = (page: Page): Locator => page.getByRole('button', { name: 'Entrar', exact: true });
export const loginHeading = (page: Page): Locator => page.getByRole('heading', { name: 'Iniciar sesión', level: 1, exact: true });
export const programsHeading = (page: Page): Locator => page.getByRole('heading', { name: 'Programas', level: 1, exact: true });
/** Pestaña de la barra inferior («Programas», «No conformidades»…): su nombre accesible es el de la historia; el id es el respaldo. */
export const tabOf = (page: Page, label: string, key: string): Locator => page.getByRole('tab', { name: label, exact: true }).or(page.getByTestId(PROGRAMAS_DYNAMIC_TESTIDS.MOBILE_TAB(key)));
/** Tarjeta de la NC en el tablero móvil: `listitem` cuyo nombre es el código; el id de la tarjeta es el respaldo. */
export const ncCardMobile = (page: Page, code: string): Locator => page.getByRole('listitem', { name: code, exact: true }).or(page.getByTestId(NC_DYNAMIC_TESTIDS.NC_CARD(code)));

// --- Pantallas ---------------------------------------------------------------------------------------------------------------

/** Pantalla de acceso de la app: ruta /login y el título «Iniciar sesión» visible. */
export const onLoginMobile = async (page: Page): Promise<boolean> => pathOf(page) === '/login' && (await visibilityOf(loginHeading(page))) === 'visible';
/** Pantalla de programas de la app: ruta /programs y el título visible. */
export const onProgramsMobile = async (page: Page): Promise<boolean> => pathOf(page) === '/programs' && (await isVisible(programsHeading(page)));

// --- Pasos ---------------------------------------------------------------------------------------------------------------------

/** Va a /login y escribe alumno01 en «Tenant de trabajo» (la app lo guarda al escribirlo). Devuelve el motivo si no se pudo. */
export const prepareLoginTenant = (page: Page): Promise<string | undefined> =>
  runStepsLogged([
    ['abrir /login', () => page.goto('/login', { timeout: CEILING_MS })],
    ['ver el título «Iniciar sesión»', () => loginHeading(page).waitFor(ACTION)],
    ['escribir alumno01 en «Tenant de trabajo»', () => tenantBox(page).fill(TENANT_A, ACTION)],
  ]);

/** Inicia sesión en la app con alumno01 y la cuenta de la fila, y espera a /programs. Devuelve el motivo si no llegó. */
export const signInMobile = async (page: Page, credentials: Credentials): Promise<string | undefined> => {
  const prepared = await prepareLoginTenant(page);
  if (prepared) return prepared;
  return runStepsLogged([
    ['escribir el correo', () => emailBox(page).fill(credentials.email, ACTION)],
    ['escribir la contraseña', () => passwordBox(page).fill(credentials.password, ACTION)],
    ['pulsar «Entrar»', () => enterButton(page).click(ACTION)],
    ['llegar a /programs', () => programsHeading(page).waitFor(ACTION)],
  ]);
};

/** Pulsa una pestaña de la barra inferior. */
export const tapTab = (page: Page, label: string, key: string): Promise<string | undefined> =>
  runStepsLogged([[`pulsar la pestaña «${label}»`, () => tabOf(page, label, key).click(ACTION)]]);

/** Dirección de la app abierta con una carga completa (la pestaña `page`), para las filas de «abrir <ruta>». */
export const openDirect = (page: Page, route: string): Promise<string | undefined> => runStepsLogged([[`abrir ${route} en la app`, () => page.goto(route, { timeout: CEILING_MS })]]);
