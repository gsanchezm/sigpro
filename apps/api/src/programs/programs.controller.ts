import { Body, Controller, Delete, Get, Header, HttpCode, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { CSV_FILENAME, createProgramSchema, type CreateProgramInput } from '@sigpro/shared';
import { CurrentUser, RequirePermission, type AuthUser } from '../common/auth.types';
import { ZodApiBody, ZodPipe } from '../common/zod.pipe';
import { parseListQuery } from './program-query';
import { ProgramsService } from './programs.service';

const LIST_PARAMS = ['q', 'status', 'from', 'to', 'owner', 'sort', 'dir', 'page', 'pageSize'] as const;

@ApiTags('programs')
@ApiBearerAuth('bearer')
@Controller('programs')
export class ProgramsController {
  constructor(private readonly programs: ProgramsService) {}

  @Get()
  @ApiOperation({ summary: 'Lista paginada (10 por página) con filtros y orden.' })
  @ApiQuery({ name: 'status', required: false, enum: ['draft', 'active', 'on_hold', 'closed', 'cancelled'] })
  @ApiQuery({ name: 'from', required: false, description: 'Inicio desde (YYYY-MM-DD)' })
  @ApiQuery({ name: 'to', required: false, description: 'Fin hasta (YYYY-MM-DD)' })
  @ApiQuery({ name: 'owner', required: false, description: 'Id del responsable' })
  @ApiQuery({ name: 'q', required: false, description: 'Código o nombre' })
  @ApiQuery({ name: 'sort', required: false, enum: ['code', 'name', 'status', 'owner', 'dates', 'budget'] })
  @ApiQuery({ name: 'dir', required: false, enum: ['asc', 'desc'] })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'pageSize', required: false })
  list(@CurrentUser() user: AuthUser, @Query() query: Record<string, unknown>) {
    return this.programs.list(user.tenantId, parseListQuery(query));
  }

  @Get('export')
  @RequirePermission('program.export')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', `attachment; filename="${CSV_FILENAME}"`)
  @ApiOperation({ summary: 'Exporta a CSV los programas que cumplen los filtros (mismos parámetros que la lista, sin paginar).' })
  export(@CurrentUser() user: AuthUser, @Query() query: Record<string, unknown>) {
    const filters = Object.fromEntries(LIST_PARAMS.map((key) => [key, query[key]]));
    return this.programs.exportCsv(user.tenantId, parseListQuery(filters));
  }

  @Get(':code')
  @ApiOperation({ summary: 'Detalle de un programa.' })
  get(@CurrentUser() user: AuthUser, @Param('code') code: string) {
    return this.programs.get(user.tenantId, code);
  }

  @Post()
  @RequirePermission('program.create')
  @ApiOperation({ summary: 'Crea un programa. 422 si el nombre ya existe o contiene «duplicado», o si el cuerpo es inválido.' })
  @ZodApiBody(createProgramSchema)
  create(@CurrentUser() user: AuthUser, @Body(new ZodPipe(createProgramSchema)) body: CreateProgramInput) {
    return this.programs.create(user, body);
  }

  @Post(':code/archive')
  @HttpCode(200)
  @RequirePermission('program.archive')
  @ApiOperation({ summary: 'Archiva un programa (estado → closed).' })
  archive(@CurrentUser() user: AuthUser, @Param('code') code: string) {
    return this.programs.archive(user, code);
  }

  @Post(':code/duplicate')
  @RequirePermission('program.create')
  @ApiOperation({ summary: 'Duplica un programa como borrador.' })
  duplicate(@CurrentUser() user: AuthUser, @Param('code') code: string) {
    return this.programs.duplicate(user, code);
  }

  @Delete(':code')
  @HttpCode(204)
  @RequirePermission('program.delete')
  @ApiOperation({ summary: 'Elimina un programa (solo admin).' })
  remove(@CurrentUser() user: AuthUser, @Param('code') code: string) {
    return this.programs.remove(user, code);
  }
}
