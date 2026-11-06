import { describe, expect, it } from 'vitest';
import { ROLES } from './domain';
import { can, permissionDeniedReason } from './permissions';

describe('can', () => {
  it('admin puede todo sobre programas', () => {
    expect(['program.create', 'program.edit', 'program.archive', 'program.delete', 'program.export'].every((a) => can('admin', a as never))).toBe(true);
  });

  it('program_manager crea, edita y archiva pero no elimina', () => {
    expect(can('program_manager', 'program.create')).toBe(true);
    expect(can('program_manager', 'program.edit')).toBe(true);
    expect(can('program_manager', 'program.archive')).toBe(true);
    expect(can('program_manager', 'program.delete')).toBe(false);
  });

  it('consultant y auditor son de solo lectura sobre programas', () => {
    for (const role of ['consultant', 'auditor'] as const) {
      expect(can(role, 'program.create')).toBe(false);
      expect(can(role, 'program.edit')).toBe(false);
      expect(can(role, 'program.archive')).toBe(false);
      expect(can(role, 'program.delete')).toBe(false);
    }
  });

  it('todos los roles pueden exportar programas', () => {
    expect(ROLES.every((role) => can(role, 'program.export'))).toBe(true);
  });

  it('sigue la matriz de permisos del plan', () => {
    expect(can('program_manager', 'requirement.approve')).toBe(true);
    expect(can('auditor', 'requirement.approve')).toBe(false);
    expect(can('auditor', 'requirement.validate')).toBe(true);
    expect(can('program_manager', 'requirement.validate')).toBe(false);
    expect(can('consultant', 'document.viewRestricted')).toBe(false);
    expect(can('auditor', 'audit.view')).toBe(true);
    expect(can('program_manager', 'audit.view')).toBe(false);
    expect(can('admin', 'users.manage')).toBe(true);
    expect(can('auditor', 'users.manage')).toBe(false);
  });
});

describe('permissionDeniedReason', () => {
  it('devuelve la clave i18n que explica por qué el botón está deshabilitado', () => {
    expect(permissionDeniedReason('program.create')).toBe('roleNoCreate');
    expect(permissionDeniedReason('program.delete')).toBe('roleNoDelete');
  });
});
