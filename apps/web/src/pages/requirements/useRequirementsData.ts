import type { ProgramDto, RequirementDto, RequirementListResponse, TraceabilityDto } from '@sigpro/shared';
import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../../state/auth';

export type LoadStatus = 'loading' | 'ready' | 'error';

interface ListState {
  readonly status: LoadStatus;
  readonly data: RequirementListResponse | null;
  readonly error: unknown;
}

/** Requisitos del programa. `reload()` vuelve a pedirlos; `replaceItems()` aplica un cambio optimista sin red. */
export const useRequirementsData = (programCode: string) => {
  const { api } = useAuth();
  const [state, setState] = useState<ListState>({ status: 'loading', data: null, error: null });
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let cancelled = false;
    // Al cambiar de programa se descartan los datos; al recargar se conservan mientras llegan los nuevos
    setState((current) => ({ status: 'loading', data: current.data?.program.code === programCode ? current.data : null, error: null }));
    api.requirements.list(programCode).then(
      (data) => !cancelled && setState({ status: 'ready', data, error: null }),
      (error: unknown) => !cancelled && setState({ status: 'error', data: null, error }),
    );
    return () => {
      cancelled = true;
    };
  }, [api, programCode, version]);

  const reload = useCallback(() => setVersion((current) => current + 1), []);
  const replaceItems = useCallback(
    (items: readonly RequirementDto[]) => setState((current) => (current.data ? { ...current, data: { ...current.data, items } } : current)),
    [],
  );
  return { ...state, reload, replaceItems };
};

interface MatrixState {
  readonly status: LoadStatus;
  readonly data: TraceabilityDto | null;
  readonly error: unknown;
}

/** Matriz de trazabilidad del programa (se pide al montar la pestaña). */
export const useTraceability = (programCode: string) => {
  const { api } = useAuth();
  const [state, setState] = useState<MatrixState>({ status: 'loading', data: null, error: null });
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setState((current) => ({ status: 'loading', data: current.data, error: null }));
    api.requirements.traceability(programCode).then(
      (data) => !cancelled && setState({ status: 'ready', data, error: null }),
      (error: unknown) => !cancelled && setState({ status: 'error', data: null, error }),
    );
    return () => {
      cancelled = true;
    };
  }, [api, programCode, version]);

  const reload = useCallback(() => setVersion((current) => current + 1), []);
  const setLinks = useCallback((links: TraceabilityDto['links']) => setState((current) => (current.data ? { ...current, data: { ...current.data, links } } : current)), []);
  return { ...state, reload, setLinks };
};

/** Programas para el selector de la cabecera (hasta 50, por código). */
export const useProgramOptions = () => {
  const { api } = useAuth();
  const [programs, setPrograms] = useState<readonly ProgramDto[]>([]);
  useEffect(() => {
    let cancelled = false;
    api.programs.list({ sort: 'code', dir: 'asc', pageSize: 50 }).then(
      (response) => !cancelled && setPrograms(response.items),
      () => undefined,
    );
    return () => {
      cancelled = true;
    };
  }, [api]);
  return programs;
};
