import type { RegisterInput } from '@sigpro/shared';
import { describe, expect, it, vi } from 'vitest';
import { ApiException } from '../common/errors';
import { loadEnv } from '../config/env';
import { AuthController } from './auth.controller';
import type { AuthService } from './auth.service';

const REGISTER: RegisterInput = { first: 'Ana', last: 'Prueba', email: 'ana@example.com', org: 'Curso', role: 'consultant', password: 'Clave1234!', confirm: 'Clave1234!', terms: true };

const build = (overrides: Record<string, string> = {}) => {
  const register = vi.fn().mockResolvedValue({ requestId: 'REQ-1', status: 'pending_approval', email: 'x', role: 'consultant' });
  const auth = { register } as unknown as AuthService;
  const env = loadEnv({ DATABASE_URL: 'postgresql://x', ...overrides });
  return { controller: new AuthController(auth, env), register };
};

const CLOSED = { RESTRICT_EMAIL_DOMAINS: 'true' };

const failure = (work: () => unknown): ApiException => {
  try {
    work();
  } catch (error) {
    return error as ApiException;
  }
  throw new Error('no ha lanzado');
};

describe('POST /auth/register', () => {
  it('sin variables admite cualquier correo y llega al servicio (como hoy)', () => {
    const { controller, register } = build();
    controller.register({ ...REGISTER, email: 'persona@gmail.com' }, 'demo');
    expect(register).toHaveBeenCalledTimes(1);
  });

  it('con RESTRICT_EMAIL_DOMAINS responde 422 a un correo real y NO llega al servicio (nada se lee, guarda ni audita)', () => {
    const { controller, register } = build(CLOSED);
    const error = failure(() => controller.register({ ...REGISTER, email: 'persona.real@gmail.com' }, 'demo'));
    expect(error.getStatus()).toBe(422);
    expect(error.getResponse()).toMatchObject({ code: 'email_domain_not_allowed', errors: { email: 'emailDomain' } });
    expect(JSON.stringify(error.getResponse())).not.toContain('persona.real');
    expect(register).not.toHaveBeenCalled();
  });

  it('con RESTRICT_EMAIL_DOMAINS admite los dominios ficticios', () => {
    const { controller, register } = build(CLOSED);
    controller.register({ ...REGISTER, email: 'nuevo@sigpro.test' }, 'demo');
    controller.register({ ...REGISTER, email: 'nuevo@example.com' }, 'demo');
    expect(register).toHaveBeenCalledTimes(2);
  });

  it('respeta ALLOWED_EMAIL_DOMAINS', () => {
    const { controller, register } = build({ ...CLOSED, ALLOWED_EMAIL_DOMAINS: 'curso.test' });
    expect(failure(() => controller.register({ ...REGISTER, email: 'a@example.com' }, 'demo')).getStatus()).toBe(422);
    controller.register({ ...REGISTER, email: 'a@curso.test' }, 'demo');
    expect(register).toHaveBeenCalledTimes(1);
  });
});

describe('POST /auth/forgot y /auth/resend', () => {
  it('sin variables responden 202 (cuerpo vacío) con cualquier correo', () => {
    const { controller } = build();
    expect(controller.forgot({ email: 'persona@gmail.com' })).toEqual({});
    expect(controller.resend({ email: 'persona@gmail.com' })).toEqual({});
  });

  it('con RESTRICT_EMAIL_DOMAINS rechazan con 422 los dominios no permitidos', () => {
    const { controller } = build(CLOSED);
    expect(failure(() => controller.forgot({ email: 'persona@gmail.com' })).getStatus()).toBe(422);
    expect(failure(() => controller.resend({ email: 'persona@gmail.com' })).getStatus()).toBe(422);
  });

  it('con RESTRICT_EMAIL_DOMAINS siguen respondiendo 202 a los dominios permitidos', () => {
    const { controller } = build(CLOSED);
    expect(controller.forgot({ email: 'ana@example.com' })).toEqual({});
    expect(controller.resend({ email: 'ana@sigpro.test' })).toEqual({});
  });
});
