import { TENANT_A, resetTenants } from '../../../story-runs/support/prepare';
import { ACTION, pathOf } from '../../support/browser';
import { cell, check, preparationFailedWeb, strict, type Check } from '../../support/checks';
import { defineBrowserRows, type BrowserRowHandler } from '../../core/framework';
import {
  GESTOR,
  RGB,
  actionMissing,
  backgroundOf,
  concluded,
  brandPanel,
  formMain,
  hexOf,
  markPage,
  markSurvives,
  openLoginSteps,
  pathFromRoute,
  pressAndWatch,
  pressSteps,
  runStepsLogged,
  signInSteps,
  temaOf,
  themeChecks,
  themeToggle,
  visibleTextOf,
  type Tema,
} from './common';

// US-TEMA-001 — Cambiar el tema con «Cambiar tema» en la aplicación, en Acceso y en las páginas legales (web). Preparación de cada
// fila: reinicio del tenant alumno01 y un navegador nuevo (sin preferencia guardada). Las filas con sesión entran con gestor@sigpro.test
// desde /login?tenant=alumno01 y esperan /programs antes de pulsar. El tema del sistema no se fija: la web no lo sigue (index.html
// empieza en claro). Las filas de 390 px fijan la ventana antes de cargar la página, porque el diseño se elige al cargar.

const DARK = { hex: '#141017', rgb: 'rgb(20, 16, 23)' } as const;

// --- Esquema 1: cada pulsación cambia el tema de la aplicación en escritorio y en responsive --------------------------------

const ANCHO: ReadonlyMap<string, { readonly width: number; readonly height: number }> = new Map([
  ['1440 px', { width: 1440, height: 900 }],
  ['390 px', { width: 390, height: 844 }],
]);
const ACCION: ReadonlyMap<string, number> = new Map([
  ['no pulsa «Cambiar tema»', 0],
  ['pulsa «Cambiar tema» una vez', 1],
  ['pulsa «Cambiar tema» dos veces', 2],
]);
const TEMA: ReadonlyMap<string, Tema> = new Map<string, Tema>([
  ['claro', 'claro'],
  ['oscuro', 'oscuro'],
]);
const VALOR: ReadonlyMap<string, 'light' | 'dark'> = new Map<string, 'light' | 'dark'>([
  ['light', 'light'],
  ['dark', 'dark'],
]);
const everyWidth: BrowserRowHandler = async (row, { page }) => {
  const viewport = strict('ancho', ANCHO, cell(row, 'ancho'));
  const presses = strict('accion', ACCION, cell(row, 'accion'));
  const tema = strict('tema', TEMA, cell(row, 'tema'));
  const valor = strict('valor', VALOR, cell(row, 'valor'));
  const fondoHex = cell(row, 'fondo');
  const fondoRgb = strict('fondo', RGB, fondoHex);
  const expected = `tema ${tema}, raíz ${valor}, fondo ${fondoHex}`;

  // Preparación: reinicio, ventana del ancho de la fila antes de cargar, y sesión de gestor desde la pantalla de acceso
  await resetTenants([TENANT_A]);
  await page.setViewportSize(viewport);
  const prepared = await runStepsLogged([...openLoginSteps(page), ...signInSteps(page, GESTOR)]);
  if (prepared) return preparationFailedWeb(expected, `gestor@sigpro.test inicia sesión y llega a /programs: ${prepared}`);

  // Antes de pulsar, la página debe estar en el tema claro (estado que la historia da por hecho)
  const before = await temaOf(page);
  if (before !== 'claro') return preparationFailedWeb(expected, `el tema antes de pulsar es ${before ?? '(no legible)'}, no claro`);

  // Marca de página para «sin recargarla» (solo si la fila pulsa)
  await markPage(page);
  // Tras CADA pulsación se comprueba el estado intermedio (un control muerto no pasa como «claro» final)
  const pressed = await pressAndWatch(page, presses);
  if (pressed.failure) return actionMissing(expected, pressed.failure);

  const checks: Check[] = [
    ...pressed.checks,
    ...(await themeChecks(page, { tema, valor, fondo: { hex: fondoHex, rgb: fondoRgb }, icono: tema === 'oscuro' ? 'sol' : 'luna' }, page.locator('body'))),
  ];
  // Regla: el control no tiene texto visible (solo el icono)
  const text = await visibleTextOf(themeToggle(page));
  checks.push(check(text === '', 'el control «Cambiar tema» no tiene texto visible', text === undefined ? 'texto visible no legible' : text === '' ? 'sin texto visible' : `texto visible «${text}»`));
  // Regla: el cambio se ve en la página sin recargarla
  if (presses > 0) {
    const survived = await markSurvives(page);
    checks.push(check(survived, 'el cambio se ve sin recargar la página', survived ? 'la página no se recargó' : 'la página se recargó'));
  }
  return concluded(checks, { evidence: { ancho_px: viewport.width, pulsaciones: presses } });
};

// --- Esquema 2: el control alterna el tema en Acceso y en las páginas legales -------------------------------------------------

const RUTAS: ReadonlyMap<string, string> = new Map([
  ['/login?tenant=alumno01', '/login?tenant=alumno01'],
  ['/register?tenant=alumno01', '/register?tenant=alumno01'],
  ['/forgot?tenant=alumno01', '/forgot?tenant=alumno01'],
  ['/legal/terms', '/legal/terms'],
  ['/legal/privacy', '/legal/privacy'],
  ['/help', '/help'],
]);

const alternatesInAccess: BrowserRowHandler = async (row, { page }) => {
  const route = strict('ruta', RUTAS, cell(row, 'ruta'));
  const expected = 'tema oscuro, raíz dark, fondo #141017';

  // Preparación: reinicio y una persona sin sesión abre la ruta en un navegador nuevo
  await resetTenants([TENANT_A]);
  const opened = await runStepsLogged([[`abrir ${route}`, () => page.goto(route, ACTION)]]);
  if (opened) return preparationFailedWeb(expected, opened);

  await markPage(page);
  const pressed = await runStepsLogged(pressSteps(page, 1));
  if (pressed) return actionMissing(expected, pressed);

  const checks: Check[] = [...(await themeChecks(page, { tema: 'oscuro', valor: 'dark', fondo: DARK, icono: 'sol' }, page.locator('body')))];
  // Regla: el cambio se ve en la página sin recargarla
  const survived = await markSurvives(page);
  checks.push(check(survived, 'el cambio se ve sin recargar la página', survived ? 'la página no se recargó' : 'la página se recargó'));
  // La URL final es la de la fila: una redirección (p. ej. a /login) no cuenta como la pantalla pedida
  const path = pathFromRoute(route);
  checks.push(check(pathOf(page) === path, `la pantalla sigue en ${path}`, `la pantalla está en ${pathOf(page)}`));
  return concluded(checks, { evidence: { ruta: route } });
};

// --- Esquema 3: el panel de marca de Acceso sigue oscuro en los dos temas (escritorio) -------------------------------------

const PRESSES_ACCESS: ReadonlyMap<string, number> = new Map([
  ['pulsa «Cambiar tema» una vez', 1],
  ['pulsa «Cambiar tema» dos veces', 2],
]);
const TEMA_PANEL: ReadonlyMap<string, Tema> = new Map<string, Tema>([
  ['oscuro', 'oscuro'],
  ['claro', 'claro'],
]);

const brandStaysDark: BrowserRowHandler = async (row, { page }) => {
  const presses = strict('accion', PRESSES_ACCESS, cell(row, 'accion'));
  const tema = strict('tema', TEMA_PANEL, cell(row, 'tema'));
  const columnHex = cell(row, 'fondo');
  const columnRgb = strict('fondo', RGB, columnHex);
  const expected = `tema ${tema}, panel de marca #141017, columna ${columnHex}`;

  await resetTenants([TENANT_A]);
  const opened = await runStepsLogged(openLoginSteps(page));
  if (opened) return preparationFailedWeb(expected, opened);

  // Tras cada pulsación, el estado intermedio (con dos pulsaciones, la primera deja el tema oscuro)
  const pressed = await pressAndWatch(page, presses);
  if (pressed.failure) return actionMissing(expected, pressed.failure);

  const checks: Check[] = [...pressed.checks, ...(await themeChecks(page, { tema }, page.locator('body')))];
  const brand = await backgroundOf(brandPanel(page));
  checks.push(check(brand === DARK.rgb, 'el panel de marca de la izquierda tiene fondo #141017', `el panel de marca tiene fondo ${hexOf(brand)}`));
  const column = await backgroundOf(formMain(page));
  checks.push(check(column === columnRgb, `el fondo de la columna del formulario es ${columnHex}`, `el fondo de la columna del formulario es ${hexOf(column)}`));
  return concluded(checks);
};

defineBrowserRows({
  story: 'US-TEMA-001',
  surface: 'web',
  tenants: [TENANT_A],
  handlers: new Map<number, BrowserRowHandler>([
    [1, everyWidth],
    [2, alternatesInAccess],
    [3, brandStaysDark],
  ]),
});
