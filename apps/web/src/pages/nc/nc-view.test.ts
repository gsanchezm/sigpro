import { describe, expect, it } from 'vitest';
import { closureErrorKey, commentBadgeCount, diffNcDraft, dropHint, fieldError, moveItemTo, truncateText, type NcEditable } from './nc-view';

describe('commentBadgeCount', () => {
  it('muestra el número real salvo con el defecto plantado y más de dos comentarios', () => {
    expect([0, 1, 2, 3, 5].map((count) => commentBadgeCount(count, false))).toEqual([0, 1, 2, 3, 5]);
    expect([0, 1, 2, 3, 5].map((count) => commentBadgeCount(count, true))).toEqual([0, 1, 2, 2, 4]);
  });
});

describe('moveItemTo', () => {
  const items = [
    { code: 'NC-001', state: 'open' as const },
    { code: 'NC-002', state: 'closed' as const },
  ];

  it('mueve solo la tarjeta indicada y no muta el original', () => {
    const moved = moveItemTo(items, 'NC-001', 'in_analysis');
    expect(moved.map((item) => item.state)).toEqual(['in_analysis', 'closed']);
    expect(items[0]?.state).toBe('open');
  });

  it('un código inexistente deja la lista igual', () => {
    expect(moveItemTo(items, 'NC-999', 'rejected')).toEqual(items);
  });
});

describe('dropHint', () => {
  it('distingue columna de origen, destinos válidos e inválidos', () => {
    expect(dropHint('open', 'open')).toBe('same');
    expect(dropHint('open', 'in_analysis')).toBe('valid');
    expect(dropHint('open', 'closed')).toBe('invalid');
    expect(dropHint('corrective_action', 'closed')).toBe('valid');
    expect(dropHint('closed', 'open')).toBe('invalid');
  });
});

describe('diffNcDraft', () => {
  const original: NcEditable = { severity: 'major', description: '<p>Desviación detectada</p>', assigneeId: 'u1' };

  it('sin cambios devuelve null', () => {
    expect(diffNcDraft(original, { ...original })).toBeNull();
  });

  it('solo incluye los campos que cambian', () => {
    expect(diffNcDraft(original, { ...original, severity: 'critical' })).toEqual({ severity: 'critical' });
    expect(diffNcDraft(original, { ...original, assigneeId: null })).toEqual({ assigneeId: null });
    expect(diffNcDraft(original, { ...original, description: '<p>Otra descripción</p>' })).toEqual({ description: '<p>Otra descripción</p>' });
  });

  it('compara la descripción ya saneada: el HTML equivalente no cuenta como cambio', () => {
    expect(diffNcDraft(original, { ...original, description: '<p onclick="x()">Desviación detectada</p>' })).toBeNull();
  });
});

describe('closureErrorKey', () => {
  it('vacío → obligatorio; corto → closureShort; suficiente → null', () => {
    expect(closureErrorKey('   ', false)).toBe('closureRequired');
    expect(closureErrorKey('a'.repeat(5), false)).toBe('closureShort');
    expect(closureErrorKey('a'.repeat(19), false)).toBe('closureShort');
    expect(closureErrorKey('a'.repeat(20), false)).toBeNull();
  });

  it('con el defecto plantado acepta 19 caracteres', () => {
    expect(closureErrorKey('a'.repeat(19), true)).toBeNull();
    expect(closureErrorKey('a'.repeat(18), true)).toBe('closureShort');
  });
});

describe('fieldError y truncateText', () => {
  it('lee el error de un campo o devuelve null', () => {
    expect(fieldError({ comment: 'closureShort' }, 'comment')).toBe('closureShort');
    expect(fieldError({ comment: 'closureShort' }, 'other')).toBeNull();
    expect(fieldError(undefined, 'comment')).toBeNull();
  });

  it('recorta con puntos suspensivos solo si hace falta', () => {
    expect(truncateText('corto', 10)).toBe('corto');
    expect(truncateText('a'.repeat(30), 10)).toBe(`${'a'.repeat(9)}…`);
  });
});
