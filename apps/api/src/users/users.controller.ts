import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { OwnerDto } from '@sigpro/shared';
import { CurrentUser, type AuthUser } from '../common/auth.types';
import { PrismaService } from '../prisma/prisma.service';

@ApiTags('users')
@ApiBearerAuth('bearer')
@Controller('users')
export class UsersController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('owners')
  @ApiOperation({ summary: 'Personas del tenant que pueden ser responsables de un programa.' })
  async owners(@CurrentUser() user: AuthUser): Promise<readonly OwnerDto[]> {
    const [rows, counts] = await Promise.all([
      this.prisma.user.findMany({
        where: { tenantId: user.tenantId },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        select: { id: true, name: true, email: true, role: true },
      }),
      this.prisma.program.groupBy({ by: ['ownerId'], where: { tenantId: user.tenantId }, _count: { _all: true } }),
    ]);
    const countByOwner = new Map(counts.map((c) => [c.ownerId, c._count._all]));
    return rows.map((row) => ({ ...row, programCount: countByOwner.get(row.id) ?? 0 }));
  }
}
