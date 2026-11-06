export type PasswordStrength = 'none' | 'weak' | 'fair' | 'good' | 'strong';

const STRENGTHS: readonly PasswordStrength[] = ['none', 'weak', 'fair', 'good', 'strong'];

/** Las cuatro reglas del registro: ≥10 caracteres · mayúscula y minúscula · número · símbolo. */
export const passwordRules = (password: string): readonly [boolean, boolean, boolean, boolean] => [
  password.length >= 10,
  /[a-z]/.test(password) && /[A-Z]/.test(password),
  /\d/.test(password),
  /[^A-Za-z0-9]/.test(password),
];

export const passwordScore = (password: string): number => passwordRules(password).filter(Boolean).length;

export const passwordStrength = (password: string): PasswordStrength => STRENGTHS[passwordScore(password)] ?? 'none';

export const isPasswordValid = (password: string): boolean => passwordRules(password).every(Boolean);
