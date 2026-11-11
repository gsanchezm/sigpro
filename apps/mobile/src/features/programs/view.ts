import { ApiError, STATUS_TONE, type MilestoneDto, type MilestoneStatus, type ProgramDto, type ProgramStatus, type Tone } from '@sigpro/shared';

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
