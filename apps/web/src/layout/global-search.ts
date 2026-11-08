import { SEARCH_MIN_CHARS, type SearchGroupDto, type SearchItemDto } from '@sigpro/shared';

// Reglas puras de la búsqueda global de la cabecera (sin React, con tests).

export interface FlatResult {
  readonly kind: SearchGroupDto['kind'];
  readonly item: SearchItemDto;
}

/** Los resultados en el orden en que se recorren con ↑ ↓ (grupo a grupo, tal como se ven). */
export const flattenGroups = (groups: readonly SearchGroupDto[]): readonly FlatResult[] => groups.flatMap((group) => group.items.map((item) => ({ kind: group.kind, item })));

/** Coincidencias totales (la suma de `total` de cada grupo, no solo los ítems enseñados). */
export const totalResults = (groups: readonly SearchGroupDto[]): number => groups.reduce((sum, group) => sum + group.total, 0);

/** ¿Hay que pedir resultados al servidor? Con menos de 2 caracteres solo se avisa del mínimo. */
export const canSearch = (text: string): boolean => text.trim().length >= SEARCH_MIN_CHARS;

/** En `/programs` la búsqueda de la cabecera filtra la tabla (`?q=`) y no abre popover. */
export const isProgramsRoute = (pathname: string): boolean => pathname === '/programs';

/** El popover se ve con la lista abierta, fuera de `/programs` y con algo escrito. */
export const popoverVisible = (open: boolean, text: string, pathname: string): boolean => open && !isProgramsRoute(pathname) && text.trim().length > 0;
