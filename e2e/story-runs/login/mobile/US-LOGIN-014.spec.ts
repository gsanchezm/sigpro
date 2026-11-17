import { TENANT_A } from '../../support/prepare';
import { defineBrowserRows, notExecutable, type BrowserRowHandler } from '../../support/rows';
import { cell } from './common';

// US-LOGIN-014 — [Móvil] Mostrar la contraseña, la casilla de mantener la sesión y el aviso de sesión cerrada, como en la web.
// Es una capacidad futura (historia no-implementada): no se prueba contra la app. Cada fila tiene su manejador y su resultado,
// pero ninguna abre nada.

const NOT_TESTED = 'capacidad futura (historia no-implementada): no se prueba contra la app';

const toggle: BrowserRowHandler = async (row) =>
  notExecutable(`pulsa el control de la contraseña ${cell(row, 'veces')} veces: la contraseña se ve ${cell(row, 'visibilidad')}; el campo sigue conteniendo la contraseña escrita y no se ha enviado nada`, NOT_TESTED);

const rememberBox: BrowserRowHandler = async (row) =>
  notExecutable(`con la app en la situación «${cell(row, 'situacion')}», al llegar a /login ve la casilla «Mantener la sesión en este equipo» marcada`, NOT_TESTED);

const closedSessionNotice: BrowserRowHandler = async (row) =>
  notExecutable(`con la app en la situación «${cell(row, 'situacion')}», cuando ${cell(row, 'accion')}: ${cell(row, 'aviso')}`, NOT_TESTED);

defineBrowserRows({
  story: 'US-LOGIN-014',
  surface: 'expo-web',
  tenants: [TENANT_A],
  handlers: new Map<number, BrowserRowHandler>([
    [1, toggle],
    [2, rememberBox],
    [3, closedSessionNotice],
  ]),
});
