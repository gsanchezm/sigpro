import type { Page } from '@playwright/test';
import { TENANT_A, resetTenants } from '../../../story-runs/support/prepare';
import { cell, check, preparationFailedWeb, strict, type Check } from '../../support/checks';
import { defineBrowserRows, type BrowserRowHandler, type Outcome } from '../../core/framework';
import { EXPO_NOTE, openScreenSteps, pressOnceSteps, schemeOf, settleScheme, tenantSteps, toggleOf } from './common';
import { RGB, actionMissing, backgroundOf, concluded, hexOf, runStepsLogged, storedThemeOf, type Tema } from '../web/common';

// US-TEMA-004 — Cambiar el tema con «Cambiar tema» en Acceso y en las páginas legales (Expo web a 390 × 844; NO es nativo).
// Preparación de cada fila: reinicio del tenant alumno01; navegador (contexto) nuevo, sin preferencia guardada, con el sistema en claro;
// en /login, alumno01 escrito en «Tenant de trabajo». Cada pulsación de «Cambiar tema» alterna el tema de la pantalla en la que está.

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

/** Abre la pantalla, comprueba el estado inicial (sistema en claro, sin preferencia guardada) y devuelve el fallo de preparación, si lo hay. */
const openClaro = async (page: Page, route: string, expected: string): Promise<Outcome | undefined> => {
  await resetTenants([TENANT_A]);
  await page.emulateMedia({ colorScheme: 'light' });
  const opened = await runStepsLogged([...openScreenSteps(page, route), ...(route === '/login' ? tenantSteps(page) : [])]);
  if (opened) return preparationFailedWeb(expected, opened);
  const stored = await storedThemeOf(page);
  if (typeof stored === 'string') return preparationFailedWeb(expected, `hay una preferencia guardada antes de pulsar (${stored})`);
  const initial = await settleScheme(page, 'claro');
  if (!initial) return preparationFailedWeb(expected, `con el sistema en claro la pantalla no muestra el tema claro (muestra ${String(await schemeOf(page))})`);
  return undefined;
};

// --- Esquema 1: el botón pasa al tema oscuro en cada pantalla pública ---------------------------------------------------------

const pressesToDark: BrowserRowHandler = async (row, { page }) => {
  const route = strict('ruta', ROUTES, cell(row, 'ruta'));
  const expected = 'tema oscuro, fondo #141017';

  const prepared = await openClaro(page, route, expected);
  if (prepared) return prepared;
  const pressed = await runStepsLogged(pressOnceSteps(page));
  if (pressed) return actionMissing(expected, pressed);

  await settleScheme(page, 'oscuro');
  const observed = await schemeOf(page);
  const fondo = await backgroundOf(toggleOf(page));
  const checks: Check[] = [
    check(observed === 'oscuro', 'el tema es oscuro', `el tema es ${observed ?? '(no legible)'}`),
    check(fondo === FONDO_OSCURO.rgb, `el fondo de la pantalla es ${FONDO_OSCURO.hex}`, `el fondo de la pantalla es ${hexOf(fondo)}`),
  ];
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
  for (let index = 0; index < presses; index += 1) {
    const pressed = await runStepsLogged(pressOnceSteps(page));
    if (pressed) return actionMissing(expected, pressed);
    // Cada pulsación se asienta antes de la siguiente: la lectura del tema es asíncrona
    await settleScheme(page, index % 2 === 0 ? 'oscuro' : 'claro');
  }

  await settleScheme(page, tema);
  const observed = await schemeOf(page);
  const fondo = await backgroundOf(toggleOf(page));
  const checks: Check[] = [
    check(observed === tema, `el tema es ${tema}`, `el tema es ${observed ?? '(no legible)'}`),
    check(fondo === fondoRgb, `el fondo de la pantalla es ${fondoHex}`, `el fondo de la pantalla es ${hexOf(fondo)}`),
  ];
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
