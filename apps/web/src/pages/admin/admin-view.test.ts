import { describe, expect, it } from 'vitest';
import { filterUsers, isChaosActive, toPercent, userStatus } from './admin-view';

describe('userStatus', () => {
  it('prioriza pendiente, bloqueado y desactivado sobre normal', () => {
    expect(userStatus({ active: true, locked: false, pending: false })).toBe('ok');
    expect(userStatus({ active: true, locked: true, pending: false })).toBe('locked');
    expect(userStatus({ active: true, locked: false, pending: true })).toBe('pending');
    expect(userStatus({ active: false, locked: false, pending: false })).toBe('inactive');
    // varias a la vez: gana la de mayor prioridad
    expect(userStatus({ active: false, locked: true, pending: true })).toBe('pending');
    expect(userStatus({ active: false, locked: true, pending: false })).toBe('locked');
  });
});

describe('filterUsers', () => {
  const users = [
    { name: 'Marta Ruiz', email: 'admin@sigpro.test' },
    { name: 'Andrés Molina', email: 'auditor@sigpro.test' },
    { name: 'Alumno 04', email: 'alumno04@sigpro.lab' },
  ];

  it('busca por nombre o correo sin distinguir mayúsculas', () => {
    expect(filterUsers(users, 'MOLINA').map((user) => user.name)).toEqual(['Andrés Molina']);
    expect(filterUsers(users, '@sigpro.lab').map((user) => user.name)).toEqual(['Alumno 04']);
    expect(filterUsers(users, 'zzz')).toEqual([]);
  });

  it('ignora los espacios de los extremos y devuelve todo con la búsqueda vacía', () => {
    expect(filterUsers(users, '  ruiz ')).toHaveLength(1);
    expect(filterUsers(users, '   ')).toBe(users);
  });
});

describe('modo caos', () => {
  it('convierte la tasa de errores en porcentaje entero', () => {
    expect(toPercent(0.3)).toBe(30);
    expect(toPercent(0.05)).toBe(5);
    expect(toPercent(1)).toBe(100);
  });

  it('está activo si cualquiera de las tres palancas no está en reposo', () => {
    expect(isChaosActive({ latencyMs: 0, errorRate: 0, flakyLabels: false })).toBe(false);
    expect(isChaosActive({ latencyMs: 100, errorRate: 0, flakyLabels: false })).toBe(true);
    expect(isChaosActive({ latencyMs: 0, errorRate: 0.05, flakyLabels: false })).toBe(true);
    expect(isChaosActive({ latencyMs: 0, errorRate: 0, flakyLabels: true })).toBe(true);
  });
});
