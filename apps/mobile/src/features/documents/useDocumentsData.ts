import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '../../state/auth';

// Carga de Documentos. `useLoaded` conserva el error tal cual llega (un `ApiError` con su estado HTTP),
// porque la ficha distingue 403 («sin permiso»), 404 («no existe») y el resto (reintento).

export type LoadStatus = 'loading' | 'ready' | 'error';

export interface Loaded<T> {
  readonly status: LoadStatus;
  readonly data: T | null;
  readonly failure: unknown;
  readonly reload: () => void;
}

/** Carga al montar y cada vez que cambian `deps` o se pide `reload`. Solo cuenta la última petición. */
export const useLoaded = <T>(load: () => Promise<T>, deps: readonly unknown[]): Loaded<T> => {
  const [state, setState] = useState<{ readonly status: LoadStatus; readonly data: T | null; readonly failure: unknown }>({
    status: 'loading',
    data: null,
    failure: null,
  });
  const [revision, setRevision] = useState(0);
  const loader = useRef(load);
  loader.current = load;

  useEffect(() => {
    let alive = true;
    setState({ status: 'loading', data: null, failure: null });
    loader.current().then(
      (data) => {
        if (alive) setState({ status: 'ready', data, failure: null });
      },
      (failure: unknown) => {
        if (alive) setState({ status: 'error', data: null, failure });
      },
    );
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- las dependencias las decide quien llama
  }, [...deps, revision]);

  const reload = useCallback(() => setRevision((current) => current + 1), []);
  return { ...state, reload };
};

/** Lista de documentos visibles para el rol (la API omite los restringidos a quien no puede verlos). */
export const useDocumentsList = () => {
  const { api } = useAuth();
  return useLoaded(() => api.documents.list(), [api]);
};

/** Ficha de un documento con su historial de versiones. */
export const useDocumentDetail = (id: string) => {
  const { api } = useAuth();
  return useLoaded(() => api.documents.get(id), [api, id]);
};

/** Contenido de una versión concreta (páginas de líneas). */
export const useDocumentContent = (id: string, version: number) => {
  const { api } = useAuth();
  return useLoaded(() => api.documents.content(id, version), [api, id, version]);
};
