import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { HealthResponse } from '@sigpro/shared';
import { Public } from './common/auth.types';

@ApiTags('health')
@Public()
@Controller('health')
export class HealthController {
  @Get()
  @ApiOperation({ summary: 'Comprobación de salud (la usa Render).' })
  health(): HealthResponse {
    return { status: 'ok', uptime: Math.round(process.uptime()) };
  }
}
