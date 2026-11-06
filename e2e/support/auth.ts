import type { APIRequestContext, BrowserContext, Page } from '@playwright/test';

export const API_URL = process.env.E2E_API_URL ?? 'http://localhost:3000/api';
const ADMIN_KEY = process.env.ADMIN_KEY ?? 'dev-admin-key';

/** Usuarios demo del seed (handoff). */
export const USERS = {
  admin: { email: 'admin@sigpro.test', password: 'Admin1234!' },
  program_manager: { email: 'gestor@sigpro.test', password: 'Gestor1234!' },
  consultant: { email: 'consultor@sigpro.test', password: 'Consul1234!' },
  auditor: { email: 'auditor@sigpro.test', password: 'Audit1234!' },
} as const;

export type RoleName = keyof typeof USERS;

interface Tokens {
  readonly refreshToken: string;
  readonly accessToken: string;
}

/** Login por API (incluye el segundo paso MFA del admin). Así los specs no pasan por la pantalla de acceso. */
export const loginByApi = async (request: APIRequestContext, role: RoleName, tenant: string): Promise<Tokens> => {
  const headers = { 'x-tenant': tenant };
  const login = await request.post(`${API_URL}/auth/login`, { headers, data: { ...USERS[role], remember: true } });
  if (!login.ok()) throw new Error(`Login de ${role} en ${tenant} falló: ${login.status()} ${await login.text()}`);
  const body = (await login.json()) as { mfaRequired: boolean; mfaToken?: string } & Partial<Tokens>;
  if (!body.mfaRequired) return body as Tokens;
  const mfa = await request.post(`${API_URL}/auth/mfa`, { headers, data: { mfaToken: body.mfaToken, code: '123456' } });
  return (await mfa.json()) as Tokens;
};

/** Restaura el seed de un tenant (X-Admin-Key + x-tenant). Llamar en `beforeAll` de los specs que mutan datos. */
export const resetTenant = async (request: APIRequestContext, tenant: string): Promise<void> => {
  const response = await request.post(`${API_URL}/admin/reset`, { headers: { 'x-admin-key': ADMIN_KEY, 'x-tenant': tenant } });
  if (!response.ok()) throw new Error(`Reset de ${tenant} falló: ${response.status()}`);
};

export interface SeedOptions {
  readonly tenant?: string;
  readonly cookies?: boolean;
  readonly theme?: 'light' | 'dark';
  readonly lang?: 'es' | 'en';
}

/** Prepara el almacenamiento del navegador (tenant, tema, idioma, aviso de cookies) antes de cargar la app. */
export const seedStorage = async (context: BrowserContext, options: SeedOptions & { refreshToken?: string } = {}): Promise<void> => {
  const { tenant = 'demo', cookies = true, theme = 'light', lang = 'es', refreshToken } = options;
  await context.addInitScript(
    (values) => {
      localStorage.setItem('sigpro.tenant', values.tenant);
      localStorage.setItem('sigpro.theme', values.theme);
      localStorage.setItem('sigpro.lang', values.lang);
      if (values.cookies) localStorage.setItem('sigpro.cookies', 'accepted');
      if (values.refreshToken) localStorage.setItem('sigpro.session', JSON.stringify({ refreshToken: values.refreshToken, remember: true }));
    },
    { tenant, theme, lang, cookies, refreshToken },
  );
};

/** Deja la página con sesión iniciada como `role` (sin pasar por la UI de acceso) y navega a `path`. */
export const openAs = async (page: Page, role: RoleName, path = '/programs', options: SeedOptions = {}): Promise<void> => {
  const tenant = options.tenant ?? 'demo';
  const { refreshToken } = await loginByApi(page.request, role, tenant);
  await seedStorage(page.context(), { ...options, tenant, refreshToken });
  await page.goto(path);
};
