import { TENANT_A, resetTenants } from '../../../story-runs/support/prepare';
import { ACCESO_TESTIDS } from '../../../../packages/shared/src/testids';
import { ACTION, attrOf, isDisabled, noSessionCheck, pathOf, waitUntil } from '../../support/browser';
import { cell, check, conclude, sleep, strict } from '../../support/checks';
import { defineBrowserRows, type BrowserRowHandler } from '../../core/framework';
import {
  LOCAL_MS,
  OBSERVE_MS,
  PROCESSING,
  SENT_NOTICE,
  actionMissing,
  boxOf,
  emailField,
  enabledOf,
  fieldValue,
  interceptForgot,
  isAbove,
  messageOf,
  onLoginForm,
  onPrograms,
  openForgot,
  preparationMissedWeb,
  runStepsLogged,
  sampleUntilReleased,
  sentNotice,
  submitButton,
  submitSteps,
  unknownEmail,
  visibilityOf,
  watchForgot,
  type BusyReading,
} from './common';

// US-RECUPERAR-005 — Envío de la petición en la web: aviso de éxito, botón ocupado y fallo sin aviso de éxito. Preparación de cada fila:
// reinicio de alumno01 con el token de su administrador y /forgot?tenant=alumno01 en un navegador sin sesión (contexto nuevo). Las
// respuestas retrasadas o fallidas se fijan en la prueba (retrasar, responder un error o cortar el POST); el resto de la red es real.

// --- Esquema 1: un correo válido muestra el aviso y la pantalla no cambia ---------------------------------------------------

const SENT_EMAILS: ReadonlyMap<string, () => string> = new Map<string, () => string>([
  ['gestor@sigpro.test', () => 'gestor@sigpro.test'],
  ['pendiente@sigpro.test', () => 'pendiente@sigpro.test'],
  ['(correo sin cuenta)', () => unknownEmail()],
  ['a@b.c', () => 'a@b.c'],
]);

const sends: BrowserRowHandler = async (row, { page }) => {
  await resetTenants([TENANT_A]);
  const email = strict('correo', SENT_EMAILS, cell(row, 'correo'))();
  const expected = `ve el aviso «${SENT_NOTICE}» encima del campo «Correo electrónico»; sigue en /forgot sin sesión iniciada con ${cell(row, 'correo')} escrito; la petición se envía una vez`;
  const opened = await openForgot(page);
  if (opened) return preparationMissedWeb(expected, opened);
  const watch = watchForgot(page);
  const failure = await runStepsLogged(submitSteps(page, email));
  if (failure) return actionMissing(expected, failure);
  const shown = await waitUntil(async () => (await messageOf(sentNotice(page))) === SENT_NOTICE);
  const text = await messageOf(sentNotice(page));
  const notice = await boxOf(sentNotice(page));
  const field = await boxOf(emailField(page));
  const value = await fieldValue(emailField(page));
  // Ventana única: que la petición no se repite se observa durante el mismo intervalo
  await sleep(OBSERVE_MS);
  const sent = watch.count();
  return conclude([
    check(shown.reached, `ve el aviso «${SENT_NOTICE}»`, shown.reached ? `ve el aviso «${text ?? ''}»` : `ve «${text ?? '(nada legible)'}» en lugar del aviso`),
    check(isAbove(notice, field), 'el aviso queda encima del campo «Correo electrónico»', isAbove(notice, field) ? 'el aviso queda encima del campo' : 'el aviso no queda encima del campo'),
    check(pathOf(page) === '/forgot' && value === email, `sigue en /forgot con ${cell(row, 'correo')} escrito`, `ruta ${pathOf(page)}; ve en «Correo electrónico» ${value ?? '(no legible)'}`),
    check(sent === 1, 'la petición se envía una vez', `peticiones enviadas: ${sent}`),
    await noSessionCheck(page, onLoginForm, onPrograms),
  ]);
};

// --- Esquema 2: mientras espera la respuesta el botón no se puede volver a pulsar --------------------------------------------

const DELAYS: ReadonlyMap<string, number> = new Map<string, number>([
  ['1 segundo', 1_000],
  ['3 segundos', 3_000],
]);

const busy: BrowserRowHandler = async (row, { page }) => {
  await resetTenants([TENANT_A]);
  const delay = strict('espera', DELAYS, cell(row, 'espera'));
  const expected = `durante la espera «Enviar enlace» está deshabilitado con «${PROCESSING}» y con indicador de carga, y el aviso de éxito no aparece; al llegar la respuesta ve el aviso «${SENT_NOTICE}»; la petición se envía una vez, también si se pulsa Enter en el campo durante la espera`;
  const opened = await openForgot(page);
  if (opened) return preparationMissedWeb(expected, opened);
  const typed = await runStepsLogged([['escribir «Correo electrónico»', () => emailField(page).fill('gestor@sigpro.test', ACTION)]]);
  if (typed) return preparationMissedWeb(expected, typed);
  // La prueba retrasa la respuesta del POST: se fija el retardo y el resto de la red sigue igual
  const gate = await interceptForgot(page, { kind: 'delay', ms: delay });
  const watch = watchForgot(page);
  const control = submitButton(page);
  const failure = await runStepsLogged([['pulsar «Enviar enlace»', () => control.click(ACTION)]]);
  if (failure) return actionMissing(expected, failure);
  // «Ocupado» = deshabilitado, con la explicación «Procesando…» en `title` y el indicador de carga visible
  const busyNow = async (): Promise<boolean> =>
    (await isDisabled(control)) && (await attrOf(control, 'title')) === PROCESSING && (await visibilityOf(control.getByTestId(ACCESO_TESTIDS.SPINNER))) === 'visible';
  const readBusy = async (): Promise<BusyReading> => ({ busy: await busyNow(), noticeHidden: (await visibilityOf(sentNotice(page))) === 'hidden' });
  const appeared = await waitUntil(busyNow, LOCAL_MS);
  // Se guarda en un objeto para que las lecturas posteriores no se estrechen a sus valores iniciales
  const probe = { enterPressed: false, afterEnter: -1 };
  const samples = appeared.reached
    ? await sampleUntilReleased(gate, readBusy, { busy: false, noticeHidden: false }, delay + 5_000, async () => {
        // Pulsación forzada del control y Enter en el campo durante la espera: el envío no debe repetirse (en la web el envío es un formulario)
        await control.click({ force: true, timeout: 500 }).catch(() => undefined);
        probe.enterPressed = await emailField(page).press('Enter', ACTION).then(
          () => true,
          () => false,
        );
        await sleep(300);
        probe.afterEnter = watch.count();
      })
    : [];
  const notice = await waitUntil(async () => (await messageOf(sentNotice(page))) === SENT_NOTICE);
  const shownText = await messageOf(sentNotice(page));
  const sent = watch.count();
  return conclude([
    check(
      appeared.reached && samples.length >= 3 && samples.every((sample) => sample.busy),
      `durante la espera «Enviar enlace» está deshabilitado con «${PROCESSING}» y con indicador de carga`,
      `muestras con el control ocupado: ${samples.filter((sample) => sample.busy).length} de ${samples.length}`,
    ),
    check(
      samples.length > 0 && samples.every((sample) => sample.noticeHidden),
      'durante la espera el aviso de éxito no aparece',
      `muestras con el aviso oculto: ${samples.filter((sample) => sample.noticeHidden).length} de ${samples.length}`,
    ),
    check(probe.enterPressed && probe.afterEnter === 1, 'pulsar Enter en el campo durante la espera no envía otra petición', `Enter ${probe.enterPressed ? 'pulsado' : 'no pulsado'}; peticiones tras Enter: ${probe.afterEnter}`),
    check(notice.reached, `al llegar la respuesta ve el aviso «${SENT_NOTICE}»`, notice.reached ? `ve el aviso «${shownText ?? ''}»` : `ve «${shownText ?? '(nada legible)'}» en lugar del aviso`),
    check(sent === 1, 'la petición se envía una vez, también con la pulsación forzada y Enter durante la espera', `peticiones enviadas: ${sent}`),
  ]);
};

// --- Esquema 3: si la petición falla no aparece el aviso de éxito -------------------------------------------------------------

const STATUSES: ReadonlyMap<string, number> = new Map<string, number>([
  ['500', 500],
  ['503', 503],
]);

const fails: BrowserRowHandler = async (row, { page }) => {
  await resetTenants([TENANT_A]);
  const status = strict('estado', STATUSES, cell(row, 'estado'));
  const expected = `no ve el aviso «${SENT_NOTICE}»; «Enviar enlace» vuelve a estar disponible; sigue en /forgot sin sesión iniciada; la petición se envía una vez`;
  const opened = await openForgot(page);
  if (opened) return preparationMissedWeb(expected, opened);
  const watch = watchForgot(page);
  // La prueba responde el error del servidor a POST /api/auth/forgot; el resto de la red sigue igual
  const gate = await interceptForgot(page, { kind: 'status', status });
  const failure = await runStepsLogged(submitSteps(page, 'gestor@sigpro.test'));
  if (failure) return actionMissing(expected, failure);
  const answered = await waitUntil(async () => gate.answered());
  // Tras la respuesta, el control vuelve a estar habilitado y sin «Procesando…»
  await waitUntil(async () => (await enabledOf(submitButton(page))) === true && (await attrOf(submitButton(page), 'title')) !== PROCESSING);
  await sleep(300);
  // Un fallo de red en la petición lo causa el arnés (p. ej. CORS de la respuesta simulada), no la app: no se juzga como hallazgo
  const failures = watch.failures();
  if (failures > 0) throw new Error(`arnés: POST /api/auth/forgot falló en red (${failures}) al simular ${status}; el fallo no lo causa la app`);
  const notice = await visibilityOf(sentNotice(page));
  const available = await enabledOf(submitButton(page));
  const sent = watch.count();
  return conclude([
    check(answered.reached, `la petición recibe la respuesta ${status}`, answered.reached ? `la petición recibe la respuesta ${status}` : 'la petición no llega a POST /api/auth/forgot'),
    check(notice === 'hidden', `no ve el aviso «${SENT_NOTICE}»`, notice === 'visible' ? 've el aviso de éxito' : `lectura del aviso de éxito: ${notice}`),
    check(available === true, '«Enviar enlace» vuelve a estar disponible', `«Enviar enlace» ${available === undefined ? '(no legible)' : available ? 'disponible' : 'deshabilitado'}`),
    check(sent === 1, 'la petición se envía una vez', `peticiones enviadas: ${sent}`),
    check(pathOf(page) === '/forgot', 'sigue en /forgot', `ruta ${pathOf(page)}`),
    await noSessionCheck(page, onLoginForm, onPrograms),
  ]);
};

defineBrowserRows({
  story: 'US-RECUPERAR-005',
  surface: 'web',
  tenants: [TENANT_A],
  handlers: new Map<number, BrowserRowHandler>([
    [1, sends],
    [2, busy],
    [3, fails],
  ]),
});
