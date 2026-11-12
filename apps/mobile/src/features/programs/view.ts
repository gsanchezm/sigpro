import { ApiError, STATUS_TONE, can, type MilestoneDto, type MilestoneStatus, type ProgramDto, type ProgramStatus, type Role, type Tone } from '@sigpro/shared';

// Mapeos estado→tono, orden y reglas de vista de Programas. Puro: sin react-native (se prueba con Vitest).

/** Tono del badge de un programa: el mismo mapa que la web (`STATUS_TONE`). */
export const programStatusTone = (status: ProgramStatus): Tone => STATUS_TONE[status];

/** Tono del badge de un hito (mismo mapa que la tabla de hitos de la web). */
export const MILESTONE_STATUS_TONE: Readonly<Record<MilestoneStatus, Tone>> = { done: 'ok', in_progress: 'info', pending: 'neutral' };

/** Estado visible de un hito: lo decide `done` del servidor (con el 100 % queda cumplido); si no, avance > 0 es «en curso». */
export const milestoneStatusOf = (milestone: Pick<MilestoneDto, 'done' | 'progress'>): MilestoneStatus =>
  milestone.done ? 'done' : milestone.progress > 0 ? 'in_progress' : 'pending';

/** Orden de los hitos: fecha límite y, a igualdad, identificador (el mismo criterio que la web). */
export const sortMilestones = (items: readonly MilestoneDto[]): readonly MilestoneDto[] =>
  [...items].sort((a, b) => a.dueDate.localeCompare(b.dueDate) || a.id.localeCompare(b.id));

/** Hitos cumplidos (`done`) sobre el total. */
export const countDone = (items: readonly MilestoneDto[]): number => items.filter((item) => item.done).length;

/** Añade una página a las ya cargadas sin repetir programas: si el orden cambia entre páginas, un código no aparece dos veces. */
export const appendPrograms = (current: readonly ProgramDto[], incoming: readonly ProgramDto[]): readonly ProgramDto[] => {
  const seen = new Set(current.map((program) => program.code));
  return [...current, ...incoming.filter((program) => !seen.has(program.code))];
};

/** Un 404 de la API significa «ese programa no existe»; cualquier otro fallo es de carga. */
export const isNotFound = (failure: unknown): boolean => failure instanceof ApiError && failure.status === 404;

// --- Permisos y acciones (mismo `can()` que la web) --------------------------

export interface ProgramPermissions {
  readonly create: boolean;
  readonly edit: boolean;
  readonly archive: boolean;
  readonly delete: boolean;
  readonly milestoneEdit: boolean;
  readonly milestoneDelete: boolean;
}

/** Permisos del rol sobre Programas e hitos, con la matriz de `@sigpro/shared` (la misma que la web). */
export const programPermissionsOf = (role: Role): ProgramPermissions => ({
  create: can(role, 'program.create'),
  edit: can(role, 'program.edit'),
  archive: can(role, 'program.archive'),
  delete: can(role, 'program.delete'),
  milestoneEdit: can(role, 'milestone.edit'),
  milestoneDelete: can(role, 'milestone.delete'),
});

// --- Selección múltiple de la lista ---------------------------------------------

/** Marca o desmarca un programa. Inmutable: no toca la lista anterior. */
export const toggleSelection = (selected: readonly string[], code: string): readonly string[] =>
  selected.includes(code) ? selected.filter((item) => item !== code) : [...selected, code];

/** ¿Están marcados todos los programas de la página? */
export const isAllSelected = (selected: readonly string[], codes: readonly string[]): boolean => codes.length > 0 && codes.every((code) => selected.includes(code));

/** «Seleccionar todos» de la página: si ya estaban todos, los quita; si no, los añade a la selección (como la web). */
export const toggleAllSelection = (selected: readonly string[], codes: readonly string[]): readonly string[] =>
  isAllSelected(selected, codes) ? selected.filter((code) => !codes.includes(code)) : Array.from(new Set([...selected, ...codes]));

// --- Responsable: búsqueda en la lista ----------------------------------------------

/** Responsables que cumplen la búsqueda (sin texto, todos) más siempre el seleccionado (como el combobox de la web). */
export const filterOwners = <T extends { readonly id: string; readonly name: string }>(owners: readonly T[], query: string, selectedId: string): readonly T[] => {
  const text = query.trim().toLowerCase();
  return owners.filter((owner) => text === '' || owner.name.toLowerCase().includes(text) || owner.id === selectedId);
};
