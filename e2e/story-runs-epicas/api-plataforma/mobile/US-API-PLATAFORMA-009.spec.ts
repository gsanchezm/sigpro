import { TENANT_A } from '../../../story-runs/support/prepare';
import { cell, strict } from '../../support/checks';
import { defineBrowserRows, notExecutable, type BrowserRowHandler } from '../../core/framework';
import { NOMBRES } from '../web/common';

// US-API-PLATAFORMA-009 — Datos de cada usuario de prueba en la app móvil. La historia es `no-implementada` (capacidad futura): la app
// todavía no muestra correo, contraseña, estado ni segundo factor en cada opción del panel. No se prueba contra la app: cada fila se
// devuelve como `notExecutable`, con el motivo de la etiqueta, y las celdas se leen igualmente para que un Esquema mal escrito falle.

const MOTIVO = 'capacidad futura, no se prueba contra la app';
const BADGES: ReadonlyMap<string, string> = new Map<string, string>([
  ['«mfa»', 'mfa'],
  ['«bloqueado»', 'bloqueado'],
  ['«pendiente»', 'pendiente'],
]);

// Las celdas se validan con sus mapas aunque la fila no se ejecute: una celda nueva o mal escrita falla en lugar de pasar en silencio
const shownData: BrowserRowHandler = async (row) => {
  strict('nombre', NOMBRES, cell(row, 'nombre'));
  const expected = `ve el correo ${cell(row, 'correo')} y la contraseña ${cell(row, 'contraseña')} en esa opción`;
  return notExecutable(expected, MOTIVO);
};

const shownBadge: BrowserRowHandler = async (row) => {
  strict('nombre', NOMBRES, cell(row, 'nombre'));
  strict('marca', BADGES, cell(row, 'marca'));
  return notExecutable(`ve ${cell(row, 'marca')} en esa opción`, MOTIVO);
};

defineBrowserRows({
  story: 'US-API-PLATAFORMA-009',
  surface: 'expo-web',
  tenants: [TENANT_A],
  handlers: new Map<number, BrowserRowHandler>([
    [1, shownData],
    [2, shownBadge],
  ]),
});
