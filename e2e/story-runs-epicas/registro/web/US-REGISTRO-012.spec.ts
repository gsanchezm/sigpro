import { TENANT_A, resetTenants } from '../../../story-runs/support/prepare';
import { ACTION, CEILING_MS, isVisible, noSessionCheck, pathOf, runSteps, waitUntil } from '../../support/browser';
import { check, cell, conclude, preparationFailedWeb, strict, type Check } from '../../support/checks';
import { defineBrowserRows, type BrowserRowHandler } from '../../support/framework';
import {
  RESENT_TITLE,
  SENT_TEXT,
  SENT_TITLE,
  actionMissing,
  backButton,
  fillForm,
  newAccountEmail,
  okToastTitles,
  onLoginForm,
  onPrograms,
  openRegister,
  readSent,
  resendButton,
  sentPanel,
  submit,
  validValues,
} from './common';

// US-REGISTRO-012 — Reenviar el correo de verificación desde «Solicitud enviada» (web). Preparación de cada fila: reinicio de
// alumno01 con su administrador, /register?tenant=alumno01 en un navegador sin sesión y la solicitud de la fila con un correo nuevo.

const TIMES: ReadonlyMap<string, number> = new Map([
  ['1', 1],
  ['2', 2],
]);

// --- Esquema 1: cada reenvío muestra el aviso «Correo reenviado» -----------------------------------------------------------

const resendEach: BrowserRowHandler = async (row, { page }) => {
  await resetTenants([TENANT_A]);
  const times = strict('veces', TIMES, cell(row, 'veces'));
  const email = newAccountEmail();
  const expected = `cada pulsación de «Reenviar correo de verificación» muestra «${RESENT_TITLE}»; sigue viendo «${SENT_TITLE}» con ${email}`;
  const opened = await openRegister(page);
  if (opened) return preparationFailedWeb(expected, opened);
  const filled = await fillForm(page, validValues(email));
  if (filled) return actionMissing(expected, filled);
  const sent = await submit(page);
  if (sent) return actionMissing(expected, sent);
  const panel = await waitUntil(() => isVisible(sentPanel(page)), CEILING_MS);
  if (!panel.reached) return preparationFailedWeb(expected, `no llega «${SENT_TITLE}» tras enviar la solicitud`);
  const checks: Check[] = [];
  for (let press = 1; press <= times; press += 1) {
    const pressed = await runSteps([['pulsar «Reenviar correo de verificación»', () => resendButton(page).click(ACTION)]]);
    if (pressed) return actionMissing(expected, pressed);
    // Cada pulsación añade un aviso: deben estar en pantalla tantos avisos «Correo reenviado» como pulsaciones
    const seen = await waitUntil(async () => (await okToastTitles(page)).filter((title) => title === RESENT_TITLE).length >= press, CEILING_MS);
    checks.push(check(seen.reached, `en la pulsación ${press} aparece el aviso «${RESENT_TITLE}»`, seen.reached ? `aparece el aviso «${RESENT_TITLE}» en la pulsación ${press}` : `no aparece el aviso en la pulsación ${press}`));
  }
  const reading = await readSent(page);
  checks.push(
    check(reading.visible && reading.text.includes(`${SENT_TEXT} ${email}`), `sigue viendo «${SENT_TITLE}» con el mismo correo`, reading.visible ? `sigue viendo «${SENT_TITLE}» con el correo ${reading.text.includes(email) ? 'de la solicitud' : 'otro'}` : `no sigue viendo «${SENT_TITLE}»`),
  );
  return conclude(checks);
};

// --- Esquema 2: volver al inicio de sesión desde la vista de la solicitud ----------------------------------------------------

const backFromSent: BrowserRowHandler = async (row, { page }) => {
  await resetTenants([TENANT_A]);
  const correo = cell(row, 'correo');
  if (correo !== '(correo nuevo)') throw new Error(`celda sin interpretación: correo «${correo}»`);
  const email = newAccountEmail();
  const expected = 'llega a /login sin sesión iniciada';
  const opened = await openRegister(page);
  if (opened) return preparationFailedWeb(expected, opened);
  const filled = await fillForm(page, validValues(email));
  if (filled) return actionMissing(expected, filled);
  const sent = await submit(page);
  if (sent) return actionMissing(expected, sent);
  const panel = await waitUntil(() => isVisible(sentPanel(page)), CEILING_MS);
  if (!panel.reached) return preparationFailedWeb(expected, `no llega «${SENT_TITLE}» tras enviar la solicitud`);
  const back = await runSteps([['pulsar «Volver al inicio de sesión»', () => backButton(page).click(ACTION)]]);
  if (back) return actionMissing(expected, back);
  const arrived = await waitUntil(() => onLoginForm(page));
  return conclude([
    check(arrived.reached, 'llega a /login', arrived.reached ? 'llega a /login' : `no llega a /login (ruta ${pathOf(page)})`),
    await noSessionCheck(page, onLoginForm, onPrograms),
  ]);
};

defineBrowserRows({
  story: 'US-REGISTRO-012',
  surface: 'web',
  tenants: [TENANT_A],
  handlers: new Map<number, BrowserRowHandler>([
    [1, resendEach],
    [2, backFromSent],
  ]),
});
