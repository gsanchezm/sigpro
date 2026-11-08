import type { AdminUserDto, Tone } from '@sigpro/shared';

export type UserStatus = 'ok' | 'locked' | 'pending' | 'inactive';

/** Estado visible de un usuario, por prioridad: pendiente de aprobación → bloqueado → desactivado → normal. */
export const userStatus = (user: Pick<AdminUserDto, 'active' | 'locked' | 'pending'>): UserStatus =>
  user.pending ? 'pending' : user.locked ? 'locked' : !user.active ? 'inactive' : 'ok';

export const USER_STATUS_TONE: Readonly<Record<UserStatus, Tone>> = { ok: 'ok', locked: 'danger', pending: 'warn', inactive: 'neutral' };

/** Búsqueda de la tabla de usuarios: por nombre o correo, sin distinguir mayúsculas ni espacios de los extremos. */
export const filterUsers = <T extends Pick<AdminUserDto, 'name' | 'email'>>(users: readonly T[], search: string): readonly T[] => {
  const needle = search.trim().toLowerCase();
  return needle ? users.filter((user) => user.name.toLowerCase().includes(needle) || user.email.toLowerCase().includes(needle)) : users;
};

export const toPercent = (rate: number): number => Math.round(rate * 100);

/** El modo caos está activo si alguna de sus tres palancas no está en reposo. */
export const isChaosActive = (config: { readonly latencyMs: number; readonly errorRate: number; readonly flakyLabels: boolean }): boolean =>
  config.latencyMs > 0 || config.errorRate > 0 || config.flakyLabels;
