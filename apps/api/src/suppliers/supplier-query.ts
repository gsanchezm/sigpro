import type { SupplierDto, SupplierListQuery } from '@sigpro/shared';

// Parte pura de la API de proveedores: mapeo a DTO y filtrado (nombre o NIF, programa), sin base de datos.

export interface SupplierRecord {
  readonly id: string;
  readonly name: string;
  readonly nif: string;
  readonly contactEmail: string;
  readonly approved: boolean;
  readonly contracts: readonly {
    readonly programCode: string;
    readonly amountEur: number;
    readonly signedAt: Date;
    readonly program: { readonly name: string };
  }[];
}

const isoDate = (date: Date): string => date.toISOString().slice(0, 10);

export const toSupplierDto = (row: SupplierRecord): SupplierDto => ({
  id: row.id,
  name: row.name,
  nif: row.nif,
  contactEmail: row.contactEmail,
  approved: row.approved,
  contracts: [...row.contracts]
    .sort((a, b) => a.programCode.localeCompare(b.programCode))
    .map((contract) => ({ programCode: contract.programCode, programName: contract.program.name, amountEur: contract.amountEur, signedAt: isoDate(contract.signedAt) })),
});

/**
 * `q` busca (sin mayúsculas) en el nombre y en el NIF; `program` deja solo los proveedores con contrato en ese programa.
 * Siempre ordenados por nombre (orden alfabético del español).
 */
export const filterSuppliers = (suppliers: readonly SupplierDto[], query: SupplierListQuery): readonly SupplierDto[] => {
  const text = query.q?.trim().toLowerCase() ?? '';
  const matches = suppliers
    .filter((supplier) => text === '' || supplier.name.toLowerCase().includes(text) || supplier.nif.toLowerCase().includes(text))
    .filter((supplier) => !query.program || supplier.contracts.some((contract) => contract.programCode === query.program));
  return [...matches].sort((a, b) => a.name.localeCompare(b.name, 'es'));
};
