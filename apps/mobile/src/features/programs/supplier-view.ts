// Reglas puras de la sección «Proveedores» del programa en móvil (la misma lógica que la web en `supplier-view.ts`). Sin
// react-native: se prueba con Vitest (`supplier-view.test.ts`).
import type { SupplierDto } from '@sigpro/shared';

/** Opciones que enseña el buscador: el resto se resume en «n más: afina la búsqueda». */
export const SUPPLIER_OPTIONS_MAX = 5;

/** Corta una lista de opciones y cuenta las que quedan fuera. */
export const limitOptions = <T>(items: readonly T[], max = SUPPLIER_OPTIONS_MAX): { readonly shown: readonly T[]; readonly hidden: number } => ({
  shown: items.slice(0, max),
  hidden: Math.max(0, items.length - max),
});

/** Importe del contrato de un proveedor con un programa (`null` si no tiene contrato con él). */
export const contractAmountFor = (supplier: SupplierDto, programCode: string): number | null =>
  supplier.contracts.find((contract) => contract.programCode === programCode)?.amountEur ?? null;

/** Estado de aprobación (`data-state` de la fila y del badge, como en la web). */
export const approvalState = (supplier: Pick<SupplierDto, 'approved'>): 'approved' | 'not_approved' => (supplier.approved ? 'approved' : 'not_approved');
