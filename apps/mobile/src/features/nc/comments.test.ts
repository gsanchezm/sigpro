import { describe, expect, it } from 'vitest';
import { commentTime } from './comments';

describe('commentTime', () => {
  it('formatea una marca ISO completa con fecha y hora (sin «Invalid Date»)', () => {
    const text = commentTime('2026-02-01T10:00:00.000Z', 'es');
    expect(text).not.toContain('Invalid');
    expect(text).toMatch(/\d{2}\/\d{2}\/2026, \d{2}:\d{2}/);
  });

  it('usa la convención del idioma activo', () => {
    expect(commentTime('2026-02-01T10:00:00.000Z', 'en')).toMatch(/\d{2}\/\d{2}\/2026/);
  });

  it('una fecha no válida se muestra como guion largo', () => {
    expect(commentTime('no es una fecha', 'es')).toBe('—');
  });
});
