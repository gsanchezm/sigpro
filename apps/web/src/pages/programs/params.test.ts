import { describe, expect, it } from 'vitest';
import { DEFAULT_LIST_STATE, hasActiveFilters, nextSort, parseListParams, toListQuery, toSearchString, withFilter } from './params';

describe('parseListParams', () => {
  it('sin parámetros devuelve el estado por defecto (código ascendente, página 1)', () => {
    expect(parseListParams(new URLSearchParams(''))).toEqual(DEFAULT_LIST_STATE);
    expect(DEFAULT_LIST_STATE).toMatchObject({ sort: 'code', dir: 'asc', page: 1, q: '', status: '', from: '', to: '', owner: '' });
  });

  it('lee filtros, orden y página; ignora valores inválidos', () => {
    const state = parseListParams(new URLSearchParams('status=on_hold&owner=u2&from=2024-01-01&to=2025-12-31&q=radar&sort=budget&dir=desc&page=3'));
    expect(state).toEqual({ status: 'on_hold', owner: 'u2', from: '2024-01-01', to: '2025-12-31', q: 'radar', sort: 'budget', dir: 'desc', page: 3 });
    expect(parseListParams(new URLSearchParams('status=raro&sort=otro&dir=x&page=-4&from=ayer'))).toEqual(DEFAULT_LIST_STATE);
  });
});

describe('toSearchString', () => {
  it('solo escribe lo que se aparta del valor por defecto', () => {
    expect(toSearchString(DEFAULT_LIST_STATE)).toBe('');
    expect(toSearchString({ ...DEFAULT_LIST_STATE, status: 'active', page: 2 })).toBe('?status=active&page=2');
    expect(toSearchString({ ...DEFAULT_LIST_STATE, sort: 'name', dir: 'desc' })).toBe('?sort=name&dir=desc');
  });

  it('ida y vuelta: parse(toSearchString(x)) = x', () => {
    const state = { status: 'closed', owner: 'u3', from: '2023-02-01', to: '2026-01-01', q: 'sonar', sort: 'owner', dir: 'desc', page: 2 } as const;
    expect(parseListParams(new URLSearchParams(toSearchString(state)))).toEqual(state);
  });
});

describe('toListQuery', () => {
  it('traduce al query de la API omitiendo los vacíos', () => {
    expect(toListQuery({ ...DEFAULT_LIST_STATE, status: 'draft', q: 'x' })).toEqual({ status: 'draft', q: 'x', sort: 'code', dir: 'asc', page: 1 });
  });
});

describe('withFilter', () => {
  it('cambiar un filtro vuelve a la página 1', () => {
    expect(withFilter({ ...DEFAULT_LIST_STATE, page: 3 }, { status: 'active' })).toMatchObject({ status: 'active', page: 1 });
  });
});

describe('nextSort', () => {
  it('misma columna alterna asc/desc; otra columna empieza en asc; siempre página 1', () => {
    expect(nextSort({ ...DEFAULT_LIST_STATE, page: 2 }, 'code')).toMatchObject({ sort: 'code', dir: 'desc', page: 1 });
    expect(nextSort({ ...DEFAULT_LIST_STATE, sort: 'code', dir: 'desc' }, 'code')).toMatchObject({ dir: 'asc' });
    expect(nextSort(DEFAULT_LIST_STATE, 'name')).toMatchObject({ sort: 'name', dir: 'asc' });
  });
});

describe('hasActiveFilters', () => {
  it('ignora orden y página', () => {
    expect(hasActiveFilters({ ...DEFAULT_LIST_STATE, sort: 'name', page: 4 })).toBe(false);
    expect(hasActiveFilters({ ...DEFAULT_LIST_STATE, q: 'a' })).toBe(true);
    expect(hasActiveFilters({ ...DEFAULT_LIST_STATE, owner: 'u1' })).toBe(true);
  });
});
