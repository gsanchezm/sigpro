import { Controller, Get, Headers, Inject, Req } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { DEFAULT_TENANT, TENANT_HEADER, type PublicConfig, type TenantInfo, type TestUserDto } from '@sigpro/shared';
import type { Request } from 'express';
import { ChaosService } from '../chaos/chaos.service';
import { Public, type AccessPayload } from '../common/auth.types';
import { fail } from '../common/errors';
import { hasAdminKey, hasSession } from '../common/request-access';
import { PrismaService } from '../prisma/prisma.service';
import { DEMO_USERS } from '../seed/data';
import { ENV, hasTestUsers, showsTestUsers, tenantListIsPrivate, type Env } from './env';

export const API_VERSION = '0.1.0';

@ApiTags('config')
@Public()
@Controller('config')
export class ConfigController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly chaos: ChaosService,
    private readonly jwt: JwtService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Configuración pública: entorno, versión y flags de caos del tenant (cabecera x-tenant).' })
  async get(@Headers(TENANT_HEADER) tenantHeader: string | undefined): Promise<PublicConfig> {
    const tenant = tenantHeader?.trim() || DEFAULT_TENANT;
    return { env: this.env.APP_ENV, tenant, version: API_VERSION, testUsers: showsTestUsers(this.env), chaos: await this.chaos.get(tenant), plantedBugs: this.env.PLANTED_BUGS };
  }

  @Get('tenants')
  @ApiOperation({ summary: 'Tenants disponibles (demo y alumnoNN). Con `TENANT_SUFFIX_SEED` o `LAB_PUBLIC=false` exige `X-Admin-Key` (403 sin ella).' })
  async tenants(@Req() request: Request): Promise<readonly TenantInfo[]> {
    // Los nombres de los tenants son el secreto de un despliegue con sufijos: sin clave, nadie los lista
    if (tenantListIsPrivate(this.env) && !hasAdminKey(request.headers, this.env)) throw fail.forbidden('admin_key_required', 'admin_key_required');
    return this.prisma.tenant.findMany({ orderBy: { id: 'asc' }, select: { id: true, name: true } });
  }

  @Get('test-users')
  @ApiOperation({ summary: 'Usuarios de prueba del seed (solo en entornos dev/staging). Con `LAB_PUBLIC=false` solo se devuelven con sesión o `X-Admin-Key`; sin ellas, una lista vacía.' })
  testUsers(@Req() request: Request): readonly TestUserDto[] {
    if (!hasTestUsers(this.env)) return [];
    if (this.env.LAB_PUBLIC) return DEMO_USERS;
    const allowed = hasAdminKey(request.headers, this.env) || hasSession(request.headers, { verify: (token) => this.jwt.verify<AccessPayload>(token) });
    return allowed ? DEMO_USERS : [];
  }
}
