import { Inject, Injectable, Logger, type OnApplicationBootstrap } from '@nestjs/common';
import type { ChaosConfig, ResetResponse } from '@sigpro/shared';
import { hashSync } from 'bcryptjs';
import { ENV, type Env } from '../config/env';
import { PrismaService } from '../prisma/prisma.service';
import { buildTenantSeed, tenantIds } from './data';

const BCRYPT_COST = 10;

@Injectable()
export class SeedService implements OnApplicationBootstrap {
  private readonly logger = new Logger(SeedService.name);
  // Un hash por contraseña y proceso: los usuarios de demo comparten contraseñas, así el reset tarda < 2 s
  private readonly hashes = new Map<string, string>();

  constructor(
    private readonly prisma: PrismaService,
    @Inject(ENV) private readonly env: Pick<Env, 'SEED_ON_BOOT' | 'SEED_STUDENT_TENANTS'>,
  ) {}

  readonly hash = (plain: string): string => {
    const cached = this.hashes.get(plain);
    if (cached) return cached;
    const created = hashSync(plain, BCRYPT_COST);
    this.hashes.set(plain, created);
    return created;
  };

  get tenants(): readonly string[] {
    return tenantIds(this.env.SEED_STUDENT_TENANTS);
  }

  /** Crea los tenants que falten (no toca los existentes). */
  async onApplicationBootstrap(): Promise<void> {
    if (!this.env.SEED_ON_BOOT) return;
    const existing = new Set((await this.prisma.tenant.findMany({ select: { id: true } })).map((t) => t.id));
    const missing = this.tenants.filter((id) => !existing.has(id));
    for (const id of missing) await this.applyTenant(id);
    if (missing.length > 0) this.logger.log(`Seed aplicado a ${missing.length} tenant(s): ${missing.join(', ')}`);
  }

  /** Restaura el seed del tenant en una sola transacción; conserva su configuración de caos. */
  async applyTenant(tenantId: string): Promise<ResetResponse> {
    const started = Date.now();
    const rows = buildTenantSeed(tenantId, this.hash);
    const previous = await this.prisma.tenant.findUnique({ where: { id: tenantId }, select: { chaos: true } });
    const chaos = (previous?.chaos ?? undefined) as ChaosConfig | undefined;
    const copy = <T>(items: readonly T[]): T[] => [...items];

    await this.prisma.$transaction([
      // Todas las claves foráneas son ON DELETE CASCADE desde tenants: una sola sentencia limpia el tenant
      this.prisma.tenant.deleteMany({ where: { id: tenantId } }),
      this.prisma.tenant.create({ data: { ...rows.tenant, ...(chaos ? { chaos } : {}) } }),
      this.prisma.user.createMany({ data: copy(rows.users) }),
      this.prisma.supplier.createMany({ data: copy(rows.suppliers) }),
      this.prisma.program.createMany({ data: copy(rows.programs) }),
      this.prisma.milestone.createMany({ data: copy(rows.milestones) }),
      this.prisma.requirement.createMany({ data: copy(rows.requirements) }),
      this.prisma.testCase.createMany({ data: copy(rows.testCases).map((row) => ({ ...row, steps: row.steps ?? [] })) }),
      this.prisma.requirementTestCase.createMany({ data: copy(rows.requirementTestCases) }),
      this.prisma.testRun.createMany({ data: copy(rows.testRuns) }),
      this.prisma.nonConformity.createMany({ data: copy(rows.nonConformities) }),
      this.prisma.document.createMany({ data: copy(rows.documents) }),
      this.prisma.contract.createMany({ data: copy(rows.contracts) }),
      this.prisma.auditLog.createMany({ data: copy(rows.auditLogs).map((row) => ({ ...row, diff: row.diff ?? undefined })) }),
    ]);
    return { tenant: tenantId, ms: Date.now() - started };
  }

  async resetAll(): Promise<readonly ResetResponse[]> {
    const results: ResetResponse[] = [];
    for (const id of this.tenants) results.push(await this.applyTenant(id));
    return results;
  }
}
