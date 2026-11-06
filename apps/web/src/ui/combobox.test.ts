import { describe, expect, it } from 'vitest';
import { filterOwners, moveActive, pageWindow } from './combobox';

const owners = [
  { id: 'u1', name: 'Marta Ruiz', programCount: 4 },
  { id: 'u2', name: 'Javier Ortega', programCount: 4 },
  { id: 'u3', name: 'Lucía Fernández', programCount: 4 },
];

describe('filterOwners', () => {
  it('sin texto devuelve todos', () => {
    expect(filterOwners(owners, '', null).map((o) => o.id)).toEqual(['u1', 'u2', 'u3']);
  });

  it('filtra por nombre sin distinguir mayúsculas', () => {
    expect(filterOwners(owners, 'mart', null).map((o) => o.id)).toEqual(['u1']);
    expect(filterOwners(owners, 'ORT', null).map((o) => o.id)).toEqual(['u2']);
  });

  it('mantiene siempre la opción seleccionada aunque no coincida', () => {
    expect(filterOwners(owners, 'xyz', 'u3').map((o) => o.id)).toEqual(['u3']);
  });

  it('sin coincidencias devuelve lista vacía', () => {
    expect(filterOwners(owners, 'zzz', null)).toEqual([]);
  });
});

describe('moveActive', () => {
  it('↓ avanza sin pasar del final; ↑ retrocede sin bajar de 0', () => {
    expect(moveActive('ArrowDown', 0, 3)).toBe(1);
    expect(moveActive('ArrowDown', 2, 3)).toBe(2);
    expect(moveActive('ArrowUp', 1, 3)).toBe(0);
    expect(moveActive('ArrowUp', 0, 3)).toBe(0);
  });

  it('con lista vacía se queda en 0', () => {
    expect(moveActive('ArrowDown', 0, 0)).toBe(0);
  });
});

describe('pageWindow', () => {
  it('muestra todas las páginas si son 7 o menos', () => {
    expect(pageWindow(1, 3)).toEqual([1, 2, 3]);
    expect(pageWindow(4, 7)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it('con más páginas muestra la primera, la última y las vecinas de la actual', () => {
    expect(pageWindow(5, 10)).toEqual([1, 4, 5, 6, 10]);
    expect(pageWindow(1, 10)).toEqual([1, 2, 10]);
  });
});
