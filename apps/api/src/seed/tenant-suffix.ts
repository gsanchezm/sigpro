import { createHmac } from 'node:crypto';

/**
 * Tenants no adivinables (`TENANT_SUFFIX_SEED`).
 *
 * El sufijo sale de una HMAC-SHA256 de la semilla secreta del despliegue y del id base (`alumno07`), así que es el mismo
 * tras un redeploy, un reseed, cada ejecución de `sigpro-reset` e incluso si la base se recrea: no se guarda en ningún
 * sitio. Sin semilla no hay sufijo y todo queda como siempre (`alumno07`).
 */

/** Base 36 en minúsculas: se lee bien en una URL (`?tenant=`) y dentro de un correo (`alumno07-k4x9@sigpro.lab`). */
const ALPHABET = '0123456789abcdefghijklmnopqrstuvwxyz';

export const MIN_SUFFIX_LENGTH = 3;
export const MAX_SUFFIX_LENGTH = 12;
export const MIN_SEED_LENGTH = 16;

export interface TenantSuffixOptions {
  /** Semilla secreta del despliegue. Vacía = sin sufijos. */
  readonly seed: string;
  /** Caracteres del sufijo (`MIN_SUFFIX_LENGTH`–`MAX_SUFFIX_LENGTH`). */
  readonly length: number;
}

/** Sufijo estable de un id base. Depende solo de la semilla, del id y de la longitud. */
export const tenantSuffix = (seed: string, baseId: string, length: number): string =>
  Array.from(createHmac('sha256', seed).update(baseId).digest().subarray(0, length), (byte) => ALPHABET[byte % ALPHABET.length]).join('');

/** `alumno07` → `alumno07-k4x9` con semilla; el mismo id sin ella. */
export const studentTenantId = (baseId: string, options?: TenantSuffixOptions): string =>
  options && options.seed !== '' ? `${baseId}-${tenantSuffix(options.seed, baseId, options.length)}` : baseId;

/** ¿Este id tiene la forma de un tenant de alumno SIN sufijo (`alumno07`)? Son los que quedan tras activar los sufijos. */
export const isLegacyStudentTenant = (id: string): boolean => /^alumno\d{2,3}$/.test(id);
