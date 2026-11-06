import { Body, Controller, Get, Param, Post, Query, Res, StreamableFile } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { publishVersionSchema, type PublishVersionInput } from '@sigpro/shared';
import type { Response } from 'express';
import { CurrentUser, RequirePermission, type AuthUser } from '../common/auth.types';
import { contentDisposition } from '../common/content-disposition';
import { ZodApiBody, ZodPipe } from '../common/zod.pipe';
import { DocumentsService } from './documents.service';

const text = (value: unknown): string | undefined => (typeof value === 'string' && value.trim() !== '' ? value.trim() : undefined);
const integer = (value: unknown): number | undefined => {
  const parsed = Number(text(value));
  return Number.isInteger(parsed) ? parsed : undefined;
};

@ApiTags('documents')
@ApiBearerAuth('bearer')
@Controller('documents')
export class DocumentsController {
  constructor(private readonly documents: DocumentsService) {}

  @Get()
  @ApiOperation({ summary: 'Documentos visibles para el rol. Los `restricted` se omiten para `consultant` (`hiddenCount` dice cuántos).' })
  @ApiQuery({ name: 'program', required: false })
  @ApiQuery({ name: 'classification', required: false, enum: ['public', 'restricted'] })
  @ApiQuery({ name: 'q', required: false, description: 'Id o título' })
  list(@CurrentUser() user: AuthUser, @Query() query: Record<string, unknown>) {
    return this.documents.list(user, { program: text(query.program), classification: text(query.classification), q: text(query.q) });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalle y versiones. 403 si es `restricted` y el rol no puede verlo.' })
  get(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.documents.get(user, id);
  }

  @Get(':id/content')
  @ApiOperation({ summary: 'Contenido de una versión (por defecto la última), repartido en páginas: lo muestra el visor del iframe.' })
  @ApiQuery({ name: 'version', required: false })
  content(@CurrentUser() user: AuthUser, @Param('id') id: string, @Query('version') version?: string) {
    return this.documents.content(user, id, integer(version));
  }

  @Get(':id/compare')
  @ApiOperation({ summary: 'Comparación por líneas entre dos versiones distintas (filas alineadas: same, changed, added, removed).' })
  @ApiQuery({ name: 'from', required: true })
  @ApiQuery({ name: 'to', required: true })
  compare(@CurrentUser() user: AuthUser, @Param('id') id: string, @Query('from') from?: string, @Query('to') to?: string) {
    return this.documents.compare(user, id, integer(from) ?? Number.NaN, integer(to) ?? Number.NaN);
  }

  @Post(':id/versions')
  @RequirePermission('document.publish')
  @ApiOperation({ summary: 'Publica una versión nueva con el contenido enviado (admin y program_manager).' })
  @ZodApiBody(publishVersionSchema)
  publish(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body(new ZodPipe(publishVersionSchema)) body: PublishVersionInput) {
    return this.documents.publish(user, id, body);
  }

  @Get(':id/download')
  @ApiOperation({ summary: 'Descarga una versión (por defecto la última) como PDF.' })
  @ApiQuery({ name: 'version', required: false })
  async download(@CurrentUser() user: AuthUser, @Param('id') id: string, @Res({ passthrough: true }) response: Response, @Query('version') version?: string) {
    const { pdf, filename } = await this.documents.download(user, id, integer(version));
    response.setHeader('Content-Type', 'application/pdf');
    response.setHeader('Content-Disposition', contentDisposition('attachment', filename));
    return new StreamableFile(pdf);
  }
}
