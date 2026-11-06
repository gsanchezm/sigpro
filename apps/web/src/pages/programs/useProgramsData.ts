import type { OwnerDto, ProgramListQuery, ProgramListResponse } from '@sigpro/shared';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../state/auth';

export type LoadStatus = 'loading' | 'ready' | 'error';

interface ListSnapshot {
  readonly status: LoadStatus;
  /** Clave de la consulta a la que corresponden `data`/`error` (los datos anteriores se conservan mientras llegan los nuevos). */
  readonly settledKey: string | null;
  readonly data: ProgramListResponse | null;
  readonly error: unknown;
}

/** Carga la lista de programas con el query dado; cada cambio de query o `reload()` vuelve a pedirla. */
export const useProgramsList = (query: ProgramListQuery) => {
  const { api } = useAuth();
  const key = JSON.stringify(query);
  const stableQuery = useMemo(() => query, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  const [snapshot, setSnapshot] = useState<ListSnapshot>({ status: 'loading', settledKey: null, data: null, error: null });
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let cancelled = false;
    // Conserva los datos anteriores mientras llegan los nuevos (la tabla queda `aria-busy`)
    setSnapshot((current) => ({ status: 'loading', settledKey: current.settledKey, data: current.status === 'error' ? null : current.data, error: null }));
    api.programs.list(stableQuery).then(
      (data) => !cancelled && setSnapshot({ status: 'ready', settledKey: key, data, error: null }),
      (error: unknown) => !cancelled && setSnapshot({ status: 'error', settledKey: key, data: null, error }),
    );
    return () => {
      cancelled = true;
    };
  }, [api, stableQuery, key, version]);

  const reload = useCallback(() => setVersion((current) => current + 1), []);
  return { ...snapshot, currentKey: key, reload };
};

/** Responsables posibles (personas del tenant) con su nº de programas. */
export const useOwners = () => {
  const { api } = useAuth();
  const [owners, setOwners] = useState<readonly OwnerDto[]>([]);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let cancelled = false;
    api.users.owners().then(
      (list) => !cancelled && setOwners(list),
      () => undefined,
    );
    return () => {
      cancelled = true;
    };
  }, [api, version]);

  const reload = useCallback(() => setVersion((current) => current + 1), []);
  return { owners, reload };
};
