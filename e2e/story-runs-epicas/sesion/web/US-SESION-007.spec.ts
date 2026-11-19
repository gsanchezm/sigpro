import { TENANT_A, resetTenants } from '../../../story-runs/support/prepare';
import { ACTION, pathOf, waitUntil } from '../../support/browser';
import { cell, check, conclude, preparationFailedWeb, strict } from '../../support/checks';
import { defineBrowserRows, outcome, type BrowserRowHandler } from '../../core/framework';
import { CHANGES, actionMissing, emailField, LOGIN_PATH, loginHeading, noSessionAtEnd, onLoginForm, ROUTES, runStepsLogged, signInWeb, visibilityOf } from './common';

// US-SESION-007 — Llevar al acceso cuando no hay sesión o no se puede renovar (web, 1440 px). Esquema 1: en un navegador sin ninguna
// sesión guardada (contexto nuevo), una pantalla privada lleva a /login. Esquema 2: con sesión iniciada por la propia fila (casilla
// marcada, /programs), el cambio de estado de la cuenta hace que la renovación al recargar falle y la sesión termine.

const LOGIN_EXPECTED = 'llega a /login y ve el formulario «Iniciar sesión»';

// --- Esquema 1: sin sesión iniciada, una pantalla privada lleva al acceso ---------------------------------------------------

const withoutSession: BrowserRowHandler = async (row, { page }) => {
  const route = strict('ruta', ROUTES, cell(row, 'ruta'));
  const expected = `${LOGIN_EXPECTED} (al abrir ${route} sin sesión)`;
  await resetTenants([TENANT_A]);
  const opened = await runStepsLogged([[`abrir ${route} en la misma pestaña`, () => page.goto(route, ACTION)]]);
  if (opened) return outcome(false, expected, opened, { note: 'No se pudo abrir la ruta en el navegador (la llamada de Playwright va en la observación).' });
  const landed = await waitUntil(() => onLoginForm(page));
  const heading = await visibilityOf(loginHeading(page));
  const field = await visibilityOf(emailField(page));
  return conclude([
    check(pathOf(page) === LOGIN_PATH && landed.reached, 'llega a /login', `ruta ${pathOf(page)}`),
    check(heading === 'visible' && field === 'visible', 've el formulario «Iniciar sesión»', `título ${heading}; campo de correo ${field}`),
  ]);
};

// --- Esquema 2: una sesión que no se puede renovar al recargar lleva al acceso ----------------------------------------------

const reloadWithoutRenewal: BrowserRowHandler = async (row, { page }) => {
  const cambio = cell(row, 'cambio');
  const expected = `${LOGIN_EXPECTED} sin sesión iniciada (recargar /programs con ${cambio})`;
  const prepared = await signInWeb(page, true);
  if (prepared) return preparationFailedWeb(expected, prepared);
  const changed = await strict('cambio', CHANGES, cambio)();
  if (changed) return preparationFailedWeb(expected, changed);
  const reloaded = await runStepsLogged([['recargar la pestaña en /programs', () => page.reload(ACTION)]]);
  if (reloaded) return actionMissing(expected, reloaded);
  const landed = await waitUntil(() => onLoginForm(page));
  const heading = await visibilityOf(loginHeading(page));
  const field = await visibilityOf(emailField(page));
  // La comprobación de «sin sesión» navega a /programs: va siempre el último paso
  const stays = await noSessionAtEnd(page);
  return conclude([
    check(pathOf(page) === LOGIN_PATH && landed.reached, 'llega a /login', `ruta ${pathOf(page)}`),
    check(heading === 'visible' && field === 'visible', 've el formulario «Iniciar sesión»', `título ${heading}; campo de correo ${field}`),
    stays,
  ]);
};

defineBrowserRows({
  story: 'US-SESION-007',
  surface: 'web',
  tenants: [TENANT_A],
  handlers: new Map<number, BrowserRowHandler>([
    [1, withoutSession],
    [2, reloadWithoutRenewal],
  ]),
});
