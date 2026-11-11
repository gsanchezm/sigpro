// Logo y avatares como <img> con SVG data-URI: así llevan `alt` y se localizan con getByAltText.

// Trazo de la "S" del logotipo (misma forma que public/icon.svg)
const S_PATH =
  'M42 20.5c-2.3-2.6-5.6-3.8-9.6-3.8-6 0-10 3.2-10 8 0 4.4 3 6.6 8.4 8l3.5.9c3 .8 4.3 1.8 4.3 3.7 0 2.2-2 3.6-5 3.6-3.1 0-5.4-1.1-7.2-3.6l-4.7 3.8c2.7 3.6 6.6 5.3 11.8 5.3 6.6 0 10.9-3.4 10.9-8.6 0-4.5-3-6.8-8.6-8.2l-3.4-.9c-2.7-.7-3.9-1.6-3.9-3.3 0-2 1.8-3.3 4.4-3.3 2.4 0 4.2.9 5.8 2.7z';

const toUri = (svg: string): string => `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;

// Un data-URI no puede leer variables CSS: estos valores repiten `--accent` y `--on-accent` de cada tema (docs/design-system.md)
export const LOGO_COLORS = {
  light: { background: '#7a2e6e', foreground: '#ffffff' },
  dark: { background: '#d68ac9', foreground: '#1d1424' },
} as const;

/** Logotipo cuadrado con la S (fondo `--accent` y trazo `--on-accent` del tema indicado). */
export const logoUri = ({ background, foreground }: { readonly background: string; readonly foreground: string }): string =>
  toUri(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="11.5" fill="${background}"/><g transform="translate(32 32) scale(.69) translate(-32.1 -31.85)"><path d="${S_PATH}" fill="${foreground}"/></g></svg>`,
  );

export type AvatarShape = 'square' | 'circle';
/** `soft` = fondo neutral-soft (tablas, menú); `solid` = fondo neutral con texto blanco (opciones de combobox). */
export type AvatarTone = 'soft' | 'solid';

// Colores por tema (un data-URI no puede leer variables CSS)
const AVATAR_COLORS = {
  light: { soft: { background: '#f4f0f6', foreground: '#5b4f66' }, solid: { background: '#5b4f66', foreground: '#ffffff' } },
  dark: { soft: { background: '#261f2c', foreground: '#b3a7bd' }, solid: { background: '#b3a7bd', foreground: '#1d1424' } },
} as const;

export interface AvatarOptions {
  readonly shape?: AvatarShape;
  readonly tone?: AvatarTone;
  /** Tamaño del avatar en px y tamaño de letra en px: el texto se escala al viewBox de 28. */
  readonly size?: number;
  readonly fontPx?: number;
}

/** Avatar de iniciales como SVG: cuadrado de radio 8 (circular en comboboxes). */
export const avatarUri = (initials: string, theme: 'light' | 'dark', options: AvatarOptions = {}): string => {
  const { shape = 'square', tone = 'soft', size = 28, fontPx = 11 } = options;
  const { background, foreground } = AVATAR_COLORS[theme][tone];
  const fontSize = ((fontPx * 28) / size).toFixed(2);
  const base = shape === 'circle' ? `<circle cx="14" cy="14" r="14" fill="${background}"/>` : `<rect width="28" height="28" rx="8" fill="${background}"/>`;
  return toUri(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 28 28">${base}<text x="14" y="14" text-anchor="middle" dominant-baseline="central" font-family="Geist Sans, system-ui, sans-serif" font-size="${fontSize}" font-weight="600" fill="${foreground}">${initials}</text></svg>`,
  );
};
