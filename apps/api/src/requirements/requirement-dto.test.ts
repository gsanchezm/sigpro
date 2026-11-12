import { describe, expect, it } from 'vitest';
import { toRequirementDto, type RequirementRow } from './requirement-dto';

const run = (id: string, day: number, result: 'pass' | 'fail' | 'blocked', ncs: { code: string; severity: 'minor' | 'major' | 'critical'; state: 'open' | 'closed' }[] = []) => ({
  id,
  executedAt: new Date(Date.UTC(2026, 0, day)),
  result,
  nonConformities: ncs,
});

const row = (tests: RequirementRow['tests']): RequirementRow =>
  ({
    tenantId: 't',
    code: 'REQ-017',
    programCode: 'PRG-002',
    parentCode: null,
    title: 'Cifrado del enlace',
    description: '<p>x</p>',
    priority: 'high',
    state: 'approved',
    tags: ['security'],
    position: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    tests,
  }) as unknown as RequirementRow;

describe('toRequirementDto: pruebas y NC enlazadas', () => {
  it('el resultado de cada prueba es el de su ÚLTIMA ejecución y los casos van ordenados por código', () => {
    const dto = toRequirementDto(
      row([
        { testCaseCode: 'TC-012', testCase: { runs: [run('RUN-1', 1, 'fail'), run('RUN-2', 5, 'pass')] } },
        { testCaseCode: 'TC-010', testCase: { runs: [] } },
      ]),
    );
    expect(dto.testCaseCodes).toEqual(['TC-010', 'TC-012']);
    expect(dto.tests).toEqual([
      { code: 'TC-010', lastResult: null },
      { code: 'TC-012', lastResult: 'pass' },
    ]);
  });

  it('las NC salen de las ejecuciones de los casos enlazados, sin repetirse y por código', () => {
    const shared = { code: 'NC-004', severity: 'critical' as const, state: 'open' as const };
    const dto = toRequirementDto(
      row([
        { testCaseCode: 'TC-010', testCase: { runs: [run('RUN-1', 1, 'fail', [shared, { code: 'NC-001', severity: 'minor', state: 'closed' }])] } },
        { testCaseCode: 'TC-011', testCase: { runs: [run('RUN-2', 2, 'fail', [shared])] } },
      ]),
    );
    expect(dto.ncs).toEqual([
      { code: 'NC-001', severity: 'minor', state: 'closed' },
      { code: 'NC-004', severity: 'critical', state: 'open' },
    ]);
  });

  it('un requisito sin casos no tiene pruebas ni NC', () => {
    const dto = toRequirementDto(row([]));
    expect(dto).toMatchObject({ testCaseCodes: [], tests: [], ncs: [], code: 'REQ-017', state: 'approved' });
  });
});
