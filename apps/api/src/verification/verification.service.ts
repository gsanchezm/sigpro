import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { type RunFieldsInput, type TestCaseDetailDto, type TestCaseDto, type TestCaseListQuery, type TestCaseListResponse, type TestRunDto } from '@sigpro/shared';
import { AuditService } from '../audit/audit.service';
import type { AuthUser } from '../common/auth.types';
import { safeFilename } from '../common/content-disposition';
import { fail } from '../common/errors';
import { buildPdf } from '../common/pdf';
import { lockTenantCodes } from '../common/tenant-lock';
import { PrismaService } from '../prisma/prisma.service';
import { nextId, validateEvidence, type UploadedFile } from './evidence-files';
import { buildReportLines } from './report';
import { buildCaseList, summarizeRuns } from './test-case-query';

const CASE_INCLUDE = {
  program: { select: { name: true } },
  requirements: { select: { requirementCode: true }, orderBy: { requirementCode: 'asc' } },
  runs: { select: { id: true, executedAt: true, result: true } },
} satisfies Prisma.TestCaseInclude;
type CaseRow = Prisma.TestCaseGetPayload<{ include: typeof CASE_INCLUDE }>;

const RUN_INCLUDE = {
  executedBy: { select: { name: true } },
  evidences: { select: { id: true, filename: true, mimeType: true, size: true }, orderBy: { id: 'asc' } },
} satisfies Prisma.TestRunInclude;
type RunRow = Prisma.TestRunGetPayload<{ include: typeof RUN_INCLUDE }>;

const stepsOf = (value: Prisma.JsonValue): readonly string[] => (Array.isArray(value) ? value.filter((step): step is string => typeof step === 'string') : []);

const toCaseDto = (row: CaseRow): TestCaseDto => ({
  code: row.code,
  programCode: row.programCode,
  programName: row.program.name,
  title: row.title,
  steps: stepsOf(row.steps),
  expected: row.expected,
  requirementCodes: row.requirements.map((link) => link.requirementCode),
  ...summarizeRuns(row.runs),
});

const toRunDto = (row: RunRow): TestRunDto => ({
  id: row.id,
  testCaseCode: row.testCaseCode,
  executedAt: row.executedAt.toISOString(),
  result: row.result,
  notes: row.notes,
  executedById: row.executedById,
  executedByName: row.executedBy?.name ?? null,
  evidences: row.evidences.map((evidence) => ({ id: evidence.id, filename: evidence.filename, mimeType: evidence.mimeType, size: evidence.size, url: `/evidence/${evidence.id}` })),
});

const slug = (text: string): string => text.toLowerCase().replace(/[^a-z0-9-]+/g, '-');

@Injectable()
export class VerificationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  private async allCases(tenantId: string): Promise<readonly TestCaseDto[]> {
    const rows = await this.prisma.testCase.findMany({ where: { tenantId }, include: CASE_INCLUDE, orderBy: { code: 'asc' } });
    return rows.map(toCaseDto);
  }

  async list(tenantId: string, query: TestCaseListQuery): Promise<TestCaseListResponse> {
    return buildCaseList(await this.allCases(tenantId), query);
  }

  async detail(tenantId: string, code: string): Promise<TestCaseDetailDto> {
    const row = await this.prisma.testCase.findUnique({
      where: { tenantId_code: { tenantId, code } },
      include: { ...CASE_INCLUDE, requirements: { include: { requirement: { select: { code: true, title: true } } }, orderBy: { requirementCode: 'asc' } } },
    });
    if (!row) throw fail.notFound('test_case_not_found', 'test_case_not_found');
    const runs = await this.prisma.testRun.findMany({
      where: { tenantId, testCaseCode: code },
      include: RUN_INCLUDE,
      orderBy: [{ executedAt: 'desc' }, { id: 'desc' }],
    });
    return {
      ...toCaseDto({ ...row, requirements: row.requirements.map((link) => ({ requirementCode: link.requirementCode })) }),
      requirements: row.requirements.map((link) => link.requirement),
      runs: runs.map(toRunDto),
    };
  }

  /**
   * Registra una ejecución con sus evidencias en una sola transacción. Los archivos se validan en el servidor aunque la
   * web ya lo haga: máx. 5, PNG/JPEG/PDF reales (firma incluida) y ≤ 2 MB. Error → 422 `{ files: clave }`.
   */
  async execute(user: AuthUser, code: string, fields: RunFieldsInput, files: readonly UploadedFile[]): Promise<TestRunDto> {
    const { tenantId } = user;
    const testCase = await this.prisma.testCase.findUnique({ where: { tenantId_code: { tenantId, code } }, select: { code: true } });
    if (!testCase) throw fail.notFound('test_case_not_found', 'test_case_not_found');
    const problem = validateEvidence(files);
    if (problem) throw fail.unprocessable('validation_failed', 'validation_failed', { files: problem });

    const run = await this.prisma.$transaction(async (tx) => {
      await lockTenantCodes(tx, tenantId);
      const runId = nextId('RUN', (await tx.testRun.findMany({ where: { tenantId }, select: { id: true } })).map((r) => r.id));
      const firstEvidence = nextId('EV', (await tx.evidence.findMany({ where: { tenantId }, select: { id: true } })).map((e) => e.id));
      // Ids de evidencia consecutivos a partir del primero libre
      const start = Number.parseInt(firstEvidence.replace(/\D/g, ''), 10);
      const evidenceIds = files.map((_, index) => `EV-${String(start + index).padStart(3, '0')}`);
      await tx.testRun.create({
        data: {
          tenantId,
          id: runId,
          testCaseCode: code,
          executedAt: new Date(),
          result: fields.result,
          notes: fields.notes,
          executedById: user.id,
          evidenceUrl: evidenceIds[0] ? `/api/evidence/${evidenceIds[0]}` : null,
        },
      });
      if (files.length > 0) {
        await tx.evidence.createMany({
          data: files.map((file, index) => ({
            tenantId,
            id: evidenceIds[index] as string,
            testRunId: runId,
            filename: safeFilename(file.originalname),
            mimeType: file.mimetype,
            size: file.size,
            data: new Uint8Array(file.buffer),
          })),
        });
      }
      await this.audit.record({ tenantId, actorId: user.id, action: 'testrun.executed', entity: 'testrun', entityId: runId, diff: { testCase: code, result: fields.result, files: files.length } }, tx);
      return tx.testRun.findUniqueOrThrow({ where: { tenantId_id: { tenantId, id: runId } }, include: RUN_INCLUDE });
    });
    return toRunDto(run);
  }

  async evidence(tenantId: string, id: string): Promise<{ filename: string; mimeType: string; data: Uint8Array }> {
    const row = await this.prisma.evidence.findUnique({ where: { tenantId_id: { tenantId, id } }, select: { filename: true, mimeType: true, data: true } });
    if (!row) throw fail.notFound('evidence_not_found', 'evidence_not_found');
    return row;
  }

  /** Informe PDF: `codes` (selección) > `program` > todos los casos del tenant. 404 si no hay ninguno. */
  async report(tenantId: string, scope: { program?: string; codes?: string }): Promise<{ pdf: Buffer; filename: string }> {
    const all = await this.allCases(tenantId);
    const codes = (scope.codes ?? '').split(',').map((code) => code.trim()).filter(Boolean);
    const selected = codes.length > 0 ? all.filter((testCase) => codes.includes(testCase.code)) : scope.program ? all.filter((testCase) => testCase.programCode === scope.program) : all;
    if (selected.length === 0) throw fail.notFound('test_cases_not_found', 'test_cases_not_found');

    const label = codes.length > 0 ? `Selección de ${selected.length} caso(s)` : scope.program ? `Programa ${scope.program}` : 'Todos los programas';
    const suffix = codes.length > 0 ? 'seleccion' : scope.program ? slug(scope.program) : '';
    const lines = buildReportLines(label, new Date().toISOString().slice(0, 10), selected);
    return { pdf: buildPdf('Informe del plan de verificación', [...lines]), filename: `informe-verificacion${suffix ? `-${suffix}` : ''}.pdf` };
  }
}
