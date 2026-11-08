import { Body, Controller, Get, Headers, HttpCode, Param, Patch, Post, Query, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiHeader, ApiOperation, ApiQuery, ApiSecurity, ApiTags } from '@nestjs/swagger';
import { ADMIN_KEY_HEADER, chaosSchema, TENANT_HEADER, updateUserSchema, type AdminUserDto, type ChaosConfig, type ResetResponse, type UpdateUserInput } from '@sigpro/shared';
import { AllowAdminKey, CurrentUser, RequirePermission, type AuthUser, type AuthedRequest } from '../common/auth.types';
import { ChaosService } from '../chaos/chaos.service';
import { fail } from '../common/errors';
import { ZodApiBody, ZodPipe } from '../common/zod.pipe';
import { AuditService } from '../audit/audit.service';
import { SeedService } from '../seed/seed.service';
import { UsersAdminService } from '../users/users-admin.service';

const partialChaos = chaosSchema.partial();

@ApiTags('admin')
@Controller('admin')
export class AdminController {
  constructor(
    private readonly seed: SeedService,
    private readonly chaos: ChaosService,
    private readonly audit: AuditService,
    private readonly users: UsersAdminService,
  ) {}

  @Post('reset')
  @HttpCode(200)
  @AllowAdminKey()
  @RequirePermission('users.manage')
  @ApiBearerAuth('bearer')
  @ApiSecurity('admin-key')
  @ApiQuery({ name: 'all', required: false, description: 'true → reinicia todos los tenants (exige X-Admin-Key)' })
  @ApiHeader({ name: ADMIN_KEY_HEADER, required: false })
  @ApiOperation({ summary: 'Restaura el seed del tenant del JWT (< 2 s). Con `?all=true` y `X-Admin-Key`, de todos los tenants.' })
  async reset(
    @Req() request: AuthedRequest,
    @Query('all') all: string | undefined,
    @Headers(TENANT_HEADER) tenantHeader: string | undefined,
  ): Promise<ResetResponse | readonly ResetResponse[]> {
    if (all === 'true') {
      if (!request.adminKey) throw fail.forbidden('admin_key_required', 'admin_key_required');
      return this.seed.resetAll();
    }
    const tenantId = request.user?.tenantId ?? tenantHeader?.trim();
    if (!tenantId) throw fail.badRequest('tenant_required', 'tenant_required');
    return this.seed.applyTenant(tenantId);
  }

  @Get('chaos')
  @RequirePermission('users.manage')
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'Flags del modo caos del tenant.' })
  getChaos(@CurrentUser() user: AuthUser): Promise<ChaosConfig> {
    return this.chaos.get(user.tenantId);
  }

  @Patch('chaos')
  @RequirePermission('users.manage')
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'Activa/ajusta el caos solo para este tenant: latencia 0–latencyMs, % de 500 en escrituras y textos de botón variables.' })
  @ZodApiBody(partialChaos)
  async setChaos(@CurrentUser() user: AuthUser, @Body(new ZodPipe(partialChaos)) body: Partial<ChaosConfig>): Promise<ChaosConfig> {
    const next = await this.chaos.update(user.tenantId, body);
    await this.audit.record({ tenantId: user.tenantId, actorId: user.id, action: 'chaos.updated', entity: 'tenant', entityId: user.tenantId, diff: { ...next } });
    return next;
  }

  @Get('users')
  @RequirePermission('users.manage')
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'Usuarios del tenant con su rol, si están activos, bloqueados o pendientes de aprobación (solo admin).' })
  listUsers(@CurrentUser() user: AuthUser): Promise<readonly AdminUserDto[]> {
    return this.users.list(user.tenantId);
  }

  @Patch('users/:id')
  @RequirePermission('users.manage')
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'Activa/desactiva a un usuario o le cambia el rol. 409 self_change si te tocas la cuenta y 409 last_admin si dejaría el tenant sin admin activo.' })
  @ZodApiBody(updateUserSchema)
  updateUser(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body(new ZodPipe(updateUserSchema)) body: UpdateUserInput): Promise<AdminUserDto> {
    return this.users.update(user, id, body);
  }
}
