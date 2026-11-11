import { Inject, Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { nextProgramCode, programsToCsv, type CreateProgramInput, type ProgramDto, type ProgramListQuery, type ProgramListResponse, type UpdateProgramInput } from '@sigpro/shared';
import { AuditService } from '../audit/audit.service';
import type { AuthUser } from '../common/auth.types';
import { fail } from '../common/errors';
import { lockTenantCodes } from '../common/tenant-lock';
import { ENV, type Env } from '../config/env';
import { PrismaService } from '../prisma/prisma.service';
import { buildOrderBy, buildWhere, listOrderBy, normalizePaging, progressOf } from './program-query';

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

@Injectable()
export class ProgramsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    @Inject(ENV) private readonly env: Pick<Env, 'PLANTED_BUGS'>,
  ) {}

  async list(tenantId: string, query: ProgramListQuery): Promise<ProgramListResponse> {
    const where = buildWhere(tenantId, query, { plantedBugs: this.env.PLANTED_BUGS });
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
      orderBy: listOrderBy(query, safePage, this.env.PLANTED_BUGS),
      skip: (safePage - 1) * pageSize,
      take: pageSize,
      include: WITH_DETAIL,
    });
    return { items: rows.map(toProgramDto), total, totalAll, activeCount, page: safePage, pageSize, pages };
  }

  async exportCsv(tenantId: string, query: ProgramListQuery): Promise<string> {
    const rows = await this.prisma.program.findMany({ where: buildWhere(tenantId, query), orderBy: buildOrderBy(query.sort, query.dir), include: WITH_DETAIL });
    return programsToCsv(rows.map(toProgramDto));
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
      await lockTenantCodes(tx, tenantId);
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

  /**
   * PATCH parcial: solo se tocan los campos recibidos. Mismas reglas de servidor que el alta (nombre repetido o con
   * «duplicado» → 422), comparando con el resto de programas (no con el propio). Audita qué campos cambiaron.
   */
  async update(user: AuthUser, code: string, input: UpdateProgramInput): Promise<ProgramDto> {
    const { tenantId } = user;
    const current = await this.prisma.program.findUnique({ where: { tenantId_code: { tenantId, code } }, include: WITH_DETAIL });
    if (!current) throw fail.notFound('program_not_found', 'program_not_found');

    if (input.ownerId !== undefined) {
      const owner = await this.prisma.user.findUnique({ where: { tenantId_id: { tenantId, id: input.ownerId } }, select: { id: true } });
      if (!owner) throw fail.unprocessable('validation_failed', 'validation_failed', { ownerId: 'requiredOwner' });
    }
    if (input.name !== undefined && input.name !== current.name) {
      const sameName = await this.prisma.program.findFirst({ where: { tenantId, name: { equals: input.name, mode: 'insensitive' }, NOT: { code } }, select: { code: true } });
      if (sameName || input.name.toLowerCase().includes('duplicado')) throw fail.unprocessable('duplicate_name', 'duplicate_name', { name: 'dupName' });
    }
    // Con una sola fecha en el cuerpo, la otra sale del programa actual
    const start = input.startDate ?? isoDate(current.startDate);
    const end = input.endDate ?? isoDate(current.endDate);
    if (end <= start) throw fail.unprocessable('validation_failed', 'validation_failed', { endDate: 'endAfterStart' });

    const data: Prisma.ProgramUncheckedUpdateInput = {
      ...(input.name === undefined ? {} : { name: input.name }),
      ...(input.description === undefined ? {} : { description: input.description }),
      ...(input.ownerId === undefined ? {} : { ownerId: input.ownerId }),
      ...(input.status === undefined ? {} : { status: input.status }),
      ...(input.priority === undefined ? {} : { priority: input.priority }),
      ...(input.classified === undefined ? {} : { classified: input.classified }),
      ...(input.budget === undefined ? {} : { budgetEur: Math.round(input.budget) }),
      ...(input.startDate === undefined ? {} : { startDate: new Date(`${input.startDate}T00:00:00.000Z`) }),
      ...(input.endDate === undefined ? {} : { endDate: new Date(`${input.endDate}T00:00:00.000Z`) }),
    };
    const before = toProgramDto(current);
    const after = { ...before, ...input, budgetEur: input.budget === undefined ? before.budgetEur : Math.round(input.budget) };
    const fields = (['name', 'description', 'ownerId', 'status', 'priority', 'classified', 'startDate', 'endDate', 'budgetEur'] as const).filter((field) => before[field] !== after[field]);

    const row = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.program.update({ where: { tenantId_code: { tenantId, code } }, data, include: WITH_DETAIL });
      await this.audit.record({ tenantId, actorId: user.id, action: 'program.updated', entity: 'program', entityId: code, diff: { fields: [...fields] } }, tx);
      return updated;
    });
    return toProgramDto(row);
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
      await lockTenantCodes(tx, tenantId);
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
