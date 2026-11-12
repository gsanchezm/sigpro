import type { NcDetailDto } from '@sigpro/shared';
import { useCallback, useEffect, useState } from 'react';
import { useResource } from '../../lib/resource';
import { useAuth } from '../../state/auth';
import { toListQuery, type NcFilters } from './filters';

/** Espera a que se deje de escribir antes de pedir la lista al servidor. */
export const SEARCH_DEBOUNCE_MS = 250;

/** Valor que solo cambia cuando deja de moverse durante `delay` ms. */
export const useDebouncedValue = <T>(value: T, delay: number): T => {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
};

/** Tablero: la lista filtrada por el servidor. Solo cuenta la última petición (`useResource`). */
export const useNcBoard = (filters: NcFilters) => {
  const { api } = useAuth();
  const { q, severity } = filters;
  return useResource(() => api.nc.list(toListQuery({ q, severity })), [api, q, severity]);
};

/**
 * Detalle de una NC. Tiene estado propio (no el de `useResource`) porque conserva el error HTTP completo (404, 403…)
 * y porque el detalle se corrige en local tras comentar o mover, sin volver a pedirlo.
 */
export const useNcDetail = (code: string) => {
  const { api } = useAuth();
  const [detail, setDetail] = useState<NcDetailDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [failure, setFailure] = useState<{ readonly error: unknown } | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let current = true;
    setLoading(true);
    setFailure(null);
    api.nc
      .get(code)
      .then(
        (value) => {
          if (current) setDetail(value);
        },
        (error: unknown) => {
          if (current) setFailure({ error });
        },
      )
      .finally(() => {
        if (current) setLoading(false);
      });
    return () => {
      current = false;
    };
  }, [api, code, attempt]);

  const retry = useCallback(() => setAttempt((count) => count + 1), []);
  return { detail, setDetail, loading, failure, retry };
};

/** Programas para el alta: los 100 primeros por código, como la web (`pageSize: 100`). Con error, `error` trae la traza y `reload` reintenta. */
export const useNcPrograms = () => {
  const { api } = useAuth();
  return useResource(async () => (await api.programs.list({ sort: 'code', dir: 'asc', pageSize: 100 })).items.map(({ code, name }) => ({ code, name })), [api]);
};

/** Personas del tenant para la asignación (`api.users.owners`). */
export const useNcOwners = () => {
  const { api } = useAuth();
  return useResource(() => api.users.owners(), [api]);
};
