import { describe, expect, it } from 'vitest';
import { tenantInfoLines, tenantInfoMessage } from './tenant-info';

const labels = { title: 'Información del tenant', tenant: (tenant: string) => `Tenant: ${tenant}`, users: (total: number, active: number) => `Usuarios: ${total} (${active} activos)` };

describe('tenantInfoLines', () => {
  it('compone título, tenant y recuento de usuarios activos', () => {
    const lines = tenantInfoLines({ tenant: 'alumno04', users: [{ active: true }, { active: false }, { active: true }] }, labels);
    expect(lines).toEqual(['Información del tenant', 'Tenant: alumno04', 'Usuarios: 3 (2 activos)']);
  });

  it('sin usuarios no falla', () => {
    expect(tenantInfoLines({ tenant: 'demo', users: [] }, labels)[2]).toBe('Usuarios: 0 (0 activos)');
  });

  it('el aviso nativo separa las líneas con saltos de línea', () => {
    expect(tenantInfoMessage(['a', 'b', 'c'])).toBe('a\nb\nc');
  });
});
