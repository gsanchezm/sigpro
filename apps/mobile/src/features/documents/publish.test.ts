import { ApiError } from '@sigpro/shared';
import { describe, expect, it } from 'vitest';
import { fieldErrorsOf, linesOf, textOfPages, validatePublish, withTextError, withoutError } from './publish';

const apiError = (status: number, errors?: Readonly<Record<string, string>>): ApiError =>
  new ApiError(status, { statusCode: status, error: 'x', message: 'x', ...(errors ? { errors } : {}) }, `trace ${status}`);

describe('textOfPages / linesOf', () => {
  it('el contenido de la última versión se precarga como una línea por fila', () => {
    expect(textOfPages([['Título', '', '1. Objeto'], ['Texto']])).toBe('Título\n\n1. Objeto\nTexto');
    expect(textOfPages([[]])).toBe('');
  });

  it('las filas vacías del final no cuentan, pero las del medio sí', () => {
    expect(linesOf('uno\n\ndos\n\n\n')).toEqual(['uno', '', 'dos']);
    expect(linesOf('uno\n   \n')).toEqual(['uno']);
  });

  it('un salto de línea de Windows no deja un \\r en cada línea', () => {
    expect(linesOf('uno\r\ndos\r\n')).toEqual(['uno', 'dos']);
  });

  it('un texto vacío o solo de espacios no tiene líneas', () => {
    expect(linesOf('')).toEqual([]);
    expect(linesOf('\n  \n\n')).toEqual([]);
  });

  it('ida y vuelta: el texto de las páginas vuelve a las mismas líneas', () => {
    const pages = [['Especificación técnica PRG-001', '', '1. Objeto'], ['Texto de la versión']];
    expect(linesOf(textOfPages(pages))).toEqual(pages.flat());
  });
});

describe('validatePublish', () => {
  it('contenido vacío: linesRequired bajo el campo de texto', () => {
    expect(validatePublish('', '')).toEqual({ success: false, errors: { lines: 'linesRequired', text: 'linesRequired' } });
    expect(validatePublish('\n\n', '')).toMatchObject({ success: false, errors: { text: 'linesRequired' } });
  });

  it('81 líneas: linesMax; 80 pasan', () => {
    const many = Array.from({ length: 81 }, (_, index) => `línea ${index}`).join('\n');
    expect(validatePublish(many, '')).toMatchObject({ success: false, errors: { text: 'linesMax' } });
    expect(validatePublish(Array.from({ length: 80 }, (_, index) => `línea ${index}`).join('\n'), '').success).toBe(true);
  });

  it('una línea de 201 caracteres: lineLong (clave lines.N); 200 pasan', () => {
    expect(validatePublish(`corta\n${'x'.repeat(201)}`, '')).toMatchObject({ success: false, errors: { 'lines.1': 'lineLong', text: 'lineLong' } });
    expect(validatePublish(`corta\n${'x'.repeat(200)}`, '').success).toBe(true);
  });

  it('la nota admite hasta 200 caracteres y se recorta', () => {
    expect(validatePublish('texto', 'n'.repeat(201))).toMatchObject({ success: false, errors: { note: 'noteLong' } });
    expect(validatePublish('texto', '  se añade el glosario  ')).toEqual({ success: true, data: { lines: ['texto'], note: 'se añade el glosario' } });
  });

  it('un contenido válido viaja como líneas, con las filas del medio y sin las del final', () => {
    expect(validatePublish('Especificación\n\n1. Objeto\nTexto nuevo\n\n', '')).toEqual({
      success: true,
      data: { lines: ['Especificación', '', '1. Objeto', 'Texto nuevo'], note: '' },
    });
  });
});

describe('errores', () => {
  it('lines y lines.N pasan a text; sin ellos, los errores no cambian', () => {
    expect(withTextError({ lines: 'linesMax' })).toEqual({ lines: 'linesMax', text: 'linesMax' });
    expect(withTextError({ 'lines.3': 'lineLong', note: 'noteLong' })).toEqual({ 'lines.3': 'lineLong', note: 'noteLong', text: 'lineLong' });
    expect(withTextError({ note: 'noteLong' })).toEqual({ note: 'noteLong' });
  });

  it('un 422 da los errores por campo; el resto de fallos, null', () => {
    expect(fieldErrorsOf(apiError(422, { lines: 'linesRequired' }))).toEqual({ lines: 'linesRequired', text: 'linesRequired' });
    expect(fieldErrorsOf(apiError(422))).toEqual({});
    expect(fieldErrorsOf(apiError(403))).toBeNull();
    expect(fieldErrorsOf(apiError(503))).toBeNull();
    expect(fieldErrorsOf(new Error('red'))).toBeNull();
  });

  it('corregir un campo quita solo su error', () => {
    expect(withoutError({ text: 'linesMax', note: 'noteLong' }, 'text')).toEqual({ note: 'noteLong' });
  });
});
