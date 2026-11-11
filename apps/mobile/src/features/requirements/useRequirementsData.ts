import type { RequirementListResponse } from '@sigpro/shared';
import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../../state/auth';

// Requisitos del programa. A diferencia de `useResource` conserva el error tal cual llega (un `ApiError`),
// para distinguir un 404 («Programa no encontrado») de un fallo genérico con traza y «Reintentar».

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
    setState({ status: 'loading', data: null, failure: null });
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
  return { ...state, reload };
};
