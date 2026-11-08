// Hitos del programa (fase 3): tabla con edición inline y slider de avance.

export const MILESTONE_NAME_MIN = 2;
export const MILESTONE_NAME_MAX = 80;
export const MILESTONE_PROGRESS_STEP = 5;

/** Un hito está cumplido cuando su avance llega al 100 % (el avance del programa sale de `done / total`). */
export const isMilestoneDone = (progress: number): boolean => progress >= 100;

export type MilestoneStatus = 'done' | 'in_progress' | 'pending';

export const milestoneStatus = (progress: number): MilestoneStatus => (isMilestoneDone(progress) ? 'done' : progress > 0 ? 'in_progress' : 'pending');

/** Ajusta el valor del slider a la rejilla de 5 y lo acota a 0–100. */
export const snapProgress = (value: number): number => Math.min(100, Math.max(0, Math.round(value / MILESTONE_PROGRESS_STEP) * MILESTONE_PROGRESS_STEP));

/** Siguiente id `PRG-001-M07` a partir de los existentes del programa (admite huecos). */
export const nextMilestoneId = (programCode: string, ids: readonly string[]): string => {
  const max = ids.reduce((acc, id) => Math.max(acc, Number.parseInt(id.split('-M')[1] ?? '', 10) || 0), 0);
  return `${programCode}-M${String(max + 1).padStart(2, '0')}`;
};
