import { field } from '../../../story-runs/support/api';
import { DEMO, TENANT_A, resetTenants } from '../../../story-runs/support/prepare';
import { pathOf, waitUntil } from '../../support/browser';
import { cell, check, conclude, preparationFailedWeb, strict } from '../../support/checks';
import { defineBrowserRows, outcome, type BrowserRowHandler } from '../../core/framework';
import { CHANGES, ROUTES, dataLeaks, storageEmpty, storedSession, visibilityOf, watchDataLeaks } from '../web/common';
import {
  DIRECT_NOTE,
  REOPEN_NOTE,
  loginHeading,
  onExpoWeb,
  onLoginMobile,
  onProgramsMobile,
  openDirect,
  prepareLoginTenant,
  reopenApp,
  signInMobile,
} from './common';

// US-SESION-010 — Llevar al acceso cuando no hay sesión o no se puede renovar (app móvil, Expo web a 390 px; NO es nativo).
// Esquema 1: la app abierta sin ninguna sesión guardada (con alumno01 en «Tenant de trabajo») lleva a /login, y no muestra datos antes.
// Esquema 2: con la sesión iniciada por la propia fila, el cambio de estado de la cuenta hace que la renovación al volver a abrir la app
// falle y la app quede en /login. Antes se comprueba con un control sin cambios que volver a abrir conserva la sesión.

const LOGIN_EXPECTED = 'llega a /login y ve el título «Iniciar sesión»';

// --- Esquema 1: sin sesión iniciada, cualquier pantalla privada lleva a /login ----------------------------------------------

const withoutSession: BrowserRowHandler = async (row, { page }) => {
  const route = strict('ruta', ROUTES, cell(row, 'ruta'));
  const expected = `${LOGIN_EXPECTED} (al abrir ${route} sin sesión)`;
  await resetTenants([TENANT_A]);
  const prepared = await prepareLoginTenant(page);
  if (prepared) return preparationFailedWeb(expected, prepared);
  // Se vigila desde la primera carga de la página que abre la ruta
  await watchDataLeaks(page);
  const opened = await openDirect(page, route);
  if (opened) return outcome(false, expected, opened, { note: DIRECT_NOTE });
  const landed = await waitUntil(() => onLoginMobile(page));
  const path = pathOf(page);
  const heading = await visibilityOf(loginHeading(page));
  const leaks = await dataLeaks(page);
  return conclude(
    [
      check(path === '/login' && landed.reached, 'llega a /login', `ruta ${path}`),
      check(heading === 'visible', 've el título «Iniciar sesión»', `título ${heading}`),
      check(
        leaks !== undefined && leaks.length === 0,
        'no muestra datos de la app (ni PRG-001, NC-001 ni REQ-001) antes de llegar a /login',
        leaks === undefined ? 'no se pudo leer la página' : leaks.length === 0 ? 'no muestra datos' : `llegó a mostrar ${leaks.join(', ')}`,
      ),
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

  // Control positivo sin cambios: volver a abrir la app con la cuenta activa conserva la sesión
  const control = await reopenApp(context, page);
  if (control.failure) return preparationFailedWeb(expected, `control sin cambios: ${control.failure}`);
  const controlKept = await waitUntil(() => onProgramsMobile(control.page));
  const controlRenewal = await control.renewal;
  if (!controlKept.reached || controlRenewal?.status !== 200) {
    return preparationFailedWeb(expected, `el control sin cambios no conserva la sesión al volver a abrir (renovación ${controlRenewal?.status ?? 'sin respuesta'}; ruta ${pathOf(control.page)})`);
  }

  const changed = await strict('cambio', CHANGES, cambio)();
  if (changed) return preparationFailedWeb(expected, changed);

  // Cerrar la app y volver a abrirla: otra página del mismo contexto; la renovación se registra antes de abrir la raíz
  const reopened = await reopenApp(context, control.page);
  if (reopened.failure) return outcome(false, expected, reopened.failure, { note: REOPEN_NOTE });
  const landed = await waitUntil(() => onLoginMobile(reopened.page));
  // La ruta y el título se leen antes de cualquier otra acción sobre la página
  const path = pathOf(reopened.page);
  const heading = await visibilityOf(loginHeading(reopened.page));
  const renewed = await reopened.renewal;
  const renewalCode = field(renewed?.body, 'code');
  // El almacén se borra de forma asíncrona: se espera a que quede vacío (una lectura fallida no cuenta como vacía)
  const cleared = await waitUntil(async () => storageEmpty(await storedSession(reopened.page)));
  const stored = await storedSession(reopened.page);
  return conclude(
    [
      check(
        renewed?.status === 401 && renewalCode === 'invalid_token',
        'la renovación al volver a abrir responde 401 invalid_token',
        renewed === undefined ? 'sin respuesta de renovación' : `renovación ${renewed.status}${typeof renewalCode === 'string' ? ` ${renewalCode}` : ''}`,
      ),
      check(path === '/login' && landed.reached, 'llega a /login', `ruta ${path}`),
      check(heading === 'visible', 've el título «Iniciar sesión»', `título ${heading}`),
      check(
        storageEmpty(stored) && cleared.reached,
        'no queda ninguna sesión guardada en el almacenamiento',
        stored === undefined ? 'no se pudo leer el almacenamiento' : `localStorage ${stored.local ? 'con' : 'sin'} sesión; sessionStorage ${stored.session ? 'con' : 'sin'} sesión`,
      ),
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
