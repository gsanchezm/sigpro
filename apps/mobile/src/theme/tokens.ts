// Tokens del design system «1a Ciruela» (docs/design-system.md): los mismos nombres y valores que las variables CSS de la web
// (`[data-theme="light|dark"]` en `apps/web/src/styles/index.css`). Los componentes leen siempre de aquí; ningún hex fuera de este archivo.

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
  readonly accentHover: string;
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
  /** `box-shadow` de tarjetas (`--shadow`). */
  readonly shadow: string;
  /** `box-shadow` de popovers y hojas (`--shadow-pop`). */
  readonly shadowPop: string;
}

export const PALETTES: Readonly<Record<Scheme, Palette>> = {
  light: {
    bg: '#faf8fb',
    surface: '#ffffff',
    surface2: '#f4f0f6',
    border: '#e6dfea',
    borderStrong: '#cfc4d6',
    text: '#1d1424',
    text2: '#5b4f66',
    text3: '#6f627a',
    accent: '#7a2e6e',
    accentHover: '#632259',
    accentSoft: '#f3e3f0',
    onAccent: '#ffffff',
    danger: '#b93232',
    dangerSoft: '#fbe4e4',
    warn: '#8a5200',
    warnSoft: '#fbecd0',
    ok: '#1f7a4d',
    okSoft: '#dff3e7',
    info: '#3556b8',
    infoSoft: '#e4eafb',
    neutral: '#5b4f66',
    neutralSoft: '#f4f0f6',
    purple: '#6b3fc9',
    purpleSoft: '#ece4fb',
    scrim: 'rgba(29, 20, 36, 0.45)',
    shadow: '0 1px 2px rgba(29, 20, 36, 0.05), 0 4px 14px rgba(29, 20, 36, 0.06)',
    shadowPop: '0 12px 32px rgba(29, 20, 36, 0.16)',
  },
  dark: {
    bg: '#141017',
    surface: '#1c1721',
    surface2: '#261f2c',
    border: '#342b3b',
    borderStrong: '#4a3e54',
    text: '#f0eaf3',
    text2: '#b3a7bd',
    // Ajustado respecto al encargo (#85798f): no llegaba a AA sobre --surface (igual que en la web)
    text3: '#968c9f',
    accent: '#d68ac9',
    accentHover: '#e3a5d8',
    accentSoft: '#3a2137',
    // En oscuro el texto sobre el acento es oscuro
    onAccent: '#1d1424',
    danger: '#f0716b',
    dangerSoft: '#3a1f21',
    warn: '#e6a23c',
    warnSoft: '#3a2d14',
    ok: '#5fcf93',
    okSoft: '#16301f',
    info: '#8ea6f5',
    infoSoft: '#1d2747',
    neutral: '#b3a7bd',
    neutralSoft: '#261f2c',
    purple: '#b394f5',
    purpleSoft: '#2a2140',
    scrim: 'rgba(0, 0, 0, 0.6)',
    shadow: '0 1px 2px rgba(0, 0, 0, 0.4)',
    shadowPop: '0 12px 32px rgba(0, 0, 0, 0.55)',
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

/** Separaciones de la escala. `page` es el padding de pantalla y `block` la separación entre bloques (`--page-pad` / `--block-gap`, algo menores que en escritorio). */
export const SPACING = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, page: 20, block: 16, card: 16 } as const;

/** Radios: `sm` controles pequeños (`--radius-ctl-sm`), `md` botones e inputs (`--radius-ctl`), `lg` tarjetas (`--radius-card`). */
export const RADIUS = { sm: 8, md: 10, lg: 12, pill: 999 } as const;
