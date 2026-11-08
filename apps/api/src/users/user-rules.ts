import type { Role, UpdateUserInput } from '@sigpro/shared';

// Reglas puras de la administración de usuarios: nadie se quita a sí mismo el acceso y siempre queda un admin activo.

export interface UserFacts {
  readonly id: string;
  readonly role: Role;
  readonly active: boolean;
}

export type UserUpdateDecision = { readonly ok: true } | { readonly ok: false; readonly code: 'self_change' | 'last_admin' };

const isActiveAdmin = (user: UserFacts): boolean => user.role === 'admin' && user.active;

/**
 * `target` es el usuario que se modifica, `actorId` quien lo hace y `activeAdmins` los admin activos del tenant
 * (antes del cambio). 409 `self_change` si te tocas la cuenta; 409 `last_admin` si dejaría el tenant sin admin activo.
 */
export const decideUserUpdate = (actorId: string, target: UserFacts, input: UpdateUserInput, activeAdmins: number): UserUpdateDecision => {
  const deactivates = input.active === false && target.active;
  const demotes = input.role !== undefined && input.role !== target.role;
  if (target.id === actorId && (deactivates || demotes)) return { ok: false, code: 'self_change' };
  const losesAdmin = isActiveAdmin(target) && (deactivates || (demotes && input.role !== 'admin'));
  if (losesAdmin && activeAdmins <= 1) return { ok: false, code: 'last_admin' };
  return { ok: true };
};
