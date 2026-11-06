import { describe, expect, it } from 'vitest';
import { buildOrderBy, buildWhere, normalizePaging, nextProgramCode, parseListQuery, progressOf, toCsv } from './program-query';

describe('parseListQuery', () => {
  it('convierte la query string en valores tipados y descarta los inválidos', () => {
    expect(parseListQuery({ page: '2', pageSize: '5', sort: 'budget', dir: 'desc', status: 'active', q: ' radar ' })).toEqual({
      page: 2,
      pageSize: 5,
      sort: 'budget',
      dir: 'desc',
      status: 'active',
      q: 'radar',
    });
    expect(parseListQuery({ sort: 'inventado', dir: 'sideways', status: 'nope', page: 'abc' })).toEqual({});
  });

  it('ignora fechas con formato incorrecto', () => {
    expect(parseListQuery({ from: '2025-01-01', to: '01/02/2025' })).toEqual({ from: '2025-01-01' });
  });
});

describe('normalizePaging', () => {
  it('aplica 10 por página por defecto y acota límites', () => {
    expect(normalizePaging({})).toEqual({ page: 1, pageSize: 10 });
    expect(normalizePaging({ page: 0, pageSize: 1000 })).toEqual({ page: 1, pageSize: 100 });
    expect(normalizePaging({ page: 3, pageSize: 5 })).toEqual({ page: 3, pageSize: 5 });
  });
});

describe('buildWhere', () => {
  it('siempre filtra por tenant', () => {
    expect(buildWhere('demo', {})).toEqual({ tenantId: 'demo' });
  });

  it('combina filtros: estado, responsable, rango de fechas y texto', () => {
    const where = buildWhere('demo', { status: 'on_hold', owner: 'u2', from: '2024-01-01', to: '2025-12-31', q: 'rad' });
    expect(where.tenantId).toBe('demo');
    expect(where.status).toBe('on_hold');
    expect(where.ownerId).toBe('u2');
    expect(where.startDate).toEqual({ gte: new Date('2024-01-01T00:00:00.000Z') });
    expect(where.endDate).toEqual({ lte: new Date('2025-12-31T00:00:00.000Z') });
    expect(where.OR).toEqual([
      { code: { contains: 'rad', mode: 'insensitive' } },
      { name: { contains: 'rad', mode: 'insensitive' } },
    ]);
  });
});

describe('buildOrderBy', () => {
  it('traduce la columna a orden de Prisma con desempate por código', () => {
    expect(buildOrderBy('name', 'desc')).toEqual([{ name: 'desc' }, { code: 'asc' }]);
    expect(buildOrderBy('owner', 'asc')).toEqual([{ owner: { name: 'asc' } }, { code: 'asc' }]);
    expect(buildOrderBy('dates', 'asc')).toEqual([{ startDate: 'asc' }, { code: 'asc' }]);
    expect(buildOrderBy('budget', 'desc')).toEqual([{ budgetEur: 'desc' }, { code: 'asc' }]);
  });

  it('ordena por código ascendente por defecto', () => {
    expect(buildOrderBy(undefined, undefined)).toEqual([{ code: 'asc' }]);
    expect(buildOrderBy('code', 'desc')).toEqual([{ code: 'desc' }]);
  });
});

describe('progressOf', () => {
  it('redondea hitos completados sobre el total y tolera programas sin hitos', () => {
    expect(progressOf(1, 9)).toBe(11);
    expect(progressOf(5, 5)).toBe(100);
    expect(progressOf(0, 0)).toBe(0);
  });
});

describe('nextProgramCode', () => {
  it('sigue la numeración existente, aunque haya huecos', () => {
    expect(nextProgramCode(['PRG-001', 'PRG-002', 'PRG-024'])).toBe('PRG-025');
    expect(nextProgramCode([])).toBe('PRG-001');
  });
});

describe('toCsv', () => {
  it('escribe cabecera y filas, y entrecomilla comas y comillas', () => {
    const csv = toCsv(
      [{ code: 'PRG-001', name: 'Radar "RVC", versión 2', status: 'active', owner: 'Marta Ruiz', start: '2023-01-01', end: '2024-07-01', budget: 450000, progress: 11 }],
      'es',
    );
    expect(csv.split('\n')).toEqual([
      'Código,Nombre,Estado,Responsable,Inicio,Fin,Presupuesto (EUR),Progreso (%)',
      'PRG-001,"Radar ""RVC"", versión 2",active,Marta Ruiz,2023-01-01,2024-07-01,450000,11',
    ]);
  });
});
