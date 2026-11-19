import { TENANT_A } from '../../../story-runs/support/prepare';
import { defineBrowserRows, notExecutable, type BrowserRowHandler, type ManifestRow } from '../../core/framework';
import { thenOf } from '../web/common';

// US-DOC-LISTA-015 — Entrega del PDF de un documento a la hoja de compartir de Android. La historia es `pendiente-nativo`: depende de un
// dispositivo o de un emulador de Android con la app instalada y de la hoja de compartir del sistema, que no existen en el navegador de esta
// pila. Cada fila se devuelve `notExecutable` con lo que la historia espera (sus pasos «Entonces» y «Y») y el motivo, para que el
// informe tenga una fila por cada Esquema. No se abre la app ni se toca la API.

const MOTIVO = 'Android/Android nativo, sin emulador';

const androidShareSheet: BrowserRowHandler = async (row: ManifestRow) => notExecutable(thenOf(row), MOTIVO);

defineBrowserRows({
  story: 'US-DOC-LISTA-015',
  surface: 'expo-web',
  tenants: [TENANT_A],
  handlers: new Map<number, BrowserRowHandler>([[1, androidShareSheet]]),
});
