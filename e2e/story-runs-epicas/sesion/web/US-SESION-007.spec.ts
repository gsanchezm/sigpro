import { field } from '../../../story-runs/support/api';
import { TENANT_A, resetTenants } from '../../../story-runs/support/prepare';
import { ACTION, pathOf, waitUntil } from '../../support/browser';
import { cell, check, conclude, preparationFailedWeb, strict } from '../../support/checks';
import { defineBrowserRows, outcome, type BrowserRowHandler } from '../../core/framework';
import {
  CHANGES,
  LOGIN_PATH,
  actionMissing,
  dataLeaks,
  emailField,
  loginHeading,
  noSessionAtEnd,
  onLoginForm,
  onProgramsPage,
  renewalResponse,
  ROUTES,
  runStepsLogged,
  signInWeb,
  storageEmpty,
  storedSession,
  visibilityOf,
  watchDataLeaks,
} from './common';

// US-SESION-007 — Llevar al acceso cuando no hay sesión o no se puede renovar (web, 1440 px). Esquema 1: en un navegador sin ninguna
// sesión guardada (contexto nuevo), una pantalla privada lleva a /login, y no muestra datos antes. Esquema 2: con sesión iniciada por la
// propia fila (casilla marcada, /programs), el cambio de estado de la cuenta hace que la renovación al recargar falle y la sesión termine.

const LOGIN_EXPECTED = 'llega a /login y ve el formulario «Iniciar sesión»';

// --- Esquema 1: sin sesión iniciada, una pantalla privada lleva al acceso ---------------------------------------------------

const withoutSession: BrowserRowHandler = async (row, { page }) => {
  const route = strict('ruta', ROUTES, cell(row, 'ruta'));
  const expected = `${LOGIN_EXPECTED} (al abrir ${route} sin sesión)`;
  await resetTenants([TENANT_A]);
  // Se vigila desde la primera carga: si la pantalla privada mostrara datos antes de redirigir, quedaría registrado
  await watchDataLeaks(page);
  const opened = await runStepsLogged([[`abrir ${route} en la misma pestaña`, () => page.goto(route, ACTION)]]);
  if (opened) return outcome(false, expected, opened, { note: 'No se pudo abrir la ruta en el navegador (la llamada de Playwright va en la observación).' });
  const landed = await waitUntil(() => onLoginForm(page));
  const path = pathOf(page);
  const heading = await visibilityOf(loginHeading(page));
  const formField = await visibilityOf(emailField(page));
  const leaks = await dataLeaks(page);
  return conclude([
    check(path === LOGIN_PATH && landed.reached, 'llega a /login', `ruta ${path}`),
    check(heading === 'visible' && formField === 'visible', 've el formulario «Iniciar sesión»', `título ${heading}; campo de correo ${formField}`),
    check(
      leaks !== undefined && leaks.length === 0,
      'no muestra datos de la app (ni PRG-001, NC-001 ni REQ-001) antes de llegar a /login',
      leaks === undefined ? 'no se pudo leer la página' : leaks.length === 0 ? 'no muestra datos' : `llegó a mostrar ${leaks.join(', ')}`,
    ),
  ]);
};

// --- Esquema 2: una sesión que no se puede renovar al recargar lleva al acceso ----------------------------------------------

const reloadWithoutRenewal: BrowserRowHandler = async (row, { page }) => {
  const cambio = cell(row, 'cambio');
  const expected = `${LOGIN_EXPECTED} sin sesión iniciada (recargar /programs con ${cambio})`;
  const prepared = await signInWeb(page, true);
  if (prepared) return preparationFailedWeb(expected, prepared);

  // Control positivo sin cambios: recargar /programs con la cuenta activa conserva la sesión; si no, el caso negativo no probaría nada
  const controlRenewal = renewalResponse(page);
  const controlReload = await runStepsLogged([['recargar la pestaña en /programs (control sin cambios)', () => page.reload(ACTION)]]);
  if (controlReload) return preparationFailedWeb(expected, controlReload);
  const controlKept = await waitUntil(() => onProgramsPage(page));
  const control = await controlRenewal;
  if (!controlKept.reached || control?.status !== 200) {
    return preparationFailedWeb(expected, `el control sin cambios no conserva la sesión al recargar (renovación ${control?.status ?? 'sin respuesta'}; ruta ${pathOf(page)})`);
  }

  const changed = await strict('cambio', CHANGES, cambio)();
  if (changed) return preparationFailedWeb(expected, changed);

  // La respuesta de la renovación se registra ANTES de recargar: así no se pierde si llega durante la recarga
  const renewal = renewalResponse(page);
  const reloaded = await runStepsLogged([['recargar la pestaña en /programs', () => page.reload(ACTION)]]);
  if (reloaded) return actionMissing(expected, reloaded);
  const renewed = await renewal;
  const landed = await waitUntil(() => onLoginForm(page));
  // La ruta se lee ANTES de cualquier otra navegación: la comprobación de «sin sesión» navega a /programs
  const path = pathOf(page);
  const heading = await visibilityOf(loginHeading(page));
  const formField = await visibilityOf(emailField(page));
  // El almacén se borra de forma asíncrona: se espera a que quede vacío (una lectura fallida no cuenta como vacía)
  const cleared = await waitUntil(async () => storageEmpty(await storedSession(page)));
  const stored = await storedSession(page);
  const renewalCode = field(renewed?.body, 'code');
  // La comprobación de «sin sesión» navega: va siempre el último paso
  const stays = await noSessionAtEnd(page);
  return conclude([
    check(
      renewed?.status === 401 && renewalCode === 'invalid_token',
      'la renovación al recargar responde 401 invalid_token',
      renewed === undefined ? 'sin respuesta de renovación' : `renovación ${renewed.status}${typeof renewalCode === 'string' ? ` ${renewalCode}` : ''}`,
    ),
    check(path === LOGIN_PATH && landed.reached, 'llega a /login', `ruta ${path}`),
    check(heading === 'visible' && formField === 'visible', 've el formulario «Iniciar sesión»', `título ${heading}; campo de correo ${formField}`),
    check(
      storageEmpty(stored) && cleared.reached,
      'no queda ninguna sesión guardada en el almacenamiento',
      stored === undefined ? 'no se pudo leer el almacenamiento' : `localStorage ${stored.local ? 'con' : 'sin'} sesión; sessionStorage ${stored.session ? 'con' : 'sin'} sesión`,
    ),
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
