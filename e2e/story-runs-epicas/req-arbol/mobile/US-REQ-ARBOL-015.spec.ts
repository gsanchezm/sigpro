import { TENANT_A } from '../../../story-runs/support/prepare';
import { defineBrowserRows, notExecutable, type BrowserRowHandler, type ManifestRow } from '../../core/framework';
import { expectedOfRow, NOT_IMPLEMENTED } from './common';

// US-REQ-ARBOL-015 — Abrir desde un requisito sus casos de prueba y sus no conformidades, y cambiar de programa (app móvil). Historia
// `no-implementada`: la app móvil todavía no enlaza los casos y las no conformidades de la hoja de detalle, ni tiene el desplegable «Programa» de
// la pantalla de requisitos (comprobado en el código: no existen en apps/mobile/src/features/requirements). Es capacidad futura: no se prueba
// contra la app; cada fila devuelve `notExecutable` con el motivo.

const futureCapability: BrowserRowHandler = async (row: ManifestRow) => notExecutable(expectedOfRow(row.resolvedSteps), NOT_IMPLEMENTED);

defineBrowserRows({
  story: 'US-REQ-ARBOL-015',
  surface: 'expo-web',
  tenants: [TENANT_A],
  handlers: new Map<number, BrowserRowHandler>([
    [1, futureCapability],
    [2, futureCapability],
  ]),
});
