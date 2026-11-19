import type { Page } from '@playwright/test';
import { TENANT_A, resetTenants } from '../../../story-runs/support/prepare';
import { ACTION, CEILING_MS, isFocused, isVisible, quoted, runSteps, waitUntil } from '../../support/browser';
import { check, cell, conclude, preparationFailedWeb, strict } from '../../support/checks';
import { defineBrowserRows, type BrowserRowHandler } from '../../support/framework';
import {
  ALL_ERROR_TESTIDS,
  EMAIL_NOTE,
  ERROR_TESTIDS,
  RULES,
  afterObserving,
  actionMissing,
  field,
  fillForm,
  messageOf,
  meterOf,
  newAccountEmail,
  openRegister,
  plainValue,
  ruleStates,
  ruleWord,
  submit,
  termsBox,
  validValues,
  watchSubmissions,
  type FormValues,
} from './common';

// US-REGISTRO-009 — Validar la solicitud antes de enviarla (web): avisos por campo, foco y borrado al editar. Preparación de cada
// fila: reinicio de alumno01 con su administrador y /register?tenant=alumno01 en un navegador sin sesión. Ninguna fila debe
// enviar la solicitud: se cuentan las solicitudes POST a /api/auth/register.

const EMAIL_MARKERS: ReadonlyMap<string, string> = new Map([['(ana @sigpro.test, con un espacio antes de la arroba)', 'ana @sigpro.test']]);

/** Cada campo del formulario que la historia nombra, con el cambio que la fila hace sobre sus datos válidos. */
const FIELD_PATCH: ReadonlyMap<string, (value: string) => Partial<FormValues>> = new Map<string, (value: string) => Partial<FormValues>>([
  ['Nombre', (value) => ({ first: value })],
  ['Apellidos', (value) => ({ last: value })],
  ['Correo corporativo', (value) => ({ email: value })],
  ['Organización / Unidad', (value) => ({ org: value })],
]);

const expectedMessage = (text: string): string | undefined => (text === '(ninguno)' ? undefined : quoted(text));

// --- Esquema 1: cada campo no válido muestra su aviso y no se envía nada ------------------------------------------------------

const fieldMessage: BrowserRowHandler = async (row, { page }) => {
  await resetTenants([TENANT_A]);
  const label = quoted(cell(row, 'campo'));
  const patch = strict('campo', FIELD_PATCH, label);
  const value = plainValue(cell(row, 'valor'), EMAIL_MARKERS);
  const message = quoted(cell(row, 'aviso'));
  const expected = `bajo «${label}» ve «${message}»; no se envía la solicitud`;
  const opened = await openRegister(page);
  if (opened) return preparationFailedWeb(expected, opened);
  const values: FormValues = { ...validValues(newAccountEmail()), ...patch(value) };
  const count = watchSubmissions(page);
  const typed = await fillForm(page, values);
  if (typed) return actionMissing(expected, typed);
  const pressed = await submit(page);
  if (pressed) return actionMissing(expected, pressed);
  const sent = await afterObserving(count);
  const shown = await messageOf(page, ERROR_TESTIDS.get(label) ?? '');
  const browserTrimmed = label === 'Correo corporativo' && value !== value.trim();
  return conclude([
    check(shown === message, `bajo «${label}» ve «${message}»`, shown === undefined ? `bajo «${label}» no ve ningún aviso` : `bajo «${label}» ve «${shown}»`),
    check(sent === 0, 'no se envía la solicitud', `solicitudes enviadas: ${sent}`),
  ], browserTrimmed ? { note: EMAIL_NOTE } : {});
};

// --- Esquema 2: la contraseña y su confirmación se validan juntas --------------------------------------------------------------

const passwordPair: BrowserRowHandler = async (row, { page }) => {
  await resetTenants([TENANT_A]);
  const password = plainValue(cell(row, 'contraseña'));
  const confirm = plainValue(cell(row, 'confirmacion'));
  const expectedPassword = expectedMessage(cell(row, 'aviso_contraseña'));
  const expectedConfirm = expectedMessage(cell(row, 'aviso_confirmacion'));
  const expected = `bajo «Contraseña» ${expectedPassword ?? '(ninguno)'}; bajo «Confirmar contraseña» ${expectedConfirm ?? '(ninguno)'}; no se envía`;
  const opened = await openRegister(page);
  if (opened) return preparationFailedWeb(expected, opened);
  const count = watchSubmissions(page);
  const typed = await fillForm(page, { ...validValues(newAccountEmail()), password, confirm });
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

// --- Esquema 3: una contraseña de diez caracteres que no cumple otra regla no se envía -----------------------------------------

const RULE_INDEX: ReadonlyMap<string, number> = new Map(RULES.map((rule, index) => [rule, index] as const));

const ruleMissing: BrowserRowHandler = async (row, { page }) => {
  await resetTenants([TENANT_A]);
  const password = cell(row, 'contraseña');
  const rule = quoted(cell(row, 'regla'));
  const index = strict('regla', RULE_INDEX, rule);
  const expected = `no se envía; bajo «Contraseña» hay un aviso; la regla «${rule}» del medidor sin marcar`;
  const opened = await openRegister(page);
  if (opened) return preparationFailedWeb(expected, opened);
  const count = watchSubmissions(page);
  const typed = await fillForm(page, { ...validValues(newAccountEmail()), password, confirm: password });
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
  const opened = await openRegister(page);
  if (opened) return preparationFailedWeb(expected, opened);
  const count = watchSubmissions(page);
  const typed = await fillForm(page, { ...validValues(newAccountEmail()), terms: false });
  if (typed) return actionMissing(expected, typed);
  const pressed = await submit(page);
  if (pressed) return actionMissing(expected, pressed);
  const sent = await afterObserving(count);
  const shown = await messageOf(page, ERROR_TESTIDS.get('la casilla') ?? '');
  const unchecked = !(await termsBox(page).isChecked({ timeout: 500 }).catch(() => true));
  return conclude([
    check(shown === 'Debes aceptar las condiciones' && unchecked, 'bajo la casilla ve «Debes aceptar las condiciones»', shown === undefined ? 'bajo la casilla no ve ningún aviso' : `bajo la casilla ve «${shown}»`),
    check(sent === 0, 'no se envía la solicitud', `solicitudes enviadas: ${sent}`),
  ]);
};

// --- Esquema 5: el foco va al primer campo con aviso, en el orden del formulario -----------------------------------------------

const EMPTY: FormValues = { first: '', last: '', email: '', org: '', role: 'consultant', password: '', confirm: '', terms: false };

const FOCUS_SITUATIONS: ReadonlyMap<string, Partial<FormValues>> = new Map<string, Partial<FormValues>>([
  ['todos los campos vacíos', {}],
  ['Ana en «Nombre» y Prueba en «Apellidos», y el resto de campos vacío', { first: 'Ana', last: 'Prueba' }],
]);

const focusOrder: BrowserRowHandler = async (row, { page }) => {
  await resetTenants([TENANT_A]);
  const situation = strict('situacion', FOCUS_SITUATIONS, cell(row, 'situacion'));
  const label = quoted(cell(row, 'campo_enfocado'));
  const expected = `el foco está en «${label}»`;
  const opened = await openRegister(page);
  if (opened) return preparationFailedWeb(expected, opened);
  const typed = await fillForm(page, { ...EMPTY, ...situation });
  if (typed) return actionMissing(expected, typed);
  const pressed = await submit(page);
  if (pressed) return actionMissing(expected, pressed);
  const focus = await waitUntil(() => isFocused(field(page, label)), CEILING_MS);
  return conclude([check(focus.reached, expected, focus.reached ? expected : `el foco no está en «${label}»`)]);
};

// --- Esquema 6: editar un campo borra los avisos de todos los campos -----------------------------------------------------------

const anyWarning = async (page: Page): Promise<number> => {
  let visible = 0;
  for (const testId of ALL_ERROR_TESTIDS) if (await isVisible(page.getByTestId(testId))) visible += 1;
  return visible;
};

const editClears: BrowserRowHandler = async (row, { page }) => {
  await resetTenants([TENANT_A]);
  const label = quoted(cell(row, 'campo'));
  const text = plainValue(cell(row, 'texto'));
  const expected = `ya no ve ningún aviso bajo los campos al escribir en «${label}»`;
  const opened = await openRegister(page);
  if (opened) return preparationFailedWeb(expected, opened);
  const pressed = await submit(page);
  if (pressed) return actionMissing(expected, pressed);
  const warnings = await waitUntil(async () => (await anyWarning(page)) > 0, CEILING_MS);
  if (!warnings.reached) return preparationFailedWeb(expected, 'no ve avisos bajo los campos tras pulsar «Enviar solicitud» con todos los campos vacíos');
  const typed = await runSteps([[`escribir en «${label}»`, () => field(page, label).fill(text, ACTION)]]);
  if (typed) return actionMissing(expected, typed);
  const left = await anyWarning(page);
  return conclude([check(left === 0, 'ya no ve ningún aviso bajo los campos', left === 0 ? 'ya no ve ningún aviso bajo los campos' : `sigue viendo ${left} aviso(s)`)]);
};

defineBrowserRows({
  story: 'US-REGISTRO-009',
  surface: 'web',
  tenants: [TENANT_A],
  handlers: new Map<number, BrowserRowHandler>([
    [1, fieldMessage],
    [2, passwordPair],
    [3, ruleMissing],
    [4, termsRow],
    [5, focusOrder],
    [6, editClears],
  ]),
});
