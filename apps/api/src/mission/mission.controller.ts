import { Controller, Get, HttpCode, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { MissionEventTickResponse } from '@sigpro/shared';
import { CurrentUser, RequirePermission, type AuthUser } from '../common/auth.types';
import { MissionEventsService } from './mission-events.service';
import { MissionService } from './mission.service';

@ApiTags('mission')
@ApiBearerAuth('bearer')
@Controller('mission')
export class MissionController {
  constructor(
    private readonly mission: MissionService,
    private readonly events: MissionEventsService,
  ) {}

  @Get('summary')
  @ApiOperation({ summary: 'Indicadores del panel de misión (4 KPIs), datos de las gráficas y los últimos eventos.' })
  summary(@CurrentUser() user: AuthUser) {
    return this.mission.summary(user.tenantId);
  }

  @Post('tick')
  @HttpCode(200)
  @RequirePermission('users.manage')
  @ApiOperation({ summary: 'Emite ya el siguiente evento del simulador a los clientes conectados del tenant (solo admin). Útil para no esperar al temporizador en los tests.' })
  async tick(@CurrentUser() user: AuthUser): Promise<MissionEventTickResponse> {
    const codes = await this.mission.activeProgramCodes(user.tenantId);
    return { event: this.events.emitSimulated(user.tenantId, codes) };
  }
}
