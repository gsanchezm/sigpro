import type { Page } from '@playwright/test';
import { DEMO, TENANT_A, resetTenants } from '../../../story-runs/support/prepare';
import { ACTION, CEILING_MS, isVisible, linesOf, pathOf, runSteps, waitUntil } from '../../support/browser';
import { cell, check, conclude, preparationFailedWeb, strict, type Check } from '../../support/checks';
import { defineBrowserRows, outcome, type BrowserRowHandler } from '../../support/framework';
import {
  ACTION_NOTE,
  CODES,
  CONTENT,
  INCOMPLETE_EXPLANATION,
  MFA_HINT_PREFIX,
  READ_NOTE,
  TYPED,
  WRONG_CODE_MESSAGE,
  exactTextVisible,
  noSessionWindow,
  replyCheck,
  settles,
  soleAttr,
  soleCount,
  soleDisabled,
  soleEnabled,
  soleFocused,
  soleText,
  soleValue,
  soleVisible,
  tenantCheck,
  trackAuth,
  type AuthTraffic,
} from './common';

// US-MFA-003 — Completar o abandonar la verificación en dos pasos (web, 1440 px). Preparación de cada fila: reinicio del tenant
// alumno01, /login?tenant=alumno01 en un contexto nuevo sin sesión y envío de admin@sigpro.test con su contraseña con el propio
// formulario. Un fallo al llegar al segundo paso es una discrepancia con ese motivo (la historia da ese estado por hecho).
// Comprobaciones de cada fila: el correo de la cuenta y el foco en «Código de verificación» (Dado y Regla), el tenant de cada
// petición de acceso (x-tenant) y, en las filas de éxito, el usuario de la respuesta de /api/auth/mfa.

const LOGIN_URL = `/login?tenant=${TENANT_A}`;
const SUCCESS_MESSAGE = 'Sesión iniciada. Redirigiendo a Programas…';
const FIRST_WRONG_CODE = '000000';
const STEP_EXPECTED = 'una persona sin sesión llega a «Verificación en dos pasos» para admin@sigpro.test';

const loginHeading = (page: Page) => page.getByRole('heading', { name: 'Iniciar sesión', exact: true });
const mfaHeading = (page: Page) => page.getByRole('heading', { name: 'Verificación en dos pasos', exact: true });
// `.first()` a propósito (isVisible): el `.or` casa el encabezado «Programas» y el texto de la cabecera a la vez; basta con que uno se vea
const programsHeading = (page: Page) => page.getByRole('heading', { name: 'Programas', exact: true }).or(page.getByRole('banner').getByText('Programas', { exact: true }));
const emailField = (page: Page) => page.getByLabel('Correo electrónico', { exact: true });
const passwordField = (page: Page) => page.getByLabel('Contraseña', { exact: true });
const enterButton = (page: Page) => page.getByRole('button', { name: 'Entrar', exact: true });
const codeField = (page: Page) => page.getByLabel('Código de verificación', { exact: true });
const verifyButton = (page: Page) => page.getByRole('button', { name: 'Verificar', exact: true });
const backButton = (page: Page) => page.getByRole('button', { name: 'Volver al inicio de sesión', exact: true });
const alertOf = (page: Page) => page.getByRole('alert');
const successOverlay = (page: Page) => page.getByRole('status').filter({ hasText: SUCCESS_MESSAGE });

const onLoginForm = async (page: Page): Promise<boolean> => pathOf(page) === '/login' && (await soleVisible(loginHeading(page)));
const onPrograms = async (page: Page): Promise<boolean> => pathOf(page) === '/programs' && (await isVisible(programsHeading(page)));

/** Llega al segundo paso como lo haría una persona: reinicio, formulario de acceso y envío; devuelve por qué no llegó, si no llegó. */
const reachSecondStep = async (page: Page): Promise<string | undefined> => {
  await resetTenants([TENANT_A]);
  return runSteps([
    [`abrir ${LOGIN_URL}`, () => page.goto(LOGIN_URL, { timeout: CEILING_MS })],
    ['ver el título «Iniciar sesión»', () => loginHeading(page).waitFor({ timeout: CEILING_MS })],
    ['escribir el correo', () => emailField(page).fill(DEMO.admin.email, ACTION)],
    ['escribir la contraseña', () => passwordField(page).fill(DEMO.admin.password, ACTION)],
    ['pulsar «Entrar»', () => enterButton(page).click(ACTION)],
    ['ver el título «Verificación en dos pasos»', () => mfaHeading(page).waitFor({ timeout: CEILING_MS })],
  ]);
};

/** Lo que la historia da por hecho al llegar (Dado y Regla): el correo de la cuenta en el texto y el foco en el código. Va ANTES de teclear. */
const arrivalChecks = async (page: Page): Promise<readonly Check[]> => {
  const hint = `${MFA_HINT_PREFIX} ${DEMO.admin.email}.`;
  const shown = await waitUntil(() => exactTextVisible(page, hint));
  const focused = await waitUntil(() => soleFocused(codeField(page)));
  // «Antes de verificar no hay sesión»: la verificación sigue en /login, sin redirección a /programs
  const onLogin = pathOf(page) === '/login';
  return [
    check(shown.reached, `muestra «${hint}»`, shown.reached ? `muestra «${hint}»` : `no se ve «${hint}»`),
    check(focused.reached, '«Código de verificación» recibe el foco', focused.reached ? '«Código de verificación» tiene el foco' : '«Código de verificación» no tiene el foco'),
    check(onLogin, 'sin sesión: la verificación sigue en /login', onLogin ? 'sin sesión: la verificación sigue en /login' : `ruta ${pathOf(page)}`),
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
  if (!(await soleDisabled(verifyButton(page)))) return '«Verificar» habilitado';
  const title = await soleAttr(verifyButton(page), 'title');
  return title === undefined ? '«Verificar» deshabilitado sin explicación' : `«Verificar» deshabilitado con la explicación «${title}»`;
};

/** Un estado del botón: lo que se espera (para lo esperado) y cómo se comprueba que se da. */
interface ButtonState {
  readonly expected: string;
  readonly holds: (page: Page) => Promise<boolean>;
}

/** «Se ve y no cambia»: el estado debe llegar y mantenerse, y lo observado se lee en ese momento. */
const buttonCheck = async (page: Page, state: ButtonState): Promise<Check> => check(await settles(() => state.holds(page)), state.expected, await buttonNow(page));

// --- Observadores de resultado (cada uno lee lo que la historia pide tras pulsar «Verificar») ----------------------------------

type Observer = (page: Page, traffic: AuthTraffic) => Promise<readonly Check[]>;

const SUCCESS_RESULT = '«Sesión iniciada. Redirigiendo a Programas…» y después /programs';
const WRONG_RESULT = '«Código incorrecto o caducado» y sigue sin sesión en la verificación';

const observeSuccess: Observer = async (page, traffic) => {
  const overlay = await waitUntil(() => soleVisible(successOverlay(page)));
  const message = linesOf(await soleText(successOverlay(page)))[0];
  const arrived = await waitUntil(() => onPrograms(page));
  return [
    check(overlay.reached && message === SUCCESS_MESSAGE, `ve «${SUCCESS_MESSAGE}»`, overlay.reached ? `ve «${message ?? ''}»` : 'no aparece la pantalla de transición'),
    check(arrived.reached, 'llega a /programs', arrived.reached ? 'llega a /programs' : `no llega a /programs (ruta ${pathOf(page)})`),
    await replyCheck(traffic),
  ];
};

const observeWrong: Observer = async (page) => {
  const shown = await waitUntil(async () => linesOf(await soleText(alertOf(page)))[0] === WRONG_CODE_MESSAGE);
  const message = linesOf(await soleText(alertOf(page)))[0];
  const stillThere = await soleVisible(mfaHeading(page));
  return [
    check(shown.reached, `ve «${WRONG_CODE_MESSAGE}»`, message === undefined ? 'no hay un único aviso de error' : `ve «${message}»`),
    check(stillThere, 'sigue en «Verificación en dos pasos»', stillThere ? 'sigue en «Verificación en dos pasos»' : `ya no ve la verificación (ruta ${pathOf(page)})`),
    await noSessionWindow(page, onLoginForm, onPrograms),
  ];
};

const RESULTS: ReadonlyMap<string, Observer> = new Map<string, Observer>([
  [SUCCESS_RESULT, observeSuccess],
  [WRONG_RESULT, observeWrong],
]);

// --- Esquema 1: un código válido inicia sesión y uno inválido permite corregirlo -------------------------------------------

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
  return conclude([...arrival, ...(await observe(page, traffic)), tenantCheck(traffic)], { note: READ_NOTE });
};

// --- Esquema 2: solo se envía un código de seis dígitos ---------------------------------------------------------------------

const BUTTON_STATES: ReadonlyMap<string, ButtonState> = new Map<string, ButtonState>([
  [
    'deshabilitado con la explicación «Introduce los 6 dígitos del código»',
    {
      expected: `«Verificar» deshabilitado con la explicación «${INCOMPLETE_EXPLANATION}»`,
      holds: async (page: Page) => (await soleDisabled(verifyButton(page))) && (await soleAttr(verifyButton(page), 'title')) === INCOMPLETE_EXPLANATION,
    },
  ],
  ['habilitado', { expected: '«Verificar» habilitado', holds: (page: Page) => soleEnabled(verifyButton(page)) }],
]);

const describeContent = (content: string | undefined): string => (content === undefined ? '(no legible)' : content === '' ? '(vacío)' : content);

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
  return conclude([...arrival, check(contentOk, `el campo contiene ${wanted === '' ? '(vacío)' : wanted}`, `el campo contiene ${describeContent(content)}`), button, tenantCheck(traffic)], { note: READ_NOTE });
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
  const shown = await waitUntil(async () => linesOf(await soleText(alertOf(page)))[0] === WRONG_CODE_MESSAGE);
  if (!shown.reached) return preparationFailedWeb(`ve «${WRONG_CODE_MESSAGE}» tras ${FIRST_WRONG_CODE}`, `no se vio el aviso tras enviar ${FIRST_WRONG_CODE}`);
  const second = await submitCode(page, secondCode);
  if (second) return outcome(false, expected, second, { note: ACTION_NOTE });
  return conclude([...arrival, ...(await observe(page, traffic)), tenantCheck(traffic)], { note: READ_NOTE });
};

// --- Esquema 4: se puede abandonar el segundo paso --------------------------------------------------------------------------

const LEAVE: ReadonlyMap<string, (page: Page) => Promise<unknown>> = new Map<string, (page: Page) => Promise<unknown>>([
  ['«Volver al inicio de sesión»', (page: Page) => backButton(page).click(ACTION)],
  ['la tecla Escape', (page: Page) => page.keyboard.press('Escape')],
]);

const leave: BrowserRowHandler = async (row, { page }) => {
  const traffic = trackAuth(page);
  const act = strict('accion', LEAVE, cell(row, 'accion'));
  const prepared = await reachSecondStep(page);
  if (prepared) return preparationFailedWeb(STEP_EXPECTED, prepared);
  const arrival = await arrivalChecks(page);
  const failure = await runSteps([['abandonar el segundo paso', () => act(page)]]);
  if (failure) return outcome(false, 'vuelve a «Iniciar sesión» sin sesión abierta', failure, { note: ACTION_NOTE });
  const back = await waitUntil(() => onLoginForm(page));
  return conclude(
    [
      ...arrival,
      check(back.reached, 'vuelve a «Iniciar sesión»', back.reached ? 'vuelve a «Iniciar sesión»' : `no vuelve al formulario (ruta ${pathOf(page)})`),
      await noSessionWindow(page, onLoginForm, onPrograms),
      tenantCheck(traffic),
    ],
    { note: READ_NOTE },
  );
};

defineBrowserRows({
  story: 'US-MFA-003',
  surface: 'web',
  tenants: [TENANT_A],
  handlers: new Map<number, BrowserRowHandler>([
    [1, submitAndObserve],
    [2, typing],
    [3, correction],
    [4, leave],
  ]),
});
