import type { Page } from '@playwright/test';
import { usersByEmail } from '../../../story-runs/support/api';
import { TENANT_A, resetTenants } from '../../../story-runs/support/prepare';
import { ACCESO_TESTIDS } from '../../../../packages/shared/src/testids';
import { ACTION, CEILING_MS, attrOf, isDisabled, isVisible, linesOf, noSessionCheck, pathOf, runSteps, textOf, valueOf, waitUntil } from '../../support/browser';
import { check, cell, conclude, preparationFailedWeb, strict, type Check } from '../../support/checks';
import { defineBrowserRows, type BrowserRowHandler } from '../../support/framework';
import {
  DUPLICATE_MESSAGE,
  EMAIL_NOTE,
  PROCESSING,
  SENT_TEXT,
  SENT_TITLE,
  actionMissing,
  currentYears,
  delayRegister,
  field,
  fillForm,
  newAccountEmail,
  okToastTitles,
  onLoginForm,
  onPrograms,
  openRegister,
  readSent,
  sentLine,
  requestIdLine,
  sentPanel,
  submit,
  submitButton,
  validValues,
  type FormValues,
} from './common';

// US-REGISTRO-011 — Enviar la solicitud (web): aviso de correo ya registrado y vista «Solicitud enviada». Preparación de cada fila:
// reinicio de alumno01 con su administrador y /register?tenant=alumno01 en un navegador sin sesión. Los correos con cuenta son del
// seed de alumno01 (se comprueban en el listado del tenant antes de enviar).

const ACCOUNT_EMAILS: ReadonlyMap<string, string> = new Map([
  ['admin@sigpro.test', 'admin@sigpro.test'],
  ['(GESTOR@sigpro.test con un espacio delante y otro detrás)', ' GESTOR@sigpro.test '],
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

/** Los datos escritos siguen en el formulario. El correo se compara sin los espacios de los extremos: el campo de tipo correo los recorta. */
const keptValues = async (page: Page, values: FormValues, typedEmail: string): Promise<boolean> => {
  const email = await valueOf(field(page, 'Correo corporativo'));
  const readings = [
    await valueOf(field(page, 'Nombre')),
    await valueOf(field(page, 'Apellidos')),
    await valueOf(field(page, 'Organización / Unidad')),
    await valueOf(field(page, 'Contraseña')),
    await valueOf(field(page, 'Confirmar contraseña')),
  ];
  const expected = [values.first, values.last, values.org, values.password, values.confirm];
  return readings.every((reading, index) => reading === expected[index]) && email?.trim() === typedEmail.trim();
};

// --- Esquema 1: un correo que ya tiene cuenta en el tenant muestra el aviso y conserva lo escrito ------------------------------

const duplicate: BrowserRowHandler = async (row, { page }) => {
  await resetTenants([TENANT_A]);
  const typed = strict('correo', ACCOUNT_EMAILS, cell(row, 'correo'));
  const account = typed.trim().toLowerCase();
  const expected = `ve encima de los campos «${DUPLICATE_MESSAGE}»; sigue en /register sin sesión, con los datos escritos`;
  // La cuenta es una del seed: se comprueba en el listado del tenant antes de enviar
  const users = await usersByEmail(TENANT_A);
  if (!users.has(account)) return preparationFailedWeb(expected, `${account} no está en el listado de alumno01`);
  const opened = await openRegister(page);
  if (opened) return preparationFailedWeb(expected, opened);
  const values = validValues(typed);
  const filled = await fillForm(page, values);
  if (filled) return actionMissing(expected, filled);
  const sent = await submit(page);
  if (sent) return actionMissing(expected, sent);
  const alert = page.getByRole('alert').first();
  const reached = await waitUntil(async () => linesOf(await textOf(alert))[0] === DUPLICATE_MESSAGE, CEILING_MS);
  const shown = linesOf(await textOf(alert))[0];
  const kept = await keptValues(page, values, typed);
  const alertBox = await alert.boundingBox({ timeout: 500 }).catch(() => null);
  const nameBox = await field(page, 'Nombre').boundingBox({ timeout: 500 }).catch(() => null);
  const above = alertBox !== null && nameBox !== null && alertBox.y + alertBox.height <= nameBox.y;
  const checks: Check[] = [
    check(reached.reached, `ve encima de los campos «${DUPLICATE_MESSAGE}»`, shown === undefined ? 'no ve ningún aviso de error del servidor' : `ve «${shown}»`),
    check(above, 'el aviso va encima de los campos', above ? 'el aviso va encima de los campos' : 'el aviso no va encima de «Nombre»'),
    check(pathOf(page) === '/register' && kept, 'sigue en /register con los datos escritos', `ruta ${pathOf(page)}; datos ${kept ? 'conservados' : 'perdidos'}`),
  ];
  checks.push(await noSessionCheck(page, onLoginForm, onPrograms));
  return conclude(checks, typed !== typed.trim() ? { note: EMAIL_NOTE } : {});
};

// --- Esquema 2: una solicitud correcta muestra «Solicitud enviada» con su estado ---------------------------------------------

const accepted: BrowserRowHandler = async (row, { page }) => {
  await resetTenants([TENANT_A]);
  const role = strict('rol', ROLES, cell(row, 'rol'));
  const email = newAccountEmail();
  const expected = `ve «${SENT_TITLE}», «${SENT_TEXT}» ${email}, «Pendiente de aprobación», el rol ${role} y un REQ-AAAA-NNNN; sigue en /register sin sesión; aviso «${SENT_TITLE}»`;
  const opened = await openRegister(page);
  if (opened) return preparationFailedWeb(expected, opened);
  const filled = await fillForm(page, validValues(email, role));
  if (filled) return actionMissing(expected, filled);
  const sent = await submit(page);
  if (sent) return actionMissing(expected, sent);
  const panel = await waitUntil(() => isVisible(sentPanel(page)), CEILING_MS);
  const reading = await readSent(page);
  const toast = await waitUntil(async () => (await okToastTitles(page)).includes(SENT_TITLE), CEILING_MS);
  const requestId = requestIdLine(reading.lines);
  const checks: Check[] = [
    check(panel.reached, `ve el título «${SENT_TITLE}»`, panel.reached ? `ve el título «${SENT_TITLE}»` : `no aparece la vista «${SENT_TITLE}»`),
    check(reading.text.includes(`${SENT_TEXT} ${email}`), `ve «${SENT_TEXT}» seguido de ${email}`, sentLine(reading.lines) ?? 'no ve el texto de verificación'),
    check(reading.lines.includes('Pendiente de aprobación'), 've el estado «Pendiente de aprobación»', reading.lines.includes('Pendiente de aprobación') ? 've el estado «Pendiente de aprobación»' : 'no ve el estado'),
    check(reading.lines.includes(role), `ve el rol ${role}`, reading.lines.includes(role) ? `ve el rol ${role}` : 'no ve el rol'),
    check(requestId !== undefined && currentYears().includes(requestId.slice(4, 8)), 've un identificador REQ-AAAA-NNNN del año en curso', requestId === undefined ? 'no ve identificador de solicitud' : `identificador ${requestId}`),
    check(pathOf(page) === '/register', 'sigue en /register', `ruta ${pathOf(page)}`),
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
  const expected = `durante la espera «Enviar solicitud» deshabilitado con la explicación «${PROCESSING}»; al llegar la respuesta ve «${SENT_TITLE}»`;
  const opened = await openRegister(page);
  if (opened) return preparationFailedWeb(expected, opened);
  const filled = await fillForm(page, validValues(email));
  if (filled) return actionMissing(expected, filled);
  // La prueba retrasa la respuesta de la API en el navegador: la pantalla debe quedar ocupada durante ese retardo
  await delayRegister(page, delay);
  const pressed = await runSteps([['pulsar «Enviar solicitud»', () => submitButton(page).click(ACTION)]]);
  if (pressed) return actionMissing(expected, pressed);
  const busy = await waitUntil(() => isDisabled(submitButton(page)), CEILING_MS);
  const explanation = await attrOf(submitButton(page), 'title');
  const formBusy = await attrOf(page.getByTestId(ACCESO_TESTIDS.REGISTER_FORM), 'aria-busy');
  const arrived = await waitUntil(() => isVisible(sentPanel(page)), CEILING_MS);
  return conclude([
    check(busy.reached && explanation === PROCESSING, `durante la espera «Enviar solicitud» deshabilitado con la explicación «${PROCESSING}»`, busy.reached ? `deshabilitado con la explicación «${explanation ?? '(ninguna)'}»` : 'no queda deshabilitado durante la espera'),
    check(formBusy === 'true', 'durante la espera el formulario está ocupado', `formulario aria-busy=${formBusy ?? '(sin atributo)'}`),
    check(arrived.reached, `al llegar la respuesta ve el título «${SENT_TITLE}»`, arrived.reached ? `ve «${SENT_TITLE}»` : `no llega «${SENT_TITLE}»`),
  ]);
};

defineBrowserRows({
  story: 'US-REGISTRO-011',
  surface: 'web',
  tenants: [TENANT_A],
  handlers: new Map<number, BrowserRowHandler>([
    [1, duplicate],
    [2, accepted],
    [3, busyWhileWaiting],
  ]),
});
