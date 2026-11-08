import { FEED_MAX_ITEMS, type MilestoneBar, type MissionEventDto } from '@sigpro/shared';

// Reglas puras del panel de misión (feed y geometría de las gráficas): sin React, con tests.

/** Une los eventos recibidos en vivo con el historial del resumen: sin repetidos, el más reciente primero, máx. 50. */
export const mergeFeed = (live: readonly MissionEventDto[], recent: readonly MissionEventDto[], max = FEED_MAX_ITEMS): readonly MissionEventDto[] => {
  const byId = new Map<string, MissionEventDto>();
  [...recent, ...live].forEach((event) => byId.set(event.id, event));
  return Array.from(byId.values())
    .sort((a, b) => b.seq - a.seq)
    .slice(0, max);
};

/** Con el feed en pausa se congela en el último `seq` visto; los eventos posteriores quedan «en espera». */
export const visibleFeed = (feed: readonly MissionEventDto[], pausedAtSeq: number | null): readonly MissionEventDto[] =>
  pausedAtSeq === null ? feed : feed.filter((event) => event.seq <= pausedAtSeq);

export const bufferedCount = (feed: readonly MissionEventDto[], pausedAtSeq: number | null): number => (pausedAtSeq === null ? 0 : feed.filter((event) => event.seq > pausedAtSeq).length);

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

/** Altura de cada columna en px (0 si el valor es 0; mínimo 4 px para que una columna con datos se vea). */
export const columnHeights = <K extends string>(counts: Readonly<Record<K, number>>, maxPx: number): Readonly<Record<K, number>> => {
  const max = Math.max(1, ...Object.values<number>(counts));
  return Object.fromEntries(Object.entries<number>(counts).map(([key, value]) => [key, value === 0 ? 0 : Math.max(4, Math.round((value / max) * maxPx))])) as Record<K, number>;
};
