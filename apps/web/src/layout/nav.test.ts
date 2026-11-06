import { describe, expect, it } from 'vitest';
import { breadcrumbsFor, isNavCurrent, navFor } from './nav';

describe('navFor', () => {
  it('admin ve Auditoría y Administración; auditor solo Auditoría; el resto ninguna', () => {
    const keys = (role: Parameters<typeof navFor>[0]) => navFor(role).map((item) => item.key);
    expect(keys('admin')).toEqual(['mission', 'programs', 'requirements', 'verification', 'nc', 'documents', 'audit', 'admin', 'lab']);
    expect(keys('auditor')).toEqual(['mission', 'programs', 'requirements', 'verification', 'nc', 'documents', 'audit', 'lab']);
    expect(keys('consultant')).toEqual(['mission', 'programs', 'requirements', 'verification', 'nc', 'documents', 'lab']);
  });
});

describe('isNavCurrent', () => {
  const programs = navFor('admin').find((item) => item.key === 'programs');
  const requirements = navFor('admin').find((item) => item.key === 'requirements');

  it('Programas es la actual en la lista y el detalle, pero no en Requisitos', () => {
    expect(isNavCurrent('/programs', programs!)).toBe(true);
    expect(isNavCurrent('/programs/PRG-001', programs!)).toBe(true);
    expect(isNavCurrent('/programs/PRG-001/requirements', programs!)).toBe(false);
    expect(isNavCurrent('/programs/PRG-001/requirements', requirements!)).toBe(true);
  });
});

describe('breadcrumbsFor', () => {
  const labels = { home: 'Inicio', programs: 'Programas', requirements: 'Requisitos', edit: 'Editar', other: (key: string) => key.toUpperCase() };

  it('lista de programas: Inicio / Programas', () => {
    expect(breadcrumbsFor('/programs', labels)).toEqual([{ label: 'Inicio', to: '/' }, { label: 'Programas' }]);
  });

  it('detalle: Inicio / Programas / código', () => {
    expect(breadcrumbsFor('/programs/PRG-004', labels)).toEqual([{ label: 'Inicio', to: '/' }, { label: 'Programas', to: '/programs' }, { label: 'PRG-004' }]);
  });

  it('requisitos de un programa', () => {
    expect(breadcrumbsFor('/programs/PRG-001/requirements', labels)).toEqual([
      { label: 'Inicio', to: '/' },
      { label: 'Programas', to: '/programs' },
      { label: 'PRG-001', to: '/programs/PRG-001' },
      { label: 'Requisitos' },
    ]);
  });

  it('otras secciones usan su propia etiqueta', () => {
    expect(breadcrumbsFor('/lab', labels)).toEqual([{ label: 'Inicio', to: '/' }, { label: 'LAB' }]);
  });
});

describe('breadcrumbsFor (fase 2)', () => {
  const labels = { home: 'Inicio', programs: 'Programas', requirements: 'Requisitos', edit: 'Editar', other: (key: string) => key.toUpperCase() };

  it('edición de un programa', () => {
    expect(breadcrumbsFor('/programs/PRG-001/edit', labels)).toEqual([
      { label: 'Inicio', to: '/' },
      { label: 'Programas', to: '/programs' },
      { label: 'PRG-001', to: '/programs/PRG-001' },
      { label: 'Editar' },
    ]);
  });

  it('el detalle de otra sección enlaza con su lista', () => {
    expect(breadcrumbsFor('/verification/TC-001', labels)).toEqual([{ label: 'Inicio', to: '/' }, { label: 'VERIFICATION', to: '/verification' }, { label: 'TC-001' }]);
    expect(breadcrumbsFor('/documents/DOC-002', labels)).toEqual([{ label: 'Inicio', to: '/' }, { label: 'DOCUMENTS', to: '/documents' }, { label: 'DOC-002' }]);
  });
});
