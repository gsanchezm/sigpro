import type { ChaosConfig } from './schemas';
import type { Priority, ProgramSortColumn, ProgramStatus, Role, SortDir } from './domain';

// Contrato HTTP compartido: la API lo implementa y la web (y la futura app móvil) lo consume.

export interface SessionUser {
  readonly id: string;
  readonly name: string;
  readonly email: string;
  readonly role: Role;
  readonly mfa: boolean;
  readonly tenant: string;
}

export interface AuthTokens {
  readonly accessToken: string;
  readonly refreshToken: string;
  /** Segundos de vida del access token. */
  readonly expiresIn: number;
}

export type LoginResponse =
  | ({ readonly mfaRequired: false; readonly user: SessionUser } & AuthTokens)
  | { readonly mfaRequired: true; readonly mfaToken: string; readonly email: string };

export type SessionResponse = { readonly user: SessionUser } & AuthTokens;

export interface RegisterResponse {
  readonly requestId: string;
  readonly status: 'pending_approval';
  readonly email: string;
  readonly role: string;
}

/** Cuerpo de error de la API. `code` es un identificador estable para la UI. */
export interface ApiErrorBody {
  readonly statusCode: number;
  readonly error: string;
  readonly message: string;
  readonly code?: string;
  readonly attempts?: number;
  /** Errores por campo en 422/400: `{ name: 'dupName' }`. */
  readonly errors?: Readonly<Record<string, string>>;
  readonly traceId?: string;
}

export interface ProgramDto {
  readonly code: string;
  readonly name: string;
  readonly description: string;
  readonly status: ProgramStatus;
  readonly priority: Priority;
  readonly classified: boolean;
  readonly ownerId: string;
  readonly ownerName: string;
  readonly startDate: string;
  readonly endDate: string;
  readonly budgetEur: number;
  /** Porcentaje (0–100) de hitos completados. */
  readonly progress: number;
  readonly milestonesDone: number;
  readonly milestonesTotal: number;
}

export interface ProgramListQuery {
  readonly q?: string;
  readonly status?: ProgramStatus;
  readonly from?: string;
  readonly to?: string;
  readonly owner?: string;
  readonly sort?: ProgramSortColumn;
  readonly dir?: SortDir;
  readonly page?: number;
  readonly pageSize?: number;
}

export interface ProgramListResponse {
  readonly items: readonly ProgramDto[];
  /** Total tras aplicar filtros. */
  readonly total: number;
  /** Total sin filtros. */
  readonly totalAll: number;
  /** Programas activos tras aplicar filtros. */
  readonly activeCount: number;
  readonly page: number;
  readonly pageSize: number;
  readonly pages: number;
}

export interface OwnerDto {
  readonly id: string;
  readonly name: string;
  readonly email: string;
  readonly role: Role;
}

export interface PublicConfig {
  readonly env: string;
  readonly tenant: string;
  readonly version: string;
  readonly testUsers: boolean;
  readonly chaos: ChaosConfig;
}

export interface HealthResponse {
  readonly status: 'ok';
  readonly uptime: number;
}

export interface ResetResponse {
  readonly tenant: string;
  readonly ms: number;
}

export interface TenantInfo {
  readonly id: string;
  readonly name: string;
}

export interface TestUserDto {
  readonly id: string;
  readonly name: string;
  readonly email: string;
  readonly password: string;
  readonly role: Role;
  readonly mfa: boolean;
  readonly status: 'active' | 'locked' | 'pending';
}
