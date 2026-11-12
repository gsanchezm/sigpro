import type { RequirementDto, RequirementListResponse, TraceabilityDto } from '@sigpro/shared';
import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../../state/auth';

// Requisitos del programa. A diferencia de `useResource` conserva el error tal cual llega (un `ApiError`),
// para distinguir un 404 («Programa no encontrado») de un fallo genérico con traza y «Reintentar».
// Como la web: al recargar se conservan los datos mientras llegan los nuevos (así la hoja abierta no se cierra), y
// `replaceItems` aplica una respuesta ya conocida (guardar, transicionar, mover) sin volver a pedir la lista.

export type LoadStatus = 'loading' | 'ready' | 'error';

interface RequirementsState {
  readonly status: LoadStatus;
  readonly data: RequirementListResponse | null;
  readonly failure: unknown;
}

export const useRequirementsData = (programCode: string) => {
  const { api } = useAuth();
  const [state, setState] = useState<RequirementsState>({ status: 'loading', data: null, failure: null });
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    // Solo cuenta la última petición: si cambia el programa mientras otra respuesta viaja, la antigua se descarta
    let alive = true;
    setState((current) => ({ status: 'loading', data: current.data?.program.code === programCode ? current.data : null, failure: null }));
    api.requirements.list(programCode).then(
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
  }, [api, programCode, revision]);

  const reload = useCallback(() => setRevision((current) => current + 1), []);
  const replaceItems = useCallback(
    (items: readonly RequirementDto[]) => setState((current) => (current.data ? { ...current, data: { ...current.data, items } } : current)),
    [],
  );
  return { ...state, reload, replaceItems };
};

interface MatrixState {
  readonly status: LoadStatus;
  readonly data: TraceabilityDto | null;
  readonly failure: unknown;
}

/** Matriz de trazabilidad del programa (se pide al abrir la vista). `setLinks` aplica un cambio optimista de enlaces. */
export const useTraceability = (programCode: string) => {
  const { api } = useAuth();
  const [state, setState] = useState<MatrixState>({ status: 'loading', data: null, failure: null });
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    let alive = true;
    setState((current) => ({ status: 'loading', data: current.data, failure: null }));
    api.requirements.traceability(programCode).then(
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
  }, [api, programCode, revision]);

  const reload = useCallback(() => setRevision((current) => current + 1), []);
  const setLinks = useCallback((links: TraceabilityDto['links']) => setState((current) => (current.data ? { ...current, data: { ...current.data, links } } : current)), []);
  return { ...state, reload, setLinks };
};
