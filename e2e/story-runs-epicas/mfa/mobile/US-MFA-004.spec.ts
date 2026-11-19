import type { Locator, Page } from '@playwright/test';
import { DEMO, TENANT_A, resetTenants } from '../../../story-runs/support/prepare';
import { ACID } from './ids';
import { ACTION, CEILING_MS, isDisabled, isEnabled, linesOf, noSessionCheck, pathOf, runSteps, textOf, valueOf, waitUntil } from '../../support/browser';
import { cell, check, conclude, preparationFailedWeb, strict, type Check } from '../../support/checks';
import { defineBrowserRows, outcome, type BrowserRowHandler } from '../../support/framework';

// US-MFA-004 — Completar o abandonar la verificación en dos pasos (app móvil servida como web de Expo a 390 × 844; NO es nativo).
// Preparación de cada fila: reinicio del tenant alumno01, /login con el almacenamiento vacío (contexto nuevo), «alumno01» en
// «Tenant de trabajo» y envío de admin@sigpro.test con su contraseña con el propio formulario de la app. Las pulsaciones son
// clics de ratón (Playwright), no toques de dedo, y el teclado del sistema no se abre: el veredicto vale para Expo web.

const SUCCESS_NOTE = 'El veredicto vale para Expo web (390 × 844): no se ha comprobado en iOS ni en Android nativo.';
const WRONG_CODE_MESSAGE = 'Código incorrecto o caducado';

const textbox = (page: Page, name: string): Locator => page.getByRole('textbox', { name, exact: true });
const buttonNamed = (page: Page, name: string): Locator => page.getByRole('button', { name, exact: true });
const heading1 = (page: Page, name: string): Locator => page.getByRole('heading', { name, level: 1, exact: true });

const loginHeading = (page: Page): Locator => heading1(page, 'Iniciar sesión');
const programsHeading = (page: Page): Locator => heading1(page, 'Programas');
const mfaTitle = (page: Page): Locator => heading1(page, 'Verificación en dos pasos');
const codeField = (page: Page): Locator => textbox(page, 'Código de verificación');
const verifyButton = (page: Page): Locator => buttonNamed(page, 'Verificar');
const backButton = (page: Page): Locator => buttonNamed(page, 'Volver al inicio de sesión');
const serverAlert = (page: Page): Locator => page.getByTestId(ACID.mfaError);

/** Hay exactamente un elemento y se ve; si hay varios la lectura es ambigua y lanza (dentro de una espera cuenta como «aún no»). */
const seen = async (target: Locator): Promise<boolean> => {
  const found = await target.count();
  if (found > 1) throw new Error(`lectura ambigua: ${found} elementos para ${String(target)}`);
  return found === 1 && (await target.isVisible());
};

const onLoginForm = async (page: Page): Promise<boolean> => pathOf(page) === '/login' && (await seen(loginHeading(page)));
const onPrograms = async (page: Page): Promise<boolean> => pathOf(page) === '/programs' && (await seen(programsHeading(page)));

const STEP_EXPECTED = 'una persona sin sesión llega a «Verificación en dos pasos» para admin@sigpro.test';

/** Llega al segundo paso como lo haría una persona con la app; devuelve por qué no llegó, si no llegó. */
const reachSecondStep = async (page: Page): Promise<string | undefined> => {
  await resetTenants([TENANT_A]);
  return runSteps([
    ['abrir /login', () => page.goto('/login', { timeout: CEILING_MS })],
    ['ver el título «Iniciar sesión»', () => loginHeading(page).waitFor({ timeout: CEILING_MS })],
    // Un solo `fill`: el campo vuelve a `demo` al quedar vacío, así que escribir carácter a carácter tras borrar daría `demoalumno01`
    ['escribir el tenant en «Tenant de trabajo»', () => textbox(page, 'Tenant de trabajo').fill(TENANT_A, ACTION)],
    ['escribir el correo', () => textbox(page, 'Correo electrónico').fill(DEMO.admin.email, ACTION)],
    ['escribir la contraseña', () => textbox(page, 'Contraseña').fill(DEMO.admin.password, ACTION)],
    ['pulsar «Entrar»', () => buttonNamed(page, 'Entrar').click(ACTION)],
    ['ver «Verificación en dos pasos»', () => mfaTitle(page).waitFor({ timeout: CEILING_MS })],
  ]);
};

/** Un texto tal cual, o `(vacío)` como cadena vacía; cualquier otro paréntesis lanza. */
const plain = (text: string): string => {
  if (text === '(vacío)') return '';
  if (text.startsWith('(')) throw new Error(`celda sin interpretación: «${text}»`);
  return text;
};

const typeCode = (page: Page, code: string): Promise<string | undefined> =>
  runSteps([
    ['limpiar «Código de verificación»', () => codeField(page).fill('', ACTION)],
    ...(code === '' ? [] : ([['escribir el código', () => codeField(page).pressSequentially(code, { delay: 0 })]] as const)),
  ]);

const submitCode = async (page: Page, code: string): Promise<string | undefined> =>
  (await typeCode(page, code)) ?? (await runSteps([['pulsar «Verificar»', () => verifyButton(page).click(ACTION)]]));

const MISSING = { note: 'La historia nombra un elemento que la pantalla no ofrece.' } as const;

const SUCCESS_RESULT = 'llega a /programs con una sesión abierta';
const WRONG_RESULT = 've «Código incorrecto o caducado» y sigue en la verificación sin sesión';

const observeSuccess = async (page: Page): Promise<readonly Check[]> => {
  const arrived = await waitUntil(() => onPrograms(page));
  return [check(arrived.reached, 'llega a /programs con una sesión abierta', arrived.reached ? 'llega a /programs' : `no llega a /programs (ruta ${pathOf(page)})`)];
};

const observeWrong = async (page: Page): Promise<readonly Check[]> => {
  const shown = await waitUntil(async () => linesOf(await textOf(serverAlert(page)))[0] === WRONG_CODE_MESSAGE);
  const message = linesOf(await textOf(serverAlert(page)))[0];
  const stillThere = await waitUntil(() => seen(mfaTitle(page)), 1_000);
  return [
    check(shown.reached, `ve «${WRONG_CODE_MESSAGE}»`, message === undefined ? 'no ve ningún aviso' : `ve «${message}»`),
    check(stillThere.reached, 'sigue en «Verificación en dos pasos»', stillThere.reached ? 'sigue en «Verificación en dos pasos»' : `ya no ve la verificación (ruta ${pathOf(page)})`),
    await noSessionCheck(page, onLoginForm, onPrograms),
  ];
};

const RESULTS: ReadonlyMap<string, (page: Page) => Promise<readonly Check[]>> = new Map([
  [SUCCESS_RESULT, observeSuccess],
  [WRONG_RESULT, observeWrong],
]);

/** Cada fila añade la salvedad de la plataforma al resultado: el veredicto vale para Expo web. */
const withPlatform = (result: ReturnType<typeof conclude>): ReturnType<typeof conclude> => ({
  ...result,
  note: result.note === undefined ? SUCCESS_NOTE : `${result.note} ${SUCCESS_NOTE}`,
});

// --- Esquema 1: el código completa la sesión o muestra un error corregible --------------------------------------------------

const submitAndObserve: BrowserRowHandler = async (row, { page }) => {
  const expected = cell(row, 'resultado');
  const prepared = await reachSecondStep(page);
  if (prepared) return preparationFailedWeb(STEP_EXPECTED, prepared);
  const failure = await submitCode(page, cell(row, 'codigo'));
  if (failure) return outcome(false, expected, failure, MISSING);
  return withPlatform(conclude(await strict('resultado', RESULTS, expected)(page)));
};

// --- Esquema 2: el código debe tener seis dígitos para enviarse -------------------------------------------------------------

const BUTTON_STATES: ReadonlyMap<string, (page: Page) => Promise<Check>> = new Map<string, (page: Page) => Promise<Check>>([
  ['deshabilitado', async (page) => check(await isDisabled(verifyButton(page)), '«Verificar» deshabilitado', (await isDisabled(verifyButton(page))) ? '«Verificar» deshabilitado' : '«Verificar» habilitado')],
  ['habilitado', async (page) => check(await isEnabled(verifyButton(page)), '«Verificar» habilitado', (await isEnabled(verifyButton(page))) ? '«Verificar» habilitado' : '«Verificar» deshabilitado')],
]);

const typing: BrowserRowHandler = async (row, { page }) => {
  const prepared = await reachSecondStep(page);
  if (prepared) return preparationFailedWeb(STEP_EXPECTED, prepared);
  const failure = await typeCode(page, plain(cell(row, 'entrada')));
  if (failure) return outcome(false, 'se escribe el código', failure, MISSING);
  const content = await valueOf(codeField(page));
  const wanted = plain(cell(row, 'contenido'));
  return withPlatform(
    conclude([
      check(content === wanted, `el campo conserva ${wanted === '' ? '(vacío)' : wanted}`, `el campo conserva ${content === undefined ? '(no legible)' : content === '' ? '(vacío)' : content}`),
      await strict('estado', BUTTON_STATES, cell(row, 'estado'))(page),
    ]),
  );
};

// --- Esquema 3: tras un código incorrecto se puede corregir y volver a intentar ---------------------------------------------

const correction: BrowserRowHandler = async (row, { page }) => {
  const expected = cell(row, 'resultado');
  const prepared = await reachSecondStep(page);
  if (prepared) return preparationFailedWeb(STEP_EXPECTED, prepared);
  const first = await submitCode(page, '000000');
  if (first) return outcome(false, 'se envía 000000', first, MISSING);
  const shown = await waitUntil(async () => linesOf(await textOf(serverAlert(page)))[0] === WRONG_CODE_MESSAGE);
  if (!shown.reached) return preparationFailedWeb('ve «Código incorrecto o caducado» tras 000000', 'no se vio el aviso tras enviar 000000');
  const second = await submitCode(page, cell(row, 'segundo_codigo'));
  if (second) return outcome(false, expected, second, MISSING);
  return withPlatform(conclude(await strict('resultado', RESULTS, expected)(page)));
};

// --- Esquema 4: se puede volver al formulario de acceso ---------------------------------------------------------------------

const back: BrowserRowHandler = async (row, { page }) => {
  const prepared = await reachSecondStep(page);
  if (prepared) return preparationFailedWeb(STEP_EXPECTED, prepared);
  const typed = await typeCode(page, plain(cell(row, 'codigo')));
  if (typed) return outcome(false, 'se escribe el código', typed, MISSING);
  const failure = await runSteps([['pulsar «Volver al inicio de sesión»', () => backButton(page).click(ACTION)]]);
  if (failure) return outcome(false, 'vuelve a «Iniciar sesión» sin sesión abierta', failure, MISSING);
  const returned = await waitUntil(() => seen(loginHeading(page)));
  return withPlatform(
    conclude([
      check(returned.reached, 'vuelve a «Iniciar sesión»', returned.reached ? 'vuelve a «Iniciar sesión»' : `no vuelve al formulario (ruta ${pathOf(page)})`),
      await noSessionCheck(page, onLoginForm, onPrograms),
    ]),
  );
};

defineBrowserRows({
  story: 'US-MFA-004',
  surface: 'expo-web',
  tenants: [TENANT_A],
  handlers: new Map<number, BrowserRowHandler>([
    [1, submitAndObserve],
    [2, typing],
    [3, correction],
    [4, back],
  ]),
});
