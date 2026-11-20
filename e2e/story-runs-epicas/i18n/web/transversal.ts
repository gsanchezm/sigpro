// Piezas de las historias TRANSVERSALES (US-I18N-001 y 002): una sola historia con filas de la web (1440 px) y de la app móvil
// servida como web de Expo (390 px, NO nativa). Cada fila elige su plataforma por la celda «plataforma»; la fila de la app móvil
// necesita Expo levantado en MOBILE_URL (si no responde, la fila no se ejecuta aquí: `notExecutable` por entorno).

import type { Browser, BrowserContext, Page } from '@playwright/test';
import type { Step } from '../../support/browser';
import { enterAccessMobile, pickLangMobile, signInMobile } from '../mobile/common';
import { enterAccessWeb, phoneContext, pickLangWeb, signInWeb, webContext, type Lang } from './common';

export type Platform = 'web' | 'movil';

/** La celda «plataforma» de los Esquemas: `web` o `app móvil`. */
export const PLATFORMS: ReadonlyMap<string, Platform> = new Map<string, Platform>([
  ['web', 'web'],
  ['app móvil', 'movil'],
]);

/** Contexto nuevo de la plataforma de la fila: idioma del sistema propio, almacenamiento vacío y, en la web, la preferencia de cookies. */
export const openContext = (browser: Browser, platform: Platform, locale: string, withCookies: boolean): Promise<BrowserContext> =>
  platform === 'web' ? webContext(browser, locale, withCookies) : phoneContext(browser, locale);

export const enterAccessFor = (platform: Platform, page: Page): readonly Step[] => (platform === 'web' ? enterAccessWeb(page) : enterAccessMobile(page));

export const pickLangFor = (platform: Platform, page: Page, from: string, lang: Lang): readonly Step[] =>
  platform === 'web' ? [pickLangWeb(page, from, lang)] : pickLangMobile(page, from, lang);

export const signInFor = (platform: Platform, page: Page, lang: Lang, email: string, password: string): readonly Step[] =>
  platform === 'web' ? signInWeb(page, lang, email, password) : signInMobile(page, lang, email, password);
