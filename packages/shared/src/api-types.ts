import type { ChaosConfig } from './schemas';
import type { Classification, Priority, ProgramSortColumn, ProgramStatus, RequirementState, RequirementTag, Role, SortDir, TestCaseSortColumn, TestResult } from './domain';
import type { DiffRow, DiffStats } from './documents';
import type { NcCommentKind, NcSeverity, NcState } from './nc';

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
  /** Programas del tenant cuyo responsable es esta persona. */
  readonly programCount: number;
}

export interface PublicConfig {
  readonly env: string;
  readonly tenant: string;
  readonly version: string;
  readonly testUsers: boolean;
  readonly chaos: ChaosConfig;
  /** Defectos plantados activos (`PLANTED_BUGS`); la web aplica su parte sin saber cuáles son. */
  readonly plantedBugs: boolean;
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

// --- Requisitos ------------------------------------------------------------

export interface RequirementDto {
  readonly code: string;
  readonly programCode: string;
  readonly parentCode: string | null;
  readonly title: string;
  /** HTML saneado (lista blanca de `sanitizeRichText`). */
  readonly description: string;
  readonly priority: Priority;
  readonly state: RequirementState;
  readonly tags: readonly RequirementTag[];
  readonly position: number;
  /** Casos de prueba enlazados (matriz de trazabilidad). */
  readonly testCaseCodes: readonly string[];
}

export interface RequirementListResponse {
  readonly program: { readonly code: string; readonly name: string };
  /** Todos los requisitos del programa en plano; el árbol se construye con `buildTree`. */
  readonly items: readonly RequirementDto[];
}

export interface TraceabilityDto {
  readonly requirements: readonly { readonly code: string; readonly title: string; readonly state: RequirementState }[];
  readonly testCases: readonly { readonly code: string; readonly title: string }[];
  readonly links: readonly { readonly requirementCode: string; readonly testCaseCode: string }[];
}

// --- Verificación ----------------------------------------------------------

export interface TestCaseDto {
  readonly code: string;
  readonly programCode: string;
  readonly programName: string;
  readonly title: string;
  readonly steps: readonly string[];
  readonly expected: string;
  readonly requirementCodes: readonly string[];
  readonly runCount: number;
  readonly lastResult: TestResult | null;
  readonly lastRunAt: string | null;
}

export interface TestCaseListQuery {
  readonly q?: string;
  readonly program?: string;
  /** Último resultado; `none` = casos sin ninguna ejecución. */
  readonly result?: TestResult | 'none';
  readonly sort?: TestCaseSortColumn;
  readonly dir?: SortDir;
  readonly page?: number;
  readonly pageSize?: number;
}

export interface TestCaseListResponse {
  readonly items: readonly TestCaseDto[];
  /** Casos que cumplen los filtros. */
  readonly total: number;
  /** Ejecuciones de esos casos (el subtítulo de la pantalla). */
  readonly totalRuns: number;
  readonly totalAll: number;
  readonly page: number;
  readonly pageSize: number;
  readonly pages: number;
}

export interface EvidenceDto {
  readonly id: string;
  readonly filename: string;
  readonly mimeType: string;
  readonly size: number;
  /** Ruta de la API (`/evidence/EV-001`): requiere el Bearer, así que la web la descarga como blob. */
  readonly url: string;
}

export interface TestRunDto {
  readonly id: string;
  readonly testCaseCode: string;
  readonly executedAt: string;
  readonly result: TestResult;
  readonly notes: string;
  readonly executedById: string | null;
  readonly executedByName: string | null;
  readonly evidences: readonly EvidenceDto[];
}

export interface TestCaseDetailDto extends TestCaseDto {
  readonly requirements: readonly { readonly code: string; readonly title: string }[];
  readonly runs: readonly TestRunDto[];
}

/** Archivo descargado con su nombre (cabecera `Content-Disposition`). */
export interface FileDownload {
  readonly blob: Blob;
  readonly filename: string | null;
}

// --- Documentos ------------------------------------------------------------

export interface DocumentDto {
  readonly id: string;
  readonly programCode: string;
  readonly programName: string;
  readonly title: string;
  readonly classification: Classification;
  /** Última versión. */
  readonly version: number;
  readonly updatedAt: string;
}

export interface DocumentListResponse {
  readonly items: readonly DocumentDto[];
  /** Documentos restringidos que el rol no puede ver (para el aviso de la lista). */
  readonly hiddenCount: number;
}

export interface DocumentVersionInfo {
  readonly version: number;
  readonly note: string;
  readonly authorName: string | null;
  readonly createdAt: string;
}

export interface DocumentDetailDto extends DocumentDto {
  readonly versions: readonly DocumentVersionInfo[];
}

export interface DocumentContentDto {
  readonly id: string;
  readonly title: string;
  readonly programCode: string;
  readonly classification: Classification;
  readonly version: number;
  readonly note: string;
  readonly createdAt: string;
  readonly pages: readonly (readonly string[])[];
}

export interface DocumentCompareDto {
  readonly id: string;
  readonly from: number;
  readonly to: number;
  readonly rows: readonly DiffRow[];
  readonly stats: DiffStats;
}

// --- Auditoría -------------------------------------------------------------

export interface AuditEntryDto {
  readonly id: string;
  readonly at: string;
  readonly actorId: string | null;
  readonly actorName: string | null;
  readonly action: string;
  readonly entity: string;
  readonly entityId: string;
  readonly diff: Readonly<Record<string, unknown>> | null;
}

export interface AuditQuery {
  readonly entity?: string;
  readonly q?: string;
  readonly from?: string;
  readonly to?: string;
  readonly cursor?: string;
  readonly limit?: number;
}

export interface AuditPageDto {
  readonly items: readonly AuditEntryDto[];
  /** `null` cuando no quedan más eventos. */
  readonly nextCursor: string | null;
  /** Eventos que cumplen los filtros (no solo los de esta página). */
  readonly total: number;
}

// --- No conformidades (fase 3) ------------------------------------------------

export interface NcDto {
  readonly code: string;
  readonly programCode: string;
  readonly programName: string;
  readonly severity: NcSeverity;
  /** HTML saneado (lista blanca de `sanitizeRichText`). */
  readonly description: string;
  readonly state: NcState;
  readonly assigneeId: string | null;
  readonly assigneeName: string | null;
  readonly testRunId: string | null;
  readonly commentCount: number;
  readonly createdAt: string;
}

export interface NcCommentDto {
  readonly id: string;
  readonly authorId: string | null;
  readonly authorName: string | null;
  readonly body: string;
  readonly kind: NcCommentKind;
  readonly createdAt: string;
}

export interface NcDetailDto extends NcDto {
  /** Comentarios de más antiguo a más reciente. */
  readonly comments: readonly NcCommentDto[];
  /** Estados a los que se puede pasar desde el actual (la máquina de estados, sin mirar permisos). */
  readonly transitions: readonly NcState[];
}

export interface NcListQuery {
  readonly q?: string;
  readonly program?: string;
  readonly severity?: NcSeverity;
  /** Id de usuario o `none` (sin asignar). */
  readonly assignee?: string;
}

export interface NcListResponse {
  readonly items: readonly NcDto[];
  /** NC que cumplen los filtros. */
  readonly total: number;
  readonly totalAll: number;
}

// --- Hitos (fase 3) -------------------------------------------------------------

export interface MilestoneDto {
  readonly id: string;
  readonly programCode: string;
  readonly name: string;
  /** `YYYY-MM-DD`. */
  readonly dueDate: string;
  /** 0–100; con 100 el hito está cumplido. */
  readonly progress: number;
  readonly done: boolean;
}

// --- Administración (fase 3) ---------------------------------------------------

export interface AdminUserDto {
  readonly id: string;
  readonly name: string;
  readonly email: string;
  readonly role: Role;
  readonly active: boolean;
  readonly locked: boolean;
  readonly pending: boolean;
  readonly org: string | null;
}
