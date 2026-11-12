import { expect, type Locator, type Page } from '@playwright/test';

/** Un solo corte: < 1024 px es el diseño responsive (móvil y tablet); ≥ 1024 px, escritorio. */
export const BREAKPOINT_PX = 1024;

/**
 * ¿Es responsive el viewport actual? Sale del ANCHO de la ventana, nunca de `<html data-layout>`: si la app se equivocara
 * al calcular el diseño, una prueba que leyera el atributo daría la razón a la app en lugar de detectar el fallo.
 */
export const isResponsive = (page: Page): boolean => (page.viewportSize()?.width ?? 0) < BREAKPOINT_PX;

/** `programs-new` → `programs-new-mobile` en el diseño responsive; el mismo id en escritorio. */
export const tid = (id: string, responsive: boolean): string => (responsive ? `${id}-mobile` : id);

export const byTid = (page: Page, id: string, responsive = isResponsive(page)): Locator => page.getByTestId(tid(id, responsive));

/** La variante esperada existe y la contraria NO está en el DOM (cada id de escritorio con su pareja `-mobile`). */
export const expectOnlyExpectedVariant = async (page: Page, desktopIds: readonly string[]): Promise<void> => {
  const responsive = isResponsive(page);
  for (const id of desktopIds) {
    await expect(page.getByTestId(tid(id, responsive)).first(), `falta la variante esperada de ${id}`).toBeVisible();
    await expect(page.getByTestId(tid(id, !responsive)), `la variante contraria de ${id} no debería existir`).toHaveCount(0);
  }
};

/** Ids que solo existen en una de las dos variantes (sin pareja): presentes en la suya y ausentes en la otra. */
export const expectOnlyIn = async (page: Page, ids: readonly string[], layout: 'desktop' | 'responsive'): Promise<void> => {
  const here = (isResponsive(page) ? 'responsive' : 'desktop') === layout;
  for (const id of ids) {
    if (here) await expect(page.getByTestId(id).first(), `${id} debería estar`).toBeVisible();
    else await expect(page.getByTestId(id), `${id} no debería existir en este diseño`).toHaveCount(0);
  }
};

/** Abre el drawer de navegación en responsive; en escritorio no hace nada (la barra lateral ya está). */
export const openNavigation = async (page: Page): Promise<void> => {
  if (!isResponsive(page)) return;
  await page.getByTestId('layout-sidebar-toggle-mobile').click();
  await expect(page.getByTestId('layout-sidebar-mobile')).toBeVisible();
};

/** Cambia de pestaña en el detalle de un programa: una pestaña (`tab`) en escritorio, una opción del `<select>` en responsive. */
export const openProgramTab = async (page: Page, name: 'Resumen' | 'Hitos' | 'Requisitos'): Promise<void> => {
  if (isResponsive(page)) await page.getByLabel('Detalle del programa').selectOption({ label: name });
  else await page.getByRole('tab', { name }).click();
};

/** Tenants de los specs responsive que ESCRIBEN datos: uno por proyecto para que dos workers no se pisen. */
export const WRITE_TENANT: Readonly<Record<string, string>> = { desktop: 'alumno22', tablet: 'alumno24', mobile: 'alumno25' };
