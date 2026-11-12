import { ApiError, type TestRunDto } from '@sigpro/shared';
import { describe, expect, it } from 'vitest';
import { describeRunFailure, savedToastBody, validateRun } from './run';

const message = (key: string): string => `«${key}»`;
const apiError = (status: number, errors?: Record<string, string>): ApiError =>
  new ApiError(status, { statusCode: status, error: 'x', message: 'x', ...(errors ? { errors } : {}) }, `POST /api/test-cases/TC-005/runs → ${status}`);

describe('validateRun', () => {
  it('el resultado es obligatorio', () => {
    expect(validateRun('', '')).toEqual({ success: false, errors: { result: 'resultRequired' } });
  });

  it('con resultado válido devuelve las notas recortadas', () => {
    expect(validateRun('fail', '  entorno caído  ')).toEqual({ success: true, data: { result: 'fail', notes: 'entorno caído' } });
    expect(validateRun('pass', '')).toEqual({ success: true, data: { result: 'pass', notes: '' } });
  });

  it('más de 1000 caracteres de notas es un error del campo de notas', () => {
    expect(validateRun('pass', 'x'.repeat(1001))).toEqual({ success: false, errors: { notes: 'notesLong' } });
    expect(validateRun('pass', 'x'.repeat(1000)).success).toBe(true);
  });

  it('informa de los dos errores a la vez', () => {
    expect(validateRun('', 'x'.repeat(1001))).toEqual({ success: false, errors: { result: 'resultRequired', notes: 'notesLong' } });
  });
});

describe('describeRunFailure', () => {
  it('422: el mensaje del primer campo con error y, si es el resultado, su error', () => {
    expect(describeRunFailure(apiError(422, { result: 'resultRequired' }), message, 'genérico')).toEqual({ status: '422', text: '«resultRequired»', resultError: 'resultRequired' });
    expect(describeRunFailure(apiError(422, { files: 'fileBadTypeServer' }), message, 'genérico')).toEqual({ status: '422', text: '«fileBadTypeServer»', resultError: null });
    expect(describeRunFailure(apiError(422, { files: 'tooManyFiles' }), message, 'genérico').text).toBe('«tooManyFiles»');
  });

  it('422 sin detalle por campo: «Campo obligatorio»', () => {
    expect(describeRunFailure(apiError(422, {}), message, 'genérico').text).toBe('«required»');
  });

  it('413 (el archivo pasa del límite del servidor): «Un archivo supera los 2 MB»', () => {
    expect(describeRunFailure(apiError(413), message, 'genérico')).toEqual({ status: '413', text: '«fileTooBigServer»', resultError: null });
  });

  it('otros códigos: la traza HTTP', () => {
    expect(describeRunFailure(apiError(503), message, 'genérico')).toEqual({ status: '503', text: 'POST /api/test-cases/TC-005/runs → 503', resultError: null });
  });

  it('un fallo de red (código 0) se muestra con «—»; algo que no es de la API, con el texto genérico', () => {
    expect(describeRunFailure(apiError(0), message, 'genérico').status).toBe('—');
    expect(describeRunFailure(new Error('boom'), message, 'genérico')).toEqual({ status: '—', text: 'genérico', resultError: null });
  });
});

describe('savedToastBody', () => {
  const run = (evidences: number): TestRunDto => ({
    id: 'RUN-051',
    testCaseCode: 'TC-005',
    executedAt: '2026-11-12T09:30:00.000Z',
    result: 'blocked',
    notes: '',
    executedById: 'u3',
    executedByName: 'Lucía Fernández',
    evidences: Array.from({ length: evidences }, (_, index) => ({ id: `EV-${index}`, filename: 'a.png', mimeType: 'image/png', size: 1, url: '/evidence/x' })),
  });
  const parts = { body: 'TC-005: Bloqueado', files: (count: number) => `con ${count} archivo(s) de evidencia` };

  it('lleva el código de la ejecución y, si hay archivos, cuántos', () => {
    expect(savedToastBody(run(0), parts)).toBe('TC-005: Bloqueado · RUN-051');
    expect(savedToastBody(run(2), parts)).toBe('TC-005: Bloqueado · RUN-051 con 2 archivo(s) de evidencia');
  });
});
