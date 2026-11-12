import type { SupplierDto } from '@sigpro/shared';
import { describe, expect, it } from 'vitest';
import { SUPPLIER_OPTIONS_MAX, approvalState, contractAmountFor, limitOptions } from './supplier-view';

const supplier = (over: Partial<SupplierDto> = {}): SupplierDto => ({
  id: 's1',
  name: 'Aeronáutica Levante S.L.',
  nif: 'B11111111',
  contactEmail: 'compras@levante.test',
  approved: true,
  contracts: [{ programCode: 'PRG-001', programName: 'Sistema de mando táctico Ártemis', amountEur: 150000, signedAt: '2026-01-15' }],
  ...over,
});

describe('limitOptions (el buscador enseña como mucho cinco)', () => {
  it('corta la lista y cuenta lo que sobra', () => {
    const items = Array.from({ length: 7 }, (_, index) => index);
    expect(SUPPLIER_OPTIONS_MAX).toBe(5);
    expect(limitOptions(items)).toEqual({ shown: [0, 1, 2, 3, 4], hidden: 2 });
  });

  it('una lista corta no tiene nada oculto', () => {
    expect(limitOptions([1, 2])).toEqual({ shown: [1, 2], hidden: 0 });
  });
});

describe('contractAmountFor', () => {
  it('devuelve el importe del contrato con ese programa', () => {
    expect(contractAmountFor(supplier(), 'PRG-001')).toBe(150000);
  });

  it('sin contrato con el programa, devuelve null', () => {
    expect(contractAmountFor(supplier(), 'PRG-002')).toBeNull();
  });
});

describe('approvalState (data-state del badge)', () => {
  it('distingue aprobados de no aprobados, como la web', () => {
    expect(approvalState({ approved: true })).toBe('approved');
    expect(approvalState({ approved: false })).toBe('not_approved');
  });
});
