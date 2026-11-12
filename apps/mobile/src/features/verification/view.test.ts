import type { TestCaseDto } from '@sigpro/shared';
import { describe, expect, it } from 'vitest';
import { REPORT_FALLBACK_NAME, allSelected, appendCases, canExecute, dateTime, pruneSelection, reportDisabled, reportScope, resultTone, rowState, toggleAllSelection, toggleSelection } from './view';

const testCase = (code: string): TestCaseDto => ({
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
});

describe('resultados', () => {
  it('cada resultado tiene el tono de la web', () => {
    expect(resultTone('pass')).toBe('ok');
    expect(resultTone('fail')).toBe('danger');
    expect(resultTone('blocked')).toBe('warn');
  });

  it('el estado de una tarjeta es el último resultado o «none»', () => {
    expect(rowState('fail')).toBe('fail');
    expect(rowState(null)).toBe('none');
  });
});

describe('permiso testrun.execute', () => {
  it('lo tienen el admin y el consultor; no el gestor ni el auditor', () => {
    expect(canExecute('admin')).toBe(true);
    expect(canExecute('consultant')).toBe(true);
    expect(canExecute('program_manager')).toBe(false);
    expect(canExecute('auditor')).toBe(false);
  });
});

describe('appendCases', () => {
  it('añade la página siguiente sin repetir casos', () => {
    const merged = appendCases([testCase('TC-001'), testCase('TC-002')], [testCase('TC-002'), testCase('TC-003')]);
    expect(merged.map((item) => item.code)).toEqual(['TC-001', 'TC-002', 'TC-003']);
  });
});

describe('selección', () => {
  it('marca y desmarca un caso', () => {
    expect(toggleSelection([], 'TC-001')).toEqual(['TC-001']);
    expect(toggleSelection(['TC-001', 'TC-002'], 'TC-001')).toEqual(['TC-002']);
  });

  it('«Seleccionar todos» marca los visibles y, con todos marcados, los desmarca (sin tocar el resto)', () => {
    expect(toggleAllSelection(['TC-009'], ['TC-001', 'TC-002'])).toEqual(['TC-009', 'TC-001', 'TC-002']);
    expect(toggleAllSelection(['TC-009', 'TC-001', 'TC-002'], ['TC-001', 'TC-002'])).toEqual(['TC-009']);
    expect(toggleAllSelection(['TC-001'], ['TC-001', 'TC-002'])).toEqual(['TC-001', 'TC-002']);
  });

  it('allSelected exige que haya visibles y que estén todos', () => {
    expect(allSelected([], [])).toBe(false);
    expect(allSelected(['TC-001'], ['TC-001', 'TC-002'])).toBe(false);
    expect(allSelected(['TC-001', 'TC-002'], ['TC-001', 'TC-002'])).toBe(true);
  });

  it('pruneSelection quita lo que ya no se ve', () => {
    expect(pruneSelection(['TC-001', 'TC-020'], ['TC-001', 'TC-002'])).toEqual(['TC-001']);
  });
});

describe('fechas e informe', () => {
  it('la fecha de una ejecución lleva el formato del idioma y la hora del ISO', () => {
    expect(dateTime('2026-11-12T09:30:00.000Z', 'es')).toBe('12/11/2026 09:30');
  });

  it('el informe de la lista usa solo el programa filtrado', () => {
    expect(reportScope('')).toEqual({});
    expect(reportScope('PRG-003')).toEqual({ program: 'PRG-003' });
    expect(REPORT_FALLBACK_NAME).toBe('informe-verificacion.pdf');
  });

  it('el informe se deshabilita mientras carga, si falla o si no hay casos', () => {
    expect(reportDisabled('loading', 25)).toBe(true);
    expect(reportDisabled('error', 0)).toBe(true);
    expect(reportDisabled('ready', 0)).toBe(true);
    expect(reportDisabled('ready', 25)).toBe(false);
  });
});
