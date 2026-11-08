import { milestoneStatus, type MilestoneDto, type MilestoneStatus, type Tone } from '@sigpro/shared';

export const MILESTONE_STATUS_TONE: Readonly<Record<MilestoneStatus, Tone>> = { done: 'ok', in_progress: 'info', pending: 'neutral' };

/** Orden de la tabla: fecha límite y, a igualdad, identificador (el mismo orden que devuelve la API). */
export const sortMilestones = (items: readonly MilestoneDto[]): readonly MilestoneDto[] =>
  [...items].sort((a, b) => a.dueDate.localeCompare(b.dueDate) || a.id.localeCompare(b.id));

/** Estado visible: lo decide el `done` del servidor (con el 100 % de avance el hito queda cumplido). */
export const milestoneView = (milestone: Pick<MilestoneDto, 'done' | 'progress'>): MilestoneStatus =>
  milestone.done ? 'done' : milestone.progress > 0 ? 'in_progress' : milestoneStatus(0);
