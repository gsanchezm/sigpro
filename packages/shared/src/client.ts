import { ADMIN_KEY_HEADER, HTTP_STATUS_TEXT, TENANT_HEADER, type RequirementState } from './domain';
import type {
  ApiErrorBody,
  AuditPageDto,
  AdminUserDto,
  AuditQuery,
  DocumentCompareDto,
  DocumentContentDto,
  DocumentDetailDto,
  DocumentListResponse,
  FileDownload,
  HealthResponse,
  LoginResponse,
  MilestoneDto,
  NcDetailDto,
  NcListQuery,
  NcListResponse,
  NcCommentDto,
  NcDto,
  OwnerDto,
  ProgramDto,
  ProgramListQuery,
  ProgramListResponse,
  PublicConfig,
  RegisterResponse,
  RequirementDto,
  RequirementListResponse,
  ResetResponse,
  SessionResponse,
  SessionUser,
  TenantInfo,
  TestCaseDetailDto,
  TestCaseListQuery,
  TestCaseListResponse,
  TestRunDto,
  TestUserDto,
  SearchResponse,
  SupplierDto,
  SupplierListQuery,
  TraceabilityDto,
} from './api-types';
import type { MissionEventDto, MissionSummaryDto } from './mission';
import type {
  ChaosConfig,
  CreateMilestoneInput,
  CreateNcInput,
  CreateProgramInput,
  CreateRequirementInput,
  ForgotInput,
  LoginInput,
  MfaInput,
  MoveRequirementInput,
  NcCommentInput,
  PublishVersionInput,
  RegisterInput,
  TransitionNcInput,
  UpdateMilestoneInput,
  UpdateNcInput,
  UpdateProgramInput,
  UpdateRequirementInput,
  UpdateUserInput,
} from './schemas';

/** Respuesta de `POST /mission/tick`: el evento que acaba de emitir el simulador. */
export interface MissionEventTickResponse {
  readonly event: MissionEventDto;
}

/** Error HTTP con el cuerpo de la API y la traza `POST /api/x → 401 Unauthorized`. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly body: ApiErrorBody,
    readonly trace: string,
  ) {
    super(body.message);
    this.name = 'ApiError';
  }
}

export interface ApiClientOptions {
  readonly baseUrl: string;
  readonly getToken?: () => string | null;
  readonly getTenant?: () => string | undefined;
  readonly fetchImpl?: typeof fetch;
  /** Se invoca ante un 401 en un endpoint autenticado; devuelve un token nuevo para reintentar una vez. */
  readonly onUnauthorized?: () => Promise<string | null>;
}

type Method = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
interface RequestOptions {
  /** Objeto → JSON; `FormData` → multipart (el navegador pone el `boundary`). */
  readonly body?: unknown;
  readonly query?: Readonly<Record<string, string | number | undefined>>;
  readonly headers?: Readonly<Record<string, string>>;
  /** No reintentar con refresh (login, refresh…). */
  readonly anonymous?: boolean;
}

const toQuery = (query: RequestOptions['query']): string => {
  const entries = Object.entries(query ?? {}).filter((entry): entry is [string, string | number] => entry[1] !== undefined && entry[1] !== '');
  return entries.length ? `?${new URLSearchParams(entries.map(([k, v]) => [k, String(v)])).toString()}` : '';
};

const fallbackBody = (status: number, message: string): ApiErrorBody => ({
  statusCode: status,
  error: HTTP_STATUS_TEXT[status] ?? 'Error',
  message,
});

/** `attachment; filename="informe.pdf"` (o `filename*=UTF-8''…`) → nombre del archivo. */
export const filenameFromDisposition = (header: string | null): string | null => {
  if (!header) return null;
  const encoded = /filename\*=UTF-8''([^;]+)/i.exec(header)?.[1];
  if (encoded) return decodeURIComponent(encoded);
  return /filename="?([^";]+)"?/i.exec(header)?.[1] ?? null;
};

const isFormData = (body: unknown): body is FormData => typeof FormData !== 'undefined' && body instanceof FormData;

export const createApiClient = (options: ApiClientOptions) => {
  const doFetch = options.fetchImpl ?? ((...args: Parameters<typeof fetch>) => fetch(...args));

  const send = async (method: Method, path: string, opts: RequestOptions = {}, tokenOverride?: string | null): Promise<Response> => {
    const token = tokenOverride === undefined ? options.getToken?.() : tokenOverride;
    const tenant = options.getTenant?.();
    const multipart = isFormData(opts.body);
    const headers: Record<string, string> = {
      Accept: 'application/json',
      ...(opts.body === undefined || multipart ? {} : { 'Content-Type': 'application/json' }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(tenant ? { [TENANT_HEADER]: tenant } : {}),
      ...opts.headers,
    };
    return doFetch(`${options.baseUrl}${path}${toQuery(opts.query)}`, {
      method,
      headers,
      body: opts.body === undefined ? undefined : isFormData(opts.body) ? opts.body : JSON.stringify(opts.body),
    });
  };

  const request = async (method: Method, path: string, opts: RequestOptions = {}): Promise<Response> => {
    const trace = (status: number) => `${method} /api${path} → ${status} ${HTTP_STATUS_TEXT[status] ?? ''}`.trim();
    const attempt = async (token?: string | null): Promise<Response> => {
      try {
        return await send(method, path, opts, token);
      } catch {
        throw new ApiError(0, fallbackBody(0, 'network'), `${method} /api${path} → network error`);
      }
    };

    const first = await attempt();
    const canRetry = first.status === 401 && !opts.anonymous && options.onUnauthorized !== undefined;
    const response = canRetry ? await retryWithFreshToken(attempt, first, options.onUnauthorized) : first;
    if (response.ok) return response;

    const body = await response
      .json()
      .then((json: unknown) => json as ApiErrorBody)
      .catch(() => fallbackBody(response.status, response.statusText));
    throw new ApiError(response.status, body, trace(response.status));
  };

  const json = async <T>(method: Method, path: string, opts?: RequestOptions): Promise<T> => (await request(method, path, opts)).json() as Promise<T>;

  const empty = async (method: Method, path: string, opts?: RequestOptions): Promise<void> => {
    await request(method, path, opts);
  };

  /** Descarga binaria (PDF, evidencias): la web la convierte en `blob:` porque `<img src>` y `<a href>` no llevan el Bearer. */
  const file = async (method: Method, path: string, opts?: RequestOptions): Promise<FileDownload> => {
    const response = await request(method, path, opts);
    return { blob: await response.blob(), filename: filenameFromDisposition(response.headers.get('Content-Disposition')) };
  };

  const enc = encodeURIComponent;

  return {
    auth: {
      login: (input: LoginInput) => json<LoginResponse>('POST', '/auth/login', { body: input, anonymous: true }),
      mfa: (input: MfaInput) => json<SessionResponse>('POST', '/auth/mfa', { body: input, anonymous: true }),
      register: (input: RegisterInput) => json<RegisterResponse>('POST', '/auth/register', { body: input, anonymous: true }),
      forgot: (input: ForgotInput) => empty('POST', '/auth/forgot', { body: input, anonymous: true }),
      resend: (email: string) => empty('POST', '/auth/resend', { body: { email }, anonymous: true }),
      sso: () => empty('GET', '/auth/sso', { anonymous: true }),
      refresh: (refreshToken: string) => json<SessionResponse>('POST', '/auth/refresh', { body: { refreshToken }, anonymous: true }),
      logout: (refreshToken: string | null) => empty('POST', '/auth/logout', { body: { refreshToken }, anonymous: true }),
      me: () => json<SessionUser>('GET', '/auth/me'),
    },
    config: {
      get: () => json<PublicConfig>('GET', '/config', { anonymous: true }),
      tenants: () => json<readonly TenantInfo[]>('GET', '/config/tenants', { anonymous: true }),
      testUsers: () => json<readonly TestUserDto[]>('GET', '/config/test-users', { anonymous: true }),
    },
    health: () => json<HealthResponse>('GET', '/health', { anonymous: true }),
    programs: {
      list: (query: ProgramListQuery = {}) => json<ProgramListResponse>('GET', '/programs', { query: { ...query } }),
      get: (code: string) => json<ProgramDto>('GET', `/programs/${enc(code)}`),
      create: (input: CreateProgramInput) => json<ProgramDto>('POST', '/programs', { body: input }),
      update: (code: string, input: UpdateProgramInput) => json<ProgramDto>('PATCH', `/programs/${enc(code)}`, { body: input }),
      remove: (code: string) => empty('DELETE', `/programs/${enc(code)}`),
      archive: (code: string) => json<ProgramDto>('POST', `/programs/${enc(code)}/archive`),
      duplicate: (code: string) => json<ProgramDto>('POST', `/programs/${enc(code)}/duplicate`),
      exportCsv: async (query: ProgramListQuery = {}): Promise<string> => (await request('GET', '/programs/export', { query: { ...query } })).text(),
    },
    requirements: {
      list: (programCode: string) => json<RequirementListResponse>('GET', `/programs/${enc(programCode)}/requirements`),
      traceability: (programCode: string) => json<TraceabilityDto>('GET', `/programs/${enc(programCode)}/traceability`),
      get: (code: string) => json<RequirementDto>('GET', `/requirements/${enc(code)}`),
      create: (input: CreateRequirementInput) => json<RequirementDto>('POST', '/requirements', { body: input }),
      update: (code: string, input: UpdateRequirementInput) => json<RequirementDto>('PATCH', `/requirements/${enc(code)}`, { body: input }),
      transition: (code: string, to: RequirementState) => json<RequirementDto>('POST', `/requirements/${enc(code)}/transition`, { body: { to } }),
      move: (code: string, input: MoveRequirementInput) => json<RequirementListResponse>('POST', `/requirements/${enc(code)}/move`, { body: input }),
      remove: (code: string) => empty('DELETE', `/requirements/${enc(code)}`),
      link: (code: string, testCaseCode: string) => empty('PUT', `/requirements/${enc(code)}/tests/${enc(testCaseCode)}`),
      unlink: (code: string, testCaseCode: string) => empty('DELETE', `/requirements/${enc(code)}/tests/${enc(testCaseCode)}`),
    },
    testCases: {
      list: (query: TestCaseListQuery = {}) => json<TestCaseListResponse>('GET', '/test-cases', { query: { ...query } }),
      get: (code: string) => json<TestCaseDetailDto>('GET', `/test-cases/${enc(code)}`),
      /** `form`: campos `result`, `notes` y hasta 5 `files` (PNG/JPEG/PDF de 2 MB como máximo). */
      execute: (code: string, form: FormData) => json<TestRunDto>('POST', `/test-cases/${enc(code)}/runs`, { body: form }),
      /** Informe PDF del plan de verificación; `codes` = casos separados por coma (si no, todos los del programa o del tenant). */
      report: (query: { readonly program?: string; readonly codes?: string } = {}) => file('GET', '/verification/report', { query: { ...query } }),
    },
    evidence: {
      download: (id: string) => file('GET', `/evidence/${enc(id)}`),
    },
    documents: {
      list: (query: { readonly program?: string; readonly classification?: string; readonly q?: string } = {}) => json<DocumentListResponse>('GET', '/documents', { query: { ...query } }),
      get: (id: string) => json<DocumentDetailDto>('GET', `/documents/${enc(id)}`),
      content: (id: string, version?: number) => json<DocumentContentDto>('GET', `/documents/${enc(id)}/content`, { query: { version } }),
      compare: (id: string, from: number, to: number) => json<DocumentCompareDto>('GET', `/documents/${enc(id)}/compare`, { query: { from, to } }),
      publish: (id: string, input: PublishVersionInput) => json<DocumentDetailDto>('POST', `/documents/${enc(id)}/versions`, { body: input }),
      download: (id: string, version?: number) => file('GET', `/documents/${enc(id)}/download`, { query: { version } }),
    },
    suppliers: {
      /** Proveedores del tenant por nombre o NIF (`q`), o solo los contratados en un programa (`program`). */
      list: (query: SupplierListQuery = {}) => json<readonly SupplierDto[]>('GET', '/suppliers', { query: { ...query } }),
    },
    search: {
      /** Búsqueda global agrupada (programas, requisitos, casos, NC y documentos); mínimo 2 caracteres. */
      global: (q: string) => json<SearchResponse>('GET', '/search', { query: { q } }),
    },
    audit: {
      list: (query: AuditQuery = {}) => json<AuditPageDto>('GET', '/audit', { query: { ...query } }),
    },
    nc: {
      list: (query: NcListQuery = {}) => json<NcListResponse>('GET', '/nc', { query: { ...query } }),
      get: (code: string) => json<NcDetailDto>('GET', `/nc/${enc(code)}`),
      create: (input: CreateNcInput) => json<NcDto>('POST', '/nc', { body: input }),
      update: (code: string, input: UpdateNcInput) => json<NcDetailDto>('PATCH', `/nc/${enc(code)}`, { body: input }),
      /** Mueve la NC a otra columna; cerrar exige `comment` (mínimo 20 caracteres). */
      transition: (code: string, input: TransitionNcInput) => json<NcDetailDto>('POST', `/nc/${enc(code)}/transition`, { body: input }),
      comment: (code: string, input: NcCommentInput) => json<NcCommentDto>('POST', `/nc/${enc(code)}/comments`, { body: input }),
    },
    milestones: {
      list: (programCode: string) => json<readonly MilestoneDto[]>('GET', `/programs/${enc(programCode)}/milestones`),
      create: (programCode: string, input: CreateMilestoneInput) => json<MilestoneDto>('POST', `/programs/${enc(programCode)}/milestones`, { body: input }),
      update: (id: string, input: UpdateMilestoneInput) => json<MilestoneDto>('PATCH', `/milestones/${enc(id)}`, { body: input }),
      remove: (id: string) => empty('DELETE', `/milestones/${enc(id)}`),
    },
    mission: {
      summary: () => json<MissionSummaryDto>('GET', '/mission/summary'),
      /** Emite ya el siguiente evento del simulador (admin); así los specs no esperan al temporizador. */
      tick: () => json<MissionEventTickResponse>('POST', '/mission/tick'),
    },
    users: {
      owners: () => json<readonly OwnerDto[]>('GET', '/users/owners'),
    },
    admin: {
      reset: () => json<ResetResponse>('POST', '/admin/reset'),
      resetAll: (adminKey: string) => json<readonly ResetResponse[]>('POST', '/admin/reset', { query: { all: 'true' }, headers: { [ADMIN_KEY_HEADER]: adminKey } }),
      getChaos: () => json<ChaosConfig>('GET', '/admin/chaos'),
      setChaos: (input: Partial<ChaosConfig>) => json<ChaosConfig>('PATCH', '/admin/chaos', { body: input }),
      users: () => json<readonly AdminUserDto[]>('GET', '/admin/users'),
      updateUser: (id: string, input: UpdateUserInput) => json<AdminUserDto>('PATCH', `/admin/users/${enc(id)}`, { body: input }),
    },
  } as const;
};

const retryWithFreshToken = async (
  attempt: (token?: string | null) => Promise<Response>,
  first: Response,
  onUnauthorized: () => Promise<string | null>,
): Promise<Response> => {
  const fresh = await onUnauthorized();
  return fresh ? attempt(fresh) : first;
};

export type ApiClient = ReturnType<typeof createApiClient>;
