import { TENANT_A, resetTenants } from '../../../story-runs/support/prepare';
import { ACCESO_TESTIDS } from '../../../../packages/shared/src/testids';
import { ACTION, attrOf, isDisabled, noSessionCheck, pathOf, runSteps, waitUntil } from '../../support/browser';
import { cell, check, conclude, preparationFailedWeb, sleep, strict } from '../../support/checks';
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
  onLoginForm,
  onPrograms,
  openForgot,
  sampleUntilReleased,
  sentNotice,
  submitButton,
  submitSteps,
  unknownEmail,
  visibilityOf,
  watchForgot,
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
  if (opened) return preparationFailedWeb(expected, opened);
  const watch = watchForgot(page);
  const failure = await runSteps(submitSteps(page, email));
  if (failure) return actionMissing(expected, failure);
  const shown = await waitUntil(async () => (await visibilityOf(sentNotice(page))) === 'visible');
  const notice = await boxOf(sentNotice(page));
  const field = await boxOf(emailField(page));
  const value = await fieldValue(emailField(page));
  // Ventana única: que la petición no se repite se observa durante el mismo intervalo
  await sleep(OBSERVE_MS);
  const sent = watch.count();
  return conclude([
    check(shown.reached, `ve el aviso «${SENT_NOTICE}»`, shown.reached ? `ve el aviso «${SENT_NOTICE}»` : 'no ve el aviso de éxito'),
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
  const expected = `durante la espera «Enviar enlace» está deshabilitado con «${PROCESSING}» y con indicador de carga; al llegar la respuesta ve el aviso «${SENT_NOTICE}»; la petición se envía una vez`;
  const opened = await openForgot(page);
  if (opened) return preparationFailedWeb(expected, opened);
  const typed = await runSteps([['escribir «Correo electrónico»', () => emailField(page).fill('gestor@sigpro.test', ACTION)]]);
  if (typed) return preparationFailedWeb(expected, typed);
  // La prueba retrasa la respuesta del POST: se fija el retardo y el resto de la red sigue igual
  const gate = await interceptForgot(page, { kind: 'delay', ms: delay });
  const watch = watchForgot(page);
  const control = submitButton(page);
  const failure = await runSteps([['pulsar «Enviar enlace»', () => control.click(ACTION)]]);
  if (failure) return actionMissing(expected, failure);
  // «Ocupado» = deshabilitado, con la explicación «Procesando…» en `title` y el indicador de carga visible
  const busyNow = async (): Promise<boolean> =>
    (await isDisabled(control)) && (await attrOf(control, 'title')) === PROCESSING && (await visibilityOf(control.getByTestId(ACCESO_TESTIDS.SPINNER))) === 'visible';
  const appeared = await waitUntil(busyNow, LOCAL_MS);
  const samples = appeared.reached
    ? await sampleUntilReleased(gate, busyNow, delay + 5_000, async () => {
        // Una pulsación forzada durante la espera: si el control no estuviera de verdad deshabilitado, saldría otro POST
        await control.click({ force: true, timeout: 500 }).catch(() => undefined);
      })
    : [];
  const notice = await waitUntil(async () => (await visibilityOf(sentNotice(page))) === 'visible');
  const sent = watch.count();
  return conclude([
    check(
      appeared.reached && samples.length >= 3 && samples.every(Boolean),
      `durante la espera «Enviar enlace» está deshabilitado con «${PROCESSING}» y con indicador de carga`,
      `muestras con el control ocupado: ${samples.filter(Boolean).length} de ${samples.length}`,
    ),
    check(notice.reached, `al llegar la respuesta ve el aviso «${SENT_NOTICE}»`, notice.reached ? `ve el aviso «${SENT_NOTICE}»` : 'no ve el aviso de éxito'),
    check(sent === 1, 'la petición se envía una vez, también con la pulsación forzada durante la espera', `peticiones enviadas: ${sent}`),
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
  if (opened) return preparationFailedWeb(expected, opened);
  const watch = watchForgot(page);
  // La prueba responde el error del servidor a POST /api/auth/forgot; el resto de la red sigue igual
  const gate = await interceptForgot(page, { kind: 'status', status });
  const failure = await runSteps(submitSteps(page, 'gestor@sigpro.test'));
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
