import { PAGE_SIZE } from '@sigpro/shared';
import { describe, expect, it } from 'vitest';
import { ALL, DEFAULT_FILTERS, clearedFilters, filtersToParams, firstParam, fromChoice, hasActiveFilters, hasMorePages, nextSort, parseFilters, rangeOf, resultFromChoice, toChoice, toQuery } from './params';

describe('parseFilters', () => {
  it('lee búsqueda, programa, resultado y orden de la URL, sin espacios sobrantes', () => {
    expect(parseFilters({ q: ' cifrado ', program: 'PRG-002 ', result: 'fail', sort: 'runs', dir: 'desc' })).toEqual({
      q: 'cifrado',
      program: 'PRG-002',
      result: 'fail',
      sort: 'runs',
      dir: 'desc',
    });
  });

  it('ignora lo que no existe (equivale al valor por defecto, como la web)', () => {
    expect(parseFilters({ result: 'quizás', sort: 'precio', dir: 'sideways' })).toEqual(DEFAULT_FILTERS);
    expect(parseFilters({})).toEqual(DEFAULT_FILTERS);
  });

  it('admite «none» (casos sin ejecuciones) como resultado', () => {
    expect(parseFilters({ result: 'none' }).result).toBe('none');
  });
});

describe('filtersToParams', () => {
  it('no escribe en la URL lo que vale lo mismo que por defecto', () => {
    expect(filtersToParams(DEFAULT_FILTERS)).toEqual({ q: undefined, program: undefined, result: undefined, sort: undefined, dir: undefined });
  });

  it('escribe solo lo que se aparta del valor por defecto', () => {
    expect(filtersToParams({ q: 'TC', program: 'PRG-001', result: 'blocked', sort: 'title', dir: 'desc' })).toEqual({
      q: 'TC',
      program: 'PRG-001',
      result: 'blocked',
      sort: 'title',
      dir: 'desc',
    });
    expect(filtersToParams({ ...DEFAULT_FILTERS, dir: 'desc' })).toMatchObject({ dir: 'desc', sort: undefined });
  });
});

describe('toQuery', () => {
  it('pide la página con el orden y el tamaño de página de la web, sin filtros vacíos', () => {
    expect(toQuery(DEFAULT_FILTERS, 1)).toEqual({ sort: 'code', dir: 'asc', page: 1, pageSize: PAGE_SIZE });
  });

  it('añade solo los filtros aplicados', () => {
    expect(toQuery({ q: 'x', program: 'PRG-003', result: 'none', sort: 'result', dir: 'desc' }, 3)).toEqual({
      q: 'x',
      program: 'PRG-003',
      result: 'none',
      sort: 'result',
      dir: 'desc',
      page: 3,
      pageSize: PAGE_SIZE,
    });
  });
});

describe('nextSort', () => {
  it('una columna nueva empieza en ascendente', () => {
    expect(nextSort(DEFAULT_FILTERS, 'title')).toMatchObject({ sort: 'title', dir: 'asc' });
  });

  it('pulsar la columna activa invierte el sentido, y volver a pulsarla lo restablece', () => {
    const desc = nextSort(DEFAULT_FILTERS, 'code');
    expect(desc).toMatchObject({ sort: 'code', dir: 'desc' });
    expect(nextSort(desc, 'code')).toMatchObject({ sort: 'code', dir: 'asc' });
  });

  it('conserva los filtros', () => {
    expect(nextSort({ ...DEFAULT_FILTERS, q: 'abc' }, 'runs').q).toBe('abc');
  });
});

describe('filtros activos y limpieza', () => {
  it('el orden no cuenta como filtro', () => {
    expect(hasActiveFilters({ ...DEFAULT_FILTERS, sort: 'runs', dir: 'desc' })).toBe(false);
    expect(hasActiveFilters({ ...DEFAULT_FILTERS, program: 'PRG-001' })).toBe(true);
    expect(hasActiveFilters({ ...DEFAULT_FILTERS, result: 'pass' })).toBe(true);
  });

  it('«Limpiar filtros» quita búsqueda, programa y resultado pero conserva el orden', () => {
    expect(clearedFilters({ q: 'a', program: 'PRG-001', result: 'fail', sort: 'runs', dir: 'desc' })).toEqual({ ...DEFAULT_FILTERS, sort: 'runs', dir: 'desc' });
  });
});

describe('opciones de los selectores', () => {
  it('el valor vacío se llama «all» (forma parte del testID de la opción) y vuelve a vacío', () => {
    expect(toChoice('')).toBe(ALL);
    expect(toChoice('PRG-001')).toBe('PRG-001');
    expect(fromChoice(ALL)).toBe('');
    expect(fromChoice('PRG-001')).toBe('PRG-001');
  });

  it('una opción de resultado desconocida equivale a «todos»', () => {
    expect(resultFromChoice('fail')).toBe('fail');
    expect(resultFromChoice('none')).toBe('none');
    expect(resultFromChoice(ALL)).toBe('');
    expect(resultFromChoice('otra')).toBe('');
  });
});

describe('páginas y rango', () => {
  it('hay más páginas mientras la actual sea menor que el total', () => {
    expect(hasMorePages(1, 3)).toBe(true);
    expect(hasMorePages(3, 3)).toBe(false);
  });

  it('el rango va del primero al último cargado, y vacío si no hay nada', () => {
    expect(rangeOf(10, 25)).toEqual({ from: 1, to: 10, total: 25 });
    expect(rangeOf(0, 0)).toEqual({ from: 0, to: 0, total: 0 });
  });

  it('firstParam toma el primero si el parámetro se repite', () => {
    expect(firstParam('a')).toBe('a');
    expect(firstParam(['a', 'b'])).toBe('a');
    expect(firstParam(undefined)).toBeUndefined();
  });
});
