import { timingSafeEqual } from 'node:crypto';
import type { IncomingHttpHeaders } from 'node:http';
import { ADMIN_KEY_HEADER } from '@sigpro/shared';
import type { Env } from '../config/env';
import type { AccessPayload } from './auth.types';

/**
 * Credenciales de una petición a una ruta `@Public()`. El guard global se salta esas rutas, así que quien necesite
 * distinguir «con sesión / con clave» de «anónimo» (lista de tenants, usuarios de demo) lo comprueba aquí.
 */

/** Comparación en tiempo constante: la longitud puede filtrarse, el contenido no. */
const safeEqual = (a: string, b: string): boolean => {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
};

/** `X-Admin-Key` válida. */
export const hasAdminKey = (headers: IncomingHttpHeaders, env: Pick<Env, 'ADMIN_KEY'>): boolean => {
  const key = headers[ADMIN_KEY_HEADER];
  return typeof key === 'string' && key !== '' && safeEqual(key, env.ADMIN_KEY);
};

const bearerOf = (header: string | undefined): string | null => {
  const [scheme, token] = (header ?? '').split(' ');
  return scheme?.toLowerCase() === 'bearer' && token ? token : null;
};

/** `Authorization: Bearer` con un access token válido y no caducado. */
export const hasSession = (headers: IncomingHttpHeaders, jwt: { verify: (token: string) => AccessPayload }): boolean => {
  const token = bearerOf(headers.authorization);
  if (!token) return false;
  try {
    return jwt.verify(token).type === 'access';
  } catch {
    return false;
  }
};
