// Lógica pura de «Comparar versiones» en móvil (web: DocumentCompare). El servidor alinea el diff en filas (`DiffRow`); la web las
// pinta en una tabla de dos columnas y el móvil, apiladas (a 390 px dos columnas dejan un ancho de ~130 px por texto): una fila
// «modificada» muestra la línea antigua tachada y, debajo, la nueva. Sin imports de react-native: se prueba con Vitest en Node.
import type { DiffRow, DiffRowKind, DocumentCompareDto, MessageKey } from '@sigpro/shared';

export interface VersionRange {
  readonly from: number;
  readonly to: number;
}

/** Comparación inicial: la versión anterior contra la última (con una sola versión, 1 contra 1, que no se puede comparar). */
export const defaultRange = (latest: number): VersionRange => ({ from: Math.max(1, latest - 1), to: latest });

/** Hay algo que comparar: al menos dos versiones y dos distintas elegidas. */
export const isComparable = (versionCount: number, range: VersionRange): boolean => versionCount >= 2 && range.from !== range.to;

/** El resultado que se ve corresponde a otro rango (acaba de cambiar un selector y la respuesta nueva no ha llegado). */
export const isStale = (result: Pick<DocumentCompareDto, 'from' | 'to'> | null, range: VersionRange): boolean => result !== null && (result.from !== range.from || result.to !== range.to);

/** Texto de cada tipo de fila (mapa tipado, sin claves construidas con plantillas). */
export const KIND_LABEL_KEY: Readonly<Record<DiffRowKind, MessageKey<'documentos'>>> = {
  same: 'd_same',
  added: 'd_added',
  removed: 'd_removed',
  changed: 'd_changed',
};

/** Una línea de una fila: de la versión antigua, de la nueva o igual en las dos. */
export interface DiffCell {
  readonly side: 'old' | 'new' | 'same';
  readonly line: number;
  readonly text: string;
}

/**
 * Las celdas que se pintan de una fila, en orden de lectura (antigua y luego nueva). Una fila igual es una sola celda con
 * el número de la línea nueva; añadida o eliminada, la que corresponda; modificada, las dos.
 */
export const cellsOf = (row: DiffRow): readonly DiffCell[] => {
  const cells: readonly (DiffCell | null)[] =
    row.kind === 'same'
      ? [row.right ? { side: 'same', ...row.right } : null]
      : [row.left ? { side: 'old', ...row.left } : null, row.right ? { side: 'new', ...row.right } : null];
  return cells.filter((cell): cell is DiffCell => cell !== null);
};

/** La celda antigua se tacha (lo que desaparece), la nueva y la igual no. */
export const isStruck = (cell: DiffCell): boolean => cell.side === 'old';

/** Marca que acompaña al número de línea (no depender solo del color): «−» antigua, «+» nueva y nada si es igual. */
export const MARKER: Readonly<Record<DiffCell['side'], string>> = { old: '−', new: '+', same: '' };

/** Selector de versión: `value` es texto porque `SelectField` trabaja con cadenas y forma parte del `testID` de cada opción. */
export const versionOptions = (versions: readonly { readonly version: number }[]): readonly { readonly value: string }[] =>
  [...versions].sort((a, b) => a.version - b.version).map(({ version }) => ({ value: String(version) }));
