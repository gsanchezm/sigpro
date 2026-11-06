import type { Lang } from './i18n';

const LOCALE: Readonly<Record<Lang, string>> = { es: 'es-ES', en: 'en-GB' };

/** Importe en euros sin decimales (formato del handoff: `1.230.000 €`). */
export const formatMoney = (amount: number, lang: Lang): string =>
  new Intl.NumberFormat(LOCALE[lang], { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(amount);

/** `YYYY-MM-DD` → `dd/mm/aaaa`; vacío → guion largo. */
export const formatDate = (iso: string | null | undefined, lang: Lang): string =>
  iso ? new Date(`${iso}T00:00:00`).toLocaleDateString(LOCALE[lang], { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—';

export const initials = (name: string): string =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word.charAt(0))
    .join('')
    .toUpperCase();

const PROGRESS_TITLE: Readonly<Record<Lang, string>> = { es: 'completado', en: 'complete' };

/** `title` de la barra de progreso: "11 % completado" (con espacio, para `getByTitle`). */
export const toProgressTitle = (percent: number, lang: Lang): string => `${percent} % ${PROGRESS_TITLE[lang]}`;
