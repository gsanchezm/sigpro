import { TENANT_A } from '../../../story-runs/support/prepare';
import { defineBrowserRows, notExecutable, type BrowserRowHandler, type ManifestRow } from '../../core/framework';

// US-NC-TABLERO-012 — Filtros por programa y por «Solo sin asignar» en la app móvil (historia `no-implementada`, verificacion
// no-ejecutable). Es una capacidad futura: la app móvil hoy solo filtra por texto y severidad. Cada fila se devuelve como
// `notExecutable` con el motivo; no se abre la app ni se toca la API.

const FUTURE_REASON = 'capacidad futura, no se prueba contra la app';

/** Lo que la historia espera en la fila: sus pasos «Entonces» y «Y», tal como se resuelven con las celdas. */
const expectedOf = (row: ManifestRow): string => row.resolvedSteps.filter((step) => /^(Entonces|Y) /.test(step)).join('; ');

const futureCapability: BrowserRowHandler = async (row) => notExecutable(expectedOf(row), FUTURE_REASON);

defineBrowserRows({
  story: 'US-NC-TABLERO-012',
  surface: 'expo-web',
  tenants: [TENANT_A],
  handlers: new Map<number, BrowserRowHandler>([
    [1, futureCapability],
  ]),
});
