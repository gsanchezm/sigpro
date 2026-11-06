import { describe, expect, it } from 'vitest';
import { passwordRules, passwordScore, passwordStrength } from './password';

describe('passwordRules', () => {
  it('una contraseña vacía no cumple ninguna regla', () => {
    expect(passwordRules('')).toEqual([false, false, false, false]);
  });

  it('evalúa longitud, mayúscula+minúscula, número y símbolo por separado', () => {
    expect(passwordRules('abcdefghij')).toEqual([true, false, false, false]);
    expect(passwordRules('Abc')).toEqual([false, true, false, false]);
    expect(passwordRules('1')).toEqual([false, false, true, false]);
    expect(passwordRules('!')).toEqual([false, false, false, true]);
  });

  it('exige mayúscula Y minúscula en la misma regla', () => {
    expect(passwordRules('ABCDEFGHIJ')[1]).toBe(false);
    expect(passwordRules('abcdefghij')[1]).toBe(false);
  });

  it('una contraseña fuerte cumple las cuatro', () => {
    expect(passwordRules('Admin1234!x')).toEqual([true, true, true, true]);
  });
});

describe('passwordStrength', () => {
  it('traduce la puntuación a none|weak|fair|good|strong', () => {
    expect(passwordScore('')).toBe(0);
    expect(passwordStrength('')).toBe('none');
    expect(passwordStrength('abcdefghij')).toBe('weak');
    expect(passwordStrength('abcdefghij1')).toBe('fair');
    expect(passwordStrength('Abcdefghij1')).toBe('good');
    expect(passwordStrength('Abcdefghij1!')).toBe('strong');
  });
});
