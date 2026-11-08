import type { SearchGroupDto } from '@sigpro/shared';
import { describe, expect, it } from 'vitest';
import { canSearch, flattenGroups, isProgramsRoute, popoverVisible, totalResults } from './global-search';

const item = (id: string) => ({ id, title: id, subtitle: '', href: `/x/${id}` });
const groups: readonly SearchGroupDto[] = [
  { kind: 'program', total: 24, items: [item('PRG-001'), item('PRG-002')] },
  { kind: 'nc', total: 1, items: [item('NC-001')] },
];

describe('flattenGroups', () => {
  it('recorre grupo a grupo, en el orden en que se ven', () => {
    expect(flattenGroups(groups).map((entry) => `${entry.kind}:${entry.item.id}`)).toEqual(['program:PRG-001', 'program:PRG-002', 'nc:NC-001']);
  });

  it('sin grupos no hay nada que recorrer', () => {
    expect(flattenGroups([])).toEqual([]);
  });
});

describe('totalResults', () => {
  it('suma el total real de cada grupo, no los ítems enseñados', () => {
    expect(totalResults(groups)).toBe(25);
    expect(totalResults([])).toBe(0);
  });
});

describe('canSearch', () => {
  it('exige 2 caracteres sin contar espacios de los extremos', () => {
    expect(canSearch('a')).toBe(false);
    expect(canSearch('  a ')).toBe(false);
    expect(canSearch('ab')).toBe(true);
    expect(canSearch(' ab ')).toBe(true);
  });
});

describe('popover', () => {
  it('en /programs la búsqueda filtra la tabla y no hay popover', () => {
    expect(isProgramsRoute('/programs')).toBe(true);
    expect(isProgramsRoute('/programs/PRG-001')).toBe(false);
    expect(popoverVisible(true, 'radar', '/programs')).toBe(false);
  });

  it('en el resto de rutas se ve con la lista abierta y texto escrito', () => {
    expect(popoverVisible(true, 'radar', '/nc')).toBe(true);
    expect(popoverVisible(true, '   ', '/nc')).toBe(false);
    expect(popoverVisible(false, 'radar', '/nc')).toBe(false);
    expect(popoverVisible(true, 'r', '/programs/PRG-001')).toBe(true);
  });
});
