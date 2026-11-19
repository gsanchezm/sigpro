import { defineBrowserRows, notExecutable, type BrowserRowHandler, type ManifestRow } from '../../core/framework';
import { TENANT_A } from '../../../story-runs/support/prepare';

// US-VER-EJECUCION-012 — Elegir evidencias con el selector de Android y entregar una descarga a la hoja de compartir de Android. La historia
// es `pendiente-nativo`: depende de un teléfono Android o de un emulador con la app instalada, y de los selectores y la hoja del sistema,
// que no existen en el navegador de esta pila. Cada fila la devuelve `notExecutable` con lo que la historia dice (las cláusulas Entonces y
// Y) y el motivo. No se abre la app ni se toca la API.

const MOTIVO = 'Android nativo, sin emulador';

/** Lo que la historia espera de la fila: sus cláusulas Entonces y Y, tal como están en el manifiesto. */
const esperadoDe = (row: ManifestRow): string => row.resolvedSteps.filter((step) => /^(Entonces|Y) /.test(step)).join('; ');

const androidOnly: BrowserRowHandler = async (row) => notExecutable(esperadoDe(row), MOTIVO);

defineBrowserRows({
  story: 'US-VER-EJECUCION-012',
  surface: 'expo-web',
  tenants: [TENANT_A],
  handlers: new Map<number, BrowserRowHandler>([
    [1, androidOnly],
    [2, androidOnly],
    [3, androidOnly],
    [4, androidOnly],
    [5, androidOnly],
  ]),
});
