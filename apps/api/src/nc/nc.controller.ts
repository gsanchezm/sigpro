import { Body, Controller, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import {
  NC_SEVERITIES,
  createNcSchema,
  ncCommentSchema,
  transitionNcSchema,
  updateNcSchema,
  type CreateNcInput,
  type NcCommentInput,
  type NcListQuery,
  type NcSeverity,
  type TransitionNcInput,
  type UpdateNcInput,
} from '@sigpro/shared';
import { CurrentUser, RequirePermission, type AuthUser } from '../common/auth.types';
import { ZodApiBody, ZodPipe } from '../common/zod.pipe';
import { NcService } from './nc.service';

const text = (value: unknown): string | undefined => (typeof value === 'string' && value.trim() !== '' ? value.trim() : undefined);
const severity = (value: unknown): NcSeverity | undefined => (NC_SEVERITIES as readonly unknown[]).includes(value) ? (value as NcSeverity) : undefined;

@ApiTags('nc')
@ApiBearerAuth('bearer')
@Controller('nc')
export class NcController {
  constructor(private readonly nc: NcService) {}

  @Get()
  @ApiOperation({ summary: 'No conformidades del tenant (todas, sin paginar: alimentan el tablero kanban), con filtros.' })
  @ApiQuery({ name: 'q', required: false, description: 'Código o descripción' })
  @ApiQuery({ name: 'program', required: false })
  @ApiQuery({ name: 'severity', required: false, enum: NC_SEVERITIES })
  @ApiQuery({ name: 'assignee', required: false, description: 'Id de usuario o `none` (sin asignar)' })
  list(@CurrentUser() user: AuthUser, @Query() query: Record<string, unknown>) {
    return this.nc.list(user.tenantId, { q: text(query.q), program: text(query.program), severity: severity(query.severity), assignee: text(query.assignee) } satisfies NcListQuery);
  }

  @Get(':code')
  @ApiOperation({ summary: 'Detalle de una no conformidad con sus comentarios y los estados a los que puede pasar.' })
  get(@CurrentUser() user: AuthUser, @Param('code') code: string) {
    return this.nc.get(user.tenantId, code);
  }

  @Post()
  @RequirePermission('nc.create')
  @ApiOperation({ summary: 'Abre una no conformidad en estado `open`. La descripción es HTML y se sanea con una lista blanca.' })
  @ZodApiBody(createNcSchema)
  create(@CurrentUser() user: AuthUser, @Body(new ZodPipe(createNcSchema)) body: CreateNcInput) {
    return this.nc.create(user, body);
  }

  @Patch(':code')
  @RequirePermission('nc.edit')
  @ApiOperation({ summary: 'Edita severidad, descripción o asignación (`assigneeId: null` quita al responsable).' })
  @ZodApiBody(updateNcSchema)
  update(@CurrentUser() user: AuthUser, @Param('code') code: string, @Body(new ZodPipe(updateNcSchema)) body: UpdateNcInput) {
    return this.nc.update(user, code, body);
  }

  @Post(':code/transition')
  @HttpCode(200)
  @ApiOperation({
    summary:
      'Mueve la NC de columna: open → in_analysis → corrective_action → closed, con rejected desde in_analysis. 403 si el rol no puede dar el paso (cerrar: admin y gestor), 409 si el paso no existe, 422 si se cierra sin un comentario de al menos 20 caracteres.',
  })
  @ZodApiBody(transitionNcSchema)
  transition(@CurrentUser() user: AuthUser, @Param('code') code: string, @Body(new ZodPipe(transitionNcSchema)) body: TransitionNcInput) {
    return this.nc.transition(user, code, body);
  }

  @Post(':code/comments')
  @RequirePermission('nc.comment')
  @ApiOperation({ summary: 'Añade un comentario (`kind: quick` para el comentario rápido).' })
  @ZodApiBody(ncCommentSchema)
  comment(@CurrentUser() user: AuthUser, @Param('code') code: string, @Body(new ZodPipe(ncCommentSchema)) body: NcCommentInput) {
    return this.nc.comment(user, code, body);
  }
}
