import { cell, strict } from '../../support/checks';
import { defineBrowserRows, notExecutable, type BrowserRowHandler } from '../../core/framework';

// US-NAVEGACION-015 — Campana de avisos en la app móvil. Historia `no-implementada`: la app no tiene campana (su preferencia del Perfil
// no hace nada). Ninguna fila se ejecuta contra la app; cada una devuelve notExecutable con su motivo, y se leen sus celdas.

/** Pulsaciones de cada fila (la columna «pulsaciones»): solo para leer la celda y citarla en el motivo. */
const TICKS: ReadonlyMap<string, number> = new Map<string, number>([
  ['4', 4],
  ['5', 5],
]);

const MOTIVE = 'capacidad futura, no se prueba contra la app: la app móvil no tiene campana de avisos (useStoredFlags solo guarda la preferencia).';

const notYet: BrowserRowHandler = async (row) => {
  const ticks = strict('pulsaciones', TICKS, cell(row, 'pulsaciones'));
  return notExecutable(cell(row, 'resultado'), `${MOTIVE} Fila con ${String(ticks)} pulsaciones.`);
};

defineBrowserRows({
  story: 'US-NAVEGACION-015',
  surface: 'expo-web',
  tenants: ['alumno01'],
  handlers: new Map<number, BrowserRowHandler>([[1, notYet]]),
});
