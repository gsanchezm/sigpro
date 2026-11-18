import { ApiException } from '../common/errors';
import { describe, expect, it } from 'vitest';
import { assertEmailAllowed, emailDomain, isEmailAllowed } from './email-policy';

const open = { RESTRICT_EMAIL_DOMAINS: false, ALLOWED_EMAIL_DOMAINS: 'sigpro.test,example.com' } as const;
const closed = { RESTRICT_EMAIL_DOMAINS: true, ALLOWED_EMAIL_DOMAINS: 'sigpro.test,example.com' } as const;

describe('emailDomain', () => {
  it('toma lo que sigue a la última arroba, en minúsculas', () => {
    expect(emailDomain('Ana@Example.COM')).toBe('example.com');
    expect(emailDomain('  ana@sigpro.test ')).toBe('sigpro.test');
    expect(emailDomain('a@b@example.com')).toBe('example.com');
  });

  it('devuelve null si no hay arroba o falta el usuario', () => {
    expect(emailDomain('sin-arroba')).toBeNull();
    expect(emailDomain('@example.com')).toBeNull();
    expect(emailDomain('')).toBeNull();
  });
});

describe('isEmailAllowed', () => {
  it('sin RESTRICT_EMAIL_DOMAINS admite cualquier correo (comportamiento de siempre)', () => {
    expect(isEmailAllowed('persona@gmail.com', open)).toBe(true);
    expect(isEmailAllowed('lo-que-sea', open)).toBe(true);
  });

  it('con RESTRICT_EMAIL_DOMAINS admite sigpro.test y example.com por defecto', () => {
    expect(isEmailAllowed('nuevo@sigpro.test', closed)).toBe(true);
    expect(isEmailAllowed('NUEVO@Example.com', closed)).toBe(true);
  });

  it('rechaza cualquier otro dominio, incluidos los que se le parecen', () => {
    for (const email of ['persona@gmail.com', 'a@mail.example.com', 'a@example.com.evil.net', 'a@xexample.com', 'a@example.co', 'a@sigpro.lab', 'a@example.com.', 'sin-arroba']) {
      expect(isEmailAllowed(email, closed), email).toBe(false);
    }
  });

  it('usa la lista configurada en lugar de la de por defecto', () => {
    const custom = { RESTRICT_EMAIL_DOMAINS: true, ALLOWED_EMAIL_DOMAINS: ' Curso.TEST , example.org ,, ' } as const;
    expect(isEmailAllowed('a@curso.test', custom)).toBe(true);
    expect(isEmailAllowed('a@example.org', custom)).toBe(true);
    expect(isEmailAllowed('a@example.com', custom)).toBe(false);
  });

  it('una lista vacía con la restricción activa rechaza todo', () => {
    expect(isEmailAllowed('a@example.com', { RESTRICT_EMAIL_DOMAINS: true, ALLOWED_EMAIL_DOMAINS: ' , ' })).toBe(false);
  });
});

describe('assertEmailAllowed', () => {
  it('no lanza con un correo permitido', () => {
    expect(() => assertEmailAllowed('nuevo@example.com', closed)).not.toThrow();
  });

  it('lanza 422 con code email_domain_not_allowed y una clave de i18n para el campo email', () => {
    try {
      assertEmailAllowed('persona@gmail.com', closed);
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(ApiException);
      const exception = error as ApiException;
      expect(exception.getStatus()).toBe(422);
      expect(exception.getResponse()).toMatchObject({ statusCode: 422, code: 'email_domain_not_allowed', errors: { email: 'emailDomain' } });
    }
  });

  it('la respuesta NO repite el correo recibido ni su dominio', () => {
    try {
      assertEmailAllowed('persona.real@gmail.com', closed);
      expect.unreachable();
    } catch (error) {
      const text = JSON.stringify((error as ApiException).getResponse());
      expect(text).not.toContain('persona');
      expect(text).not.toContain('gmail');
    }
  });
});
