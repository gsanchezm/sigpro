import { DEMO, TENANT_A, resetTenants } from '../../../story-runs/support/prepare';
import { CEILING_MS, pathOf, waitUntil } from '../../support/browser';
import { cell, check, conclude, preparationFailedWeb, strict } from '../../support/checks';
import { defineBrowserRows, outcome, type BrowserRowHandler } from '../../core/framework';
import { CHANGES, ROUTES, runStepsLogged, visibilityOf } from '../web/common';
import { DIRECT_NOTE, REOPEN_NOTE, loginHeading, onExpoWeb, onLoginMobile, openDirect, prepareLoginTenant, signInMobile } from './common';

// US-SESION-010 — Llevar al acceso cuando no hay sesión o no se puede renovar (app móvil, Expo web a 390 px; NO es nativo).
// Esquema 1: la app abierta sin ninguna sesión guardada (con alumno01 en «Tenant de trabajo») lleva a /login. Esquema 2: con la sesión
// iniciada por la propia fila, el cambio de estado de la cuenta hace que la renovación al volver a abrir la app falle y la app quede en /login.

const LOGIN_EXPECTED = 'llega a /login y ve el título «Iniciar sesión»';

// --- Esquema 1: sin sesión iniciada, cualquier pantalla privada lleva a /login ----------------------------------------------

const withoutSession: BrowserRowHandler = async (row, { page }) => {
  const route = strict('ruta', ROUTES, cell(row, 'ruta'));
  const expected = `${LOGIN_EXPECTED} (al abrir ${route} sin sesión)`;
  await resetTenants([TENANT_A]);
  const prepared = await prepareLoginTenant(page);
  if (prepared) return preparationFailedWeb(expected, prepared);
  const opened = await openDirect(page, route);
  if (opened) return outcome(false, expected, opened, { note: DIRECT_NOTE });
  const landed = await waitUntil(() => onLoginMobile(page));
  const heading = await visibilityOf(loginHeading(page));
  return conclude(
    [
      check(pathOf(page) === '/login' && landed.reached, 'llega a /login', `ruta ${pathOf(page)}`),
      check(heading === 'visible', 've el título «Iniciar sesión»', `título ${heading}`),
    ],
    { note: DIRECT_NOTE },
  );
};

// --- Esquema 2: una sesión que no se puede renovar al abrir la app lleva a /login --------------------------------------------

const reopenWithoutRenewal: BrowserRowHandler = async (row, { page, context }) => {
  const cambio = cell(row, 'cambio');
  const expected = `${LOGIN_EXPECTED} al cerrar y volver a abrir la app (${cambio})`;
  await resetTenants([TENANT_A]);
  const signed = await signInMobile(page, DEMO.gestor);
  if (signed) return preparationFailedWeb(expected, signed);
  const changed = await strict('cambio', CHANGES, cambio)();
  if (changed) return preparationFailedWeb(expected, changed);
  // Cerrar la app y volver a abrirla: otra página del mismo contexto (el almacenamiento con la sesión guardada se conserva)
  const reopened = await context.newPage();
  await page.close();
  const opened = await runStepsLogged([['volver a abrir la app (su raíz)', () => reopened.goto('/', { timeout: CEILING_MS })]]);
  if (opened) return outcome(false, expected, opened, { note: REOPEN_NOTE });
  const landed = await waitUntil(() => onLoginMobile(reopened));
  const heading = await visibilityOf(loginHeading(reopened));
  return conclude(
    [
      check(pathOf(reopened) === '/login' && landed.reached, 'llega a /login', `ruta ${pathOf(reopened)}`),
      check(heading === 'visible', 've el título «Iniciar sesión»', `título ${heading}`),
    ],
    { note: REOPEN_NOTE },
  );
};

defineBrowserRows({
  story: 'US-SESION-010',
  surface: 'expo-web',
  tenants: [TENANT_A],
  handlers: new Map<number, BrowserRowHandler>([
    [1, onExpoWeb(withoutSession)],
    [2, onExpoWeb(reopenWithoutRenewal)],
  ]),
});
