import { Body, Controller, Get, Header, Param, Post, Query, Res, StreamableFile, UploadedFiles, UseInterceptors } from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { EVIDENCE_MAX_BYTES, TEST_CASE_SORT_COLUMNS, runFieldsSchema, type RunFieldsInput, type TestCaseListQuery } from '@sigpro/shared';
import type { Response } from 'express';
import { CurrentUser, RequirePermission, type AuthUser } from '../common/auth.types';
import { contentDisposition } from '../common/content-disposition';
import { ZodPipe } from '../common/zod.pipe';
import type { UploadedFile } from './evidence-files';
import { VerificationService } from './verification.service';

const first = (value: unknown): string | undefined => (typeof value === 'string' && value.trim() !== '' ? value.trim() : undefined);
const num = (value: unknown): number | undefined => {
  const parsed = Number(first(value));
  return Number.isFinite(parsed) ? parsed : undefined;
};

const parseListQuery = (query: Record<string, unknown>): TestCaseListQuery => {
  const sort = first(query.sort);
  const dir = first(query.dir);
  const result = first(query.result);
  return {
    q: first(query.q),
    program: first(query.program),
    result: result === 'pass' || result === 'fail' || result === 'blocked' || result === 'none' ? result : undefined,
    sort: (TEST_CASE_SORT_COLUMNS as readonly string[]).includes(sort ?? '') ? (sort as TestCaseListQuery['sort']) : undefined,
    dir: dir === 'asc' || dir === 'desc' ? dir : undefined,
    page: num(query.page),
    pageSize: num(query.pageSize),
  };
};

// multer deja pasar hasta 5 MB y 10 archivos; las reglas de negocio (2 MB, 5 archivos, tipos) las aplica el servicio con un 422
const UPLOAD_LIMITS = { fileSize: EVIDENCE_MAX_BYTES * 2.5, files: 10 } as const;

@ApiTags('verification')
@ApiBearerAuth('bearer')
@Controller()
export class VerificationController {
  constructor(private readonly verification: VerificationService) {}

  @Get('test-cases')
  @ApiOperation({ summary: 'Casos de prueba con su último resultado y nº de ejecuciones (filtros, orden y paginación de 10).' })
  @ApiQuery({ name: 'q', required: false, description: 'Código o título' })
  @ApiQuery({ name: 'program', required: false })
  @ApiQuery({ name: 'result', required: false, enum: ['pass', 'fail', 'blocked', 'none'] })
  @ApiQuery({ name: 'sort', required: false, enum: ['code', 'title', 'program', 'result', 'runs'] })
  @ApiQuery({ name: 'dir', required: false, enum: ['asc', 'desc'] })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'pageSize', required: false })
  list(@CurrentUser() user: AuthUser, @Query() query: Record<string, unknown>) {
    return this.verification.list(user.tenantId, parseListQuery(query));
  }

  @Get('test-cases/:code')
  @ApiOperation({ summary: 'Detalle del caso: pasos, resultado esperado, requisitos verificados e historial de ejecuciones con evidencias.' })
  detail(@CurrentUser() user: AuthUser, @Param('code') code: string) {
    return this.verification.detail(user.tenantId, code);
  }

  @Post('test-cases/:code/runs')
  @RequirePermission('testrun.execute')
  @UseInterceptors(FilesInterceptor('files', UPLOAD_LIMITS.files, { limits: UPLOAD_LIMITS }))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['result'],
      properties: {
        result: { type: 'string', enum: ['pass', 'fail', 'blocked'] },
        notes: { type: 'string', maxLength: 1000 },
        files: { type: 'array', items: { type: 'string', format: 'binary' }, description: 'Hasta 5 evidencias PNG/JPEG/PDF de 2 MB como máximo.' },
      },
    },
  })
  @ApiOperation({ summary: 'Registra una ejecución (multipart). 422 si falta el resultado o una evidencia no es válida (`errors.files`).' })
  execute(
    @CurrentUser() user: AuthUser,
    @Param('code') code: string,
    @Body(new ZodPipe(runFieldsSchema)) body: RunFieldsInput,
    @UploadedFiles() files: UploadedFile[] | undefined,
  ) {
    return this.verification.execute(user, code, body, files ?? []);
  }

  @Get('verification/report')
  @Header('Content-Type', 'application/pdf')
  @ApiOperation({ summary: 'Informe PDF del plan de verificación: `codes` (selección, separados por coma) > `program` > todos.' })
  @ApiQuery({ name: 'program', required: false })
  @ApiQuery({ name: 'codes', required: false })
  async report(@CurrentUser() user: AuthUser, @Query('program') program: string | undefined, @Query('codes') codes: string | undefined, @Res({ passthrough: true }) response: Response) {
    const { pdf, filename } = await this.verification.report(user.tenantId, { program: first(program), codes: first(codes) });
    response.setHeader('Content-Disposition', contentDisposition('attachment', filename));
    return new StreamableFile(pdf);
  }

  @Get('evidence/:id')
  @ApiOperation({ summary: 'Descarga una evidencia (requiere el Bearer: por eso la web la pide con fetch y la muestra como blob).' })
  async evidence(@CurrentUser() user: AuthUser, @Param('id') id: string, @Res({ passthrough: true }) response: Response) {
    const file = await this.verification.evidence(user.tenantId, id);
    response.setHeader('Content-Type', file.mimeType);
    response.setHeader('Content-Disposition', contentDisposition('inline', file.filename));
    response.setHeader('Cache-Control', 'private, max-age=300');
    return new StreamableFile(file.data);
  }
}
