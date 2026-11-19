import { defineApiRows, notExecutable, type ApiRowHandler } from '../../core/framework';
import { cell } from '../../support/checks';
import { TENANT_A, codeCell } from './common';

// US-REQ-EDICION-007 — Cambiar el padre de un requisito al reordenarlo (API). Historia «no-implementada»: hoy el reordenamiento solo
// cambia la posición entre hermanos, así que cada fila es una capacidad futura. No se llama a la API: cada fila devuelve notExecutable.

const MOTIVO = 'capacidad futura, no se prueba contra la app';

const reparentingNotImplemented: ApiRowHandler = async (row) => notExecutable(`REQ-002 queda como hijo de ${codeCell(cell(row, 'destino'))}`, MOTIVO);

defineApiRows({
  story: 'US-REQ-EDICION-007',
  surface: 'api',
  tenants: [TENANT_A],
  handlers: new Map<number, ApiRowHandler>([[1, reparentingNotImplemented]]),
});
