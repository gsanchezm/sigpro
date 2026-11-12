import { useEffect, useState } from 'react';

/** Valor que solo cambia cuando deja de moverse durante `delay` ms (el campo de búsqueda pide al servidor con el valor ya quieto). */
export const useDebouncedValue = <T>(value: T, delay: number): T => {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
};
