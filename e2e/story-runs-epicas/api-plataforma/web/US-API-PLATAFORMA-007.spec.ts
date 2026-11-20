import type { Page } from '@playwright/test';
import { DEMO, TENANT_A, WRONG_PASSWORD } from '../../../story-runs/support/prepare';
import { ACTION, holdsFor, pathOf, quoted, safe, waitUntil } from '../../support/browser';
import { cell, check, preparationFailedWeb, strict, type Check } from '../../support/checks';
import { defineBrowserRows, type BrowserRowHandler, type Outcome } from '../../core/framework';
import { judge } from '../api/common';
import { prepareAux, withAuxStack, type AuxStack } from '../api/aux-api';
import { ACCESO_TESTIDS } from '../../../../packages/shared/src/testids';
import {
  ALERT_LOGIN,
  COOKIE_NOTE,
  HOLD_MS,
  LOGIN_PATH,
  NOMBRES,
  PANEL_NAME,
  REGISTER_PATH,
  actionFailed,
  alertWith,
  cardOf,
  emailField,
  enterButton,
  focusedOf,
  loginHeading,
  openAt,
  openPage,
  panelOf,
  passwordField,
  presence,
  readingOf,
  readingText,
  runStepsLogged,
  sessionCheck,
  stillOnLogin,
  textBoxOf,
  textContentOf,
  timingData,
  valueText,
  waitFocused,
  waitHidden,
  waitVisible,
  watchLogins,
  watchTestUsers,
} from './common';

// US-API-PLATAFORMA-007 — Panel «Usuarios de prueba» en /login (web, 1440 × 900). Preparación de cada fila: alumno01 reiniciado, caos
// apagado y /login?tenant=alumno01 en un contexto nuevo sin sesión. Las seis cuentas y sus datos salen de la tabla de la historia. La
// insignia se lee dentro de su tarjeta (el estado «bloqueado» también aparece en el correo de la cuenta).
// Esquema 6 (staging y production): la pila principal es APP_ENV=dev; esas filas arrancan una pila auxiliar (API con ese APP_ENV y la
// web de su build apuntando a ella, aux-api.ts). El cableado se comprueba al arrancar y la página debe pedir su lista a la web auxiliar.

const STEP = 'abrir /login?tenant=alumno01 sin sesión y con el panel «Usuarios de prueba» visible';
const STEP_AUX = 'preparar alumno01 y abrir /login en la pila auxiliar';
const PANEL_ENVIRONMENTS: ReadonlyMap<string, string> = new Map<string, string>([
  ['dev', 'dev'],
  ['staging', 'staging'],
  ['production', 'production'],
]);
const PANEL_RESULTS: ReadonlyMap<string, 'visible' | 'absent'> = new Map<string, 'visible' | 'absent'>([
  ['ve el encabezado «Usuarios de prueba» con las seis tarjetas', 'visible'],
  ['no ve el encabezado «Usuarios de prueba» ni ninguna tarjeta', 'absent'],
]);

// --- Esquema 1: cada tarjeta muestra el nombre, el correo y la contraseña de su cuenta --------------------------------------

const cardShows: BrowserRowHandler = async (row, { page, context }) => {
  const nombre = strict('nombre', NOMBRES, cell(row, 'nombre'));
  const correo = cell(row, 'correo');
  const contrasena = cell(row, 'contraseña');
  const opened = await openPage(page, context, LOGIN_PATH);
  if (opened) return preparationFailedWeb(STEP, opened);
  const card = cardOf(page, nombre);
  await waitVisible(card);
  // Lo que la historia pide es «ve», es decir, visible: se mide el texto completo de cada línea y si el CSS lo recorta (truncate)
  const pair = `${correo} · ${contrasena}`;
  const pairBox = await textBoxOf(card.locator('span:not(:has(span))', { hasText: correo }));
  const nameBox = await textBoxOf(card.locator('span:not(:has(span))', { hasText: nombre }));
  const measure = (box: typeof pairBox): string => (box === undefined ? '(no legible)' : `«${box.text}», scrollWidth ${box.scrollWidth}, clientWidth ${box.clientWidth}`);
  const panel = panelOf(page);
  return judge(
    [
      presence(await readingOf(card), true, `la tarjeta de ${nombre}`),
      check(pairBox?.text === pair, `ve «${pair}» (correo · contraseña) en la tarjeta`, `línea medida: ${measure(pairBox)}`),
      check(pairBox !== undefined && !pairBox.clipped, `«${pair}» se ve completo, sin recortar`, `línea medida: ${measure(pairBox)}`),
      check(nameBox?.text === nombre && nameBox !== undefined && !nameBox.clipped, `ve el nombre ${nombre} completo`, `nombre medido: ${measure(nameBox)}`),
      presence(await readingOf(panel.getByRole('heading', { name: PANEL_NAME })), true, 'el encabezado «Usuarios de prueba»'),
      presence(await readingOf(panel.getByText('clic para rellenar', { exact: true })), true, 'junto a ese encabezado la ayuda «clic para rellenar»'),
    ],
    {
      note: `${COOKIE_NOTE} Medición visual en 1440 px: un texto recortado por CSS (clase truncate, TestUsers.tsx) no se ve completo aunque esté en el DOM.`,
      evidence: { correo: pairBox, nombre: nameBox },
    },
  );
};

// --- Esquema 2: la insignia muestra el estado o la marca de segundo factor -----------------------------------------------------

const badgeShows: BrowserRowHandler = async (row, { page, context }) => {
  const nombre = strict('nombre', NOMBRES, cell(row, 'nombre'));
  const marca = quoted(cell(row, 'marca'));
  const opened = await openPage(page, context, LOGIN_PATH);
  if (opened) return preparationFailedWeb(STEP, opened);
  const card = cardOf(page, nombre);
  await waitVisible(card);
  // Solo la insignia de la tarjeta: el correo de la cuenta también puede contener «bloqueado» o «pendiente»
  const text = await textContentOf(card.getByTestId(ACCESO_TESTIDS.TEST_USER_BADGE));
  return judge(
    [
      presence(await readingOf(card), true, `la tarjeta de ${nombre}`),
      check(text !== undefined && text.includes(marca), `la insignia de esa tarjeta contiene ${marca}`, `la insignia dice ${text === undefined ? '(no legible)' : `«${text}»`}`),
    ],
    { note: COOKIE_NOTE },
  );
};

// --- Esquema 3: pulsar una tarjeta rellena el acceso sin enviarlo ----------------------------------------------------------------

const pickFills: BrowserRowHandler = async (row, { page, context }) => {
  const nombre = strict('nombre', NOMBRES, cell(row, 'nombre'));
  const correo = cell(row, 'correo');
  const contrasena = cell(row, 'contraseña');
  const expected = `«Correo electrónico» tiene ${correo} y «Contraseña» tiene ${contrasena}; el foco en «Correo electrónico»; sigue en /login sin sesión iniciada`;
  const opened = await openPage(page, context, LOGIN_PATH);
  if (opened) return preparationFailedWeb(STEP, opened);
  const card = cardOf(page, nombre);
  await waitVisible(card);
  // El registro de peticiones de inicio de sesión se arma ANTES de pulsar
  const posts = watchLogins(page);
  const before = page.url();
  const failure = await runStepsLogged([[`pulsar la tarjeta de ${nombre}`, () => card.click(ACTION)]], card);
  if (failure) return actionFailed(expected, failure);
  await waitUntil(async () => (await valueText(emailField(page))) === correo);
  const focus = await waitFocused(emailField(page));
  const focused = await focusedOf(page);
  const email = await valueText(emailField(page));
  const password = await valueText(passwordField(page));
  const stayed = await stillOnLogin(page);
  // Antes de la sesión (que navega a /programs) se capturan la ruta y la dirección que se observan
  const pathNow = pathOf(page);
  const urlNow = page.url();
  // «Sin sesión» va siempre el último: navega a /programs
  const session = await sessionCheck(page);
  return judge(
    [
      check(email === correo, `«Correo electrónico» tiene ${correo}`, `«Correo electrónico» tiene ${email ?? '(no legible)'}`),
      check(password === contrasena, `«Contraseña» tiene ${contrasena}`, `«Contraseña» tiene ${password ?? '(no legible)'}`),
      check(focus.reached, 'el foco está en «Correo electrónico»', `foco en ${focused}`),
      check(stayed.held, 'sigue en /login', `ruta ${pathNow} durante ${HOLD_MS} ms`),
      check(posts.length === 0, 'no envía el formulario: ninguna petición de inicio de sesión', `${posts.length} peticiones de inicio de sesión`),
      check(urlNow === before, 'la dirección no cambia de tenant', `dirección ${urlNow}`),
      session,
    ],
    { note: COOKIE_NOTE },
  );
};

// --- Esquema 4: pulsar una tarjeta quita el aviso de error -------------------------------------------------------------------

const pickClearsError: BrowserRowHandler = async (row, { page, context }) => {
  const nombre = strict('nombre', NOMBRES, cell(row, 'nombre'));
  const expected = `deja de ver el aviso «${ALERT_LOGIN}»`;
  const opened = await openPage(page, context, LOGIN_PATH);
  if (opened) return preparationFailedWeb(STEP, opened);
  const typed = await runStepsLogged([
    ['escribir gestor@sigpro.test en «Correo electrónico»', () => emailField(page).fill(DEMO.gestor.email, ACTION)],
    ['escribir la contraseña incorrecta en «Contraseña»', () => passwordField(page).fill(WRONG_PASSWORD, ACTION)],
    ['pulsar «Entrar»', () => enterButton(page).click(ACTION)],
  ]);
  if (typed) return actionFailed(expected, typed);
  const shown = await waitVisible(alertWith(page, ALERT_LOGIN));
  if (!shown.reached) return preparationFailedWeb(`ve el aviso «${ALERT_LOGIN}» tras pulsar «Entrar»`, 'no aparece el aviso de error tras el envío con la contraseña incorrecta');
  const card = cardOf(page, nombre);
  const picked = await runStepsLogged([[`pulsar la tarjeta de ${nombre}`, () => card.click(ACTION)]], card);
  if (picked) return actionFailed(expected, picked);
  // El veredicto es el estado final (no ve el aviso); el tiempo hasta que desaparece es un dato aparte (README, Tolerancias)
  const gone = await waitHidden(alertWith(page, ALERT_LOGIN));
  return judge([presence(await readingOf(alertWith(page, ALERT_LOGIN)), false, `el aviso «${ALERT_LOGIN}»`)], {
    note: COOKIE_NOTE,
    evidence: timingData(gone.elapsedMs),
  });
};

// --- Esquema 5: en la solicitud de acceso, una tarjeta lleva a /login con los campos rellenos ----------------------------------

const registerPick: BrowserRowHandler = async (row, { page, context }) => {
  const nombre = strict('nombre', NOMBRES, cell(row, 'nombre'));
  const correo = cell(row, 'correo');
  const contrasena = cell(row, 'contraseña');
  const expected = `llega a /login con «Correo electrónico» con ${correo} y «Contraseña» con ${contrasena}`;
  const opened = await openPage(page, context, REGISTER_PATH);
  if (opened) return preparationFailedWeb('abrir /register?tenant=alumno01 sin sesión', opened);
  const card = cardOf(page, nombre);
  await waitVisible(card);
  const failure = await runStepsLogged([[`pulsar la tarjeta de ${nombre}`, () => card.click(ACTION)]], card);
  if (failure) return actionFailed(expected, failure);
  // Solo se leen los campos cuando la pantalla es /login: /register tiene sus propios campos
  const arrived = await waitUntil(async () => pathOf(page) === '/login' && (await readingOf(loginHeading(page))) === 'visible');
  if (arrived.reached) await waitUntil(async () => (await valueText(emailField(page))) === correo);
  const pathNow = pathOf(page);
  const email = arrived.reached ? await valueText(emailField(page)) : undefined;
  const password = arrived.reached ? await valueText(passwordField(page)) : undefined;
  return judge(
    [
      check(arrived.reached, 'llega a /login', `ruta ${pathNow}`),
      check(email === correo, `«Correo electrónico» con ${correo}`, `«Correo electrónico» con ${email ?? '(no legible)'}`),
      check(password === contrasena, `«Contraseña» con ${contrasena}`, `«Contraseña» con ${password ?? '(no legible)'}`),
    ],
    { note: COOKIE_NOTE },
  );
};

// --- Esquema 6: el panel depende del entorno de la API -----------------------------------------------------------------------

/** Lo que se comprueba del panel en la página abierta. El cableado (la página pide su lista a la web auxiliar) se mira al final. */
interface Wiring {
  readonly origin: string;
  readonly seen: readonly string[];
}

const panelChecks = async (page: Page, wanted: 'visible' | 'absent', wiring: Wiring | undefined): Promise<Outcome> => {
  const wiringChecks = (): Check[] =>
    wiring === undefined
      ? []
      : [
          check(
            wiring.seen.some((entry) => entry.startsWith(`200 ${wiring.origin}/api/config/test-users`)),
            `la página pide su lista de usuarios de prueba a ${wiring.origin} y recibe 200`,
            `peticiones: ${wiring.seen.length === 0 ? '(ninguna)' : wiring.seen.join(' | ')}`,
          ),
        ];
  if (wanted === 'visible') {
    const panel = panelOf(page);
    await waitVisible(panel);
    const count = await safe(() => panel.getByRole('button').count(), -1);
    return judge(
      [
        presence(await readingOf(panel.getByRole('heading', { name: PANEL_NAME })), true, 'el encabezado «Usuarios de prueba»'),
        check(count === 6, 'las seis tarjetas', `${count} tarjetas`),
        ...wiringChecks(),
      ],
      { note: COOKIE_NOTE },
    );
  }
  // Ausencia: primero que la pantalla de acceso está lista (si no, la ausencia no mide nada) y después una ventana fija
  await waitVisible(loginHeading(page));
  const absent = await holdsFor(async () => (await readingOf(panelOf(page))) === 'oculto', HOLD_MS);
  return judge(
    [
      presence(await readingOf(loginHeading(page)), true, 'la pantalla de acceso lista'),
      check(absent.held, 'no ve el encabezado «Usuarios de prueba» ni ninguna tarjeta', `panel ${readingText(await readingOf(panelOf(page)))} durante ${HOLD_MS} ms`),
      ...wiringChecks(),
    ],
    { note: COOKIE_NOTE },
  );
};

const panelByEnvironment: BrowserRowHandler = async (row, { page, context }) => {
  const entorno = strict('entorno', PANEL_ENVIRONMENTS, cell(row, 'entorno'));
  const expected = cell(row, 'resultado');
  const wanted = strict('resultado', PANEL_RESULTS, expected);
  if (entorno === 'dev') {
    const opened = await openPage(page, context, LOGIN_PATH);
    if (opened) return preparationFailedWeb(STEP, opened);
    return panelChecks(page, wanted, undefined);
  }
  // staging y production: pila auxiliar (API con ese APP_ENV y la web de su build apuntando a ella); la principal no se toca
  return withAuxStack({ label: `007 E6 ${entorno}`, env: { APP_ENV: entorno }, expected }, async (stack: AuxStack) => {
    const prep = await prepareAux(stack.api);
    if (prep !== undefined) return preparationFailedWeb(STEP_AUX, prep);
    const seen = watchTestUsers(page);
    const opened = await openAt(page, context, `${stack.web.origin}${LOGIN_PATH}`);
    if (opened !== undefined) return preparationFailedWeb(STEP_AUX, opened);
    return panelChecks(page, wanted, { origin: stack.web.origin, seen });
  });
};

defineBrowserRows({
  story: 'US-API-PLATAFORMA-007',
  surface: 'web',
  tenants: [TENANT_A],
  // La fila de pila auxiliar levanta API y web y las para: su plazo es mayor que el de las demás
  rowTimeoutMs: (row) => (row.esquemaIndex === 6 ? 200_000 : 120_000),
  handlers: new Map<number, BrowserRowHandler>([
    [1, cardShows],
    [2, badgeShows],
    [3, pickFills],
    [4, pickClearsError],
    [5, registerPick],
    [6, panelByEnvironment],
  ]),
});
