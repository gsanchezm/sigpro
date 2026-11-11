// Lógica pura de la pantalla de Requisitos: filtro con ancestros, árbol aplanado con sangría y plegado, tonos.
// Sin imports de react-native: se prueba con Vitest en Node (`view.test.ts`).
import { REQUIREMENT_STATE_TONE, buildTree, visibleRows, withAncestors, type RequirementDto, type RequirementState, type Tone, type VisibleRow } from '@sigpro/shared';

/** Sangría por nivel del árbol, en píxeles. */
export const INDENT_PX = 16;

/** Ningún nodo plegado. */
export const NO_CODES: ReadonlySet<string> = new Set<string>();

/** Texto de búsqueda normalizado: sin espacios sobrantes y en minúsculas. */
export const normalizeQuery = (raw: string): string => raw.trim().toLowerCase();

/** Requisitos que cumplen la búsqueda, más todos sus ancestros (así no se pierde el camino hasta cada coincidencia). Sin búsqueda, todos. */
export const filterRequirements = (items: readonly RequirementDto[], query: string): readonly RequirementDto[] => {
  if (query === '') return items;
  return withAncestors(items, (item) => item.code.toLowerCase().includes(query) || item.title.toLowerCase().includes(query));
};

/** Filas visibles en orden de lectura. Con búsqueda activa se despliega todo para ver las coincidencias (como la web). */
export const requirementRows = (items: readonly RequirementDto[], query: string, collapsed: ReadonlySet<string>): readonly VisibleRow<RequirementDto>[] =>
  visibleRows(buildTree(filterRequirements(items, query)), query === '' ? collapsed : NO_CODES);

/** Pliega o despliega un nodo sin tocar el conjunto anterior. */
export const toggleCollapsed = (collapsed: ReadonlySet<string>, code: string): ReadonlySet<string> => {
  const next = new Set(collapsed);
  if (!next.delete(code)) next.add(code);
  return next;
};

/** Sangría de una fila según su nivel (la raíz no se desplaza). */
export const indentOf = (depth: number): number => depth * INDENT_PX;

/** Tono del badge de estado: el mismo vocabulario que la web (`REQUIREMENT_STATE_TONE`). */
export const stateTone = (state: RequirementState): Tone => REQUIREMENT_STATE_TONE[state];
