import type { Page } from '@playwright/test';
import { TENANT_A, resetTenants } from '../../../story-runs/support/prepare';
import { ACTION, CEILING_MS, isVisible, quoted, runSteps, waitUntil } from '../../support/browser';
import { check, cell, conclude, preparationFailedWeb, strict } from '../../support/checks';
import { defineBrowserRows, type BrowserRowHandler } from '../../support/framework';
import {
  ALL_ERROR_TESTIDS,
  ERROR_TESTIDS,
  RULES,
  actionMissing,
  afterObserving,
  messageOf,
  meterOf,
  newAccountEmail,
  plainValue,
  ruleStates,
  ruleWord,
  submit,
  validValues,
  watchSubmissions,
  type FormValues,
} from '../web/common';
import { fillMobileForm, onExpoWeb, openRegisterFromLogin, textbox } from './common';

// US-REGISTRO-014 — Validar la solicitud antes de enviarla (app móvil servida como web de Expo a 390 px; NO es nativo). Preparación
// de cada fila: reinicio de alumno01, /login con alumno01 en «Tenant de trabajo» y «Solicitar acceso». Ninguna fila debe enviar la
// solicitud: se cuentan las solicitudes POST a /api/auth/register.

const EMAIL_MARKERS: ReadonlyMap<string, string> = new Map([['(ana @sigpro.test, con un espacio antes de la arroba)', 'ana @sigpro.test']]);

const FIELD_PATCH: ReadonlyMap<string, (value: string) => Partial<FormValues>> = new Map<string, (value: string) => Partial<FormValues>>([
  ['Nombre', (value) => ({ first: value })],
  ['Apellidos', (value) => ({ last: value })],
  ['Correo corporativo', (value) => ({ email: value })],
  ['Organización / Unidad', (value) => ({ org: value })],
]);

const expectedMessage = (text: string): string | undefined => (text === '(ninguno)' ? undefined : quoted(text));

/** Cuántos avisos de campo hay visibles (cualquiera de los del formulario). */
const warningsShown = async (page: Page): Promise<number> => {
  let visible = 0;
  for (const testId of ALL_ERROR_TESTIDS) if (await isVisible(page.getByTestId(testId))) visible += 1;
  return visible;
};

// --- Esquema 1: cada campo no válido muestra su aviso y no se envía nada -----------------------------------------------------

const fieldMessage: BrowserRowHandler = async (row, { page }) => {
  await resetTenants([TENANT_A]);
  const label = quoted(cell(row, 'campo'));
  const patch = strict('campo', FIELD_PATCH, label);
  const value = plainValue(cell(row, 'valor'), EMAIL_MARKERS);
  const message = quoted(cell(row, 'aviso'));
  const expected = `bajo «${label}» ve «${message}»; no se envía la solicitud`;
  const opened = await openRegisterFromLogin(page);
  if (opened) return preparationFailedWeb(expected, opened);
  const count = watchSubmissions(page);
  const typed = await fillMobileForm(page, { ...validValues(newAccountEmail()), ...patch(value) });
  if (typed) return actionMissing(expected, typed);
  const pressed = await submit(page);
  if (pressed) return actionMissing(expected, pressed);
  const sent = await afterObserving(count);
  const shown = await messageOf(page, ERROR_TESTIDS.get(label) ?? '');
  return conclude([
    check(shown === message, `bajo «${label}» ve «${message}»`, shown === undefined ? `bajo «${label}» no ve ningún aviso` : `bajo «${label}» ve «${shown}»`),
    check(sent === 0, 'no se envía la solicitud', `solicitudes enviadas: ${sent}`),
  ]);
};

// --- Esquema 2: la contraseña y su confirmación se validan juntas -------------------------------------------------------------

const passwordPair: BrowserRowHandler = async (row, { page }) => {
  await resetTenants([TENANT_A]);
  const password = plainValue(cell(row, 'contraseña'));
  const confirm = plainValue(cell(row, 'confirmacion'));
  const expectedPassword = expectedMessage(cell(row, 'aviso_contraseña'));
  const expectedConfirm = expectedMessage(cell(row, 'aviso_confirmacion'));
  const expected = `bajo «Contraseña» ${expectedPassword ?? '(ninguno)'}; bajo «Confirmar contraseña» ${expectedConfirm ?? '(ninguno)'}; no se envía`;
  const opened = await openRegisterFromLogin(page);
  if (opened) return preparationFailedWeb(expected, opened);
  const count = watchSubmissions(page);
  const typed = await fillMobileForm(page, { ...validValues(newAccountEmail()), password, confirm });
  if (typed) return actionMissing(expected, typed);
  const pressed = await submit(page);
  if (pressed) return actionMissing(expected, pressed);
  const sent = await afterObserving(count);
  const shownPassword = await messageOf(page, ERROR_TESTIDS.get('Contraseña') ?? '');
  const shownConfirm = await messageOf(page, ERROR_TESTIDS.get('Confirmar contraseña') ?? '');
  return conclude([
    check(shownPassword === expectedPassword, `bajo «Contraseña» ${expectedPassword === undefined ? 'sin aviso' : `«${expectedPassword}»`}`, shownPassword === undefined ? 'bajo «Contraseña» sin aviso' : `bajo «Contraseña» «${shownPassword}»`),
    check(shownConfirm === expectedConfirm, `bajo «Confirmar contraseña» ${expectedConfirm === undefined ? 'sin aviso' : `«${expectedConfirm}»`}`, shownConfirm === undefined ? 'bajo «Confirmar contraseña» sin aviso' : `bajo «Confirmar contraseña» «${shownConfirm}»`),
    check(sent === 0, 'no se envía la solicitud', `solicitudes enviadas: ${sent}`),
  ]);
};

// --- Esquema 3: una contraseña de diez caracteres que no cumple otra regla no se envía ---------------------------------------

const RULE_INDEX: ReadonlyMap<string, number> = new Map(RULES.map((rule, index) => [rule, index] as const));

const ruleMissing: BrowserRowHandler = async (row, { page }) => {
  await resetTenants([TENANT_A]);
  const password = cell(row, 'contraseña');
  const rule = quoted(cell(row, 'regla'));
  const index = strict('regla', RULE_INDEX, rule);
  const expected = `no se envía; bajo «Contraseña» hay un aviso; la regla «${rule}» del medidor sin marcar`;
  const opened = await openRegisterFromLogin(page);
  if (opened) return preparationFailedWeb(expected, opened);
  const count = watchSubmissions(page);
  const typed = await fillMobileForm(page, { ...validValues(newAccountEmail()), password, confirm: password });
  if (typed) return actionMissing(expected, typed);
  const pressed = await submit(page);
  if (pressed) return actionMissing(expected, pressed);
  const sent = await afterObserving(count);
  const warning = await messageOf(page, ERROR_TESTIDS.get('Contraseña') ?? '');
  const states = await ruleStates(meterOf(page));
  return conclude([
    check(sent === 0, 'no se envía la solicitud', `solicitudes enviadas: ${sent}`),
    check(warning !== undefined, 'bajo «Contraseña» hay un aviso', warning === undefined ? 'bajo «Contraseña» no hay aviso' : `bajo «Contraseña» hay un aviso («${warning}»)`),
    check(states[index] === 'false', `la regla «${rule}» del medidor sin marcar`, `la regla «${rule}» ${ruleWord(states[index])}`),
  ]);
};

// --- Esquema 4: sin aceptar las condiciones la solicitud no se envía ----------------------------------------------------------

const termsRow: BrowserRowHandler = async (row, { page }) => {
  await resetTenants([TENANT_A]);
  const box = strict('casilla', new Map([['desmarcada', 'desmarcada']]), cell(row, 'casilla'));
  const expected = `bajo la casilla ve «Debes aceptar las condiciones»; no se envía la solicitud (casilla ${box})`;
  const opened = await openRegisterFromLogin(page);
  if (opened) return preparationFailedWeb(expected, opened);
  const count = watchSubmissions(page);
  const typed = await fillMobileForm(page, { ...validValues(newAccountEmail()), terms: false });
  if (typed) return actionMissing(expected, typed);
  const pressed = await submit(page);
  if (pressed) return actionMissing(expected, pressed);
  const sent = await afterObserving(count);
  const shown = await messageOf(page, ERROR_TESTIDS.get('la casilla') ?? '');
  return conclude([
    check(shown === 'Debes aceptar las condiciones', 'bajo la casilla ve «Debes aceptar las condiciones»', shown === undefined ? 'bajo la casilla no ve ningún aviso' : `bajo la casilla ve «${shown}»`),
    check(sent === 0, 'no se envía la solicitud', `solicitudes enviadas: ${sent}`),
  ]);
};

// --- Esquema 5: editar un campo borra los avisos de todos los campos ----------------------------------------------------------

const editClears: BrowserRowHandler = async (row, { page }) => {
  await resetTenants([TENANT_A]);
  const label = quoted(cell(row, 'campo'));
  const text = plainValue(cell(row, 'texto'));
  const expected = `ya no ve ningún aviso bajo los campos al escribir en «${label}»`;
  const opened = await openRegisterFromLogin(page);
  if (opened) return preparationFailedWeb(expected, opened);
  const pressed = await submit(page);
  if (pressed) return actionMissing(expected, pressed);
  const warnings = await waitUntil(async () => (await warningsShown(page)) > 0, CEILING_MS);
  if (!warnings.reached) return preparationFailedWeb(expected, 'no ve avisos bajo los campos tras pulsar «Enviar solicitud» con todos los campos vacíos');
  const typed = await runSteps([[`escribir en «${label}»`, () => textbox(page, label).fill(text, ACTION)]]);
  if (typed) return actionMissing(expected, typed);
  const left = await warningsShown(page);
  return conclude([check(left === 0, 'ya no ve ningún aviso bajo los campos', left === 0 ? 'ya no ve ningún aviso bajo los campos' : `sigue viendo ${left} aviso(s)`)]);
};

defineBrowserRows({
  story: 'US-REGISTRO-014',
  surface: 'expo-web',
  tenants: [TENANT_A],
  handlers: new Map<number, BrowserRowHandler>([
    [1, onExpoWeb(fieldMessage)],
    [2, onExpoWeb(passwordPair)],
    [3, onExpoWeb(ruleMissing)],
    [4, onExpoWeb(termsRow)],
    [5, onExpoWeb(editClears)],
  ]),
});
