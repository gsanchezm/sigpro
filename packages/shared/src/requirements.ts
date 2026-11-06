import type { RequirementState, Role } from './domain';
import { can, type Permission } from './permissions';

// Lógica pura del módulo Requisitos: transiciones de estado, árbol y reordenación entre hermanos.
// La usan la API (validación y persistencia) y la web (botones, árbol, vista optimista).

// --- Máquina de estados ----------------------------------------------------

export interface TransitionRule {
  readonly to: RequirementState;
  /** Permiso que exige pasar a `to`. */
  readonly permission: Permission;
}

/** Mapa de despacho: desde cada estado, adónde se puede ir y quién puede. Volver a borrador lo hace quien aprueba. */
export const TRANSITIONS: Readonly<Record<RequirementState, readonly TransitionRule[]>> = {
  draft: [{ to: 'approved', permission: 'requirement.approve' }],
  approved: [
    { to: 'verified', permission: 'requirement.verify' },
    { to: 'draft', permission: 'requirement.approve' },
  ],
  verified: [
    { to: 'validated', permission: 'requirement.validate' },
    { to: 'draft', permission: 'requirement.approve' },
  ],
  validated: [{ to: 'draft', permission: 'requirement.approve' }],
};

export const transitionRule = (from: RequirementState, to: RequirementState): TransitionRule | undefined => TRANSITIONS[from].find((rule) => rule.to === to);

/** ¿Existe el paso `from → to` en la máquina de estados (con independencia del rol)? */
export const isValidTransition = (from: RequirementState, to: RequirementState): boolean => transitionRule(from, to) !== undefined;

/** ¿Puede este rol hacer el paso `from → to`? */
export const canTransition = (role: Role, from: RequirementState, to: RequirementState): boolean => {
  const rule = transitionRule(from, to);
  return rule !== undefined && can(role, rule.permission);
};

/** Pasos posibles desde `from`, indicando si el rol puede darlos (los que no, se muestran deshabilitados con motivo). */
export const transitionsFor = (role: Role, from: RequirementState): readonly (TransitionRule & { readonly allowed: boolean })[] =>
  TRANSITIONS[from].map((rule) => ({ ...rule, allowed: can(role, rule.permission) }));

// --- Árbol -----------------------------------------------------------------

export interface TreeItem {
  readonly code: string;
  readonly parentCode: string | null;
  readonly position: number;
}

export interface TreeNode<T extends TreeItem> {
  readonly item: T;
  readonly depth: number;
  readonly children: readonly TreeNode<T>[];
}

const bySiblingOrder = <T extends TreeItem>(a: T, b: T): number => a.position - b.position || a.code.localeCompare(b.code);

/** Árbol ordenado por posición y código. Un elemento cuyo padre no está en la lista cuelga de la raíz. */
export const buildTree = <T extends TreeItem>(items: readonly T[]): readonly TreeNode<T>[] => {
  const codes = new Set(items.map((item) => item.code));
  const childrenOf = (parent: string | null): readonly T[] =>
    items.filter((item) => (parent === null ? item.parentCode === null || !codes.has(item.parentCode) : item.parentCode === parent)).sort(bySiblingOrder);
  const build = (parent: string | null, depth: number): readonly TreeNode<T>[] => childrenOf(parent).map((item) => ({ item, depth, children: build(item.code, depth + 1) }));
  return build(null, 0);
};

export interface VisibleRow<T extends TreeItem> {
  readonly item: T;
  readonly depth: number;
  readonly hasChildren: boolean;
  readonly expanded: boolean;
  /** Posición (1-based) entre los hermanos y tamaño del grupo: `aria-posinset` / `aria-setsize`. */
  readonly posInSet: number;
  readonly setSize: number;
}

/** Filas visibles en orden de lectura; los nodos de `collapsed` ocultan a sus descendientes. */
export const visibleRows = <T extends TreeItem>(tree: readonly TreeNode<T>[], collapsed: ReadonlySet<string>): readonly VisibleRow<T>[] =>
  tree.flatMap((node, index) => {
    const expanded = node.children.length > 0 && !collapsed.has(node.item.code);
    const row: VisibleRow<T> = { item: node.item, depth: node.depth, hasChildren: node.children.length > 0, expanded, posInSet: index + 1, setSize: tree.length };
    return expanded ? [row, ...visibleRows(node.children, collapsed)] : [row];
  });

/** Códigos con hijos (los que se pueden plegar). */
export const parentCodes = <T extends TreeItem>(items: readonly T[]): ReadonlySet<string> => {
  const codes = new Set(items.map((item) => item.code));
  return new Set(items.flatMap((item) => (item.parentCode !== null && codes.has(item.parentCode) ? [item.parentCode] : [])));
};

/** Todos los descendientes de `code` (para impedir ciclos y borrar en cascada). */
export const descendantCodes = <T extends TreeItem>(items: readonly T[], code: string): readonly string[] => {
  const children = items.filter((item) => item.parentCode === code).map((item) => item.code);
  return children.flatMap((child) => [child, ...descendantCodes(items, child)]);
};

/** Hermanos de `parentCode` en orden. */
export const siblingsOf = <T extends TreeItem>(items: readonly T[], parentCode: string | null): readonly T[] =>
  items.filter((item) => item.parentCode === parentCode).sort(bySiblingOrder);

// --- Reordenar entre hermanos ---------------------------------------------

export type Placement = 'before' | 'after';

/** Nuevo orden de los hermanos al soltar `code` antes/después de `target`. `null` si algún código no está o son el mismo. */
export const moveInOrder = (order: readonly string[], code: string, target: string, placement: Placement): readonly string[] | null => {
  if (code === target || !order.includes(code) || !order.includes(target)) return null;
  const without = order.filter((item) => item !== code);
  const at = without.indexOf(target) + (placement === 'after' ? 1 : 0);
  return [...without.slice(0, at), code, ...without.slice(at)];
};

/** Destino de «Subir» (-1) / «Bajar» (+1): el vecino con el que se intercambia, o `null` en los extremos. */
export const stepTarget = (order: readonly string[], code: string, step: -1 | 1): { readonly target: string; readonly placement: Placement } | null => {
  const index = order.indexOf(code);
  const neighbour = order[index + step];
  return index < 0 || neighbour === undefined ? null : { target: neighbour, placement: step < 0 ? 'before' : 'after' };
};

/** Siguiente código `REQ-NNN` a partir de los existentes (admite huecos). */
export const nextRequirementCode = (codes: readonly string[]): string => {
  const max = codes.reduce((acc, code) => Math.max(acc, Number.parseInt(code.replace(/\D/g, ''), 10) || 0), 0);
  return `REQ-${String(max + 1).padStart(3, '0')}`;
};
