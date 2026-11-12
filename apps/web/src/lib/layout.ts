import { DESKTOP_MEDIA_QUERY, type Layout } from '@sigpro/shared';
import { useSyncExternalStore } from 'react';

/** Lo mínimo que se usa de un `MediaQueryList` (así se prueba sin navegador). */
export interface MediaSource {
  readonly matches: boolean;
  addEventListener(type: 'change', listener: () => void): void;
  removeEventListener(type: 'change', listener: () => void): void;
}

/** Atributo de `<html>` que expone el diseño activo: `data-layout="desktop|mobile"`. */
export const LAYOUT_ATTRIBUTE = 'data-layout';

/** Función pura: la consulta de escritorio se cumple → escritorio; si no, responsive (móvil y tablet). */
export const layoutOf = (source: Pick<MediaSource, 'matches'>): Layout => (source.matches ? 'desktop' : 'mobile');

const query = (): MediaSource => window.matchMedia(DESKTOP_MEDIA_QUERY);

/** Escribe `data-layout` en `<html>` y devuelve el diseño aplicado. */
export const applyLayout = (root: Pick<HTMLElement, 'setAttribute'>, source: Pick<MediaSource, 'matches'>): Layout => {
  const layout = layoutOf(source);
  root.setAttribute(LAYOUT_ATTRIBUTE, layout);
  return layout;
};

/**
 * Mantiene `<html data-layout>` al día mientras vive la página (también en `/login`, que no pasa por el AppShell).
 * `index.html` ya lo escribió antes de pintar; esto cubre los cambios de tamaño posteriores.
 */
export const startLayoutSync = (root: HTMLElement = document.documentElement, source: MediaSource = query()): (() => void) => {
  const sync = () => void applyLayout(root, source);
  sync();
  source.addEventListener('change', sync);
  return () => source.removeEventListener('change', sync);
};

const subscribe = (notify: () => void): (() => void) => {
  const source = query();
  source.addEventListener('change', notify);
  return () => source.removeEventListener('change', notify);
};

/**
 * Diseño activo: `desktop` (≥ 1024 px) o `mobile` (< 1024 px, móvil y tablet). Es la ÚNICA fuente del corte: todos los
 * componentes que cambian por tamaño preguntan aquí y React monta una variante u otra, nunca las dos.
 */
export const useLayout = (): Layout => useSyncExternalStore(subscribe, () => layoutOf(query()), () => 'desktop');

/** Atajo para los componentes que solo distinguen «responsive» de «escritorio». */
export const useIsMobileLayout = (): boolean => useLayout() === 'mobile';
