import type { Page } from '@playwright/test';
import { ACCESO_TESTIDS } from '../../../../packages/shared/src/testids';
import { DEMO, TENANT_A, resetTenants } from '../../../story-runs/support/prepare';
import { ACTION, noSessionCheck, quoted, waitUntil, type Step } from '../../support/browser';
import { cell, preparationFailedWeb, type Check } from '../../support/checks';
import { defineBrowserRows, type BrowserRowHandler } from '../../core/framework';
import {
  conclude,
  ACCESS,
  actionMissing,
  alertCheck,
  belowField,
  enterAccessWeb,
  heading1,
  noVisibleCheck,
  oneVisibleCheck,
  onLoginFormAny,
  onMfaAny,
  onProgramsAny,
  BELOW_NOTE,
  passwordNote,
  passwordSent,
  withNote,
  pathCheck,
  pickLangWeb,
  runStepsLogged,
  textCheck,
} from './common';

// US-I18N-004 — Mensajes de error de Acceso en el idioma elegido (web, 1440 px). Preparación de cada fila: reinicio de alumno01 y
// /login?tenant=alumno01 sin sesión ni elección de idioma guardada; el inglés se elige dentro de la propia fila (Cuando).

/** Lo que la celda de un aviso de campo dice: `ve «X»` → «X»; `no ve ningún aviso` → ninguno. Otro texto lanza. */
const avisoOf = (text: string): string | undefined => (text === 'no ve ningún aviso' ? undefined : quoted(text.replace(/^ve /, '')));

/** Un valor escrito tal cual, o `(vacío)` como cadena vacía; cualquier otro paréntesis lanza. */
const typed = (text: string): string => {
  if (text === '(vacío)') return '';
  if (text.startsWith('(')) throw new Error(`celda sin interpretación: «${text}»`);
  return text;
};

const EMAIL_ERROR = ACCESO_TESTIDS.LOGIN_EMAIL_ERROR;
const PASSWORD_ERROR = ACCESO_TESTIDS.LOGIN_PASSWORD_ERROR;

/** La Regla «un aviso nuevo nunca se muestra en el idioma anterior» se mide con los avisos que aparecen DESPUÉS de elegir EN. */
const NEW_ALERT_NOTE = 'La Regla «un aviso nuevo nunca se muestra en el idioma anterior» se mide con los avisos que aparecen después de elegir EN. El caso de un aviso ya visible al cambiar de idioma está en Decisiones pendientes y no se mide.';

/** Escribe los dos campos en inglés y pulsa «Sign in» (lo que la fila hace dentro del Cuando). */
const submitInEnglish = (page: Page, correo: string, contrasena: string): readonly Step[] => [
  pickLangWeb(page, ACCESS.es.language, 'en'),
  [`escribir «${ACCESS.en.email}»`, () => page.getByLabel(ACCESS.en.email, { exact: true }).fill(correo, ACTION)],
  [`escribir «${ACCESS.en.password}»`, () => page.getByLabel(ACCESS.en.password, { exact: true }).fill(contrasena, ACTION)],
  [`pulsar «${ACCESS.en.submit}»`, () => page.getByRole('button', { name: ACCESS.en.submit, exact: true }).click(ACTION)],
];

// --- Esquema 1: un acceso rechazado muestra su aviso en inglés y no inicia sesión --------------------------------------------

const rejected: BrowserRowHandler = async (row, { page }) => {
  const aviso = quoted(cell(row, 'aviso'));
  const expected = `ve el aviso «${aviso}» y sigue en /login sin sesión iniciada`;
  await resetTenants([TENANT_A]);
  const prepared = await runStepsLogged(enterAccessWeb(page));
  if (prepared) return preparationFailedWeb(expected, prepared);
  const sent = await runStepsLogged(submitInEnglish(page, cell(row, 'correo'), passwordSent(cell(row, 'contrasena'))));
  if (sent) return actionMissing(expected, sent);
  const result = conclude([
    await alertCheck(page.getByTestId(ACCESO_TESTIDS.LOGIN_ERROR), aviso),
    pathCheck(page, '/login'),
    // Lo último: la comprobación navega a /programs para ver si la sesión existe
    await noSessionCheck(page, onLoginFormAny, onProgramsAny),
  ]);
  return withNote(passwordNote(cell(row, 'contrasena'), result), NEW_ALERT_NOTE);
};

// --- Esquema 2: un campo vacío o con formato no válido avisa debajo del campo en inglés ----------------------------------

const fieldErrors: BrowserRowHandler = async (row, { page }) => {
  const avisoCorreo = cell(row, 'aviso_correo');
  const avisoContrasena = cell(row, 'aviso_contrasena');
  const expected = `${avisoCorreo} debajo de «Email» y ${avisoContrasena} debajo de «Password»`;
  await resetTenants([TENANT_A]);
  const prepared = await runStepsLogged(enterAccessWeb(page));
  if (prepared) return preparationFailedWeb(expected, prepared);
  const sent = await runStepsLogged(submitInEnglish(page, typed(cell(row, 'correo')), typed(cell(row, 'contrasena'))));
  if (sent) return actionMissing(expected, sent);
  const emailText = avisoOf(avisoCorreo);
  const passwordText = avisoOf(avisoContrasena);
  // Primero los avisos que la historia dice que aparecen (son el ancla); después se observa que el otro campo no tenga aviso
  const checks: Check[] = [];
  if (emailText !== undefined) {
    checks.push(await textCheck(page.getByTestId(EMAIL_ERROR), 'aviso', emailText));
    checks.push(await belowField(page.getByTestId(EMAIL_ERROR), page.getByLabel(ACCESS.en.email, { exact: true }), 'Email'));
  }
  if (passwordText !== undefined) {
    checks.push(await textCheck(page.getByTestId(PASSWORD_ERROR), 'aviso', passwordText));
    checks.push(await belowField(page.getByTestId(PASSWORD_ERROR), page.getByLabel(ACCESS.en.password, { exact: true }), 'Password'));
  }
  if (emailText === undefined) checks.push(await noVisibleCheck(page.getByTestId(EMAIL_ERROR), 'debajo de «Email»'));
  if (passwordText === undefined) checks.push(await noVisibleCheck(page.getByTestId(PASSWORD_ERROR), 'debajo de «Password»'));
  return withNote(conclude(checks), `${BELOW_NOTE} ${NEW_ALERT_NOTE}`);
};

// --- Esquema 3: el código incorrecto del segundo paso avisa en inglés y no inicia sesión --------------------------------

const wrongSecondStep: BrowserRowHandler = async (row, { page }) => {
  const codigo = cell(row, 'codigo');
  const expected = 've el aviso «Incorrect or expired code» y sigue en «Two-step verification» sin sesión iniciada';
  await resetTenants([TENANT_A]);
  const prepared = await runStepsLogged(enterAccessWeb(page));
  if (prepared) return preparationFailedWeb(expected, prepared);
  const sentAdmin = await runStepsLogged(submitInEnglish(page, DEMO.admin.email, DEMO.admin.password));
  if (sentAdmin) return actionMissing(expected, sentAdmin);
  const reachedMfa = await waitUntil(() => onMfaAny(page));
  if (!reachedMfa.reached) return preparationFailedWeb(expected, 'no llega a «Two-step verification» para admin@sigpro.test');
  const sentCode = await runStepsLogged([
    [`escribir «${ACCESS.en.mfaCode}»`, () => page.getByLabel(ACCESS.en.mfaCode, { exact: true }).fill(codigo, ACTION)],
    [`pulsar «${ACCESS.en.verify}»`, () => page.getByRole('button', { name: ACCESS.en.verify, exact: true }).click(ACTION)],
  ]);
  if (sentCode) return actionMissing(expected, sentCode);
  return conclude([
    await alertCheck(page.getByTestId(ACCESO_TESTIDS.MFA_ERROR), 'Incorrect or expired code'),
    await oneVisibleCheck(heading1(page, ACCESS.en.mfaTitle), 'título «Two-step verification»'),
    await noSessionCheck(page, onLoginFormAny, onProgramsAny),
  ]);
};

defineBrowserRows({
  story: 'US-I18N-004',
  surface: 'web',
  tenants: [TENANT_A],
  handlers: new Map<number, BrowserRowHandler>([
    [1, rejected],
    [2, fieldErrors],
    [3, wrongSecondStep],
  ]),
});
