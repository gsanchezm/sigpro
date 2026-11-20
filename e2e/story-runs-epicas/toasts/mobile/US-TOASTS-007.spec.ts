import { TENANT_A } from '../../../story-runs/support/prepare';
import { defineBrowserRows, notExecutable, type BrowserRowHandler, type ManifestRow } from '../../core/framework';

// US-TOASTS-007 — Cerrar un aviso con «Cerrar» en la app móvil (`no-implementada`). La app móvil no tiene el botón «Cerrar» en sus avisos
// (los retira solo a los 3 s): cada fila se devuelve como `notExecutable` con lo que la historia espera (sus pasos «Entonces» y «Y»),
// para que el informe tenga una fila por cada Esquema. No se abre la app ni se toca la API.

const MOTIVO = 'capacidad futura, no se prueba contra la app: los avisos de la app móvil no tienen botón «Cerrar» y se retiran solos a los 3 s (la historia lo deja en «Decisiones pendientes»).';

/** Los pasos «Entonces» y «Y» de la fila, tal como los resuelve el manifiesto. */
const thenOf = (row: ManifestRow): string => row.resolvedSteps.filter((step) => /^(Entonces|Y) /.test(step)).join('; ');

const futureCapability: BrowserRowHandler = async (row) => notExecutable(thenOf(row), MOTIVO);

defineBrowserRows({
  story: 'US-TOASTS-007',
  surface: 'expo-web',
  tenants: [TENANT_A],
  handlers: new Map<number, BrowserRowHandler>([[1, futureCapability]]),
});
