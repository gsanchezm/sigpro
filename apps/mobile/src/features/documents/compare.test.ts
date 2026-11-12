import { alignDiff, diffLines, type DiffRow } from '@sigpro/shared';
import { describe, expect, it } from 'vitest';
import { KIND_LABEL_KEY, MARKER, cellsOf, defaultRange, isComparable, isStale, isStruck, versionOptions } from './compare';

describe('rango de comparación', () => {
  it('por defecto compara la versión anterior con la última', () => {
    expect(defaultRange(3)).toEqual({ from: 2, to: 3 });
    expect(defaultRange(2)).toEqual({ from: 1, to: 2 });
  });

  it('con una sola versión el rango es 1 contra 1 y no se puede comparar', () => {
    expect(defaultRange(1)).toEqual({ from: 1, to: 1 });
    expect(isComparable(1, defaultRange(1))).toBe(false);
  });

  it('se compara con dos versiones o más y dos elegidas distintas', () => {
    expect(isComparable(3, { from: 2, to: 3 })).toBe(true);
    expect(isComparable(3, { from: 2, to: 2 })).toBe(false);
    expect(isComparable(1, { from: 1, to: 2 })).toBe(false);
  });

  it('el resultado es viejo si pertenece a otro rango', () => {
    expect(isStale(null, { from: 1, to: 2 })).toBe(false);
    expect(isStale({ from: 1, to: 2 }, { from: 1, to: 2 })).toBe(false);
    expect(isStale({ from: 1, to: 2 }, { from: 2, to: 3 })).toBe(true);
  });

  it('las opciones de versión salen de la más antigua a la más nueva', () => {
    expect(versionOptions([{ version: 3 }, { version: 1 }, { version: 2 }])).toEqual([{ value: '1' }, { value: '2' }, { value: '3' }]);
  });
});

describe('celdas de una fila', () => {
  const rows = alignDiff(diffLines(['a', 'b', 'c', 'd'], ['a', 'B', 'c', 'e', 'f']));
  const byKind = (kind: DiffRow['kind']) => rows.filter((row) => row.kind === kind);

  it('una fila igual es una sola celda con el número de la línea nueva', () => {
    const same = byKind('same')[0] as DiffRow;
    expect(cellsOf(same)).toEqual([{ side: 'same', line: 1, text: 'a' }]);
  });

  it('una fila modificada muestra la antigua y luego la nueva', () => {
    const changed = byKind('changed')[0] as DiffRow;
    expect(cellsOf(changed)).toEqual([
      { side: 'old', line: 2, text: 'b' },
      { side: 'new', line: 2, text: 'B' },
    ]);
  });

  it('añadida y eliminada tienen una celda cada una', () => {
    expect(rows.map((row) => row.kind)).toEqual(['same', 'changed', 'same', 'changed', 'added']);
    const added = byKind('added')[0] as DiffRow;
    expect(cellsOf(added)).toEqual([{ side: 'new', line: 5, text: 'f' }]);
    const removed: DiffRow = { kind: 'removed', left: { line: 4, text: 'd' }, right: null };
    expect(cellsOf(removed)).toEqual([{ side: 'old', line: 4, text: 'd' }]);
  });

  it('solo la celda antigua se tacha y cada lado lleva su marca', () => {
    expect(isStruck({ side: 'old', line: 1, text: 'x' })).toBe(true);
    expect(isStruck({ side: 'new', line: 1, text: 'x' })).toBe(false);
    expect(isStruck({ side: 'same', line: 1, text: 'x' })).toBe(false);
    expect(MARKER).toEqual({ old: '−', new: '+', same: '' });
  });

  it('cada tipo de fila tiene su texto', () => {
    expect(Object.keys(KIND_LABEL_KEY).sort()).toEqual(['added', 'changed', 'removed', 'same']);
  });
});
