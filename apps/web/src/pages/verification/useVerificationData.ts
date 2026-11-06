import type { TestCaseDetailDto, TestCaseListQuery, TestCaseListResponse } from '@sigpro/shared';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../state/auth';

export type LoadStatus = 'loading' | 'ready' | 'error';

interface ListSnapshot {
  readonly status: LoadStatus;
  /** Clave de la consulta a la que pertenecen `data`/`error` (se conservan los datos anteriores mientras llegan los nuevos). */
  readonly settledKey: string | null;
  readonly data: TestCaseListResponse | null;
  readonly error: unknown;
}

/** Lista de casos de prueba con el query dado; cada cambio de query o `reload()` vuelve a pedirla. */
export const useTestCasesList = (query: TestCaseListQuery) => {
  const { api } = useAuth();
  const key = JSON.stringify(query);
  const stableQuery = useMemo(() => query, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  const [snapshot, setSnapshot] = useState<ListSnapshot>({ status: 'loading', settledKey: null, data: null, error: null });
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setSnapshot((current) => ({ status: 'loading', settledKey: current.settledKey, data: current.status === 'error' ? null : current.data, error: null }));
    api.testCases.list(stableQuery).then(
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

interface DetailState {
  readonly status: LoadStatus;
  readonly data: TestCaseDetailDto | null;
  readonly error: unknown;
}

/** Detalle de un caso de prueba (pasos, requisitos, historial de ejecuciones con evidencias). */
export const useTestCaseDetail = (code: string) => {
  const { api } = useAuth();
  const [state, setState] = useState<DetailState>({ status: 'loading', data: null, error: null });
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setState((current) => ({ status: 'loading', data: current.data?.code === code ? current.data : null, error: null }));
    api.testCases.get(code).then(
      (data) => !cancelled && setState({ status: 'ready', data, error: null }),
      (error: unknown) => !cancelled && setState({ status: 'error', data: null, error }),
    );
    return () => {
      cancelled = true;
    };
  }, [api, code, version]);

  const reload = useCallback(() => setVersion((current) => current + 1), []);
  return { ...state, reload };
};
