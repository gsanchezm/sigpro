// Lógica pura de la búsqueda global del móvil (web: `global-search.ts` y `GlobalSearch.tsx`): el mínimo de caracteres, qué se
// ve en cada momento (pista, carga, error, vacío o resultados), los totales de cada grupo y a qué ruta móvil lleva cada resultado.
// Sin imports de react-native: se prueba con Vitest en Node (`view.test.ts`).
import { SEARCH_MIN_CHARS, type SearchGroupDto, type SearchGroupKind, type SearchItemDto } from '@sigpro/shared';

/** Retraso entre la última pulsación y la petición al servidor (igual que la web). */
export const SEARCH_DEBOUNCE_MS = 250;

/** ¿Hay que pedir resultados al servidor? Con menos de 2 caracteres (sin contar espacios de los extremos) solo se avisa del mínimo. */
export const canSearch = (text: string): boolean => text.trim().length >= SEARCH_MIN_CHARS;

/** Coincidencias totales (la suma de `total` de cada grupo, no solo los ítems enseñados). */
export const totalResults = (groups: readonly SearchGroupDto[]): number => groups.reduce((sum, group) => sum + group.total, 0);

/** Texto del total de un grupo: `5 / 24` si la API enseña menos ítems que coincidencias y el total a secas si los enseña todos (como la web). */
export const groupTotalText = (group: SearchGroupDto): string => (group.total > group.items.length ? `${group.items.length} / ${group.total}` : String(group.total));

/** Coincidencias de un grupo que no se enseñan: son las del «N más» bajo el grupo (0 si se enseñan todas). */
export const hiddenCount = (group: SearchGroupDto): number => Math.max(0, group.total - group.items.length);

/** Lo que la API contestó para una consulta: los grupos o el fallo. La consulta permite descartar una respuesta que ya no es la actual. */
export type SearchOutcome = { readonly query: string; readonly groups: readonly SearchGroupDto[]; readonly failed?: false } | { readonly query: string; readonly failed: true };

export interface SearchInput {
  /** Lo que hay escrito en el campo. */
  readonly text: string;
  /** El texto, ya con el retraso: la consulta que se pide al servidor. */
  readonly debounced: string;
  /** Última respuesta de la API (o `null` si no hay ninguna en vuelo ni terminada). */
  readonly outcome: SearchOutcome | null;
}

export type SearchView =
  /** Menos de 2 caracteres: «Escribe al menos 2 caracteres». */
  | { readonly kind: 'hint' }
  /** Escribiendo (el texto aún no se ha pedido) o con la petición en vuelo: «Buscando…». */
  | { readonly kind: 'loading' }
  | { readonly kind: 'error' }
  | { readonly kind: 'empty'; readonly query: string }
  | { readonly kind: 'results'; readonly groups: readonly SearchGroupDto[]; readonly count: number };

/**
 * Qué enseña la pantalla. Los resultados de una consulta anterior no se enseñan mientras se escribe ni mientras llega la
 * respuesta de la nueva (la web los oculta igual): solo vale una respuesta a la consulta actual.
 */
export const searchView = ({ text, debounced, outcome }: SearchInput): SearchView => {
  const query = text.trim();
  if (!canSearch(query)) return { kind: 'hint' };
  const settled = outcome !== null && outcome.query === debounced;
  if (query !== debounced || !settled) return { kind: 'loading' };
  if (outcome.failed) return { kind: 'error' };
  if (outcome.groups.length === 0) return { kind: 'empty', query };
  return { kind: 'results', groups: outcome.groups, count: totalResults(outcome.groups) };
};

/** Texto del resumen: «1 resultado» o «N resultados en M grupos» (claves del espacio `busqueda`). */
export const summaryKey = (count: number): 'summaryOne' | 'summary' => (count === 1 ? 'summaryOne' : 'summary');

// Los resultados llevan a la misma ruta que en la web salvo las NC: la web tiene `/nc/NC-003`, el móvil abre el detalle con
// `/nc?select=NC-003` (el tablero es una pestaña y el detalle, una hoja).
const MOBILE_HREF: ReadonlyMap<SearchGroupKind, (item: SearchItemDto) => string> = new Map<SearchGroupKind, (item: SearchItemDto) => string>([['nc', (item) => `/nc?select=${encodeURIComponent(item.id)}`]]);

const isInternal = (href: string): boolean => href.startsWith('/') && !href.startsWith('//');

/**
 * Ruta móvil de un resultado: programa → `/programs/PRG-001`; requisito → `/programs/PRG-001/requirements?select=REQ-001`;
 * caso de prueba → `/verification/TC-001`; documento → `/documents/DOC-001`; NC → `/nc?select=NC-001`. Una ruta de la API que
 * no sea interna se descarta (`null`): nunca se navega a un enlace externo.
 */
export const mobileHref = (kind: SearchGroupKind, item: SearchItemDto): string | null => {
  const href = (MOBILE_HREF.get(kind) ?? ((entry: SearchItemDto) => entry.href))(item);
  return isInternal(href) ? href : null;
};
