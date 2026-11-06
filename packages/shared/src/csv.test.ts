import { describe, expect, it } from 'vitest';
import type { ProgramDto } from './api-types';
import { CSV_FILENAME, programsToCsv } from './csv';

const program = (overrides: Partial<ProgramDto> = {}): ProgramDto => ({
  code: 'PRG-001',
  name: 'Sistema de mando táctico Ártemis',
  description: '',
  status: 'active',
  priority: 'medium',
  classified: true,
  ownerId: 'u1',
  ownerName: 'Marta Ruiz',
  startDate: '2023-01-01',
  endDate: '2024-07-01',
  budgetEur: 450000,
  progress: 11,
  milestonesDone: 1,
  milestonesTotal: 9,
  ...overrides,
});

describe('programsToCsv', () => {
  it('usa ; como separador, cabecera en inglés y nombre/responsable entrecomillados (formato del handoff)', () => {
    expect(programsToCsv([program()]).split('\n')).toEqual([
      'code;name;status;owner;start;end;budget;progress',
      'PRG-001;"Sistema de mando táctico Ártemis";active;"Marta Ruiz";2023-01-01;2024-07-01;450000;11',
    ]);
  });

  it('duplica las comillas internas del nombre', () => {
    const csv = programsToCsv([program({ name: 'Radar "RVC-2"' })]);
    expect(csv).toContain('"Radar ""RVC-2"""');
  });

  it('sin filas devuelve solo la cabecera', () => {
    expect(programsToCsv([])).toBe('code;name;status;owner;start;end;budget;progress');
  });

  it('el archivo se llama sigpro-programas.csv', () => {
    expect(CSV_FILENAME).toBe('sigpro-programas.csv');
  });
});
