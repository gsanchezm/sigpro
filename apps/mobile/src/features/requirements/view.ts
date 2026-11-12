// Lógica pura de la pantalla de Requisitos: filtro con ancestros, árbol aplanado con sangría y plegado, tonos, matriz de
// trazabilidad y «Mover a…». Sin imports de react-native: se prueba con Vitest en Node (`view.test.ts`).
import {
  REQUIREMENT_STATE_TONE,
  buildTree,
  formatTrace,
  siblingsOf,
  visibleRows,
  withAncestors,
  type Placement,
  type RequirementDto,
  type RequirementState,
  type TestResult,
  type Tone,
  type VisibleRow,
} from '@sigpro/shared';

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

/** Quita de `collapsed` los ancestros de un requisito, para que se vea al crearlo o abrirlo. */
export const expandAncestors = (collapsed: ReadonlySet<string>, items: readonly RequirementDto[], code: string): ReadonlySet<string> => {
  const ancestors = new Set<string>();
  const byCode = new Map(items.map((item) => [item.code, item]));
  for (let parent = byCode.get(code)?.parentCode ?? null; parent !== null; parent = byCode.get(parent)?.parentCode ?? null) ancestors.add(parent);
  return new Set([...collapsed].filter((item) => !ancestors.has(item)));
};

/** Sangría de una fila según su nivel (la raíz no se desplaza). */
export const indentOf = (depth: number): number => depth * INDENT_PX;

/** Tono del badge de estado: el mismo vocabulario que la web (`REQUIREMENT_STATE_TONE`). */
export const stateTone = (state: RequirementState): Tone => REQUIREMENT_STATE_TONE[state];

/** Traza de un fallo en una línea: la de la API o el texto de red. */
export const failureTrace = (failure: unknown, networkText: string): string => formatTrace(failure) || networkText;

// --- Pruebas enlazadas y matriz de trazabilidad ----------------------------

/** Clave de un cruce requisito × caso de prueba. */
export const linkKey = (requirementCode: string, testCaseCode: string): string => `${requirementCode}|${testCaseCode}`;

/** Resultado visible de una celda: sin enlace, vacía; enlazada sin ejecuciones, «·»; si no, el de la última ejecución. */
export type CellResult = TestResult | 'none' | 'unlinked';

export const cellResultOf = (linked: boolean, lastResult: TestResult | null): CellResult => {
  if (!linked) return 'unlinked';
  return lastResult ?? 'none';
};

/** Cuántos casos de prueba enlaza un requisito. */
export const coverageOf = (links: readonly { readonly requirementCode: string }[], requirementCode: string): number =>
  links.filter((link) => link.requirementCode === requirementCode).length;

/** Requisitos con al menos un caso enlazado (la leyenda «N de M requisitos con cobertura»). */
export const coveredCount = (requirements: readonly { readonly code: string }[], links: readonly { readonly requirementCode: string }[]): number =>
  requirements.filter((requirement) => coverageOf(links, requirement.code) > 0).length;

/** Lista de enlaces tras marcar (`checked`) o desmarcar un cruce. Inmutable: no toca la lista anterior. */
export const withLink = (
  links: readonly { readonly requirementCode: string; readonly testCaseCode: string }[],
  requirementCode: string,
  testCaseCode: string,
  checked: boolean,
): readonly { readonly requirementCode: string; readonly testCaseCode: string }[] => {
  const others = links.filter((link) => !(link.requirementCode === requirementCode && link.testCaseCode === testCaseCode));
  return checked ? [...others, { requirementCode, testCaseCode }] : others;
};

// --- Mover a… (reordenar entre hermanos) -----------------------------------

/** Hermanos del requisito que se puede tomar como referencia: los de su mismo padre, sin él. */
export const moveTargetsOf = (items: readonly RequirementDto[], item: RequirementDto): readonly RequirementDto[] =>
  siblingsOf(items, item.parentCode).filter((sibling) => sibling.code !== item.code);

/** Posiciones de «Mover a…»: antes o después de la referencia. */
export const MOVE_PLACEMENTS: readonly Placement[] = ['before', 'after'];
