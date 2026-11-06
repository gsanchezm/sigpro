import { ApiError, createTranslator, type ApiErrorBody } from '@sigpro/shared';
import { describe, expect, it } from 'vitest';
import { formatTrace, toAuthError } from './errors';

const apiError = (status: number, body: Partial<ApiErrorBody>, trace: string) =>
  new ApiError(status, { statusCode: status, error: 'x', message: body.message ?? 'x', ...body }, trace);

const t = createTranslator('es');

describe('toAuthError', () => {
  it('401 muestra el mensaje y la traza con el nº de intentos', () => {
    const error = apiError(401, { code: 'invalid_credentials', attempts: 2 }, 'POST /api/auth/login → 401 Unauthorized');
    expect(toAuthError(error, t)).toEqual({ title: 'Correo o contraseña incorrectos', trace: 'POST /api/auth/login → 401 Unauthorized · attempts=2' });
  });

  it('423 cuenta bloqueada', () => {
    const error = apiError(423, { code: 'account_locked' }, 'POST /api/auth/login → 423 Locked');
    expect(toAuthError(error, t)).toEqual({
      title: 'Cuenta bloqueada tras varios intentos fallidos. Contacta con un administrador.',
      trace: 'POST /api/auth/login → 423 Locked',
    });
  });

  it('403 pendiente de aprobación incluye el motivo', () => {
    const error = apiError(403, { code: 'pending_approval' }, 'POST /api/auth/login → 403 Forbidden');
    expect(toAuthError(error, t).trace).toBe('POST /api/auth/login → 403 Forbidden · reason=pending_approval');
  });

  it('409 correo existente incluye el campo', () => {
    const error = apiError(409, { code: 'email_exists' }, 'POST /api/auth/register → 409 Conflict');
    expect(toAuthError(error, t)).toEqual({ title: 'Ya existe una cuenta con ese correo.', trace: 'POST /api/auth/register → 409 Conflict · field=email' });
  });

  it('código MFA incorrecto', () => {
    const error = apiError(401, { code: 'invalid_mfa' }, 'POST /api/auth/mfa → 401 Unauthorized');
    expect(toAuthError(error, t).title).toBe('Código incorrecto o caducado');
  });

  it('un fallo de red usa el mensaje genérico de red', () => {
    const error = apiError(0, { message: 'network' }, 'POST /api/auth/login → network error');
    expect(toAuthError(error, t)).toEqual({ title: 'No se pudo contactar con el servidor', trace: 'POST /api/auth/login → network error' });
  });

  it('un error desconocido (no ApiError) cae en el mensaje genérico', () => {
    expect(toAuthError(new Error('boom'), t)).toEqual({ title: 'Ha ocurrido un error inesperado', trace: '' });
  });

  it('un código sin traducción cae en el mensaje genérico pero conserva la traza', () => {
    const error = apiError(500, { code: 'chaos_error' }, 'POST /api/auth/login → 500 Internal Server Error');
    expect(toAuthError(error, t).title).toBe('Ha ocurrido un error inesperado');
  });
});

describe('formatTrace', () => {
  it('añade el id de traza del servidor cuando existe', () => {
    const error = apiError(503, { traceId: '7f3a-c21d' }, 'GET /api/programs → 503 Service Unavailable');
    expect(formatTrace(error)).toBe('GET /api/programs → 503 Service Unavailable · trace 7f3a-c21d');
  });

  it('sin traceId devuelve solo la traza HTTP; con otro error, vacío', () => {
    expect(formatTrace(apiError(500, {}, 'GET /api/x → 500'))).toBe('GET /api/x → 500');
    expect(formatTrace(new Error('x'))).toBe('');
  });
});
