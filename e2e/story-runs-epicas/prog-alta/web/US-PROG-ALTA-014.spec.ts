import { TENANT_A } from '../../../story-runs/support/prepare';
import { cell } from '../../support/checks';
import { defineBrowserRows, notExecutable, type BrowserRowHandler } from '../../core/framework';

// US-PROG-ALTA-014 — Avisar al equipo por correo al crear un programa (web). Capacidad futura (`no-implementada`): hoy la app no envía
// correos y la historia describe lo mínimo acordado para cuando el aviso exista. Cada fila devuelve `notExecutable` con lo que la
// historia dice; no se abre la app ni se toca la API.

const NOT_EXECUTABLE_REASON = 'capacidad futura, no se prueba contra la app';

const notifyTeam: BrowserRowHandler = async (row) => notExecutable(`la opción «Notificar al equipo por correo» ${cell(row, 'opcion')}: ${cell(row, 'resultado')}`, NOT_EXECUTABLE_REASON);

defineBrowserRows({
  story: 'US-PROG-ALTA-014',
  surface: 'web',
  tenants: [TENANT_A],
  handlers: new Map<number, BrowserRowHandler>([[1, notifyTeam]]),
});
