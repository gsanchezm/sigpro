import type { SupplierDto } from '@sigpro/shared';
import { describe, expect, it } from 'vitest';
import { SUPPLIER_OPTIONS_MAX, approvalState, contractAmountFor, limitOptions, totalContracted } from './supplier-view';

const supplier: SupplierDto = {
  id: 's1',
  name: 'Aeronáutica Levante S.L.',
  nif: 'B11111111',
  contactEmail: 'contacto@proveedor1.example',
  approved: true,
  contracts: [
    { programCode: 'PRG-001', programName: 'A', amountEur: 150_000, signedAt: '2025-01-15' },
    { programCode: 'PRG-002', programName: 'B', amountEur: 250_000, signedAt: '2025-01-15' },
  ],
};

describe('limitOptions', () => {
  it('muestra como mucho 5 y cuenta las ocultas', () => {
    expect(SUPPLIER_OPTIONS_MAX).toBe(5);
    expect(limitOptions([1, 2, 3, 4, 5, 6, 7])).toEqual({ shown: [1, 2, 3, 4, 5], hidden: 2 });
  });

  it('con 5 o menos no oculta nada', () => {
    expect(limitOptions([1, 2, 3, 4, 5])).toEqual({ shown: [1, 2, 3, 4, 5], hidden: 0 });
    expect(limitOptions([])).toEqual({ shown: [], hidden: 0 });
  });

  it('admite otro máximo', () => {
    expect(limitOptions(['a', 'b', 'c'], 2)).toEqual({ shown: ['a', 'b'], hidden: 1 });
  });
});

describe('contratos del proveedor', () => {
  it('importe con un programa concreto, o null si no hay contrato', () => {
    expect(contractAmountFor(supplier, 'PRG-002')).toBe(250_000);
    expect(contractAmountFor(supplier, 'PRG-009')).toBeNull();
  });

  it('suma de todos los contratos', () => {
    expect(totalContracted(supplier)).toBe(400_000);
    expect(totalContracted({ ...supplier, contracts: [] })).toBe(0);
  });

  it('estado del badge', () => {
    expect(approvalState(supplier)).toBe('approved');
    expect(approvalState({ approved: false })).toBe('not_approved');
  });
});
