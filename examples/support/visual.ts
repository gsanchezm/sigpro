import type { Page } from '@playwright/test';

// Ayudas para pruebas visuales y de layout (sesión 11). Lo común a varios archivos va aquí; lo específico, en el spec.

export type ThemeName = 'light' | 'dark';

/**
 * Fija el tema y el idioma ANTES de que cargue la app: `index.html` lee `sigpro.theme` y aplica `data-theme` en el primer
 * pintado. `addInitScript` se ejecuta en cada navegación, así que el tema no cambia aunque la página se recargue.
 */
export const forceTheme = async (page: Page, theme: ThemeName): Promise<void> => {
  await page.addInitScript((value: string) => {
    localStorage.setItem('sigpro.theme', value);
    localStorage.setItem('sigpro.lang', 'es');
  }, theme);
};

/** Opciones de captura estables: sin animaciones y sin el cursor de texto parpadeando. */
export const SCREENSHOT_OPTIONS = { animations: 'disabled', caret: 'hide' } as const;

/** Opciones de `toHaveScreenshot`: las de captura más una tolerancia pequeña de píxeles. */
export const SNAPSHOT_OPTIONS = { ...SCREENSHOT_OPTIONS, maxDiffPixelRatio: 0.02 } as const;

/** Espera a que las fuentes web estén cargadas: una captura antes de tiempo cambia la tipografía. */
export const settle = (page: Page): Promise<void> =>
  page.evaluate(async () => {
    await document.fonts.ready;
  });

/** Píxeles que la página se sale por los lados (0 = sin scroll horizontal de la página). Los scrolls internos no cuentan. */
export const horizontalOverflow = (page: Page): Promise<number> =>
  page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
