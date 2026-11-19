import { TENANT_A } from '../../../story-runs/support/prepare';
import { defineBrowserRows, notExecutable, type BrowserRowHandler, type ManifestRow } from '../../core/framework';
import { thenOf } from '../web/common';

// US-DOC-LISTA-013 — Filtro de la lista de documentos por programa y clasificación en la app móvil. Historia `no-implementada`
// (verificacion no-ejecutable): la lista móvil hoy solo tiene el buscador de texto, así que no hay nada que probar contra la app. Cada
// fila se devuelve como `notExecutable` con lo que la historia espera (sus pasos «Entonces» y «Y»), para que el informe tenga una fila
// por cada Esquema. No se abre la app ni se toca la API.

const MOTIVO = 'capacidad futura, no se prueba contra la app';

const futureCapability: BrowserRowHandler = async (row: ManifestRow) => notExecutable(thenOf(row), MOTIVO);

defineBrowserRows({
  story: 'US-DOC-LISTA-013',
  surface: 'expo-web',
  tenants: [TENANT_A],
  handlers: new Map<number, BrowserRowHandler>([[1, futureCapability]]),
});
