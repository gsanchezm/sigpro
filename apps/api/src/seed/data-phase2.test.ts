import { REQUIREMENT_TAGS, buildTree, diffLines, paginateLines, visibleRows } from '@sigpro/shared';
import { describe, expect, it } from 'vitest';
import { SEED_VERSION, buildTenantSeed, documentLines } from './data';
import { evidencePng, makePng } from './png';

const fakeHash = (plain: string) => `hash(${plain})`;
const seed = buildTenantSeed('demo', fakeHash);

describe('seed v2: requisitos', () => {
  it('SEED_VERSION = 2 y el tenant lo declara (la API re-siembra los que tengan una versión menor)', () => {
    expect(SEED_VERSION).toBe(2);
    expect(seed.tenant.seedVersion).toBe(2);
  });

  it('forma un árbol de hasta 3 niveles dentro de cada programa, sin padres de otro programa ni ciclos', () => {
    const byCode = new Map(seed.requirements.map((r) => [r.code, r]));
    expect(seed.requirements.every((r) => !r.parentCode || byCode.get(r.parentCode)?.programCode === r.programCode)).toBe(true);
    for (const program of ['PRG-001', 'PRG-002', 'PRG-003']) {
      const tree = buildTree(seed.requirements.filter((r) => r.programCode === program));
      const depth = (nodes: typeof tree): number => Math.max(0, ...nodes.map((n) => 1 + depth(n.children)));
      expect(depth(tree)).toBe(3);
      expect(visibleRows(tree, new Set()).length).toBe(seed.requirements.filter((r) => r.programCode === program).length);
    }
  });

  it('REQ-017 cuelga de REQ-015, nace en borrador y su posición entre hermanos es única', () => {
    expect(seed.requirements.find((r) => r.code === 'REQ-017')).toMatchObject({ parentCode: 'REQ-015', state: 'draft', programCode: 'PRG-002' });
    const keys = seed.requirements.map((r) => `${r.programCode}|${r.parentCode}|${r.position}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('las etiquetas salen del catálogo y la descripción es HTML saneado', () => {
    expect(seed.requirements.every((r) => r.tags.every((tag) => (REQUIREMENT_TAGS as readonly string[]).includes(tag)))).toBe(true);
    expect(seed.requirements.some((r) => r.tags.length === 0)).toBe(true);
    expect(seed.requirements.some((r) => r.tags.length === 2)).toBe(true);
    expect(seed.requirements.every((r) => r.description.startsWith('<p>') && r.description.endsWith('</p>'))).toBe(true);
  });
});

describe('seed v2: matriz de trazabilidad', () => {
  it('cada enlace une un caso y un requisito del mismo programa', () => {
    const requirements = new Map(seed.requirements.map((r) => [r.code, r.programCode]));
    const testCases = new Map(seed.testCases.map((t) => [t.code, t.programCode]));
    expect(seed.requirementTestCases.every((l) => requirements.get(l.requirementCode) === testCases.get(l.testCaseCode))).toBe(true);
  });

  it('REQ-017 está enlazado con TC-012 y el último requisito de cada programa queda sin cobertura', () => {
    expect(seed.requirementTestCases.filter((l) => l.requirementCode === 'REQ-017').map((l) => l.testCaseCode)).toEqual(['TC-012']);
    const covered = new Set(seed.requirementTestCases.map((l) => l.requirementCode));
    expect(['REQ-014', 'REQ-028', 'REQ-040'].some((code) => covered.has(code))).toBe(false);
    expect(covered.has('REQ-013')).toBe(true);
  });

  it('las claves de los enlaces son únicas', () => {
    const keys = seed.requirementTestCases.map((l) => `${l.requirementCode}|${l.testCaseCode}`);
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe('seed v2: ejecuciones y evidencias', () => {
  it('una de cada cuatro ejecuciones lleva una captura PNG real enlazada por evidenceUrl', () => {
    const withEvidence = seed.testRuns.filter((r) => r.evidenceUrl);
    expect(withEvidence).toHaveLength(seed.evidences.length);
    expect(seed.evidences.length).toBeGreaterThanOrEqual(10);
    for (const evidence of seed.evidences) {
      expect(evidence.mimeType).toBe('image/png');
      expect(evidence.size).toBe(evidence.data.length);
      expect(Buffer.from(evidence.data).subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
      expect(seed.testRuns.find((r) => r.id === evidence.testRunId)?.evidenceUrl).toBe(`/api/evidence/${evidence.id}`);
    }
  });

  it('las ejecuciones llevan notas y las evidencias pesan muy por debajo de 2 MB', () => {
    expect(seed.testRuns.every((r) => r.notes.length > 0)).toBe(true);
    expect(Math.max(...seed.evidences.map((e) => e.size))).toBeLessThan(20_000);
  });
});

describe('seed v2: documentos', () => {
  it('cada documento tiene tantas versiones como indica Document.version y la última coincide', () => {
    for (const document of seed.documents) {
      const versions = seed.documentVersions.filter((v) => v.documentId === document.id).map((v) => v.version);
      expect(versions).toEqual(Array.from({ length: document.version }, (_, i) => i + 1));
    }
    expect(seed.documents.map((d) => d.version)).toEqual([3, 1, 2, 3, 1, 2, 3, 1, 2, 3, 1, 2]);
  });

  it('los restringidos son DOC-003, 006, 009 y 012 y tienen 2 versiones (se pueden comparar)', () => {
    const restricted = seed.documents.filter((d) => d.classification === 'restricted');
    expect(restricted.map((d) => d.id)).toEqual(['DOC-003', 'DOC-006', 'DOC-009', 'DOC-012']);
    expect(restricted.every((d) => d.version === 2)).toBe(true);
  });

  it('cada versión modifica, añade y elimina líneas respecto a la anterior', () => {
    const v1 = documentLines('Plan', 'PRG-001', 1);
    const v2 = documentLines('Plan', 'PRG-001', 2);
    const v3 = documentLines('Plan', 'PRG-001', 3);
    const kinds = (a: readonly string[], b: readonly string[]) => new Set(diffLines(a, b).map((op) => op.type));
    expect(kinds(v1, v2)).toEqual(new Set(['same', 'add', 'del']));
    expect(kinds(v2, v3)).toEqual(new Set(['same', 'add', 'del']));
    expect(paginateLines(v1)).toHaveLength(2);
  });
});

describe('seed v2: auditoría', () => {
  it('genera 130 eventos con fechas únicas y ordenables (hay para varias páginas de scroll infinito)', () => {
    expect(seed.auditLogs).toHaveLength(130);
    expect(new Set(seed.auditLogs.map((l) => l.at.getTime())).size).toBe(130);
    expect(new Set(seed.auditLogs.map((l) => l.id)).size).toBe(130);
  });

  it('mezcla entidades y acciones, y los actores existen', () => {
    const userIds = new Set(seed.users.map((u) => u.id));
    expect(new Set(seed.auditLogs.map((l) => l.entity)).size).toBeGreaterThanOrEqual(4);
    expect(new Set(seed.auditLogs.map((l) => l.action)).size).toBeGreaterThanOrEqual(8);
    expect(seed.auditLogs.every((l) => l.actorId && userIds.has(l.actorId))).toBe(true);
  });

  it('todas las filas nuevas llevan el tenant', () => {
    const other = buildTenantSeed('alumno09', fakeHash);
    expect([...other.evidences, ...other.documentVersions, ...other.auditLogs, ...other.requirementTestCases].every((row) => row.tenantId === 'alumno09')).toBe(true);
  });
});

describe('png', () => {
  it('makePng escribe firma, IHDR con el tamaño pedido y es determinista', () => {
    const png = makePng(3, 2, (x, y) => [x * 40, y * 80, 7]);
    expect(png.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
    expect(png.readUInt32BE(16)).toBe(3);
    expect(png.readUInt32BE(20)).toBe(2);
    expect(png.subarray(-8, -4).toString('ascii')).toBe('IEND');
    expect(makePng(3, 2, (x, y) => [x * 40, y * 80, 7]).equals(png)).toBe(true);
  });

  it('evidencePng usa un color distinto por resultado', () => {
    expect(evidencePng('pass', 1).equals(evidencePng('fail', 1))).toBe(false);
    expect(evidencePng('pass', 1).equals(evidencePng('pass', 1))).toBe(true);
  });
});
