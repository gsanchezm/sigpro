import type { Locator, Page } from '@playwright/test';
import { DEMO, TENANT_A } from '../../../story-runs/support/prepare';
import { ACCESO_TESTIDS } from '../../../../packages/shared/src/testids';
import { ACTION, CEILING_MS, pathOf, runSteps, type Step } from '../../support/browser';
import { sleep } from '../../support/checks';
import type { FormValues } from '../web/common';
import type { BrowserRowHandler } from '../../support/framework';

// Piezas comunes de las filas de la app móvil de EP-REGISTRO. La app se ejecuta como web de Expo a 390 × 844: NO es iOS ni Android
// nativo. Expo web conserva en el DOM las pantallas de la pila que ya no se ven (la de /login queda bajo /register), así que TODO
// localizador es de ROL (excluye lo oculto) y toda lectura es ESTRICTA: si hay más de un elemento, lanza. Las pantallas se localizan
// por rol y nombre; los avisos de cada campo y el del servidor, por su id de prueba (no tienen rol que los distinga).


/** Salvedad de plataforma: el veredicto de una fila móvil vale para Expo web, no para iOS ni Android nativo. */
export const EXPO_NOTE = 'El veredicto vale para Expo web (390 × 844): no se ha comprobado en iOS ni en Android nativo.';

/** Añade a cada resultado de la fila la salvedad de plataforma (como la prueba de referencia de EP-MFA). */
export const onExpoWeb = (handler: BrowserRowHandler): BrowserRowHandler => async (row, fixtures) => {
  const result = await handler(row, fixtures);
  return { ...result, note: result.note === undefined ? EXPO_NOTE : `${result.note} ${EXPO_NOTE}` };
};

export const LOGIN_PATH = '/login';
export const REGISTER_PATH = '/register';
export const PROGRAMS_PATH = '/programs';
export const TENANT_TEXT = 'Tenant de trabajo';

/** Aproximación declarada: «volver» es la navegación atrás del navegador (Expo web), no el botón atrás de Android. */
export const BACK_APPROXIMATION = 'Volver a la pantalla anterior se aproxima con la navegación atrás del navegador en Expo web; no es el botón atrás de Android ni de iOS.';
/** Aproximación declarada: abrir /register directamente se aproxima con una carga completa de la página. */
export const DIRECT_APPROXIMATION = 'Abrir /register directamente se aproxima con una carga completa de la página en Expo web (la app recupera el tenant guardado).';

// --- Localizadores de rol ---------------------------------------------------------------------------------------------------

export const textbox = (page: Page, name: string): Locator => page.getByRole('textbox', { name, exact: true });
export const heading1 = (page: Page, name: string): Locator => page.getByRole('heading', { name, level: 1, exact: true });
export const buttonNamed = (page: Page, name: string): Locator => page.getByRole('button', { name, exact: true });
export const roleCombobox = (page: Page): Locator => page.getByRole('combobox', { name: 'Rol solicitado', exact: true });
export const loginHeading = (page: Page): Locator => heading1(page, 'Iniciar sesión');
export const programsHeading = (page: Page): Locator => heading1(page, 'Programas');
export const registerTitle = (page: Page): Locator => heading1(page, 'Solicitar acceso');
export const serverAlert = (page: Page): Locator => page.getByTestId(ACCESO_TESTIDS.REGISTER_ERROR);
export const passwordFields = (page: Page): readonly Locator[] => [textbox(page, 'Contraseña'), textbox(page, 'Confirmar contraseña')];

/** Hay exactamente un elemento y se ve. Si hay varios la lectura es ambigua y LANZA (dentro de una espera cuenta como «aún no»). */
export const seen = async (target: Locator): Promise<boolean> => {
  const found = await target.count();
  if (found > 1) throw new Error(`lectura ambigua: ${found} elementos`);
  return found === 1 && (await target.isVisible());
};

export const onLoginForm = async (page: Page): Promise<boolean> => pathOf(page) === LOGIN_PATH && (await seen(loginHeading(page)));
export const onPrograms = async (page: Page): Promise<boolean> => pathOf(page) === PROGRAMS_PATH && (await seen(programsHeading(page)));

// --- Navegación a la solicitud ------------------------------------------------------------------------------------------------

/** Va a /login, escribe alumno01 en «Tenant de trabajo» y pulsa «Solicitar acceso» para llegar a /register. */
export const openRegisterFromLogin = (page: Page): Promise<string | undefined> =>
  runSteps([
    ['abrir /login', () => page.goto(LOGIN_PATH, { timeout: CEILING_MS })],
    ['ver el título «Iniciar sesión»', () => loginHeading(page).waitFor({ timeout: CEILING_MS })],
    // Un solo `fill`: el campo vuelve a `demo` al quedar vacío
    [`escribir ${TENANT_A} en «${TENANT_TEXT}»`, () => textbox(page, TENANT_TEXT).fill(TENANT_A, ACTION)],
    ['pulsar «Solicitar acceso»', () => buttonNamed(page, 'Solicitar acceso').click(ACTION)],
    ['ver el título «Solicitar acceso»', () => registerTitle(page).waitFor({ timeout: CEILING_MS })],
  ]);

/** Enlace directo a /register con alumno01 ya guardado en «Tenant de trabajo» (se escribe en /login y se carga /register). */
export const openRegisterDirectly = (page: Page): Promise<string | undefined> =>
  runSteps([
    ['abrir /login', () => page.goto(LOGIN_PATH, { timeout: CEILING_MS })],
    ['ver el título «Iniciar sesión»', () => loginHeading(page).waitFor({ timeout: CEILING_MS })],
    [`escribir ${TENANT_A} en «${TENANT_TEXT}»`, () => textbox(page, TENANT_TEXT).fill(TENANT_A, ACTION)],
    // El tenant se guarda en el almacenamiento sin esperar: se da un margen antes de cargar /register de nuevo
    ['esperar a que quede guardado el tenant', () => sleep(1_000)],
    ['abrir /register', () => page.goto(REGISTER_PATH, { timeout: CEILING_MS })],
    ['ver el título «Solicitar acceso»', () => registerTitle(page).waitFor({ timeout: CEILING_MS })],
  ]);

/** Inicia sesión como gestor@sigpro.test desde /login (en la propia app, sin inyectar nada). */
export const signInAsManager = (page: Page): Promise<string | undefined> =>
  runSteps([
    ['abrir /login', () => page.goto(LOGIN_PATH, { timeout: CEILING_MS })],
    ['ver el título «Iniciar sesión»', () => loginHeading(page).waitFor({ timeout: CEILING_MS })],
    [`escribir ${TENANT_A} en «${TENANT_TEXT}»`, () => textbox(page, TENANT_TEXT).fill(TENANT_A, ACTION)],
    ['escribir el correo', () => textbox(page, 'Correo electrónico').fill(DEMO.gestor.email, ACTION)],
    ['escribir la contraseña', () => textbox(page, 'Contraseña').fill(DEMO.gestor.password, ACTION)],
    ['pulsar «Entrar»', () => buttonNamed(page, 'Entrar').click(ACTION)],
    ['llegar a /programs', () => programsHeading(page).waitFor({ timeout: CEILING_MS })],
  ]);

// --- Formulario --------------------------------------------------------------------------------------------------------------

/** El rol se elige en la hoja de «Rol solicitado»; el valor por defecto (consultant) no hace falta abrirla. */
const chooseRole = async (page: Page, role: string): Promise<void> => {
  if (role === 'consultant') return;
  await roleCombobox(page).click(ACTION);
  await page.getByRole('radio', { name: role, exact: true }).click(ACTION);
};

/** Escribe el formulario como una persona, campo a campo, con los localizadores de rol de la app. */
export const fillMobileForm = (page: Page, values: FormValues): Promise<string | undefined> => {
  const steps: Step[] = [
    ['escribir «Nombre»', () => textbox(page, 'Nombre').fill(values.first, ACTION)],
    ['escribir «Apellidos»', () => textbox(page, 'Apellidos').fill(values.last, ACTION)],
    ['escribir «Correo corporativo»', () => textbox(page, 'Correo corporativo').fill(values.email, ACTION)],
    ['escribir «Organización / Unidad»', () => textbox(page, 'Organización / Unidad').fill(values.org, ACTION)],
    ['elegir «Rol solicitado»', () => chooseRole(page, values.role)],
    ['escribir «Contraseña»', () => textbox(page, 'Contraseña').fill(values.password, ACTION)],
    ['escribir «Confirmar contraseña»', () => textbox(page, 'Confirmar contraseña').fill(values.confirm, ACTION)],
  ];
  if (values.terms) steps.push(['marcar la casilla de condiciones', () => page.getByRole('checkbox', { name: /He leído y acepto/ }).click(ACTION)]);
  return runSteps(steps);
};

/** Cabecera `x-tenant` de la última solicitud de registro que sale del navegador (evidencia de qué tenant recibe la fila). */
export const watchTenantHeader = (page: Page): (() => string | undefined) => {
  let last: string | undefined;
  page.on('request', (request) => {
    if (request.method() === 'POST' && new URL(request.url()).pathname.endsWith('/auth/register')) last = request.headers()['x-tenant'];
  });
  return () => last;
};
