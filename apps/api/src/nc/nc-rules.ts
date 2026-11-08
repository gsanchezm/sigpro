import { canNcTransition, isClosureComment, isNcTransition, type NcState, type Role } from '@sigpro/shared';

// Reglas puras de las no conformidades: la API las aplica y los tests unitarios las prueban sin base de datos.

export type TransitionDecision =
  | { readonly ok: true }
  | { readonly ok: false; readonly status: 403 | 409 | 422; readonly code: string; readonly errors?: Readonly<Record<string, string>> };

export interface TransitionRequest {
  readonly role: Role;
  readonly from: NcState;
  readonly to: NcState;
  readonly comment: string | undefined;
  /** `PLANTED_BUGS`: el laboratorio acepta cierres de 19 caracteres y permite open → rejected. */
  readonly plantedBugs: boolean;
}

/**
 * Orden de las comprobaciones: rol (403) → paso de la máquina de estados (409) → comentario de cierre (422).
 * Son tres casos de prueba distintos para el alumno, igual que en Requisitos.
 */
export const decideNcTransition = ({ role, from, to, comment, plantedBugs }: TransitionRequest): TransitionDecision => {
  if (!canNcTransition(role, to)) return { ok: false, status: 403, code: 'forbidden' };
  // Defecto plantado: el rechazo directo desde «Abierta» se acepta aunque la máquina de estados exige pasar por análisis
  const skipsAnalysis = plantedBugs && from === 'open' && to === 'rejected';
  if (!isNcTransition(from, to) && !skipsAnalysis) return { ok: false, status: 409, code: 'invalid_transition' };
  if (to !== 'closed') return { ok: true };
  const text = comment ?? '';
  if (text.trim() === '') return { ok: false, status: 422, code: 'validation_failed', errors: { comment: 'closureRequired' } };
  if (!isClosureComment(text, plantedBugs)) return { ok: false, status: 422, code: 'validation_failed', errors: { comment: 'closureShort' } };
  return { ok: true };
};
