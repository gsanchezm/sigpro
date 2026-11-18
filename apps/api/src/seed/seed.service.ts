import { Inject, Injectable, Logger, Optional, type OnApplicationBootstrap } from '@nestjs/common';
import type { ChaosConfig, ResetResponse } from '@sigpro/shared';
import { hashSync } from 'bcryptjs';
import { ENV, tenantSuffixOptions, type Env } from '../config/env';
import { MissionEventsService } from '../mission/mission-events.service';
import { PrismaService } from '../prisma/prisma.service';
import { SEED_VERSION, buildTenantSeed, tenantIds } from './data';
import { isLegacyStudentTenant } from './tenant-suffix';

const BCRYPT_COST = 10;

@Injectable()
export class SeedService implements OnApplicationBootstrap {
  private readonly logger = new Logger(SeedService.name);
  // Un hash por contraseña y proceso: los usuarios de demo comparten contraseñas, así el reset tarda < 2 s
  private readonly hashes = new Map<string, string>();

  constructor(
    private readonly prisma: PrismaService,
    @Inject(ENV) private readonly env: Pick<Env, 'SEED_ON_BOOT' | 'SEED_STUDENT_TENANTS' | 'TENANT_SUFFIX_SEED' | 'TENANT_SUFFIX_LENGTH'>,
    // Opcional: el CLI `pnpm seed` crea el servicio sin Nest y no tiene eventos en memoria que limpiar
    @Optional() private readonly events?: MissionEventsService,
  ) {}

  readonly hash = (plain: string): string => {
    const cached = this.hashes.get(plain);
    if (cached) return cached;
    const created = hashSync(plain, BCRYPT_COST);
    this.hashes.set(plain, created);
    return created;
  };

  get tenants(): readonly string[] {
    return tenantIds(this.env.SEED_STUDENT_TENANTS, tenantSuffixOptions(this.env));
  }

  /**
   * Tenants de alumno SIN sufijo (`alumno07`) que siguen en la base tras activar `TENANT_SUFFIX_SEED`. El seed de arranque y
   * `resetAll` solo recorren la lista generada: estos quedarían sin reiniciar y accesibles con la contraseña pública.
   */
  async legacyTenants(): Promise<readonly string[]> {
    const wanted = new Set(this.tenants);
    const rows = await this.prisma.tenant.findMany({ select: { id: true }, orderBy: { id: 'asc' } });
    return rows.map((row) => row.id).filter((id) => isLegacyStudentTenant(id) && !wanted.has(id));
  }

  /** Tenants de la lista vigente que todavía no existen en la base (la API aún no ha arrancado con la semilla nueva). */
  async missingTenants(): Promise<readonly string[]> {
    const present = new Set((await this.prisma.tenant.findMany({ select: { id: true } })).map((row) => row.id));
    return this.tenants.filter((id) => !present.has(id));
  }

  /**
   * Borra (con todos sus datos, en cascada) los tenants antiguos de `legacyTenants()`. Es irreversible y NUNCA se ejecuta al
   * arrancar: solo la llama el comando `tenants:purge-legacy`, que pide confirmación. Sin semilla no hay nada que purgar, y
   * no borra nada mientras falte algún tenant nuevo (dejaría a los alumnos sin entorno).
   */
  async purgeLegacyTenants(): Promise<readonly string[]> {
    if (!tenantSuffixOptions(this.env)) throw new Error('TENANT_SUFFIX_SEED no está definida: sin sufijos, los tenants alumnoNN son los vigentes y no hay nada que purgar.');
    const missing = await this.missingTenants();
    if (missing.length > 0) throw new Error(`Faltan ${missing.length} tenant(s) nuevos en la base: arranca antes la API con TENANT_SUFFIX_SEED y SEED_ON_BOOT=true. No se ha borrado nada.`);
    const legacy = await this.legacyTenants();
    if (legacy.length > 0) await this.prisma.tenant.deleteMany({ where: { id: { in: [...legacy] } } });
    return legacy;
  }

  /**
   * Crea los tenants que falten y vuelve a sembrar los que tienen una `seed_version` anterior (despliegues con datos
   * de una fase previa). Los tenants al día no se tocan; el caos se conserva al re-sembrar.
   */
  async onApplicationBootstrap(): Promise<void> {
    if (!this.env.SEED_ON_BOOT) return;
    const existing = new Map((await this.prisma.tenant.findMany({ select: { id: true, seedVersion: true } })).map((t) => [t.id, t.seedVersion]));
    const pending = this.tenants.filter((id) => (existing.get(id) ?? 0) < SEED_VERSION);
    for (const id of pending) await this.applyTenant(id);
    // Con sufijos los ids son un secreto: el log (lo lee quien tenga acceso al panel de Render) lleva solo el recuento
    const names = tenantSuffixOptions(this.env) ? '' : `: ${pending.join(', ')}`;
    if (pending.length > 0) this.logger.log(`Seed v${SEED_VERSION} aplicado a ${pending.length} tenant(s)${names}`);
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
      this.prisma.evidence.createMany({ data: copy(rows.evidences) }),
      this.prisma.nonConformity.createMany({ data: copy(rows.nonConformities) }),
      this.prisma.ncComment.createMany({ data: copy(rows.ncComments) }),
      this.prisma.document.createMany({ data: copy(rows.documents) }),
      this.prisma.documentVersion.createMany({ data: copy(rows.documentVersions).map((row) => ({ ...row, lines: row.lines ?? [] })) }),
      this.prisma.contract.createMany({ data: copy(rows.contracts) }),
      this.prisma.auditLog.createMany({ data: copy(rows.auditLogs).map((row) => ({ ...row, diff: row.diff ?? undefined })) }),
    ]);
    this.events?.clear(tenantId);
    return { tenant: tenantId, ms: Date.now() - started };
  }

  async resetAll(): Promise<readonly ResetResponse[]> {
    const results: ResetResponse[] = [];
    for (const id of this.tenants) results.push(await this.applyTenant(id));
    return results;
  }
}
