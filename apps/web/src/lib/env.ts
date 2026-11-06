import { DEFAULT_TENANT } from '@sigpro/shared';
import { STORAGE_KEYS, readStorage, writeStorage } from './storage';

/** URL base de la API: `/api` (proxy de Vite) por defecto, o `VITE_API_URL` en producción. */
export const API_URL: string = import.meta.env.VITE_API_URL ?? '/api';

const ENV_TENANT: string = import.meta.env.VITE_TENANT ?? DEFAULT_TENANT;

/** Tenant activo: `?tenant=` > almacenado > `VITE_TENANT` > demo. */
export const getTenant = (): string => readStorage(STORAGE_KEYS.tenant) ?? ENV_TENANT;

export const setTenant = (tenant: string): void => writeStorage(STORAGE_KEYS.tenant, tenant);

/** Guarda el tenant de la URL (`?tenant=alumno01`) al arrancar la app. */
export const adoptTenantFromUrl = (search: string): void => {
  const tenant = new URLSearchParams(search).get('tenant')?.trim();
  if (tenant) setTenant(tenant);
};
