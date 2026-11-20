import { notExecutable, defineBrowserRows, type BrowserRowHandler, type ManifestRow } from '../../core/framework';
import { TENANT_A } from '../../../story-runs/support/prepare';

// US-ADMIN-USUARIOS-012 — Aprobar una cuenta pendiente de aprobación desde la tabla de usuarios (`no-implementada`).
// Capacidad futura: la app no tiene hoy ningún control ni endpoint para aprobar cuentas. Ninguna fila se ejecuta contra la app; las
// decisiones de producto siguen en «Decisiones pendientes» de la historia.

const NOTE = 'capacidad futura, no se prueba contra la app: la tabla no tiene control para aprobar y la historia lo deja en «Decisiones pendientes».';

/** Texto esperado de la fila: sus celdas tal como las escribe la historia. */
const expectedOf = (row: ManifestRow): string => Object.entries(row.cells).map(([key, value]) => `${key} ${value}`).join('; ');

const futureRow: BrowserRowHandler = async (row) => notExecutable(expectedOf(row), NOTE);

defineBrowserRows({
  story: 'US-ADMIN-USUARIOS-012',
  surface: 'web',
  tenants: [TENANT_A],
  handlers: new Map<number, BrowserRowHandler>([
    [1, futureRow],
    [2, futureRow],
  ]),
});
