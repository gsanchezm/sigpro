import { TENANT_A } from '../../../story-runs/support/prepare';
import { defineBrowserRows, notExecutable, type BrowserRowHandler, type ManifestRow } from '../../core/framework';

// US-PROG-LISTA-009 — Filtrar la lista de programas por fechas y responsable (app móvil). Historia `no-implementada`: la app móvil
// todavía no tiene los filtros «Inicio desde», «Fin hasta» ni «Responsable» en la lista. Es capacidad futura: no se prueba contra la
// app, y cada fila la devuelve como `no-ejecutable` con el motivo, para que el informe tenga una fila por cada Esquema.

const NOT_IMPLEMENTED = 'capacidad futura, no se prueba contra la app';

/** Lo que la historia espera en la fila: sus pasos «Entonces» y «Y», tal como se resuelven con las celdas. */
const expectedOf = (row: ManifestRow): string => row.resolvedSteps.filter((step) => /^(Entonces|Y) /.test(step)).join('; ');

const futureCapability: BrowserRowHandler = async (row) => notExecutable(expectedOf(row), NOT_IMPLEMENTED);

defineBrowserRows({
  story: 'US-PROG-LISTA-009',
  surface: 'expo-web',
  tenants: [TENANT_A],
  handlers: new Map<number, BrowserRowHandler>([
    [1, futureCapability],
    [2, futureCapability],
    [3, futureCapability],
  ]),
});
