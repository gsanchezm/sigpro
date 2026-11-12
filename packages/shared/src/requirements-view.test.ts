import { describe, expect, it } from 'vitest';
import type { RequirementNcRef, RequirementTestRef } from './api-types';
import { buildTree, flowStepStatus, FLOW_STATES, openNcsOf, requirementMetrics, sectionNumbers, testsSummary, type TreeItem } from './requirements';

interface Item extends TreeItem {
  readonly state: 'draft' | 'approved' | 'verified' | 'validated';
  readonly tests: readonly RequirementTestRef[];
  readonly ncs: readonly RequirementNcRef[];
}

const make = (code: string, parentCode: string | null, position: number, extra: Partial<Item> = {}): Item => ({ code, parentCode, position, state: 'draft', tests: [], ncs: [], ...extra });

const nc = (code: string, state: RequirementNcRef['state'], severity: RequirementNcRef['severity'] = 'major'): RequirementNcRef => ({ code, state, severity });

describe('testsSummary', () => {
  it('cuenta las pruebas enlazadas y las que pasan en su última ejecución', () => {
    const tests: RequirementTestRef[] = [
      { code: 'TC-001', lastResult: 'pass' },
      { code: 'TC-002', lastResult: 'fail' },
      { code: 'TC-003', lastResult: null },
      { code: 'TC-004', lastResult: 'pass' },
    ];
    expect(testsSummary({ tests })).toEqual({ total: 4, passed: 2 });
    expect(testsSummary({ tests: [] })).toEqual({ total: 0, passed: 0 });
  });
});

describe('openNcsOf', () => {
  it('deja solo las NC abiertas (ni cerradas ni rechazadas), por código', () => {
    const ncs = [nc('NC-003', 'open'), nc('NC-001', 'closed'), nc('NC-002', 'corrective_action'), nc('NC-004', 'rejected')];
    expect(openNcsOf({ ncs }).map((entry) => entry.code)).toEqual(['NC-002', 'NC-003']);
  });
});

describe('requirementMetrics', () => {
  it('total, cobertura (con al menos una prueba), pendientes (borrador) y NC abiertas sin repetir', () => {
    const items = [
      make('REQ-001', null, 0, { state: 'draft', tests: [{ code: 'TC-001', lastResult: 'pass' }], ncs: [nc('NC-001', 'open')] }),
      make('REQ-002', null, 1, { state: 'approved', tests: [{ code: 'TC-001', lastResult: 'pass' }], ncs: [nc('NC-001', 'open'), nc('NC-002', 'closed')] }),
      make('REQ-003', null, 2, { state: 'verified' }),
      make('REQ-004', null, 3, { state: 'draft', tests: [{ code: 'TC-002', lastResult: 'fail' }], ncs: [nc('NC-003', 'in_analysis')] }),
    ];
    expect(requirementMetrics(items)).toEqual({ total: 4, covered: 3, coveragePercent: 75, pending: 2, ncOpen: 2, ncRequirements: 3 });
  });

  it('sin requisitos no hay división por cero', () => {
    expect(requirementMetrics([])).toEqual({ total: 0, covered: 0, coveragePercent: 0, pending: 0, ncOpen: 0, ncRequirements: 0 });
  });
});

describe('sectionNumbers', () => {
  it('numera el árbol en lectura: 1, 1.1, 1.2, 2…', () => {
    const tree = buildTree([make('REQ-010', null, 1), make('REQ-001', null, 0), make('REQ-002', 'REQ-001', 1), make('REQ-003', 'REQ-001', 0), make('REQ-004', 'REQ-003', 0)]);
    const numbers = sectionNumbers(tree);
    expect([...numbers.entries()]).toEqual([
      ['REQ-001', '1'],
      ['REQ-003', '1.1'],
      ['REQ-004', '1.1.1'],
      ['REQ-002', '1.2'],
      ['REQ-010', '2'],
    ]);
  });
});

describe('flowStepStatus', () => {
  it('marca cada paso del flujo como hecho, actual o futuro', () => {
    expect(FLOW_STATES).toEqual(['draft', 'approved', 'verified', 'validated']);
    expect(FLOW_STATES.map((step) => flowStepStatus('approved', step))).toEqual(['done', 'current', 'future', 'future']);
    expect(FLOW_STATES.map((step) => flowStepStatus('draft', step))).toEqual(['current', 'future', 'future', 'future']);
    expect(FLOW_STATES.map((step) => flowStepStatus('validated', step))).toEqual(['done', 'done', 'done', 'current']);
  });
});
