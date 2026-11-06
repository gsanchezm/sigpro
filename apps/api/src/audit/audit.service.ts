import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { AUDIT_PAGE_SIZE, type AuditEntryDto, type AuditPageDto, type AuditQuery } from '@sigpro/shared';
import { randomBytes } from 'node:crypto';
import { fail } from '../common/errors';
import { PrismaService } from '../prisma/prisma.service';
import { clampLimit, dayRange, decodeCursor, encodeCursor } from './audit-cursor';

export interface AuditEntry {
  readonly tenantId: string;
  readonly actorId: string | null;
  readonly action: string;
  readonly entity: string;
  readonly entityId: string;
  readonly diff?: Prisma.InputJsonValue;
}

const WITH_ACTOR = { actor: { select: { name: true } } } satisfies Prisma.AuditLogInclude;
type AuditRow = Prisma.AuditLogGetPayload<{ include: typeof WITH_ACTOR }>;

const toDto = (row: AuditRow): AuditEntryDto => ({
  id: row.id,
  at: row.at.toISOString(),
  actorId: row.actorId,
  actorName: row.actor?.name ?? null,
  action: row.action,
  entity: row.entity,
  entityId: row.entityId,
  diff: row.diff !== null && typeof row.diff === 'object' && !Array.isArray(row.diff) ? (row.diff as Record<string, unknown>) : null,
});

/** La API escribe un registro de auditoría en cada mutación (y lo lee el feed de Auditoría con paginación por cursor). */
@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  record(entry: AuditEntry, client: Prisma.TransactionClient = this.prisma): Promise<unknown> {
    return client.auditLog.create({
      data: {
        tenantId: entry.tenantId,
        id: `AL-${randomBytes(5).toString('hex')}`,
        actorId: entry.actorId,
        action: entry.action,
        entity: entry.entity,
        entityId: entry.entityId,
        at: new Date(),
        diff: entry.diff ?? undefined,
      },
    });
  }

  /**
   * Página del registro, de más reciente a más antiguo. Con cursor (no con offset): los eventos nuevos que lleguen mientras
   * se hace scroll no duplican filas. `total` cuenta los eventos que cumplen los filtros, sin tener en cuenta el cursor.
   */
  async page(tenantId: string, query: AuditQuery): Promise<AuditPageDto> {
    const limit = clampLimit(query.limit, AUDIT_PAGE_SIZE);
    const cursor = query.cursor ? decodeCursor(query.cursor) : null;
    if (query.cursor && !cursor) throw fail.unprocessable('validation_failed', 'validation_failed', { cursor: 'badCursor' });

    const q = query.q?.trim();
    const range = dayRange(query.from, query.to);
    const filters: Prisma.AuditLogWhereInput = {
      tenantId,
      ...(query.entity ? { entity: query.entity } : {}),
      ...(range.gte || range.lte ? { at: range } : {}),
      ...(q ? { OR: [{ action: { contains: q, mode: 'insensitive' } }, { entityId: { contains: q, mode: 'insensitive' } }] } : {}),
    };
    const after: Prisma.AuditLogWhereInput = cursor ? { OR: [{ at: { lt: cursor.at } }, { at: cursor.at, id: { lt: cursor.id } }] } : {};

    const [rows, total] = await Promise.all([
      this.prisma.auditLog.findMany({ where: { AND: [filters, after] }, include: WITH_ACTOR, orderBy: [{ at: 'desc' }, { id: 'desc' }], take: limit + 1 }),
      this.prisma.auditLog.count({ where: filters }),
    ]);
    const hasMore = rows.length > limit;
    const items = rows.slice(0, limit);
    const last = items[items.length - 1];
    return { items: items.map(toDto), nextCursor: hasMore && last ? encodeCursor({ at: last.at, id: last.id }) : null, total };
  }
}
