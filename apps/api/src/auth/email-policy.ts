import { fail } from '../common/errors';
import { allowedEmailDomains, type Env } from '../config/env';

/** Variables que decide la política: con `RESTRICT_EMAIL_DOMAINS` apagada (por defecto) todo correo es válido. */
export type EmailPolicyEnv = Pick<Env, 'RESTRICT_EMAIL_DOMAINS' | 'ALLOWED_EMAIL_DOMAINS'>;

/** Dominio de un correo (lo que sigue a la última arroba) en minúsculas; `null` si no tiene arroba o el usuario está vacío. */
export const emailDomain = (email: string): string | null => {
  const value = email.trim();
  const at = value.lastIndexOf('@');
  return at < 1 ? null : value.slice(at + 1).toLowerCase();
};

/** Coincidencia EXACTA con la lista: `example.com` no admite `mail.example.com` ni `example.com.evil.net`. */
export const isEmailAllowed = (email: string, env: EmailPolicyEnv): boolean => {
  if (!env.RESTRICT_EMAIL_DOMAINS) return true;
  const domain = emailDomain(email);
  return domain !== null && allowedEmailDomains(env).has(domain);
};

/**
 * 422 si el correo no es de un dominio permitido. Se llama ANTES de leer o escribir nada (base de datos, auditoría,
 * logs), y la respuesta no repite la dirección: solo una clave de i18n (`emailDomain`) para el campo `email`.
 */
export const assertEmailAllowed = (email: string, env: EmailPolicyEnv): void => {
  if (isEmailAllowed(email, env)) return;
  throw fail.unprocessable('email_domain_not_allowed', 'email_domain_not_allowed', { email: 'emailDomain' });
};
