import type { Page } from '@playwright/test';
import { TENANT_A, resetTenants } from '../../../story-runs/support/prepare';
import { pathOf } from '../../support/browser';
import { cell, check, preparationFailedWeb, strict, type Check } from '../../support/checks';
import { defineBrowserRows, type BrowserRowHandler, type Outcome } from '../../core/framework';
import { EXPO_NOTE, openScreenSteps, pressOnceSteps, schemeOf, settleScheme, tenantSteps, toggleOf } from './common';
import {
  RGB,
  actionMissing,
  backgroundOf,
  concluded,
  hexOf,
  noStoredPreference,
  pathFromRoute,
  runStepsLogged,
  systemSchemeIs,
  visibleTextOf,
  type Tema,
} from '../web/common';

// US-TEMA-004 — Cambiar el tema con «Cambiar tema» en Acceso y en las páginas legales (Expo web a 390 × 844; NO es nativo).
// Preparación de cada fila: reinicio del tenant alumno01; navegador (contexto) nuevo, sin preferencia guardada (comprobada leyendo la clave;
// una lectura fallida no cuenta como vacía), con el sistema en claro (comprobado con matchMedia); en /login, alumno01 escrito en «Tenant de
// trabajo». Cada pulsación de «Cambiar tema» alterna el tema de la pantalla en la que está: se comprueba el texto visible del botón y que
// la pantalla no cambia de ruta («sin salir de ella»), y tras CADA pulsación el estado intermedio.

const ROUTES: ReadonlyMap<string, string> = new Map([
  ['/login', '/login'],
  ['/register', '/register'],
  ['/forgot', '/forgot'],
  ['/legal/terms', '/legal/terms'],
  ['/legal/privacy', '/legal/privacy'],
  ['/help', '/help'],
]);
const PRESSES: ReadonlyMap<string, number> = new Map([
  ['una vez', 1],
  ['dos veces', 2],
  ['tres veces', 3],
]);
const TEMA: ReadonlyMap<string, Tema> = new Map<string, Tema>([
  ['claro', 'claro'],
  ['oscuro', 'oscuro'],
]);
const FONDO_OSCURO = { hex: '#141017', rgb: 'rgb(20, 16, 23)' } as const;
/** Texto visible del control en la historia («Cambiar tema»). */
const CONTROL_TEXT = 'Cambiar tema';

/** Abre la pantalla con el sistema en claro, comprueba el estado inicial (sistema, sin preferencia, tema claro) y devuelve el fallo de preparación, si lo hay. */
const openClaro = async (page: Page, route: string, expected: string): Promise<Outcome | undefined> => {
  await resetTenants([TENANT_A]);
  await page.emulateMedia({ colorScheme: 'light' });
  const opened = await runStepsLogged([...openScreenSteps(page, route), ...(route === '/login' ? tenantSteps(page) : [])]);
  if (opened) return preparationFailedWeb(expected, opened);
  if (!(await systemSchemeIs(page, 'light'))) return preparationFailedWeb(expected, 'el navegador no declara el sistema en claro');
  const preference = await noStoredPreference(page);
  if (preference) return preparationFailedWeb(expected, preference);
  const initial = await settleScheme(page, 'claro');
  if (!initial) return preparationFailedWeb(expected, `con el sistema en claro la pantalla no muestra el tema claro (muestra ${(await schemeOf(page)) ?? '(no legible)'})`);
  return undefined;
};

/** Comprobaciones de la pantalla tras pulsar: tema, fondo, texto visible del control y ruta (la misma pantalla). */
const screenChecks = async (page: Page, route: string, tema: Tema, fondoHex: string, fondoRgb: string): Promise<Check[]> => {
  const observed = await schemeOf(page);
  const fondo = await backgroundOf(toggleOf(page));
  const visible = await visibleTextOf(toggleOf(page));
  const path = pathFromRoute(route);
  return [
    check(observed === tema, `el tema es ${tema}`, `el tema es ${observed ?? '(no legible)'}`),
    check(fondo === fondoRgb, `el fondo de la pantalla es ${fondoHex}`, `el fondo de la pantalla es ${hexOf(fondo)}`),
    check(visible === CONTROL_TEXT, `el botón muestra el texto «${CONTROL_TEXT}»`, `el botón muestra «${visible ?? '(no legible)'}»`),
    check(pathOf(page) === path, `sigue en ${path} (sin salir de la pantalla)`, `está en ${pathOf(page)}`),
  ];
};

// --- Esquema 1: el botón pasa al tema oscuro en cada pantalla pública ---------------------------------------------------------

const pressesToDark: BrowserRowHandler = async (row, { page }) => {
  const route = strict('ruta', ROUTES, cell(row, 'ruta'));
  const expected = 'tema oscuro, fondo #141017, el botón dice «Cambiar tema» y la pantalla sigue en la misma ruta';

  const prepared = await openClaro(page, route, expected);
  if (prepared) return prepared;
  const pressed = await runStepsLogged(pressOnceSteps(page));
  if (pressed) return actionMissing(expected, pressed);

  await settleScheme(page, 'oscuro');
  const checks = await screenChecks(page, route, 'oscuro', FONDO_OSCURO.hex, FONDO_OSCURO.rgb);
  return concluded(checks, { note: EXPO_NOTE, evidence: { ruta: route } });
};

// --- Esquema 2: el botón alterna el tema en cada pulsación ----------------------------------------------------------------------

const alternates: BrowserRowHandler = async (row, { page }) => {
  const presses = strict('pulsaciones', PRESSES, cell(row, 'pulsaciones'));
  const tema = strict('tema', TEMA, cell(row, 'tema'));
  const fondoHex = cell(row, 'fondo');
  const fondoRgb = strict('fondo', RGB, fondoHex);
  const expected = `tras ${cell(row, 'pulsaciones')}: tema ${tema}, fondo ${fondoHex}`;

  const prepared = await openClaro(page, '/login', expected);
  if (prepared) return prepared;

  // Tras CADA pulsación: el estado intermedio (la lectura del tema es asíncrona; el resultado del asentamiento cuenta como comprobación)
  const checks: Check[] = [];
  for (let index = 0; index < presses; index += 1) {
    const pressed = await runStepsLogged(pressOnceSteps(page));
    if (pressed) return actionMissing(expected, pressed);
    const want: Tema = index % 2 === 0 ? 'oscuro' : 'claro';
    const reached = await settleScheme(page, want);
    const seen = await schemeOf(page);
    checks.push(check(reached, `tras la pulsación ${index + 1} el tema es ${want}`, `tras la pulsación ${index + 1} el tema es ${seen ?? '(no legible)'}`));
  }

  checks.push(...(await screenChecks(page, '/login', tema, fondoHex, fondoRgb)));
  return concluded(checks, { note: EXPO_NOTE, evidence: { pulsaciones: presses } });
};

defineBrowserRows({
  story: 'US-TEMA-004',
  surface: 'expo-web',
  tenants: [TENANT_A],
  handlers: new Map<number, BrowserRowHandler>([
    [1, pressesToDark],
    [2, alternates],
  ]),
});
