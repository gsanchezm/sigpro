import { Injectable } from '@nestjs/common';
import { chaosSchema, type ChaosConfig } from '@sigpro/shared';
import { PrismaService } from '../prisma/prisma.service';
import { NO_CHAOS } from './chaos';

const CACHE_MS = 1000;

/** Flags del modo caos por tenant, con una caché corta para no consultar la base en cada petición. */
@Injectable()
export class ChaosService {
  private readonly cache = new Map<string, { config: ChaosConfig; at: number }>();

  constructor(private readonly prisma: PrismaService) {}

  async get(tenantId: string): Promise<ChaosConfig> {
    const cached = this.cache.get(tenantId);
    if (cached && Date.now() - cached.at < CACHE_MS) return cached.config;
    const row = await this.prisma.tenant.findUnique({ where: { id: tenantId }, select: { chaos: true } });
    const parsed = chaosSchema.safeParse(row?.chaos ?? {});
    const config = parsed.success ? parsed.data : NO_CHAOS;
    this.cache.set(tenantId, { config, at: Date.now() });
    return config;
  }

  async update(tenantId: string, patch: Partial<ChaosConfig>): Promise<ChaosConfig> {
    this.cache.delete(tenantId);
    const next = chaosSchema.parse({ ...(await this.get(tenantId)), ...patch });
    await this.prisma.tenant.update({ where: { id: tenantId }, data: { chaos: next } });
    this.cache.set(tenantId, { config: next, at: Date.now() });
    return next;
  }
}
