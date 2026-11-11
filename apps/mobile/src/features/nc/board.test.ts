import type { NcState } from '@sigpro/shared';
import { describe, expect, it } from 'vitest';
import { boardColumns, columnLabel, countOpen, summarize } from './board';

const item = (code: string, state: NcState) => ({ code, state });

describe('boardColumns', () => {
  it('devuelve las cinco columnas en orden, también las vacías', () => {
    const columns = boardColumns([item('NC-001', 'closed')]);
    expect(columns.map((column) => column.state)).toEqual(['open', 'in_analysis', 'corrective_action', 'closed', 'rejected']);
    expect(columns.map((column) => column.cards.length)).toEqual([0, 0, 0, 1, 0]);
  });

  it('conserva el orden recibido dentro de cada columna', () => {
    const columns = boardColumns([item('NC-003', 'open'), item('NC-001', 'open'), item('NC-002', 'in_analysis')]);
    expect(columns[0]?.cards.map((card) => card.code)).toEqual(['NC-003', 'NC-001']);
    expect(columns[1]?.cards.map((card) => card.code)).toEqual(['NC-002']);
  });
});

describe('countOpen', () => {
  it('cuenta lo que no está cerrado ni rechazado', () => {
    const items = [item('a', 'open'), item('b', 'in_analysis'), item('c', 'corrective_action'), item('d', 'closed'), item('e', 'rejected')];
    expect(countOpen(items)).toBe(3);
  });
});

describe('columnLabel', () => {
  it('une estado y recuento con un punto medio', () => {
    expect(columnLabel('En análisis', 2)).toBe('En análisis · 2');
  });
});

describe('summarize', () => {
  it('pasa el HTML del editor a texto plano', () => {
    expect(summarize('<p><strong>Hola</strong> mundo</p>', 110)).toBe('Hola mundo');
  });

  it('recorta con puntos suspensivos sin pasarse del máximo', () => {
    const result = summarize(`<p>${'a'.repeat(120)}</p>`, 110);
    expect(result).toHaveLength(110);
    expect(result.endsWith('…')).toBe(true);
  });
});
