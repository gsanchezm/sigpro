import { useCallback, useEffect, useRef, useState } from 'react';
import { formatTrace } from '@sigpro/shared';

export interface Resource<T> {
  readonly data: T | null;
  /** Carga inicial o recarga en curso (con datos previos a la vista: `data` no se vacía al recargar). */
  readonly loading: boolean;
  /** Traza HTTP del último error (`GET /api/x → 503 …`), o un texto genérico; `null` si no hay error. */
  readonly error: string | null;
  readonly reload: () => void;
}

/**
 * Carga un recurso al montar y cada vez que cambian las dependencias. Solo cuenta la última petición (si el usuario
 * cambia de filtro mientras otra respuesta viaja, la antigua se descarta). Mismo patrón que los hooks de datos de la web.
 */
export const useResource = <T>(load: () => Promise<T>, deps: readonly unknown[]): Resource<T> => {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);
  const sequence = useRef(0);
  const loader = useRef(load);
  loader.current = load;

  useEffect(() => {
    sequence.current += 1;
    const mine = sequence.current;
    setLoading(true);
    loader
      .current()
      .then((value) => {
        if (mine !== sequence.current) return;
        setData(value);
        setError(null);
      })
      .catch((failure: unknown) => {
        if (mine !== sequence.current) return;
        setError(formatTrace(failure) || 'error');
      })
      .finally(() => {
        if (mine === sequence.current) setLoading(false);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- las dependencias las decide quien llama
  }, [...deps, version]);

  const reload = useCallback(() => setVersion((current) => current + 1), []);
  return { data, loading, error, reload };
};
