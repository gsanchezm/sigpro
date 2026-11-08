import { NC_SEVERITIES, NC_STATES, groupByState, isClosureComment, isNcOpen, isMilestoneDone } from '@sigpro/shared';
import { describe, expect, it } from 'vitest';
import { buildTenantSeed } from './data';

const seed = buildTenantSeed('demo', (plain) => `hash(${plain})`);

describe('seed v3: hitos', () => {
  it('el avance es coherente con done: cumplido = 100 %, y a lo sumo un hito en curso por programa', () => {
    expect(seed.milestones.every((m) => m.done === isMilestoneDone(m.progress))).toBe(true);
    seed.programs.forEach((program) => {
      const rows = seed.milestones.filter((m) => m.programCode === program.code);
      expect(rows.filter((m) => m.progress > 0 && m.progress < 100).length).toBeLessThanOrEqual(1);
    });
  });

  it('el avance del programa (hitos cumplidos / total) no cambia respecto a la fase 2', () => {
    // PRG-001 sigue en 1 de 9 hitos cumplidos: el «11 % completado» que ya comprueban los specs de Programas
    const rows = seed.milestones.filter((m) => m.programCode === 'PRG-001');
    expect(rows).toHaveLength(9);
    expect(rows.filter((m) => m.done)).toHaveLength(1);
  });
});

describe('seed v3: no conformidades', () => {
  it('12 NC con códigos fijos NC-001…NC-012 y las cinco columnas pobladas', () => {
    expect(seed.nonConformities.map((nc) => nc.code)).toEqual(Array.from({ length: 12 }, (_, i) => `NC-${String(i + 1).padStart(3, '0')}`));
    const grouped = groupByState(seed.nonConformities);
    NC_STATES.forEach((state) => expect(grouped[state].length).toBeGreaterThan(0));
  });

  it('hay 8 abiertas (sin cerrar ni rechazar), las tres severidades y NC sin asignar para filter({ hasNot })', () => {
    expect(seed.nonConformities.filter((nc) => isNcOpen(nc.state))).toHaveLength(8);
    NC_SEVERITIES.forEach((severity) => expect(seed.nonConformities.some((nc) => nc.severity === severity)).toBe(true));
    expect(seed.nonConformities.filter((nc) => nc.assigneeId === null).map((nc) => nc.code)).toEqual(['NC-005', 'NC-010']);
  });

  it('tienen fecha de alta determinista y distinta', () => {
    const dates = seed.nonConformities.map((nc) => nc.createdAt.toISOString());
    expect(new Set(dates).size).toBe(12);
    expect(buildTenantSeed('alumno01', (plain) => plain).nonConformities.map((nc) => nc.createdAt.toISOString())).toEqual(dates);
  });
});

describe('seed v3: comentarios de NC', () => {
  it('cada comentario pertenece a una NC y a un usuario del tenant, con ids únicos', () => {
    const codes = new Set(seed.nonConformities.map((nc) => nc.code));
    const users = new Set(seed.users.map((u) => u.id));
    expect(seed.ncComments.every((c) => codes.has(c.ncCode) && c.authorId !== null && users.has(c.authorId))).toBe(true);
    expect(new Set(seed.ncComments.map((c) => c.id)).size).toBe(seed.ncComments.length);
  });

  it('las NC cerradas llevan su comentario de cierre válido (≥ 20 caracteres)', () => {
    const closed = seed.nonConformities.filter((nc) => nc.state === 'closed');
    expect(closed.length).toBeGreaterThan(0);
    closed.forEach((nc) => {
      const closure = seed.ncComments.filter((c) => c.ncCode === nc.code && c.kind === 'closure');
      expect(closure).toHaveLength(1);
      expect(isClosureComment(closure[0]?.body ?? '')).toBe(true);
    });
  });

  it('hay NC con 0, 1, 2 y 3 comentarios (para probar el contador de la tarjeta)', () => {
    const counts = new Set(seed.nonConformities.map((nc) => seed.ncComments.filter((c) => c.ncCode === nc.code).length));
    [0, 1, 2, 3].forEach((count) => expect(counts.has(count)).toBe(true));
  });
});
