import { Logger } from '@nestjs/common';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadEnv } from '../config/env';
import type { PrismaService } from '../prisma/prisma.service';
import { SeedService } from './seed.service';
import { tenantIds } from './data';

const SEED = '0123456789abcdef';
const envWith = (overrides: Record<string, string> = {}) => ({ ...loadEnv({ DATABASE_URL: 'postgresql://x', SEED_STUDENT_TENANTS: '3', ...overrides }) });

/** Prisma de pega: `tenant` con las filas indicadas; el resto de modelos acepta cualquier operación. */
const fakePrisma = (rows: readonly string[]) => {
  const deleteMany = vi.fn().mockResolvedValue({ count: 0 });
  const tenant = {
    findMany: vi.fn().mockResolvedValue(rows.map((id) => ({ id, seedVersion: 3 }))),
    findUnique: vi.fn().mockResolvedValue(null),
    deleteMany,
    create: vi.fn(),
  };
  const prisma = { tenant, $transaction: vi.fn().mockResolvedValue([]), user: { createMany: vi.fn() } } as unknown as PrismaService;
  return { prisma, deleteMany };
};

afterEach(() => vi.restoreAllMocks());

describe('SeedService.tenants', () => {
  it('sin semilla son los ids de siempre', () => {
    const service = new SeedService(fakePrisma([]).prisma, envWith());
    expect(service.tenants).toEqual(['demo', 'alumno01', 'alumno02', 'alumno03']);
  });

  it('con semilla llevan sufijo, y es el mismo que calcula el comando tenants:list', () => {
    const service = new SeedService(fakePrisma([]).prisma, envWith({ TENANT_SUFFIX_SEED: SEED }));
    expect(service.tenants).toEqual(tenantIds(3, { seed: SEED, length: 4 }));
    expect(service.tenants.slice(1).every((id) => /^alumno\d{2}-[0-9a-z]{4}$/.test(id))).toBe(true);
  });
});

describe('log de arranque', () => {
  const bootLog = async (overrides: Record<string, string>): Promise<string> => {
    const log = vi.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    const service = new SeedService(fakePrisma([]).prisma, envWith({ SEED_ON_BOOT: 'true', ...overrides }));
    vi.spyOn(service, 'applyTenant').mockResolvedValue({ tenant: 'x', ms: 1 });
    await service.onApplicationBootstrap();
    return log.mock.calls.map((call) => String(call[0])).join('\n');
  };

  it('sin semilla lista los tenants como siempre', async () => {
    expect(await bootLog({})).toContain('alumno01');
  });

  it('con semilla solo lleva el recuento: los ids son un secreto', async () => {
    const text = await bootLog({ TENANT_SUFFIX_SEED: SEED });
    expect(text).toContain('4 tenant(s)');
    expect(text).not.toMatch(/alumno\d{2}/);
  });
});

describe('purga de tenants antiguos', () => {
  const current = tenantIds(3, { seed: SEED, length: 4 });
  const withSeed = { TENANT_SUFFIX_SEED: SEED };

  it('detecta solo los alumnoNN sin sufijo que no están en la lista vigente', async () => {
    const { prisma } = fakePrisma(['demo', 'alumno01', 'alumno02', 'alumno09', ...current]);
    expect(await new SeedService(prisma, envWith(withSeed)).legacyTenants()).toEqual(['alumno01', 'alumno02', 'alumno09']);
  });

  it('sin TENANT_SUFFIX_SEED se niega a borrar nada: los alumnoNN son los vigentes', async () => {
    const { prisma, deleteMany } = fakePrisma(['demo', 'alumno01']);
    await expect(new SeedService(prisma, envWith()).purgeLegacyTenants()).rejects.toThrow(/TENANT_SUFFIX_SEED/);
    expect(deleteMany).not.toHaveBeenCalled();
  });

  it('se niega a borrar mientras falte algún tenant nuevo (dejaría a los alumnos sin entorno)', async () => {
    const { prisma, deleteMany } = fakePrisma(['demo', 'alumno01', 'alumno02', current[1] as string]);
    await expect(new SeedService(prisma, envWith(withSeed)).purgeLegacyTenants()).rejects.toThrow(/Faltan 2 tenant/);
    expect(deleteMany).not.toHaveBeenCalled();
  });

  it('con todos los nuevos presentes borra únicamente los antiguos', async () => {
    const { prisma, deleteMany } = fakePrisma(['alumno01', 'alumno02', ...current]);
    const deleted = await new SeedService(prisma, envWith(withSeed)).purgeLegacyTenants();
    expect(deleted).toEqual(['alumno01', 'alumno02']);
    expect(deleteMany).toHaveBeenCalledWith({ where: { id: { in: ['alumno01', 'alumno02'] } } });
  });

  it('si no hay antiguos no ejecuta ningún borrado', async () => {
    const { prisma, deleteMany } = fakePrisma([...current]);
    expect(await new SeedService(prisma, envWith(withSeed)).purgeLegacyTenants()).toEqual([]);
    expect(deleteMany).not.toHaveBeenCalled();
  });
});
