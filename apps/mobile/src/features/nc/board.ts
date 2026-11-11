import { NC_STATES, groupByState, isNcOpen, richTextToPlain, type NcState } from '@sigpro/shared';

// Reglas puras del tablero (sin React Native): columnas, contadores y resumen de la descripción.

export interface BoardColumn<T extends { readonly state: NcState }> {
  readonly state: NcState;
  readonly cards: readonly T[];
}

/** Cinco columnas en el orden del tablero, aunque alguna esté vacía; cada una conserva el orden recibido. */
export const boardColumns = <T extends { readonly state: NcState }>(items: readonly T[]): readonly BoardColumn<T>[] => {
  const grouped = groupByState(items);
  return NC_STATES.map((state) => ({ state, cards: grouped[state] }));
};

/** NC abiertas: no cerradas ni rechazadas (mismo criterio que el KPI del panel de misión). */
export const countOpen = (items: readonly { readonly state: NcState }[]): number => items.filter((item) => isNcOpen(item.state)).length;

/** Nombre accesible de una columna: «En análisis · 2». */
export const columnLabel = (stateLabel: string, count: number): string => `${stateLabel} · ${count}`;

/** Descripción en texto plano y recortada con puntos suspensivos (la tarjeta no muestra el HTML del editor). */
export const summarize = (html: string, max: number): string => {
  const plain = richTextToPlain(html);
  return plain.length <= max ? plain : `${plain.slice(0, max - 1).trimEnd()}…`;
};
