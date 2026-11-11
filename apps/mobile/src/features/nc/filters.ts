import type { NcListQuery, NcSeverity } from '@sigpro/shared';

// Filtros del tablero. El servidor los aplica (`api.nc.list`): aquí solo se traducen a la query.

export type SeverityFilter = 'all' | NcSeverity;

/** Chips en el orden de la especificación: «Todas», crítica, mayor, menor. */
export const SEVERITY_FILTERS: readonly SeverityFilter[] = ['all', 'critical', 'major', 'minor'];

export interface NcFilters {
  readonly q: string;
  readonly severity: SeverityFilter;
}

/** Sin texto ni severidad no se envía nada: la petición es la lista completa. */
export const toListQuery = (filters: NcFilters): NcListQuery => ({
  q: filters.q.trim() || undefined,
  severity: filters.severity === 'all' ? undefined : filters.severity,
});

export const isFiltered = (filters: NcFilters): boolean => filters.q.trim() !== '' || filters.severity !== 'all';
