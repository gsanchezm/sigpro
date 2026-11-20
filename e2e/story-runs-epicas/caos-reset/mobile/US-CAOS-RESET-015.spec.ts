import { TENANT_A } from '../../../story-runs/support/prepare';
import { defineBrowserRows, notExecutable, type BrowserRowHandler, type ManifestRow } from '../../core/framework';

// US-CAOS-RESET-015 — Pantalla de laboratorio /lab en la app móvil (historia `no-implementada`, verificación no-ejecutable). Es una
// capacidad futura: hoy la app móvil no tiene ninguna ruta de laboratorio y su ayuda no enlaza a ella. Cada fila se devuelve como
// `notExecutable` con el motivo; no se abre la app ni se toca la API.

const FUTURE_REASON = 'capacidad futura, no se prueba contra la app: hoy la app móvil no tiene la pantalla de laboratorio (no hay ruta ni enlace desde la ayuda)';

/** Lo que la historia espera en la fila: sus pasos «Entonces» y «Y», tal como se resuelven con las celdas. */
const expectedOf = (row: ManifestRow): string => row.resolvedSteps.filter((step) => /^(Entonces|Y) /.test(step)).join('; ');

const futureCapability: BrowserRowHandler = async (row) => notExecutable(expectedOf(row), FUTURE_REASON);

defineBrowserRows({
  story: 'US-CAOS-RESET-015',
  surface: 'expo-web',
  tenants: [TENANT_A],
  handlers: new Map<number, BrowserRowHandler>([[1, futureCapability]]),
});
