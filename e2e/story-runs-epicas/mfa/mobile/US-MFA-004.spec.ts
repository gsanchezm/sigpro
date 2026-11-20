import type { Locator, Page } from '@playwright/test';
import { DEMO, TENANT_A, resetTenants } from '../../../story-runs/support/prepare';
import { ACTION, CEILING_MS, linesOf, pathOf, runSteps, waitUntil } from '../../support/browser';
import { cell, check, conclude, preparationFailedWeb, strict, type Check } from '../../support/checks';
import { defineBrowserRows, outcome, type BrowserRowHandler, type Outcome } from '../../support/framework';
import {
  ACTION_NOTE,
  CODES,
  CONTENT,
  MFA_HINT_PREFIX,
  READ_NOTE,
  TYPED,
  WRONG_CODE_MESSAGE,
  exactTextVisible,
  noSessionWindow,
  replyCheck,
  sentWithCode,
  settles,
  soleAttr,
  soleCount,
  soleDisabled,
  soleEnabled,
  soleText,
  soleValue,
  soleVisible,
  tenantCheck,
  trackAuth,
  type AuthTraffic,
} from '../web/common';
import { ACID } from './ids';

// US-MFA-004 — Completar o abandonar la verificación en dos pasos (app móvil servida como web de Expo a 390 × 844; NO es nativo).
// Preparación de cada fila: reinicio del tenant alumno01, /login con el almacenamiento vacío (contexto nuevo), «alumno01» en
// «Tenant de trabajo» y envío de admin@sigpro.test con su contraseña con el propio formulario de la app. Las pulsaciones son
// clics de ratón (Playwright), no toques de dedo, y el teclado del sistema no se abre: el veredicto vale para Expo web.
// Comprobaciones de cada fila: el correo de la cuenta en el texto del segundo paso, el tenant de cada petición de acceso
// (x-tenant) y, en las filas de éxito, el usuario de la respuesta de /api/auth/mfa.

const PLATFORM_NOTE =
  'El veredicto vale para Expo web (390 × 844): no se ha comprobado en iOS ni en Android nativo. El teclado numérico (number-pad) solo se comprueba si Expo web expone inputmode; si no, no es observable aquí.';
const FIRST_WRONG_CODE = '000000';
const STEP_EXPECTED = 'una persona sin sesión llega a «Verificación en dos pasos» para admin@sigpro.test';

const textbox = (page: Page, name: string): Locator => page.getByRole('textbox', { name, exact: true });
const buttonNamed = (page: Page, name: string): Locator => page.getByRole('button', { name, exact: true });
const heading1 = (page: Page, name: string): Locator => page.getByRole('heading', { name, level: 1, exact: true });

const loginHeading = (page: Page): Locator => heading1(page, 'Iniciar sesión');
const programsHeading = (page: Page): Locator => heading1(page, 'Programas');
const mfaTitle = (page: Page): Locator => heading1(page, 'Verificación en dos pasos');
const emailField = (page: Page): Locator => textbox(page, 'Correo electrónico');
const passwordField = (page: Page): Locator => textbox(page, 'Contraseña');
const codeField = (page: Page): Locator => textbox(page, 'Código de verificación');
const verifyButton = (page: Page): Locator => buttonNamed(page, 'Verificar');
const backButton = (page: Page): Locator => buttonNamed(page, 'Volver al inicio de sesión');
const serverAlert = (page: Page): Locator => page.getByTestId(ACID.mfaError);

const onLoginForm = async (page: Page): Promise<boolean> => pathOf(page) === '/login' && (await soleVisible(loginHeading(page)));
const onPrograms = async (page: Page): Promise<boolean> => pathOf(page) === '/programs' && (await soleVisible(programsHeading(page)));

/** Llega al segundo paso como lo haría una persona con la app; devuelve por qué no llegó, si no llegó. */
const reachSecondStep = async (page: Page): Promise<string | undefined> => {
  await resetTenants([TENANT_A]);
  return runSteps([
    ['abrir /login', () => page.goto('/login', { timeout: CEILING_MS })],
    ['ver el título «Iniciar sesión»', () => loginHeading(page).waitFor({ timeout: CEILING_MS })],
    // Un solo `fill`: el campo vuelve a `demo` al quedar vacío, así que escribir carácter a carácter tras borrar daría `demoalumno01`
    ['escribir el tenant en «Tenant de trabajo»', () => textbox(page, 'Tenant de trabajo').fill(TENANT_A, ACTION)],
    ['escribir el correo', () => emailField(page).fill(DEMO.admin.email, ACTION)],
    ['escribir la contraseña', () => passwordField(page).fill(DEMO.admin.password, ACTION)],
    ['pulsar «Entrar»', () => buttonNamed(page, 'Entrar').click(ACTION)],
    ['ver «Verificación en dos pasos»', () => mfaTitle(page).waitFor({ timeout: CEILING_MS })],
  ]);
};

/**
 * Lo que la historia da por hecho al llegar: el correo de la cuenta en el texto del segundo paso (sin punto final en la app móvil,
 * `login.tsx:148`) y, si Expo web lo expone, el teclado numérico del código (Regla). Va ANTES de teclear.
 */
const arrivalChecks = async (page: Page): Promise<readonly Check[]> => {
  const hint = `${MFA_HINT_PREFIX} ${DEMO.admin.email}`;
  const shown = await waitUntil(() => exactTextVisible(page, hint));
  const mode = await soleAttr(codeField(page), 'inputmode');
  // «Aún no hay sesión»: el segundo paso sigue en /login
  const onLogin = pathOf(page) === '/login';
  return [
    check(shown.reached, `muestra «${hint}»`, shown.reached ? `muestra «${hint}»` : `no se ve «${hint}»`),
    check(onLogin, 'sin sesión: el segundo paso sigue en /login', onLogin ? 'sin sesión: el segundo paso sigue en /login' : `ruta ${pathOf(page)}`),
    ...(mode === undefined ? [] : [check(mode === 'numeric', '«Código de verificación» abre un teclado numérico (inputmode numeric)', `inputmode ${mode}`)]),
  ];
};

/** Escribe el texto en el campo como una persona (tecla a tecla): el límite de seis dígitos lo aplica el propio campo. */
const typeCode = (page: Page, text: string): Promise<string | undefined> =>
  runSteps([
    ['limpiar «Código de verificación»', () => codeField(page).fill('', ACTION)],
    ...(text === '' ? [] : ([['escribir el código', () => codeField(page).pressSequentially(text, { delay: 0 })]] as const)),
  ]);

const submitCode = async (page: Page, text: string): Promise<string | undefined> =>
  (await typeCode(page, text)) ?? (await runSteps([['pulsar «Verificar»', () => verifyButton(page).click(ACTION)]]));

/** Lo que se ve hoy en «Verificar», leído en el acto (para lo observado). */
const buttonNow = async (page: Page): Promise<string> => {
  if ((await soleCount(verifyButton(page))) !== 1) return '«Verificar» no se localiza de forma única';
  return (await soleDisabled(verifyButton(page))) ? '«Verificar» deshabilitado' : '«Verificar» habilitado';
};

interface ButtonState {
  readonly expected: string;
  readonly holds: (page: Page) => Promise<boolean>;
}

/** «Se ve y no cambia»: el estado debe llegar y mantenerse, y lo observado se lee en ese momento. */
const buttonCheck = async (page: Page, state: ButtonState): Promise<Check> => check(await settles(() => state.holds(page)), state.expected, await buttonNow(page));

const describeContent = (content: string | undefined): string => (content === undefined ? '(no legible)' : content === '' ? '(vacío)' : content);

/** Cada fila añade la salvedad de la plataforma al resultado: el veredicto vale para Expo web. */
const withPlatform = (result: Outcome): Outcome => ({
  ...result,
  note: result.note === undefined ? PLATFORM_NOTE : `${result.note} ${PLATFORM_NOTE}`,
});

// --- Observadores de resultado ----------------------------------------------------------------------------------------------

type Observer = (page: Page, traffic: AuthTraffic) => Promise<readonly Check[]>;

const SUCCESS_RESULT = 'llega a /programs con una sesión abierta';
const WRONG_RESULT = 've «Código incorrecto o caducado» y sigue en la verificación sin sesión';

const observeSuccess: Observer = async (page, traffic) => {
  const arrived = await waitUntil(() => onPrograms(page));
  return [check(arrived.reached, 'llega a /programs con una sesión abierta', arrived.reached ? 'llega a /programs' : `no llega a /programs (ruta ${pathOf(page)})`), await replyCheck(traffic)];
};

const observeWrong: Observer = async (page) => {
  const shown = await waitUntil(async () => linesOf(await soleText(serverAlert(page)))[0] === WRONG_CODE_MESSAGE);
  const message = linesOf(await soleText(serverAlert(page)))[0];
  const stillThere = await waitUntil(() => soleVisible(mfaTitle(page)), 1_000);
  return [
    check(shown.reached, `ve «${WRONG_CODE_MESSAGE}»`, message === undefined ? 'no hay un único aviso de error' : `ve «${message}»`),
    check(stillThere.reached, 'sigue en «Verificación en dos pasos»', stillThere.reached ? 'sigue en «Verificación en dos pasos»' : `ya no ve la verificación (ruta ${pathOf(page)})`),
    await noSessionWindow(page, onLoginForm, onPrograms),
  ];
};

const RESULTS: ReadonlyMap<string, Observer> = new Map<string, Observer>([
  [SUCCESS_RESULT, observeSuccess],
  [WRONG_RESULT, observeWrong],
]);

// --- Esquema 1: el código completa la sesión o muestra un error corregible --------------------------------------------------

const submitAndObserve: BrowserRowHandler = async (row, { page }) => {
  const traffic = trackAuth(page);
  const expected = cell(row, 'resultado');
  const code = strict('codigo', CODES, cell(row, 'codigo'));
  const observe = strict('resultado', RESULTS, expected);
  const prepared = await reachSecondStep(page);
  if (prepared) return preparationFailedWeb(STEP_EXPECTED, prepared);
  const arrival = await arrivalChecks(page);
  const failure = await submitCode(page, code);
  if (failure) return outcome(false, expected, failure, { note: ACTION_NOTE });
  return withPlatform(conclude([...arrival, ...(await observe(page, traffic)), tenantCheck(traffic)], { note: READ_NOTE }));
};

// --- Esquema 2: el código debe tener seis dígitos para enviarse -------------------------------------------------------------

const BUTTON_STATES: ReadonlyMap<string, ButtonState> = new Map<string, ButtonState>([
  ['deshabilitado', { expected: '«Verificar» deshabilitado', holds: (page: Page) => soleDisabled(verifyButton(page)) }],
  ['habilitado', { expected: '«Verificar» habilitado', holds: (page: Page) => soleEnabled(verifyButton(page)) }],
]);

const typing: BrowserRowHandler = async (row, { page }) => {
  const traffic = trackAuth(page);
  const typed = strict('entrada', TYPED, cell(row, 'entrada'));
  const wanted = strict('contenido', CONTENT, cell(row, 'contenido'));
  const state = strict('estado', BUTTON_STATES, cell(row, 'estado'));
  const prepared = await reachSecondStep(page);
  if (prepared) return preparationFailedWeb(STEP_EXPECTED, prepared);
  const arrival = await arrivalChecks(page);
  const failure = await typeCode(page, typed);
  if (failure) return outcome(false, 'se escribe el código', failure, { note: ACTION_NOTE });
  // Lo escrito llega al campo con un pequeño retraso y luego debe quedarse: se espera a lo esperado y se observa un segundo más
  const contentOk = await settles(async () => (await soleValue(codeField(page))) === wanted);
  const content = await soleValue(codeField(page));
  const button = await buttonCheck(page, state);
  return withPlatform(
    conclude([...arrival, check(contentOk, `el campo conserva ${wanted === '' ? '(vacío)' : wanted}`, `el campo conserva ${describeContent(content)}`), button, tenantCheck(traffic)], { note: READ_NOTE }),
  );
};

// --- Esquema 3: tras un código incorrecto se puede corregir y volver a intentar ---------------------------------------------

const correction: BrowserRowHandler = async (row, { page }) => {
  const traffic = trackAuth(page);
  const expected = cell(row, 'resultado');
  const observe = strict('resultado', RESULTS, expected);
  const secondCode = strict('segundo_codigo', CODES, cell(row, 'segundo_codigo'));
  const prepared = await reachSecondStep(page);
  if (prepared) return preparationFailedWeb(STEP_EXPECTED, prepared);
  const arrival = await arrivalChecks(page);
  const first = await submitCode(page, FIRST_WRONG_CODE);
  if (first) return outcome(false, `se envía ${FIRST_WRONG_CODE}`, first, { note: ACTION_NOTE });
  const shown = await waitUntil(async () => linesOf(await soleText(serverAlert(page)))[0] === WRONG_CODE_MESSAGE);
  if (!shown.reached) return preparationFailedWeb(`ve «${WRONG_CODE_MESSAGE}» tras ${FIRST_WRONG_CODE}`, `no se vio el aviso tras enviar ${FIRST_WRONG_CODE}`);
  // Teclear NO borra el aviso de la app móvil (solo lo hace un envío nuevo): por eso se exige que la segunda petición salga y
  // responda ANTES de leer el aviso; si el «Verificar» no hace nada, el aviso de 000000 seguiría ahí y no basta para pasar.
  const repliesBefore = traffic.mfaReplies.length;
  const second = await submitCode(page, secondCode);
  if (second) return outcome(false, expected, second, { note: ACTION_NOTE });
  const answered = await waitUntil(async () => traffic.mfaReplies.length > repliesBefore);
  const sent = sentWithCode(traffic, secondCode);
  const sentCheck = check(
    sent >= 1 && answered.reached,
    `se envía POST /api/auth/mfa con el código ${secondCode} y responde`,
    `${String(sent)} envío(s) con ${secondCode}${answered.reached ? ' y respuesta' : ', sin respuesta'}`,
  );
  return withPlatform(conclude([...arrival, sentCheck, ...(await observe(page, traffic)), tenantCheck(traffic)], { note: READ_NOTE }));
};

// --- Esquema 4: se puede volver al formulario de acceso ---------------------------------------------------------------------

const back: BrowserRowHandler = async (row, { page }) => {
  const traffic = trackAuth(page);
  const typedCode = strict('codigo', TYPED, cell(row, 'codigo'));
  const prepared = await reachSecondStep(page);
  if (prepared) return preparationFailedWeb(STEP_EXPECTED, prepared);
  const arrival = await arrivalChecks(page);
  const typed = await typeCode(page, typedCode);
  if (typed) return outcome(false, 'se escribe el código', typed, { note: ACTION_NOTE });
  const failure = await runSteps([['pulsar «Volver al inicio de sesión»', () => backButton(page).click(ACTION)]]);
  if (failure) return outcome(false, 'vuelve a «Iniciar sesión» sin sesión abierta', failure, { note: ACTION_NOTE });
  // «Volver» muestra otra vez el formulario de correo y contraseña (no solo el encabezado)
  const form = await waitUntil(async () => (await onLoginForm(page)) && (await soleVisible(emailField(page))) && (await soleVisible(passwordField(page))));
  return withPlatform(
    conclude(
      [
        ...arrival,
        check(form.reached, 'vuelve al formulario de correo y contraseña', form.reached ? 'vuelve al formulario de correo y contraseña' : `no vuelve al formulario (ruta ${pathOf(page)})`),
        await noSessionWindow(page, onLoginForm, onPrograms),
        tenantCheck(traffic),
      ],
      { note: READ_NOTE },
    ),
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
