import { useEffect, useState, type RefObject } from 'react';

// El diseño (escritorio / responsive) vive en ./layout: un solo corte a 1024 px

/** Cierra al pulsar Escape o al hacer clic fuera de los elementos indicados. */
export const useDismiss = (open: boolean, refs: readonly RefObject<HTMLElement | null>[], onClose: () => void): void => {
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && onClose();
    const onPointer = (event: MouseEvent) => {
      const target = event.target as Node;
      if (refs.every((ref) => !ref.current?.contains(target))) onClose();
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onPointer);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onPointer);
    };
    // refs es un array nuevo en cada render; solo importa su contenido estable
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, onClose]);
};

/** Devuelve `true` solo si `active` lleva encendido más de `delayMs` (evita parpadeos de skeleton). */
export const useDelayedFlag = (active: boolean, delayMs: number): boolean => {
  const [delayed, setDelayed] = useState(false);
  useEffect(() => {
    if (!active) {
      setDelayed(false);
      return;
    }
    const timer = setTimeout(() => setDelayed(true), delayMs);
    return () => clearTimeout(timer);
  }, [active, delayMs]);
  return delayed;
};

export const useDebouncedValue = <T>(value: T, delayMs: number): T => {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
};
