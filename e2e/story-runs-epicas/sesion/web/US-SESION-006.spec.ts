import { field } from '../../../story-runs/support/api';
import { TENANT_A } from '../../../story-runs/support/prepare';
import { ACTION, isVisible, pathOf, waitUntil } from '../../support/browser';
import { cell, check, conclude, preparationFailedWeb, strict } from '../../support/checks';
import { defineBrowserRows, type BrowserRowHandler } from '../../core/framework';
import { shortText } from '../api/common';
import {
  LOGIN_PATH,
  NC_CODE,
  actionMissing,
  injectNcUnauthorizedOnce,
  ncCard,
  ncNav,
  onProgramsPage,
  programsNav,
  renewalResponse,
  renewalSequence,
  renewedRefreshLifetime,
  requestsTo,
  runStepsLogged,
  signInWeb,
  storedSession,
  watchTraffic,
} from './common';

// US-SESION-006 — Renovar la sesión sin cambiar de pantalla cuando caduca el acceso (web, 1440 px). Preparación de cada fila: reinicio de
// alumno01, acceso con gestor@sigpro.test en una pestaña sin sesión guardada, con la casilla que diga la fila, y /programs. Después, la
// prueba responde 401 invalid_token a la PRIMERA petición de la lista de no conformidades (los 900 segundos no se esperan).

/** Casilla «Mantener la sesión en este equipo»: marcada = 7 días en localStorage; desmarcada = 12 horas en sessionStorage. */
const CASILLAS: ReadonlyMap<string, boolean> = new Map<string, boolean>([
  ['marcada', true],
  ['desmarcada', false],
]);

const EXPECTED = 'llega a /nc y ve la no conformidad NC-001; no llega a /login; vuelve a /programs sin volver a iniciar sesión';

const renewsInPlace: BrowserRowHandler = async (row, { page }) => {
  const remember = strict('casilla', CASILLAS, cell(row, 'casilla'));
  const prepared = await signInWeb(page, remember);
  if (prepared) return preparationFailedWeb(EXPECTED, prepared);

  // Desde aquí se registra el tráfico y se fabrica el 401 de la primera lista de no conformidades
  const traffic = watchTraffic(page);
  const injection = await injectNcUnauthorizedOnce(page, traffic);
  const renewal = renewalResponse(page);
  const fromClick = traffic.requests.length;
  const clicked = await runStepsLogged([['pulsar «No conformidades» en el menú de navegación', () => ncNav(page).click(ACTION)]]);
  if (clicked) return actionMissing(EXPECTED, clicked);
  const shown = await waitUntil(() => isVisible(ncCard(page, NC_CODE)));
  if (injection.fired() !== 1) return preparationFailedWeb(EXPECTED, `la lista de no conformidades no recibió el 401 de prueba (recibidos: ${injection.fired()})`);

  const path = pathOf(page);
  const reply = await renewal;
  const newAccess = field(reply?.body, 'accessToken');
  const newRefresh = field(reply?.body, 'refreshToken');
  const lifetime = renewedRefreshLifetime(reply?.body);
  const sequence = renewalSequence(traffic.entries);
  const stored = await storedSession(page);
  // Recuentos por recurso desde el clic: una sola renovación y una sola repetición de la lista (la del 401 y su reintento)
  const listRequests = requestsTo(traffic, fromClick, 'GET', '/api/nc');
  const renewalRequests = requestsTo(traffic, fromClick, 'POST', '/api/auth/refresh');
  const retry = listRequests[1];
  const expectedLifetime = remember ? 604_800 : 43_200;
  const expectedStore = remember ? 'localStorage' : 'sessionStorage';
  const storeOk = stored !== undefined && (remember ? stored.local && !stored.session : stored.session && !stored.local);

  const back = await runStepsLogged([['pulsar «Programas» en el menú de navegación', () => programsNav(page).click(ACTION)]]);
  const arrived = await waitUntil(() => onProgramsPage(page));

  return conclude(
    [
      check(path === '/nc' && shown.reached, 'llega a /nc y ve la no conformidad NC-001 en la pantalla', `ruta ${path}; NC-001 ${shown.reached ? 'visible' : 'no visible'}`),
      check(!traffic.visited.includes(LOGIN_PATH), 'no llega a /login', `rutas visitadas: ${traffic.visited.join(' → ') || '(ninguna)'}`),
      // Regla que la fila da por hecha: el 401 se repite una sola vez, tras una renovación con el refreshToken guardado
      check(sequence.ok, 'la lista responde 401, la web renueva la sesión (200) y repite la lista (200)', sequence.observed),
      check(renewalRequests.length === 1, 'la web pide la renovación una sola vez', `peticiones a /api/auth/refresh: ${renewalRequests.length}`),
      check(listRequests.length === 2, 'la lista se pide dos veces: la del 401 y un único reintento', `peticiones a /api/nc: ${listRequests.length}`),
      // El reintento debe llevar el accessToken de la renovación: el anterior sigue valiendo en la API y daría 200 igual
      check(
        typeof newAccess === 'string' && retry?.authorization === `Bearer ${newAccess}`,
        'el reintento lleva el accessToken que devolvió la renovación',
        retry?.authorization === undefined ? 'el reintento no lleva cabecera Authorization' : retry.authorization === `Bearer ${String(newAccess)}` ? 'el reintento lleva el accessToken de la renovación' : 'el reintento lleva otro accessToken',
      ),
      check(lifetime === expectedLifetime, `la renovación conserva la casilla: refreshToken de ${expectedLifetime} s`, `refreshToken de la renovación de ${shortText(lifetime)} s`),
      // El refreshToken guardado es el que devolvió la renovación (comparación exacta, no solo «hay un refreshToken»)
      check(
        storeOk && typeof newRefresh === 'string' && stored?.refreshToken === newRefresh,
        `la sesión renovada se guarda en ${expectedStore} con el refreshToken de la renovación`,
        `localStorage ${stored?.local ? 'con' : 'sin'} sesión; sessionStorage ${stored?.session ? 'con' : 'sin'} sesión; refreshToken ${stored?.refreshToken === undefined ? 'ausente' : stored.refreshToken === newRefresh ? 'igual al de la renovación' : 'distinto del de la renovación'}`,
      ),
      check(back === undefined && arrived.reached, 'pulsa «Programas» y ve /programs sin volver a iniciar sesión', back ?? (arrived.reached ? 've /programs' : `no llega a /programs (ruta ${pathOf(page)})`)),
    ],
    { evidence: { casilla: cell(row, 'casilla'), peticiones: sequence.observed } },
  );
};

defineBrowserRows({
  story: 'US-SESION-006',
  surface: 'web',
  tenants: [TENANT_A],
  handlers: new Map<number, BrowserRowHandler>([[1, renewsInPlace]]),
});
