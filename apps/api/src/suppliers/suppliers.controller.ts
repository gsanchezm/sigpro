import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import type { SupplierListQuery } from '@sigpro/shared';
import { CurrentUser, type AuthUser } from '../common/auth.types';
import { SuppliersService } from './suppliers.service';

const text = (value: unknown): string | undefined => (typeof value === 'string' && value.trim() !== '' ? value.trim() : undefined);

@ApiTags('suppliers')
@ApiBearerAuth('bearer')
@Controller('suppliers')
export class SuppliersController {
  constructor(private readonly suppliers: SuppliersService) {}

  @Get()
  @ApiOperation({ summary: 'Proveedores del tenant con sus contratos, ordenados por nombre. Cualquier rol autenticado.' })
  @ApiQuery({ name: 'q', required: false, description: 'Nombre o NIF (sin distinguir mayúsculas)' })
  @ApiQuery({ name: 'program', required: false, description: 'Solo los proveedores con contrato en este programa' })
  list(@CurrentUser() user: AuthUser, @Query() query: Record<string, unknown>) {
    return this.suppliers.list(user.tenantId, { q: text(query.q), program: text(query.program) } satisfies SupplierListQuery);
  }
}
