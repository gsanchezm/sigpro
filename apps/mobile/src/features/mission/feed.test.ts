import type { MissionEventDto } from '@sigpro/shared';
import { describe, expect, it } from 'vitest';
import { bufferedCount, mergeFeed, pushLiveEvent, visibleFeed } from './feed';

const event = (seq: number, overrides: Partial<MissionEventDto> = {}): MissionEventDto => ({
  id: `EV-${String(seq).padStart(4, '0')}`,
  seq,
  at: '2026-11-11T10:00:00.000Z',
  type: 'heartbeat',
  severity: 'info',
  programCode: null,
  vars: { value: seq },
  origin: 'simulator',
  ...overrides,
});

const seqs = (events: readonly MissionEventDto[]): number[] => events.map((item) => item.seq);

describe('pushLiveEvent', () => {
  it('pone el evento nuevo el primero y no duplica por id', () => {
    const ring = pushLiveEvent([event(2), event(1)], event(3));
    expect(seqs(ring)).toEqual([3, 2, 1]);
    expect(pushLiveEvent(ring, event(3))).toBe(ring);
  });

  it('recorta el anillo a 50 eventos sin mutar el original', () => {
    const full = Array.from({ length: 50 }, (_, i) => event(50 - i));
    const next = pushLiveEvent(full, event(51));
    expect(next).toHaveLength(50);
    expect(next[0]?.seq).toBe(51);
    expect(full).toHaveLength(50);
    expect(full[0]?.seq).toBe(50);
  });
});

describe('mergeFeed', () => {
  it('une historial y eventos en vivo sin repetidos, el más reciente primero', () => {
    const merged = mergeFeed([event(5), event(4)], [event(4), event(3), event(2)]);
    expect(seqs(merged)).toEqual([5, 4, 3, 2]);
  });

  it('respeta el máximo', () => {
    const merged = mergeFeed([], [event(1), event(2), event(3)], 2);
    expect(seqs(merged)).toEqual([3, 2]);
  });
});

describe('pausa del feed', () => {
  const feed = [event(7), event(6), event(5)];

  it('sin pausa se ve todo y no hay nada en espera', () => {
    expect(visibleFeed(feed, null)).toBe(feed);
    expect(bufferedCount(feed, null)).toBe(0);
  });

  it('en pausa solo se ve lo que había al pausar; lo nuevo cuenta como en espera', () => {
    const later = [event(9), event(8), ...feed];
    expect(seqs(visibleFeed(later, 7))).toEqual([7, 6, 5]);
    expect(bufferedCount(later, 7)).toBe(2);
  });

  it('al reanudar (null) aparecen los acumulados', () => {
    const later = [event(9), event(8), ...feed];
    expect(seqs(visibleFeed(later, null))).toEqual([9, 8, 7, 6, 5]);
  });
});
