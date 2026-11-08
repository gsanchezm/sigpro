import { isMilestoneDone } from '@sigpro/shared';

/**
 * Estado `done` tras cambiar el avance. Regla: con el 100 % el hito queda cumplido.
 * Defecto plantado (`PLANTED_BUGS`): si el avance anterior era menor del 50 %, un salto directo al 100 % guarda el avance
 * pero deja el hito sin marcar como cumplido (hay que bajar y volver a subir el slider).
 */
export const doneAfterProgress = (previousProgress: number, nextProgress: number, plantedBugs: boolean): boolean => {
  if (!isMilestoneDone(nextProgress)) return false;
  return plantedBugs && previousProgress < 50 ? false : true;
};
