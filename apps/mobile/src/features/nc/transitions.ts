import { can, canNcTransition, ncNextStates, type NcState, type Role } from '@sigpro/shared';

// Destinos del «Mover a…» (la alternativa móvil al arrastre): solo los que la máquina de estados permite desde el
// estado actual, cada uno con su permiso para el rol.

/** Clave de `nc` con el motivo por el que un destino no se puede elegir. */
export type MoveDeniedKey = 'menuMoveDenied' | 'closeDenied';

export interface MoveOption {
  readonly to: NcState;
  readonly allowed: boolean;
  readonly deniedKey: MoveDeniedKey | null;
}

/** Sin `nc.transition` no hay movimientos; cerrar exige además `nc.close`. */
const deniedKeyFor = (role: Role, to: NcState): MoveDeniedKey | null => {
  if (!can(role, 'nc.transition')) return 'menuMoveDenied';
  if (!canNcTransition(role, to)) return 'closeDenied';
  return null;
};

export const moveOptions = (from: NcState, role: Role): readonly MoveOption[] =>
  ncNextStates(from).map((to) => {
    const deniedKey = deniedKeyFor(role, to);
    return { to, allowed: deniedKey === null, deniedKey };
  });

/** «Cerrada» no se envía sin comentario: abre el formulario de cierre. */
export const opensClosureForm = (to: NcState): boolean => to === 'closed';
