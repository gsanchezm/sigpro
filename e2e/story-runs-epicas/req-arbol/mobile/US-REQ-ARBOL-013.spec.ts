import { TENANT_A } from '../../../story-runs/support/prepare';
import { defineBrowserRows, notExecutable, type BrowserRowHandler, type ManifestRow } from '../../core/framework';
import { expectedOfRow, NOT_IMPLEMENTED } from './common';

// US-REQ-ARBOL-013 — Filtrar el árbol por estado y expandir o contraer todo (app móvil). Historia `no-implementada`: la app móvil todavía no tiene
// el filtro por estado ni los controles «Expandir todo» y «Contraer todo» en la pestaña «Árbol» (comprobado en el código: no existen en
// apps/mobile/src/features/requirements). Es capacidad futura: no se prueba contra la app, y cada fila la devuelve como `no-ejecutable`
// con el motivo, para que el informe tenga una fila por cada Esquema.

const futureCapability: BrowserRowHandler = async (row: ManifestRow) => notExecutable(expectedOfRow(row.resolvedSteps), NOT_IMPLEMENTED);

defineBrowserRows({
  story: 'US-REQ-ARBOL-013',
  surface: 'expo-web',
  tenants: [TENANT_A],
  handlers: new Map<number, BrowserRowHandler>([
    [1, futureCapability],
    [2, futureCapability],
    [3, futureCapability],
  ]),
});
