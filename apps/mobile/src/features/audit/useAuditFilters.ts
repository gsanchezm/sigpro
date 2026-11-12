import { useCallback, useEffect, useState } from 'react';
import { SEARCH_DEBOUNCE_MS, effectiveFilters, hasDraftFilters, parseDateRange, sameFilters, type AuditFilters, type DateRange } from './view';

export interface AuditFilterControls {
  readonly entity: string;
  readonly from: string;
  readonly to: string;
  readonly search: string;
  readonly setEntity: (value: string) => void;
  readonly setFrom: (value: string) => void;
  readonly setTo: (value: string) => void;
  readonly setSearch: (value: string) => void;
  /** Lo escrito en las fechas, ya validado (errores inmediatos aunque la consulta espere). */
  readonly range: DateRange;
  /** Filtros que se envían a la API: salen de lo escrito tras 250 ms sin cambios, como el buscador de la web. */
  readonly applied: AuditFilters;
  /** Hay algo escrito en algún control (aunque no valga todavía): se ofrece «Limpiar filtros». */
  readonly dirty: boolean;
  readonly clear: () => void;
}

/**
 * Estado de los controles del feed de Auditoría. Lo escrito se valida al instante (`range`); a la API solo llegan filtros
 * completos y válidos (`applied`) y con un pequeño retraso, para no pedir en cada pulsación ni con una fecha a medio escribir.
 */
export const useAuditFilters = (): AuditFilterControls => {
  const [entity, setEntity] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [search, setSearch] = useState('');
  const range = parseDateRange(from, to);
  const wanted = effectiveFilters(entity, search, range);
  const [applied, setApplied] = useState<AuditFilters>(wanted);

  const { entity: wantedEntity, q, from: wantedFrom, to: wantedTo } = wanted;
  useEffect(() => {
    const next: AuditFilters = { entity: wantedEntity, q, from: wantedFrom, to: wantedTo };
    if (sameFilters(applied, next)) return;
    const timer = setTimeout(() => setApplied(next), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [applied, wantedEntity, q, wantedFrom, wantedTo]);

  const clear = useCallback(() => {
    setEntity('');
    setFrom('');
    setTo('');
    setSearch('');
  }, []);

  return { entity, from, to, search, setEntity, setFrom, setTo, setSearch, range, applied, dirty: hasDraftFilters(entity, search, from, to), clear };
};
