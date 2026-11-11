import type { User } from '@prisma/client';
import { DEFAULT_TENANT, MAX_LOGIN_ATTEMPTS } from '@sigpro/shared';

export type AccountBlock = 'account_locked' | 'pending_approval' | 'account_disabled';

/** Motivos por los que una cuenta no puede abrir sesión, en el orden en que los evalúa el login. */
const BLOCK_RULES: ReadonlyArray<readonly [AccountBlock, (user: Pick<User, 'lockedAt' | 'pendingApproval' | 'active'>) => boolean]> = [
  ['account_locked', (user) => user.lockedAt !== null],
  ['pending_approval', (user) => user.pendingApproval],
  ['account_disabled', (user) => !user.active],
];

/** Por qué la cuenta no puede abrir sesión (`null` = puede). Lo comparten el login, el segundo paso MFA y el refresh. */
export const accountBlock = (user: Pick<User, 'lockedAt' | 'pendingApproval' | 'active'>): AccountBlock | null =>
  BLOCK_RULES.find(([, applies]) => applies(user))?.[0] ?? null;

/** Resultado de un intento fallido: nº de intentos acumulados y si la cuenta debe bloquearse. */
export const registerFailure = (previousAttempts: number): { attempts: number; locked: boolean } => {
  const attempts = previousAttempts + 1;
  return { attempts, locked: attempts >= MAX_LOGIN_ATTEMPTS };
};

/**
 * Contador en memoria para correos que no existen (no hay fila donde guardar `failedAttempts`).
 * Mantiene el `attempts=n` del 401 coherente con el de usuarios reales.
 */
export const unknownUserAttempts = () => {
  const counts = new Map<string, number>();
  const key = (tenantId: string, email: string) => `${tenantId}|${email.trim().toLowerCase()}`;
  return {
    fail: (tenantId: string, email: string): number => {
      const next = (counts.get(key(tenantId, email)) ?? 0) + 1;
      counts.set(key(tenantId, email), next);
      return next;
    },
    clear: (tenantId: string, email: string): void => {
      counts.delete(key(tenantId, email));
    },
  };
};

/**
 * Tenant del login: cabecera `x-tenant`; si falta, el único tenant que tiene ese correo;
 * si es ambiguo o desconocido, `demo`.
 */
export const resolveTenantId = (header: string | undefined, tenantsWithEmail: readonly string[]): string => {
  const explicit = header?.trim();
  if (explicit) return explicit;
  return tenantsWithEmail.length === 1 ? (tenantsWithEmail[0] as string) : DEFAULT_TENANT;
};
