import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { AUDIT_ENTITIES, type AuditQuery } from '@sigpro/shared';
import { CurrentUser, RequirePermission, type AuthUser } from '../common/auth.types';
import { AuditService } from './audit.service';

const text = (value: unknown): string | undefined => (typeof value === 'string' && value.trim() !== '' ? value.trim() : undefined);

@ApiTags('audit')
@ApiBearerAuth('bearer')
@Controller('audit')
export class AuditController {
  constructor(private readonly audit: AuditService) {}

  @Get()
  @RequirePermission('audit.view')
  @ApiOperation({
    summary:
      'Registro de auditoría del tenant (admin y auditor), del más reciente al más antiguo, con paginación por cursor: pide la página siguiente con `cursor=<nextCursor>`. `total` cuenta los eventos que cumplen los filtros.',
  })
  @ApiQuery({ name: 'entity', required: false, enum: AUDIT_ENTITIES })
  @ApiQuery({ name: 'q', required: false, description: 'Acción o código de la entidad' })
  @ApiQuery({ name: 'from', required: false, description: 'Desde (YYYY-MM-DD, incluido)' })
  @ApiQuery({ name: 'to', required: false, description: 'Hasta (YYYY-MM-DD, incluido)' })
  @ApiQuery({ name: 'cursor', required: false, description: '`nextCursor` de la página anterior' })
  @ApiQuery({ name: 'limit', required: false, description: 'Eventos por página (por defecto 20, máximo 100)' })
  page(@CurrentUser() user: AuthUser, @Query() query: Record<string, unknown>) {
    const limit = Number(text(query.limit));
    return this.audit.page(user.tenantId, {
      entity: text(query.entity),
      q: text(query.q),
      from: text(query.from),
      to: text(query.to),
      cursor: text(query.cursor),
      limit: Number.isFinite(limit) ? limit : undefined,
    } satisfies AuditQuery);
  }
}
