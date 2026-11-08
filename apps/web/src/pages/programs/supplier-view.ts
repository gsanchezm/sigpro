import type { SupplierDto } from '@sigpro/shared';

// Reglas puras de la sección «Proveedores» del programa (sin React, con tests).

/** Opciones que enseña el combobox: el resto se resume en «n más: afina la búsqueda». */
export const SUPPLIER_OPTIONS_MAX = 5;

export const limitOptions = <T>(items: readonly T[], max = SUPPLIER_OPTIONS_MAX): { readonly shown: readonly T[]; readonly hidden: number } => ({
  shown: items.slice(0, max),
  hidden: Math.max(0, items.length - max),
});

/** Importe del contrato de un proveedor con un programa (`null` si no tiene contrato con él). */
export const contractAmountFor = (supplier: SupplierDto, programCode: string): number | null =>
  supplier.contracts.find((contract) => contract.programCode === programCode)?.amountEur ?? null;

export const totalContracted = (supplier: SupplierDto): number => supplier.contracts.reduce((sum, contract) => sum + contract.amountEur, 0);

/** Estado del badge (`data-state`): los locators CSS distinguen aprobados de no aprobados. */
export const approvalState = (supplier: Pick<SupplierDto, 'approved'>): 'approved' | 'not_approved' => (supplier.approved ? 'approved' : 'not_approved');
