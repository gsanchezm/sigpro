import { describe, expect, it } from 'vitest';
import { filterSuppliers, toSupplierDto, type SupplierRecord } from './supplier-query';

const record = (id: string, name: string, nif: string, programs: readonly string[], approved = true): SupplierRecord => ({
  id,
  name,
  nif,
  contactEmail: `${id}@proveedor.example`,
  approved,
  contracts: programs.map((code, i) => ({ programCode: code, amountEur: 100_000 * (i + 1), signedAt: new Date('2025-03-15T00:00:00.000Z'), program: { name: `Programa ${code}` } })),
});

const rows = [
  record('s2', 'Sistemas Ibéricos S.A.', 'B12222222', ['PRG-003', 'PRG-004']),
  record('s1', 'Aeronáutica Levante S.L.', 'B11111111', ['PRG-002', 'PRG-001']),
  record('s5', 'Cibertáctica Norte', 'B15555555', ['PRG-009'], false),
];
const dtos = rows.map(toSupplierDto);

describe('toSupplierDto', () => {
  it('ordena los contratos por programa, formatea la fecha y trae el nombre del programa', () => {
    const [s1] = dtos.filter((dto) => dto.id === 's1');
    expect(s1?.contracts.map((c) => c.programCode)).toEqual(['PRG-001', 'PRG-002']);
    expect(s1?.contracts[0]).toEqual({ programCode: 'PRG-001', programName: 'Programa PRG-001', amountEur: 200_000, signedAt: '2025-03-15' });
  });

  it('no modifica el registro de entrada', () => {
    const before = rows[1]?.contracts.map((c) => c.programCode);
    toSupplierDto(rows[1] as SupplierRecord);
    expect(rows[1]?.contracts.map((c) => c.programCode)).toEqual(before);
  });
});

describe('filterSuppliers', () => {
  it('sin filtros devuelve todos ordenados por nombre', () => {
    expect(filterSuppliers(dtos, {}).map((s) => s.id)).toEqual(['s1', 's5', 's2']);
  });

  it('q busca en el nombre y en el NIF sin distinguir mayúsculas', () => {
    expect(filterSuppliers(dtos, { q: 'IBÉRICOS' }).map((s) => s.id)).toEqual(['s2']);
    expect(filterSuppliers(dtos, { q: 'b1555' }).map((s) => s.id)).toEqual(['s5']);
    expect(filterSuppliers(dtos, { q: '  s.l.  ' }).map((s) => s.id)).toEqual(['s1']);
  });

  it('q vacío o solo espacios no filtra; sin coincidencias devuelve vacío', () => {
    expect(filterSuppliers(dtos, { q: '   ' })).toHaveLength(3);
    expect(filterSuppliers(dtos, { q: 'zzz' })).toEqual([]);
  });

  it('program deja solo los contratados en ese programa y se combina con q', () => {
    expect(filterSuppliers(dtos, { program: 'PRG-001' }).map((s) => s.id)).toEqual(['s1']);
    expect(filterSuppliers(dtos, { program: 'PRG-003', q: 'levante' })).toEqual([]);
    expect(filterSuppliers(dtos, { program: 'PRG-999' })).toEqual([]);
  });
});
