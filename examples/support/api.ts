import type { APIRequestContext, APIResponse } from '@playwright/test';
import { API_URL, ROLES, STUDENT_USER, TENANT, type Credentials, type RoleName } from './env';

export interface Tokens {
  readonly accessToken: string;
  readonly refreshToken: string;
}

interface LoginBody {
  readonly mfaRequired: boolean;
  readonly mfaToken?: string;
  readonly accessToken?: string;
  readonly refreshToken?: string;
}

/** Login por API con el segundo paso MFA cuando hace falta. Es lo que usan los specs para preparar datos sin pasar por la UI. */
export const loginWith = async (request: APIRequestContext, credentials: Credentials): Promise<Tokens> => {
  const headers = { 'x-tenant': TENANT };
  const login = await request.post(`${API_URL}/auth/login`, { headers, data: { email: credentials.email, password: credentials.password, remember: true } });
  if (!login.ok()) throw new Error(`Login de ${credentials.email} en ${TENANT}: ${login.status()} ${await login.text()}`);
  const body = (await login.json()) as LoginBody;
  if (!body.mfaRequired) return body as Tokens;
  const mfa = await request.post(`${API_URL}/auth/mfa`, { headers, data: { mfaToken: body.mfaToken, code: credentials.mfa ?? '123456' } });
  if (!mfa.ok()) throw new Error(`MFA de ${credentials.email}: ${mfa.status()} ${await mfa.text()}`);
  return (await mfa.json()) as Tokens;
};

export const loginByApi = (request: APIRequestContext, role: RoleName): Promise<Tokens> => loginWith(request, ROLES[role]);

/** Login con tu usuario `alumnoNN@sigpro.lab` (admin de tu tenant). */
export const loginAsStudent = (request: APIRequestContext): Promise<Tokens> => loginWith(request, STUDENT_USER);

/** Cliente mínimo de la API ligado a un token: añade `Authorization` y `x-tenant` a cada petición. */
export const createApi = (request: APIRequestContext, accessToken: string) => {
  const headers = { Authorization: `Bearer ${accessToken}`, 'x-tenant': TENANT };
  return {
    get: (path: string, params?: Record<string, string | number>): Promise<APIResponse> => request.get(`${API_URL}${path}`, { headers, params }),
    post: (path: string, data?: unknown): Promise<APIResponse> => request.post(`${API_URL}${path}`, { headers, data }),
    patch: (path: string, data?: unknown): Promise<APIResponse> => request.patch(`${API_URL}${path}`, { headers, data }),
    delete: (path: string): Promise<APIResponse> => request.delete(`${API_URL}${path}`, { headers }),
  };
};

export type Api = ReturnType<typeof createApi>;
