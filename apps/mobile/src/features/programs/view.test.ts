import { ApiError, PROGRAM_STATUSES, type MilestoneDto, type ProgramDto } from '@sigpro/shared';
import { describe, expect, it } from 'vitest';
import { appendPrograms, countDone, isNotFound, milestoneStatusOf, programStatusTone, sortMilestones } from './view';

const program = (code: string, name = code): ProgramDto => ({
  code,
  name,
  description: '',
  status: 'active',
  priority: 'medium',
  classified: false,
  ownerId: 'u1',
  ownerName: 'Ana García',
  startDate: '2026-01-01',
  endDate: '2026-12-31',
  budgetEur: 1000,
  progress: 0,
  milestonesDone: 0,
  milestonesTotal: 0,
});

const milestone = (id: string, dueDate: string, progress: number, done = progress >= 100): MilestoneDto => ({
  id,
  programCode: 'PRG-001',
  name: id,
  dueDate,
  progress,
  done,
});

describe('tono de estado', () => {
  it('usa el mismo mapa que la web para cada estado', () => {
    expect(PROGRAM_STATUSES.map(programStatusTone)).toEqual(['neutral', 'info', 'warn', 'ok', 'danger']);
  });
});

describe('estado de un hito', () => {
  it('cumplido si el servidor lo marca como hecho', () => {
    expect(milestoneStatusOf({ done: true, progress: 100 })).toBe('done');
  });

  it('en curso con avance y pendiente sin él', () => {
    expect(milestoneStatusOf({ done: false, progress: 40 })).toBe('in_progress');
    expect(milestoneStatusOf({ done: false, progress: 0 })).toBe('pending');
  });
});

describe('sortMilestones', () => {
  it('ordena por fecha límite y, a igualdad, por identificador, sin modificar la entrada', () => {
    const input = [milestone('PRG-001-M02', '2026-06-01', 0), milestone('PRG-001-M03', '2026-03-01', 0), milestone('PRG-001-M01', '2026-06-01', 0)];
    const sorted = sortMilestones(input);
    expect(sorted.map((item) => item.id)).toEqual(['PRG-001-M03', 'PRG-001-M01', 'PRG-001-M02']);
    expect(input[0]?.id).toBe('PRG-001-M02');
  });

  it('cuenta los hitos cumplidos', () => {
    expect(countDone([milestone('a', '2026-01-01', 100), milestone('b', '2026-01-01', 10)])).toBe(1);
  });
});

describe('appendPrograms', () => {
  it('añade la página siguiente en orden y sin repetir programas', () => {
    const merged = appendPrograms([program('PRG-001'), program('PRG-002')], [program('PRG-002'), program('PRG-003')]);
    expect(merged.map((item) => item.code)).toEqual(['PRG-001', 'PRG-002', 'PRG-003']);
  });
});

describe('isNotFound', () => {
  const body = { statusCode: 404, error: 'Not Found', message: 'no existe' };

  it('reconoce un 404 de la API', () => {
    expect(isNotFound(new ApiError(404, body, 'GET /api/programs/X → 404 Not Found'))).toBe(true);
  });

  it('cualquier otro fallo no es «no encontrado»', () => {
    expect(isNotFound(new ApiError(503, { ...body, statusCode: 503 }, 'GET /api/programs/X → 503 Service Unavailable'))).toBe(false);
    expect(isNotFound(new Error('red'))).toBe(false);
  });
});
