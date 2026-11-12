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
  // Ajusta el viewport a la altura del contenido: así tabbar y botón flotante (fixed/sticky) quedan al final de la captura.
  // Excepción: un menú o una lista desplegable abiertos se cierran al redimensionar la ventana (ActionMenu), y desde el
  // rediseño Ciruela las páginas (con tarjetas de métricas) superan los 900 px de alto: en ese caso se captura solo el viewport.
  const original = page.viewportSize();
  const contentHeight = await page.evaluate(() => document.documentElement.scrollHeight);
  const popoverOpen = await page.evaluate(() => document.querySelector('[role="menu"], [role="listbox"]') !== null);
  const resize = Boolean(original) && contentHeight > (original?.height ?? 0) && !popoverOpen;
  if (original && resize) await page.setViewportSize({ width: original.width, height: contentHeight });
  await page.waitForTimeout(150);
  await page.screenshot({ path: file });
  if (original && resize) await page.setViewportSize(original);
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

/**
 * Captura de la app móvil: la pantalla visible (390 × 844), no la página entera. En la app móvil el contenido hace scroll
 * dentro de la propia pantalla (`ScrollView`), así que la captura de viewport es lo que ve el usuario.
 * Guarda `docs/screens/mobile-<nombre>-<tema>-390.png`.
 */
export const captureMobile = async (page: Page, name: string, theme: ThemeName): Promise<string> => {
  mkdirSync(SCREENS_DIR, { recursive: true });
  const file = join(SCREENS_DIR, `mobile-${name}-${theme}-390.png`);
  // Deja terminar animaciones de entrada (toast, hoja inferior) antes de capturar
  await page.waitForTimeout(400);
  await page.screenshot({ path: file });
  return file;
};
