import type { Locator, Page } from '@playwright/test';
import { DEMO, TENANT_A, WRONG_PASSWORD } from '../../../story-runs/support/prepare';
import { ACTION, CEILING_MS, attrOf, holdsFor, pathOf, safe, waitUntil } from '../../support/browser';
import { cell, check, preparationFailedWeb, strict } from '../../support/checks';
import { defineBrowserRows, notExecutable, type BrowserRowHandler } from '../../core/framework';
import { ENV_NOTE, judge, prepareAlumno } from '../api/common';
import {
  ALERT_LOGIN,
  HOLD_MS,
  MOBILE_NOTE,
  NOMBRES,
  actionFailed,
  alertWith,
  loginHeading,
  presence,
  readingOf,
  readingText,
  runStepsLogged,
  sessionCheck,
  stillOnLogin,
  timingData,
  valueText,
  waitHidden,
  waitVisible,
  watchLogins,
} from '../web/common';

// US-API-PLATAFORMA-008 — Panel «Usuarios de prueba» en /login (app móvil servida como web de Expo, 390 × 844; NO es nativo).
// Preparación de cada fila: alumno01 reiniciado, caos apagado, /login sin sesión guardada y «alumno01» escrito en «Tenant de trabajo»
// (la app móvil no usa ?tenant=). Las opciones del panel son `role="radio"` dentro de un `radiogroup` llamado «Usuarios de prueba».

const STEP = 'abrir /login sin sesión y con alumno01 en «Tenant de trabajo»';
const ENVIRONMENTS: ReadonlyMap<string, string> = new Map<string, string>([
  ['dev', 'dev'],
  ['staging', 'staging'],
  ['production', 'production'],
]);
const MFA_STEP: ReadonlyMap<string, string> = new Map<string, string>([['verificación en dos pasos', 'verificación en dos pasos']]);

const tenantField = (page: Page): Locator => page.getByRole('textbox', { name: 'Tenant de trabajo', exact: true });
const emailField = (page: Page): Locator => page.getByRole('textbox', { name: 'Correo electrónico', exact: true });
const passwordField = (page: Page): Locator => page.getByRole('textbox', { name: 'Contraseña', exact: true });
const enterButton = (page: Page): Locator => page.getByRole('button', { name: 'Entrar', exact: true });
const panelGroup = (page: Page): Locator => page.getByRole('radiogroup', { name: 'Usuarios de prueba', exact: true });
/** La opción de una cuenta: `role="radio"` cuyo nombre empieza por su nombre («Javier Ortega · program_manager»). */
const chipOf = (page: Page, nombre: string): Locator => page.getByRole('radio', { name: new RegExp(`^${nombre} · `) });
const mfaTitle = (page: Page): Locator => page.getByRole('heading', { name: 'Verificación en dos pasos', exact: true });

/** Abre /login con el almacenamiento vacío y escribe «alumno01» en «Tenant de trabajo» con UN `fill`. */
const openMobileLogin = async (page: Page): Promise<string | undefined> => {
  await prepareAlumno();
  return runStepsLogged([
    ['abrir /login', () => page.goto('/login', { timeout: CEILING_MS })],
    ['ver el título «Iniciar sesión»', () => loginHeading(page).waitFor({ timeout: CEILING_MS })],
    ['escribir el tenant en «Tenant de trabajo»', () => tenantField(page).fill(TENANT_A, ACTION)],
  ]);
};

/** Un toque (clic de ratón de Playwright) sobre la opción de una cuenta; devuelve el diagnóstico si no se pudo. */
const tapOption = (page: Page, nombre: string): Promise<string | undefined> =>
  runStepsLogged([[`tocar la opción de ${nombre}`, () => chipOf(page, nombre).click(ACTION)]], chipOf(page, nombre));

/** Espera a que el campo tenga el valor de la historia (la reacción local se espera; no se lee justo tras el toque). */
const fieldShows = async (target: Locator, wanted: string): Promise<string | undefined> => {
  await waitUntil(async () => (await valueText(target)) === wanted);
  return valueText(target);
};

// --- Esquema 1: tocar una opción rellena el acceso sin enviarlo -----------------------------------------------------------------

const tapFills: BrowserRowHandler = async (row, { page }) => {
  const nombre = strict('nombre', NOMBRES, cell(row, 'nombre'));
  const correo = cell(row, 'correo');
  const contrasena = cell(row, 'contraseña');
  const expected = `«Correo electrónico» tiene ${correo} y «Contraseña» tiene ${contrasena}; sigue en /login sin sesión iniciada, con alumno01 en «Tenant de trabajo»`;
  const opened = await openMobileLogin(page);
  if (opened) return preparationFailedWeb(STEP, opened);
  const chip = chipOf(page, nombre);
  const ready = await waitVisible(chip);
  if (!ready.reached) return judge([presence(await readingOf(chip), true, `la opción de ${nombre} en «Usuarios de prueba»`)], { note: MOBILE_NOTE });
  const posts = watchLogins(page);
  const tapped = await tapOption(page, nombre);
  if (tapped) return actionFailed(expected, tapped);
  const email = await fieldShows(emailField(page), correo);
  const password = await fieldShows(passwordField(page), contrasena);
  await waitUntil(async () => (await attrOf(chip, 'aria-checked')) === 'true');
  const selected = await attrOf(chip, 'aria-checked');
  const stayed = await stillOnLogin(page);
  const tenant = await valueText(tenantField(page));
  const pathNow = pathOf(page);
  // «Sin sesión» va siempre el último: navega a /programs
  const session = await sessionCheck(page);
  return judge(
    [
      check(email === correo, `«Correo electrónico» tiene ${correo}`, `«Correo electrónico» tiene ${email ?? '(no legible)'}`),
      check(password === contrasena, `«Contraseña» tiene ${contrasena}`, `«Contraseña» tiene ${password ?? '(no legible)'}`),
      check(stayed.held, 'sigue en /login', `ruta ${pathNow} durante ${HOLD_MS} ms`),
      check(posts.length === 0, 'no envía el formulario: ninguna petición de inicio de sesión', `${posts.length} peticiones de inicio de sesión`),
      check(tenant === TENANT_A, `«Tenant de trabajo» sigue con ${TENANT_A}`, `«Tenant de trabajo» tiene ${tenant ?? '(no legible)'}`),
      // Regla de la historia: la opción tocada queda seleccionada (aria-checked)
      check(selected === 'true', `la opción de ${nombre} queda seleccionada`, `aria-checked ${selected ?? '(no legible)'}`),
      session,
    ],
    { note: MOBILE_NOTE },
  );
};

// --- Esquema 2: tocar otra opción sustituye los datos del acceso ----------------------------------------------------------------

const tapReplaces: BrowserRowHandler = async (row, { page }) => {
  const primera = strict('primera', NOMBRES, cell(row, 'primera'));
  const segunda = strict('segunda', NOMBRES, cell(row, 'segunda'));
  const correo = cell(row, 'correo');
  const contrasena = cell(row, 'contraseña');
  const expected = `«Correo electrónico» tiene ${correo} y «Contraseña» tiene ${contrasena}; solo queda seleccionada la opción de ${segunda}`;
  const opened = await openMobileLogin(page);
  if (opened) return preparationFailedWeb(STEP, opened);
  const firstChip = chipOf(page, primera);
  const ready = await waitVisible(firstChip);
  if (!ready.reached) return judge([presence(await readingOf(firstChip), true, `la opción de ${primera} en «Usuarios de prueba»`)], { note: MOBILE_NOTE });
  const firstTap = await tapOption(page, primera);
  if (firstTap) return actionFailed(expected, firstTap);
  const secondTap = await tapOption(page, segunda);
  if (secondTap) return actionFailed(expected, secondTap);
  const email = await fieldShows(emailField(page), correo);
  const password = await fieldShows(passwordField(page), contrasena);
  const secondChip = chipOf(page, segunda);
  await waitUntil(async () => (await attrOf(secondChip, 'aria-checked')) === 'true' && (await attrOf(firstChip, 'aria-checked')) === 'false');
  const firstSelected = await attrOf(firstChip, 'aria-checked');
  const secondSelected = await attrOf(secondChip, 'aria-checked');
  return judge(
    [
      check(email === correo, `«Correo electrónico» tiene ${correo}`, `«Correo electrónico» tiene ${email ?? '(no legible)'}`),
      check(password === contrasena, `«Contraseña» tiene ${contrasena}`, `«Contraseña» tiene ${password ?? '(no legible)'}`),
      check(secondSelected === 'true', `la opción de ${segunda} queda seleccionada`, `aria-checked de ${segunda} ${secondSelected ?? '(no legible)'}`),
      check(firstSelected === 'false', `la opción de ${primera} deja de estar seleccionada`, `aria-checked de ${primera} ${firstSelected ?? '(no legible)'}`),
    ],
    { note: MOBILE_NOTE },
  );
};

// --- Esquema 3: tocar una opción quita el aviso de error -----------------------------------------------------------------------

const tapClearsError: BrowserRowHandler = async (row, { page }) => {
  const nombre = strict('nombre', NOMBRES, cell(row, 'nombre'));
  const expected = `deja de ver el aviso «${ALERT_LOGIN}»`;
  const opened = await openMobileLogin(page);
  if (opened) return preparationFailedWeb(STEP, opened);
  const typed = await runStepsLogged([
    [`escribir ${DEMO.consultor.email} en «Correo electrónico»`, () => emailField(page).fill(DEMO.consultor.email, ACTION)],
    ['escribir la contraseña incorrecta en «Contraseña»', () => passwordField(page).fill(WRONG_PASSWORD, ACTION)],
    ['pulsar «Entrar»', () => enterButton(page).click(ACTION)],
  ]);
  if (typed) return actionFailed(expected, typed);
  const shown = await waitVisible(alertWith(page, ALERT_LOGIN));
  if (!shown.reached) return preparationFailedWeb(`ve el aviso «${ALERT_LOGIN}» tras pulsar «Entrar»`, 'no aparece el aviso de error tras el envío con la contraseña incorrecta');
  const tapped = await tapOption(page, nombre);
  if (tapped) return actionFailed(expected, tapped);
  // El veredicto es el estado final (no ve el aviso); el tiempo hasta que desaparece es un dato aparte (README, Tolerancias)
  const gone = await waitHidden(alertWith(page, ALERT_LOGIN));
  return judge([presence(await readingOf(alertWith(page, ALERT_LOGIN)), false, `el aviso «${ALERT_LOGIN}»`)], {
    note: MOBILE_NOTE,
    evidence: timingData(gone.elapsedMs),
  });
};

// --- Esquema 4: el panel depende del entorno de la API --------------------------------------------------------------------------

const panelByEnvironment: BrowserRowHandler = async (row, { page }) => {
  const entorno = strict('entorno', ENVIRONMENTS, cell(row, 'entorno'));
  const expected = cell(row, 'resultado');
  // La pila aislada se lanza con APP_ENV=dev (docs/story-runs/entorno/env.sh): staging y production no se pueden fijar
  if (entorno !== 'dev') return notExecutable(expected, ENV_NOTE(entorno));
  const opened = await openMobileLogin(page);
  if (opened) return preparationFailedWeb(STEP, opened);
  const group = panelGroup(page);
  await waitVisible(group);
  const count = await safe(() => group.getByRole('radio').count(), -1);
  // La historia dice «ve «Usuarios de prueba»» y la ayuda: se mide el TEXTO visible del encabezado (login.tsx:179), no solo el aria-label del grupo
  const heading = page.getByText(/Usuarios de prueba/);
  const help = page.getByText('clic para rellenar', { exact: false });
  return judge(
    [
      presence(await readingOf(group), true, 'el grupo «Usuarios de prueba»'),
      presence(await readingOf(heading), true, 'el texto visible «Usuarios de prueba»'),
      presence(await readingOf(help), true, 'la ayuda «clic para rellenar» junto al encabezado'),
      check(count === 6, 'una opción por cada una de las seis cuentas', `${count} opciones`),
    ],
    { note: MOBILE_NOTE },
  );
};

// --- Esquema 5: el panel no aparece en la verificación en dos pasos ------------------------------------------------------------

const noPanelInMfa: BrowserRowHandler = async (row, { page }) => {
  const paso = strict('paso', MFA_STEP, cell(row, 'paso'));
  const expected = `en la pantalla de ${paso} no ve «Usuarios de prueba»`;
  const opened = await openMobileLogin(page);
  if (opened) return preparationFailedWeb(STEP, opened);
  // Control positivo: en el paso de credenciales el panel SÍ aparece; sin él, su ausencia en el paso MFA no probaría nada
  const control = await waitVisible(panelGroup(page));
  const controlNow = readingText(await readingOf(panelGroup(page)));
  const typed = await runStepsLogged([
    [`escribir ${DEMO.admin.email} en «Correo electrónico»`, () => emailField(page).fill(DEMO.admin.email, ACTION)],
    [`escribir la contraseña de ${DEMO.admin.email}`, () => passwordField(page).fill(DEMO.admin.password, ACTION)],
    ['pulsar «Entrar»', () => enterButton(page).click(ACTION)],
  ]);
  if (typed) return actionFailed(expected, typed);
  const onMfa = await waitVisible(mfaTitle(page));
  if (!onMfa.reached) return preparationFailedWeb(`llega a «Verificación en dos pasos» para ${DEMO.admin.email}`, 'no llega al título «Verificación en dos pasos»');
  // Se observa durante una ventana fija: el panel podría aparecer con retraso si la pantalla lo mostrara
  const absent = await holdsFor(async () => (await readingOf(panelGroup(page))) === 'oculto' && (await readingOf(page.getByText(/Usuarios de prueba/))) === 'oculto', HOLD_MS);
  const group = readingText(await readingOf(panelGroup(page)));
  const text = readingText(await readingOf(page.getByText(/Usuarios de prueba/)));
  return judge(
    [
      check(control.reached, 'control: en /login el panel «Usuarios de prueba» sí aparece antes de entrar', `grupo de opciones ${controlNow} antes de entrar`),
      check(absent.held, expected, `grupo de opciones ${group}; texto «Usuarios de prueba» ${text}`),
    ],
    { note: MOBILE_NOTE },
  );
};

defineBrowserRows({
  story: 'US-API-PLATAFORMA-008',
  surface: 'expo-web',
  tenants: [TENANT_A],
  handlers: new Map<number, BrowserRowHandler>([
    [1, tapFills],
    [2, tapReplaces],
    [3, tapClearsError],
    [4, panelByEnvironment],
    [5, noPanelInMfa],
  ]),
});
