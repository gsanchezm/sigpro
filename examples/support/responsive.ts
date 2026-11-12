import type { Page } from '@playwright/test';

// SIGPRO tiene UN solo corte de diseño: por debajo de 1024 px (móvil y tablet) se monta la variante RESPONSIVE de cada
// familia de componentes; desde 1024 px, la de escritorio. React monta una u otra, nunca las dos a la vez.
//
//   - Los data-testid de escritorio no cambian. La variante responsive es SIEMPRE «<id de escritorio>-mobile»,
//     también en los dinámicos: `programs-row-PRG-004` → `programs-row-PRG-004-mobile`.
//   - Los campos de formulario, los diálogos, los toasts, el asistente de alta y toda la pantalla de acceso NO cambian de id.
//
// Con `getByRole` + nombre accesible casi no hace falta saber en qué ancho estás; con `getByTestId` sí: ahí entra `tid()`.

/** Ancho (px) desde el que SIGPRO es «escritorio». */
export const BREAKPOINT_PX = 1024;

/** ¿Es responsive un ancho de ventana? */
export const isResponsiveWidth = (width: number): boolean => width < BREAKPOINT_PX;

/**
 * ¿Es responsive el viewport ACTUAL de la página? Úsalo (en vez de la fixture `isResponsive`) si cambias el tamaño dentro del test:
 * la fixture se calcula una sola vez, al empezar.
 *
 * Se decide por el ANCHO de la ventana y no leyendo `<html data-layout>`: si la app se equivocase de diseño, un test que leyera
 * ese atributo le daría la razón en lugar de detectar el fallo.
 */
export const isResponsiveNow = (page: Page): boolean => isResponsiveWidth(page.viewportSize()?.width ?? BREAKPOINT_PX);

/** `tid('programs-new', true)` → `programs-new-mobile`; con `false`, el id de escritorio tal cual. */
export const tid = (id: string, responsive: boolean): string => (responsive ? `${id}-mobile` : id);
