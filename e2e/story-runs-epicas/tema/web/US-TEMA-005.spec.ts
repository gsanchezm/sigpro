import { TENANT_A, resetTenants } from '../../../story-runs/support/prepare';
import { ACTION, pathOf, waitUntil } from '../../support/browser';
import { cell, check, preparationFailedWeb, strict, type Check } from '../../support/checks';
import { defineBrowserRows, type BrowserRowHandler } from '../../core/framework';
import {
  GESTOR,
  PROGRAMS_URL,
  SETTLE_MS,
  WEB_ONLY_NOTE,
  actionMissing,
  concluded,
  logoutButton,
  openLoginSteps,
  pressAndWatch,
  pressSteps,
  prefixed,
  profileItem,
  runStepsLogged,
  settledStoredTheme,
  signInSteps,
  temaOf,
  themeChecks,
  userMenuButton,
  type Tema,
} from './common';

// US-TEMA-005 — La preferencia de tema es del navegador, no de la cuenta (web). Transversal: en esta historia solo se ejecuta la web
// (ver WEB_ONLY_NOTE). Preparación de cada fila: reinicio del tenant alumno01 y navegador nuevo, sin preferencia guardada, con el sistema
// en claro. Cerrar sesión se hace desde «Perfil» con el menú de usuario (no con un `goto`, que recargaría la aplicación). El reinicio del
// tenant se hace con la API (POST /api/admin/reset) con el token de alumno01@sigpro.lab. Tras cada pulsación se mide el estado intermedio,
// y antes de cerrar sesión se comprueba que la elección queda guardada en el navegador (así una fila no atribuye mal un fallo).

const PULSACIONES: ReadonlyMap<string, number> = new Map([
  ['una vez', 1],
  ['dos veces', 2],
]);
const TEMA: ReadonlyMap<string, Tema> = new Map<string, Tema>([
  ['oscuro', 'oscuro'],
  ['claro', 'claro'],
]);
const RELOADS: ReadonlyMap<string, boolean> = new Map([
  ['se recarga la pantalla', false],
  ['se reinicia el tenant con POST /api/admin/reset y se recarga la pantalla', true],
]);

// --- Esquema 1: el tema elegido sigue al cerrar sesión y al entrar con otra cuenta --------------------------------------------

const keepsAcrossAccounts: BrowserRowHandler = async (row, { page }) => {
  const presses = strict('pulsaciones', PULSACIONES, cell(row, 'pulsaciones'));
  const credentials = { email: cell(row, 'correo'), password: cell(row, 'contraseña') };
  const tema = strict('tema', TEMA, cell(row, 'tema'));
  const expected = `cierra sesión, entra con ${credentials.email} y llega a /programs con el tema ${tema}`;
  // Tema con el que queda la página tras las pulsaciones (impar: oscuro; par: claro) y su valor de raíz
  const themeBeforeLogout: Tema = presses % 2 === 1 ? 'oscuro' : 'claro';
  const valor: 'light' | 'dark' = themeBeforeLogout === 'oscuro' ? 'dark' : 'light';

  // Preparación: reinicio, sistema en claro y pantalla de acceso de un navegador nuevo
  await resetTenants([TENANT_A]);
  await page.emulateMedia({ colorScheme: 'light' });
  const opened = await runStepsLogged(openLoginSteps(page));
  if (opened) return preparationFailedWeb(expected, opened);

  // Pulsaciones en la pantalla de acceso: se mide el estado tras CADA una (antes de atribuir nada al cierre de sesión)
  const pressed = await pressAndWatch(page, presses);
  if (pressed.failure) return actionMissing(expected, pressed.failure);
  const checks: Check[] = [...pressed.checks];

  // Regla: lo elegido queda guardado en el navegador ANTES de cerrar sesión
  const storedBefore = await settledStoredTheme(page, valor);
  checks.push(check(storedBefore === valor, `antes de cerrar sesión queda guardado en el navegador: ${valor}`, `antes de cerrar sesión queda guardado en el navegador: ${storedBefore ?? '(nada)'}`));

  // Preparación: entrada de gestor@sigpro.test
  const signedIn = await runStepsLogged(signInSteps(page, GESTOR));
  if (signedIn) return preparationFailedWeb(expected, `gestor@sigpro.test inicia sesión y llega a /programs: ${signedIn}`);

  // Cuando: cerrar sesión desde «Perfil» (menú de usuario → Perfil → «Cerrar sesión»)
  const loggedOut = await runStepsLogged([
    ['abrir el «Menú de usuario»', () => userMenuButton(page).click(ACTION)],
    ['abrir «Perfil»', () => profileItem(page).click(ACTION)],
    ['pulsar «Cerrar sesión»', () => logoutButton(page).click(ACTION)],
    ['llegar a /login', () => page.waitForURL(/\/login/, ACTION)],
  ]);
  if (loggedOut) return actionMissing(expected, loggedOut);

  // Regla: cerrar sesión solo termina la sesión, no cambia el tema (se mide en la pantalla de acceso, ya sin sesión)
  await waitUntil(async () => (await temaOf(page)) === themeBeforeLogout, SETTLE_MS);
  const afterLogout = await temaOf(page);
  checks.push(check(afterLogout === themeBeforeLogout, `al cerrar sesión el tema sigue ${themeBeforeLogout}`, `al cerrar sesión el tema es ${afterLogout ?? '(no legible)'}`));

  // Y: entrar con la otra cuenta y llegar a /programs con el tema
  const entered = await runStepsLogged(signInSteps(page, credentials));
  checks.push(check(entered === undefined && pathOf(page) === PROGRAMS_URL, 'llega a /programs', entered === undefined ? `llega a ${pathOf(page)}` : `no llega a /programs: ${entered}`));
  if (entered !== undefined) return concluded(checks, { note: WEB_ONLY_NOTE, evidence: { pulsaciones: presses, cuenta: credentials.email } });
  checks.push(...(await themeChecks(page, { tema, valor }, page.locator('body'))));

  // Persistencia: se recarga la página; el tema debe seguir guardado y aplicado (no solo en memoria de la aplicación)
  const reloaded = await runStepsLogged([['recargar la página', () => page.reload(ACTION)]]);
  if (reloaded) {
    checks.push(check(false, 'tras recargar, el tema se conserva', reloaded));
  } else {
    const storedAfter = await settledStoredTheme(page, valor);
    checks.push(check(storedAfter === valor, `tras recargar queda guardado en el navegador: ${valor}`, `tras recargar queda guardado en el navegador: ${storedAfter ?? '(nada)'}`));
    checks.push(...prefixed('tras recargar: ', await themeChecks(page, { tema, valor }, page.locator('body'))));
  }
  return concluded(checks, { note: WEB_ONLY_NOTE, evidence: { pulsaciones: presses, cuenta: credentials.email, ruta_tras_recargar: pathOf(page) } });
};

// --- Esquema 2: recargar la pantalla o reiniciar los datos del tenant no cambia el tema del navegador -----------------------

const keepsOnReload: BrowserRowHandler = async (row, { page }) => {
  const resets = strict('accion', RELOADS, cell(row, 'accion'));
  const expected = 'tema oscuro tras la acción';

  await resetTenants([TENANT_A]);
  const opened = await runStepsLogged(openLoginSteps(page));
  if (opened) return preparationFailedWeb(expected, opened);
  const pressed = await runStepsLogged(pressSteps(page, 1));
  if (pressed) return actionMissing(expected, pressed);

  // Cuando: se reinicia el tenant con la API si la fila lo pide, y después se recarga la pantalla
  if (resets) await resetTenants([TENANT_A]);
  const reloaded = await runStepsLogged([['recargar la pantalla', () => page.reload(ACTION)]]);
  if (reloaded) return actionMissing(expected, reloaded);

  const checks = await themeChecks(page, { tema: 'oscuro' }, page.locator('body'));
  return concluded([...checks], { note: WEB_ONLY_NOTE, evidence: { reinicio_api: resets } });
};

defineBrowserRows({
  story: 'US-TEMA-005',
  surface: 'web',
  tenants: [TENANT_A],
  handlers: new Map<number, BrowserRowHandler>([
    [1, keepsAcrossAccounts],
    [2, keepsOnReload],
  ]),
});
