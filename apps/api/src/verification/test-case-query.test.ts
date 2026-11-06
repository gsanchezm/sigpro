import type { TestCaseDto } from '@sigpro/shared';
import { describe, expect, it } from 'vitest';
import { buildCaseList, matchesQuery, normalizePaging, sortCases, summarizeRuns } from './test-case-query';

const make = (code: string, over: Partial<TestCaseDto> = {}): TestCaseDto => ({
  code,
  programCode: 'PRG-001',
  programName: 'Programa',
  title: `Caso ${code}`,
  steps: [],
  expected: '',
  requirementCodes: [],
  runCount: 0,
  lastResult: null,
  lastRunAt: null,
  ...over,
});

const cases = [
  make('TC-001', { title: 'Cifrado del enlace', runCount: 2, lastResult: 'pass' }),
  make('TC-002', { title: 'Latencia máxima', programCode: 'PRG-002', runCount: 3, lastResult: 'fail' }),
  make('TC-003', { title: 'Autenticación', programCode: 'PRG-002' }),
  make('TC-004', { title: 'Disponibilidad', runCount: 1, lastResult: 'blocked' }),
];

describe('summarizeRuns', () => {
  it('devuelve la última ejecución por fecha (y por id si empatan) y el total', () => {
    const runs = [
      { id: 'RUN-001', executedAt: new Date('2026-02-01T10:00:00Z'), result: 'pass' as const },
      { id: 'RUN-003', executedAt: new Date('2026-02-03T10:00:00Z'), result: 'fail' as const },
      { id: 'RUN-002', executedAt: new Date('2026-02-03T10:00:00Z'), result: 'blocked' as const },
    ];
    expect(summarizeRuns(runs)).toEqual({ runCount: 3, lastResult: 'fail', lastRunAt: '2026-02-03T10:00:00.000Z' });
    expect(summarizeRuns([])).toEqual({ runCount: 0, lastResult: null, lastRunAt: null });
  });
});

describe('matchesQuery', () => {
  it('filtra por texto (código o título), programa y último resultado', () => {
    expect(cases.filter((c) => matchesQuery(c, { q: 'cifr' })).map((c) => c.code)).toEqual(['TC-001']);
    expect(cases.filter((c) => matchesQuery(c, { q: 'tc-00' })).map((c) => c.code)).toEqual(['TC-001', 'TC-002', 'TC-003', 'TC-004']);
    expect(cases.filter((c) => matchesQuery(c, { program: 'PRG-002' })).map((c) => c.code)).toEqual(['TC-002', 'TC-003']);
    expect(cases.filter((c) => matchesQuery(c, { result: 'fail' })).map((c) => c.code)).toEqual(['TC-002']);
    expect(cases.filter((c) => matchesQuery(c, { result: 'none' })).map((c) => c.code)).toEqual(['TC-003']);
    expect(cases.filter((c) => matchesQuery(c, { program: 'PRG-002', result: 'none' })).map((c) => c.code)).toEqual(['TC-003']);
  });
});

describe('sortCases', () => {
  it('ordena por código, título, programa, resultado (fallidos primero) y ejecuciones', () => {
    expect(sortCases(cases).map((c) => c.code)).toEqual(['TC-001', 'TC-002', 'TC-003', 'TC-004']);
    expect(sortCases(cases, 'code', 'desc').map((c) => c.code)).toEqual(['TC-004', 'TC-003', 'TC-002', 'TC-001']);
    expect(sortCases(cases, 'title').map((c) => c.code)).toEqual(['TC-003', 'TC-001', 'TC-004', 'TC-002']);
    expect(sortCases(cases, 'program').map((c) => c.code)).toEqual(['TC-001', 'TC-004', 'TC-002', 'TC-003']);
    expect(sortCases(cases, 'result').map((c) => c.code)).toEqual(['TC-002', 'TC-004', 'TC-001', 'TC-003']);
    expect(sortCases(cases, 'runs', 'desc').map((c) => c.code)).toEqual(['TC-002', 'TC-001', 'TC-004', 'TC-003']);
  });

  it('no muta la entrada', () => {
    const copy = [...cases];
    sortCases(cases, 'runs', 'desc');
    expect(cases).toEqual(copy);
  });
});

describe('buildCaseList y paginación', () => {
  it('cuenta totales y suma las ejecuciones de lo filtrado', () => {
    const list = buildCaseList(cases, { program: 'PRG-002' });
    expect(list).toMatchObject({ total: 2, totalAll: 4, totalRuns: 3, page: 1, pages: 1, pageSize: 10 });
  });

  it('pagina y acota la página al rango real', () => {
    const many = Array.from({ length: 25 }, (_, i) => make(`TC-${String(i + 1).padStart(3, '0')}`));
    expect(buildCaseList(many, {}).items).toHaveLength(10);
    expect(buildCaseList(many, { page: 3 }).items.map((c) => c.code)).toEqual(['TC-021', 'TC-022', 'TC-023', 'TC-024', 'TC-025']);
    expect(buildCaseList(many, { page: 99 })).toMatchObject({ page: 3, pages: 3 });
    expect(buildCaseList(many, { page: 2, pageSize: 5 }).items.map((c) => c.code)).toEqual(['TC-006', 'TC-007', 'TC-008', 'TC-009', 'TC-010']);
    expect(buildCaseList([], {})).toMatchObject({ total: 0, pages: 1, items: [] });
  });

  it('normalizePaging acota el tamaño de página', () => {
    expect(normalizePaging({})).toEqual({ page: 1, pageSize: 10 });
    expect(normalizePaging({ page: 0, pageSize: 1000 })).toEqual({ page: 1, pageSize: 100 });
    expect(normalizePaging({ page: 2.7, pageSize: 0 })).toEqual({ page: 2, pageSize: 1 });
  });
});
