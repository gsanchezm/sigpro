import { expect, type APIRequestContext } from '@playwright/test';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// Constantes de la pila «endurecida» (support/start-hardened-api.mjs + servidor de desarrollo de la web con VITE_LAB_PUBLIC=false).
export const HARDENED_API = process.env.E2E_HARDENED_API_URL ?? 'http://localhost:3200/api';
export const HARDENED_WEB = process.env.E2E_HARDENED_WEB_URL ?? 'http://localhost:5199';
export const HARDENED_ADMIN_KEY = 'e2e-endurecido-admin-key';
export const HARDENED_LOG = process.env.E2E_HARDENED_LOG ?? join(tmpdir(), 'sigpro-e2e-hardened-api.log');

/** Contraseña pública del usuario administrador de cada tenant de alumno (la misma en todos). */
export const STUDENT_PASSWORD = 'Alumno1234!';

export interface TenantRow {
  readonly id: string;
  readonly name: string;
}

/** Los tenants que lista la API endurecida (solo con X-Admin-Key). */
export const listTenants = async (request: APIRequestContext): Promise<readonly TenantRow[]> => {
  const response = await request.get(`${HARDENED_API}/config/tenants`, { headers: { 'x-admin-key': HARDENED_ADMIN_KEY } });
  expect(response.status()).toBe(200);
  return (await response.json()) as TenantRow[];
};

/** Ids de los tenants de alumno con sufijo (`alumno01-k4x9`): `demo` no cuenta. */
export const studentTenants = async (request: APIRequestContext): Promise<readonly string[]> =>
  (await listTenants(request)).map((tenant) => tenant.id).filter((id) => id.startsWith('alumno'));

export interface Login {
  readonly accessToken: string;
  readonly refreshToken: string;
}

/** Login del usuario administrador del tenant (`<tenant>@sigpro.lab`, sin MFA). */
export const loginStudent = async (request: APIRequestContext, tenant: string): Promise<Login> => {
  const response = await request.post(`${HARDENED_API}/auth/login`, { headers: { 'x-tenant': tenant }, data: { email: `${tenant}@sigpro.lab`, password: STUDENT_PASSWORD, remember: false } });
  expect(response.status(), 'login del alumno').toBe(200);
  return (await response.json()) as Login;
};
