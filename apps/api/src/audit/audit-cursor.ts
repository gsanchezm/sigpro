// Cursor de paginación del registro de auditoría: opaco para el cliente (base64url de `{ at, id }`).
// La lista se ordena por (at desc, id desc); el cursor es el último elemento entregado.

export interface AuditCursor {
  readonly at: Date;
  readonly id: string;
}

export const encodeCursor = (cursor: AuditCursor): string => Buffer.from(JSON.stringify({ at: cursor.at.toISOString(), id: cursor.id })).toString('base64url');

/** `null` si el cursor no es válido (mal formado, fecha inválida o sin id). */
export const decodeCursor = (value: string): AuditCursor | null => {
  try {
    const parsed = JSON.parse(Buffer.from(value, 'base64url').toString('utf8')) as { at?: unknown; id?: unknown };
    if (typeof parsed.at !== 'string' || typeof parsed.id !== 'string' || parsed.id === '') return null;
    const at = new Date(parsed.at);
    return Number.isNaN(at.getTime()) ? null : { at, id: parsed.id };
  } catch {
    return null;
  }
};

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

/** Rango de fechas del filtro (`YYYY-MM-DD`, ambos extremos incluidos, en UTC). Las fechas no válidas se ignoran. */
export const dayRange = (from?: string, to?: string): { gte?: Date; lte?: Date } => ({
  ...(from && ISO_DAY.test(from) ? { gte: new Date(`${from}T00:00:00.000Z`) } : {}),
  ...(to && ISO_DAY.test(to) ? { lte: new Date(`${to}T23:59:59.999Z`) } : {}),
});

export const MAX_LIMIT = 100;

export const clampLimit = (value: number | undefined, fallback: number): number => (value === undefined || !Number.isFinite(value) ? fallback : Math.min(MAX_LIMIT, Math.max(1, Math.floor(value))));
