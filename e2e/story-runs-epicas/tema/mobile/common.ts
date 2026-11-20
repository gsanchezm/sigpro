import type { Locator, Page } from '@playwright/test';
import { TENANT_A } from '../../../story-runs/support/prepare';
import { ACTION, waitUntil, type Step } from '../../support/browser';
import { attrOne, type Tema } from '../web/common';

// Piezas comunes de las filas de la app móvil servida como web de Expo (390 × 844; NO es nativo). El control «Cambiar tema» de
// PublicHeader.tsx tiene el texto visible «Cambiar tema» y, como nombre accesible, «Cambiar tema (light)» o «(dark)» (su aria-label
// lleva el esquema activo): por eso se localiza por el comienzo del nombre y el tema se lee de ese sufijo. El tema del sistema se
// simula con emulateMedia. La app lee el tema guardado de forma asíncrona (theme.tsx): cada lectura espera con tolerancia.

/** Tolerancia de la prueba para la lectura asíncrona del tema guardado al abrir la pantalla (no es un plazo del producto). */
export const MOBILE_SETTLE_MS = 5_000;

/** Nota que acompaña a cada fila de la app móvil: el veredicto vale para Expo web, no para iOS ni Android nativo. */
export const EXPO_NOTE = 'Expo web a 390 × 844: no es nativo. El tema del sistema se simula con emulateMedia; el veredicto no vale para iOS ni Android.';

/** Control «Cambiar tema» de la cabecera pública (Acceso, registro, recuperación, términos, privacidad y ayuda). */
export const toggleOf = (page: Page): Locator => page.getByRole('button', { name: /^Cambiar tema/ });

/** Campo «Tenant de trabajo» de la pantalla de acceso (un único `fill`: el campo vuelve a `demo` si se vacía). */
export const tenantField = (page: Page): Locator => page.getByRole('textbox', { name: 'Tenant de trabajo', exact: true });

/** Tema que anuncia el control: el sufijo de su nombre accesible es el esquema activo de la app. */
export const schemeOf = async (page: Page): Promise<Tema | undefined> => {
  const label = await attrOne(toggleOf(page), 'aria-label');
  if (label === undefined) return undefined;
  if (/\((light|claro)\)$/.test(label)) return 'claro';
  if (/\((dark|oscuro)\)$/.test(label)) return 'oscuro';
  return undefined;
};

/** Abrir una pantalla pública y esperar su control de tema. */
export const openScreenSteps = (page: Page, route: string): Step[] => [
  [`abrir ${route}`, () => page.goto(route, ACTION)],
  [`ver el botón «Cambiar tema» de ${route}`, () => toggleOf(page).waitFor(ACTION)],
];

/** En /login, escribir alumno01 en «Tenant de trabajo» como indica la preparación de las historias. */
export const tenantSteps = (page: Page): Step[] => [['escribir alumno01 en «Tenant de trabajo»', () => tenantField(page).fill(TENANT_A, ACTION)]];

/** Pulsar «Cambiar tema» una vez. */
export const pressOnceSteps = (page: Page): Step[] => [['pulsar «Cambiar tema»', () => toggleOf(page).click(ACTION)]];

/** Espera a que el tema anunciado sea el dado (lectura asíncrona del tema guardado); devuelve si se llegó. */
export const settleScheme = (page: Page, tema: Tema): Promise<boolean> => waitUntil(async () => (await schemeOf(page)) === tema, MOBILE_SETTLE_MS).then((waited) => waited.reached);
