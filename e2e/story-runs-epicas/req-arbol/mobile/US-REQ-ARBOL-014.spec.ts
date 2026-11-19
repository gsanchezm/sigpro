import { TENANT_A } from '../../../story-runs/support/prepare';
import { defineBrowserRows, notExecutable, type BrowserRowHandler, type ManifestRow } from '../../core/framework';
import { expectedOfRow, NOT_IMPLEMENTED } from './common';

// US-REQ-ARBOL-014 — Copiar el código de un requisito y exportar el listado a CSV (app móvil). Historia `no-implementada`: la app móvil todavía no
// tiene el control «Copiar código» en la hoja ni en la fila, ni el botón «Exportar CSV» (comprobado en el código: no existen en
// apps/mobile/src/features/requirements). Es capacidad futura: no se prueba contra la app; cada fila devuelve `notExecutable` con el motivo.

const futureCapability: BrowserRowHandler = async (row: ManifestRow) => notExecutable(expectedOfRow(row.resolvedSteps), NOT_IMPLEMENTED);

defineBrowserRows({
  story: 'US-REQ-ARBOL-014',
  surface: 'expo-web',
  tenants: [TENANT_A],
  handlers: new Map<number, BrowserRowHandler>([
    [1, futureCapability],
    [2, futureCapability],
    [3, futureCapability],
  ]),
});
