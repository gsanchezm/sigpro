// Logo y avatares como <img> con SVG data-URI: así llevan `alt` y se localizan con getByAltText.

// Trazo de la "S" del logotipo (misma forma que public/icon.svg)
const S_PATH =
  'M42 20.5c-2.3-2.6-5.6-3.8-9.6-3.8-6 0-10 3.2-10 8 0 4.4 3 6.6 8.4 8l3.5.9c3 .8 4.3 1.8 4.3 3.7 0 2.2-2 3.6-5 3.6-3.1 0-5.4-1.1-7.2-3.6l-4.7 3.8c2.7 3.6 6.6 5.3 11.8 5.3 6.6 0 10.9-3.4 10.9-8.6 0-4.5-3-6.8-8.6-8.2l-3.4-.9c-2.7-.7-3.9-1.6-3.9-3.3 0-2 1.8-3.3 4.4-3.3 2.4 0 4.2.9 5.8 2.7z';

const toUri = (svg: string): string => `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;

/** Logotipo cuadrado con la S (fondo `--accent` del tema indicado). */
export const logoUri = (background: string): string =>
  toUri(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="11.5" fill="${background}"/><g transform="translate(32 32) scale(.69) translate(-32.1 -31.85)"><path d="${S_PATH}" fill="#fff"/></g></svg>`);

export type AvatarShape = 'square' | 'circle';

// Colores `--neutral-soft` / `--text-2` por tema (un data-URI no puede leer variables CSS)
const AVATAR_COLORS = {
  light: { background: '#e6eaf0', foreground: '#4b5665' },
  dark: { background: '#27303c', foreground: '#a3afbe' },
} as const;

/** Avatar de iniciales como SVG: cuadrado radio 4 (circular en comboboxes). */
export const avatarUri = (initials: string, theme: 'light' | 'dark', shape: AvatarShape = 'square'): string => {
  const { background, foreground } = AVATAR_COLORS[theme];
  const base = shape === 'circle' ? `<circle cx="14" cy="14" r="14" fill="${background}"/>` : `<rect width="28" height="28" rx="4" fill="${background}"/>`;
  return toUri(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 28 28">${base}<text x="14" y="14" text-anchor="middle" dominant-baseline="central" font-family="IBM Plex Sans, system-ui, sans-serif" font-size="11" font-weight="600" fill="${foreground}">${initials}</text></svg>`,
  );
};
