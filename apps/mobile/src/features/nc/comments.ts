import type { Lang } from '@sigpro/shared';

// Fecha y hora de un comentario. La API envía marcas ISO completas (`2026-02-01T10:00:00.000Z`); `formatDate` de
// `@sigpro/shared` solo admite `YYYY-MM-DD`, así que aquí se formatea la marca completa con las mismas configuraciones
// regionales que `formatDate`.

const LOCALE: Readonly<Record<Lang, string>> = { es: 'es-ES', en: 'en-GB' };

export const commentTime = (iso: string, lang: Lang): string => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString(LOCALE[lang], { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};
