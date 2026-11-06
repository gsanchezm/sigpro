import { describe, expect, it } from 'vitest';
import { clampLimit, dayRange, decodeCursor, encodeCursor } from './audit-cursor';

describe('encodeCursor / decodeCursor', () => {
  it('va y vuelve conservando la fecha y el id', () => {
    const cursor = { at: new Date('2026-01-10T09:30:00.000Z'), id: 'AL-042' };
    const encoded = encodeCursor(cursor);
    expect(encoded).toMatch(/^[A-Za-z0-9_-]+$/); // base64url: seguro en una URL
    expect(decodeCursor(encoded)).toEqual(cursor);
  });

  it('rechaza cursores mal formados', () => {
    expect(decodeCursor('')).toBeNull();
    expect(decodeCursor('no-es-base64-json')).toBeNull();
    expect(decodeCursor(Buffer.from('{"at":"ayer","id":"AL-1"}').toString('base64url'))).toBeNull();
    expect(decodeCursor(Buffer.from('{"at":"2026-01-01T00:00:00Z"}').toString('base64url'))).toBeNull();
    expect(decodeCursor(Buffer.from('{"at":"2026-01-01T00:00:00Z","id":""}').toString('base64url'))).toBeNull();
    expect(decodeCursor(Buffer.from('[1,2]').toString('base64url'))).toBeNull();
  });
});

describe('dayRange', () => {
  it('incluye el día completo de ambos extremos (UTC)', () => {
    expect(dayRange('2026-01-10', '2026-01-12')).toEqual({ gte: new Date('2026-01-10T00:00:00.000Z'), lte: new Date('2026-01-12T23:59:59.999Z') });
    expect(dayRange('2026-01-10')).toEqual({ gte: new Date('2026-01-10T00:00:00.000Z') });
    expect(dayRange(undefined, '2026-01-12')).toEqual({ lte: new Date('2026-01-12T23:59:59.999Z') });
  });

  it('ignora fechas con formato no válido', () => {
    expect(dayRange('10/01/2026', 'mañana')).toEqual({});
    expect(dayRange()).toEqual({});
  });
});

describe('clampLimit', () => {
  it('acota entre 1 y 100 y usa el valor por defecto si no hay número', () => {
    expect(clampLimit(undefined, 20)).toBe(20);
    expect(clampLimit(Number.NaN, 20)).toBe(20);
    expect(clampLimit(0, 20)).toBe(1);
    expect(clampLimit(7.9, 20)).toBe(7);
    expect(clampLimit(5000, 20)).toBe(100);
  });
});
