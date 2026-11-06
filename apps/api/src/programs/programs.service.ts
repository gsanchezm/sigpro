import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type { CreateProgramInput, Lang, ProgramDto, ProgramListQuery, ProgramListResponse } from '@sigpro/shared';
import { AuditService } from '../audit/audit.service';
import type { AuthUser } from '../common/auth.types';
import { fail } from '../common/errors';
import { PrismaService } from '../prisma/prisma.service';
import { buildOrderBy, buildWhere, nextProgramCode, normalizePaging, progressOf, toCsv, type CsvRow } from './program-query';

const WITH_DETAIL = { owner: { select: { name: true } }, milestones: { select: { done: true } } } as const;
type ProgramRow = Prisma.ProgramGetPayload<{ include: typeof WITH_DETAIL }>;

const isoDate = (date: Date): string => date.toISOString().slice(0, 10);

export const toProgramDto = (row: ProgramRow): ProgramDto => {
  const done = row.milestones.filter((m) => m.done).length;
  return {
    code: row.code,
    name: row.name,
    description: row.description,
    status: row.status,
    priority: row.priority,
    classified: row.classified,
    ownerId: row.ownerId,
    ownerName: row.owner.name,
    startDate: isoDate(row.startDate),
    endDate: isoDate(row.endDate),
    budgetEur: row.budgetEur,
    progress: progressOf(done, row.milestones.length),
    milestonesDone: done,
    milestonesTotal: row.milestones.length,
  };
};

const toCsvRow = (dto: ProgramDto): CsvRow => ({
  code: dto.code,
  name: dto.name,
  status: dto.status,
  owner: dto.ownerName,
  start: dto.startDate,
  end: dto.endDate,
  budget: dto.budgetEur,
  progress: dto.progress,
});

@Injectable()
export class ProgramsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(tenantId: string, query: ProgramListQuery): Promise<ProgramListResponse> {
    const where = buildWhere(tenantId, query);
    const { page, pageSize } = normalizePaging(query);
    const [total, totalAll, activeCount] = await Promise.all([
      this.prisma.program.count({ where }),
      this.prisma.program.count({ where: { tenantId } }),
      this.prisma.program.count({ where: { ...where, status: 'active' } }),
    ]);
    const pages = Math.max(1, Math.ceil(total / pageSize));
    const safePage = Math.min(page, pages);
    const rows = await this.prisma.program.findMany({
      where,
      orderBy: buildOrderBy(query.sort, query.dir),
      skip: (safePage - 1) * pageSize,
      take: pageSize,
      include: WITH_DETAIL,
    });
    return { items: rows.map(toProgramDto), total, totalAll, activeCount, page: safePage, pageSize, pages };
  }

  async exportCsv(tenantId: string, query: ProgramListQuery, lang: Lang): Promise<string> {
    const rows = await this.prisma.program.findMany({ where: buildWhere(tenantId, query), orderBy: buildOrderBy(query.sort, query.dir), include: WITH_DETAIL });
    return toCsv(rows.map(toProgramDto).map(toCsvRow), lang);
  }

  async get(tenantId: string, code: string): Promise<ProgramDto> {
    const row = await this.prisma.program.findUnique({ where: { tenantId_code: { tenantId, code } }, include: WITH_DETAIL });
    if (!row) throw fail.notFound('program_not_found', 'program_not_found');
    return toProgramDto(row);
  }

  /** 422 si el nombre ya existe o contiene «duplicado» (validación de servidor del handoff). */
  async create(user: AuthUser, input: CreateProgramInput): Promise<ProgramDto> {
    const { tenantId } = user;
    const owner = await this.prisma.user.findUnique({ where: { tenantId_id: { tenantId, id: input.ownerId } }, select: { id: true } });
    if (!owner) throw fail.unprocessable('validation_failed', 'validation_failed', { ownerId: 'requiredOwner' });

    const sameName = await this.prisma.program.findFirst({ where: { tenantId, name: { equals: input.name, mode: 'insensitive' } }, select: { code: true } });
    if (sameName || input.name.toLowerCase().includes('duplicado')) throw fail.unprocessable('duplicate_name', 'duplicate_name', { name: 'dupName' });

    const created = await this.prisma.$transaction(async (tx) => {
      const codes = (await tx.program.findMany({ where: { tenantId }, select: { code: true } })).map((p) => p.code);
      const code = nextProgramCode(codes);
      const row = await tx.program.create({
        data: {
          tenantId,
          code,
          name: input.name,
          description: input.description,
          status: input.status,
          priority: input.priority,
          classified: input.classified,
          budgetEur: Math.round(input.budget),
          startDate: new Date(`${input.startDate}T00:00:00.000Z`),
          endDate: new Date(`${input.endDate}T00:00:00.000Z`),
          ownerId: input.ownerId,
        },
        include: WITH_DETAIL,
      });
      await this.audit.record({ tenantId, actorId: user.id, action: 'program.created', entity: 'program', entityId: code, diff: { name: input.name } }, tx);
      return row;
    });
    return toProgramDto(created);
  }

  async remove(user: AuthUser, code: string): Promise<void> {
    const { tenantId } = user;
    await this.get(tenantId, code);
    await this.prisma.$transaction(async (tx) => {
      await tx.program.delete({ where: { tenantId_code: { tenantId, code } } });
      await this.audit.record({ tenantId, actorId: user.id, action: 'program.deleted', entity: 'program', entityId: code }, tx);
    });
  }

  /** Archivar = pasar a `closed` (como en el prototipo). */
  async archive(user: AuthUser, code: string): Promise<ProgramDto> {
    const { tenantId } = user;
    await this.get(tenantId, code);
    const row = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.program.update({ where: { tenantId_code: { tenantId, code } }, data: { status: 'closed' }, include: WITH_DETAIL });
      await this.audit.record({ tenantId, actorId: user.id, action: 'program.archived', entity: 'program', entityId: code, diff: { status: 'closed' } }, tx);
      return updated;
    });
    return toProgramDto(row);
  }

  /** Copia como borrador, sin hitos (avance 0 %). */
  async duplicate(user: AuthUser, code: string): Promise<ProgramDto> {
    const { tenantId } = user;
    const source = await this.prisma.program.findUnique({ where: { tenantId_code: { tenantId, code } } });
    if (!source) throw fail.notFound('program_not_found', 'program_not_found');

    const row = await this.prisma.$transaction(async (tx) => {
      const codes = (await tx.program.findMany({ where: { tenantId }, select: { code: true } })).map((p) => p.code);
      const newCode = nextProgramCode(codes);
      const copy = await tx.program.create({
        data: {
          tenantId,
          code: newCode,
          name: `${source.name} (copia)`,
          description: source.description,
          status: 'draft',
          priority: source.priority,
          classified: source.classified,
          budgetEur: source.budgetEur,
          startDate: source.startDate,
          endDate: source.endDate,
          ownerId: source.ownerId,
        },
        include: WITH_DETAIL,
      });
      await this.audit.record({ tenantId, actorId: user.id, action: 'program.duplicated', entity: 'program', entityId: newCode, diff: { from: code } }, tx);
      return copy;
    });
    return toProgramDto(row);
  }
}
