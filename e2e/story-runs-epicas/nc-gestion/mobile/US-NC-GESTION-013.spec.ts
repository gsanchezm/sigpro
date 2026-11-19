import { defineBrowserRows, notExecutable, type BrowserRowHandler, type ManifestRow } from '../../core/framework';
import { cell, strict } from '../../support/checks';

// US-NC-GESTION-013 — Formato de la descripción en la app móvil. Historia `no-implementada`: capacidad futura, no se prueba contra la app.
// Cada fila la devuelve como «no ejecutable» con su motivo: el móvil edita la descripción como texto plano (no hay formato enriquecido).

const CONTROL_CELLS: ReadonlyMap<string, string> = new Map<string, string>([
  ['«Negrita»', 'Negrita'],
  ['«Cursiva»', 'Cursiva'],
  ['«Lista»', 'Lista'],
]);

const FORMAT_CELLS: ReadonlyMap<string, string> = new Map<string, string>([
  ['en negrita', 'en negrita'],
  ['en cursiva', 'en cursiva'],
  ['como elemento de una lista', 'como elemento de una lista'],
]);

const MOTIVE = 'capacidad futura, no se prueba contra la app: la app móvil edita la descripción como texto plano y no ofrece el formato enriquecido (negrita, cursiva, listas) que sí tiene la web.';

const notRunRow =
  (expected: (row: ManifestRow) => string): BrowserRowHandler =>
  async (row: ManifestRow) =>
    notExecutable(expected(row), MOTIVE);

const formatRow = notRunRow((row) => {
  strict('control', CONTROL_CELLS, cell(row, 'control'));
  strict('formato', FORMAT_CELLS, cell(row, 'formato'));
  return `en el alta de la descripción (10 letras a), al pulsar ${cell(row, 'control')} el texto seleccionado se ve ${cell(row, 'formato')} y se guarda así`;
});

defineBrowserRows({
  story: 'US-NC-GESTION-013',
  surface: 'expo-web',
  tenants: ['alumno01'],
  handlers: new Map<number, BrowserRowHandler>([
    [1, formatRow],
  ]),
});
