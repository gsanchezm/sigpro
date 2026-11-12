// Scroll: cuándo una pantalla ha llegado (casi) al final. Lo usa `Screen` para la carga continua de listas largas
// (el feed de Auditoría). Sin imports de react-native: se prueba con Vitest en Node (`scroll.test.ts`).

/** Margen (px) antes del final del scroll a partir del cual se pide la página siguiente. */
export const NEAR_END_MARGIN = 240;

/** Frecuencia (ms) de los eventos de scroll: en react-native-web, sin ella no se emite ninguno. */
export const SCROLL_EVENT_THROTTLE_MS = 100;

export interface ScrollMetrics {
  /** Desplazamiento vertical actual, alto visible y alto total del contenido (px). */
  readonly offset: number;
  readonly viewport: number;
  readonly content: number;
}

/** ¿Quedan menos de `margin` px por debajo de lo visible? Con el contenido más corto que la ventana cuenta como final. */
export const isNearEnd = ({ offset, viewport, content }: ScrollMetrics, margin: number = NEAR_END_MARGIN): boolean => offset + viewport >= content - margin;
