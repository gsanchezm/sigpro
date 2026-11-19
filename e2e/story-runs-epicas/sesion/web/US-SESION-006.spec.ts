import { TENANT_A } from '../../../story-runs/support/prepare';
import { ACTION, isVisible, pathOf, waitUntil } from '../../support/browser';
import { cell, check, conclude, preparationFailedWeb, strict } from '../../support/checks';
import { defineBrowserRows, type BrowserRowHandler } from '../../core/framework';
import { shortText } from '../api/common';
import { LOGIN_PATH, NC_CODE, actionMissing, injectNcUnauthorizedOnce, ncCard, ncNav, onProgramsPage, programsNav, refreshReply, renewalSequence, renewedRefreshLifetime, runStepsLogged, signInWeb, storedSession, watchTraffic } from './common';

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
  const renewal = refreshReply(page);
  const clicked = await runStepsLogged([['pulsar «No conformidades» en el menú de navegación', () => ncNav(page).click(ACTION)]]);
  if (clicked) return actionMissing(EXPECTED, clicked);
  const shown = await waitUntil(() => isVisible(ncCard(page, NC_CODE)));
  if (injection.fired() !== 1) return preparationFailedWeb(EXPECTED, `la lista de no conformidades no recibió el 401 de prueba (recibidos: ${injection.fired()})`);

  const path = pathOf(page);
  const lifetime = renewedRefreshLifetime(await renewal);
  const sequence = renewalSequence(traffic.entries);
  const stored = await storedSession(page);
  const expectedLifetime = remember ? 604_800 : 43_200;

  const back = await runStepsLogged([['pulsar «Programas» en el menú de navegación', () => programsNav(page).click(ACTION)]]);
  const arrived = await waitUntil(() => onProgramsPage(page));

  return conclude(
    [
      check(path === '/nc' && shown.reached, 'llega a /nc y ve la no conformidad NC-001 en la pantalla', `ruta ${path}; NC-001 ${shown.reached ? 'visible' : 'no visible'}`),
      check(!traffic.visited.includes(LOGIN_PATH), 'no llega a /login', `rutas visitadas: ${traffic.visited.join(' → ') || '(ninguna)'}`),
      // Regla que la fila da por hecha: el 401 se repite una sola vez, tras una renovación con el refreshToken guardado
      check(sequence.ok, 'la lista responde 401, la web renueva la sesión (200) y repite la lista (200)', sequence.observed),
      check(lifetime === expectedLifetime, `la renovación conserva la casilla: refreshToken de ${expectedLifetime} s`, `refreshToken de la renovación de ${shortText(lifetime)} s`),
      check(
        remember ? stored.local && !stored.session : stored.session && !stored.local,
        remember ? 'la sesión renovada se guarda en localStorage (casilla marcada)' : 'la sesión renovada se guarda en sessionStorage (casilla desmarcada)',
        `localStorage ${stored.local ? 'con' : 'sin'} sesión; sessionStorage ${stored.session ? 'con' : 'sin'} sesión`,
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
