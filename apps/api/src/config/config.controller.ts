import { Controller, Get, Headers, Inject } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { DEFAULT_TENANT, TENANT_HEADER, type PublicConfig, type TenantInfo, type TestUserDto } from '@sigpro/shared';
import { ChaosService } from '../chaos/chaos.service';
import { Public } from '../common/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import { DEMO_USERS } from '../seed/data';
import { ENV, showsTestUsers, type Env } from './env';

export const API_VERSION = '0.1.0';

@ApiTags('config')
@Public()
@Controller('config')
export class ConfigController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly chaos: ChaosService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Configuración pública: entorno, versión y flags de caos del tenant (cabecera x-tenant).' })
  async get(@Headers(TENANT_HEADER) tenantHeader: string | undefined): Promise<PublicConfig> {
    const tenant = tenantHeader?.trim() || DEFAULT_TENANT;
    return { env: this.env.APP_ENV, tenant, version: API_VERSION, testUsers: showsTestUsers(this.env), chaos: await this.chaos.get(tenant) };
  }

  @Get('tenants')
  @ApiOperation({ summary: 'Tenants disponibles (demo y alumnoNN).' })
  async tenants(): Promise<readonly TenantInfo[]> {
    return this.prisma.tenant.findMany({ orderBy: { id: 'asc' }, select: { id: true, name: true } });
  }

  @Get('test-users')
  @ApiOperation({ summary: 'Usuarios de prueba del seed (solo en entornos dev/staging).' })
  testUsers(): readonly TestUserDto[] {
    return showsTestUsers(this.env) ? DEMO_USERS : [];
  }
}
