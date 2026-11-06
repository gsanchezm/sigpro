// Lógica pura del combobox ARIA 1.2 y de la paginación (sin React, fácil de probar).

export interface ComboOwner {
  readonly id: string;
  readonly name: string;
  readonly programCount: number;
}

/** Opciones visibles: sin texto, todas; con texto, las que coinciden + siempre la seleccionada. */
export const filterOwners = <T extends ComboOwner>(owners: readonly T[], query: string, selectedId: string | null): readonly T[] => {
  const text = query.trim().toLowerCase();
  return owners.filter((owner) => !text || owner.name.toLowerCase().includes(text) || owner.id === selectedId);
};

/** ↓/↑ mueven la opción activa sin salirse de la lista. */
export const moveActive = (key: 'ArrowDown' | 'ArrowUp', active: number, count: number): number =>
  count === 0 ? 0 : key === 'ArrowDown' ? Math.min(count - 1, active + 1) : Math.max(0, active - 1);

/** Páginas visibles: todas si son ≤ 7; si no, primera, última y vecinas de la actual. */
export const pageWindow = (current: number, total: number): readonly number[] =>
  Array.from({ length: total }, (_, index) => index + 1).filter((n) => total <= 7 || n === 1 || n === total || Math.abs(n - current) <= 1);
