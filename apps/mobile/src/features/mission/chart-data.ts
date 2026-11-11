import type { MilestoneBar } from '@sigpro/shared';

// Geometría de las gráficas del panel (sin React): anchos y alturas en porcentaje o px, con las mismas reglas que la web.

export interface MilestoneBarView extends MilestoneBar {
  /** Largo de la barra (0–100 %) respecto al programa con más hitos: así las barras son comparables. */
  readonly widthPct: number;
  /** Parte cumplida dentro de la barra (0–100 %). */
  readonly donePct: number;
}

export const milestoneBarViews = (bars: readonly MilestoneBar[]): readonly MilestoneBarView[] => {
  const maxTotal = Math.max(1, ...bars.map((bar) => bar.total));
  return bars.map((bar) => ({
    ...bar,
    widthPct: Math.round((bar.total / maxTotal) * 100),
    donePct: bar.total === 0 ? 0 : Math.round((bar.done / bar.total) * 100),
  }));
};

/** Altura de cada columna en px: 0 si el valor es 0; mínimo 4 px para que una columna con datos se vea. */
export const columnHeights = <K extends string>(counts: Readonly<Record<K, number>>, maxPx: number): Readonly<Record<K, number>> => {
  const max = Math.max(1, ...Object.values<number>(counts));
  return Object.fromEntries(Object.entries<number>(counts).map(([key, value]) => [key, value === 0 ? 0 : Math.max(4, Math.round((value / max) * maxPx))])) as Record<K, number>;
};
