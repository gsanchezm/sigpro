import type { RequirementDto } from '@sigpro/shared';
import { describe, expect, it } from 'vitest';
import { INDENT_PX, NO_CODES, filterRequirements, indentOf, normalizeQuery, requirementRows, stateTone, toggleCollapsed } from './view';

// Fixture con la forma de PRG-002: REQ-015 con hijos (REQ-017 en borrador entre ellos) y dos raíces más
const req = (code: string, parentCode: string | null, position: number, title: string, state: RequirementDto['state'] = 'draft'): RequirementDto => ({
  code,
  programCode: 'PRG-002',
  parentCode,
  title,
  description: '',
  priority: 'medium',
  state,
  tags: [],
  position,
  testCaseCodes: [], tests: [], ncs: [],
});

const items: readonly RequirementDto[] = [
  req('REQ-016', null, 2, 'Disponibilidad del enlace', 'approved'),
  req('REQ-015', null, 1, 'Seguridad del enlace de datos', 'verified'),
  req('REQ-018', 'REQ-015', 2, 'Cifrado en reposo'),
  req('REQ-017', 'REQ-015', 1, 'Cifrado en tránsito'),
  req('REQ-019', 'REQ-018', 1, 'Rotación de claves', 'validated'),
  req('REQ-020', null, 3, 'Trazas de auditoría'),
];

const codesOf = (rows: ReturnType<typeof requirementRows>): string[] => rows.map((row) => row.item.code);

describe('requirementRows', () => {
  it('aplana el árbol en orden de lectura: hermanos por posición y cada hijo tras su padre', () => {
    expect(codesOf(requirementRows(items, '', NO_CODES))).toEqual(['REQ-015', 'REQ-017', 'REQ-018', 'REQ-019', 'REQ-016', 'REQ-020']);
  });

  it('marca el nivel, si tiene hijos, si está desplegado y la posición entre hermanos', () => {
    const rows = requirementRows(items, '', NO_CODES);
    const req17 = rows.find((row) => row.item.code === 'REQ-017');
    const req15 = rows.find((row) => row.item.code === 'REQ-015');
    expect(req17).toMatchObject({ depth: 1, hasChildren: false, expanded: false, posInSet: 1, setSize: 2 });
    expect(req15).toMatchObject({ depth: 0, hasChildren: true, expanded: true, posInSet: 1, setSize: 3 });
  });

  it('oculta a los descendientes de un nodo plegado, pero sigue mostrando el nodo', () => {
    const rows = requirementRows(items, '', new Set(['REQ-015']));
    expect(codesOf(rows)).toEqual(['REQ-015', 'REQ-016', 'REQ-020']);
    expect(rows.find((row) => row.item.code === 'REQ-015')?.expanded).toBe(false);
  });

  it('con una búsqueda activa se despliega todo, aunque haya nodos plegados', () => {
    expect(codesOf(requirementRows(items, 'cifrado', new Set(['REQ-015'])))).toEqual(['REQ-015', 'REQ-017', 'REQ-018']);
  });
});

describe('filterRequirements', () => {
  it('conserva los ancestros de cada coincidencia', () => {
    // «claves» solo coincide con REQ-019, pero el camino pasa por REQ-018 y REQ-015
    expect(filterRequirements(items, 'claves').map((item) => item.code)).toEqual(['REQ-015', 'REQ-018', 'REQ-019']);
  });

  it('busca por código y por título, sin distinguir mayúsculas', () => {
    expect(filterRequirements(items, 'req-016').map((item) => item.code)).toEqual(['REQ-016']);
    expect(filterRequirements(items, normalizeQuery('ENLACE')).map((item) => item.code)).toEqual(['REQ-016', 'REQ-015']);
  });

  it('sin texto devuelve la lista completa y sin coincidencias devuelve vacío', () => {
    expect(filterRequirements(items, '')).toBe(items);
    expect(filterRequirements(items, 'inexistente')).toEqual([]);
  });
});

describe('normalizeQuery', () => {
  it('recorta y pasa a minúsculas', () => {
    expect(normalizeQuery('  Cifrado  ')).toBe('cifrado');
    expect(normalizeQuery('   ')).toBe('');
  });
});

describe('toggleCollapsed', () => {
  it('pliega y despliega sin mutar el conjunto anterior', () => {
    const before = new Set<string>();
    const folded = toggleCollapsed(before, 'REQ-015');
    expect([...folded]).toEqual(['REQ-015']);
    expect(before.size).toBe(0);
    expect([...toggleCollapsed(folded, 'REQ-015')]).toEqual([]);
  });
});

describe('indentOf y stateTone', () => {
  it('la sangría crece 16 px por nivel', () => {
    expect(indentOf(0)).toBe(0);
    expect(indentOf(2)).toBe(2 * INDENT_PX);
  });

  it('cada estado tiene su tono (mismo vocabulario que la web)', () => {
    expect(stateTone('draft')).toBe('neutral');
    expect(stateTone('approved')).toBe('info');
    expect(stateTone('verified')).toBe('purple');
    expect(stateTone('validated')).toBe('ok');
  });
});
