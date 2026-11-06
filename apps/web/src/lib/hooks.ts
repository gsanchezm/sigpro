import { useEffect, useState, useSyncExternalStore, type RefObject } from 'react';

export type Breakpoint = 'mobile' | 'tablet' | 'desktop';

// <640 móvil · 640–1099 tablet · ≥1100 escritorio (breakpoints del prototipo)
const MOBILE_MAX = 639;
const TABLET_MAX = 1099;

const classify = (width: number): Breakpoint => (width <= MOBILE_MAX ? 'mobile' : width <= TABLET_MAX ? 'tablet' : 'desktop');

const subscribe = (notify: () => void): (() => void) => {
  window.addEventListener('resize', notify);
  return () => window.removeEventListener('resize', notify);
};

export const useBreakpoint = (): Breakpoint => useSyncExternalStore(subscribe, () => classify(window.innerWidth), () => 'desktop');

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
