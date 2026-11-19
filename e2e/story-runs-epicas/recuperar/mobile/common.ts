import type { Locator, Page } from '@playwright/test';
import { TENANT_A } from '../../../story-runs/support/prepare';
import { ACCESO_DYNAMIC_TESTIDS, ACCESO_TESTIDS } from '../../../../packages/shared/src/testids';
import { ACTION, attrOf, isDisabled, linesOf, pathOf, runSteps, safe, textOf } from '../../support/browser';
import type { BrowserRowHandler } from '../../core/framework';
import { FORGOT_LINK, enabledOf, visibilityOf } from '../web/common';

// Piezas comunes de las filas de la app móvil de EP-RECUPERAR. La app se ejecuta como web de Expo a 390 × 844: NO es iOS ni Android
// nativo. Todo localizador es de ROL (excluye lo oculto: Expo web conserva en el DOM las pantallas de la pila que ya no se ven) y los
// avisos que no tienen rol propio (el de cada campo, el de éxito y los emergentes) se localizan por su id de prueba.

/** Salvedad de plataforma: el veredicto de una fila móvil vale para Expo web, no para iOS ni Android nativo. */
export const EXPO_NOTE = 'El veredicto vale para Expo web (390 × 844): no se ha comprobado en iOS ni en Android nativo.';
/** Aproximación declarada: la tecla de envío del teclado se simula con Enter en el campo (mismo `onSubmitEditing`). */
export const KEYBOARD_NOTE = 'La tecla de envío del teclado se aproxima con la tecla Enter pulsada en el campo «Correo electrónico» de Expo web (dispara el mismo onSubmitEditing); no es el teclado del sistema.';
/** Aproximación declarada: «volver a la pantalla anterior» es la navegación atrás del navegador en Expo web. */
export const BACK_NOTE = 'Volver a la pantalla anterior se aproxima con la navegación atrás del navegador en Expo web; no es el botón atrás de Android ni de iOS.';
/** Aproximación declarada: abrir /forgot directamente es una carga completa de la página en Expo web. */
export const DIRECT_NOTE = 'Abrir /forgot directamente se aproxima con una carga completa de la página en Expo web (la app recupera la sesión y el tenant guardados); en nativo sería un enlace profundo.';

/** Añade a cada resultado la salvedad de plataforma (la de Expo web), como las filas de EP-MFA y EP-REGISTRO. */
export const onExpoWeb =
  (handler: BrowserRowHandler): BrowserRowHandler =>
  async (row, fixtures) => {
    const result = await handler(row, fixtures);
    return { ...result, note: result.note === undefined ? EXPO_NOTE : `${result.note} ${EXPO_NOTE}` };
  };

// --- Localizadores de rol y de id de prueba -----------------------------------------------------------------------------------

export const textbox = (page: Page, name: string): Locator => page.getByRole('textbox', { name, exact: true });
export const buttonNamed = (page: Page, name: string): Locator => page.getByRole('button', { name, exact: true });
export const heading1 = (page: Page, name: string): Locator => page.getByRole('heading', { name, level: 1, exact: true });

export const tenantBox = (page: Page): Locator => textbox(page, 'Tenant de trabajo');
export const emailBox = (page: Page): Locator => textbox(page, 'Correo electrónico');
export const passwordBox = (page: Page): Locator => textbox(page, 'Contraseña');
export const enterButton = (page: Page): Locator => buttonNamed(page, 'Entrar');
export const forgotLink = (page: Page): Locator => buttonNamed(page, FORGOT_LINK);
export const sendButton = (page: Page): Locator => buttonNamed(page, 'Enviar enlace');
export const backButton = (page: Page): Locator => buttonNamed(page, 'Volver al inicio de sesión');
export const loginHeading = (page: Page): Locator => heading1(page, 'Iniciar sesión');
export const programsHeading = (page: Page): Locator => heading1(page, 'Programas');
export const forgotHeading = (page: Page): Locator => heading1(page, 'Recuperar contraseña');
/** Aviso de éxito: su contenedor tiene el id de prueba del aviso (la app no le da un nombre accesible propio). */
export const sentNotice = (page: Page): Locator => page.getByTestId(ACCESO_TESTIDS.FORGOT_SENT);
/** Aviso de error bajo el campo «Correo electrónico». */
export const fieldError = (page: Page): Locator => page.getByTestId(ACCESO_TESTIDS.FORGOT_EMAIL_ERROR);
/** Avisos emergentes de error (`toast-danger`): el primer renglón es el título y el resto, la traza. */
export const dangerToasts = (page: Page): Locator => page.getByTestId(ACCESO_DYNAMIC_TESTIDS.TOAST('danger'));

// --- Pantallas y estado del botón ---------------------------------------------------------------------------------------------

export const onLoginForm = async (page: Page): Promise<boolean> => pathOf(page) === '/login' && (await visibilityOf(loginHeading(page))) === 'visible';
export const onForgot = async (page: Page): Promise<boolean> => pathOf(page) === '/forgot' && (await visibilityOf(forgotHeading(page))) === 'visible';
export const onPrograms = async (page: Page): Promise<boolean> => pathOf(page) === '/programs' && (await visibilityOf(programsHeading(page))) === 'visible';

/**
 * «Enviar enlace» ocupado y no pulsable durante la espera: `aria-busy` verdadero y el control deshabilitado (la misma lectura que el
 * piloto usa en «Entrar»: `aria-busy` como atributo y `isDisabled`, que tiene en cuenta `aria-disabled`).
 */
export const sendBusy = async (page: Page): Promise<boolean> => (await attrOf(sendButton(page), 'aria-busy')) === 'true' && (await isDisabled(sendButton(page)));

/**
 * «Enviar enlace» disponible: habilitado (`isEnabled`) y sin `aria-busy` verdadero. Un atributo que no está puesto cuenta como «no ocupado»;
 * una lectura que falla no cuenta como disponible.
 */
export const sendAvailable = async (page: Page): Promise<boolean> =>
  (await enabledOf(sendButton(page))) === true && (await attrOf(sendButton(page), 'aria-busy')) !== 'true';

/** Primer renglón de cada aviso de error que hay en pantalla (el título). */
export const dangerTitles = async (page: Page): Promise<readonly string[]> => {
  const toasts = dangerToasts(page);
  const total = await safe(() => toasts.count(), 0);
  const titles: string[] = [];
  for (let index = 0; index < total; index += 1) titles.push(linesOf(await textOf(toasts.nth(index)))[0] ?? '');
  return titles;
};

// --- Navegación ----------------------------------------------------------------------------------------------------------------

/** Va a /login y escribe alumno01 en «Tenant de trabajo» (un solo `fill`: el campo vuelve a `demo` si queda vacío). */
export const openLoginWithTenant = (page: Page): Promise<string | undefined> =>
  runSteps([
    ['abrir /login', () => page.goto('/login', ACTION)],
    ['ver el título «Iniciar sesión»', () => loginHeading(page).waitFor(ACTION)],
    ['escribir alumno01 en «Tenant de trabajo»', () => tenantBox(page).fill(TENANT_A, ACTION)],
  ]);

/** Carga directa de /forgot, sin sesión (contexto nuevo). */
export const openForgotDirect = (page: Page): Promise<string | undefined> =>
  runSteps([
    ['abrir /forgot', () => page.goto('/forgot', ACTION)],
    ['ver el título «Recuperar contraseña»', () => forgotHeading(page).waitFor(ACTION)],
  ]);

/** Inicia sesión en la propia app (con la cuenta y la contraseña de la fila) y espera a /programs. */
export const signInMobile = (page: Page, email: string, password: string): Promise<string | undefined> =>
  runSteps([
    ['abrir /login', () => page.goto('/login', ACTION)],
    ['ver el título «Iniciar sesión»', () => loginHeading(page).waitFor(ACTION)],
    ['escribir alumno01 en «Tenant de trabajo»', () => tenantBox(page).fill(TENANT_A, ACTION)],
    ['escribir el correo', () => emailBox(page).fill(email, ACTION)],
    ['escribir la contraseña', () => passwordBox(page).fill(password, ACTION)],
    ['pulsar «Entrar»', () => enterButton(page).click(ACTION)],
    ['llegar a /programs', () => programsHeading(page).waitFor(ACTION)],
  ]);
