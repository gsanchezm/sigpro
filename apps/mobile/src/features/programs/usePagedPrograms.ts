import type { ProgramDto, ProgramListResponse } from '@sigpro/shared';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '../../state/auth';
import { hasMorePages, toProgramsQuery, type ListOrder, type ProgramsFilters } from './params';
import { appendPrograms } from './view';

// Lista de programas por páginas. No usa `useResource` porque aquí los datos crecen («Cargar más» añade)
// y el error tiene que conservar el fallo original. Mismo criterio que `src/lib/resource.ts`: solo cuenta la última
// consulta; una respuesta de un filtro anterior se descarta.

export interface ProgramsMeta {
  /** Programas que cumplen los filtros. */
  readonly total: number;
  /** Programas sin filtros (subtítulo de la pantalla). */
  readonly totalAll: number;
  readonly activeCount: number;
  /** Última página cargada y número de páginas del resultado. */
  readonly page: number;
  readonly pages: number;
}

export type PagedPhase = 'loading' | 'ready' | 'error';

export interface PagedPrograms {
  /** Fase de la primera página: cargando, lista lista o error (sin datos). */
  readonly phase: PagedPhase;
  readonly items: readonly ProgramDto[];
  readonly meta: ProgramsMeta | null;
  /** Fallo de la primera página (la lista entera no carga). */
  readonly error: unknown;
  /** Hay una página siguiente pidiéndose. */
  readonly loadingMore: boolean;
  /** Fallo al pedir una página siguiente: la lista ya cargada se conserva. */
  readonly moreError: unknown;
  readonly loadMore: () => void;
  readonly reload: () => void;
}

interface PagedState {
  readonly phase: PagedPhase;
  readonly items: readonly ProgramDto[];
  readonly meta: ProgramsMeta | null;
  readonly error: unknown;
  readonly loadingMore: boolean;
  readonly moreError: unknown;
}

const INITIAL: PagedState = { phase: 'loading', items: [], meta: null, error: null, loadingMore: false, moreError: null };

const metaOf = (response: ProgramListResponse): ProgramsMeta => ({
  total: response.total,
  totalAll: response.totalAll,
  activeCount: response.activeCount,
  page: response.page,
  pages: response.pages,
});

/**
 * Carga la primera página al cambiar los filtros (la lista se reinicia) y añade las siguientes con `loadMore`.
 * `filters` debe ser estable (memoizado): cada cambio de identidad vuelve a pedir la primera página.
 */
export const usePagedPrograms = (filters: ProgramsFilters, order: ListOrder = 'asc'): PagedPrograms => {
  const { api } = useAuth();
  const [state, setState] = useState<PagedState>(INITIAL);
  const [version, setVersion] = useState(0);
  const sequence = useRef(0);
  const latest = useRef(state);
  const pendingMore = useRef(false);
  latest.current = state;

  useEffect(() => {
    sequence.current += 1;
    const mine = sequence.current;
    pendingMore.current = false;
    setState(INITIAL);
    api.programs.list(toProgramsQuery(filters, 1, order)).then(
      (response) => {
        if (mine !== sequence.current) return;
        setState({ phase: 'ready', items: response.items, meta: metaOf(response), error: null, loadingMore: false, moreError: null });
      },
      (failure: unknown) => {
        if (mine !== sequence.current) return;
        setState({ ...INITIAL, phase: 'error', error: failure });
      },
    );
  }, [api, filters, order, version]);

  const loadMore = useCallback(() => {
    const current = latest.current;
    if (current.phase !== 'ready' || !current.meta || pendingMore.current || !hasMorePages(current.meta.page, current.meta.pages)) return;
    const mine = sequence.current;
    const nextPage = current.meta.page + 1;
    pendingMore.current = true;
    setState((previous) => ({ ...previous, loadingMore: true, moreError: null }));
    api.programs.list(toProgramsQuery(filters, nextPage, order)).then(
      (response) => {
        if (mine !== sequence.current) return;
        pendingMore.current = false;
        setState((previous) => ({ ...previous, items: appendPrograms(previous.items, response.items), meta: metaOf(response), loadingMore: false, moreError: null }));
      },
      (failure: unknown) => {
        if (mine !== sequence.current) return;
        pendingMore.current = false;
        setState((previous) => ({ ...previous, loadingMore: false, moreError: failure }));
      },
    );
  }, [api, filters, order]);

  const reload = useCallback(() => setVersion((current) => current + 1), []);

  return { ...state, loadMore, reload };
};
