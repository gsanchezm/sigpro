import type { Page } from '@playwright/test';
import { TENANT_A, resetTenants } from '../../../story-runs/support/prepare';
import { ACTION, noSessionCheck, pathOf, waitUntil } from '../../support/browser';
import { cell, check, conclude, sleep, strict } from '../../support/checks';
import { defineBrowserRows, type BrowserRowHandler } from '../../core/framework';
import {
  BAD_EMAIL,
  LOCAL_MS,
  OBSERVE_MS,
  REQUIRED,
  actionMissing,
  boxOf,
  effectiveType,
  fieldValue,
  isBelow,
  messageOf,
  preparationMissedWeb,
  runStepsLogged,
  visibilityOf,
  watchForgot,
} from '../web/common';
import {
  BACK_NOTE,
  DIRECT_NOTE,
  backButton,
  emailBox,
  fieldError,
  forgotLink,
  onExpoWeb,
  onForgot,
  onLoginForm,
  onPrograms,
  openForgotDirect,
  openLoginWithTenant,
  screenChecksMobile,
  sendButton,
  sentNotice,
  signInMobile,
  typedMobileNote,
} from './common';

// US-RECUPERAR-006 — Pantalla «Recuperar contraseña» en la app móvil (servida como web de Expo a 390 px; NO es nativo): correo del acceso,
// validación y salidas. Preparación de cada fila: reinicio de alumno01 con el token de su administrador, la app en /login (o en /forgot)
// sin sesión guardada y «alumno01» en «Tenant de trabajo» cuando la historia lo dice. El Esquema 1 comprueba también las reglas de la
// pantalla al llegar a ella (título, texto, orden de campo y botones, placeholder con el campo vacío, sin contraseña ni «Mantener la sesión»).

// --- Esquema 1: el correo escrito en el acceso llega a la pantalla de recuperación ------------------------------------------

const ACCESS_EMAILS: ReadonlyMap<string, string> = new Map<string, string>([
  ['gestor@sigpro.test', 'gestor@sigpro.test'],
  // Espacios delante y detrás en el acceso: el campo puede recortarlos antes que la app (ver la nota de la fila)
  ['(GESTOR@sigpro.test con un espacio delante y otro detrás)', ' GESTOR@sigpro.test '],
  ['(vacío)', ''],
]);

const RECOVERY_EMAILS: ReadonlyMap<string, string> = new Map<string, string>([
  ['gestor@sigpro.test', 'gestor@sigpro.test'],
  ['GESTOR@sigpro.test', 'GESTOR@sigpro.test'],
  ['(vacío)', ''],
]);

const fromLogin: BrowserRowHandler = async (row, { page }) => {
  await resetTenants([TENANT_A]);
  const typed = strict('correo_acceso', ACCESS_EMAILS, cell(row, 'correo_acceso'));
  const wanted = strict('correo_recuperacion', RECOVERY_EMAILS, cell(row, 'correo_recuperacion'));
  const expected = `llega a /forgot con las reglas de la pantalla y ve en «Correo electrónico» ${cell(row, 'correo_recuperacion')}`;
  const opened = await openLoginWithTenant(page);
  if (opened) return preparationMissedWeb(expected, opened);
  if (typed !== '') {
    const written = await runStepsLogged([['escribir «Correo electrónico» en el acceso', () => emailBox(page).fill(typed, ACTION)]]);
    if (written) return preparationMissedWeb(expected, written);
  }
  // Se lee el campo del acceso tras escribir: es lo que el navegador entrega a la app (ver la nota si hay espacios)
  const accessType = await effectiveType(emailBox(page));
  const accessValue = await fieldValue(emailBox(page));
  const clicked = await runStepsLogged([['pulsar «¿Olvidaste la contraseña?»', () => forgotLink(page).click(ACTION)]]);
  if (clicked) return actionMissing(expected, clicked);
  const arrived = await waitUntil(() => onForgot(page));
  const value = await fieldValue(emailBox(page));
  const screen = await screenChecksMobile(page, value === '');
  return conclude(
    [
      check(arrived.reached, 'llega a /forgot', arrived.reached ? 'llega a /forgot' : `no llega a /forgot (ruta ${pathOf(page)})`),
      check(value === wanted, `ve en «Correo electrónico» ${cell(row, 'correo_recuperacion')}`, `ve en «Correo electrónico» ${value === undefined ? '(no legible)' : value === '' ? '(vacío)' : value}`),
      ...screen,
    ],
    { ...typedMobileNote(typed), evidence: { tipoDelCampoDeAcceso: accessType, valorDelCampoDeAccesoTrasEscribir: accessValue, valorDelCampoDeRecuperacion: value } },
  );
};

// --- Esquema 2: un correo no válido se avisa antes de enviar y no se envía nada ---------------------------------------------

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
  const opened = await openForgotDirect(page);
  if (opened) return preparationMissedWeb(expected, opened);
  const watch = watchForgot(page);
  const written = await runStepsLogged([['escribir «Correo electrónico»', () => emailBox(page).fill(typed, ACTION)]]);
  if (written) return actionMissing(expected, written);
  const fieldType = await effectiveType(emailBox(page));
  const fieldValueWritten = await fieldValue(emailBox(page));
  const clicked = await runStepsLogged([['pulsar «Enviar enlace»', () => sendButton(page).click(ACTION)]]);
  if (clicked) return actionMissing(expected, clicked);
  const shown = await waitUntil(async () => (await messageOf(fieldError(page))) === aviso, LOCAL_MS);
  const error = await messageOf(fieldError(page));
  const below = isBelow(await boxOf(fieldError(page)), await boxOf(emailBox(page)));
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
    { ...typedMobileNote(typed), evidence: { tipoDelCampo: fieldType, valorDelCampoTrasEscribir: fieldValueWritten } },
  );
};

// --- Esquema 3: el aviso de validación desaparece al escribir en el campo ---------------------------------------------------

const TYPED_LATER: ReadonlyMap<string, string> = new Map<string, string>([['gestor@sigpro.test', 'gestor@sigpro.test']]);

const clearsOnType: BrowserRowHandler = async (row, { page }) => {
  await resetTenants([TENANT_A]);
  const typed = strict('correo', TYPED_LATER, cell(row, 'correo'));
  const expected = `deja de ver el aviso «${REQUIRED}» al escribir ${cell(row, 'correo')}`;
  const opened = await openForgotDirect(page);
  if (opened) return preparationMissedWeb(expected, opened);
  const pressed = await runStepsLogged([['pulsar «Enviar enlace» con el campo vacío', () => sendButton(page).click(ACTION)]]);
  if (pressed) return preparationMissedWeb(expected, pressed);
  const required = await waitUntil(async () => (await messageOf(fieldError(page))) === REQUIRED, LOCAL_MS);
  if (!required.reached) return preparationMissedWeb(expected, `no se vio «${REQUIRED}» tras pulsar «Enviar enlace» con el campo vacío`);
  const failure = await runStepsLogged([['escribir «Correo electrónico»', () => emailBox(page).fill(typed, ACTION)]]);
  if (failure) return actionMissing(expected, failure);
  const gone = await waitUntil(async () => (await visibilityOf(fieldError(page))) === 'hidden', LOCAL_MS);
  return conclude([check(gone.reached, `deja de ver el aviso «${REQUIRED}»`, gone.reached ? `ya no ve «${REQUIRED}»` : 'sigue viendo el aviso de error')]);
};

// --- Esquema 4: volver al inicio de sesión lleva a /login sin sesión iniciada -----------------------------------------------

interface Arrival {
  /** Llega a /forgot por el camino de la fila y deja «gestor@sigpro.test» escrito en «Correo electrónico». `undefined` si llega. */
  readonly arrive: (page: Page) => Promise<string | undefined>;
  readonly note: string;
}

/** Llega a /forgot desde /login (con el correo escrito allí). */
const arriveFromLogin = async (page: Page): Promise<string | undefined> => {
  const opened = await openLoginWithTenant(page);
  if (opened) return opened;
  const typed = await runStepsLogged([['escribir gestor@sigpro.test en «Correo electrónico» del acceso', () => emailBox(page).fill('gestor@sigpro.test', ACTION)]]);
  if (typed) return typed;
  const pressed = await runStepsLogged([['pulsar «¿Olvidaste la contraseña?»', () => forgotLink(page).click(ACTION)]]);
  if (pressed) return pressed;
  const arrived = await waitUntil(() => onForgot(page));
  if (!arrived.reached) return `no llega a /forgot desde /login (ruta ${pathOf(page)})`;
  return runStepsLogged([['escribir gestor@sigpro.test en «Correo electrónico» de /forgot', () => emailBox(page).fill('gestor@sigpro.test', ACTION)]]);
};

/** Llega a /forgot abriéndolo directamente. */
const arriveDirect = async (page: Page): Promise<string | undefined> => {
  const opened = await openForgotDirect(page);
  if (opened) return opened;
  return runStepsLogged([['escribir gestor@sigpro.test en «Correo electrónico»', () => emailBox(page).fill('gestor@sigpro.test', ACTION)]]);
};

const ARRIVALS: ReadonlyMap<string, Arrival> = new Map<string, Arrival>([
  ['pulsando «¿Olvidaste la contraseña?» en /login', { arrive: arriveFromLogin, note: BACK_NOTE }],
  ['abriendo /forgot directamente', { arrive: arriveDirect, note: `${DIRECT_NOTE} ${BACK_NOTE}` }],
]);

const leave: BrowserRowHandler = async (row, { page }) => {
  await resetTenants([TENANT_A]);
  const arrival = strict('llegada', ARRIVALS, cell(row, 'llegada'));
  const expected = 'llega a /login sin sesión iniciada';
  const prepared = await arrival.arrive(page);
  if (prepared) return preparationMissedWeb(expected, prepared);
  const failure = await runStepsLogged([['pulsar «Volver al inicio de sesión»', () => backButton(page).click(ACTION)]]);
  if (failure) return actionMissing(expected, failure);
  const back = await waitUntil(() => onLoginForm(page));
  return conclude(
    [
      check(back.reached, 'llega a /login', back.reached ? 'llega a /login' : `no llega a /login (ruta ${pathOf(page)})`),
      await noSessionCheck(page, onLoginForm, onPrograms),
    ],
    { note: arrival.note },
  );
};

// --- Esquema 5: con sesión iniciada, /forgot lleva a Programas ----------------------------------------------------------------

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
  // La sesión se inicia en la propia app, con la cuenta y el tenant de la fila
  const signed = await signInMobile(page, account, password);
  if (signed) return preparationMissedWeb(expected, signed);
  const opened = await runStepsLogged([['abrir /forgot', () => page.goto('/forgot', ACTION)]]);
  if (opened) return actionMissing(expected, opened);
  const arrived = await waitUntil(() => onPrograms(page));
  return conclude(
    [check(arrived.reached, 'llega a /programs', arrived.reached ? 'llega a /programs' : `no llega a /programs (ruta ${pathOf(page)})`)],
    { note: DIRECT_NOTE },
  );
};

defineBrowserRows({
  story: 'US-RECUPERAR-006',
  surface: 'expo-web',
  tenants: [TENANT_A],
  handlers: new Map<number, BrowserRowHandler>([
    [1, onExpoWeb(fromLogin)],
    [2, onExpoWeb(invalidEmail)],
    [3, onExpoWeb(clearsOnType)],
    [4, onExpoWeb(leave)],
    [5, onExpoWeb(withSession)],
  ]),
});
