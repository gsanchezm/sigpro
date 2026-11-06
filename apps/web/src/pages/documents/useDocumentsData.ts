import type { DocumentDetailDto, DocumentListResponse } from '@sigpro/shared';
import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../../state/auth';

export type LoadStatus = 'loading' | 'ready' | 'error';

export interface DocumentFilters {
  readonly q: string;
  readonly program: string;
  readonly classification: string;
}

interface ListState {
  readonly status: LoadStatus;
  readonly data: DocumentListResponse | null;
  readonly error: unknown;
}

/** Documentos visibles para el rol con los filtros dados (la API omite los restringidos a quien no puede verlos). */
export const useDocumentsList = (filters: DocumentFilters) => {
  const { api } = useAuth();
  const [state, setState] = useState<ListState>({ status: 'loading', data: null, error: null });
  const [version, setVersion] = useState(0);
  const { q, program, classification } = filters;

  useEffect(() => {
    let cancelled = false;
    setState((current) => ({ status: 'loading', data: current.status === 'error' ? null : current.data, error: null }));
    api.documents.list({ q, program, classification }).then(
      (data) => !cancelled && setState({ status: 'ready', data, error: null }),
      (error: unknown) => !cancelled && setState({ status: 'error', data: null, error }),
    );
    return () => {
      cancelled = true;
    };
  }, [api, q, program, classification, version]);

  const reload = useCallback(() => setVersion((current) => current + 1), []);
  return { ...state, reload };
};

interface DetailState {
  readonly status: LoadStatus;
  readonly data: DocumentDetailDto | null;
  readonly error: unknown;
}

/** Detalle de un documento con su historial de versiones. */
export const useDocumentDetail = (id: string) => {
  const { api } = useAuth();
  const [state, setState] = useState<DetailState>({ status: 'loading', data: null, error: null });
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setState((current) => ({ status: 'loading', data: current.data?.id === id ? current.data : null, error: null }));
    api.documents.get(id).then(
      (data) => !cancelled && setState({ status: 'ready', data, error: null }),
      (error: unknown) => !cancelled && setState({ status: 'error', data: null, error }),
    );
    return () => {
      cancelled = true;
    };
  }, [api, id, version]);

  const reload = useCallback(() => setVersion((current) => current + 1), []);
  return { ...state, reload };
};
