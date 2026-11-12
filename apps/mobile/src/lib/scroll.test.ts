import { describe, expect, it } from 'vitest';
import { NEAR_END_MARGIN, isNearEnd } from './scroll';

describe('isNearEnd', () => {
  it('es verdad cuando faltan menos px que el margen y falso si falta más', () => {
    expect(isNearEnd({ offset: 0, viewport: 800, content: 3000 })).toBe(false);
    expect(isNearEnd({ offset: 2000, viewport: 800, content: 3000 })).toBe(true);
    expect(isNearEnd({ offset: 2000 - NEAR_END_MARGIN - 1, viewport: 800, content: 3000 })).toBe(false);
  });

  it('con el contenido más corto que la ventana ya está «al final»', () => {
    expect(isNearEnd({ offset: 0, viewport: 800, content: 500 })).toBe(true);
  });

  it('admite un margen propio', () => {
    expect(isNearEnd({ offset: 1000, viewport: 800, content: 3000 }, 1300)).toBe(true);
    expect(isNearEnd({ offset: 1000, viewport: 800, content: 3000 }, 1000)).toBe(false);
  });
});
