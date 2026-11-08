import { Injectable } from '@nestjs/common';
import type { SupplierDto, SupplierListQuery } from '@sigpro/shared';
import { PrismaService } from '../prisma/prisma.service';
import { filterSuppliers, toSupplierDto } from './supplier-query';

@Injectable()
export class SuppliersService {
  constructor(private readonly prisma: PrismaService) {}

  /** Proveedores del tenant con sus contratos (son pocos: se filtran en memoria con la función pura). */
  async list(tenantId: string, query: SupplierListQuery): Promise<readonly SupplierDto[]> {
    const rows = await this.prisma.supplier.findMany({
      where: { tenantId },
      include: { contracts: { include: { program: { select: { name: true } } } } },
    });
    return filterSuppliers(rows.map(toSupplierDto), query);
  }
}
