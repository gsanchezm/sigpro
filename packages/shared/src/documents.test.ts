import { describe, expect, it } from 'vitest';
import { alignDiff, diffLines, diffStats, paginateLines } from './documents';

describe('paginateLines', () => {
  it('reparte en páginas de 12 líneas y siempre devuelve al menos una', () => {
    const lines = Array.from({ length: 30 }, (_, i) => `l${i + 1}`);
    const pages = paginateLines(lines);
    expect(pages.map((p) => p.length)).toEqual([12, 12, 6]);
    expect(pages[2]?.[0]).toBe('l25');
    expect(paginateLines([])).toEqual([[]]);
    expect(paginateLines(['a', 'b', 'c'], 2)).toEqual([['a', 'b'], ['c']]);
  });
});

describe('diffLines', () => {
  it('textos iguales → todo «same» con numeración en ambos lados', () => {
    expect(diffLines(['a', 'b'], ['a', 'b'])).toEqual([
      { type: 'same', text: 'a', oldLine: 1, newLine: 1 },
      { type: 'same', text: 'b', oldLine: 2, newLine: 2 },
    ]);
  });

  it('detecta altas, bajas y cambios', () => {
    const ops = diffLines(['uno', 'dos', 'tres'], ['uno', 'DOS', 'tres', 'cuatro']);
    expect(ops.map((o) => `${o.type}:${o.text}`)).toEqual(['same:uno', 'del:dos', 'add:DOS', 'same:tres', 'add:cuatro']);
    expect(ops[1]).toMatchObject({ oldLine: 2, newLine: null });
    expect(ops[2]).toMatchObject({ oldLine: null, newLine: 2 });
  });

  it('maneja listas vacías', () => {
    expect(diffLines([], [])).toEqual([]);
    expect(diffLines([], ['x']).map((o) => o.type)).toEqual(['add']);
    expect(diffLines(['x'], []).map((o) => o.type)).toEqual(['del']);
  });

  it('reconstruye ambas versiones a partir de las operaciones', () => {
    const before = ['a', 'b', 'c', 'd', 'e'];
    const after = ['a', 'x', 'c', 'e', 'f'];
    const ops = diffLines(before, after);
    expect(ops.filter((o) => o.type !== 'add').map((o) => o.text)).toEqual(before);
    expect(ops.filter((o) => o.type !== 'del').map((o) => o.text)).toEqual(after);
  });
});

describe('alignDiff y diffStats', () => {
  it('empareja bajas y altas consecutivas como «changed»', () => {
    const rows = alignDiff(diffLines(['uno', 'dos', 'tres'], ['uno', 'DOS', 'tres', 'cuatro']));
    expect(rows.map((r) => r.kind)).toEqual(['same', 'changed', 'same', 'added']);
    expect(rows[1]).toMatchObject({ left: { line: 2, text: 'dos' }, right: { line: 2, text: 'DOS' } });
    expect(rows[3]).toMatchObject({ left: null, right: { line: 4, text: 'cuatro' } });
    expect(diffStats(rows)).toEqual({ added: 1, removed: 0, changed: 1, same: 2 });
  });

  it('las bajas sin pareja quedan como «removed»', () => {
    const rows = alignDiff(diffLines(['a', 'b', 'c'], ['a']));
    expect(rows.map((r) => r.kind)).toEqual(['same', 'removed', 'removed']);
    expect(diffStats(rows)).toEqual({ added: 0, removed: 2, changed: 0, same: 1 });
  });
});
