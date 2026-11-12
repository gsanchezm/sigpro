import type { TestCaseDto, TestCaseListResponse } from '@sigpro/shared';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '../../state/auth';
import { hasMorePages, toQuery, type VerificationFilters } from './params';
import { appendCases } from './view';

// Lista de casos de prueba por páginas. Como la web, conserva los datos anteriores mientras llegan los nuevos (un cambio de
// filtro no vacía la pantalla) y los descarta si la petición falla. «Cargar más» añade la página siguiente. Solo cuenta
// la última consulta: una respuesta de un filtro anterior se descarta.

export interface CasesMeta {
  /** Casos que cumplen los filtros y ejecuciones de esos casos (el subtítulo de la pantalla). */
  readonly total: number;
  readonly totalRuns: number;
  /** Última página cargada y número de páginas del resultado. */
  readonly page: number;
  readonly pages: number;
}

export type PagedPhase = 'loading' | 'ready' | 'error';

export interface PagedTestCases {
  /** `loading` mientras llega la primera página (aunque haya datos anteriores a la vista), `ready` o `error` (sin datos). */
  readonly phase: PagedPhase;
  readonly items: readonly TestCaseDto[];
  readonly meta: CasesMeta | null;
  /** Fallo de la primera página (la lista entera no carga). */
  readonly error: unknown;
  /** Hay una página siguiente pidiéndose. */
  readonly loadingMore: boolean;
  /** Fallo al pedir una página siguiente: la lista ya cargada se conserva. */
  readonly moreError: unknown;
  readonly loadMore: () => void;
  readonly reload: () => void;
}

interface State {
  readonly phase: PagedPhase;
  readonly items: readonly TestCaseDto[];
  readonly meta: CasesMeta | null;
  readonly error: unknown;
  readonly loadingMore: boolean;
  readonly moreError: unknown;
}

const INITIAL: State = { phase: 'loading', items: [], meta: null, error: null, loadingMore: false, moreError: null };

const metaOf = (response: TestCaseListResponse): CasesMeta => ({ total: response.total, totalRuns: response.totalRuns, page: response.page, pages: response.pages });

/** `filters` debe ser estable (memoizado): cada cambio de identidad vuelve a pedir la primera página. */
export const usePagedTestCases = (filters: VerificationFilters): PagedTestCases => {
  const { api } = useAuth();
  const [state, setState] = useState<State>(INITIAL);
  const [version, setVersion] = useState(0);
  const sequence = useRef(0);
  const latest = useRef(state);
  const pendingMore = useRef(false);
  latest.current = state;

  useEffect(() => {
    sequence.current += 1;
    const mine = sequence.current;
    pendingMore.current = false;
    setState((current) => ({ ...current, phase: 'loading', error: null, loadingMore: false, moreError: null }));
    api.testCases.list(toQuery(filters, 1)).then(
      (response) => {
        if (mine !== sequence.current) return;
        setState({ phase: 'ready', items: response.items, meta: metaOf(response), error: null, loadingMore: false, moreError: null });
      },
      (failure: unknown) => {
        if (mine !== sequence.current) return;
        setState({ ...INITIAL, phase: 'error', error: failure });
      },
    );
  }, [api, filters, version]);

  const loadMore = useCallback(() => {
    const current = latest.current;
    if (current.phase !== 'ready' || !current.meta || pendingMore.current || !hasMorePages(current.meta.page, current.meta.pages)) return;
    const mine = sequence.current;
    const nextPage = current.meta.page + 1;
    pendingMore.current = true;
    setState((previous) => ({ ...previous, loadingMore: true, moreError: null }));
    api.testCases.list(toQuery(filters, nextPage)).then(
      (response) => {
        if (mine !== sequence.current) return;
        pendingMore.current = false;
        setState((previous) => ({ ...previous, items: appendCases(previous.items, response.items), meta: metaOf(response), loadingMore: false, moreError: null }));
      },
      (failure: unknown) => {
        if (mine !== sequence.current) return;
        pendingMore.current = false;
        setState((previous) => ({ ...previous, loadingMore: false, moreError: failure }));
      },
    );
  }, [api, filters]);

  const reload = useCallback(() => setVersion((current) => current + 1), []);

  return { ...state, loadMore, reload };
};
