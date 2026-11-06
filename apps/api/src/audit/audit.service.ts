import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { randomBytes } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';

export interface AuditEntry {
  readonly tenantId: string;
  readonly actorId: string | null;
  readonly action: string;
  readonly entity: string;
  readonly entityId: string;
  readonly diff?: Prisma.InputJsonValue;
}

/** La API escribe un registro de auditoría en cada mutación (solo lectura para el resto). */
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
}
