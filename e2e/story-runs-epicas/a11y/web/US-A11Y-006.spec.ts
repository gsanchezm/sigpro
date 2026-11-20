import type { Locator, Page } from '@playwright/test';
import { DEMO, TENANT_A } from '../../../story-runs/support/prepare';
import { ACTION, CEILING_MS, isVisible, linesOf, noSessionCheck, pathOf, safe } from '../../support/browser';
import { check, cell, conclude, strict, type Check } from '../../support/checks';
import { defineBrowserRows, type BrowserRowHandler } from '../../core/framework';
import {
  COOKIE_NOTE,
  PASSWORDS,
  countVisible,
  describeCount,
  enterButton,
  failedAction,
  heading1,
  openLogin,
  prepFailed,
  programsTitle,
  quietCookies,
  resetAlumno,
  settle,
  submitLogin,
  typeCredentials,
  withRoutesReleased,
  runStepsLogged,
} from './common';

// US-A11Y-006 — Avisos dentro de la pantalla: alerta para los errores y estado para las confirmaciones (web, 1440 px).
// Preparación de cada fila: reinicio de alumno01 y acceso desde /login?tenant=alumno01 en un navegador sin sesión guardada.
// Un aviso se lee por su rol: el error es el `alert` de la pantalla; la confirmación, el `status`. Un mismo mensaje se mide en dos
// pasos distintos: que se VE (su texto visible, exacto) y que se ANUNCIA como estado (dentro de un `status` y no de un `alert`).
// La línea de detalle técnico que muestran los avisos de Acceso no se compara (decisión pendiente de la historia).

const MESSAGE_LINE = (node: Locator): Promise<string | undefined> => safe(async () => linesOf(await node.innerText({ timeout: 500 }))[0], undefined);

const ACCOUNTS: ReadonlyMap<string, string> = new Map([
  [DEMO.gestor.email, DEMO.gestor.email],
  [DEMO.pendiente.email, DEMO.pendiente.email],
  [DEMO.bloqueado.email, DEMO.bloqueado.email],
  [DEMO.consultor.email, DEMO.consultor.email],
]);

const REDIRECT = 'Sesión iniciada. Redirigiendo a Programas…';
const NOT_EVALUATED_NOTE = 'Reglas sin fila (no evaluadas): los avisos emergentes que se retiran solos quedan en EP-TOASTS; el aviso que aparece junto a un campo es US-A11Y-002.';

// --- Esquema 1: un error de acceso se anuncia como alerta ----------------------------------------------------------------------

const accessError: BrowserRowHandler = async (row, { page, context }) => {
  const correo = strict('correo', ACCOUNTS, cell(row, 'correo'));
  const contrasena = strict('contraseña', PASSWORDS, cell(row, 'contraseña'));
  const mensaje = cell(row, 'mensaje');
  const expected = `ve ${mensaje} como alerta y sigue en /login sin sesión iniciada`;
  const wanted = mensaje.replace(/^«|»$/g, '');
  await quietCookies(context);
  await resetAlumno();
  const opened = await runStepsLogged([openLogin(page), ['ver el título «Iniciar sesión»', () => heading1(page, 'Iniciar sesión').waitFor({ timeout: CEILING_MS })]]);
  if (opened) return prepFailed(expected, opened);
  const typed = await runStepsLogged([...typeCredentials(page, correo, contrasena), ['pulsar «Entrar»', () => enterButton(page).click(ACTION)]]);
  if (typed) return failedAction(expected, typed);
  const alert: Locator = page.getByRole('alert');
  const shown = await settle(() => countVisible(alert), (count) => count === 1);
  const first = await MESSAGE_LINE(alert);
  const stays = await noSessionCheck(page, onLoginForm, onPrograms);
  return conclude(
    [
      check(shown.ok && first === wanted, `ve el aviso ${mensaje}`, shown.ok ? `ve el aviso «${first ?? '(sin texto)'}»` : `no hay un único aviso de alerta (${describeCount(shown.value)})`),
      check(shown.ok, 'el aviso se anuncia como alerta', shown.ok ? 'el aviso es una alerta (role alert)' : 'el aviso no es una alerta'),
      stays,
    ],
    { note: `${COOKIE_NOTE} Se compara solo el primer texto del aviso; la línea de detalle técnico no se mira. ${NOT_EVALUATED_NOTE}` },
  );
};

const onLoginForm = async (page: Page): Promise<boolean> => pathOf(page) === '/login' && (await isVisible(heading1(page, 'Iniciar sesión')));
const onPrograms = async (page: Page): Promise<boolean> => pathOf(page) === '/programs' && (await isVisible(programsTitle(page)));

/**
 * Mide un mensaje de confirmación en dos pasos distintos: se VE (texto visible y exacto, una sola vez) y se ANUNCIA como estado (su
 * contenedor es un `status`, y no hay ningún `alert` que lo contenga). Los dos localizadores se arman ANTES de la acción.
 */
const armStatusMeasures = (page: Page, message: string): { readonly visible: Promise<boolean>; readonly status: Promise<boolean> } => {
  const text = page.getByText(message, { exact: true }).filter({ visible: true });
  const status = page.getByRole('status').filter({ hasText: message });
  return {
    visible: text.first().waitFor({ state: 'visible', timeout: CEILING_MS }).then(
      () => true,
      () => false,
    ),
    status: status.first().waitFor({ state: 'visible', timeout: CEILING_MS }).then(
      () => true,
      () => false,
    ),
  };
};

/** Tras la acción: el mensaje se ve (una sola vez) y está en un `status` que no es un `alert`. */
const measureStatus = async (page: Page, message: string, armed: { readonly visible: Promise<boolean>; readonly status: Promise<boolean> }): Promise<readonly Check[]> => {
  const seen = await armed.visible;
  const asStatus = await armed.status;
  const inAlert = await countVisible(page.getByRole('alert').filter({ hasText: message }));
  const visibleOnce = await countVisible(page.getByText(message, { exact: true }));
  return [
    check(seen && visibleOnce === 1, `ve «${message}»`, seen ? `ve «${message}» (${describeCount(visibleOnce)})` : `no se ve «${message}»`),
    check(asStatus && inAlert === 0, `«${message}» se anuncia como estado (no como alerta)`, asStatus ? (inAlert === 0 ? `está en un estado, fuera de cualquier alerta` : `está dentro de un alert (${inAlert})`) : 'no está en ninguna región de estado'),
  ];
};

// --- Esquema 2: la redirección al entrar se anuncia como estado ----------------------------------------------------------------

const redirectStatus: BrowserRowHandler = async (row, { page, context }) => {
  const correo = strict('correo', ACCOUNTS, cell(row, 'correo'));
  const contrasena = strict('contraseña', PASSWORDS, cell(row, 'contraseña'));
  const expected = `ve «${REDIRECT}» como estado, sin interrumpir la lectura`;
  await quietCookies(context);
  await resetAlumno();
  const opened = await runStepsLogged([openLogin(page), ['ver el título «Iniciar sesión»', () => heading1(page, 'Iniciar sesión').waitFor({ timeout: CEILING_MS })]]);
  if (opened) return prepFailed(expected, opened);
  // La pantalla de redirección dura 1,4 s: las dos medidas se arman ANTES de pulsar «Entrar»
  const armed = armStatusMeasures(page, REDIRECT);
  const typed = await runStepsLogged([...typeCredentials(page, correo, contrasena), ['pulsar «Entrar»', () => enterButton(page).click(ACTION)]]);
  if (typed) return failedAction(expected, typed);
  return conclude(await measureStatus(page, REDIRECT, armed), { note: COOKIE_NOTE });
};

// --- Esquema 3: la confirmación de cierre de sesión se anuncia como estado -----------------------------------------------------

const signedOutStatus: BrowserRowHandler = async (row, { page, context }) => {
  const aviso = cell(row, 'aviso');
  const expected = `llega a /login y ve ${aviso} como estado`;
  const wanted = aviso.replace(/^«|»$/g, '');
  await quietCookies(context);
  await resetAlumno();
  const opened = await runStepsLogged([openLogin(page), ['ver el título «Iniciar sesión»', () => heading1(page, 'Iniciar sesión').waitFor({ timeout: CEILING_MS })]]);
  if (opened) return prepFailed(expected, opened);
  const kept = await runStepsLogged([
    ...typeCredentials(page, DEMO.gestor.email, DEMO.gestor.password),
    ['marcar «Mantener la sesión en este equipo»', () => page.getByRole('checkbox', { name: 'Mantener la sesión en este equipo', exact: true }).check(ACTION)],
    submitLogin(page),
    ['llegar a /programs', () => programsTitle(page).waitFor({ timeout: CEILING_MS })],
  ]);
  if (kept) return prepFailed(expected, kept);
  // El aviso de cierre aparece en /login justo tras la navegación: las medidas se arman ANTES de pulsar «Cerrar sesión»
  const armed = armStatusMeasures(page, wanted);
  const out = await runStepsLogged([
    ['pulsar «Menú de usuario»', () => page.getByRole('button', { name: 'Menú de usuario', exact: true }).click(ACTION)],
    ['pulsar «Cerrar sesión»', () => page.getByRole('menuitem', { name: 'Cerrar sesión', exact: true }).click(ACTION)],
  ]);
  if (out) return failedAction(expected, out);
  const onLogin = await settle(
    () => onLoginForm(page),
    (value) => value,
  );
  const measures = await measureStatus(page, wanted, armed);
  return conclude([check(onLogin.ok, 'llega a /login', onLogin.ok ? 'llega a /login' : `no llega a /login (ruta ${pathOf(page)})`), ...measures], { note: `${COOKIE_NOTE} ${NOT_EVALUATED_NOTE}` });
};

defineBrowserRows({
  story: 'US-A11Y-006',
  surface: 'web',
  tenants: [TENANT_A],
  handlers: new Map<number, BrowserRowHandler>([
    [1, withRoutesReleased(accessError)],
    [2, withRoutesReleased(redirectStatus)],
    [3, withRoutesReleased(signedOutStatus)],
  ]),
});
