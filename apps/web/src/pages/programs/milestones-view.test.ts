import type { MilestoneDto } from '@sigpro/shared';
import { describe, expect, it } from 'vitest';
import { milestoneView, sortMilestones } from './milestones-view';

const milestone = (id: string, dueDate: string, progress = 0, done = false): MilestoneDto => ({ id, programCode: 'PRG-001', name: id, dueDate, progress, done });

describe('sortMilestones', () => {
  it('ordena por fecha límite y, a igualdad, por id, sin mutar la lista original', () => {
    const items = [milestone('M03', '2026-05-01'), milestone('M01', '2026-09-01'), milestone('M02', '2026-05-01')];
    expect(sortMilestones(items).map((item) => item.id)).toEqual(['M02', 'M03', 'M01']);
    expect(items.map((item) => item.id)).toEqual(['M03', 'M01', 'M02']);
  });
});

describe('milestoneView', () => {
  it('cumplido si el servidor lo marca; en curso con avance; pendiente sin avance', () => {
    expect(milestoneView({ done: true, progress: 100 })).toBe('done');
    expect(milestoneView({ done: false, progress: 40 })).toBe('in_progress');
    expect(milestoneView({ done: false, progress: 0 })).toBe('pending');
  });

  it('se fía del `done` del servidor aunque el slider esté al 100 %', () => {
    expect(milestoneView({ done: false, progress: 100 })).toBe('in_progress');
  });
});
