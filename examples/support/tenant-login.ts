import type { APIRequestContext } from '@playwright/test';
import { API_URL, type Credentials } from './env';

// Login y cliente de la API para CUALQUIER tenant. `support/api.ts` fija la cabecera `x-tenant` a TU tenant;
// aquí el tenant es un parámetro. Sirve para leer otro tenant (p. ej. `demo`) y para comprobar el aislamiento entre tenants.

interface LoginStep {
  readonly mfaRequired: boolean;
  readonly mfaToken?: string;
  readonly accessToken?: string;
}

/** Devuelve un token de acceso en el tenant indicado, con el segundo paso MFA si el usuario lo exige. */
export const loginOn = async (request: APIRequestContext, tenant: string, credentials: Credentials): Promise<string> => {
  const headers = { 'x-tenant': tenant };
  const login = await request.post(`${API_URL}/auth/login`, { headers, data: { email: credentials.email, password: credentials.password, remember: true } });
  if (!login.ok()) throw new Error(`Login de ${credentials.email} en ${tenant}: ${login.status()} ${await login.text()}`);

  const step = (await login.json()) as LoginStep;
  if (!step.mfaRequired) {
    if (!step.accessToken) throw new Error(`Login de ${credentials.email} en ${tenant} sin token de acceso`);
    return step.accessToken;
  }

  const mfa = await request.post(`${API_URL}/auth/mfa`, { headers, data: { mfaToken: step.mfaToken, code: credentials.mfa ?? '123456' } });
  if (!mfa.ok()) throw new Error(`MFA de ${credentials.email} en ${tenant}: ${mfa.status()} ${await mfa.text()}`);
  return ((await mfa.json()) as { accessToken: string }).accessToken;
};

/** Cliente de la API con un token y un tenant elegidos a mano: `x-tenant` viaja con cada petición. */
export const apiOn = (request: APIRequestContext, tenant: string, accessToken: string) => {
  const headers = { Authorization: `Bearer ${accessToken}`, 'x-tenant': tenant };
  return {
    get: (path: string) => request.get(`${API_URL}${path}`, { headers }),
    post: (path: string, data?: unknown) => request.post(`${API_URL}${path}`, { headers, data }),
    patch: (path: string, data?: unknown) => request.patch(`${API_URL}${path}`, { headers, data }),
    delete: (path: string) => request.delete(`${API_URL}${path}`, { headers }),
  };
};

export type TenantApi = ReturnType<typeof apiOn>;
