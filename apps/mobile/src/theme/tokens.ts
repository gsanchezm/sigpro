// Tokens del design system (los mismos valores que las variables CSS de la web, `[data-theme="light|dark"]`).

export type Scheme = 'light' | 'dark';

export interface Palette {
  readonly bg: string;
  readonly surface: string;
  readonly surface2: string;
  readonly border: string;
  readonly borderStrong: string;
  readonly text: string;
  readonly text2: string;
  readonly text3: string;
  readonly accent: string;
  readonly accentSoft: string;
  readonly onAccent: string;
  readonly danger: string;
  readonly dangerSoft: string;
  readonly warn: string;
  readonly warnSoft: string;
  readonly ok: string;
  readonly okSoft: string;
  readonly info: string;
  readonly infoSoft: string;
  readonly neutral: string;
  readonly neutralSoft: string;
  readonly purple: string;
  readonly purpleSoft: string;
  readonly scrim: string;
}

export const PALETTES: Readonly<Record<Scheme, Palette>> = {
  light: {
    bg: '#f3f5f8',
    surface: '#ffffff',
    surface2: '#eef1f5',
    border: '#d5dbe3',
    borderStrong: '#b7c0cc',
    text: '#0f1620',
    text2: '#4b5665',
    text3: '#7a8594',
    accent: '#2f6fed',
    accentSoft: '#e3ecfd',
    onAccent: '#ffffff',
    danger: '#c62f2f',
    dangerSoft: '#fbe3e3',
    warn: '#8a5200',
    warnSoft: '#fdeccc',
    ok: '#1a7f4b',
    okSoft: '#d9f3e4',
    info: '#2459c7',
    infoSoft: '#e3ecfd',
    neutral: '#4b5665',
    neutralSoft: '#e6eaf0',
    purple: '#6b3fc9',
    purpleSoft: '#ece4fb',
    scrim: 'rgba(15, 22, 32, 0.45)',
  },
  dark: {
    bg: '#0d1117',
    surface: '#151b24',
    surface2: '#1c242f',
    border: '#2a3441',
    borderStrong: '#3b4756',
    text: '#e8edf3',
    text2: '#a3afbe',
    text3: '#6f7c8c',
    accent: '#5b8def',
    accentSoft: '#1b2a47',
    onAccent: '#ffffff',
    danger: '#f0716b',
    dangerSoft: '#3a1f21',
    warn: '#e6a23c',
    warnSoft: '#3a2d14',
    ok: '#49c27f',
    okSoft: '#14311f',
    info: '#7ea3f3',
    infoSoft: '#1b2a47',
    neutral: '#a3afbe',
    neutralSoft: '#27303c',
    purple: '#b394f5',
    purpleSoft: '#2a2140',
    scrim: 'rgba(0, 0, 0, 0.6)',
  },
};

export type Tone = 'neutral' | 'info' | 'ok' | 'warn' | 'danger' | 'purple';

/** Color de texto y de fondo de un tono (badges, franjas de severidad…). Mapa de despacho, sin `switch`. */
export const toneColors = (palette: Palette, tone: Tone): { readonly fg: string; readonly bg: string } => {
  const map: Readonly<Record<Tone, { readonly fg: string; readonly bg: string }>> = {
    neutral: { fg: palette.neutral, bg: palette.neutralSoft },
    info: { fg: palette.info, bg: palette.infoSoft },
    ok: { fg: palette.ok, bg: palette.okSoft },
    warn: { fg: palette.warn, bg: palette.warnSoft },
    danger: { fg: palette.danger, bg: palette.dangerSoft },
    purple: { fg: palette.purple, bg: palette.purpleSoft },
  };
  return map[tone];
};

export const SPACING = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 } as const;
export const RADIUS = { sm: 4, md: 6, lg: 10, pill: 999 } as const;
