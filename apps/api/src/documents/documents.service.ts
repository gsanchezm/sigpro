import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import {
  alignDiff,
  can,
  diffLines,
  diffStats,
  paginateLines,
  type DocumentCompareDto,
  type DocumentContentDto,
  type DocumentDetailDto,
  type DocumentDto,
  type DocumentListResponse,
  type PublishVersionInput,
} from '@sigpro/shared';
import { AuditService } from '../audit/audit.service';
import type { AuthUser } from '../common/auth.types';
import { fail } from '../common/errors';
import { buildPdf } from '../common/pdf';
import { PrismaService } from '../prisma/prisma.service';
import { buildDocumentPdfLines } from './document-pdf';

const DOC_INCLUDE = {
  program: { select: { name: true } },
  versions: { select: { version: true, note: true, createdAt: true, author: { select: { name: true } } }, orderBy: { version: 'asc' } },
} satisfies Prisma.DocumentInclude;
type DocRow = Prisma.DocumentGetPayload<{ include: typeof DOC_INCLUDE }>;

const linesOf = (value: Prisma.JsonValue): readonly string[] => (Array.isArray(value) ? value.filter((line): line is string => typeof line === 'string') : []);

const toDto = (row: DocRow): DocumentDto => {
  const last = row.versions[row.versions.length - 1];
  return {
    id: row.id,
    programCode: row.programCode,
    programName: row.program.name,
    title: row.title,
    classification: row.classification,
    version: row.version,
    updatedAt: (last?.createdAt ?? new Date(0)).toISOString(),
  };
};

const toDetail = (row: DocRow): DocumentDetailDto => ({
  ...toDto(row),
  versions: row.versions.map((v) => ({ version: v.version, note: v.note, authorName: v.author?.name ?? null, createdAt: v.createdAt.toISOString() })),
});

@Injectable()
export class DocumentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /** Los `restricted` solo los ven admin, gestor y auditor: en la lista se omiten y en el detalle/visor/descarga dan 403. */
  private async row(user: AuthUser, id: string): Promise<DocRow> {
    const row = await this.prisma.document.findUnique({ where: { tenantId_id: { tenantId: user.tenantId, id } }, include: DOC_INCLUDE });
    if (!row) throw fail.notFound('document_not_found', 'document_not_found');
    if (row.classification === 'restricted' && !can(user.role, 'document.viewRestricted')) throw fail.forbidden('forbidden', 'forbidden');
    return row;
  }

  async list(user: AuthUser, query: { program?: string; classification?: string; q?: string }): Promise<DocumentListResponse> {
    const rows = await this.prisma.document.findMany({ where: { tenantId: user.tenantId }, include: DOC_INCLUDE, orderBy: { id: 'asc' } });
    const canSeeRestricted = can(user.role, 'document.viewRestricted');
    const visible = rows.filter((row) => canSeeRestricted || row.classification !== 'restricted');
    const needle = query.q?.trim().toLowerCase() ?? '';
    const items = visible
      .filter((row) => !query.program || row.programCode === query.program)
      .filter((row) => !query.classification || row.classification === query.classification)
      .filter((row) => needle === '' || row.id.toLowerCase().includes(needle) || row.title.toLowerCase().includes(needle))
      .map(toDto);
    return { items, hiddenCount: rows.length - visible.length };
  }

  async get(user: AuthUser, id: string): Promise<DocumentDetailDto> {
    return toDetail(await this.row(user, id));
  }

  private async versionLines(user: AuthUser, row: DocRow, version: number): Promise<{ lines: readonly string[]; note: string; createdAt: Date }> {
    const found = await this.prisma.documentVersion.findUnique({ where: { tenantId_documentId_version: { tenantId: user.tenantId, documentId: row.id, version } } });
    if (!found) throw fail.notFound('version_not_found', 'version_not_found');
    return { lines: linesOf(found.lines), note: found.note, createdAt: found.createdAt };
  }

  /** Contenido de una versión (por defecto la última) repartido en páginas: lo pinta el visor HTML del iframe. */
  async content(user: AuthUser, id: string, version?: number): Promise<DocumentContentDto> {
    const row = await this.row(user, id);
    const wanted = version ?? row.version;
    const { lines, note, createdAt } = await this.versionLines(user, row, wanted);
    return { id: row.id, title: row.title, programCode: row.programCode, classification: row.classification, version: wanted, note, createdAt: createdAt.toISOString(), pages: paginateLines(lines) };
  }

  /** Diff por líneas entre dos versiones distintas, alineado en dos columnas. */
  async compare(user: AuthUser, id: string, from: number, to: number): Promise<DocumentCompareDto> {
    if (!Number.isInteger(from) || !Number.isInteger(to) || from === to) throw fail.unprocessable('validation_failed', 'validation_failed', { to: 'compareSame' });
    const row = await this.row(user, id);
    const [a, b] = await Promise.all([this.versionLines(user, row, from), this.versionLines(user, row, to)]);
    const rows = alignDiff(diffLines(a.lines, b.lines));
    return { id: row.id, from, to, rows, stats: diffStats(rows) };
  }

  /** Publica una versión nueva (la siguiente) con el contenido recibido y la audita. */
  async publish(user: AuthUser, id: string, input: PublishVersionInput): Promise<DocumentDetailDto> {
    const { tenantId } = user;
    const row = await this.row(user, id);
    const next = row.version + 1;
    await this.prisma.$transaction(async (tx) => {
      await tx.documentVersion.create({ data: { tenantId, documentId: id, version: next, lines: [...input.lines], note: input.note, authorId: user.id, createdAt: new Date() } });
      await tx.document.update({ where: { tenantId_id: { tenantId, id } }, data: { version: next } });
      await this.audit.record({ tenantId, actorId: user.id, action: 'document.version_published', entity: 'document', entityId: id, diff: { version: next, lines: input.lines.length } }, tx);
    });
    return toDetail(await this.row(user, id));
  }

  async download(user: AuthUser, id: string, version?: number): Promise<{ pdf: Buffer; filename: string }> {
    const row = await this.row(user, id);
    const wanted = version ?? row.version;
    const { lines } = await this.versionLines(user, row, wanted);
    const lined = buildDocumentPdfLines({ id: row.id, title: row.title, programCode: row.programCode, classification: row.classification, version: wanted }, lines);
    return { pdf: buildPdf(row.title, [...lined]), filename: `${row.id}-v${wanted}.pdf` };
  }
}
