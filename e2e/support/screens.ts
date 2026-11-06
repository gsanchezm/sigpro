import type { Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

export const SCREENS_DIR = join(import.meta.dirname, '..', '..', 'docs', 'screens');

export const THEMES = ['light', 'dark'] as const;
export type ThemeName = (typeof THEMES)[number];

export const VIEWPORTS = [
  { width: 1440, height: 900 },
  { width: 390, height: 844 },
] as const;

/** Guarda una captura a página completa en docs/screens/<nombre>-<tema>-<ancho>.png. */
export const capture = async (page: Page, name: string, theme: ThemeName): Promise<string> => {
  mkdirSync(SCREENS_DIR, { recursive: true });
  const width = page.viewportSize()?.width ?? 0;
  const file = join(SCREENS_DIR, `${name}-${theme}-${width}.png`);
  // Deja terminar animaciones de entrada (toast, popover) antes de capturar
  await page.waitForTimeout(350);
  await page.screenshot({ path: file, fullPage: true });
  return file;
};

/** Prepara tema, idioma y aviso de cookies antes de cargar la app. */
export const prepareStorage = async (page: Page, theme: ThemeName, options: { cookies?: boolean } = {}): Promise<void> => {
  await page.addInitScript(
    ({ themeName, withCookies }) => {
      localStorage.setItem('sigpro.theme', themeName);
      localStorage.setItem('sigpro.lang', 'es');
      if (withCookies) localStorage.setItem('sigpro.cookies', 'seen');
    },
    { themeName: theme, withCookies: options.cookies ?? true },
  );
};
