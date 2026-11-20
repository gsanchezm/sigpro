import { TENANT_A, resetTenants } from '../../../story-runs/support/prepare';
import { ACTION, pathOf } from '../../support/browser';
import { cell, check, preparationFailedWeb, strict, type Check } from '../../support/checks';
import { defineBrowserRows, type BrowserRowHandler } from '../../core/framework';
import {
  GESTOR,
  LOGIN_URL,
  PROGRAMS_URL,
  actionMissing,
  concluded,
  noStoredPreference,
  openLoginSteps,
  pathFromRoute,
  pressAndWatch,
  prefixed,
  runStepsLogged,
  settledStoredTheme,
  signInSteps,
  systemSchemeIs,
  themeChecks,
  type Tema,
} from './common';

// US-TEMA-002 — Empezar en tema claro y conservar el tema elegido al recargar y al entrar (web). Preparación de cada fila: reinicio del
// tenant alumno01 y navegador nuevo, sin preferencia guardada (comprobado leyendo la clave de la propia web). El tema del sistema se fija
// con emulateMedia y se comprueba con matchMedia tras cargar. Tras CADA pulsación se mide el estado intermedio. «Queda guardado en el
// navegador» se comprueba leyendo la clave de la web (solo lectura; ninguna fila escribe la preferencia directamente).

// --- Esquema 1: sin preferencia guardada la web muestra el tema claro (aunque el sistema pida el oscuro) ----------------------------

const RUTAS: ReadonlyMap<string, string> = new Map([
  [LOGIN_URL, LOGIN_URL],
  ['/legal/terms', '/legal/terms'],
]);
const SISTEMA: ReadonlyMap<string, 'light' | 'dark'> = new Map<string, 'light' | 'dark'>([
  ['claro', 'light'],
  ['oscuro', 'dark'],
]);

const lightWithoutPreference: BrowserRowHandler = async (row, { page }) => {
  const route = strict('ruta', RUTAS, cell(row, 'ruta'));
  const system = strict('tema_sistema', SISTEMA, cell(row, 'tema_sistema'));
  const expected = 'tema claro, raíz light';

  // Preparación: reinicio, navegador nuevo y el tema del sistema que la fila indica
  await resetTenants([TENANT_A]);
  await page.emulateMedia({ colorScheme: system });
  const opened = await runStepsLogged([[`abrir ${route}`, () => page.goto(route, ACTION)]]);
  if (opened) return preparationFailedWeb(expected, opened);
  // Precondición: el navegador declara el sistema de la fila (si no, la fila no prueba nada sobre el tema del sistema)
  if (!(await systemSchemeIs(page, system))) return preparationFailedWeb(expected, `el navegador no declara el sistema en ${system === 'dark' ? 'oscuro' : 'claro'}`);

  const checks: Check[] = [...(await themeChecks(page, { tema: 'claro', valor: 'light' }, page.locator('body')))];
  // La URL final es la de la fila: una redirección no cuenta como la pantalla pedida
  const path = pathFromRoute(route);
  checks.push(check(pathOf(page) === path, `la pantalla sigue en ${path}`, `la pantalla está en ${pathOf(page)}`));
  return concluded(checks, { evidence: { ruta: route, tema_sistema: system } });
};

// --- Esquema 2: el tema elegido sigue al recargar la página --------------------------------------------------------------------

const PRESSES: ReadonlyMap<string, number> = new Map([
  ['no pulsa «Cambiar tema»', 0],
  ['pulsa «Cambiar tema» una vez', 1],
  ['pulsa «Cambiar tema» dos veces', 2],
  ['pulsa «Cambiar tema» tres veces', 3],
]);
const TEMA: ReadonlyMap<string, Tema> = new Map<string, Tema>([
  ['claro', 'claro'],
  ['oscuro', 'oscuro'],
]);
const VALOR: ReadonlyMap<string, 'light' | 'dark'> = new Map<string, 'light' | 'dark'>([
  ['light', 'light'],
  ['dark', 'dark'],
]);

const keepsOnReload: BrowserRowHandler = async (row, { page }) => {
  const presses = strict('accion', PRESSES, cell(row, 'accion'));
  const tema = strict('tema', TEMA, cell(row, 'tema'));
  const valor = strict('valor', VALOR, cell(row, 'valor'));
  const expected = `tema ${tema}, raíz ${valor} tras recargar`;

  await resetTenants([TENANT_A]);
  const opened = await runStepsLogged(openLoginSteps(page));
  if (opened) return preparationFailedWeb(expected, opened);
  // Estado de partida comprobado: ninguna preferencia guardada (una lectura fallida tampoco cuenta como vacía)
  const preference = await noStoredPreference(page);
  if (preference) return preparationFailedWeb(expected, preference);

  // Tras cada pulsación, el estado intermedio (un control muerto no pasa como el estado final)
  const pressed = await pressAndWatch(page, presses);
  if (pressed.failure) return actionMissing(expected, pressed.failure);
  const checks: Check[] = [...pressed.checks];

  // Regla: lo que se elige queda guardado en el navegador al pulsarlo (solo si hubo pulsaciones)
  if (presses > 0) {
    const stored = await settledStoredTheme(page, valor);
    checks.push(check(stored === valor, `queda guardado en el navegador: ${valor}`, `queda guardado en el navegador: ${stored ?? '(nada)'}`));
  }
  // Regla: lo guardado se aplica tras recargar la página
  const reloaded = await runStepsLogged([['recargar la página', () => page.reload(ACTION)]]);
  if (reloaded) return actionMissing(expected, reloaded);
  checks.push(...prefixed('tras recargar: ', await themeChecks(page, { tema, valor }, page.locator('body'))));
  return concluded(checks, { evidence: { pulsaciones: presses } });
};

// --- Esquema 3: el tema elegido se mantiene al entrar en la aplicación --------------------------------------------------------

const PRESSES_BEFORE_LOGIN: ReadonlyMap<string, number> = new Map([
  ['una vez', 1],
  ['dos veces', 2],
]);
const TEMA_AFTER_LOGIN: ReadonlyMap<string, Tema> = new Map<string, Tema>([
  ['oscuro', 'oscuro'],
  ['claro', 'claro'],
]);

const keepsOnEntering: BrowserRowHandler = async (row, { page }) => {
  const presses = strict('pulsaciones', PRESSES_BEFORE_LOGIN, cell(row, 'pulsaciones'));
  const tema = strict('tema', TEMA_AFTER_LOGIN, cell(row, 'tema'));
  const valor = strict('valor', VALOR, cell(row, 'valor'));
  const expected = `llega a /programs con el tema ${tema}, raíz ${valor}`;

  await resetTenants([TENANT_A]);
  const opened = await runStepsLogged(openLoginSteps(page));
  if (opened) return preparationFailedWeb(expected, opened);

  // Tras cada pulsación, el estado intermedio, antes de entrar
  const pressed = await pressAndWatch(page, presses);
  if (pressed.failure) return actionMissing(expected, pressed.failure);
  const checks: Check[] = [...pressed.checks];

  // Regla: lo elegido queda guardado en el navegador ANTES de entrar (si no, la atribución del fallo sería errónea)
  const storedBefore = await settledStoredTheme(page, valor);
  checks.push(check(storedBefore === valor, `antes de entrar queda guardado en el navegador: ${valor}`, `antes de entrar queda guardado en el navegador: ${storedBefore ?? '(nada)'}`));

  // Entrar con gestor@sigpro.test; la llegada se comprueba por la ruta
  const signedIn = await runStepsLogged(signInSteps(page, GESTOR));
  checks.push(check(signedIn === undefined && pathOf(page) === PROGRAMS_URL, 'llega a /programs', signedIn === undefined ? `llega a ${pathOf(page)}` : `no llega a /programs: ${signedIn}`));
  if (signedIn !== undefined) return concluded(checks);
  checks.push(...(await themeChecks(page, { tema, valor }, page.locator('body'))));

  // Persistencia: se recarga la página y el tema guardado sigue aplicándose
  const reloaded = await runStepsLogged([['recargar la página', () => page.reload(ACTION)]]);
  if (reloaded) {
    checks.push(check(false, 'tras recargar, el tema se conserva', reloaded));
    return concluded(checks, { evidence: { pulsaciones: presses } });
  }
  checks.push(...prefixed('tras recargar: ', await themeChecks(page, { tema, valor }, page.locator('body'))));
  return concluded(checks, { evidence: { pulsaciones: presses, ruta_tras_recargar: pathOf(page) } });
};

defineBrowserRows({
  story: 'US-TEMA-002',
  surface: 'web',
  tenants: [TENANT_A],
  handlers: new Map<number, BrowserRowHandler>([
    [1, lightWithoutPreference],
    [2, keepsOnReload],
    [3, keepsOnEntering],
  ]),
});
