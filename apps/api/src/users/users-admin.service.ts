import { Injectable } from '@nestjs/common';
import type { User } from '@prisma/client';
import type { AdminUserDto, UpdateUserInput } from '@sigpro/shared';
import { AuditService } from '../audit/audit.service';
import type { AuthUser } from '../common/auth.types';
import { fail } from '../common/errors';
import { PrismaService } from '../prisma/prisma.service';
import { decideUserUpdate } from './user-rules';

export const toAdminUserDto = (row: User): AdminUserDto => ({
  id: row.id,
  name: row.name,
  email: row.email,
  role: row.role,
  active: row.active,
  locked: row.lockedAt !== null,
  pending: row.pendingApproval,
  org: row.org,
});

/** Gestión de usuarios del tenant (solo admin): activar/desactivar y cambiar el rol. */
@Injectable()
export class UsersAdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(tenantId: string): Promise<readonly AdminUserDto[]> {
    const rows = await this.prisma.user.findMany({ where: { tenantId }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] });
    return rows.map(toAdminUserDto);
  }

  async update(actor: AuthUser, id: string, input: UpdateUserInput): Promise<AdminUserDto> {
    const { tenantId } = actor;
    const target = await this.prisma.user.findUnique({ where: { tenantId_id: { tenantId, id } } });
    if (!target) throw fail.notFound('user_not_found', 'user_not_found');
    const activeAdmins = await this.prisma.user.count({ where: { tenantId, role: 'admin', active: true } });
    const decision = decideUserUpdate(actor.id, target, input, activeAdmins);
    if (!decision.ok) throw fail.conflict(decision.code, decision.code);

    const changes: Record<string, string | boolean> = {};
    if (input.active !== undefined && input.active !== target.active) changes.active = input.active;
    if (input.role !== undefined && input.role !== target.role) changes.role = input.role;
    if (Object.keys(changes).length === 0) return toAdminUserDto(target);

    const updated = await this.prisma.$transaction(async (tx) => {
      const row = await tx.user.update({ where: { tenantId_id: { tenantId, id } }, data: changes });
      await this.audit.record({ tenantId, actorId: actor.id, action: 'user.updated', entity: 'user', entityId: id, diff: changes }, tx);
      return row;
    });
    return toAdminUserDto(updated);
  }
}
