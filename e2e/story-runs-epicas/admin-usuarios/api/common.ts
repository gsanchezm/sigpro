import { API_URL, call, field, login, sessionOf, type ApiResult, type Session } from '../../../story-runs/support/api';
import { DEMO, TENANT_A, requestAccount, resetTenants, type Credentials, type RequestedAccount } from '../../../story-runs/support/prepare';
import { check, preparationFailed, type Check } from '../../support/checks';

// Piezas comunes de los manejadores de API de EP-ADMIN-USUARIOS. Todas las filas usan el tenant alumno01 salvo que la celda pida
// otra cabecera `x-tenant`. Las respuestas se leen tal como las devuelve el controlador (`apps/api/src/admin/admin.controller.ts`,
// `apps/api/src/users/users-admin.service.ts`, `apps/api/src/audit/audit.service.ts`): la lista es un ARRAY y `GET /api/audit`
// devuelve `{ items, nextCursor, total }`.

/** Cuenta administradora de alumno01 (`u7`, sin segundo factor). */
export const ADMIN_A: Credentials = { email: 'alumno01@sigpro.lab', password: 'Alumno1234!' };
/** Cuenta administradora de alumno02 (`u7`), para leer los ids de su tenant. */
export const ADMIN_B: Credentials = { email: 'alumno02@sigpro.lab', password: 'Alumno1234!' };
/** Código del segundo paso de admin@sigpro.test (seed). */
export const MFA_CODE = '123456';

/** Cuentas del seed que citan las historias (y la de alumno01), por correo. */
export const ACCOUNTS: ReadonlyMap<string, Credentials> = new Map<string, Credentials>([
  [DEMO.admin.email, DEMO.admin],
  [DEMO.gestor.email, DEMO.gestor],
  [DEMO.consultor.email, DEMO.consultor],
  [DEMO.auditor.email, DEMO.auditor],
  [DEMO.bloqueado.email, DEMO.bloqueado],
  [DEMO.pendiente.email, DEMO.pendiente],
  [ADMIN_A.email, ADMIN_A],
]);

/** Ids fijados por la historia 001 en cada tenant `alumnoNN`. */
export const SEED_ID: ReadonlyMap<string, string> = new Map<string, string>([
  [DEMO.admin.email, 'u1'],
  [DEMO.gestor.email, 'u2'],
  [DEMO.consultor.email, 'u3'],
  [DEMO.auditor.email, 'u4'],
  [DEMO.bloqueado.email, 'u5'],
  [DEMO.pendiente.email, 'u6'],
  [ADMIN_A.email, 'u7'],
]);

/** Roles de la API (los mismos textos que aparecen en las celdas de las historias). */
export const ROLE_VALUES: ReadonlyMap<string, string> = new Map<string, string>([
  ['admin', 'admin'],
  ['program_manager', 'program_manager'],
  ['consultant', 'consultant'],
  ['auditor', 'auditor'],
]);

/** Celdas booleanas («true» / «false»). */
export const BOOLEANS: ReadonlyMap<string, boolean> = new Map<string, boolean>([
  ['true', true],
  ['false', false],
]);

/** Claves exactas que trae cada usuario del listado y de los cambios (`AdminUserDto`). */
export const USER_KEYS: readonly string[] = ['id', 'name', 'email', 'role', 'active', 'locked', 'pending', 'org'];

/** Respuesta esperada: código HTTP y, si lo hay, el `code` del cuerpo. */
export interface Expect {
  readonly status: number;
  readonly code?: string;
}

/** Inicio de sesión de una cuenta en un tenant, con su contraseña. `remember` solo se envía si se da. */
export const signIn = (credentials: Credentials, tenant: string = TENANT_A, remember?: boolean): Promise<ApiResult> =>
  login({ tenant, email: credentials.email, password: credentials.password, ...(remember === undefined ? {} : { remember }) });

/** Sesión (tokens) que trae una respuesta de login, o `undefined`. */
export const sessionOfResult = (result: ApiResult): Session | undefined => sessionOf(result);

/** Reinicio de alumno01 (y de los tenants que se pasen) y, después, el accessToken de su administrador, si el inicio de sesión responde. */
export const resetAndAdminToken = async (tenants: readonly string[] = [TENANT_A]): Promise<string | undefined> => {
  await resetTenants(tenants);
  const session = sessionOfResult(await signIn(ADMIN_A));
  return session?.accessToken;
};

/** Un inicio de sesión de una cuenta del seed: su accessToken, o `undefined` si no abre sesión. */
export const tokenOf = async (credentials: Credentials, tenant: string = TENANT_A): Promise<{ readonly result: ApiResult; readonly token: string | undefined }> => {
  const result = await signIn(credentials, tenant);
  return { result, token: sessionOfResult(result)?.accessToken };
};

/**
 * Inicio de sesión de admin@sigpro.test con su segundo paso (`POST /api/auth/mfa`, código 123456). Devuelve la respuesta del segundo paso
 * y, si la trae, el accessToken. Sin el segundo paso no hay sesión.
 */
export const adminMfaSession = async (): Promise<{ readonly result: ApiResult; readonly token: string | undefined }> => {
  const first = await signIn(DEMO.admin, TENANT_A);
  const mfaToken = field(first.body, 'mfaToken');
  if (typeof mfaToken !== 'string') return { result: first, token: undefined };
  const second = await call('POST', '/auth/mfa', { tenant: TENANT_A, body: { mfaToken, code: MFA_CODE } });
  return { result: second, token: sessionOfResult(second)?.accessToken };
};

/** `GET /api/admin/users` con un accessToken y la cabecera `x-tenant` de alumno01. */
export const listUsers = (token: string): Promise<ApiResult> => call('GET', '/admin/users', { tenant: TENANT_A, token });

/** `GET /api/admin/users` con la cabecera `x-tenant` dada; `undefined` envía la petición SIN cabecera (no es un valor por defecto). */
export const listUsersWith = (token: string, header: string | undefined): Promise<ApiResult> =>
  call('GET', '/admin/users', { ...(header === undefined ? {} : { tenant: header }), token });

/** Lista de usuarios de un resultado (vacía si no es un array). */
export const usersOf = (result: ApiResult): readonly Record<string, unknown>[] => (Array.isArray(result.body) ? (result.body as Record<string, unknown>[]) : []);

/** `PATCH /api/admin/users/<id>` con un accessToken y la cabecera `x-tenant` de alumno01. */
export const patchUser = (token: string, id: string, body: unknown, header: string = TENANT_A): Promise<ApiResult> =>
  call('PATCH', `/admin/users/${id}`, { tenant: header, token, body });

/** Usuario de la lista por su correo, o `undefined`. */
export const userByEmail = (users: readonly Record<string, unknown>[], email: string): Record<string, unknown> | undefined => users.find((user) => user.email === email);

/** Usuario de la lista por su id, o `undefined`. */
export const userById = (users: readonly Record<string, unknown>[], id: string): Record<string, unknown> | undefined => users.find((user) => user.id === id);

/** Estado visible de un usuario de la lista, en una frase con sus datos crudos (o `(ausente)`). */
export const stateOf = (user: Record<string, unknown> | undefined): string =>
  user === undefined ? '(no está en la lista)' : `role ${String(user.role)}, active ${String(user.active)}, locked ${String(user.locked)}, pending ${String(user.pending)}`;

/** ¿El objeto trae exactamente las claves de `AdminUserDto` (ni contraseña ni datos del segundo factor)? */
export const hasUserShape = (user: Record<string, unknown> | undefined): boolean => user !== undefined && Object.keys(user).sort().join(',') === [...USER_KEYS].sort().join(',');

/** Igualdad de dos objetos planos por claves y valores (orden de claves indiferente). */
export const sameObject = (left: Readonly<Record<string, unknown>> | undefined, right: Readonly<Record<string, unknown>> | undefined): boolean =>
  left !== undefined && right !== undefined && Object.keys(left).sort().join(',') === Object.keys(right).sort().join(',') && Object.keys(left).every((key) => left[key] === right[key]);

/** Cadena de usuarios comparable: lista de ids con su estado (para «los demás no cambian», comparando por id). */
export const snapshotOf = (users: readonly Record<string, unknown>[]): string => JSON.stringify(users.map((user) => [user.id, user.role, user.active, user.locked, user.pending, user.name, user.email, user.org]));

/** Total de eventos de `GET /api/audit` (0 si la respuesta no lo trae; el token debe tener `audit.view`). */
export const auditTotal = async (token: string): Promise<number | undefined> => {
  const result = await call('GET', '/audit', { tenant: TENANT_A, token });
  const total = field(result.body, 'total');
  return typeof total === 'number' ? total : undefined;
};

/** El registro más reciente de `GET /api/audit` (primer elemento de `items`), o `undefined`. */
export const latestAudit = async (token: string): Promise<Readonly<Record<string, unknown>> | undefined> => {
  const result = await call('GET', '/audit', { tenant: TENANT_A, token });
  const items = field(result.body, 'items');
  const first = Array.isArray(items) ? (items[0] as unknown) : undefined;
  return typeof first === 'object' && first !== null ? (first as Record<string, unknown>) : undefined;
};

/** Diff de auditoría como objeto (o `undefined` si no lo es). */
export const diffOf = (entry: Readonly<Record<string, unknown>> | undefined): Readonly<Record<string, unknown>> | undefined => {
  const diff = entry?.diff;
  return typeof diff === 'object' && diff !== null && !Array.isArray(diff) ? (diff as Record<string, unknown>) : undefined;
};

/** Solicitud de una cuenta nueva en un tenant (`POST /api/auth/register`). Si no responde 2xx, la preparación falla. */
export const requestOrFail = async (tenant: string): Promise<{ readonly account?: RequestedAccount; readonly failed?: ReturnType<typeof preparationFailed> }> => {
  const account = await requestAccount(tenant);
  if (account.result.status < 200 || account.result.status > 299) return { failed: preparationFailed(`cuenta recién solicitada en ${tenant}`, `POST /api/auth/register en ${tenant}`, account.result) };
  return { account };
};

/** Comprobación de la respuesta frente a la esperada (estado y, si lo hay, `code`). */
export const statusCheck = (result: ApiResult, expected: Expect): Check => {
  const code = field(result.body, 'code');
  const matches = result.status === expected.status && (expected.code === undefined || code === expected.code);
  return check(matches, `respuesta ${expected.status}${expected.code ? ` ${expected.code}` : ''}`, `respuesta ${result.status}${typeof code === 'string' ? ` ${code}` : ''}`);
};

/** «No trae tokens de sesión» (accessToken o refreshToken). */
export const noSessionTokens = (result: ApiResult): Check => {
  const traces = typeof field(result.body, 'accessToken') === 'string' || typeof field(result.body, 'refreshToken') === 'string';
  return check(!traces, 'sin tokens de sesión', `accessToken ${typeof field(result.body, 'accessToken')}, refreshToken ${typeof field(result.body, 'refreshToken')}`);
};

/** El cuerpo trae accessToken y refreshToken de texto. */
export const sessionTokens = (result: ApiResult): Check => {
  const both = typeof field(result.body, 'accessToken') === 'string' && typeof field(result.body, 'refreshToken') === 'string';
  return check(both, 'trae accessToken y refreshToken', `accessToken ${typeof field(result.body, 'accessToken')}, refreshToken ${typeof field(result.body, 'refreshToken')}`);
};

/** Rol que trae el objeto `user` de una respuesta de login. */
export const loginRoleOf = (result: ApiResult): string | undefined => {
  const user = field(result.body, 'user');
  const role = typeof user === 'object' && user !== null ? (user as Record<string, unknown>).role : undefined;
  return typeof role === 'string' ? role : undefined;
};

/** Mapa de respuestas esperadas de una celda de respuesta sin cuerpo especial (código y estado). */
export const EXPECT_BY_CELL: ReadonlyMap<string, Expect> = new Map<string, Expect>([
  ['403 forbidden', { status: 403, code: 'forbidden' }],
  ['401 missing_token', { status: 401, code: 'missing_token' }],
  ['401 invalid_token', { status: 401, code: 'invalid_token' }],
  ['409 self_change', { status: 409, code: 'self_change' }],
  ['409 last_admin', { status: 409, code: 'last_admin' }],
  ['404 user_not_found', { status: 404, code: 'user_not_found' }],
  ['403 pending_approval', { status: 403, code: 'pending_approval' }],
  ['423 account_locked', { status: 423, code: 'account_locked' }],
  ['422 validation_failed', { status: 422, code: 'validation_failed' }],
]);

/** Alfabeto base64url: el orden de sus 64 valores decide qué bits cambia cada sustitución. */
const BASE64URL = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

/**
 * Token con «su última letra cambiada» (la firma cambia de verdad): la última letra lleva 4 bits de datos y 2 de relleno, así que se
 * invierte el bit 16 del valor, que es un bit de datos.
 */
export const alteredLast = (token: string): string => {
  const index = BASE64URL.indexOf(token.slice(-1));
  const flipped = BASE64URL[index ^ 16] ?? 'A';
  return `${token.slice(0, -1)}${flipped}`;
};

const parseText = (text: string): unknown => {
  if (text.length === 0) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
};

/**
 * Petición con cabeceras propias (la de `call` solo manda `Bearer <token>`): para las filas que mandan una cabecera `Authorization` tal
 * cual la escribe la historia, o sin ella. La ruta va sin el prefijo `/api`.
 */
export const rawCall = async (method: 'GET' | 'PATCH', path: string, headers: Readonly<Record<string, string>>, body?: unknown): Promise<ApiResult> => {
  const started = performance.now();
  const response = await fetch(`${API_URL}${path}`, {
    method,
    headers: { ...headers, ...(body === undefined ? {} : { 'content-type': 'application/json' }) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const text = await response.text();
  return { status: response.status, body: parseText(text), ms: Math.round(performance.now() - started) };
};

/** Objeto de un cuerpo de respuesta (`undefined` si no es un objeto plano). */
export const recordOf = (value: unknown): Record<string, unknown> | undefined => (typeof value === 'object' && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : undefined);

/** Respuestas esperadas de «GET /api/admin/users»: la lista (200) o el 403 por rol. */
export const LIST_RESPONSES: ReadonlyMap<string, Expect> = new Map<string, Expect>([
  ['200 con la lista de usuarios', { status: 200 }],
  ['403 forbidden', { status: 403, code: 'forbidden' }],
]);

/** Ids de las cuentas del seed en cada tenant (u1…u7), como los cita la historia. */
export const SEED_IDS: ReadonlyMap<string, string> = new Map<string, string>(['u1', 'u2', 'u3', 'u4', 'u5', 'u6', 'u7'].map((id) => [id, id]));
