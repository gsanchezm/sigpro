import { cell, strict } from '../../support/checks';
import { defineBrowserRows, notExecutable, type BrowserRowHandler } from '../../core/framework';
import { TENANT } from '../web/common';

// US-PERFIL-005 — Textos alternos del botón «Guardar» del perfil en la app móvil (`no-implementada`). La app móvil no alterna el
// texto de «Guardar» con el modo caos: es material de lectura, no se prueba contra la app. Cada fila se devuelve como no ejecutable
// con el motivo de la historia; el esperado sale de su celda «resultado».

const MOTIVO = 'capacidad futura, no se prueba contra la app';

/** Los modos y las acciones de la tabla son los únicos que existen: una celda distinta lanza (error del arnés, no un hallazgo). */
const MODOS: ReadonlyMap<string, string> = new Map<string, string>([
  ['activados', 'activados'],
  ['desactivados', 'desactivados'],
]);
const ACCIONES: ReadonlyMap<string, string> = new Map<string, string>([
  ['observa el botón «Guardar» durante el tiempo que elige la prueba', 'observa'],
  ['pulsa el botón con el texto que tiene en ese momento', 'pulsa'],
]);

const futureRow: BrowserRowHandler = async (row) => {
  strict('modo', MODOS, cell(row, 'modo'));
  strict('accion', ACCIONES, cell(row, 'accion'));
  return notExecutable(cell(row, 'resultado'), MOTIVO);
};

defineBrowserRows({
  story: 'US-PERFIL-005',
  surface: 'expo-web',
  tenants: [TENANT],
  handlers: new Map<number, BrowserRowHandler>([[1, futureRow]]),
});
