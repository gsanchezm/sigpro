import { DEMO, TENANT_A, resetTenants, type Credentials } from '../../../story-runs/support/prepare';
import { isVisible, pathOf, waitUntil } from '../../support/browser';
import { cell, check, conclude, preparationFailedWeb, strict } from '../../support/checks';
import { defineBrowserRows, type BrowserRowHandler } from '../../core/framework';
import { shortText } from '../api/common';
import { NC_CODE, actionMissing, injectNcUnauthorizedOnce, refreshReply, renewalSequence, renewedRefreshLifetime, watchTraffic } from '../web/common';
import { ncCardMobile, onExpoWeb, onProgramsMobile, signInMobile, tapTab } from './common';

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
  const renewal = refreshReply(page);
  const tapped = await tapTab(page, 'No conformidades', 'nc');
  if (tapped) return actionMissing(EXPECTED, tapped);
  const shown = await waitUntil(() => isVisible(ncCardMobile(page, NC_CODE)));
  if (injection.fired() !== 1) return preparationFailedWeb(EXPECTED, `la lista de no conformidades no recibió el 401 de prueba (recibidos: ${injection.fired()})`);

  const path = pathOf(page);
  const sequence = renewalSequence(traffic.entries);
  const lifetime = renewedRefreshLifetime(await renewal);

  const back = await tapTab(page, 'Programas', 'programs');
  const arrived = await waitUntil(() => onProgramsMobile(page));

  return conclude([
    check(path === '/nc' && shown.reached, 'llega a /nc y ve la no conformidad NC-001 en la pantalla', `ruta ${path}; NC-001 ${shown.reached ? 'visible' : 'no visible'}`),
    check(!traffic.visited.includes('/login'), 'no llega a /login', `rutas visitadas: ${traffic.visited.join(' → ') || '(ninguna)'}`),
    // Regla que la fila da por hecha: el 401 se repite una sola vez, tras una renovación con el refreshToken guardado
    check(sequence.ok, 'la lista responde 401, la app renueva la sesión (200) y repite la lista (200)', sequence.observed),
    // La app móvil siempre pide la sesión de 7 días (remember verdadero)
    check(lifetime === 604_800, 'la sesión renovada dura 7 días (604800 s)', `la sesión renovada dura ${shortText(lifetime)} s`),
    check(back === undefined && arrived.reached, 'pulsa «Programas» y ve /programs sin volver a iniciar sesión', back ?? (arrived.reached ? 've /programs' : `no llega a /programs (ruta ${pathOf(page)})`)),
  ]);
};

defineBrowserRows({
  story: 'US-SESION-009',
  surface: 'expo-web',
  tenants: [TENANT_A],
  handlers: new Map<number, BrowserRowHandler>([[1, onExpoWeb(renewsInApp)]]),
});
