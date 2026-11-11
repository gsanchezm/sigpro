import { ApiError } from '@sigpro/shared';
import { describe, expect, it } from 'vitest';
import { commentErrorKey, failureKind } from './failures';

const apiError = (status: number, errors?: Readonly<Record<string, string>>): ApiError =>
  new ApiError(status, { statusCode: status, error: 'x', message: 'x', ...(errors ? { errors } : {}) }, `trace ${status}`);

describe('failureKind', () => {
  it('traduce el código HTTP a un tipo de fallo', () => {
    expect(failureKind(apiError(403))).toBe('denied');
    expect(failureKind(apiError(409))).toBe('invalid');
    expect(failureKind(apiError(422))).toBe('validation');
    expect(failureKind(apiError(404))).toBe('notFound');
    expect(failureKind(apiError(503))).toBe('other');
    expect(failureKind(new Error('red'))).toBe('other');
  });

  it('lee el error del campo comentario de un 422', () => {
    expect(commentErrorKey(apiError(422, { comment: 'closureShort' }))).toBe('closureShort');
    expect(commentErrorKey(apiError(422))).toBeNull();
    expect(commentErrorKey(new Error('x'))).toBeNull();
  });
});
