import type { NcDto, NcListResponse, NcSeverity } from '@sigpro/shared';
import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../../state/auth';

export type LoadStatus = 'loading' | 'ready' | 'error';

export interface NcFilters {
  readonly q: string;
  readonly program: string;
  readonly severity: NcSeverity | '';
  readonly unassigned: boolean;
}

export const NO_FILTERS: NcFilters = { q: '', program: '', severity: '', unassigned: false };

export const hasFilters = (filters: NcFilters): boolean => filters.q !== '' || filters.program !== '' || filters.severity !== '' || filters.unassigned;

interface BoardState {
  readonly status: LoadStatus;
  readonly data: NcListResponse | null;
  readonly error: unknown;
}

/**
 * No conformidades del tablero (los filtros se piden al servidor). `reload()` vuelve a pedirlas conservando lo que hay
 * mientras llegan las nuevas; `setItems()` aplica un cambio optimista (arrastre) sin pasar por la red.
 */
export const useNcBoard = (filters: NcFilters) => {
  const { api } = useAuth();
  const [state, setState] = useState<BoardState>({ status: 'loading', data: null, error: null });
  const [version, setVersion] = useState(0);
  const { q, program, severity, unassigned } = filters;

  useEffect(() => {
    let cancelled = false;
    setState((current) => ({ status: 'loading', data: current.data, error: null }));
    api.nc
      .list({ q: q || undefined, program: program || undefined, severity: severity || undefined, assignee: unassigned ? 'none' : undefined })
      .then(
        (data) => !cancelled && setState({ status: 'ready', data, error: null }),
        (error: unknown) => !cancelled && setState({ status: 'error', data: null, error }),
      );
    return () => {
      cancelled = true;
    };
  }, [api, q, program, severity, unassigned, version]);

  const reload = useCallback(() => setVersion((current) => current + 1), []);
  const setItems = useCallback(
    (items: readonly NcDto[]) => setState((current) => (current.data ? { ...current, data: { ...current.data, items } } : current)),
    [],
  );
  return { ...state, reload, setItems };
};
