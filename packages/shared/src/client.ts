import { ADMIN_KEY_HEADER, HTTP_STATUS_TEXT, TENANT_HEADER } from './domain';
import type {
  ApiErrorBody,
  HealthResponse,
  LoginResponse,
  OwnerDto,
  ProgramDto,
  ProgramListQuery,
  ProgramListResponse,
  PublicConfig,
  RegisterResponse,
  ResetResponse,
  SessionResponse,
  SessionUser,
  TenantInfo,
  TestUserDto,
} from './api-types';
import type { ChaosConfig, CreateProgramInput, ForgotInput, LoginInput, MfaInput, RegisterInput } from './schemas';

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

type Method = 'GET' | 'POST' | 'PATCH' | 'DELETE';
interface RequestOptions {
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

export const createApiClient = (options: ApiClientOptions) => {
  const doFetch = options.fetchImpl ?? ((...args: Parameters<typeof fetch>) => fetch(...args));

  const send = async (method: Method, path: string, opts: RequestOptions = {}, tokenOverride?: string | null): Promise<Response> => {
    const token = tokenOverride === undefined ? options.getToken?.() : tokenOverride;
    const tenant = options.getTenant?.();
    const headers: Record<string, string> = {
      Accept: 'application/json',
      ...(opts.body === undefined ? {} : { 'Content-Type': 'application/json' }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(tenant ? { [TENANT_HEADER]: tenant } : {}),
      ...opts.headers,
    };
    return doFetch(`${options.baseUrl}${path}${toQuery(opts.query)}`, {
      method,
      headers,
      body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
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
      get: (code: string) => json<ProgramDto>('GET', `/programs/${encodeURIComponent(code)}`),
      create: (input: CreateProgramInput) => json<ProgramDto>('POST', '/programs', { body: input }),
      remove: (code: string) => empty('DELETE', `/programs/${encodeURIComponent(code)}`),
      archive: (code: string) => json<ProgramDto>('POST', `/programs/${encodeURIComponent(code)}/archive`),
      duplicate: (code: string) => json<ProgramDto>('POST', `/programs/${encodeURIComponent(code)}/duplicate`),
      exportCsv: async (query: ProgramListQuery = {}): Promise<string> => (await request('GET', '/programs/export', { query: { ...query } })).text(),
    },
    users: {
      owners: () => json<readonly OwnerDto[]>('GET', '/users/owners'),
    },
    admin: {
      reset: () => json<ResetResponse>('POST', '/admin/reset'),
      resetAll: (adminKey: string) => json<readonly ResetResponse[]>('POST', '/admin/reset', { query: { all: 'true' }, headers: { [ADMIN_KEY_HEADER]: adminKey } }),
      getChaos: () => json<ChaosConfig>('GET', '/admin/chaos'),
      setChaos: (input: Partial<ChaosConfig>) => json<ChaosConfig>('PATCH', '/admin/chaos', { body: input }),
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
