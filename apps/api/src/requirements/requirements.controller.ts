import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  createRequirementSchema,
  moveRequirementSchema,
  transitionRequirementSchema,
  updateRequirementSchema,
  type CreateRequirementInput,
  type MoveRequirementInput,
  type TransitionRequirementInput,
  type UpdateRequirementInput,
} from '@sigpro/shared';
import { CurrentUser, RequirePermission, type AuthUser } from '../common/auth.types';
import { ZodApiBody, ZodPipe } from '../common/zod.pipe';
import { RequirementsService } from './requirements.service';

@ApiTags('requirements')
@ApiBearerAuth('bearer')
@Controller()
export class RequirementsController {
  constructor(private readonly requirements: RequirementsService) {}

  @Get('programs/:code/requirements')
  @ApiOperation({ summary: 'Todos los requisitos del programa en plano (el árbol se arma con parentCode y position).' })
  list(@CurrentUser() user: AuthUser, @Param('code') code: string) {
    return this.requirements.list(user.tenantId, code);
  }

  @Get('programs/:code/traceability')
  @ApiOperation({ summary: 'Matriz de trazabilidad del programa: requisitos × casos de prueba y sus enlaces.' })
  traceability(@CurrentUser() user: AuthUser, @Param('code') code: string) {
    return this.requirements.traceability(user.tenantId, code);
  }

  @Get('requirements/:code')
  @ApiOperation({ summary: 'Detalle de un requisito.' })
  get(@CurrentUser() user: AuthUser, @Param('code') code: string) {
    return this.requirements.get(user.tenantId, code);
  }

  @Post('requirements')
  @RequirePermission('requirement.create')
  @ApiOperation({ summary: 'Crea un requisito en borrador (al final de sus hermanos). La descripción es HTML y se sanea con una lista blanca.' })
  @ZodApiBody(createRequirementSchema)
  create(@CurrentUser() user: AuthUser, @Body(new ZodPipe(createRequirementSchema)) body: CreateRequirementInput) {
    return this.requirements.create(user, body);
  }

  @Patch('requirements/:code')
  @RequirePermission('requirement.edit')
  @ApiOperation({ summary: 'Edita título, descripción, prioridad o etiquetas. Cambiar el título o la descripción devuelve el requisito a draft.' })
  @ZodApiBody(updateRequirementSchema)
  update(@CurrentUser() user: AuthUser, @Param('code') code: string, @Body(new ZodPipe(updateRequirementSchema)) body: UpdateRequirementInput) {
    return this.requirements.update(user, code, body);
  }

  @Post('requirements/:code/transition')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Cambia el estado: draft → approved (program_manager) → verified (consultant) → validated (auditor); admin hace todos. Volver a draft: quien aprueba. 409 si el paso no existe, 403 si el rol no puede darlo.',
  })
  @ZodApiBody(transitionRequirementSchema)
  transition(@CurrentUser() user: AuthUser, @Param('code') code: string, @Body(new ZodPipe(transitionRequirementSchema)) body: TransitionRequirementInput) {
    return this.requirements.transition(user, code, body.to);
  }

  @Post('requirements/:code/move')
  @HttpCode(200)
  @RequirePermission('requirement.edit')
  @ApiOperation({ summary: 'Reordena entre hermanos (mismo padre): antes o después de `targetCode`. Devuelve la lista del programa.' })
  @ZodApiBody(moveRequirementSchema)
  move(@CurrentUser() user: AuthUser, @Param('code') code: string, @Body(new ZodPipe(moveRequirementSchema)) body: MoveRequirementInput) {
    return this.requirements.move(user, code, body);
  }

  @Delete('requirements/:code')
  @HttpCode(204)
  @RequirePermission('requirement.delete')
  @ApiOperation({ summary: 'Elimina el requisito y sus descendientes.' })
  remove(@CurrentUser() user: AuthUser, @Param('code') code: string) {
    return this.requirements.remove(user, code);
  }

  @Put('requirements/:code/tests/:testCaseCode')
  @HttpCode(204)
  @RequirePermission('requirement.edit')
  @ApiOperation({ summary: 'Enlaza el requisito con un caso de prueba del mismo programa (idempotente).' })
  link(@CurrentUser() user: AuthUser, @Param('code') code: string, @Param('testCaseCode') testCaseCode: string) {
    return this.requirements.link(user, code, testCaseCode);
  }

  @Delete('requirements/:code/tests/:testCaseCode')
  @HttpCode(204)
  @RequirePermission('requirement.edit')
  @ApiOperation({ summary: 'Quita el enlace con un caso de prueba.' })
  unlink(@CurrentUser() user: AuthUser, @Param('code') code: string, @Param('testCaseCode') testCaseCode: string) {
    return this.requirements.unlink(user, code, testCaseCode);
  }
}
