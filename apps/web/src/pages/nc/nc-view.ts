import { isClosureComment, isNcTransition, sanitizeRichText, type NcSeverity, type NcState, type Tone, type UpdateNcInput } from '@sigpro/shared';

// Reglas puras de la vista de No conformidades (sin DOM): se prueban en Node.

/** Colores del design system por tono (tarjeta, badges y puntos de columna comparten vocabulario). */
export const TONE_COLORS: Readonly<Record<Tone, { readonly fg: string; readonly soft: string }>> = {
  neutral: { fg: 'var(--neutral)', soft: 'var(--neutral-soft)' },
  info: { fg: 'var(--info)', soft: 'var(--info-soft)' },
  warn: { fg: 'var(--warn)', soft: 'var(--warn-soft)' },
  ok: { fg: 'var(--ok)', soft: 'var(--ok-soft)' },
  danger: { fg: 'var(--danger)', soft: 'var(--danger-soft)' },
  purple: { fg: 'var(--purple)', soft: 'var(--purple-soft)' },
};

/**
 * Número que enseña la insignia de comentarios de la tarjeta. Con `PLANTED_BUGS` muestra uno menos cuando hay más de
 * dos (defecto plantado del laboratorio; el detalle sigue listando todos).
 */
export const commentBadgeCount = (count: number, plantedBugs: boolean): number => (plantedBugs && count > 2 ? count - 1 : count);

/** Copia de la lista con la NC `code` en la columna `to` (vista optimista del arrastre). */
export const moveItemTo = <T extends { readonly code: string; readonly state: NcState }>(items: readonly T[], code: string, to: NcState): readonly T[] =>
  items.map((item) => (item.code === code ? { ...item, state: to } : item));

export type DropHint = 'same' | 'valid' | 'invalid';

/** Pista visual al arrastrar: la máquina de estados dice qué columnas son válidas (el servidor sigue decidiendo). */
export const dropHint = (from: NcState, to: NcState): DropHint => (from === to ? 'same' : isNcTransition(from, to) ? 'valid' : 'invalid');

export interface NcEditable {
  readonly severity: NcSeverity;
  readonly description: string;
  readonly assigneeId: string | null;
}

/** Solo lo que cambió respecto al original (`null` si no hay cambios): es lo que viaja en el PATCH. */
export const diffNcDraft = (original: NcEditable, draft: NcEditable): UpdateNcInput | null => {
  const changes: { severity?: NcSeverity; description?: string; assigneeId?: string | null } = {};
  if (draft.severity !== original.severity) changes.severity = draft.severity;
  if (sanitizeRichText(draft.description) !== sanitizeRichText(original.description)) changes.description = draft.description;
  if (draft.assigneeId !== original.assigneeId) changes.assigneeId = draft.assigneeId;
  return Object.keys(changes).length > 0 ? changes : null;
};

/** Clave i18n (`nc`) del error de un comentario de cierre; `null` si es válido. `degraded` = defecto plantado (19 caracteres). */
export const closureErrorKey = (text: string, degraded: boolean): 'closureRequired' | 'closureShort' | null => {
  if (text.trim() === '') return 'closureRequired';
  return isClosureComment(text, degraded) ? null : 'closureShort';
};

/** Primer error de una respuesta 422 (`errors: { campo: clave }`) para el campo indicado. */
export const fieldError = (errors: Readonly<Record<string, string>> | null | undefined, field: string): string | null => {
  const key = errors?.[field];
  return key ? key : null;
};

/** Texto plano corto de la descripción (tarjeta): sin HTML y recortado con puntos suspensivos. */
export const truncateText = (text: string, max: number): string => (text.length <= max ? text : `${text.slice(0, max - 1).trimEnd()}…`);
