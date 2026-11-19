import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { API_URL, adminToken, call, decodeJwt, field, login, sessionOf, type ApiResult, type JwtClaims, type Session } from '../../../story-runs/support/api';
import { DEMO, TENANT_A, failedLogins, type Credentials } from '../../../story-runs/support/prepare';
import { RESULTS_ROOT } from '../../../story-runs/support/evidence';
import { check, preparationFailed, type Check } from '../../support/checks';
import type { Outcome } from '../../core/framework';

// Piezas comunes de los manejadores de API de EP-SESION. Todas las filas usan el tenant alumno01 salvo que la celda pida otra
// cabecera `x-tenant`. Los tokens se leen con `decodeJwt` (sin verificar la firma): sirve para medir su plazo (`exp - iat`) y su
// antigüedad (`iat`), que es lo que la historia fija; la firma la comprueba la propia API en cada petición.

/** Plazo del accessToken que fija el producto (segundos). */
export const ACCESS_TTL_S = 900;
/** Plazo del refreshToken con «Mantener la sesión en este equipo» (7 días, en segundos). */
export const REMEMBER_TTL_S = 604_800;
/** Plazo del refreshToken sin «Mantener la sesión» (12 horas, en segundos). */
export const SESSION_TTL_S = 43_200;
/** Código del segundo paso del seed. */
export const MFA_CODE = '123456';

/** Alfabeto base64url: el orden de sus 64 valores decide qué bits cambia cada sustitución. */
const BASE64URL = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

/**
 * Token con «su última letra cambiada». La última letra de la firma lleva 4 bits de datos y 2 de relleno: cambiarla por la siguiente
 * letra del alfabeto podría tocar solo el relleno. Aquí se invierte el bit 16 del valor (un bit de datos), así la firma cambia de verdad.
 */
export const alteredLast = (token: string): string => {
  const index = BASE64URL.indexOf(token.slice(-1));
  const flipped = BASE64URL[index ^ 16] ?? 'A';
  return `${token.slice(0, -1)}${flipped}`;
};

/** Reclamaciones de un token, o `undefined` si no se pueden decodificar. Sin mensaje: el error podría llevar trozos del token. */
export const claimsOf = (token: string): JwtClaims | undefined => {
  try {
    return decodeJwt(token);
  } catch {
    return undefined;
  }
};

/** Plazo de un token según sus propias reclamaciones (`exp - iat`), o `undefined` si no las trae. */
export const lifetimeOf = (token: string | undefined): number | undefined => {
  if (token === undefined) return undefined;
  const claims = claimsOf(token);
  if (claims === undefined || typeof claims.iat !== 'number' || typeof claims.exp !== 'number') return undefined;
  return claims.exp - claims.iat;
};

/** ¿Lo emitió la API desde `sinceMs`? Compara en segundos (el `iat` del token), así que no depende de si dos tokens son distintos. */
export const issuedSince = (token: unknown, sinceMs: number): boolean => {
  if (typeof token !== 'string') return false;
  const claims = claimsOf(token);
  return claims !== undefined && typeof claims.iat === 'number' && claims.iat >= Math.floor(sinceMs / 1000);
};

/** Antigüedad de un token en segundos, medida ahora desde su `iat`. */
export const ageOf = (iat: number): number => Date.now() / 1000 - iat;

/** Edad de un accessToken en segundos (o `undefined` si el token no se puede decodificar). */
export const accessAge = (token: string): number | undefined => {
  const claims = claimsOf(token);
  return claims !== undefined && typeof claims.iat === 'number' ? ageOf(claims.iat) : undefined;
};

/** ¿El cuerpo trae un accessToken y un refreshToken de texto? */
export const hasTokens = (body: unknown): boolean => typeof field(body, 'accessToken') === 'string' && typeof field(body, 'refreshToken') === 'string';

/** El cuerpo no trae `mfaRequired` ni `mfaToken`: la renovación no pide el segundo paso. */
export const noMfaFields = (body: unknown): boolean => field(body, 'mfaRequired') === undefined && field(body, 'mfaToken') === undefined;

/** El objeto `user` de una respuesta (vacío si no lo trae). */
export const userOf = (body: unknown): Readonly<Record<string, unknown>> => {
  const user = field(body, 'user');
  return typeof user === 'object' && user !== null ? (user as Record<string, unknown>) : {};
};

/** `user` con los seis campos que fija la historia: id, name, email, role, mfa y tenant (con su tipo). */
export const userShapeOk = (user: Readonly<Record<string, unknown>>): boolean =>
  typeof user.id === 'string' && typeof user.name === 'string' && typeof user.email === 'string' && typeof user.role === 'string' && typeof user.mfa === 'boolean' && typeof user.tenant === 'string';

/** Texto corto de lo que devuelve la API para un campo de texto (nunca un token entero). */
export const shortText = (value: unknown): string => (value === undefined ? '(ausente)' : String(value));

/** Llamada con cabeceras propias: `call` solo envía `Bearer <token>`; aquí va cualquier cabecera `Authorization`. */
export const rawGet = async (path: string, headers: Readonly<Record<string, string>>): Promise<ApiResult> => {
  const started = performance.now();
  const response = await fetch(`${API_URL}${path}`, { method: 'GET', headers: { ...headers } });
  const text = await response.text();
  return { status: response.status, body: text.length === 0 ? null : parseText(text), ms: Math.round(performance.now() - started) };
};

const parseText = (text: string): unknown => {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
};

/** `POST /api/auth/login` de una cuenta del seed en alumno01. `remember` solo se envía si se da (`undefined` = el campo ausente). */
export const loginAs = (credentials: Credentials, remember?: boolean): Promise<ApiResult> =>
  login({ tenant: TENANT_A, email: credentials.email, password: credentials.password, remember });

/** Inicio de sesión que devuelve la sesión si el login trae tokens (si no, `session` queda indefinido). */
export const sessionFor = async (credentials: Credentials, remember?: boolean): Promise<{ readonly result: ApiResult; readonly session: Session | undefined }> => {
  const result = await loginAs(credentials, remember);
  return { result, session: sessionOf(result) };
};

/** `POST /api/auth/login` de admin@sigpro.test: devuelve su mfaToken (el segundo paso aún no está completado). */
export const mfaTokenOfAdmin = async (): Promise<{ readonly result: ApiResult; readonly mfaToken: string | undefined }> => {
  const result = await loginAs(DEMO.admin);
  const token = field(result.body, 'mfaToken');
  return { result, mfaToken: typeof token === 'string' ? token : undefined };
};

/** `POST /api/auth/mfa` con el mfaToken y el código del seed: la sesión completa de admin@sigpro.test. */
export const redeemMfa = (mfaToken: string): Promise<ApiResult> => call('POST', '/auth/mfa', { tenant: TENANT_A, body: { mfaToken, code: MFA_CODE } });

/** `POST /api/auth/refresh` con el refreshToken dado. `tenant` es la cabecera `x-tenant` (`undefined` = sin cabecera). */
export const refresh = (refreshToken: string, tenant: string | undefined): Promise<ApiResult> =>
  call('POST', '/auth/refresh', { ...(tenant === undefined ? {} : { tenant }), body: { refreshToken } });

/** `GET /api/auth/me` con un accessToken como Bearer. `tenant` es la cabecera `x-tenant` (`undefined` = sin cabecera, sin valor por defecto). */
export const me = (accessToken: string, tenant: string | undefined): Promise<ApiResult> => call('GET', '/auth/me', { ...(tenant === undefined ? {} : { tenant }), token: accessToken });

/** `PATCH /api/admin/users/<id>` hecho por el administrador de alumno01 (cambia `active` o `role`). */
export const patchUser = async (id: string, body: { readonly active?: boolean; readonly role?: string }): Promise<ApiResult> =>
  call('PATCH', `/admin/users/${id}`, { tenant: TENANT_A, token: await adminToken(TENANT_A), body });

/** Cinco (o N) inicios de sesión con contraseña incorrecta de gestor@sigpro.test. Devuelve cada respuesta, en orden. */
export const failGestor = (count: number): Promise<readonly ApiResult[]> => failedLogins(TENANT_A, DEMO.gestor.email, count);

/** Descripción corta de una respuesta de login fallido (estado y `code`). */
export const attemptText = (result: ApiResult | undefined): string => (result === undefined ? '(sin respuesta)' : `${result.status}${typeof field(result.body, 'code') === 'string' ? ` ${String(field(result.body, 'code'))}` : ''}`);

/** Comprobación de que el mfaRequired/mfaToken no aparecen en una renovación. */
export const noMfaCheck = (body: unknown): Check => check(noMfaFields(body), 'sin mfaRequired ni mfaToken', noMfaFields(body) ? 'sin mfaRequired ni mfaToken' : 'trae mfaRequired o mfaToken');

// --- Archivo de tokens con antigüedad (US-SESION-004, Esquema 3) ---------------------------------------------------------------

/** Un juego de tokens del inicio de sesión de gestor@sigpro.test (remember true), con la fecha en la que se emitió. */
export interface AgedSet {
  readonly issuedAt: string;
  readonly accessToken: string;
  readonly refreshToken: string;
}

export interface AgedFile {
  readonly sixteen: AgedSet;
  readonly fourteen: AgedSet;
}

/** Archivo que escribe `docs/story-runs/epicas/emitir-tokens-sesion.mjs` (la ruta sale de la carpeta de resultados del arnés). */
export const AGED_FILE = resolve(RESULTS_ROOT, 'epicas', 'EP-SESION', 'aged-tokens.json');

const isAgedSet = (value: unknown): value is AgedSet => {
  if (typeof value !== 'object' || value === null) return false;
  const set = value as Record<string, unknown>;
  return typeof set.issuedAt === 'string' && typeof set.accessToken === 'string' && typeof set.refreshToken === 'string';
};

/**
 * Lee el archivo de tokens con antigüedad. Devuelve el motivo si falta o no sirve; el motivo nunca lleva el contenido del archivo
 * (un error de JSON podría llevar un trozo de token).
 */
export const loadAged = (): { readonly file?: AgedFile; readonly reason?: string } => {
  if (!existsSync(AGED_FILE)) return { reason: 'no existe el archivo de tokens con antigüedad (docs/story-runs/epicas/EP-SESION/aged-tokens.json)' };
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(AGED_FILE, 'utf8')) as unknown;
  } catch {
    return { reason: 'el archivo de tokens con antigüedad no es JSON legible' };
  }
  if (typeof parsed !== 'object' || parsed === null) return { reason: 'el archivo de tokens con antigüedad no tiene la forma esperada' };
  const file = parsed as Partial<Record<'sixteen' | 'fourteen', unknown>>;
  if (!isAgedSet(file.sixteen) || !isAgedSet(file.fourteen)) return { reason: 'el archivo no trae completos los juegos «sixteen» y «fourteen»' };
  return { file: { sixteen: file.sixteen, fourteen: file.fourteen } };
};

/**
 * Preparación de una fila de antigüedad que no se cumple: los tokens del archivo no tienen la edad que la historia da por hecho. Se
 * devuelve con `preparationFailed` y la edad medida en la evidencia; la nota aclara que el problema es de la preparación, no de la app.
 */
export const agedPreparationFailed = (expected: string, reason: string, evidence: Readonly<Record<string, unknown>>): Outcome => {
  const failed = preparationFailed(expected, 'tokens con antigüedad del archivo de la fila', { status: 0, body: evidence, ms: 0 });
  return {
    ...failed,
    observed: `la preparación no se cumplió: ${reason}`,
    note: 'Fallo de la preparación de la fila (la antigüedad de los tokens no es la que la historia da por hecho), no un hallazgo sobre la app.',
    evidence,
  };
};
