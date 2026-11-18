import type { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import { describe, expect, it, vi } from 'vitest';
import type { ChaosService } from '../chaos/chaos.service';
import { ApiException } from '../common/errors';
import type { PrismaService } from '../prisma/prisma.service';
import { DEMO_USERS } from '../seed/data';
import { ConfigController } from './config.controller';
import { loadEnv } from './env';

const TENANTS = [
  { id: 'alumno01-aaaa', name: 'Alumno 01-aaaa' },
  { id: 'demo', name: 'Demo' },
];
const ADMIN_KEY = 'clave-de-administracion';

const build = (overrides: Record<string, string> = {}) => {
  const findMany = vi.fn().mockResolvedValue(TENANTS);
  const prisma = { tenant: { findMany } } as unknown as PrismaService;
  const chaos = { get: vi.fn().mockResolvedValue({ latencyMs: 0, errorRate: 0, flakyLabels: false }) } as unknown as ChaosService;
  const jwt = {
    verify: (token: string) => {
      if (token === 'sesion-valida') return { type: 'access' };
      throw new Error('jwt malformed');
    },
  } as unknown as JwtService;
  const env = loadEnv({ DATABASE_URL: 'postgresql://x', ADMIN_KEY, ...overrides });
  return { controller: new ConfigController(prisma, chaos, jwt, env), findMany };
};

const request = (headers: Record<string, string> = {}): Request => ({ headers }) as unknown as Request;
const SEED = { TENANT_SUFFIX_SEED: '0123456789abcdef' };

const statusOf = async (work: () => Promise<unknown> | unknown): Promise<number | null> => {
  try {
    await work();
    return null;
  } catch (error) {
    return error instanceof ApiException ? error.getStatus() : -1;
  }
};

describe('GET /config/tenants', () => {
  it('sin variables sigue siendo público (entorno demo como hoy)', async () => {
    const { controller } = build();
    await expect(controller.tenants(request())).resolves.toEqual(TENANTS);
  });

  it('con TENANT_SUFFIX_SEED exige X-Admin-Key: 403 sin ella y sin consultar la base', async () => {
    const { controller, findMany } = build(SEED);
    expect(await statusOf(() => controller.tenants(request()))).toBe(403);
    expect(await statusOf(() => controller.tenants(request({ 'x-admin-key': 'otra-clave' })))).toBe(403);
    expect(findMany).not.toHaveBeenCalled();
  });

  it('con TENANT_SUFFIX_SEED y la clave correcta devuelve la lista', async () => {
    const { controller } = build(SEED);
    await expect(controller.tenants(request({ 'x-admin-key': ADMIN_KEY }))).resolves.toEqual(TENANTS);
  });

  it('una sesión de alumno NO basta: la lista es del administrador', async () => {
    const { controller } = build(SEED);
    expect(await statusOf(() => controller.tenants(request({ authorization: 'Bearer sesion-valida' })))).toBe(403);
  });

  it('con LAB_PUBLIC=false también exige la clave', async () => {
    const { controller } = build({ LAB_PUBLIC: 'false' });
    expect(await statusOf(() => controller.tenants(request()))).toBe(403);
    await expect(controller.tenants(request({ 'x-admin-key': ADMIN_KEY }))).resolves.toEqual(TENANTS);
  });
});

describe('GET /config/test-users', () => {
  it('sin variables devuelve los usuarios de demo a cualquiera, como hoy', () => {
    const { controller } = build();
    expect(controller.testUsers(request())).toEqual(DEMO_USERS);
  });

  it('con LAB_PUBLIC=false un anónimo recibe una lista vacía (la pantalla de acceso no pinta nada)', () => {
    const { controller } = build({ LAB_PUBLIC: 'false' });
    expect(controller.testUsers(request())).toEqual([]);
    expect(controller.testUsers(request({ authorization: 'Bearer token-roto' }))).toEqual([]);
  });

  it('con LAB_PUBLIC=false una sesión válida o la clave de administración sí los ven', () => {
    const { controller } = build({ LAB_PUBLIC: 'false' });
    expect(controller.testUsers(request({ authorization: 'Bearer sesion-valida' }))).toEqual(DEMO_USERS);
    expect(controller.testUsers(request({ 'x-admin-key': ADMIN_KEY }))).toEqual(DEMO_USERS);
  });

  it('en producción no hay usuarios de prueba, tampoco con sesión', () => {
    const { controller } = build({ APP_ENV: 'production' });
    expect(controller.testUsers(request({ authorization: 'Bearer sesion-valida' }))).toEqual([]);
  });
});

describe('GET /config', () => {
  it('anuncia testUsers=true sin variables y testUsers=false con LAB_PUBLIC=false', async () => {
    expect((await build().controller.get(undefined)).testUsers).toBe(true);
    expect((await build({ LAB_PUBLIC: 'false' }).controller.get(undefined)).testUsers).toBe(false);
  });

  it('no añade campos nuevos al contrato público', async () => {
    const config = await build(SEED).controller.get('alumno01-aaaa');
    expect(Object.keys(config).sort()).toEqual(['chaos', 'env', 'plantedBugs', 'tenant', 'testUsers', 'version']);
  });
});
