import type { Page } from '@playwright/test';
import { TENANT_A, resetTenants } from '../../../story-runs/support/prepare';
import { ACTION, noSessionCheck, pathOf, waitUntil, type Step } from '../../support/browser';
import { cell, check, conclude, sleep, strict } from '../../support/checks';
import { defineBrowserRows, type BrowserRowHandler } from '../../core/framework';
import {
  BAD_EMAIL,
  FORGOT_URL,
  LOCAL_MS,
  OBSERVE_MS,
  REQUIRED,
  actionMissing,
  backButton,
  boxOf,
  effectiveType,
  emailField,
  fieldError,
  fieldValue,
  forgotLink,
  isBelow,
  messageOf,
  onForgot,
  onLoginForm,
  onPrograms,
  openForgot,
  openLogin,
  preparationMissedWeb,
  runStepsLogged,
  screenChecksWeb,
  sentNotice,
  signInFromLogin,
  submitButton,
  typedNote,
  visibilityOf,
  watchForgot,
} from './common';

// US-RECUPERAR-004 — Pantalla «Recuperar contraseña» en la web (/forgot, 1440 px): correo del acceso, validación y salidas. Preparación de
// cada fila: reinicio de alumno01 con el token de su administrador y navegador sin sesión (contexto nuevo). El Esquema 5 inicia la sesión
// en la propia pantalla de acceso antes de abrir /forgot. El Esquema 1 comprueba también las reglas de la pantalla (título, texto, orden de
// campo y botones, sin contraseña ni «Mantener la sesión») al llegar a ella.

/** Valores que la pantalla muestra en «Correo electrónico» en las filas de esta historia. */
const SHOWN: ReadonlyMap<string, string> = new Map<string, string>([
  ['gestor@sigpro.test', 'gestor@sigpro.test'],
  ['(vacío)', ''],
]);

// --- Esquema 1: el correo escrito en el acceso llega a la pantalla de recuperación --------------------------------------------

const fromLogin: BrowserRowHandler = async (row, { page }) => {
  await resetTenants([TENANT_A]);
  const typed = strict('correo_acceso', SHOWN, cell(row, 'correo_acceso'));
  const wanted = strict('correo_recuperacion', SHOWN, cell(row, 'correo_recuperacion'));
  const expected = `llega a /forgot con las reglas de la pantalla y ve en «Correo electrónico» ${cell(row, 'correo_recuperacion')}`;
  const opened = await openLogin(page);
  if (opened) return preparationMissedWeb(expected, opened);
  const steps: Step[] = [];
  if (typed !== '') steps.push(['escribir «Correo electrónico»', () => emailField(page).fill(typed, ACTION)]);
  steps.push(['pulsar «¿Olvidaste la contraseña?»', () => forgotLink(page).click(ACTION)]);
  const failure = await runStepsLogged(steps);
  if (failure) return actionMissing(expected, failure);
  const arrived = await waitUntil(() => onForgot(page));
  const value = await fieldValue(emailField(page));
  const screen = await screenChecksWeb(page);
  return conclude([
    check(arrived.reached, 'llega a /forgot', arrived.reached ? 'llega a /forgot' : `no llega a /forgot (ruta ${pathOf(page)})`),
    check(value === wanted, `ve en «Correo electrónico» ${cell(row, 'correo_recuperacion')}`, `ve en «Correo electrónico» ${value === undefined ? '(no legible)' : value === '' ? '(vacío)' : value}`),
    ...screen,
  ]);
};

// --- Esquema 2: un correo no válido se avisa antes de enviar -----------------------------------------------------------------

/** Lo que se escribe en el campo; «(vacío)» y «(tres espacios)» se escriben tal cual. */
const VALIDATION: ReadonlyMap<string, string> = new Map<string, string>([
  ['(vacío)', ''],
  ['(tres espacios)', '   '],
  ['no-es-un-correo', 'no-es-un-correo'],
  ['ana@sigpro', 'ana@sigpro'],
  ['@sigpro.test', '@sigpro.test'],
  ['a@b', 'a@b'],
]);

const AVISOS: ReadonlyMap<string, string> = new Map<string, string>([
  ['«Campo obligatorio»', REQUIRED],
  ['«Introduce un correo válido»', BAD_EMAIL],
]);

const invalidEmail: BrowserRowHandler = async (row, { page }) => {
  await resetTenants([TENANT_A]);
  const typed = strict('correo', VALIDATION, cell(row, 'correo'));
  const aviso = strict('aviso', AVISOS, cell(row, 'aviso'));
  const expected = `ve bajo el campo «Correo electrónico» el aviso «${aviso}»; no ve el aviso de éxito; no se envía ninguna petición a POST /api/auth/forgot`;
  const opened = await openForgot(page);
  if (opened) return preparationMissedWeb(expected, opened);
  const watch = watchForgot(page);
  const failure = await runStepsLogged([
    ['escribir «Correo electrónico»', () => emailField(page).fill(typed, ACTION)],
    ['pulsar «Enviar enlace»', () => submitButton(page).click(ACTION)],
  ]);
  if (failure) return actionMissing(expected, failure);
  const shown = await waitUntil(async () => (await messageOf(fieldError(page))) === aviso, LOCAL_MS);
  const error = await messageOf(fieldError(page));
  const below = isBelow(await boxOf(fieldError(page)), await boxOf(emailField(page)));
  const evidence = { tipoDelCampo: await effectiveType(emailField(page)), valorDelCampo: await fieldValue(emailField(page)) };
  // Ventana única: lo que NO debe ocurrir se observa durante el mismo intervalo
  await sleep(OBSERVE_MS);
  const notice = await visibilityOf(sentNotice(page));
  const sent = watch.count();
  return conclude(
    [
      check(shown.reached, `ve bajo el campo «Correo electrónico» el aviso «${aviso}»`, error === undefined ? 'no ve ningún aviso bajo el campo' : `ve «${error}»`),
      check(below, 'el aviso está bajo el campo', below ? 'el aviso está bajo el campo' : 'el aviso no está bajo el campo'),
      check(notice === 'hidden', 'no ve el aviso de éxito', notice === 'visible' ? 've el aviso de éxito' : `lectura del aviso de éxito: ${notice}`),
      check(sent === 0, 'no se envía ninguna petición a POST /api/auth/forgot', `peticiones enviadas: ${sent}`),
    ],
    { ...typedNote(typed), evidence },
  );
};

// --- Esquema 3: el aviso de validación desaparece al escribir en el campo ----------------------------------------------------

const TYPED_LATER: ReadonlyMap<string, string> = new Map<string, string>([['gestor@sigpro.test', 'gestor@sigpro.test']]);

const clearsOnType: BrowserRowHandler = async (row, { page }) => {
  await resetTenants([TENANT_A]);
  const typed = strict('correo', TYPED_LATER, cell(row, 'correo'));
  const expected = `deja de ver el aviso «${REQUIRED}» al escribir ${cell(row, 'correo')}`;
  const opened = await openForgot(page);
  if (opened) return preparationMissedWeb(expected, opened);
  const pressed = await runStepsLogged([['pulsar «Enviar enlace» con el campo vacío', () => submitButton(page).click(ACTION)]]);
  if (pressed) return preparationMissedWeb(expected, pressed);
  const required = await waitUntil(async () => (await messageOf(fieldError(page))) === REQUIRED, LOCAL_MS);
  if (!required.reached) return preparationMissedWeb(expected, `no se vio «${REQUIRED}» tras pulsar «Enviar enlace» con el campo vacío`);
  const failure = await runStepsLogged([['escribir «Correo electrónico»', () => emailField(page).fill(typed, ACTION)]]);
  if (failure) return actionMissing(expected, failure);
  const gone = await waitUntil(async () => (await visibilityOf(fieldError(page))) === 'hidden', LOCAL_MS);
  return conclude([check(gone.reached, `deja de ver el aviso «${REQUIRED}»`, gone.reached ? `ya no ve «${REQUIRED}»` : 'sigue viendo el aviso de error')]);
};

// --- Esquema 4: volver al inicio de sesión lleva a /login sin sesión iniciada ------------------------------------------------

const LEAVE: ReadonlyMap<string, (page: Page) => Promise<unknown>> = new Map<string, (page: Page) => Promise<unknown>>([
  ['pulsa «Volver al inicio de sesión»', (page) => backButton(page).click(ACTION)],
  ['pulsa la tecla Esc', (page) => page.keyboard.press('Escape')],
]);

const leave: BrowserRowHandler = async (row, { page }) => {
  await resetTenants([TENANT_A]);
  const act = strict('salida', LEAVE, cell(row, 'salida'));
  const expected = 'llega a /login sin sesión iniciada y ve en «Correo electrónico» gestor@sigpro.test';
  const opened = await openForgot(page);
  if (opened) return preparationMissedWeb(expected, opened);
  const typed = await runStepsLogged([['escribir «Correo electrónico»', () => emailField(page).fill('gestor@sigpro.test', ACTION)]]);
  if (typed) return preparationMissedWeb(expected, typed);
  const failure = await runStepsLogged([['salir de /forgot', () => act(page)]]);
  if (failure) return actionMissing(expected, failure);
  const back = await waitUntil(() => onLoginForm(page));
  // Se lee el correo ANTES de la comprobación de sesión: esa comprobación navega y recarga la página
  const value = await fieldValue(emailField(page));
  return conclude([
    check(back.reached, 'llega a /login', back.reached ? 'llega a /login' : `no llega a /login (ruta ${pathOf(page)})`),
    check(value === 'gestor@sigpro.test', 've en «Correo electrónico» gestor@sigpro.test', `ve en «Correo electrónico» ${value ?? '(no legible)'}`),
    await noSessionCheck(page, onLoginForm, onPrograms),
  ]);
};

// --- Esquema 5: con sesión iniciada, /forgot lleva a Programas --------------------------------------------------------------

const SESSION_ACCOUNTS: ReadonlyMap<string, string> = new Map<string, string>([
  ['gestor@sigpro.test', 'gestor@sigpro.test'],
  ['consultor@sigpro.test', 'consultor@sigpro.test'],
]);

const SESSION_PASSWORDS: ReadonlyMap<string, string> = new Map<string, string>([
  ['Gestor1234!', 'Gestor1234!'],
  ['Consul1234!', 'Consul1234!'],
]);

const withSession: BrowserRowHandler = async (row, { page }) => {
  await resetTenants([TENANT_A]);
  const account = strict('cuenta', SESSION_ACCOUNTS, cell(row, 'cuenta'));
  const password = strict('contraseña', SESSION_PASSWORDS, cell(row, 'contraseña'));
  const expected = `llega a /programs (sesión iniciada como ${account})`;
  // La sesión se inicia en la propia pantalla de acceso, con la cuenta y la contraseña de la fila
  const signed = await signInFromLogin(page, account, password);
  if (signed) return preparationMissedWeb(expected, signed);
  const opened = await runStepsLogged([['abrir /forgot?tenant=alumno01', () => page.goto(FORGOT_URL, ACTION)]]);
  if (opened) return actionMissing(expected, opened);
  const arrived = await waitUntil(() => onPrograms(page));
  return conclude([check(arrived.reached, 'llega a /programs', arrived.reached ? 'llega a /programs' : `no llega a /programs (ruta ${pathOf(page)})`)]);
};

defineBrowserRows({
  story: 'US-RECUPERAR-004',
  surface: 'web',
  tenants: [TENANT_A],
  handlers: new Map<number, BrowserRowHandler>([
    [1, fromLogin],
    [2, invalidEmail],
    [3, clearsOnType],
    [4, leave],
    [5, withSession],
  ]),
});
