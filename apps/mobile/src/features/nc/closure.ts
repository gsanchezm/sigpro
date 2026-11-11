import { NC_CLOSE_MIN_LENGTH, isClosureComment } from '@sigpro/shared';

// Comentario de cierre: mínimo de 20 caracteres (sin contar los espacios de los extremos). Es el mínimo correcto de la
// app: la regla compartida se llama sin el argumento de degradación.

export type ClosureIssue = 'closureRequired' | 'closureShort';

/** Clave de error del comentario de cierre, o `null` si es válido. */
export const closureIssue = (text: string): ClosureIssue | null => {
  if (text.trim() === '') return 'closureRequired';
  return isClosureComment(text) ? null : 'closureShort';
};

/** Contador «n / 20»: caracteres sin espacios de los extremos. */
export const closureCount = (text: string): number => text.trim().length;

export const CLOSURE_MIN_LENGTH = NC_CLOSE_MIN_LENGTH;
