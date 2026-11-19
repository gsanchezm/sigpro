import type { Page } from '@playwright/test';
import { TENANT_A, resetTenants } from '../../../story-runs/support/prepare';
import { ACTION, CEILING_MS, attrOf, isEnabled, isFocused, isVisible, noSessionCheck, pathOf, quoted, runSteps, textOf, valueOf, waitUntil } from '../../support/browser';
import { check, cell, conclude, preparationFailedWeb, strict, type Check } from '../../support/checks';
import { defineBrowserRows, outcome, type BrowserRowHandler } from '../../support/framework';
import {
  HINT,
  REGISTER_URL,
  TITLE,
  backButton,
  field,
  legalLink,
  onLoginForm,
  onPrograms,
  openRegister,
  roleSelect,
  signInAsManager,
  submitButton,
  termsBox,
  titleOf,
  toggleButton,
  watchSubmissions,
} from './common';

// US-REGISTRO-008 — Formulario de solicitud: elementos, ayudas y salidas (web, /register a 1440 px). Preparación de cada fila:
// reinicio de alumno01 con su administrador y /register?tenant=alumno01 en un navegador sin sesión (contexto nuevo). El Esquema 5
// crea la sesión de gestor@sigpro.test en la propia pantalla de acceso, antes de abrir /register.

const HELP = 'Debe pertenecer a un dominio autorizado.';

// --- Esquema 1: estado inicial de cada elemento del formulario ----------------------------------------------------------------

const INITIAL: ReadonlyMap<string, (page: Page) => Promise<readonly Check[]>> = new Map<string, (page: Page) => Promise<readonly Check[]>>([
  [
    '«Solicitar acceso»',
    async (page) => {
      const title = await isVisible(titleOf(page));
      const hint = await isVisible(page.getByText(HINT, { exact: true }));
      return [check(title && hint, `título «${TITLE}» con el texto «${HINT}»`, `título ${title ? 'visible' : 'ausente'} y texto ${hint ? 'visible' : 'ausente'}`)];
    },
  ],
  [
    '«Nombre»',
    async (page) => {
      const input = field(page, 'Nombre');
      const empty = (await valueOf(input)) === '';
      const focus = await waitUntil(() => isFocused(input), 1_000);
      return [check(empty && focus.reached, 'está vacío y tiene el foco', `${empty ? 'vacío' : 'con texto'} y ${focus.reached ? 'con el foco' : 'sin el foco'}`)];
    },
  ],
  [
    '«Correo corporativo»',
    async (page) => {
      const empty = (await valueOf(field(page, 'Correo corporativo'))) === '';
      const help = await isVisible(page.getByText(HELP, { exact: true }));
      return [check(empty && help, `está vacío y muestra la ayuda «${HELP}»`, `${empty ? 'vacío' : 'con texto'} y ayuda ${help ? 'visible' : 'ausente'}`)];
    },
  ],
  [
    '«Rol solicitado»',
    async (page) => {
      const value = await valueOf(roleSelect(page));
      return [check(value === 'consultant', 'tiene seleccionado consultant', `tiene seleccionado ${String(value)}`)];
    },
  ],
  [
    '«Contraseña»',
    async (page) => {
      const input = field(page, 'Contraseña');
      const empty = (await valueOf(input)) === '';
      const hidden = (await attrOf(input, 'type')) === 'password';
      return [check(empty && hidden, 'está vacía y oculta lo que se escribe', `${empty ? 'vacía' : 'con texto'} y ${hidden ? 'oculta' : 'en claro'}`)];
    },
  ],
  [
    '«Confirmar contraseña»',
    async (page) => {
      const input = field(page, 'Confirmar contraseña');
      const empty = (await valueOf(input)) === '';
      const hidden = (await attrOf(input, 'type')) === 'password';
      return [check(empty && hidden, 'está vacía y oculta lo que se escribe', `${empty ? 'vacía' : 'con texto'} y ${hidden ? 'oculta' : 'en claro'}`)];
    },
  ],
  [
    'la casilla de condiciones',
    async (page) => {
      const checked = await termsBox(page).isChecked({ timeout: 500 }).catch(() => true);
      return [check(!checked, 'está desmarcada', checked ? 'marcada' : 'desmarcada')];
    },
  ],
  [
    '«Enviar solicitud»',
    async (page) => {
      const enabled = await isEnabled(submitButton(page));
      return [check(enabled, 'está habilitado', enabled ? 'habilitado' : 'deshabilitado')];
    },
  ],
]);

const initialState: BrowserRowHandler = async (row, { page }) => {
  await resetTenants([TENANT_A]);
  const expected = `${cell(row, 'elemento')} ${cell(row, 'estado')}`;
  const opened = await openRegister(page);
  if (opened) return preparationFailedWeb(expected, opened);
  const observe = strict('elemento', INITIAL, cell(row, 'elemento'));
  return conclude(await observe(page));
};

// --- Esquema 2: el botón de la contraseña alterna la visibilidad de las dos contraseñas --------------------------------------

const VISIBILITY: ReadonlyMap<string, boolean> = new Map([
  ['ocultas', false],
  ['en claro', true],
]);
const PRESSED: ReadonlyMap<string, boolean> = new Map([
  ['no está marcado como pulsado', false],
  ['está marcado como pulsado', true],
]);
const CLICKS: ReadonlyMap<string, number> = new Map([
  ['0', 0],
  ['1', 1],
  ['2', 2],
]);

const toggling: BrowserRowHandler = async (row, { page }) => {
  await resetTenants([TENANT_A]);
  const clicks = strict('veces', CLICKS, cell(row, 'veces'));
  const visible = strict('visibilidad', VISIBILITY, cell(row, 'visibilidad'));
  const pressed = strict('pulsado', PRESSED, cell(row, 'pulsado'));
  const label = quoted(cell(row, 'texto'));
  const name = quoted(cell(row, 'nombre'));
  const expected = `${cell(row, 'visibilidad')}; botón «${label}» llamado «${name}»; ${cell(row, 'pulsado')}`;
  const opened = await openRegister(page);
  if (opened) return preparationFailedWeb(expected, opened);
  const typed = await runSteps([
    ['escribir «Contraseña»', () => field(page, 'Contraseña').fill('Abcdefghij1!', ACTION)],
    ['escribir «Confirmar contraseña»', () => field(page, 'Confirmar contraseña').fill('Abcdefghij1!', ACTION)],
  ]);
  if (typed) return preparationFailedWeb(expected, typed);
  const watch = watchSubmissions(page);
  for (let index = 0; index < clicks; index += 1) {
    const failure = await runSteps([['pulsar el botón de la contraseña', () => toggleButton(page).click(ACTION)]]);
    if (failure) return outcome(false, expected, failure, { note: 'La historia nombra un elemento que la pantalla no ofrece.' });
  }
  const password = field(page, 'Contraseña');
  const confirm = field(page, 'Confirmar contraseña');
  const types = [await attrOf(password, 'type'), await attrOf(confirm, 'type')];
  const shown = types.every((type) => type === 'text');
  const hidden = types.every((type) => type === 'password');
  const button = toggleButton(page);
  const buttonText = await textOf(button);
  const buttonName = await attrOf(button, 'aria-label');
  const isPressed = (await attrOf(button, 'aria-pressed')) === 'true';
  const values = [await valueOf(password), await valueOf(confirm)];
  return conclude([
    check(visible ? shown : hidden, `«Contraseña» y «Confirmar contraseña» se ven ${cell(row, 'visibilidad')}`, `se ven ${shown ? 'en claro' : hidden ? 'ocultas' : 'con tipos mixtos'}`),
    check(buttonText === label && buttonName === name, `el botón muestra «${label}» y se llama «${name}»`, `el botón muestra «${buttonText ?? '(sin texto)'}» y se llama «${buttonName ?? '(sin nombre)'}»`),
    check(isPressed === pressed, cell(row, 'pulsado'), isPressed ? 'está marcado como pulsado' : 'no está marcado como pulsado'),
    check(values[0] === 'Abcdefghij1!' && values[1] === 'Abcdefghij1!', 'los dos campos siguen conteniendo Abcdefghij1!', `los campos contienen ${String(values[0])} y ${String(values[1])}`),
    check(watch() === 0, 'no se ha enviado nada', `solicitudes enviadas: ${watch()}`),
  ]);
};

// --- Esquema 3: volver al inicio de sesión no envía la solicitud --------------------------------------------------------------

const SITUATIONS: ReadonlyMap<string, 'vacio' | 'con-datos'> = new Map<string, 'vacio' | 'con-datos'>([
  ['el formulario vacío', 'vacio'],
  ['Ana escrita en «Nombre» y gestor@sigpro.test escrito en «Correo corporativo»', 'con-datos'],
]);

const backToLogin: BrowserRowHandler = async (row, { page }) => {
  await resetTenants([TENANT_A]);
  const situation = strict('situacion', SITUATIONS, cell(row, 'situacion'));
  const expected = 'llega a /login sin sesión iniciada; no se ha enviado ninguna solicitud';
  const opened = await openRegister(page);
  if (opened) return preparationFailedWeb(expected, opened);
  if (situation === 'con-datos') {
    const typed = await runSteps([
      ['escribir «Nombre»', () => field(page, 'Nombre').fill('Ana', ACTION)],
      ['escribir «Correo corporativo»', () => field(page, 'Correo corporativo').fill('gestor@sigpro.test', ACTION)],
    ]);
    if (typed) return preparationFailedWeb(expected, typed);
  }
  const watch = watchSubmissions(page);
  const failure = await runSteps([['pulsar «Volver al inicio de sesión»', () => backButton(page).click(ACTION)]]);
  if (failure) return outcome(false, expected, failure, { note: 'La historia nombra un elemento que la pantalla no ofrece.' });
  const arrived = await waitUntil(() => onLoginForm(page));
  const sent = watch();
  return conclude([
    check(arrived.reached, 'llega a /login', arrived.reached ? 'llega a /login' : `no llega a /login (ruta ${pathOf(page)})`),
    check(sent === 0, 'no se ha enviado ninguna solicitud', `solicitudes enviadas: ${sent}`),
    await noSessionCheck(page, onLoginForm, onPrograms),
  ]);
};

// --- Esquema 4: los enlaces legales abren su página en otra pestaña -----------------------------------------------------------

const LEGAL_ROUTES: ReadonlyMap<string, string> = new Map([
  ['/legal/terms', '/legal/terms'],
  ['/legal/privacy', '/legal/privacy'],
]);

const legalLinks: BrowserRowHandler = async (row, { page, context }) => {
  await resetTenants([TENANT_A]);
  const linkName = quoted(cell(row, 'enlace'));
  const route = strict('ruta', LEGAL_ROUTES, cell(row, 'ruta'));
  const expected = `se abre ${route} en otra pestaña; en /register sigue escrito Ana en «Nombre»`;
  const opened = await openRegister(page);
  if (opened) return preparationFailedWeb(expected, opened);
  const typed = await runSteps([['escribir «Nombre»', () => field(page, 'Nombre').fill('Ana', ACTION)]]);
  if (typed) return preparationFailedWeb(expected, typed);
  const popupReady = context.waitForEvent('page', { timeout: CEILING_MS }).catch(() => undefined);
  const failure = await runSteps([['pulsar el enlace', () => legalLink(page, linkName).click(ACTION)]]);
  const popup = await popupReady;
  if (failure) return outcome(false, expected, failure, { note: 'La historia nombra un elemento que la pantalla no ofrece.' });
  const opensRoute = popup === undefined ? { reached: false } : await waitUntil(async () => pathOf(popup) === route);
  const kept = (await valueOf(field(page, 'Nombre'))) === 'Ana';
  await popup?.close().catch(() => undefined);
  return conclude([
    check(opensRoute.reached, `se abre ${route} en otra pestaña`, opensRoute.reached ? `se abre ${route} en otra pestaña` : `no se abre ${route} (pestaña ${popup === undefined ? 'no abierta' : pathOf(popup)})`),
    check(kept, 'en /register sigue escrito Ana en «Nombre»', kept ? 'sigue escrito Ana en «Nombre»' : 'el nombre no conserva Ana'),
  ]);
};

// --- Esquema 5: con una sesión iniciada no se pide acceso ---------------------------------------------------------------------

const SESSIONS: ReadonlyMap<string, string> = new Map([['gestor@sigpro.test', 'gestor@sigpro.test']]);

const withSession: BrowserRowHandler = async (row, { page }) => {
  await resetTenants([TENANT_A]);
  const account = strict('sesion', SESSIONS, cell(row, 'sesion'));
  const expected = `llega a /programs sin ver el formulario de solicitud (sesión de ${account})`;
  // La sesión se inicia en la propia pantalla de acceso, con la cuenta y el tenant de la fila
  const signed = await signInAsManager(page);
  if (signed) return preparationFailedWeb(expected, signed);
  const opened = await runSteps([['abrir /register?tenant=alumno01', () => page.goto(REGISTER_URL, { timeout: CEILING_MS })]]);
  if (opened) return outcome(false, expected, opened, { note: 'No se pudo abrir /register con la sesión iniciada.' });
  const arrived = await waitUntil(() => onPrograms(page));
  const form = await isVisible(titleOf(page));
  return conclude([
    check(arrived.reached, 'llega a /programs', arrived.reached ? 'llega a /programs' : `no llega a /programs (ruta ${pathOf(page)})`),
    check(!form, 'sin ver el formulario de solicitud', form ? 'se ve el formulario de solicitud' : 'sin formulario de solicitud'),
  ]);
};

defineBrowserRows({
  story: 'US-REGISTRO-008',
  surface: 'web',
  tenants: [TENANT_A],
  handlers: new Map<number, BrowserRowHandler>([
    [1, initialState],
    [2, toggling],
    [3, backToLogin],
    [4, legalLinks],
    [5, withSession],
  ]),
});
