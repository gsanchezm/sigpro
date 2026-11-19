import { defineBrowserRows, notExecutable, type BrowserRowHandler } from '../../core/framework';
import { TENANT_A } from '../../../story-runs/support/prepare';
import { thenOf } from '../api/common';

// US-DOC-VERSIONES-008 — Subir un archivo como nueva versión (web). Historia `no-implementada`: en la app no hay ningún control para elegir
// un archivo; la nueva versión se escribe como texto. Ninguna fila se ejecuta contra la app: cada una devuelve `notExecutable` con su
// Entonces tal como está en el manifiesto y el motivo de la historia. Las decisiones pendientes (tipos, tamaño, conversión) no se juzgan.

const MOTIVO = 'capacidad futura, no se prueba contra la app: la web no tiene un control para elegir un archivo como nueva versión (hoy la versión se escribe como texto). Sus decisiones pendientes están en la historia.';

defineBrowserRows({
  story: 'US-DOC-VERSIONES-008',
  surface: 'web',
  tenants: [TENANT_A],
  handlers: new Map<number, BrowserRowHandler>([
    [1, async (row) => notExecutable(thenOf(row), MOTIVO)],
    [2, async (row) => notExecutable(thenOf(row), MOTIVO)],
  ]),
});
