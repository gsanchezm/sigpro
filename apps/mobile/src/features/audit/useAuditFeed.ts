import type { AuditEntryDto } from '@sigpro/shared';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '../../state/auth';
import { appendUnique, toQuery, type AuditFilters } from './view';

interface FeedState {
  readonly status: 'loading' | 'ready' | 'error';
  readonly items: readonly AuditEntryDto[];
  readonly nextCursor: string | null;
  readonly total: number;
  readonly error: unknown;
  readonly loadingMore: boolean;
  /** Fallo al pedir una página siguiente (se conserva lo ya cargado y se ofrece «Cargar más»). */
  readonly moreError: unknown;
}

const INITIAL: FeedState = { status: 'loading', items: [], nextCursor: null, total: 0, error: null, loadingMore: false, moreError: null };

/**
 * Feed de auditoría con carga continua (web: `useAuditFeed`): acumula páginas por cursor y reinicia al cambiar los filtros.
 * Las respuestas de unos filtros antiguos se descartan (`generation`) y los eventos repetidos no se duplican. Un fallo de la
 * página siguiente no se reintenta solo: se espera a que el usuario pulse «Cargar más».
 */
export const useAuditFeed = (filters: AuditFilters) => {
  const { api } = useAuth();
  const [state, setState] = useState<FeedState>(INITIAL);
  const [version, setVersion] = useState(0);
  const generation = useRef(0);
  const cursorRef = useRef<string | null>(null);
  const busyRef = useRef(false);
  const failedRef = useRef(false);
  const { entity, q, from, to } = filters;

  useEffect(() => {
    const mine = ++generation.current;
    cursorRef.current = null;
    busyRef.current = false;
    failedRef.current = false;
    setState(INITIAL);
    api.audit.list(toQuery({ entity, q, from, to })).then(
      (page) => {
        if (generation.current !== mine) return;
        cursorRef.current = page.nextCursor;
        setState({ ...INITIAL, status: 'ready', items: page.items, nextCursor: page.nextCursor, total: page.total });
      },
      (error: unknown) => generation.current === mine && setState({ ...INITIAL, status: 'error', error }),
    );
  }, [api, entity, q, from, to, version]);

  /** Pide la página siguiente. `manual` es el botón «Cargar más»; la carga continua no reintenta tras un fallo. */
  const loadMore = useCallback(
    (manual = false) => {
      const cursor = cursorRef.current;
      if (!cursor || busyRef.current || (failedRef.current && !manual)) return;
      busyRef.current = true;
      failedRef.current = false;
      const mine = generation.current;
      setState((current) => ({ ...current, loadingMore: true, moreError: null }));
      api.audit.list(toQuery({ entity, q, from, to }, cursor)).then(
        (page) => {
          busyRef.current = false;
          if (generation.current !== mine) return;
          cursorRef.current = page.nextCursor;
          setState((current) => ({ ...current, items: appendUnique(current.items, page.items), nextCursor: page.nextCursor, total: page.total, loadingMore: false }));
        },
        (error: unknown) => {
          busyRef.current = false;
          if (generation.current !== mine) return;
          failedRef.current = true;
          setState((current) => ({ ...current, loadingMore: false, moreError: error }));
        },
      );
    },
    [api, entity, q, from, to],
  );

  const reload = useCallback(() => setVersion((current) => current + 1), []);
  return { ...state, loadMore, reload };
};
