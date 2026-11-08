import { expect, type APIRequestContext } from '@playwright/test';
import { API_URL, loginByApi, type RoleName } from './auth';

// Ayudas de los specs de Administración, Hitos y Perfil: cabeceras autenticadas, caos por API y login con contraseña.

export interface ChaosPayload {
  readonly latencyMs: number;
  readonly errorRate: number;
  readonly flakyLabels: boolean;
}

export const NO_CHAOS: ChaosPayload = { latencyMs: 0, errorRate: 0, flakyLabels: false };

/** Cabeceras `Authorization` + `x-tenant` de un usuario demo (login por API, con el segundo paso MFA del admin). */
export const authHeaders = async (request: APIRequestContext, role: RoleName, tenant: string): Promise<Record<string, string>> => {
  const { accessToken } = await loginByApi(request, role, tenant);
  return { Authorization: `Bearer ${accessToken}`, 'x-tenant': tenant };
};

/** Login con correo y contraseña (p. ej. `alumnoNN@sigpro.lab`); devuelve el access token. */
export const loginWithPassword = async (request: APIRequestContext, tenant: string, email: string, password: string): Promise<string> => {
  const headers = { 'x-tenant': tenant };
  const login = await request.post(`${API_URL}/auth/login`, { headers, data: { email, password, remember: true } });
  expect(login.status(), `login de ${email}`).toBe(200);
  const body = (await login.json()) as { mfaRequired: boolean; mfaToken?: string; accessToken?: string };
  if (!body.mfaRequired) return body.accessToken as string;
  const mfa = await request.post(`${API_URL}/auth/mfa`, { headers, data: { mfaToken: body.mfaToken, code: '123456' } });
  return ((await mfa.json()) as { accessToken: string }).accessToken;
};

/** Fija el caos del tenant por API (el caos sobrevive al reset: cada spec lo apaga antes y después). */
export const setChaosByApi = async (request: APIRequestContext, tenant: string, payload: ChaosPayload): Promise<void> => {
  const headers = await authHeaders(request, 'admin', tenant);
  const response = await request.patch(`${API_URL}/admin/chaos`, { headers, data: payload });
  expect(response.status(), 'PATCH /admin/chaos').toBe(200);
};

export const chaosOff = (request: APIRequestContext, tenant: string): Promise<void> => setChaosByApi(request, tenant, NO_CHAOS);

/** Configuración pública del tenant (`GET /api/config`), que es lo que lee la web. */
export const readConfig = async (request: APIRequestContext, tenant: string): Promise<{ chaos: ChaosPayload; plantedBugs: boolean }> => {
  const response = await request.get(`${API_URL}/config`, { headers: { 'x-tenant': tenant } });
  expect(response.status()).toBe(200);
  return (await response.json()) as { chaos: ChaosPayload; plantedBugs: boolean };
};
