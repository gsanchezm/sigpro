import { useCallback, useEffect, useRef, useState } from 'react';
import { SEARCH_DEBOUNCE_MS } from './params';

export interface SearchDraft {
  /** Lo que se ve en el buscador. */
  readonly draft: string;
  readonly setDraft: (value: string) => void;
  /** Vacía el buscador sin esperar al debounce (al limpiar filtros). */
  readonly reset: () => void;
}

/**
 * Buscador con estado en la URL: `draft` es lo que el usuario ve y `pushed` recuerda el último texto escrito en ella. Tras 250 ms
 * sin teclear, `commit` lleva el texto a la URL; así la URL que vuelve tras un `setParams` no pisa lo que sigue escribiendo. Si la
 * URL cambia por otro lado (atrás/adelante, «Limpiar filtros»), el buscador la sigue. `commit` debe ser estable.
 */
export const useSearchDraft = (urlValue: string, commit: (value: string) => void): SearchDraft => {
  const [draft, setDraft] = useState(urlValue);
  const pushed = useRef(urlValue);

  useEffect(() => {
    if (urlValue === pushed.current) return;
    pushed.current = urlValue;
    setDraft(urlValue);
  }, [urlValue]);

  useEffect(() => {
    const value = draft.trim();
    if (value === pushed.current) return;
    const timer = setTimeout(() => {
      pushed.current = value;
      commit(value);
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [draft, commit]);

  const reset = useCallback(() => {
    pushed.current = '';
    setDraft('');
  }, []);

  return { draft, setDraft, reset };
};
