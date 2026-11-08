import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { createMilestoneSchema, updateMilestoneSchema, type CreateMilestoneInput, type UpdateMilestoneInput } from '@sigpro/shared';
import { CurrentUser, RequirePermission, type AuthUser } from '../common/auth.types';
import { ZodApiBody, ZodPipe } from '../common/zod.pipe';
import { MilestonesService } from './milestones.service';

@ApiTags('milestones')
@ApiBearerAuth('bearer')
@Controller()
export class MilestonesController {
  constructor(private readonly milestones: MilestonesService) {}

  @Get('programs/:code/milestones')
  @ApiOperation({ summary: 'Hitos del programa por fecha límite, con su avance (0–100).' })
  list(@CurrentUser() user: AuthUser, @Param('code') code: string) {
    return this.milestones.list(user.tenantId, code);
  }

  @Post('programs/:code/milestones')
  @RequirePermission('milestone.edit')
  @ApiOperation({ summary: 'Crea un hito sin avance en el programa.' })
  @ZodApiBody(createMilestoneSchema)
  create(@CurrentUser() user: AuthUser, @Param('code') code: string, @Body(new ZodPipe(createMilestoneSchema)) body: CreateMilestoneInput) {
    return this.milestones.create(user, code, body);
  }

  @Patch('milestones/:id')
  @RequirePermission('milestone.edit')
  @ApiOperation({ summary: 'Edita nombre, fecha límite o avance. Con avance 100 el hito queda cumplido y el avance del programa se recalcula.' })
  @ZodApiBody(updateMilestoneSchema)
  update(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body(new ZodPipe(updateMilestoneSchema)) body: UpdateMilestoneInput) {
    return this.milestones.update(user, id, body);
  }

  @Delete('milestones/:id')
  @HttpCode(204)
  @RequirePermission('milestone.delete')
  @ApiOperation({ summary: 'Elimina el hito.' })
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.milestones.remove(user, id);
  }
}
