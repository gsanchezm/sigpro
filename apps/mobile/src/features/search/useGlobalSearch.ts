import { useCallback, useEffect, useState } from 'react';
import { useDebouncedValue } from '../../lib/debounce';
import { useAuth } from '../../state/auth';
import { SEARCH_DEBOUNCE_MS, canSearch, searchView, type SearchOutcome, type SearchView } from './view';

/**
 * Búsqueda global (`GET /api/search?q=`): la petición sale cuando el texto lleva 250 ms quieto y tiene al menos 2 caracteres,
 * y solo cuenta la respuesta a la consulta actual (una anterior que llega tarde se descarta). Devuelve qué enseñar
 * (`searchView`) y `retry`, que vuelve a pedir la consulta actual tras un error.
 */
export const useGlobalSearch = (text: string): { readonly view: SearchView; readonly retry: () => void } => {
  const { api } = useAuth();
  const debounced = useDebouncedValue(text.trim(), SEARCH_DEBOUNCE_MS);
  const [outcome, setOutcome] = useState<SearchOutcome | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!canSearch(debounced)) {
      setOutcome(null);
      return;
    }
    let alive = true;
    api.search.global(debounced).then(
      (response) => alive && setOutcome({ query: debounced, groups: response.groups }),
      () => alive && setOutcome({ query: debounced, failed: true }),
    );
    return () => {
      alive = false;
    };
  }, [api, debounced, attempt]);

  const retry = useCallback(() => {
    setOutcome(null);
    setAttempt((current) => current + 1);
  }, []);

  return { view: searchView({ text, debounced, outcome }), retry };
};
