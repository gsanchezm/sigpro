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
  pressSteps,
  profileItem,
  runStepsLogged,
  signInSteps,
  temaOf,
  themeChecks,
  userMenuButton,
  type Tema,
} from './common';

// US-TEMA-005 — La preferencia de tema es del navegador, no de la cuenta (web). Transversal: en esta historia solo se ejecuta la web.
// Preparación de cada fila: reinicio del tenant alumno01 y navegador nuevo, sin preferencia guardada, con el sistema en claro.
// Cerrar sesión se hace desde «Perfil» con el menú de usuario (no con un `goto`, que recargaría la aplicación). El reinicio del tenant
// se hace con la API (POST /api/admin/reset) con el token de alumno01@sigpro.lab.

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
  // Tema con el que queda la página tras las pulsaciones (impar: oscuro; par: claro)
  const themeBeforeLogout: Tema = presses % 2 === 1 ? 'oscuro' : 'claro';

  // Preparación: reinicio, sistema en claro, pulsaciones en la pantalla de acceso y entrada de gestor@sigpro.test
  await resetTenants([TENANT_A]);
  await page.emulateMedia({ colorScheme: 'light' });
  const opened = await runStepsLogged(openLoginSteps(page));
  if (opened) return preparationFailedWeb(expected, opened);
  const pressed = await runStepsLogged(pressSteps(page, presses));
  if (pressed) return actionMissing(expected, pressed);
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
  const logoutCheck = check(afterLogout === themeBeforeLogout, `al cerrar sesión el tema sigue ${themeBeforeLogout}`, `al cerrar sesión el tema es ${afterLogout ?? '(no legible)'}`);

  // Y: escribir la otra cuenta y entrar (la pantalla de acceso conserva el tenant guardado de la web)
  const entered = await runStepsLogged(signInSteps(page, credentials));
  const arrived = check(entered === undefined && pathOf(page) === PROGRAMS_URL, 'llega a /programs', entered === undefined ? `llega a ${pathOf(page)}` : `no llega a /programs: ${entered}`);
  const checks: Check[] = [logoutCheck, arrived, ...(await themeChecks(page, { tema, valor: tema === 'oscuro' ? 'dark' : 'light' }, page.locator('body')))];
  return concluded(checks, { note: WEB_ONLY_NOTE, evidence: { pulsaciones: presses, cuenta: credentials.email } });
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
  return concluded(checks, { note: WEB_ONLY_NOTE, evidence: { reinicio_api: resets } });
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
