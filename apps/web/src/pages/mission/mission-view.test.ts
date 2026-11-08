import type { MissionEventDto } from '@sigpro/shared';
import { describe, expect, it } from 'vitest';
import { bufferedCount, columnHeights, mergeFeed, milestoneBarViews, visibleFeed } from './mission-view';

const event = (seq: number): MissionEventDto => ({ id: `EV-${seq}`, seq, at: '2026-11-07T10:00:00.000Z', type: 'link', severity: 'info', programCode: 'PRG-001', vars: {}, origin: 'simulator' });

describe('mergeFeed', () => {
  it('une historial y eventos en vivo sin repetidos, el más reciente primero', () => {
    const merged = mergeFeed([event(8), event(7), event(5)], [event(6), event(5), event(4)]);
    expect(merged.map((item) => item.seq)).toEqual([8, 7, 6, 5, 4]);
  });

  it('recorta a 50', () => {
    const many = Array.from({ length: 70 }, (_, i) => event(i + 1));
    const merged = mergeFeed(many, []);
    expect(merged).toHaveLength(50);
    expect(merged[0]?.seq).toBe(70);
  });
});

describe('pausa del feed', () => {
  const feed = [event(9), event(8), event(7)];

  it('sin pausa muestra todo y no hay eventos en espera', () => {
    expect(visibleFeed(feed, null)).toHaveLength(3);
    expect(bufferedCount(feed, null)).toBe(0);
  });

  it('en pausa congela en el último seq visto y cuenta lo que queda en espera', () => {
    expect(visibleFeed(feed, 7).map((item) => item.seq)).toEqual([7]);
    expect(bufferedCount(feed, 7)).toBe(2);
    expect(bufferedCount(feed, 9)).toBe(0);
  });
});

describe('geometría de las gráficas', () => {
  it('las barras de hitos son comparables entre programas', () => {
    const views = milestoneBarViews([
      { programCode: 'PRG-001', programName: 'A', done: 1, total: 9 },
      { programCode: 'PRG-002', programName: 'B', done: 3, total: 6 },
    ]);
    expect(views.map((view) => view.widthPct)).toEqual([100, 67]);
    expect(views.map((view) => view.donePct)).toEqual([11, 50]);
  });

  it('sin datos no divide entre cero', () => {
    expect(milestoneBarViews([])).toEqual([]);
    expect(milestoneBarViews([{ programCode: 'PRG-001', programName: 'A', done: 0, total: 0 }])[0]?.donePct).toBe(0);
  });

  it('las columnas escalan al máximo; 0 no dibuja nada y 1 sobre un máximo grande sigue visible', () => {
    expect(columnHeights({ minor: 0, major: 5, critical: 10 }, 100)).toEqual({ minor: 0, major: 50, critical: 100 });
    expect(columnHeights({ minor: 1, major: 0, critical: 100 }, 100).minor).toBe(4);
    expect(columnHeights({ minor: 0, major: 0, critical: 0 }, 100)).toEqual({ minor: 0, major: 0, critical: 0 });
  });
});
