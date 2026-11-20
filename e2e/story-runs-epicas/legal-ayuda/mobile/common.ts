import type { Locator, Page } from '@playwright/test';
import { MOVIL_TESTIDS, PROGRAMAS_DYNAMIC_TESTIDS } from '../../../../packages/shared/src/testids';
import { TENANT_A, type Credentials } from '../../../story-runs/support/prepare';
import { ACTION, isVisible, pathOf, safe, waitUntil } from '../../support/browser';
import type { BrowserRowHandler } from '../../core/framework';
import { type Arrival, type Blocked, type Persona, arrivedAt, interact, openRoute, reachedRoute, screenNotReached, tenantBlocked } from '../web/common';

// Piezas comunes de EP-LEGAL-AYUDA en la app móvil. La app se ejecuta como web de Expo a 390 × 844: NO es iOS ni Android nativo.
// Los localizadores son de rol (textbox, heading de nivel 1, tab, link); el id de prueba solo como respaldo de la misma pestaña.

/** Salvedad de plataforma: el veredicto vale para Expo web. Las direcciones de la app se abren con una carga completa de la página. */
export const EXPO_NOTE =
  'El veredicto vale para Expo web (390 × 844), no para iOS ni Android nativo; las direcciones de la app se abren con una carga completa de la página, no con un enlace profundo.';

/** Añade a cada resultado de una fila móvil la salvedad de plataforma, sin borrar la nota que ya tenga. */
export const onExpoWeb =
  (handler: BrowserRowHandler): BrowserRowHandler =>
  async (row, fixtures) => {
    const result = await handler(row, fixtures);
    return { ...result, note: result.note === undefined ? EXPO_NOTE : `${result.note} ${EXPO_NOTE}` };
  };

/** Nota de la fila de «volver» desde el pie de /login: el destino y el historial coinciden, así que la fila no los distingue. */
export const NOT_DISTINGUISHED =
  'La fila no distingue «volver» (historial) de «ir a /login» (destino): ambos llevan a /login, y la historia no fija cuál de los dos.';

// --- Localizadores ---------------------------------------------------------------------------------------------------------

const textbox = (page: Page, name: string): Locator => page.getByRole('textbox', { name, exact: true });
const tenantField = (page: Page): Locator => textbox(page, 'Tenant de trabajo');
const emailField = (page: Page): Locator => textbox(page, 'Correo electrónico');
const passwordField = (page: Page): Locator => textbox(page, 'Contraseña');
const enterButton = (page: Page): Locator => page.getByRole('button', { name: 'Entrar', exact: true });
const loginTitle = (page: Page): Locator => page.getByRole('heading', { name: 'Iniciar sesión', level: 1, exact: true });
const programsTitle = (page: Page): Locator => page.getByRole('heading', { name: 'Programas', level: 1, exact: true });
/** Pestaña «Más» de la barra inferior: nombre accesible «Más»; el id de la pestaña es el respaldo. */
const moreTab = (page: Page): Locator => page.getByRole('tab', { name: 'Más', exact: true }).or(page.getByTestId(PROGRAMAS_DYNAMIC_TESTIDS.MOBILE_TAB('more')));
export const morePage = (page: Page): Locator => page.getByTestId(MOVIL_TESTIDS.MORE_PAGE);
export const moreItem = (page: Page, name: string): Locator => morePage(page).getByRole('link', { name, exact: true });
export const registerPage = (page: Page): Locator => page.getByTestId(MOVIL_TESTIDS.REGISTER_PAGE);

/** Nombres accesibles de los enlaces de «Más», en orden. Se ejecuta en el navegador: no usa variables de fuera. */
const namesOf = (links: Element[]): string[] => links.map((link) => (link.getAttribute('aria-label') ?? link.textContent ?? '').replace(/\s+/g, ' ').trim());

/** Elementos de «Más» en orden de la lista (vacía si no es legible). */
export const moreNames = (page: Page): Promise<readonly string[]> => safe<readonly string[]>(() => morePage(page).getByRole('link').evaluateAll(namesOf), []);

// --- Preparación y navegación -----------------------------------------------------------------------------------------------

/** Sin sesión: abre /login y escribe alumno01 en «Tenant de trabajo» (la app guarda el tenant al escribirlo). */
export const prepareLogin = async (page: Page): Promise<Blocked | undefined> => {
  const opened = await openRoute(page, '/login');
  if (opened) return opened;
  return interact(tenantField(page), 'el campo «Tenant de trabajo»', loginTitle(page), (element) => element.fill(TENANT_A, ACTION));
};

/** Con sesión: prepara el acceso y entra con la cuenta de la fila hasta Programas; comprueba que el tenant de la sesión es alumno01. */
export const signInMobile = async (page: Page, credentials: Credentials): Promise<Blocked | undefined> => {
  const prepared = await prepareLogin(page);
  if (prepared) return prepared;
  const email = await interact(emailField(page), 'el campo «Correo electrónico»', loginTitle(page), (element) => element.fill(credentials.email, ACTION));
  if (email) return email;
  const password = await interact(passwordField(page), 'el campo «Contraseña»', loginTitle(page), (element) => element.fill(credentials.password, ACTION));
  if (password) return password;
  const submit = await interact(enterButton(page), 'el botón «Entrar»', loginTitle(page), (element) => element.click(ACTION));
  if (submit) return submit;
  const arrived = await waitUntil(async () => pathOf(page) === '/programs' && (await isVisible(programsTitle(page))));
  if (!arrived.reached) return { kind: 'estado', message: `no llega a Programas tras «Entrar» (ruta ${pathOf(page)})`, note: 'El inicio de sesión de la preparación no llega a Programas.' };
  return tenantBlocked(page);
};

/**
 * Abre la página como PRIMERA navegación de una pestaña nueva del mismo contexto: la historia de esa pestaña empieza en la página,
 * sin pantalla anterior. La sesión y el tenant guardados (localStorage) se conservan, así que la fila con sesión sigue con sesión.
 */
export const directFirst = async (page: Page, route: string): Promise<Arrival> => {
  const fresh = await page.context().newPage();
  const opened = await openRoute(fresh, route);
  return arrivedAt(fresh, opened ?? (await reachedRoute(fresh, route)));
};

/** Pulsa la pestaña «Más» con sesión iniciada y espera a /more. */
export const openMore = async (page: Page): Promise<Blocked | undefined> => {
  const tapped = await interact(moreTab(page), 'la pestaña «Más»', programsTitle(page), (element) => element.click(ACTION));
  if (tapped) return tapped;
  return reachedRoute(page, '/more');
};

/** Pulsa un elemento de «Más». */
export const moreItemClick = (page: Page, name: string): Promise<Blocked | undefined> =>
  interact(moreItem(page, name), `el elemento «${name}» de «Más»`, morePage(page), (element) => element.click(ACTION));

/** Pulsa «condiciones de uso» en el formulario de /register (el enlace va a /legal/terms). */
export const registerTermsTap = async (page: Page): Promise<Blocked | undefined> => {
  const opened = await openRoute(page, '/register');
  if (opened) return opened;
  const shown = await waitUntil(() => isVisible(registerPage(page)));
  if (!shown.reached) return screenNotReached('el formulario de /register');
  const tapped = await interact(page.getByRole('link', { name: 'condiciones de uso', exact: true }), 'el enlace «condiciones de uso» del formulario', registerPage(page), (element) =>
    element.click(ACTION),
  );
  if (tapped) return tapped;
  return reachedRoute(page, '/legal/terms');
};

/** La persona de la fila: con sesión (entra con su cuenta) o sin ella (solo la preparación de acceso). */
export const prepareMobile = (page: Page, persona: Persona): Promise<Blocked | undefined> => (persona.signedIn ? signInMobile(page, persona.credentials) : prepareLogin(page));

/** Notas de decisión: la fila se anota sin juzgarla si todo lo que mide se cumple (la historia la deja en «Decisiones pendientes»). */
export const DECISION_REGISTER =
  'Decisión pendiente en la historia 003 («Decisiones pendientes»): «Volver al acceso» tras el formulario de solicitud vuelve a /register, no a /login, y no está decidido si el texto o el destino deben cambiar.';
export const DECISION_SHORTCUTS =
  'Decisión pendiente en la historia 003 («Decisiones pendientes»): no está decidido si la sección «Atajos de teclado» debe mostrarse en la app móvil.';
