import { describe, expect, it } from 'vitest';
import { ApiError } from './client';
import { isEmailDomainError, toAuthError } from './error-view';
import { createTranslator } from './i18n';

const emailDomain = () =>
  new ApiError(
    422,
    { statusCode: 422, error: 'Unprocessable Entity', message: 'email_domain_not_allowed', code: 'email_domain_not_allowed', errors: { email: 'emailDomain' } },
    'POST /api/auth/register → 422 Unprocessable Entity',
  );

describe('422 de correo no permitido (RESTRICT_EMAIL_DOMAINS)', () => {
  it('se reconoce por su código y no se confunde con otros errores', () => {
    expect(isEmailDomainError(emailDomain())).toBe(true);
    expect(isEmailDomainError(new ApiError(409, { statusCode: 409, error: 'Conflict', message: 'email_exists', code: 'email_exists' }, 'x'))).toBe(false);
    expect(isEmailDomainError(new Error('red'))).toBe(false);
  });

  it('toAuthError lo traduce a un texto claro y a la traza con el campo, sin repetir ninguna dirección', () => {
    const view = toAuthError(emailDomain(), createTranslator('es'));
    expect(view.title).toBe('En este entorno solo se admiten correos ficticios (por ejemplo, nombre@example.com).');
    expect(view.trace).toBe('POST /api/auth/register → 422 Unprocessable Entity · field=email');
  });

  it('también está en inglés', () => {
    expect(toAuthError(emailDomain(), createTranslator('en')).title).toBe('This environment only accepts fictitious emails (for example, name@example.com).');
  });
});
