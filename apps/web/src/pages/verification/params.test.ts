import { describe, expect, it } from 'vitest';
import { DEFAULT_STATE, hasActiveFilters, nextSort, parseState, toQuery, toSearchString } from './params';

const parse = (search: string) => parseState(new URLSearchParams(search));

describe('parseState', () => {
  it('sin parámetros devuelve el estado por defecto', () => {
    expect(parse('')).toEqual(DEFAULT_STATE);
  });

  it('lee filtros, orden y página; ignora valores no válidos', () => {
    expect(parse('q=cifrado&program=PRG-002&result=fail&sort=runs&dir=desc&page=3')).toEqual({ q: 'cifrado', program: 'PRG-002', result: 'fail', sort: 'runs', dir: 'desc', page: 3 });
    expect(parse('result=none').result).toBe('none');
    expect(parse('result=roto&sort=nada&dir=sideways&page=-4')).toEqual(DEFAULT_STATE);
    expect(parse('page=abc').page).toBe(1);
  });
});

describe('toSearchString y toQuery', () => {
  it('solo escribe lo que se aparta del valor por defecto y es ida y vuelta', () => {
    expect(toSearchString(DEFAULT_STATE)).toBe('');
    const state = { ...DEFAULT_STATE, result: 'blocked' as const, page: 2 };
    expect(toSearchString(state)).toBe('?result=blocked&page=2');
    expect(parse(toSearchString(state))).toEqual(state);
  });

  it('toQuery omite los filtros vacíos', () => {
    expect(toQuery(DEFAULT_STATE)).toEqual({ sort: 'code', dir: 'asc', page: 1 });
    expect(toQuery({ ...DEFAULT_STATE, q: 'x', result: 'none' })).toEqual({ q: 'x', result: 'none', sort: 'code', dir: 'asc', page: 1 });
  });
});

describe('nextSort y hasActiveFilters', () => {
  it('alterna la dirección en la misma columna y vuelve a asc al cambiar de columna (página 1)', () => {
    const first = nextSort({ ...DEFAULT_STATE, page: 4 }, 'title');
    expect(first).toMatchObject({ sort: 'title', dir: 'asc', page: 1 });
    expect(nextSort(first, 'title').dir).toBe('desc');
    expect(nextSort(nextSort(first, 'title'), 'runs')).toMatchObject({ sort: 'runs', dir: 'asc' });
    expect(nextSort(DEFAULT_STATE, 'code').dir).toBe('desc'); // code asc por defecto → desc
  });

  it('detecta filtros activos', () => {
    expect(hasActiveFilters(DEFAULT_STATE)).toBe(false);
    expect(hasActiveFilters({ ...DEFAULT_STATE, program: 'PRG-001' })).toBe(true);
  });
});
