import { field } from '../../../story-runs/support/api';
import { DEMO, TENANT_A, resetTenants, type Credentials } from '../../../story-runs/support/prepare';
import { isVisible, pathOf, waitUntil } from '../../support/browser';
import { cell, check, conclude, preparationFailedWeb, strict } from '../../support/checks';
import { defineBrowserRows, type BrowserRowHandler } from '../../core/framework';
import { shortText } from '../api/common';
import {
  NC_CODE,
  actionMissing,
  injectNcUnauthorizedOnce,
  renewalResponse,
  renewalSequence,
  renewedRefreshLifetime,
  requestsTo,
  storedSession,
  watchTraffic,
} from '../web/common';
import { accessHasNoRememberBox, ncCardMobile, onExpoWeb, onProgramsMobile, openAccessWithoutSession, signInMobile, tapTab } from './common';

// US-SESION-009 — Renovar la sesión sin cambiar de pantalla cuando caduca el acceso (app móvil, Expo web a 390 px; NO es nativo).
// Preparación de cada fila: reinicio de alumno01; la cuenta de la fila inicia sesión en la app con alumno01 en «Tenant de trabajo» y
// llega a /programs. Después, la prueba responde 401 invalid_token a la primera petición de la lista de no conformidades.

const ACCOUNTS: ReadonlyMap<string, Credentials> = new Map<string, Credentials>([
  ['gestor@sigpro.test', DEMO.gestor],
  ['consultor@sigpro.test', DEMO.consultor],
]);

const EXPECTED = 'llega a /nc y ve la no conformidad NC-001; no llega a /login; pulsa «Programas» y ve /programs sin volver a iniciar sesión';

const renewsInApp: BrowserRowHandler = async (row, { page }) => {
  const credentials = strict('correo', ACCOUNTS, cell(row, 'correo'));
  await resetTenants([TENANT_A]);
  const signed = await signInMobile(page, credentials);
  if (signed) return preparationFailedWeb(EXPECTED, signed);

  // Desde aquí se registra el tráfico y se fabrica el 401 de la primera lista de no conformidades
  const traffic = watchTraffic(page);
  const injection = await injectNcUnauthorizedOnce(page, traffic);
  const renewal = renewalResponse(page);
  const fromClick = traffic.requests.length;
  const tapped = await tapTab(page, 'No conformidades', 'nc');
  if (tapped) return actionMissing(EXPECTED, tapped);
  const shown = await waitUntil(() => isVisible(ncCardMobile(page, NC_CODE)));
  if (injection.fired() !== 1) return preparationFailedWeb(EXPECTED, `la lista de no conformidades no recibió el 401 de prueba (recibidos: ${injection.fired()})`);

  const path = pathOf(page);
  const reply = await renewal;
  const newAccess = field(reply?.body, 'accessToken');
  const newRefresh = field(reply?.body, 'refreshToken');
  const lifetime = renewedRefreshLifetime(reply?.body);
  const sequence = renewalSequence(traffic.entries);
  // Recuentos por recurso desde el toque: una sola renovación y una sola repetición de la lista
  const listRequests = requestsTo(traffic, fromClick, 'GET', '/api/nc');
  const renewalRequests = requestsTo(traffic, fromClick, 'POST', '/api/auth/refresh');
  const retry = listRequests[1];
  // La sesión guardada se lee ANTES de cualquier otra navegación (la pantalla de acceso se abre al final)
  const stored = await storedSession(page);

  const back = await tapTab(page, 'Programas', 'programs');
  const arrived = await waitUntil(() => onProgramsMobile(page));
  // Las rutas visitadas se congelan aquí: abrir después la pantalla de acceso (comprobación de la casilla) NO cuenta como llegar a /login
  const visitedBeforeAccess = [...traffic.visited];

  // Pantalla de acceso sin sesión guardada: no ofrece la casilla «Mantener la sesión en este equipo» (la app no tiene esa opción)
  const accessOpened = await openAccessWithoutSession(page);
  const accessBox = await accessHasNoRememberBox(page);

  return conclude(
    [
      check(path === '/nc' && shown.reached, 'llega a /nc y ve la no conformidad NC-001 en la pantalla', `ruta ${path}; NC-001 ${shown.reached ? 'visible' : 'no visible'}`),
      check(!visitedBeforeAccess.includes('/login'), 'no llega a /login', `rutas visitadas: ${visitedBeforeAccess.join(' → ') || '(ninguna)'}`),
      // Regla que la fila da por hecha: el 401 se repite una sola vez, tras una renovación con el refreshToken guardado
      check(sequence.ok, 'la lista responde 401, la app renueva la sesión (200) y repite la lista (200)', sequence.observed),
      check(renewalRequests.length === 1, 'la app pide la renovación una sola vez', `peticiones a /api/auth/refresh: ${renewalRequests.length}`),
      check(listRequests.length === 2, 'la lista se pide dos veces: la del 401 y un único reintento', `peticiones a /api/nc: ${listRequests.length}`),
      check(
        typeof newAccess === 'string' && retry?.authorization === `Bearer ${newAccess}`,
        'el reintento lleva el accessToken que devolvió la renovación',
        retry?.authorization === undefined ? 'el reintento no lleva cabecera Authorization' : retry.authorization === `Bearer ${String(newAccess)}` ? 'el reintento lleva el accessToken de la renovación' : 'el reintento lleva otro accessToken',
      ),
      // La app móvil siempre pide la sesión de 7 días (remember verdadero)
      check(lifetime === 604_800, 'la sesión renovada dura 7 días (604800 s)', `la sesión renovada dura ${shortText(lifetime)} s`),
      // La sesión queda guardada en el almacén, con el refreshToken que devolvió la renovación (comparación exacta)
      check(
        stored !== undefined && stored.local && typeof newRefresh === 'string' && stored.refreshToken === newRefresh,
        'la sesión renovada queda guardada con el refreshToken de la renovación',
        stored === undefined ? 'no se pudo leer el almacenamiento' : `localStorage ${stored.local ? 'con' : 'sin'} sesión; refreshToken ${stored.refreshToken === undefined ? 'ausente' : stored.refreshToken === newRefresh ? 'igual al de la renovación' : 'distinto del de la renovación'}`,
      ),
      check(back === undefined && arrived.reached, 'pulsa «Programas» y ve /programs sin volver a iniciar sesión', back ?? (arrived.reached ? 've /programs' : `no llega a /programs (ruta ${pathOf(page)})`)),
      check(accessOpened === undefined && accessBox.absent, 'la pantalla de acceso no ofrece la casilla «Mantener la sesión en este equipo»', accessOpened ?? accessBox.observed),
    ],
    { note: 'La casilla se comprueba en la pantalla de acceso abierta sin sesión guardada (el almacenamiento de la prueba se borra al final de la fila).' },
  );
};

defineBrowserRows({
  story: 'US-SESION-009',
  surface: 'expo-web',
  tenants: [TENANT_A],
  handlers: new Map<number, BrowserRowHandler>([[1, onExpoWeb(renewsInApp)]]),
});
