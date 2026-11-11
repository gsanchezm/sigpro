import { describe, expect, it } from 'vitest';
import { isFiltered, toListQuery } from './filters';

describe('filtros del tablero', () => {
  it('«Todas» no envía severidad y el texto vacío no envía q', () => {
    expect(toListQuery({ q: '  ', severity: 'all' })).toEqual({ q: undefined, severity: undefined });
  });

  it('envía el texto recortado y la severidad elegida', () => {
    expect(toListQuery({ q: ' fuga ', severity: 'critical' })).toEqual({ q: 'fuga', severity: 'critical' });
  });

  it('sabe si hay algún filtro activo', () => {
    expect(isFiltered({ q: '', severity: 'all' })).toBe(false);
    expect(isFiltered({ q: '', severity: 'minor' })).toBe(true);
    expect(isFiltered({ q: 'NC', severity: 'all' })).toBe(true);
  });
});
