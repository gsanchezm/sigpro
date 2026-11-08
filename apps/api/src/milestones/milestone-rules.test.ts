import { describe, expect, it } from 'vitest';
import { doneAfterProgress } from './milestone-rules';

describe('doneAfterProgress', () => {
  it('con el 100 % el hito queda cumplido y por debajo no', () => {
    expect(doneAfterProgress(60, 100, false)).toBe(true);
    expect(doneAfterProgress(0, 100, false)).toBe(true);
    expect(doneAfterProgress(100, 95, false)).toBe(false);
    expect(doneAfterProgress(0, 0, false)).toBe(false);
  });

  it('con PLANTED_BUGS un salto desde menos del 50 % al 100 % no lo marca como cumplido', () => {
    expect(doneAfterProgress(0, 100, true)).toBe(false);
    expect(doneAfterProgress(45, 100, true)).toBe(false);
    expect(doneAfterProgress(50, 100, true)).toBe(true);
    expect(doneAfterProgress(95, 100, true)).toBe(true);
    expect(doneAfterProgress(0, 40, true)).toBe(false);
  });
});
