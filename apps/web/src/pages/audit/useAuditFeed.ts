import type { AuditEntryDto } from '@sigpro/shared';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '../../state/auth';

export interface AuditFilters {
  readonly entity: string;
  readonly q: string;
  readonly from: string;
  readonly to: string;
}

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
 * Feed de auditoría con scroll infinito: acumula páginas por cursor y reinicia al cambiar los filtros. Las respuestas de
 * unos filtros antiguos se descartan (`generation`), y los eventos repetidos no se duplican.
 */
export const useAuditFeed = (filters: AuditFilters, enabled: boolean) => {
  const { api } = useAuth();
  const [state, setState] = useState<FeedState>(INITIAL);
  const [version, setVersion] = useState(0);
  const generation = useRef(0);
  const { entity, q, from, to } = filters;
  const cursorRef = useRef<string | null>(null);
  const busyRef = useRef(false);

  useEffect(() => {
    if (!enabled) return;
    const mine = ++generation.current;
    cursorRef.current = null;
    busyRef.current = false;
    setState(INITIAL);
    api.audit.list({ entity, q, from, to }).then(
      (page) => {
        if (generation.current !== mine) return;
        cursorRef.current = page.nextCursor;
        setState({ ...INITIAL, status: 'ready', items: page.items, nextCursor: page.nextCursor, total: page.total });
      },
      (error: unknown) => generation.current === mine && setState({ ...INITIAL, status: 'error', error }),
    );
  }, [api, enabled, entity, q, from, to, version]);

  /** Pide la página siguiente (no hace nada si ya hay una petición en curso o no quedan eventos). */
  const loadMore = useCallback(() => {
    const cursor = cursorRef.current;
    if (!cursor || busyRef.current) return;
    busyRef.current = true;
    const mine = generation.current;
    setState((current) => ({ ...current, loadingMore: true, moreError: null }));
    api.audit.list({ entity, q, from, to, cursor }).then(
      (page) => {
        busyRef.current = false;
        if (generation.current !== mine) return;
        cursorRef.current = page.nextCursor;
        setState((current) => {
          const known = new Set(current.items.map((item) => item.id));
          return { ...current, items: [...current.items, ...page.items.filter((item) => !known.has(item.id))], nextCursor: page.nextCursor, total: page.total, loadingMore: false };
        });
      },
      (error: unknown) => {
        busyRef.current = false;
        if (generation.current === mine) setState((current) => ({ ...current, loadingMore: false, moreError: error }));
      },
    );
  }, [api, entity, q, from, to]);

  const reload = useCallback(() => setVersion((current) => current + 1), []);
  return { ...state, loadMore, reload };
};
