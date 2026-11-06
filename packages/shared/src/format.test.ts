import { describe, expect, it } from 'vitest';
import { formatDate, formatMoney, initials, toProgressTitle } from './format';

// Intl usa espacios de no separación; los normalizamos para comparar
const plain = (s: string) => s.normalize('NFKC');

describe('formatMoney', () => {
  it('formatea en euros según el idioma', () => {
    expect(plain(formatMoney(1230000, 'es'))).toBe('1.230.000 €');
    expect(plain(formatMoney(1230000, 'en'))).toBe('€1,230,000');
  });
});

describe('formatDate', () => {
  it('formatea dd/mm/aaaa y tolera vacío', () => {
    expect(formatDate('2026-03-07', 'es')).toBe('07/03/2026');
    expect(formatDate('2026-03-07', 'en')).toBe('07/03/2026');
    expect(formatDate('', 'es')).toBe('—');
    expect(formatDate(null, 'es')).toBe('—');
  });
});

describe('initials', () => {
  it('toma las iniciales de las dos primeras palabras en mayúsculas', () => {
    expect(initials('Marta Ruiz')).toBe('MR');
    expect(initials('lucía fernández gómez')).toBe('LF');
    expect(initials('Madonna')).toBe('M');
  });
});

describe('toProgressTitle', () => {
  it('compone el title del progreso con el espacio antes del %', () => {
    expect(toProgressTitle(11, 'es')).toBe('11 % completado');
    expect(toProgressTitle(11, 'en')).toBe('11 % complete');
  });
});
