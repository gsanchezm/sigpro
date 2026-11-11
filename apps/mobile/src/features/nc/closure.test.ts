import { describe, expect, it } from 'vitest';
import { CLOSURE_MIN_LENGTH, closureCount, closureIssue } from './closure';

describe('closureIssue', () => {
  it('el mínimo de cierre es 20 caracteres', () => {
    expect(CLOSURE_MIN_LENGTH).toBe(20);
  });

  it('vacío o solo espacios: obligatorio', () => {
    expect(closureIssue('')).toBe('closureRequired');
    expect(closureIssue('   ')).toBe('closureRequired');
  });

  it('19 caracteres no bastan; 20 sí', () => {
    expect(closureIssue('x'.repeat(19))).toBe('closureShort');
    expect(closureIssue('x'.repeat(20))).toBeNull();
  });

  it('cuenta sin los espacios de los extremos', () => {
    expect(closureIssue(`  ${'x'.repeat(19)}  `)).toBe('closureShort');
    expect(closureCount('  abc  ')).toBe(3);
  });
});
