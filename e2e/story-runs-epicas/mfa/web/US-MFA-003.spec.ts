import type { Page } from '@playwright/test';
import { DEMO, TENANT_A, resetTenants } from '../../../story-runs/support/prepare';
import { ACTION, CEILING_MS, attrOf, isDisabled, isEnabled, isVisible, linesOf, noSessionCheck, pathOf, runSteps, textOf, valueOf, waitUntil } from '../../support/browser';
import { cell, check, conclude, preparationFailedWeb, strict, type Check } from '../../support/checks';
import { defineBrowserRows, outcome, type BrowserRowHandler } from '../../support/framework';

// US-MFA-003 — Completar o abandonar la verificación en dos pasos (web, 1440 px). Preparación de cada fila: reinicio del tenant
// alumno01, /login?tenant=alumno01 en un contexto nuevo sin sesión y envío de admin@sigpro.test con su contraseña con el propio
// formulario. Un fallo al llegar al segundo paso es una discrepancia con ese motivo (la historia da ese estado por hecho).

const LOGIN_URL = `/login?tenant=${TENANT_A}`;
const SUCCESS_MESSAGE = 'Sesión iniciada. Redirigiendo a Programas…';
const WRONG_CODE_MESSAGE = 'Código incorrecto o caducado';
const INCOMPLETE_EXPLANATION = 'Introduce los 6 dígitos del código';

const loginHeading = (page: Page) => page.getByRole('heading', { name: 'Iniciar sesión', exact: true });
const mfaHeading = (page: Page) => page.getByRole('heading', { name: 'Verificación en dos pasos', exact: true });
const programsHeading = (page: Page) => page.getByRole('heading', { name: 'Programas', exact: true }).or(page.getByRole('banner').getByText('Programas', { exact: true }));
const emailField = (page: Page) => page.getByLabel('Correo electrónico', { exact: true });
const passwordField = (page: Page) => page.getByLabel('Contraseña', { exact: true });
const enterButton = (page: Page) => page.getByRole('button', { name: 'Entrar', exact: true });
const codeField = (page: Page) => page.getByLabel('Código de verificación', { exact: true });
const verifyButton = (page: Page) => page.getByRole('button', { name: 'Verificar', exact: true });
const backButton = (page: Page) => page.getByRole('button', { name: 'Volver al inicio de sesión', exact: true });
const alertOf = (page: Page) => page.getByRole('alert');
const successOverlay = (page: Page) => page.getByRole('status').filter({ hasText: SUCCESS_MESSAGE });

const onLoginForm = async (page: Page): Promise<boolean> => pathOf(page) === '/login' && (await isVisible(loginHeading(page)));
const onPrograms = async (page: Page): Promise<boolean> => pathOf(page) === '/programs' && (await isVisible(programsHeading(page)));

/** Llega al segundo paso como lo haría una persona: reinicio, formulario de acceso y envío; devuelve por qué no llegó, si no llegó. */
const reachSecondStep = async (page: Page): Promise<string | undefined> => {
  await resetTenants([TENANT_A]);
  const failure = await runSteps([
    [`abrir ${LOGIN_URL}`, () => page.goto(LOGIN_URL, { timeout: CEILING_MS })],
    ['ver el título «Iniciar sesión»', () => loginHeading(page).waitFor({ timeout: CEILING_MS })],
    ['escribir el correo', () => emailField(page).fill(DEMO.admin.email, ACTION)],
    ['escribir la contraseña', () => passwordField(page).fill(DEMO.admin.password, ACTION)],
    ['pulsar «Entrar»', () => enterButton(page).click(ACTION)],
    ['ver el título «Verificación en dos pasos»', () => mfaHeading(page).waitFor({ timeout: CEILING_MS })],
  ]);
  return failure;
};

const STEP_EXPECTED = 'una persona sin sesión llega a «Verificación en dos pasos» para admin@sigpro.test';

/** Escribe el código en el campo como una persona (tecla a tecla): el límite de seis dígitos lo aplica el propio campo. */
const typeCode = (page: Page, code: string): Promise<string | undefined> =>
  runSteps([
    ['limpiar «Código de verificación»', () => codeField(page).fill('', ACTION)],
    ...(code === '' ? [] : ([['escribir el código', () => codeField(page).pressSequentially(code, { delay: 0 })]] as const)),
  ]);

/** Lo que el código dado debe producir al pulsar «Verificar». */
const SUCCESS_RESULT = '«Sesión iniciada. Redirigiendo a Programas…» y después /programs';
const WRONG_RESULT = '«Código incorrecto o caducado» y sigue sin sesión en la verificación';

const observeSuccess = async (page: Page): Promise<readonly Check[]> => {
  const overlay = await waitUntil(() => isVisible(successOverlay(page)));
  const message = linesOf(await textOf(successOverlay(page)))[0];
  const arrived = await waitUntil(() => onPrograms(page));
  return [
    check(overlay.reached && message === SUCCESS_MESSAGE, `ve «${SUCCESS_MESSAGE}»`, overlay.reached ? `ve «${message ?? ''}»` : 'no aparece la pantalla de transición'),
    check(arrived.reached, 'llega a /programs', arrived.reached ? 'llega a /programs' : `no llega a /programs (ruta ${pathOf(page)})`),
  ];
};

const observeWrong = async (page: Page): Promise<readonly Check[]> => {
  const shown = await waitUntil(async () => linesOf(await textOf(alertOf(page)))[0] === WRONG_CODE_MESSAGE);
  const message = linesOf(await textOf(alertOf(page)))[0];
  const stillThere = await isVisible(mfaHeading(page));
  return [
    check(shown.reached, `ve «${WRONG_CODE_MESSAGE}»`, message === undefined ? 'no ve ningún aviso' : `ve «${message}»`),
    check(stillThere, 'sigue en «Verificación en dos pasos»', stillThere ? 'sigue en «Verificación en dos pasos»' : `ya no ve la verificación (ruta ${pathOf(page)})`),
    await noSessionCheck(page, onLoginForm, onPrograms),
  ];
};

const RESULTS: ReadonlyMap<string, (page: Page) => Promise<readonly Check[]>> = new Map([
  [SUCCESS_RESULT, observeSuccess],
  [WRONG_RESULT, observeWrong],
]);

const submitCode = async (page: Page, code: string): Promise<string | undefined> =>
  (await typeCode(page, code)) ?? (await runSteps([['pulsar «Verificar»', () => verifyButton(page).click(ACTION)]]));

// --- Esquema 1: un código válido inicia sesión y uno inválido permite corregirlo -------------------------------------------

const submitAndObserve: BrowserRowHandler = async (row, { page }) => {
  const expected = cell(row, 'resultado');
  const prepared = await reachSecondStep(page);
  if (prepared) return preparationFailedWeb(STEP_EXPECTED, prepared);
  const failure = await submitCode(page, cell(row, 'codigo'));
  if (failure) return outcome(false, expected, failure, { note: 'La historia nombra un elemento que la pantalla no ofrece.' });
  return conclude(await strict('resultado', RESULTS, expected)(page));
};

// --- Esquema 2: solo se envía un código de seis dígitos ---------------------------------------------------------------------

/** Un texto tal cual, o `(vacío)` como cadena vacía; cualquier otro paréntesis lanza. */
const plain = (text: string): string => {
  if (text === '(vacío)') return '';
  if (text.startsWith('(')) throw new Error(`celda sin interpretación: «${text}»`);
  return text;
};

const BUTTON_STATES: ReadonlyMap<string, (page: Page) => Promise<readonly Check[]>> = new Map<string, (page: Page) => Promise<readonly Check[]>>([
  [
    'deshabilitado con la explicación «Introduce los 6 dígitos del código»',
    async (page) => {
      const disabled = await isDisabled(verifyButton(page));
      const title = await attrOf(verifyButton(page), 'title');
      return [
        check(disabled, '«Verificar» deshabilitado', disabled ? '«Verificar» deshabilitado' : '«Verificar» habilitado'),
        check(title === INCOMPLETE_EXPLANATION, `explica «${INCOMPLETE_EXPLANATION}»`, title === undefined ? 'sin explicación' : `explica «${title}»`),
      ];
    },
  ],
  ['habilitado', async (page) => [check(await isEnabled(verifyButton(page)), '«Verificar» habilitado', (await isEnabled(verifyButton(page))) ? '«Verificar» habilitado' : '«Verificar» deshabilitado')]],
]);

const typing: BrowserRowHandler = async (row, { page }) => {
  const prepared = await reachSecondStep(page);
  if (prepared) return preparationFailedWeb(STEP_EXPECTED, prepared);
  const failure = await typeCode(page, plain(cell(row, 'entrada')));
  if (failure) return outcome(false, 'se escribe el código', failure, { note: 'La historia nombra un elemento que la pantalla no ofrece.' });
  const content = await valueOf(codeField(page));
  const wanted = plain(cell(row, 'contenido'));
  return conclude([
    check(content === wanted, `el campo contiene ${wanted === '' ? '(vacío)' : wanted}`, `el campo contiene ${content === undefined ? '(no legible)' : content === '' ? '(vacío)' : content}`),
    ...(await strict('estado', BUTTON_STATES, cell(row, 'estado'))(page)),
  ]);
};

// --- Esquema 3: tras un código incorrecto se puede corregir y volver a intentar ---------------------------------------------

const correction: BrowserRowHandler = async (row, { page }) => {
  const expected = cell(row, 'resultado');
  const prepared = await reachSecondStep(page);
  if (prepared) return preparationFailedWeb(STEP_EXPECTED, prepared);
  const first = await submitCode(page, '000000');
  if (first) return outcome(false, 'se envía 000000', first, { note: 'La historia nombra un elemento que la pantalla no ofrece.' });
  const shown = await waitUntil(async () => linesOf(await textOf(alertOf(page)))[0] === WRONG_CODE_MESSAGE);
  if (!shown.reached) return preparationFailedWeb('ve «Código incorrecto o caducado» tras 000000', 'no se vio el aviso tras enviar 000000');
  const second = await submitCode(page, cell(row, 'segundo_codigo'));
  if (second) return outcome(false, expected, second, { note: 'La historia nombra un elemento que la pantalla no ofrece.' });
  return conclude(await strict('resultado', RESULTS, expected)(page));
};

// --- Esquema 4: se puede abandonar el segundo paso --------------------------------------------------------------------------

const LEAVE: ReadonlyMap<string, (page: Page) => Promise<unknown>> = new Map<string, (page: Page) => Promise<unknown>>([
  ['«Volver al inicio de sesión»', (page) => backButton(page).click(ACTION)],
  ['la tecla Escape', (page) => page.keyboard.press('Escape')],
]);

const leave: BrowserRowHandler = async (row, { page }) => {
  const prepared = await reachSecondStep(page);
  if (prepared) return preparationFailedWeb(STEP_EXPECTED, prepared);
  const act = strict('accion', LEAVE, cell(row, 'accion'));
  const failure = await runSteps([['abandonar el segundo paso', () => act(page)]]);
  if (failure) return outcome(false, 'vuelve a «Iniciar sesión» sin sesión abierta', failure, { note: 'La historia nombra un elemento que la pantalla no ofrece.' });
  const back = await waitUntil(() => onLoginForm(page));
  return conclude([
    check(back.reached, 'vuelve a «Iniciar sesión»', back.reached ? 'vuelve a «Iniciar sesión»' : `no vuelve al formulario (ruta ${pathOf(page)})`),
    await noSessionCheck(page, onLoginForm, onPrograms),
  ]);
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
