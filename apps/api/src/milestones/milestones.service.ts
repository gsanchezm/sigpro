import { Inject, Injectable } from '@nestjs/common';
import type { Milestone, Prisma } from '@prisma/client';
import { nextMilestoneId, type CreateMilestoneInput, type MilestoneDto, type UpdateMilestoneInput } from '@sigpro/shared';
import { AuditService } from '../audit/audit.service';
import type { AuthUser } from '../common/auth.types';
import { fail } from '../common/errors';
import { ENV, type Env } from '../config/env';
import { MissionEventsService } from '../mission/mission-events.service';
import { PrismaService } from '../prisma/prisma.service';
import { doneAfterProgress } from './milestone-rules';

const isoDate = (date: Date): string => date.toISOString().slice(0, 10);
const utcDate = (iso: string): Date => new Date(`${iso}T00:00:00.000Z`);

export const toMilestoneDto = (row: Milestone): MilestoneDto => ({
  id: row.id,
  programCode: row.programCode,
  name: row.name,
  dueDate: isoDate(row.dueDate),
  progress: row.progress,
  done: row.done,
});

@Injectable()
export class MilestonesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly events: MissionEventsService,
    @Inject(ENV) private readonly env: Pick<Env, 'PLANTED_BUGS'>,
  ) {}

  private async program(tenantId: string, code: string): Promise<{ code: string }> {
    const program = await this.prisma.program.findUnique({ where: { tenantId_code: { tenantId, code } }, select: { code: true } });
    if (!program) throw fail.notFound('program_not_found', 'program_not_found');
    return program;
  }

  private async row(tenantId: string, id: string): Promise<Milestone> {
    const row = await this.prisma.milestone.findUnique({ where: { tenantId_id: { tenantId, id } } });
    if (!row) throw fail.notFound('milestone_not_found', 'milestone_not_found');
    return row;
  }

  async list(tenantId: string, programCode: string): Promise<readonly MilestoneDto[]> {
    await this.program(tenantId, programCode);
    const rows = await this.prisma.milestone.findMany({ where: { tenantId, programCode }, orderBy: [{ dueDate: 'asc' }, { id: 'asc' }] });
    return rows.map(toMilestoneDto);
  }

  async create(user: AuthUser, programCode: string, input: CreateMilestoneInput): Promise<MilestoneDto> {
    const { tenantId } = user;
    await this.program(tenantId, programCode);
    const created = await this.prisma.$transaction(async (tx) => {
      const ids = (await tx.milestone.findMany({ where: { tenantId, programCode }, select: { id: true } })).map((m) => m.id);
      const id = nextMilestoneId(programCode, ids);
      const row = await tx.milestone.create({ data: { tenantId, id, programCode, name: input.name, dueDate: utcDate(input.dueDate), done: false, progress: 0 } });
      await this.audit.record({ tenantId, actorId: user.id, action: 'milestone.created', entity: 'milestone', entityId: id, diff: { program: programCode, name: input.name } }, tx);
      return row;
    });
    return toMilestoneDto(created);
  }

  /** Nombre, fecha y avance. El avance fija `done` (100 % = cumplido); el programa recalcula su % a partir de los hitos. */
  async update(user: AuthUser, id: string, input: UpdateMilestoneInput): Promise<MilestoneDto> {
    const { tenantId } = user;
    const current = await this.row(tenantId, id);
    const data: Prisma.MilestoneUncheckedUpdateInput = {};
    const changes: Record<string, string | number | boolean> = {};
    if (input.name !== undefined && input.name !== current.name) {
      data.name = input.name;
      changes.name = input.name;
    }
    if (input.dueDate !== undefined && input.dueDate !== isoDate(current.dueDate)) {
      data.dueDate = utcDate(input.dueDate);
      changes.dueDate = input.dueDate;
    }
    if (input.progress !== undefined && input.progress !== current.progress) {
      const done = doneAfterProgress(current.progress, input.progress, this.env.PLANTED_BUGS);
      data.progress = input.progress;
      data.done = done;
      changes.progress = input.progress;
      changes.done = done;
    }
    if (Object.keys(changes).length === 0) return toMilestoneDto(current);

    const updated = await this.prisma.$transaction(async (tx) => {
      const row = await tx.milestone.update({ where: { tenantId_id: { tenantId, id } }, data });
      await this.audit.record({ tenantId, actorId: user.id, action: 'milestone.updated', entity: 'milestone', entityId: id, diff: changes }, tx);
      return row;
    });
    if (updated.done && !current.done) {
      this.events.emit(tenantId, { type: 'milestone', severity: 'ok', programCode: updated.programCode, vars: { program: updated.programCode, name: updated.name }, origin: 'system' });
    }
    return toMilestoneDto(updated);
  }

  async remove(user: AuthUser, id: string): Promise<void> {
    const { tenantId } = user;
    const current = await this.row(tenantId, id);
    await this.prisma.$transaction(async (tx) => {
      await tx.milestone.delete({ where: { tenantId_id: { tenantId, id } } });
      await this.audit.record({ tenantId, actorId: user.id, action: 'milestone.deleted', entity: 'milestone', entityId: id, diff: { program: current.programCode, name: current.name } }, tx);
    });
  }
}
