import { PAGE_SIZE, PROGRAM_STATUSES } from '@sigpro/shared';
import { describe, expect, it } from 'vitest';
import { NO_FILTERS, STATUS_CHOICES, choiceOf, choiceToStatus, filtersToParams, firstParam, hasActiveFilters, hasMorePages, parseProgramsFilters, rangeLabel, toProgramsQuery } from './params';

describe('parseProgramsFilters', () => {
  it('lee el estado y el texto de la URL, sin espacios sobrantes en el texto', () => {
    expect(parseProgramsFilters(' gestión ', 'on_hold')).toEqual({ q: 'gestión', status: 'on_hold' });
  });

  it('ignora un estado que no existe (equivale a «Todos»)', () => {
    expect(parseProgramsFilters('', 'archived')).toEqual({ q: '', status: '' });
    expect(parseProgramsFilters('', '')).toEqual(NO_FILTERS);
  });
});

describe('filtersToParams', () => {
  it('no escribe en la URL lo que vale lo mismo que por defecto', () => {
    expect(filtersToParams(NO_FILTERS)).toEqual({ status: undefined, q: undefined });
  });

  it('escribe el estado y el texto cuando hay filtro', () => {
    expect(filtersToParams({ q: 'PRG', status: 'active' })).toEqual({ status: 'active', q: 'PRG' });
  });
});

describe('toProgramsQuery', () => {
  it('pide la página con el orden de la web y el tamaño de página', () => {
    expect(toProgramsQuery(NO_FILTERS, 2)).toEqual({ sort: 'code', dir: 'asc', page: 2, pageSize: PAGE_SIZE });
    expect(PAGE_SIZE).toBe(10);
  });

  it('añade solo los filtros que tienen valor', () => {
    expect(toProgramsQuery({ q: 'radar', status: 'closed' }, 1)).toEqual({ q: 'radar', status: 'closed', sort: 'code', dir: 'asc', page: 1, pageSize: PAGE_SIZE });
  });

  it('tras un alta o una copia la lista va en orden descendente: el programa nuevo sale el primero', () => {
    expect(toProgramsQuery(NO_FILTERS, 1, 'desc')).toEqual({ sort: 'code', dir: 'desc', page: 1, pageSize: PAGE_SIZE });
  });
});

describe('selector de estado', () => {
  it('ofrece «Todos» seguido de los cinco estados del dominio', () => {
    expect(STATUS_CHOICES).toEqual(['all', ...PROGRAM_STATUSES]);
  });

  it('convierte cada opción en su filtro y viceversa', () => {
    expect(choiceToStatus('all')).toBe('');
    for (const status of PROGRAM_STATUSES) {
      expect(choiceOf({ q: '', status })).toBe(status);
      expect(choiceToStatus(status)).toBe(status);
    }
    expect(choiceOf(NO_FILTERS)).toBe('all');
  });

  it('un filtro activo lo indica', () => {
    expect(hasActiveFilters(NO_FILTERS)).toBe(false);
    expect(hasActiveFilters({ q: 'x', status: '' })).toBe(true);
    expect(hasActiveFilters({ q: '', status: 'draft' })).toBe(true);
  });
});

describe('rangeLabel', () => {
  it('muestra «1–10 de 24» y crece con «Cargar más»', () => {
    expect(rangeLabel(10, 24, 'de')).toBe('1–10 de 24');
    expect(rangeLabel(20, 24, 'de')).toBe('1–20 de 24');
  });

  it('sin resultados no muestra nada', () => {
    expect(rangeLabel(0, 0, 'de')).toBe('');
  });
});

describe('paginación', () => {
  it('hay página siguiente mientras la última cargada no sea la última', () => {
    expect(hasMorePages(1, 3)).toBe(true);
    expect(hasMorePages(3, 3)).toBe(false);
    expect(hasMorePages(1, 1)).toBe(false);
  });
});

describe('firstParam', () => {
  it('toma el texto o el primero de los valores repetidos', () => {
    expect(firstParam('on_hold')).toBe('on_hold');
    expect(firstParam(['a', 'b'])).toBe('a');
    expect(firstParam(undefined)).toBeUndefined();
    expect(firstParam([])).toBeUndefined();
  });
});
