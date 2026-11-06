import { describe, expect, it } from 'vitest';
import { nextProgramCode } from './domain';

describe('nextProgramCode', () => {
  it('sigue la numeración existente, aunque haya huecos', () => {
    expect(nextProgramCode(['PRG-001', 'PRG-002', 'PRG-024'])).toBe('PRG-025');
  });

  it('empieza en PRG-001 sin programas y rellena con ceros', () => {
    expect(nextProgramCode([])).toBe('PRG-001');
    expect(nextProgramCode(['PRG-009'])).toBe('PRG-010');
    expect(nextProgramCode(['PRG-099'])).toBe('PRG-100');
  });
});
