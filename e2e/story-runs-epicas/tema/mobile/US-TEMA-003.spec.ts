import { TENANT_A, resetTenants } from '../../../story-runs/support/prepare';
import { waitUntil } from '../../support/browser';
import { cell, check, preparationFailedWeb, strict, type Check } from '../../support/checks';
import { defineBrowserRows, type BrowserRowHandler } from '../../core/framework';
import { EXPO_NOTE, MOBILE_SETTLE_MS, openScreenSteps, pressOnceSteps, schemeOf, settleScheme, tenantSteps, toggleOf } from './common';
import { RGB, actionMissing, backgroundOf, concluded, hexOf, runStepsLogged, storedThemeOf, type Tema } from '../web/common';

// US-TEMA-003 — Tema inicial de la app móvil: el del sistema hasta que la persona elige uno (Expo web a 390 × 844; NO es nativo).
// Preparación de cada fila: reinicio del tenant alumno01; /login con alumno01 en «Tenant de trabajo»; navegador (contexto) nuevo y sin
// preferencia guardada; el tema del sistema se fija con emulateMedia. «Cerrar la app y volver a abrirla» = abrir otra página del mismo
// contexto (el almacenamiento se conserva) y cerrar la anterior, como en sesion/mobile/common.ts.

const SISTEMA: ReadonlyMap<string, 'light' | 'dark'> = new Map<string, 'light' | 'dark'>([
  ['claro', 'light'],
  ['oscuro', 'dark'],
]);
const TEMA: ReadonlyMap<string, Tema> = new Map<string, Tema>([
  ['claro', 'claro'],
  ['oscuro', 'oscuro'],
]);

/** Lo que el sistema del dispositivo implica sin elegir nada: oscuro solo si el sistema está en oscuro. */
const followedSystem = (system: 'light' | 'dark'): Tema => (system === 'dark' ? 'oscuro' : 'claro');

// --- Esquema 1: sin tema elegido la app sigue el tema del sistema --------------------------------------------------------------

const followsSystem: BrowserRowHandler = async (row, { page }) => {
  const system = strict('tema_sistema', SISTEMA, cell(row, 'tema_sistema'));
  const tema = strict('tema', TEMA, cell(row, 'tema'));
  const fondoHex = cell(row, 'fondo');
  const fondoRgb = strict('fondo', RGB, fondoHex);
  const expected = `la pantalla se ve con el tema ${tema}, fondo ${fondoHex}`;

  // Preparación: reinicio, sistema en el tema de la fila, /login con alumno01 y sin preferencia guardada
  await resetTenants([TENANT_A]);
  await page.emulateMedia({ colorScheme: system });
  const opened = await runStepsLogged([...openScreenSteps(page, '/login'), ...tenantSteps(page)]);
  if (opened) return preparationFailedWeb(expected, opened);
  const stored = await storedThemeOf(page);
  if (typeof stored === 'string') return preparationFailedWeb(expected, `hay una preferencia guardada antes de elegir (${stored})`);

  // La app lee el tema guardado de forma asíncrona: se espera al tema que muestra antes de juzgar
  const settled = await settleScheme(page, tema);
  const observed = await schemeOf(page);
  const fondo = await backgroundOf(toggleOf(page));
  const checks: Check[] = [
    check(observed === tema, `la pantalla se ve con el tema ${tema}`, `la pantalla se ve con el tema ${observed ?? '(no legible)'}`),
    check(fondo === fondoRgb, `el fondo de la pantalla es ${fondoHex}`, `el fondo de la pantalla es ${hexOf(fondo)}`),
  ];
  return concluded(checks, { note: EXPO_NOTE, evidence: { tema_sistema: system, asentado: settled } });
};

// --- Esquema 2: un tema elegido gana al del sistema y se conserva al volver a abrir la app -----------------------------------

const keepsChoice: BrowserRowHandler = async (row, { page, context }) => {
  const system = strict('tema_sistema', SISTEMA, cell(row, 'tema_sistema'));
  const tema = strict('tema', TEMA, cell(row, 'tema'));
  const fondoHex = cell(row, 'fondo');
  const fondoRgb = strict('fondo', RGB, fondoHex);
  const expected = `tras cerrar y volver a abrir la app, la pantalla se ve con el tema ${tema}, fondo ${fondoHex}`;

  // Preparación: reinicio, sistema en el tema de la fila, /login con alumno01 y una pulsación de «Cambiar tema»
  await resetTenants([TENANT_A]);
  await page.emulateMedia({ colorScheme: system });
  const opened = await runStepsLogged([...openScreenSteps(page, '/login'), ...tenantSteps(page)]);
  if (opened) return preparationFailedWeb(expected, opened);
  const before = await schemeOf(page);
  if (before !== followedSystem(system)) return preparationFailedWeb(expected, `antes de elegir la app muestra ${before ?? '(no legible)'}, no el del sistema`);
  const pressed = await runStepsLogged(pressOnceSteps(page));
  if (pressed) return actionMissing(expected, pressed);
  const flipped = await settleScheme(page, tema);
  if (!flipped) return preparationFailedWeb(expected, `tras pulsar «Cambiar tema», la pantalla no pasa a ${tema}`);

  // La elección queda guardada antes de cerrar la app (la escritura es asíncrona)
  const storedValue = tema === 'oscuro' ? 'dark' : 'light';
  await waitUntil(async () => (await storedThemeOf(page)) === storedValue, MOBILE_SETTLE_MS);

  // «Cerrar la app y volver a abrirla»: otra página del mismo contexto, la anterior se cierra
  const reopened = await context.newPage();
  await reopened.emulateMedia({ colorScheme: system });
  await page.close();
  const back = await runStepsLogged(openScreenSteps(reopened, '/login'));
  if (back) return concluded([check(false, expected, `no se pudo volver a abrir la app: ${back}`)], { note: EXPO_NOTE });

  const settled = await settleScheme(reopened, tema);
  const observed = await schemeOf(reopened);
  const fondo = await backgroundOf(toggleOf(reopened));
  const checks: Check[] = [
    check(observed === tema, `la pantalla se ve con el tema ${tema}`, `la pantalla se ve con el tema ${observed ?? '(no legible)'}`),
    check(fondo === fondoRgb, `el fondo de la pantalla es ${fondoHex}`, `el fondo de la pantalla es ${hexOf(fondo)}`),
  ];
  return concluded(checks, { note: EXPO_NOTE, evidence: { tema_sistema: system, asentado_tras_reabrir: settled } });
};

defineBrowserRows({
  story: 'US-TEMA-003',
  surface: 'expo-web',
  tenants: [TENANT_A],
  handlers: new Map<number, BrowserRowHandler>([
    [1, followsSystem],
    [2, keepsChoice],
  ]),
});
