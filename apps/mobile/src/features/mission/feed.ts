import { FEED_MAX_ITEMS, prependEvent, type MissionEventDto } from '@sigpro/shared';

// Feed del panel de misión: reglas puras (sin React). El feed muestra primero lo más reciente, sin repetidos y con tope.

/** Reduce un evento recibido en vivo al anillo: entra el primero y el anillo se recorta a 50. */
export const pushLiveEvent = (ring: readonly MissionEventDto[], event: MissionEventDto): readonly MissionEventDto[] => prependEvent(ring, event, FEED_MAX_ITEMS);

/** Une el anillo en vivo con el historial del resumen: sin repetidos, el más reciente primero, máximo 50. */
export const mergeFeed = (live: readonly MissionEventDto[], recent: readonly MissionEventDto[], max = FEED_MAX_ITEMS): readonly MissionEventDto[] => {
  const byId = new Map<string, MissionEventDto>();
  [...recent, ...live].forEach((event) => byId.set(event.id, event));
  return Array.from(byId.values())
    .sort((a, b) => b.seq - a.seq)
    .slice(0, max);
};

/** Con el feed en pausa se congela en el último `seq` visto: lo posterior queda «en espera» y no se pinta. */
export const visibleFeed = (feed: readonly MissionEventDto[], pausedAtSeq: number | null): readonly MissionEventDto[] =>
  pausedAtSeq === null ? feed : feed.filter((event) => event.seq <= pausedAtSeq);

/** Eventos recibidos durante la pausa (se muestran al reanudar). */
export const bufferedCount = (feed: readonly MissionEventDto[], pausedAtSeq: number | null): number =>
  pausedAtSeq === null ? 0 : feed.filter((event) => event.seq > pausedAtSeq).length;
