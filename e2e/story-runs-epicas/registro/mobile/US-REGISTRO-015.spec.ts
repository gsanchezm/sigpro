import type { Page } from '@playwright/test';
import { usersByEmail } from '../../../story-runs/support/api';
import { TENANT_A, resetTenants } from '../../../story-runs/support/prepare';
import { ACTION, CEILING_MS, attrOf, isDisabled, isVisible, linesOf, noSessionCheck, pathOf, runSteps, textOf, valueOf, waitUntil } from '../../support/browser';
import { check, cell, conclude, preparationFailedWeb, strict, type Check } from '../../support/checks';
import { defineBrowserRows, type BrowserRowHandler } from '../../support/framework';
import { accountSnapshot, noNewAccountCheck } from '../api/common';
import {
  DUPLICATE_MESSAGE,
  RESENT_TITLE,
  SENT_TEXT,
  SENT_TITLE,
  actionMissing,
  backButton,
  currentYears,
  delayRegister,
  newAccountEmail,
  okToastTitles,
  readSent,
  requestIdLine,
  resendButton,
  sentLine,
  sentPanel,
  submit,
  submitButton,
  validValues,
  watchPosts,
  type FormValues,
} from '../web/common';
import { DIRECT_APPROXIMATION, fillMobileForm, onExpoWeb, onLoginForm, onPrograms, openRegisterDirectly, openRegisterFromLogin, serverAlert, textbox, watchTenantHeader } from './common';

// US-REGISTRO-015 — Enviar la solicitud en la app móvil: aviso de correo ya registrado, «Solicitud enviada» y reenvío (Expo web a
// 390 px; NO es nativo). Preparación de cada fila: reinicio de alumno01 con su administrador, /login con alumno01 en «Tenant de
// trabajo» y «Solicitar acceso». Los correos con cuenta son del seed de alumno01 (se comprueban en el listado antes de enviar).

const ACCOUNT_EMAILS: ReadonlyMap<string, string> = new Map([
  ['admin@sigpro.test', 'admin@sigpro.test'],
  ['pendiente@sigpro.test', 'pendiente@sigpro.test'],
]);

const ROLES: ReadonlyMap<string, string> = new Map([
  ['consultant', 'consultant'],
  ['program_manager', 'program_manager'],
  ['auditor', 'auditor'],
]);

const DELAYS: ReadonlyMap<string, number> = new Map([
  ['1 segundo', 1_000],
  ['3 segundos', 3_000],
]);

const TIMES: ReadonlyMap<string, number> = new Map([
  ['1', 1],
  ['2', 2],
]);

const ARRIVALS: ReadonlyMap<string, 'desde-login' | 'enlace-directo'> = new Map<string, 'desde-login' | 'enlace-directo'>([
  ['desde /login', 'desde-login'],
  ['con un enlace directo a /register y alumno01 ya guardado en «Tenant de trabajo»', 'enlace-directo'],
]);

/** Los datos escritos siguen en el formulario. El correo se compara sin espacios de los extremos (la app no los recorta en pantalla). */
const keptValues = async (page: Page, values: FormValues, typedEmail: string): Promise<boolean> => {
  const email = await valueOf(textbox(page, 'Correo corporativo'));
  const readings = [
    await valueOf(textbox(page, 'Nombre')),
    await valueOf(textbox(page, 'Apellidos')),
    await valueOf(textbox(page, 'Organización / Unidad')),
    await valueOf(textbox(page, 'Contraseña')),
    await valueOf(textbox(page, 'Confirmar contraseña')),
  ];
  const expected = [values.first, values.last, values.org, values.password, values.confirm];
  return readings.every((reading, index) => reading === expected[index]) && email?.trim() === typedEmail.trim();
};

/** Título del aviso de servidor: su primer renglón (la traza HTTP va después). */
const alertTitle = async (page: Page): Promise<string | undefined> => linesOf(await textOf(serverAlert(page)))[0];

/** Correo de un cuerpo JSON de petición (`undefined` si no lo trae). */
const emailOfBody = (body: unknown): unknown => (typeof body === 'object' && body !== null ? (body as Record<string, unknown>).email : undefined);

// --- Esquema 1: un correo que ya tiene cuenta en el tenant muestra el aviso y conserva lo escrito ------------------------------

const duplicate: BrowserRowHandler = async (row, { page }) => {
  await resetTenants([TENANT_A]);
  const typed = strict('correo', ACCOUNT_EMAILS, cell(row, 'correo'));
  const expected = `ve encima de los campos «${DUPLICATE_MESSAGE}»; sigue en /register sin sesión, con los datos escritos; no se crea ninguna cuenta nueva`;
  const users = await usersByEmail(TENANT_A);
  if (!users.has(typed)) return preparationFailedWeb(expected, `${typed} no está en el listado de alumno01`);
  const opened = await openRegisterFromLogin(page);
  if (opened) return preparationFailedWeb(expected, opened);
  const values = validValues(typed);
  const filled = await fillMobileForm(page, values);
  if (filled) return actionMissing(expected, filled);
  const before = await accountSnapshot(TENANT_A, typed);
  const sent = await submit(page);
  if (sent) return actionMissing(expected, sent);
  const shown = await waitUntil(async () => (await alertTitle(page)) === DUPLICATE_MESSAGE, CEILING_MS);
  const alertBox = await serverAlert(page).boundingBox({ timeout: 500 }).catch(() => null);
  const nameBox = await textbox(page, 'Nombre').boundingBox({ timeout: 500 }).catch(() => null);
  const above = alertBox !== null && nameBox !== null && alertBox.y + alertBox.height <= nameBox.y;
  const kept = await keptValues(page, values, typed);
  const after = await accountSnapshot(TENANT_A, typed);
  const checks: Check[] = [
    check(shown.reached, `ve «${DUPLICATE_MESSAGE}»`, shown.reached ? `ve «${DUPLICATE_MESSAGE}»` : `ve «${String(await alertTitle(page))}»`),
    check(above, 'el aviso va encima de los campos', above ? 'el aviso va encima de los campos' : 'el aviso no va encima de «Nombre»'),
    check(pathOf(page) === '/register' && kept, 'sigue en /register con los datos escritos', `ruta ${pathOf(page)}; datos ${kept ? 'conservados' : 'perdidos'}`),
    noNewAccountCheck(before, after),
  ];
  checks.push(await noSessionCheck(page, onLoginForm, onPrograms));
  return conclude(checks);
};

// --- Esquema 2: una solicitud correcta muestra «Solicitud enviada» con su estado ---------------------------------------------

const acceptedView: BrowserRowHandler = async (row, { page }) => {
  await resetTenants([TENANT_A]);
  const role = strict('rol', ROLES, cell(row, 'rol'));
  const email = newAccountEmail();
  const expected = `ve «${SENT_TITLE}», «${SENT_TEXT}» ${email}, «Pendiente de aprobación», el rol ${role} y un REQ-AAAA-NNNN; aviso «${SENT_TITLE}»; no hay sesión iniciada; la solicitud se envía una vez a alumno01`;
  const opened = await openRegisterFromLogin(page);
  if (opened) return preparationFailedWeb(expected, opened);
  const filled = await fillMobileForm(page, validValues(email, role));
  if (filled) return actionMissing(expected, filled);
  const posts = watchPosts(page, '/auth/register');
  const sent = await submit(page);
  if (sent) return actionMissing(expected, sent);
  const panel = await waitUntil(() => isVisible(sentPanel(page)), CEILING_MS);
  const reading = await readSent(page);
  const toast = await waitUntil(async () => (await okToastTitles(page)).includes(SENT_TITLE), CEILING_MS);
  const requestId = requestIdLine(reading.lines);
  const registerPosts = posts.posts();
  const checks: Check[] = [
    check(panel.reached, `ve el título «${SENT_TITLE}»`, panel.reached ? `ve el título «${SENT_TITLE}»` : `no aparece la vista «${SENT_TITLE}»`),
    check(reading.text.includes(`${SENT_TEXT} ${email}`), `ve «${SENT_TEXT}» seguido de ${email}`, sentLine(reading.lines) ?? 'no ve el texto de verificación'),
    check(reading.lines.includes('Pendiente de aprobación'), 've el estado «Pendiente de aprobación»', reading.lines.includes('Pendiente de aprobación') ? 've el estado «Pendiente de aprobación»' : 'no ve el estado'),
    check(reading.lines.includes(role), `ve el rol ${role}`, reading.lines.includes(role) ? `ve el rol ${role}` : 'no ve el rol'),
    check(requestId !== undefined && currentYears().includes(requestId.slice(4, 8)), 've un identificador REQ-AAAA-NNNN del año en curso', requestId === undefined ? 'no ve identificador de solicitud' : `identificador ${requestId}`),
    check(registerPosts.length === 1 && registerPosts[0]?.tenant === TENANT_A, 'la solicitud se envía una vez, con x-tenant alumno01', `solicitudes enviadas: ${registerPosts.length}; x-tenant ${registerPosts[0]?.tenant ?? '(sin cabecera)'}`),
    check(toast.reached, `aparece un aviso emergente con el título «${SENT_TITLE}»`, toast.reached ? `aviso «${SENT_TITLE}» visible` : 'no aparece el aviso emergente'),
  ];
  checks.push(await noSessionCheck(page, onLoginForm, onPrograms));
  return conclude(checks);
};

// --- Esquema 3: mientras espera la respuesta no se puede volver a enviar ------------------------------------------------------

const busyWhileWaiting: BrowserRowHandler = async (row, { page }) => {
  await resetTenants([TENANT_A]);
  const delay = strict('espera', DELAYS, cell(row, 'espera'));
  const email = newAccountEmail();
  const expected = `durante la espera «Enviar solicitud» muestra que está ocupado y no se puede volver a pulsar; al llegar la respuesta ve «${SENT_TITLE}»; una sola solicitud`;
  const opened = await openRegisterFromLogin(page);
  if (opened) return preparationFailedWeb(expected, opened);
  const filled = await fillMobileForm(page, validValues(email));
  if (filled) return actionMissing(expected, filled);
  await delayRegister(page, delay);
  const posts = watchPosts(page, '/auth/register');
  const pressed = await runSteps([['pulsar «Enviar solicitud»', () => submitButton(page).click(ACTION)]]);
  if (pressed) return actionMissing(expected, pressed);
  const busy = await waitUntil(() => isDisabled(submitButton(page)), CEILING_MS);
  const isBusy = (await attrOf(submitButton(page), 'aria-busy')) === 'true';
  // Un segundo toque mientras espera: el botón está deshabilitado, así que no debe salir ninguna solicitud más
  await submitButton(page).click({ force: true, timeout: 500 }).catch(() => undefined);
  const arrived = await waitUntil(() => isVisible(sentPanel(page)), CEILING_MS);
  const sentCount = posts.count();
  return conclude([
    check(busy.reached && isBusy, 'durante la espera «Enviar solicitud» muestra que está ocupado y no se puede volver a pulsar', busy.reached ? `aria-busy=${String(isBusy)} y deshabilitado` : 'no queda ocupado ni deshabilitado durante la espera'),
    check(arrived.reached, `al llegar la respuesta ve «${SENT_TITLE}»`, arrived.reached ? `ve «${SENT_TITLE}»` : `no llega «${SENT_TITLE}»`),
    check(sentCount === 1, 'no se puede volver a enviar: una sola solicitud', `solicitudes enviadas: ${sentCount}`),
  ]);
};

// --- Esquema 4: reenviar el correo de verificación muestra el aviso «Correo reenviado» ----------------------------------------

const resendEach: BrowserRowHandler = async (row, { page }) => {
  await resetTenants([TENANT_A]);
  const times = strict('veces', TIMES, cell(row, 'veces'));
  const email = newAccountEmail();
  const expected = `cada pulsación de «Reenviar correo de verificación» muestra «${RESENT_TITLE}»; sigue viendo «${SENT_TITLE}» con ${email}; POST /api/auth/resend con el correo de la solicitud; no inicia sesión`;
  const opened = await openRegisterFromLogin(page);
  if (opened) return preparationFailedWeb(expected, opened);
  const filled = await fillMobileForm(page, validValues(email));
  if (filled) return actionMissing(expected, filled);
  const sent = await submit(page);
  if (sent) return actionMissing(expected, sent);
  const panel = await waitUntil(() => isVisible(sentPanel(page)), CEILING_MS);
  if (!panel.reached) return preparationFailedWeb(expected, `no llega «${SENT_TITLE}» tras enviar la solicitud`);
  const resends = watchPosts(page, '/auth/resend');
  const checks: Check[] = [];
  for (let press = 1; press <= times; press += 1) {
    const pressed = await runSteps([['pulsar «Reenviar correo de verificación»', () => resendButton(page).click(ACTION)]]);
    if (pressed) return actionMissing(expected, pressed);
    const seen = await waitUntil(async () => (await okToastTitles(page)).filter((title) => title === RESENT_TITLE).length >= press, CEILING_MS);
    checks.push(check(seen.reached, `en la pulsación ${press} aparece el aviso «${RESENT_TITLE}»`, seen.reached ? `aparece el aviso «${RESENT_TITLE}» en la pulsación ${press}` : `no aparece el aviso en la pulsación ${press}`));
  }
  const reading = await readSent(page);
  checks.push(check(reading.visible && reading.text.includes(`${SENT_TEXT} ${email}`), `sigue viendo «${SENT_TITLE}» con el mismo correo`, reading.visible ? `sigue viendo «${SENT_TITLE}»` : `no sigue viendo «${SENT_TITLE}»`));
  const posts = resends.posts();
  const toEmail = posts.every((post) => emailOfBody(post.body) === email);
  checks.push(check(posts.length === times && toEmail, `POST /api/auth/resend ${times} vez(ces) con el correo de la solicitud`, `POST /api/auth/resend: ${posts.length}; con el correo de la solicitud: ${toEmail ? 'sí' : 'no'}`));
  checks.push(await noSessionCheck(page, onLoginForm, onPrograms));
  return conclude(checks);
};

// --- Esquema 5: volver al inicio de sesión desde la vista de la solicitud -----------------------------------------------------

const backFromSent: BrowserRowHandler = async (row, { page }) => {
  await resetTenants([TENANT_A]);
  const arrival = strict('llegada', ARRIVALS, cell(row, 'llegada'));
  const expected = 'llega a /login sin sesión iniciada';
  const email = newAccountEmail();
  const tenantHeader = watchTenantHeader(page);
  const opened = arrival === 'desde-login' ? await openRegisterFromLogin(page) : await openRegisterDirectly(page);
  if (opened) return preparationFailedWeb(expected, opened);
  const filled = await fillMobileForm(page, validValues(email));
  if (filled) return actionMissing(expected, filled);
  const sent = await submit(page);
  if (sent) return actionMissing(expected, sent);
  const panel = await waitUntil(() => isVisible(sentPanel(page)), CEILING_MS);
  if (!panel.reached) return preparationFailedWeb(expected, `no llega «${SENT_TITLE}» tras enviar la solicitud`);
  // La fila debe enviarse al tenant alumno01 (en el enlace directo, el que quedó guardado en «Tenant de trabajo»)
  const sentTo = tenantHeader();
  if (sentTo !== TENANT_A) return preparationFailedWeb(expected, `la solicitud sale con x-tenant ${sentTo ?? '(sin cabecera)'}, no con ${TENANT_A}`);
  const back = await runSteps([['pulsar «Volver al inicio de sesión»', () => backButton(page).click(ACTION)]]);
  if (back) return actionMissing(expected, back);
  const arrived = await waitUntil(() => onLoginForm(page), CEILING_MS);
  return conclude(
    [
      check(arrived.reached, 'llega a /login', arrived.reached ? 'llega a /login' : `no llega a /login (ruta ${pathOf(page)})`),
      await noSessionCheck(page, onLoginForm, onPrograms),
    ],
    arrival === 'enlace-directo' ? { note: DIRECT_APPROXIMATION } : undefined,
  );
};

defineBrowserRows({
  story: 'US-REGISTRO-015',
  surface: 'expo-web',
  tenants: [TENANT_A],
  handlers: new Map<number, BrowserRowHandler>([
    [1, onExpoWeb(duplicate)],
    [2, onExpoWeb(acceptedView)],
    [3, onExpoWeb(busyWhileWaiting)],
    [4, onExpoWeb(resendEach)],
    [5, onExpoWeb(backFromSent)],
  ]),
});
