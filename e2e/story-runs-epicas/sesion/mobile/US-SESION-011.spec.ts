import { TENANT_A } from '../../../story-runs/support/prepare';
import { cell } from '../../support/checks';
import { defineBrowserRows, notExecutable, type BrowserRowHandler } from '../../core/framework';

// US-SESION-011 — Aviso de sesión caducada en el acceso (app móvil). Capacidad futura (`no-implementada`): hoy ningún camino de la app
// muestra «La sesión ha caducado. Vuelve a iniciar sesión.». La historia describe lo que debe mostrar y no se prueba contra la app: cada
// fila devuelve `notExecutable` con lo que la historia dice (no se abre la app ni se toca la API).

const NOT_EXECUTABLE_REASON = 'capacidad futura, no se prueba contra la app';

const noticeOnLogin: BrowserRowHandler = async (row) =>
  notExecutable(`llega a /login y ve el aviso «La sesión ha caducado. Vuelve a iniciar sesión.» (${cell(row, 'cambio')})`, NOT_EXECUTABLE_REASON);

defineBrowserRows({
  story: 'US-SESION-011',
  surface: 'expo-web',
  tenants: [TENANT_A],
  handlers: new Map<number, BrowserRowHandler>([[1, noticeOnLogin]]),
});
