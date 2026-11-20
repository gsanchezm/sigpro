import type { Page } from '@playwright/test';
import { ACCESO_TESTIDS } from '../../../../packages/shared/src/testids';
import { DEMO, TENANT_A, resetTenants } from '../../../story-runs/support/prepare';
import { ACTION, noSessionCheck, quoted, waitUntil, type Step } from '../../support/browser';
import { cell, preparationFailedWeb, type Check } from '../../support/checks';
import { defineBrowserRows, type BrowserRowHandler } from '../../core/framework';
import {
  conclude,
  ACCESS,
  MOBILE_NOTE,
  actionMissing,
  alertCheck,
  belowField,
  heading1,
  noVisibleCheck,
  oneVisibleCheck,
  onLoginFormAny,
  onMfaAny,
  onProgramsAny,
  passwordNote,
  passwordSent,
  pathCheck,
  runStepsLogged,
  textCheck,
  withNote,
} from '../web/common';
import { button, enterAccessMobile, pickLangMobile, textbox } from './common';

// US-I18N-007 — Mensajes de error de Acceso en el idioma elegido (app móvil como web de Expo a 390 × 844; NO nativa). Preparación de
// cada fila: reinicio de alumno01; /login con «alumno01» en «Tenant de trabajo», sin sesión ni elección de idioma guardada. Cada fila
// elige «EN» en «Idioma» dentro de su Cuando, antes de enviar el formulario.

/** Lo que la celda de un aviso de campo dice: `ve «X»` → «X»; `no ve ningún aviso` → ninguno. Otro texto lanza. */
const avisoOf = (text: string): string | undefined => (text === 'no ve ningún aviso' ? undefined : quoted(text.replace(/^ve /, '')));

/** Un valor escrito tal cual, o `(vacío)` como cadena vacía; cualquier otro paréntesis lanza. */
const typed = (text: string): string => {
  if (text === '(vacío)') return '';
  if (text.startsWith('(')) throw new Error(`celda sin interpretación: «${text}»`);
  return text;
};

/** Elige inglés y escribe y envía el formulario de acceso, como lo haría una persona. */
const submitInEnglish = (page: Page, correo: string, contrasena: string): readonly Step[] => [
  ...pickLangMobile(page, ACCESS.es.language, 'en'),
  [`escribir «${ACCESS.en.email}»`, () => textbox(page, ACCESS.en.email).fill(correo, ACTION)],
  [`escribir «${ACCESS.en.password}»`, () => textbox(page, ACCESS.en.password).fill(contrasena, ACTION)],
  [`pulsar «${ACCESS.en.submit}»`, () => button(page, ACCESS.en.submit).click(ACTION)],
];

// --- Esquema 1: un acceso rechazado muestra su aviso en inglés y no inicia sesión -------------------------------------------

const rejected: BrowserRowHandler = async (row, { page }) => {
  const aviso = quoted(cell(row, 'aviso'));
  const expected = `ve el aviso «${aviso}» y sigue en /login sin sesión iniciada`;
  await resetTenants([TENANT_A]);
  const prepared = await runStepsLogged(enterAccessMobile(page));
  if (prepared) return preparationFailedWeb(expected, prepared);
  const sent = await runStepsLogged(submitInEnglish(page, cell(row, 'correo'), passwordSent(cell(row, 'contrasena'))));
  if (sent) return actionMissing(expected, sent);
  const result = withNote(
    conclude([
      await alertCheck(page.getByTestId(ACCESO_TESTIDS.LOGIN_ERROR), aviso),
      pathCheck(page, '/login'),
      // Lo último: la comprobación navega a /programs para ver si la sesión existe
      await noSessionCheck(page, onLoginFormAny, onProgramsAny),
    ]),
    MOBILE_NOTE,
  );
  return passwordNote(cell(row, 'contrasena'), result);
};

// --- Esquema 2: un campo vacío o con formato no válido avisa debajo del campo en inglés ---------------------------------

const fieldErrors: BrowserRowHandler = async (row, { page }) => {
  const avisoCorreo = cell(row, 'aviso_correo');
  const avisoContrasena = cell(row, 'aviso_contrasena');
  const expected = `${avisoCorreo} debajo de «Email» y ${avisoContrasena} debajo de «Password»`;
  await resetTenants([TENANT_A]);
  const prepared = await runStepsLogged(enterAccessMobile(page));
  if (prepared) return preparationFailedWeb(expected, prepared);
  const sent = await runStepsLogged(submitInEnglish(page, typed(cell(row, 'correo')), typed(cell(row, 'contrasena'))));
  if (sent) return actionMissing(expected, sent);
  const emailText = avisoOf(avisoCorreo);
  const passwordText = avisoOf(avisoContrasena);
  const emailError = page.getByTestId(ACCESO_TESTIDS.LOGIN_EMAIL_ERROR);
  const passwordError = page.getByTestId(ACCESO_TESTIDS.LOGIN_PASSWORD_ERROR);
  // Primero los avisos que la historia dice que aparecen (son el ancla); después se observa que el otro campo no tenga aviso
  const checks: Check[] = [];
  if (emailText !== undefined) {
    checks.push(await textCheck(emailError, 'aviso', emailText));
    checks.push(await belowField(emailError, textbox(page, ACCESS.en.email), 'Email'));
  }
  if (passwordText !== undefined) {
    checks.push(await textCheck(passwordError, 'aviso', passwordText));
    checks.push(await belowField(passwordError, textbox(page, ACCESS.en.password), 'Password'));
  }
  if (emailText === undefined) checks.push(await noVisibleCheck(emailError, 'debajo de «Email»'));
  if (passwordText === undefined) checks.push(await noVisibleCheck(passwordError, 'debajo de «Password»'));
  return withNote(conclude(checks), MOBILE_NOTE);
};

// --- Esquema 3: el código incorrecto del segundo paso avisa en inglés y no inicia sesión -------------------------------

const wrongSecondStep: BrowserRowHandler = async (row, { page }) => {
  const codigo = cell(row, 'codigo');
  const expected = 've el aviso «Incorrect or expired code» y sigue en «Two-step verification» sin sesión iniciada';
  await resetTenants([TENANT_A]);
  const prepared = await runStepsLogged(enterAccessMobile(page));
  if (prepared) return preparationFailedWeb(expected, prepared);
  const sentAdmin = await runStepsLogged(submitInEnglish(page, DEMO.admin.email, DEMO.admin.password));
  if (sentAdmin) return actionMissing(expected, sentAdmin);
  const reachedMfa = await waitUntil(() => onMfaAny(page));
  if (!reachedMfa.reached) return preparationFailedWeb(expected, 'no llega a «Two-step verification» para admin@sigpro.test');
  const sentCode = await runStepsLogged([
    [`escribir «${ACCESS.en.mfaCode}»`, () => textbox(page, ACCESS.en.mfaCode).fill(codigo, ACTION)],
    [`pulsar «${ACCESS.en.verify}»`, () => button(page, ACCESS.en.verify).click(ACTION)],
  ]);
  if (sentCode) return actionMissing(expected, sentCode);
  return withNote(
    conclude([
      await alertCheck(page.getByTestId(ACCESO_TESTIDS.MFA_ERROR), 'Incorrect or expired code'),
      await oneVisibleCheck(heading1(page, ACCESS.en.mfaTitle), 'título «Two-step verification»'),
      await noSessionCheck(page, onLoginFormAny, onProgramsAny),
    ]),
    MOBILE_NOTE,
  );
};

defineBrowserRows({
  story: 'US-I18N-007',
  surface: 'expo-web',
  tenants: [TENANT_A],
  handlers: new Map<number, BrowserRowHandler>([
    [1, rejected],
    [2, fieldErrors],
    [3, wrongSecondStep],
  ]),
});
