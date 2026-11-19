import type { Page } from '@playwright/test';
import { TENANT_A, resetTenants } from '../../../story-runs/support/prepare';
import { ACTION, noSessionCheck, pathOf, runSteps, waitUntil } from '../../support/browser';
import { cell, check, conclude, preparationFailedWeb, sleep, strict } from '../../support/checks';
import { defineBrowserRows, type BrowserRowHandler } from '../../core/framework';
import {
  LOCAL_MS,
  OBSERVE_MS,
  SENT_NOTICE,
  actionMissing,
  boxOf,
  fieldValue,
  interceptForgot,
  isAbove,
  sampleUntilReleased,
  unknownEmail,
  visibilityOf,
  watchForgot,
  type ForgotPlan,
} from '../web/common';
import {
  KEYBOARD_NOTE,
  dangerTitles,
  emailBox,
  onExpoWeb,
  onLoginForm,
  onPrograms,
  openForgotDirect,
  sendAvailable,
  sendBusy,
  sendButton,
  sentNotice,
} from './common';

// US-RECUPERAR-007 — Envío de la petición en la app móvil (Expo web a 390 px; NO es nativo): aviso de éxito, botón ocupado, aviso de error y
// tecla de envío. Preparación de cada fila: reinicio de alumno01 con el token de su administrador y /forgot en un navegador sin sesión. Las
// respuestas retrasadas, fallidas o cortadas se fijan en la prueba; el resto de la red es real.

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
  const expected = `ve el aviso «${SENT_NOTICE}» encima del campo «Correo electrónico»; sigue en /forgot sin sesión iniciada con ${cell(row, 'correo')} en «Correo electrónico»; la petición se envía una vez`;
  const opened = await openForgotDirect(page);
  if (opened) return preparationFailedWeb(expected, opened);
  const watch = watchForgot(page);
  const failure = await runSteps([
    ['escribir «Correo electrónico»', () => emailBox(page).fill(email, ACTION)],
    ['pulsar «Enviar enlace»', () => sendButton(page).click(ACTION)],
  ]);
  if (failure) return actionMissing(expected, failure);
  const shown = await waitUntil(async () => (await visibilityOf(sentNotice(page))) === 'visible');
  const notice = await boxOf(sentNotice(page));
  const field = await boxOf(emailBox(page));
  const value = await fieldValue(emailBox(page));
  // Ventana única: que la petición no se repite se observa durante el mismo intervalo
  await sleep(OBSERVE_MS);
  const sent = watch.count();
  return conclude([
    check(shown.reached, `ve el aviso «${SENT_NOTICE}»`, shown.reached ? `ve el aviso «${SENT_NOTICE}»` : 'no ve el aviso de éxito'),
    check(isAbove(notice, field), 'el aviso queda encima del campo «Correo electrónico»', isAbove(notice, field) ? 'el aviso queda encima del campo' : 'el aviso no queda encima del campo'),
    check(pathOf(page) === '/forgot' && value === email, `sigue en /forgot con ${cell(row, 'correo')} en «Correo electrónico»`, `ruta ${pathOf(page)}; en «Correo electrónico» ${value ?? '(no legible)'}`),
    check(sent === 1, 'la petición se envía una vez', `peticiones enviadas: ${sent}`),
    await noSessionCheck(page, onLoginForm, onPrograms),
  ]);
};

// --- Esquema 2: mientras espera la respuesta no se puede volver a enviar -----------------------------------------------------

const DELAYS: ReadonlyMap<string, number> = new Map<string, number>([
  ['1 segundo', 1_000],
  ['3 segundos', 3_000],
]);

const busy: BrowserRowHandler = async (row, { page }) => {
  await resetTenants([TENANT_A]);
  const delay = strict('espera', DELAYS, cell(row, 'espera'));
  const expected = `durante la espera «Enviar enlace» muestra que está ocupado y no se puede volver a pulsar; al llegar la respuesta ve el aviso «${SENT_NOTICE}»; la petición se envía una vez`;
  const opened = await openForgotDirect(page);
  if (opened) return preparationFailedWeb(expected, opened);
  const typed = await runSteps([['escribir «Correo electrónico»', () => emailBox(page).fill('gestor@sigpro.test', ACTION)]]);
  if (typed) return preparationFailedWeb(expected, typed);
  // La prueba retrasa la respuesta del POST; la pulsación forzada durante la espera comprueba que no se vuelve a enviar
  const gate = await interceptForgot(page, { kind: 'delay', ms: delay });
  const watch = watchForgot(page);
  const failure = await runSteps([['pulsar «Enviar enlace»', () => sendButton(page).click(ACTION)]]);
  if (failure) return actionMissing(expected, failure);
  const appeared = await waitUntil(() => sendBusy(page), LOCAL_MS);
  const samples = appeared.reached
    ? await sampleUntilReleased(gate, () => sendBusy(page), delay + 5_000, async () => {
        await sendButton(page).click({ force: true, timeout: 500 }).catch(() => undefined);
      })
    : [];
  const notice = await waitUntil(async () => (await visibilityOf(sentNotice(page))) === 'visible');
  const sent = watch.count();
  return conclude([
    check(
      appeared.reached && samples.length >= 3 && samples.every(Boolean),
      'durante la espera «Enviar enlace» muestra que está ocupado y no se puede volver a pulsar',
      `muestras ocupadas: ${samples.filter(Boolean).length} de ${samples.length}`,
    ),
    check(notice.reached, `al llegar la respuesta ve el aviso «${SENT_NOTICE}»`, notice.reached ? `ve el aviso «${SENT_NOTICE}»` : 'no ve el aviso de éxito'),
    check(sent === 1, 'la petición se envía una vez, también con la pulsación forzada durante la espera', `peticiones enviadas: ${sent}`),
  ]);
};

// --- Esquema 3: el teclado envía la petición igual que el botón --------------------------------------------------------------

/** Cómo se envía: `note` es la aproximación declarada («» si no hay ninguna). */
interface SubmitWay {
  readonly act: (page: Page) => Promise<unknown>;
  readonly note: string;
}

/** El botón, o la tecla de envío del teclado (Enter en el campo, con su aproximación declarada). */
const SUBMIT_WAYS: ReadonlyMap<string, SubmitWay> = new Map<string, SubmitWay>([
  ['pulsa «Enviar enlace»', { act: (page) => sendButton(page).click(ACTION), note: '' }],
  ['pulsa la tecla de envío del teclado en el campo «Correo electrónico»', { act: (page) => emailBox(page).press('Enter', ACTION), note: KEYBOARD_NOTE }],
]);

const submitBy: BrowserRowHandler = async (row, { page }) => {
  await resetTenants([TENANT_A]);
  const way = strict('envio', SUBMIT_WAYS, cell(row, 'envio'));
  const expected = `ve el aviso «${SENT_NOTICE}»; la petición se envía una vez`;
  const opened = await openForgotDirect(page);
  if (opened) return preparationFailedWeb(expected, opened);
  const typed = await runSteps([['escribir «Correo electrónico»', () => emailBox(page).fill('gestor@sigpro.test', ACTION)]]);
  if (typed) return preparationFailedWeb(expected, typed);
  const watch = watchForgot(page);
  const failure = await runSteps([['usar el envío de la fila', () => way.act(page)]]);
  if (failure) return actionMissing(expected, failure);
  const shown = await waitUntil(async () => (await visibilityOf(sentNotice(page))) === 'visible');
  const sent = watch.count();
  return conclude(
    [
      check(shown.reached, `ve el aviso «${SENT_NOTICE}»`, shown.reached ? `ve el aviso «${SENT_NOTICE}»` : 'no ve el aviso de éxito'),
      check(sent === 1, 'la petición se envía una vez', `peticiones enviadas: ${sent}`),
    ],
    way.note === '' ? {} : { note: way.note },
  );
};

// --- Esquema 4: si la petición falla no aparece el aviso de éxito y se avisa del error --------------------------------------

const FAILURES: ReadonlyMap<string, ForgotPlan> = new Map<string, ForgotPlan>([
  ['POST /api/auth/forgot responda con un error 500', { kind: 'status', status: 500 }],
  ['la conexión con POST /api/auth/forgot se corte', { kind: 'abort' }],
]);

const TITLES: ReadonlyMap<string, string> = new Map<string, string>([
  ['«Ha ocurrido un error inesperado»', 'Ha ocurrido un error inesperado'],
  ['«No se pudo contactar con el servidor»', 'No se pudo contactar con el servidor'],
]);

const fails: BrowserRowHandler = async (row, { page }) => {
  await resetTenants([TENANT_A]);
  const plan = strict('fallo', FAILURES, cell(row, 'fallo'));
  const title = strict('titulo', TITLES, cell(row, 'titulo'));
  const expected = `ve un aviso emergente de error con el título «${title}»; no ve el aviso de éxito; «Enviar enlace» vuelve a estar disponible; el aviso se cierra solo a los 3 segundos; la petición se envía una vez`;
  const opened = await openForgotDirect(page);
  if (opened) return preparationFailedWeb(expected, opened);
  const typed = await runSteps([['escribir «Correo electrónico»', () => emailBox(page).fill('gestor@sigpro.test', ACTION)]]);
  if (typed) return preparationFailedWeb(expected, typed);
  const watch = watchForgot(page);
  // La prueba hace fallar POST /api/auth/forgot (error 500 o corte de la conexión)
  const gate = await interceptForgot(page, plan);
  const failure = await runSteps([['pulsar «Enviar enlace»', () => sendButton(page).click(ACTION)]]);
  if (failure) return actionMissing(expected, failure);
  const answered = await waitUntil(async () => gate.answered());
  const toast = await waitUntil(async () => (await dangerTitles(page)).includes(title));
  // Los títulos se leen justo al detectar el aviso: después se cierra solo
  const titlesSeen = await dangerTitles(page);
  // El aviso emergente debe cerrarse solo; el tiempo se mide desde que se vio (la historia fija 3 segundos; tolerancia de 1 segundo)
  const closed = toast.reached ? await waitUntil(async () => !(await dangerTitles(page)).includes(title), 6_000) : { reached: false, elapsedMs: 0 };
  const available = await waitUntil(() => sendAvailable(page));
  const notice = await visibilityOf(sentNotice(page));
  // Un fallo de red de la petición lo causa el arnés (p. ej. una respuesta simulada mal formada), no la app: ni es hallazgo ni se juzga
  const expectedFailures = plan.kind === 'abort' ? 1 : 0;
  await waitUntil(async () => watch.failures() === expectedFailures, 2_000);
  const failures = watch.failures();
  if (failures !== expectedFailures) throw new Error(`arnés: POST /api/auth/forgot tuvo ${failures} fallos de red (se esperaba ${expectedFailures}) con «${cell(row, 'fallo')}»; no lo causa la app`);
  const sent = watch.count();
  return conclude([
    check(answered.reached, `la petición llega a POST /api/auth/forgot (${cell(row, 'fallo')})`, answered.reached ? 'la petición llega a POST /api/auth/forgot' : 'la petición no llega a POST /api/auth/forgot'),
    check(toast.reached, `ve un aviso emergente de error con el título «${title}»`, toast.reached ? `ve «${title}»` : `avisos de error vistos: ${titlesSeen.join(' / ') || 'ninguno'}`),
    // Cota superior y cota inferior: a los 3 s desde que se muestra, con 1 s de tolerancia (no antes de 2 s ni después de 4 s)
    check(
      closed.reached && closed.elapsedMs >= 2_000 && closed.elapsedMs <= 4_000,
      'el aviso emergente se cierra solo a los 3 segundos (tolerancia de 1 segundo)',
      closed.reached ? `se cierra ${closed.elapsedMs} ms después de verlo` : 'no se cierra en 6 segundos',
    ),
    check(notice === 'hidden', 'no ve el aviso de éxito', notice === 'visible' ? 've el aviso de éxito' : `lectura del aviso de éxito: ${notice}`),
    check(available.reached, '«Enviar enlace» vuelve a estar disponible', available.reached ? '«Enviar enlace» disponible' : '«Enviar enlace» sigue ocupado o deshabilitado'),
    check(sent === 1, 'la petición se envía una vez', `peticiones enviadas: ${sent}`),
  ]);
};

defineBrowserRows({
  story: 'US-RECUPERAR-007',
  surface: 'expo-web',
  tenants: [TENANT_A],
  handlers: new Map<number, BrowserRowHandler>([
    [1, onExpoWeb(sends)],
    [2, onExpoWeb(busy)],
    [3, onExpoWeb(submitBy)],
    [4, onExpoWeb(fails)],
  ]),
});
