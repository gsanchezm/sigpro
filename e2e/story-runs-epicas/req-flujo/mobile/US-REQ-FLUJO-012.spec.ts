import { TENANT_A } from '../../../story-runs/support/prepare';
import { defineBrowserRows, notExecutable, type BrowserRowHandler, type ManifestRow } from '../../core/framework';

// US-REQ-FLUJO-012 — Botón atrás de Android que cierra la confirmación del cambio de estado (historia `android`, verificacion
// pendiente-nativo). El botón atrás del sistema existe solo en el Android nativo: la app se ejecuta aquí como web de Expo y no hay emulador
// Android en esta ejecución. Cada fila la devuelve como `notExecutable` con el motivo; no se abre la app ni se toca la API.

const NATIVE_REASON = 'iOS/Android nativo, sin emulador';

/** Lo que la historia espera en la fila: sus pasos «Entonces» y «Y», tal como se resuelven con las celdas. */
const expectedOf = (row: ManifestRow): string => row.resolvedSteps.filter((step) => /^(Entonces|Y) /.test(step)).join('; ');

const nativeBackButton: BrowserRowHandler = async (row) => notExecutable(expectedOf(row), NATIVE_REASON);

defineBrowserRows({
  story: 'US-REQ-FLUJO-012',
  surface: 'expo-web',
  tenants: [TENANT_A],
  handlers: new Map<number, BrowserRowHandler>([[1, nativeBackButton]]),
});
