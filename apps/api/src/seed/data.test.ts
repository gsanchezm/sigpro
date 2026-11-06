import { describe, expect, it } from 'vitest';
import { DEMO_USERS, buildTenantSeed, milestoneSplit, tenantIds } from './data';

const fakeHash = (plain: string) => `hash(${plain})`;

describe('tenantIds', () => {
  it('devuelve demo + alumno01…alumnoNN', () => {
    expect(tenantIds(0)).toEqual(['demo']);
    expect(tenantIds(3)).toEqual(['demo', 'alumno01', 'alumno02', 'alumno03']);
    expect(tenantIds(25).at(-1)).toBe('alumno25');
  });
});

describe('milestoneSplit', () => {
  it('aproxima el porcentaje objetivo con entre 5 y 10 hitos', () => {
    for (const target of [0, 11, 48, 85, 99]) {
      const { total, done } = milestoneSplit(target);
      expect(total).toBeGreaterThanOrEqual(5);
      expect(total).toBeLessThanOrEqual(10);
      expect(Math.abs((done / total) * 100 - target)).toBeLessThanOrEqual(10);
    }
  });

  it('PRG-001 muestra un 11 % de avance (1 de 9 hitos)', () => {
    expect(milestoneSplit(11)).toEqual({ total: 9, done: 1 });
  });
});

describe('buildTenantSeed', () => {
  const seed = buildTenantSeed('demo', fakeHash);

  it('genera las cantidades del plan: 24 programas, 40 requisitos, 25 casos, 12 NC y 6 proveedores', () => {
    expect(seed.programs).toHaveLength(24);
    expect(seed.requirements).toHaveLength(40);
    expect(seed.testCases).toHaveLength(25);
    expect(seed.nonConformities).toHaveLength(12);
    expect(seed.suppliers).toHaveLength(6);
  });

  it('usa códigos fijos con relleno de ceros', () => {
    expect(seed.programs.map((p) => p.code).slice(0, 3)).toEqual(['PRG-001', 'PRG-002', 'PRG-003']);
    expect(seed.requirements.some((r) => r.code === 'REQ-017')).toBe(true);
    expect(seed.testCases.at(-1)?.code).toBe('TC-025');
    expect(seed.nonConformities.at(-1)?.code).toBe('NC-012');
  });

  it('es determinista: dos ejecuciones producen exactamente lo mismo', () => {
    expect(buildTenantSeed('demo', fakeHash)).toEqual(seed);
  });

  it('cada tenant lleva su propio tenantId en todas las filas', () => {
    const other = buildTenantSeed('alumno07', fakeHash);
    const tables = [other.users, other.programs, other.milestones, other.requirements, other.testCases, other.testRuns, other.nonConformities, other.documents, other.auditLogs, other.suppliers, other.contracts];
    expect(tables.every((rows) => rows.every((row) => row.tenantId === 'alumno07'))).toBe(true);
    expect(other.tenant.id).toBe('alumno07');
  });

  it('REQ-017 nace en borrador para el ejercicio "aprobar REQ-017"', () => {
    expect(seed.requirements.find((r) => r.code === 'REQ-017')?.state).toBe('draft');
  });

  it('mantiene la integridad referencial', () => {
    const userIds = new Set(seed.users.map((u) => u.id));
    const programCodes = new Set(seed.programs.map((p) => p.code));
    const reqCodes = new Set(seed.requirements.map((r) => r.code));
    const tcCodes = new Set(seed.testCases.map((t) => t.code));
    const runIds = new Set(seed.testRuns.map((r) => r.id));
    const supplierIds = new Set(seed.suppliers.map((s) => s.id));

    expect(seed.programs.every((p) => userIds.has(p.ownerId))).toBe(true);
    expect(seed.milestones.every((m) => programCodes.has(m.programCode))).toBe(true);
    expect(seed.requirements.every((r) => programCodes.has(r.programCode) && (!r.parentCode || reqCodes.has(r.parentCode)))).toBe(true);
    expect(seed.testCases.every((t) => programCodes.has(t.programCode))).toBe(true);
    expect(seed.requirementTestCases.every((l) => reqCodes.has(l.requirementCode) && tcCodes.has(l.testCaseCode))).toBe(true);
    expect(seed.testRuns.every((r) => tcCodes.has(r.testCaseCode) && (!r.executedById || userIds.has(r.executedById)))).toBe(true);
    expect(seed.nonConformities.every((n) => programCodes.has(n.programCode) && (!n.assigneeId || userIds.has(n.assigneeId)) && (!n.testRunId || runIds.has(n.testRunId)))).toBe(true);
    expect(seed.documents.every((d) => programCodes.has(d.programCode))).toBe(true);
    expect(seed.contracts.every((c) => programCodes.has(c.programCode) && supplierIds.has(c.supplierId))).toBe(true);
  });

  it('las claves primarias son únicas dentro del tenant', () => {
    const unique = (keys: string[]) => new Set(keys).size === keys.length;
    expect(unique(seed.milestones.map((m) => m.id))).toBe(true);
    expect(unique(seed.testRuns.map((r) => r.id))).toBe(true);
    expect(unique(seed.documents.map((d) => d.id))).toBe(true);
    expect(unique(seed.users.map((u) => u.email))).toBe(true);
    expect(unique(seed.contracts.map((c) => `${c.programCode}|${c.supplierId}`))).toBe(true);
  });

  it('Programas reproduce los datos del prototipo (PRG-001 y PRG-024)', () => {
    const first = seed.programs[0];
    expect(first).toMatchObject({ code: 'PRG-001', name: 'Sistema de mando táctico Ártemis', status: 'active', ownerId: 'u1', priority: 'medium', classified: true, budgetEur: 450000 });
    expect(first?.startDate.toISOString().slice(0, 10)).toBe('2023-01-01');
    expect(first?.endDate.toISOString().slice(0, 10)).toBe('2024-07-01');
    expect(seed.programs.at(-1)?.code).toBe('PRG-024');
  });

  it('el avance de cada programa sale de sus hitos', () => {
    const milestones = seed.milestones.filter((m) => m.programCode === 'PRG-001');
    expect(milestones).toHaveLength(9);
    expect(milestones.filter((m) => m.done)).toHaveLength(1);
  });

  it('incluye los 6 usuarios demo del handoff con sus hashes y MFA solo para admin', () => {
    expect(seed.users.map((u) => u.email)).toEqual(DEMO_USERS.map((u) => u.email));
    const admin = seed.users.find((u) => u.email === 'admin@sigpro.test');
    expect(admin).toMatchObject({ role: 'admin', mfaCode: '123456', passwordHash: 'hash(Admin1234!)' });
    expect(seed.users.filter((u) => u.mfaCode)).toHaveLength(1);
  });

  it('bloqueado@ nace bloqueado y pendiente@ pendiente de aprobación', () => {
    const locked = seed.users.find((u) => u.email === 'bloqueado@sigpro.test');
    const pending = seed.users.find((u) => u.email === 'pendiente@sigpro.test');
    expect(locked?.lockedAt).toBeInstanceOf(Date);
    expect(locked?.failedAttempts).toBe(5);
    expect(pending?.pendingApproval).toBe(true);
    expect(seed.users.filter((u) => !u.lockedAt && !u.pendingApproval)).toHaveLength(4);
  });

  it('los tenants de alumno añaden alumnoNN@sigpro.lab (admin); demo no', () => {
    expect(seed.users.some((u) => u.email.endsWith('@sigpro.lab'))).toBe(false);
    const student = buildTenantSeed('alumno07', fakeHash).users.find((u) => u.email === 'alumno07@sigpro.lab');
    expect(student).toMatchObject({ role: 'admin', id: 'u7' });
  });

  it('REQ-017 enlaza con casos de prueba (matriz de trazabilidad no vacía)', () => {
    expect(seed.requirementTestCases.some((l) => l.requirementCode === 'REQ-017')).toBe(true);
  });
});
