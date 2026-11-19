import { TENANT_A } from '../../../story-runs/support/prepare';
import { cell } from '../../support/checks';
import { defineBrowserRows, notExecutable, type BrowserRowHandler } from '../../support/framework';

// US-REGISTRO-016 — Llevar el foco al primer campo con aviso al enviar la solicitud (app móvil). Capacidad futura
// (`no-implementada`): la app móvil no mueve el foco al primer campo con aviso; cada fila devuelve `notExecutable` con lo que
// la historia dice que debe pasar. Nada se ejecuta contra la app.

const NOT_EXECUTABLE_REASON = 'capacidad futura, no se prueba contra la app';

const focusFirstWarning: BrowserRowHandler = async (row) => notExecutable(`el foco está en ${cell(row, 'campo_enfocado')}`, NOT_EXECUTABLE_REASON);

defineBrowserRows({
  story: 'US-REGISTRO-016',
  surface: 'expo-web',
  tenants: [TENANT_A],
  handlers: new Map<number, BrowserRowHandler>([[1, focusFirstWarning]]),
});
