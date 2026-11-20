// Piezas comunes de las filas de la app móvil servida como web de Expo (390 × 844; NO es nativa). Reutiliza las de `../web/common.ts`.
// Los campos de Expo web son `textbox` con su nombre accesible (la etiqueta); el selector de idioma es un `combobox` que abre una
// hoja con dos `radio` («ES» y «EN»). La preferencia de idioma se lee de forma asíncrona: quien mira espera con plazo.

import type { Locator, Page } from '@playwright/test';
import { TENANT_A } from '../../../story-runs/support/prepare';
import { ACTION, type Step } from '../../support/browser';
import { ACCESS, heading1, type Lang } from '../web/common';

export const textbox = (page: Page, name: string): Locator => page.getByRole('textbox', { name, exact: true });
export const button = (page: Page, name: string): Locator => page.getByRole('button', { name, exact: true });
export const combo = (page: Page, name: string): Locator => page.getByRole('combobox', { name, exact: true });

/** Abre Acceso de la app móvil, espera su título en español y escribe «alumno01» en «Tenant de trabajo» (un solo `fill`). */
export const enterAccessMobile = (page: Page): readonly Step[] => [
  ['abrir /login', () => page.goto('/login', ACTION)],
  ['ver el título «Iniciar sesión»', () => heading1(page, ACCESS.es.title).waitFor(ACTION)],
  [`escribir «${ACCESS.es.tenant}» con ${TENANT_A}`, () => textbox(page, ACCESS.es.tenant).fill(TENANT_A, ACTION)],
];

/** Elige «ES» o «EN» en el selector de idioma: abre el `combobox` y toca la opción (un `radio`). */
export const pickLangMobile = (page: Page, from: string, lang: Lang): readonly Step[] => [
  [`abrir el selector «${from}»`, () => combo(page, from).click(ACTION)],
  [`elegir «${lang.toUpperCase()}»`, () => page.getByRole('radio', { name: lang.toUpperCase(), exact: true }).filter({ visible: true }).click(ACTION)],
];

/** Entra en Acceso de la app móvil con la cuenta de la fila; si el idioma es inglés, lo elige tras escribir el tenant y antes de entrar. */
export const signInMobile = (page: Page, lang: Lang, email: string, password: string): readonly Step[] => [
  ...enterAccessMobile(page),
  ...(lang === 'en' ? pickLangMobile(page, ACCESS.es.language, 'en') : []),
  [`escribir «${ACCESS[lang].email}»`, () => textbox(page, ACCESS[lang].email).fill(email, ACTION)],
  [`escribir «${ACCESS[lang].password}»`, () => textbox(page, ACCESS[lang].password).fill(password, ACTION)],
  [`pulsar «${ACCESS[lang].submit}»`, () => button(page, ACCESS[lang].submit).click(ACTION)],
  ['llegar a /programs', () => page.waitForURL(/\/programs/, ACTION)],
];
