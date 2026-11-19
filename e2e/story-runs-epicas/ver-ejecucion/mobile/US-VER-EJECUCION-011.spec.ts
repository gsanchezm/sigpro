import { defineBrowserRows, notExecutable, type BrowserRowHandler, type ManifestRow } from '../../core/framework';
import { TENANT_A } from '../../../story-runs/support/prepare';

// US-VER-EJECUCION-011 — Elegir evidencias con el selector de iOS y entregar una descarga a la hoja de compartir de iOS. La historia es
// `pendiente-nativo`: depende de un iPhone o de un Simulador de iOS con la app instalada, y de los selectores y la hoja del sistema, que
// no existen en el navegador de esta pila. Cada fila la devuelve `notExecutable` con lo que la historia dice (las cláusulas Entonces y Y)
// y el motivo, para que el informe tenga una fila por cada Esquema. No se abre la app ni se toca la API.

const MOTIVO = 'iOS nativo, sin emulador';

/** Lo que la historia espera de la fila: sus cláusulas Entonces y Y, tal como están en el manifiesto. */
const esperadoDe = (row: ManifestRow): string => row.resolvedSteps.filter((step) => /^(Entonces|Y) /.test(step)).join('; ');

const iosOnly: BrowserRowHandler = async (row) => notExecutable(esperadoDe(row), MOTIVO);

defineBrowserRows({
  story: 'US-VER-EJECUCION-011',
  surface: 'expo-web',
  tenants: [TENANT_A],
  handlers: new Map<number, BrowserRowHandler>([
    [1, iosOnly],
    [2, iosOnly],
    [3, iosOnly],
    [4, iosOnly],
    [5, iosOnly],
  ]),
});
