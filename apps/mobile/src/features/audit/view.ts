// Lógica pura de Auditoría en móvil (web: AuditFeed y useAuditFeed): filtros, validación del rango de fechas escrito a mano,
// resumen del diff, clave del texto de cada acción y mezcla de páginas del feed. Sin imports de react-native: se prueba con
// Vitest en Node (`view.test.ts`).
import type { AuditEntryDto, AuditQuery } from '@sigpro/shared';

/** Filtros que viajan a la API (los mismos cuatro que la web). Vacío = sin filtrar por ese criterio. */
export interface AuditFilters {
  readonly entity: string;
  readonly q: string;
  readonly from: string;
  readonly to: string;
}

export const NO_FILTERS: AuditFilters = { entity: '', q: '', from: '', to: '' };

/** Búsqueda por texto: se espera 250 ms tras teclear antes de pedir (igual que la web). */
export const SEARCH_DEBOUNCE_MS = 250;

const ISO_DAY = /^(\d{4})-(\d{2})-(\d{2})$/;

/** `AAAA-MM-DD` que existe en el calendario (rechaza `2026-13-01` o `2026-02-30`, que la API ignoraría sin avisar). */
export const isCalendarDate = (value: string): boolean => {
  const match = ISO_DAY.exec(value);
  if (!match) return false;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
};

/** Por qué un campo de fecha no se aplica: formato o fecha inexistente (`invalid`) o «Hasta» anterior a «Desde» (`order`). */
export type DateIssue = 'invalid' | 'order';

export interface DateRange {
  /** Fechas que sí se envían a la API (vacío si el campo está vacío o su texto no vale). */
  readonly from: string;
  readonly to: string;
  readonly fromIssue: DateIssue | null;
  readonly toIssue: DateIssue | null;
}

/**
 * Rango de fechas a partir de lo escrito en «Desde» y «Hasta». En la web el selector de fechas lo impide (`min`/`max`);
 * aquí el texto es libre, así que solo se aplica una fecha completa y real, y con «Hasta» anterior a «Desde» no se
 * aplica ninguna de las dos (el error sale bajo «Hasta»). Un campo vacío no es un error.
 */
export const parseDateRange = (fromText: string, toText: string): DateRange => {
  const from = fromText.trim();
  const to = toText.trim();
  const fromValid = from === '' || isCalendarDate(from);
  const toValid = to === '' || isCalendarDate(to);
  const reversed = fromValid && toValid && from !== '' && to !== '' && from > to;
  return {
    from: fromValid && !reversed ? from : '',
    to: toValid && !reversed ? to : '',
    fromIssue: fromValid ? null : 'invalid',
    toIssue: toValid ? (reversed ? 'order' : null) : 'invalid',
  };
};

/** Filtros efectivos: entidad, texto ya depurado y el rango válido. */
export const effectiveFilters = (entity: string, query: string, range: DateRange): AuditFilters => ({
  entity,
  q: query.trim(),
  from: range.from,
  to: range.to,
});

/** ¿Hay algún filtro aplicado? (decide el texto del estado vacío). */
export const hasActiveFilters = (filters: AuditFilters): boolean => Boolean(filters.entity || filters.q || filters.from || filters.to);

/** ¿Hay algo escrito en algún control de filtro? (decide si se ofrece «Limpiar filtros»). */
export const hasDraftFilters = (entity: string, search: string, fromText: string, toText: string): boolean =>
  Boolean(entity || search.trim() || fromText.trim() || toText.trim());

/** Igualdad de filtros por valor (evita pedir de nuevo la primera página si no cambió nada). */
export const sameFilters = (a: AuditFilters, b: AuditFilters): boolean => a.entity === b.entity && a.q === b.q && a.from === b.from && a.to === b.to;

/** Consulta a la API: los filtros y, para las páginas siguientes, el cursor. */
export const toQuery = (filters: AuditFilters, cursor?: string): AuditQuery => ({ ...filters, ...(cursor ? { cursor } : {}) });

/** Valor de un campo del diff como texto: listas separadas por comas, objetos en JSON. */
const diffValue = (value: unknown): string => {
  if (Array.isArray(value)) return value.join(', ');
  if (typeof value === 'object' && value !== null) return JSON.stringify(value);
  return String(value);
};

/** Resumen del cambio de un evento: `campo: valor · campo: valor` (vacío si el evento no lleva diff). */
export const diffSummary = (diff: AuditEntryDto['diff']): string =>
  diff === null
    ? ''
    : Object.entries(diff)
        .map(([key, value]) => `${key}: ${diffValue(value)}`)
        .join(' · ');

/** Clave del texto de una acción en el espacio `auditoria`: `requirement.state_changed` → `a_requirement_state_changed`. */
export const actionKey = (action: string): string => `a_${action.replace(/[.]/g, '_')}`;

/** Clave del texto de una entidad: `program` → `e_program`. */
export const entityKey = (entity: string): string => `e_${entity}`;

/** Añade una página al final sin repetir eventos que ya estaban (el cursor puede solaparse si llegan eventos nuevos). */
export const appendUnique = (current: readonly AuditEntryDto[], incoming: readonly AuditEntryDto[]): readonly AuditEntryDto[] => {
  const known = new Set(current.map((item) => item.id));
  return [...current, ...incoming.filter((item) => !known.has(item.id))];
};
