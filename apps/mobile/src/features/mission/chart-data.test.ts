import { describe, expect, it } from 'vitest';
import { columnHeights, milestoneBarViews } from './chart-data';

describe('milestoneBarViews', () => {
  it('escala cada barra al programa con más hitos y calcula la parte cumplida', () => {
    const views = milestoneBarViews([
      { programCode: 'PRG-001', programName: 'A', done: 3, total: 8 },
      { programCode: 'PRG-002', programName: 'B', done: 2, total: 4 },
    ]);
    expect(views.map((view) => view.widthPct)).toEqual([100, 50]);
    expect(views.map((view) => view.donePct)).toEqual([38, 50]);
  });

  it('un programa sin hitos no divide por cero', () => {
    const [view] = milestoneBarViews([{ programCode: 'PRG-003', programName: 'C', done: 0, total: 0 }]);
    expect(view).toMatchObject({ widthPct: 0, donePct: 0 });
    expect(milestoneBarViews([])).toEqual([]);
  });
});

describe('columnHeights', () => {
  it('escala a la columna mayor, con mínimo 4 px si hay datos y 0 si no', () => {
    expect(columnHeights({ minor: 0, major: 2, critical: 1 }, 120)).toEqual({ minor: 0, major: 120, critical: 60 });
    expect(columnHeights({ minor: 1, major: 1000, critical: 0 }, 120).minor).toBe(4);
  });

  it('sin datos todo es 0', () => {
    expect(columnHeights({ minor: 0, major: 0, critical: 0 }, 120)).toEqual({ minor: 0, major: 0, critical: 0 });
  });
});
