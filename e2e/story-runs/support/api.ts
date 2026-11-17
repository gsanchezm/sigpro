// Cliente mínimo de la API para ejecutar los ejemplos de las historias: devuelve estado, cuerpo y tiempo SIN lanzar por
// códigos 4xx/5xx (los ejemplos observan esos códigos). Usa `fetch` de Node: no depende de Playwright ni de navegador.

export const API_URL = process.env.E2E_API_URL ?? 'http://localhost:3000/api';

export interface ApiResult {
  readonly status: number;
  /** Cuerpo JSON ya interpretado; `null` si no hay cuerpo (p. ej. 204) o no es JSON. */
  readonly body: unknown;
  readonly ms: number;
}

export interface CallOptions {
  readonly tenant?: string;
  /** Token de acceso (cabecera `Authorization: Bearer …`). */
  readonly token?: string;
  readonly body?: unknown;
  /** Añade `x-admin-key` (solo para el reinicio global; las filas NO lo usan). */
  readonly adminKey?: boolean;
  /** Cadena de consulta sin `?`. */
  readonly query?: string;
}

const parseBody = (text: string): unknown => {
  if (text.length === 0) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
};

/** Una petición a la API. `path` empieza por `/` y va sin el prefijo `/api`. */
export const call = async (method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE', path: string, options: CallOptions = {}): Promise<ApiResult> => {
  const headers: Record<string, string> = {
    ...(options.body === undefined ? {} : { 'content-type': 'application/json' }),
    ...(options.tenant ? { 'x-tenant': options.tenant } : {}),
    ...(options.token ? { authorization: `Bearer ${options.token}` } : {}),
    ...(options.adminKey ? { 'x-admin-key': process.env.ADMIN_KEY ?? 'dev-admin-key' } : {}),
  };
  const url = `${API_URL}${path}${options.query ? `?${options.query}` : ''}`;
  const started = performance.now();
  const response = await fetch(url, { method, headers, ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }) });
  const text = await response.text();
  return { status: response.status, body: parseBody(text), ms: Math.round(performance.now() - started) };
};

/** Lectura segura de una propiedad de un cuerpo desconocido (evita `any`). */
export const field = (body: unknown, key: string): unknown =>
  typeof body === 'object' && body !== null ? (body as Record<string, unknown>)[key] : undefined;

/** Código de error de la API (`code`) si el cuerpo lo trae. */
export const errorCode = (result: ApiResult): string | undefined => {
  const code = field(result.body, 'code');
  return typeof code === 'string' ? code : undefined;
};

export interface JwtClaims {
  readonly iat: number;
  readonly exp: number;
  readonly tenant?: string;
  readonly sub?: string;
  readonly typ?: string;
  readonly remember?: boolean;
}

/** Decodifica (SIN verificar) las reclamaciones de un JWT: sirve para medir su duración real (`exp - iat`). */
export const decodeJwt = (token: string): JwtClaims => {
  const payload = token.split('.')[1] ?? '';
  return JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as JwtClaims;
};

export const LOGIN_PATH = '/auth/login';

export interface LoginAttempt {
  readonly tenant: string;
  readonly email: string;
  readonly password: string;
  readonly remember?: boolean;
}

/** `POST /api/auth/login`; `remember` se envía solo si se indica (el esquema lo trata como opcional). */
export const login = (attempt: LoginAttempt): Promise<ApiResult> =>
  call('POST', LOGIN_PATH, {
    tenant: attempt.tenant,
    body: { email: attempt.email, password: attempt.password, ...(attempt.remember === undefined ? {} : { remember: attempt.remember }) },
  });

export interface Session {
  readonly accessToken: string;
  readonly refreshToken: string;
}

/** Extrae la sesión de una respuesta de login sin segundo factor; `undefined` si no la trae. */
export const sessionOf = (result: ApiResult): Session | undefined => {
  const accessToken = field(result.body, 'accessToken');
  const refreshToken = field(result.body, 'refreshToken');
  return typeof accessToken === 'string' && typeof refreshToken === 'string' ? { accessToken, refreshToken } : undefined;
};

/** Credenciales de la cuenta de administración de un tenant (`alumnoNN@sigpro.lab`, sin segundo factor). */
export const adminCredentials = (tenant: string): { readonly email: string; readonly password: string } => ({
  email: `${tenant}@sigpro.lab`,
  password: 'Alumno1234!',
});

/** Token de acceso de la cuenta de administración del tenant. Falla con un mensaje claro si el login no responde 200. */
export const adminToken = async (tenant: string): Promise<string> => {
  const result = await login({ tenant, ...adminCredentials(tenant), remember: false });
  const session = sessionOf(result);
  if (!session) throw new Error(`Login de administración de ${tenant} falló: ${result.status} ${JSON.stringify(result.body)}`);
  return session.accessToken;
};

/**
 * Reinicia el tenant con el token de su administrador (`POST /api/admin/reset`). Con un token la API usa el tenant del
 * JWT e ignora `x-tenant`. NO reinicia el caos del tenant ni el contador en memoria de correos que no existen.
 */
export const resetTenant = async (tenant: string): Promise<ApiResult> => call('POST', '/admin/reset', { token: await adminToken(tenant) });

export interface ChaosFlags {
  readonly latencyMs: number;
  readonly errorRate: number;
  readonly flakyLabels: boolean;
}

export const NO_CHAOS: ChaosFlags = { latencyMs: 0, errorRate: 0, flakyLabels: false };

/** Configuración pública del tenant (`GET /api/config`): entorno, caos y si la app lleva los defectos del curso. */
export const readConfig = (tenant: string): Promise<ApiResult> => call('GET', '/config', { tenant });

/** Fija el caos del tenant (`PATCH /api/admin/chaos`, con su administrador). */
export const setChaos = async (tenant: string, flags: ChaosFlags): Promise<ApiResult> =>
  call('PATCH', '/admin/chaos', { tenant, token: await adminToken(tenant), body: flags });

let counter = 0;

/**
 * Correo único para los casos «sin cuenta»: el contador de intentos de correos que no existen vive en memoria, se identifica
 * por tenant + correo y no lo reinicia ningún reset, así que cada fila usa un correo que nadie ha usado antes.
 */
export const uniqueEmail = (prefix: string): string => {
  counter += 1;
  return `${prefix}-${Date.now().toString(36)}-${process.pid.toString(36)}${counter}@sigpro.test`;
};

/** Usuarios del seed por correo → id del seed, leídos de `GET /api/admin/users` del tenant. */
export const usersByEmail = async (tenant: string): Promise<ReadonlyMap<string, Record<string, unknown>>> => {
  const result = await call('GET', '/admin/users', { tenant, token: await adminToken(tenant) });
  if (result.status !== 200 || !Array.isArray(result.body)) throw new Error(`GET /admin/users de ${tenant}: ${result.status}`);
  return new Map((result.body as ReadonlyArray<Record<string, unknown>>).map((user) => [String(user.email), user]));
};
