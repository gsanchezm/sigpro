import { ApiError } from '@sigpro/shared';

// Tipo de fallo de una petición de No conformidades, a partir del código HTTP (mapa de despacho, sin switch).

export type FailureKind = 'denied' | 'invalid' | 'validation' | 'notFound' | 'other';

const KIND_BY_STATUS: ReadonlyMap<number, FailureKind> = new Map<number, FailureKind>([
  [403, 'denied'],
  [404, 'notFound'],
  [409, 'invalid'],
  [422, 'validation'],
]);

export const failureKind = (error: unknown): FailureKind => {
  if (!(error instanceof ApiError)) return 'other';
  return KIND_BY_STATUS.get(error.status) ?? 'other';
};

/** Clave de error del campo `comment` en un 422 (p. ej. `closureShort`), o `null`. */
export const commentErrorKey = (error: unknown): string | null => {
  if (!(error instanceof ApiError)) return null;
  return error.body.errors?.comment ?? null;
};
