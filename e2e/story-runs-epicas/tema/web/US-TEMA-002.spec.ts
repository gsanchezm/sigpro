import { TENANT_A, resetTenants } from '../../../story-runs/support/prepare';
import { ACTION, pathOf } from '../../support/browser';
import { cell, check, preparationFailedWeb, strict, type Check } from '../../support/checks';
import { defineBrowserRows, type BrowserRowHandler } from '../../core/framework';
import { GESTOR, LOGIN_URL, PROGRAMS_URL, actionMissing, concluded, openLoginSteps, pressSteps, runStepsLogged, signInSteps, storedThemeOf, themeChecks, type Tema } from './common';

// US-TEMA-002 — Empezar en tema claro y conservar el tema elegido al recargar y al entrar (web). Preparación de cada fila: reinicio del
// tenant alumno01 y navegador nuevo, sin preferencia guardada. El tema del sistema se fija con emulateMedia cuando la fila lo indica.
// «Lo que se elige queda guardado en el navegador al pulsarlo» se comprueba leyendo la clave de la propia web después de cada pulsación
// (solo lectura). Ninguna fila escribe la preferencia directamente.

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

  const checks = await themeChecks(page, { tema: 'claro', valor: 'light' }, page.locator('body'));
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

  // Preparación comprobada: sin pulsar no hay preferencia guardada (un valor ya guardado impide la fila; una lectura fallida no cuenta)
  const storedBefore = await storedThemeOf(page);
  if (typeof storedBefore === 'string') return preparationFailedWeb(expected, `hay una preferencia guardada antes de pulsar (${storedBefore})`);

  const failure = await runStepsLogged(pressSteps(page, presses));
  if (failure) return actionMissing(expected, failure);

  const checks: Check[] = [];
  // Regla: lo que se elige queda guardado en el navegador al pulsarlo (solo cuando hubo pulsaciones)
  if (presses > 0) {
    const stored = await storedThemeOf(page);
    checks.push(check(stored === valor, `queda guardado en el navegador: ${valor}`, `queda guardado en el navegador: ${stored ?? '(nada)'}`));
  }
  const reloaded = await runStepsLogged([['recargar la página', () => page.reload(ACTION)]]);
  if (reloaded) return actionMissing(expected, reloaded);
  checks.push(...(await themeChecks(page, { tema, valor }, page.locator('body'))));
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

  const pressedFirst = await runStepsLogged(pressSteps(page, presses));
  if (pressedFirst) return actionMissing(expected, pressedFirst);

  // Entrar con gestor@sigpro.test: la llegada se comprueba por la ruta (la espera del paso ya la limita)
  const signedIn = await runStepsLogged(signInSteps(page, GESTOR));
  const arrived = check(signedIn === undefined && pathOf(page) === PROGRAMS_URL, 'llega a /programs', signedIn === undefined ? `llega a ${pathOf(page)}` : `no llega a /programs: ${signedIn}`);
  const checks = await themeChecks(page, { tema, valor }, page.locator('body'));
  return concluded([arrived, ...checks]);
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
