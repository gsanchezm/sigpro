import { Inject, Injectable } from '@nestjs/common';
import type { NcState as DbNcState, Prisma } from '@prisma/client';
import {
  NC_SEVERITY_TONE,
  isNcOpen,
  ncNextStates,
  nextNcCode,
  sanitizeRichText,
  type CreateNcInput,
  type MissionEventDto,
  type NcCommentDto,
  type NcCommentInput,
  type NcDetailDto,
  type NcDto,
  type NcListQuery,
  type NcListResponse,
  type NcSeverity,
  type TransitionNcInput,
  type UpdateNcInput,
} from '@sigpro/shared';
import { randomBytes } from 'node:crypto';
import { AuditService } from '../audit/audit.service';
import type { AuthUser } from '../common/auth.types';
import { fail } from '../common/errors';
import { lockTenantCodes } from '../common/tenant-lock';
import { ENV, type Env } from '../config/env';
import { MissionEventsService } from '../mission/mission-events.service';
import { PrismaService } from '../prisma/prisma.service';
import { decideNcTransition } from './nc-rules';

const LIST_INCLUDE = { program: { select: { name: true } }, assignee: { select: { name: true } }, _count: { select: { comments: true } } } satisfies Prisma.NonConformityInclude;
const DETAIL_INCLUDE = { ...LIST_INCLUDE, comments: { orderBy: [{ createdAt: 'asc' }, { id: 'asc' }], include: { author: { select: { name: true } } } } } satisfies Prisma.NonConformityInclude;

type NcRow = Prisma.NonConformityGetPayload<{ include: typeof LIST_INCLUDE }>;
type NcDetailRow = Prisma.NonConformityGetPayload<{ include: typeof DETAIL_INCLUDE }>;

export const toNcDto = (row: NcRow): NcDto => ({
  code: row.code,
  programCode: row.programCode,
  programName: row.program.name,
  severity: row.severity,
  description: row.description,
  state: row.state,
  assigneeId: row.assigneeId,
  assigneeName: row.assignee?.name ?? null,
  testRunId: row.testRunId,
  commentCount: row._count.comments,
  createdAt: row.createdAt.toISOString(),
});

const toCommentDto = (row: NcDetailRow['comments'][number]): NcCommentDto => ({
  id: row.id,
  authorId: row.authorId,
  authorName: row.author?.name ?? null,
  body: row.body,
  kind: row.kind,
  createdAt: row.createdAt.toISOString(),
});

const toDetailDto = (row: NcDetailRow): NcDetailDto => ({ ...toNcDto(row), comments: row.comments.map(toCommentDto), transitions: ncNextStates(row.state) });

const invalid = (field: string, key: string) => fail.unprocessable('validation_failed', 'validation_failed', { [field]: key });

/** Severidad del evento a partir de la de la NC (el color del tablero es el mismo del feed). */
const eventSeverity = (severity: NcSeverity): MissionEventDto['severity'] => {
  const tone = NC_SEVERITY_TONE[severity];
  return tone === 'danger' ? 'danger' : tone === 'warn' ? 'warn' : 'info';
};

@Injectable()
export class NcService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly events: MissionEventsService,
    @Inject(ENV) private readonly env: Pick<Env, 'PLANTED_BUGS'>,
  ) {}

  private async row(tenantId: string, code: string): Promise<NcDetailRow> {
    const row = await this.prisma.nonConformity.findUnique({ where: { tenantId_code: { tenantId, code } }, include: DETAIL_INCLUDE });
    if (!row) throw fail.notFound('nc_not_found', 'nc_not_found');
    return row;
  }

  async list(tenantId: string, query: NcListQuery): Promise<NcListResponse> {
    const q = query.q?.trim();
    const where: Prisma.NonConformityWhereInput = {
      tenantId,
      ...(query.program ? { programCode: query.program } : {}),
      ...(query.severity ? { severity: query.severity } : {}),
      ...(query.assignee ? { assigneeId: query.assignee === 'none' ? null : query.assignee } : {}),
      ...(q ? { OR: [{ code: { contains: q, mode: 'insensitive' } }, { description: { contains: q, mode: 'insensitive' } }] } : {}),
    };
    const [rows, totalAll] = await Promise.all([
      this.prisma.nonConformity.findMany({ where, include: LIST_INCLUDE, orderBy: { code: 'asc' } }),
      this.prisma.nonConformity.count({ where: { tenantId } }),
    ]);
    return { items: rows.map(toNcDto), total: rows.length, totalAll };
  }

  async get(tenantId: string, code: string): Promise<NcDetailDto> {
    return toDetailDto(await this.row(tenantId, code));
  }

  /** NC abiertas (total y por severidad) del tenant: el KPI del panel de misión y la insignia del menú. */
  async openCounts(tenantId: string, client: Prisma.TransactionClient | PrismaService = this.prisma): Promise<{ ncOpen: number; ncBySeverity: Record<NcSeverity, number> }> {
    const groups = await client.nonConformity.groupBy({ by: ['severity', 'state'], where: { tenantId }, _count: { _all: true } });
    const ncBySeverity: Record<NcSeverity, number> = { minor: 0, major: 0, critical: 0 };
    groups.filter((group) => isNcOpen(group.state)).forEach((group) => (ncBySeverity[group.severity] += group._count._all));
    return { ncOpen: ncBySeverity.minor + ncBySeverity.major + ncBySeverity.critical, ncBySeverity };
  }

  private async broadcast(tenantId: string, draft: Omit<MissionEventDto, 'id' | 'seq' | 'at' | 'origin' | 'ncOpen' | 'ncBySeverity'>): Promise<void> {
    const counts = await this.openCounts(tenantId);
    this.events.emit(tenantId, { ...draft, origin: 'system', ...counts });
  }

  /** Alta en «Abierta». La descripción es HTML y se sanea con la lista blanca compartida. */
  async create(user: AuthUser, input: CreateNcInput): Promise<NcDto> {
    const { tenantId } = user;
    const program = await this.prisma.program.findUnique({ where: { tenantId_code: { tenantId, code: input.programCode } }, select: { code: true } });
    if (!program) throw invalid('programCode', 'programRequired');
    if (input.assigneeId) await this.assertAssignee(tenantId, input.assigneeId);

    const created = await this.prisma.$transaction(async (tx) => {
      await lockTenantCodes(tx, tenantId);
      const codes = (await tx.nonConformity.findMany({ where: { tenantId }, select: { code: true } })).map((nc) => nc.code);
      const code = nextNcCode(codes);
      const row = await tx.nonConformity.create({
        data: { tenantId, code, programCode: input.programCode, severity: input.severity, description: input.description, assigneeId: input.assigneeId, state: 'open' },
        include: LIST_INCLUDE,
      });
      await this.audit.record({ tenantId, actorId: user.id, action: 'nc.created', entity: 'nc', entityId: code, diff: { program: input.programCode, severity: input.severity } }, tx);
      return row;
    });
    await this.broadcast(tenantId, { type: 'nc_created', severity: eventSeverity(input.severity), programCode: input.programCode, vars: { code: created.code, severity: input.severity, program: input.programCode } });
    return toNcDto(created);
  }

  private async assertAssignee(tenantId: string, assigneeId: string): Promise<void> {
    const found = await this.prisma.user.findUnique({ where: { tenantId_id: { tenantId, id: assigneeId } }, select: { id: true } });
    if (!found) throw invalid('assigneeId', 'badAssignee');
  }

  /** Severidad, descripción y asignación (con `null` se quita). Solo se audita lo que cambia de verdad. */
  async update(user: AuthUser, code: string, input: UpdateNcInput): Promise<NcDetailDto> {
    const { tenantId } = user;
    const current = await this.row(tenantId, code);
    if (input.assigneeId) await this.assertAssignee(tenantId, input.assigneeId);

    const changes: Record<string, string | null> = {};
    const data: Prisma.NonConformityUncheckedUpdateInput = {};
    if (input.severity !== undefined && input.severity !== current.severity) {
      data.severity = input.severity;
      changes.severity = input.severity;
    }
    if (input.description !== undefined && sanitizeRichText(input.description) !== current.description) {
      data.description = input.description;
      changes.description = 'edited';
    }
    if (input.assigneeId !== undefined && input.assigneeId !== current.assigneeId) {
      data.assigneeId = input.assigneeId;
      changes.assignee = input.assigneeId;
    }
    if (Object.keys(changes).length === 0) return toDetailDto(current);

    const updated = await this.prisma.$transaction(async (tx) => {
      const row = await tx.nonConformity.update({ where: { tenantId_code: { tenantId, code } }, data, include: DETAIL_INCLUDE });
      await this.audit.record({ tenantId, actorId: user.id, action: 'nc.updated', entity: 'nc', entityId: code, diff: changes }, tx);
      return row;
    });
    if (changes.severity) await this.broadcast(tenantId, { type: 'nc_updated', severity: 'info', programCode: updated.programCode, vars: { code, severity: updated.severity } });
    return toDetailDto(updated);
  }

  /** Mueve la NC de columna. Cerrar exige el comentario de cierre (se guarda como comentario de tipo `closure`). */
  async transition(user: AuthUser, code: string, input: TransitionNcInput): Promise<NcDetailDto> {
    const { tenantId } = user;
    const current = await this.row(tenantId, code);
    const decision = decideNcTransition({ role: user.role, from: current.state, to: input.to, comment: input.comment, plantedBugs: this.env.PLANTED_BUGS });
    if (!decision.ok) {
      if (decision.status === 403) throw fail.forbidden(decision.code, decision.code);
      if (decision.status === 409) throw fail.conflict(decision.code, decision.code);
      throw fail.unprocessable(decision.code, decision.code, decision.errors ?? {});
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      if (input.to === 'closed') {
        await tx.ncComment.create({ data: { tenantId, id: `NCC-${randomBytes(5).toString('hex')}`, ncCode: code, authorId: user.id, body: (input.comment ?? '').trim(), kind: 'closure' } });
      }
      const row = await tx.nonConformity.update({ where: { tenantId_code: { tenantId, code } }, data: { state: input.to as DbNcState }, include: DETAIL_INCLUDE });
      await this.audit.record({ tenantId, actorId: user.id, action: 'nc.state_changed', entity: 'nc', entityId: code, diff: { from: current.state, to: input.to } }, tx);
      return row;
    });
    const closed = input.to === 'closed';
    await this.broadcast(tenantId, {
      type: closed ? 'nc_closed' : 'nc_moved',
      severity: closed ? 'ok' : 'info',
      programCode: updated.programCode,
      vars: closed ? { code } : { code, from: current.state, to: input.to },
    });
    return toDetailDto(updated);
  }

  /** Comentario (también el «rápido» del `prompt()` nativo). */
  async comment(user: AuthUser, code: string, input: NcCommentInput): Promise<NcCommentDto> {
    const { tenantId } = user;
    const nc = await this.row(tenantId, code);
    const created = await this.prisma.$transaction(async (tx) => {
      const row = await tx.ncComment.create({
        data: { tenantId, id: `NCC-${randomBytes(5).toString('hex')}`, ncCode: code, authorId: user.id, body: input.body, kind: input.kind },
        include: { author: { select: { name: true } } },
      });
      await this.audit.record({ tenantId, actorId: user.id, action: 'nc.commented', entity: 'nc', entityId: code, diff: { kind: input.kind } }, tx);
      return row;
    });
    await this.broadcast(tenantId, { type: 'nc_commented', severity: 'info', programCode: nc.programCode, vars: { code } });
    return toCommentDto(created);
  }
}
