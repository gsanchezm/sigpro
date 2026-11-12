import { ApiError, type RequirementDto } from '@sigpro/shared';
import { describe, expect, it } from 'vitest';
import {
  INDENT_PX,
  NO_CODES,
  cellResultOf,
  coverageOf,
  coveredCount,
  expandAncestors,
  failureTrace,
  filterRequirements,
  indentOf,
  moveTargetsOf,
  normalizeQuery,
  requirementRows,
  stateTone,
  toggleCollapsed,
  withLink,
} from './view';

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

describe('expandAncestors', () => {
  it('quita de plegados los ancestros del requisito y deja el resto, sin tocar el conjunto anterior', () => {
    const before = new Set(['REQ-015', 'REQ-016']);
    // REQ-019 cuelga de REQ-018, que cuelga de REQ-015: se despliegan los dos; REQ-016 sigue plegado
    const after = expandAncestors(before, items, 'REQ-019');
    expect([...after]).toEqual(['REQ-016']);
    expect(before.has('REQ-015')).toBe(true);
  });
});

describe('matriz de trazabilidad', () => {
  const links = [
    { requirementCode: 'REQ-015', testCaseCode: 'TC-001' },
    { requirementCode: 'REQ-015', testCaseCode: 'TC-002' },
    { requirementCode: 'REQ-017', testCaseCode: 'TC-001' },
  ];

  it('el resultado de una celda: sin enlace vacía; enlazada sin ejecuciones «·»; si no, el de la última ejecución', () => {
    expect(cellResultOf(false, 'pass')).toBe('unlinked');
    expect(cellResultOf(true, null)).toBe('none');
    expect(cellResultOf(true, 'fail')).toBe('fail');
    expect(cellResultOf(true, 'blocked')).toBe('blocked');
  });

  it('cuenta la cobertura por requisito y los requisitos cubiertos', () => {
    const requirements = [{ code: 'REQ-015' }, { code: 'REQ-016' }, { code: 'REQ-017' }];
    expect(coverageOf(links, 'REQ-015')).toBe(2);
    expect(coverageOf(links, 'REQ-016')).toBe(0);
    expect(coveredCount(requirements, links)).toBe(2);
  });

  it('withLink marca o desmonta un cruce sin mutar la lista y sin duplicar el enlace', () => {
    const added = withLink(links, 'REQ-016', 'TC-002', true);
    expect(added).toHaveLength(4);
    expect(links).toHaveLength(3);

    const twice = withLink(added, 'REQ-016', 'TC-002', true);
    expect(twice).toHaveLength(4);

    const removed = withLink(links, 'REQ-015', 'TC-001', false);
    expect(removed).toEqual([
      { requirementCode: 'REQ-015', testCaseCode: 'TC-002' },
      { requirementCode: 'REQ-017', testCaseCode: 'TC-001' },
    ]);
  });
});

describe('Mover a… y traza de fallos', () => {
  it('las posiciones posibles son los hermanos del mismo padre, sin el propio requisito', () => {
    // Bajo REQ-015 están REQ-017 y REQ-018: desde REQ-017 solo se puede tomar REQ-018 como referencia
    const req17 = items.find((item) => item.code === 'REQ-017') as RequirementDto;
    expect(moveTargetsOf(items, req17).map((target) => target.code)).toEqual(['REQ-018']);
  });

  it('un requisito hijo único no tiene posiciones a las que moverse', () => {
    // REQ-019 es el único hijo de REQ-018
    const req19 = items.find((item) => item.code === 'REQ-019') as RequirementDto;
    expect(moveTargetsOf(items, req19)).toEqual([]);
  });

  it('un requisito raíz tiene como hermanos a las demás raíces', () => {
    const req16 = items.find((item) => item.code === 'REQ-016') as RequirementDto;
    expect(moveTargetsOf(items, req16).map((target) => target.code)).toEqual(['REQ-015', 'REQ-020']);
  });

  it('la traza de un fallo es la de la API, o el texto de red si no es un ApiError', () => {
    const apiFailure = new ApiError(409, { statusCode: 409, error: 'Conflict', message: 'invalid_transition', traceId: 'a1' }, 'POST /api/requirements/REQ-017/transition → 409 Conflict');
    expect(failureTrace(apiFailure, 'sin red')).toBe('POST /api/requirements/REQ-017/transition → 409 Conflict · trace a1');
    expect(failureTrace(new Error('fetch'), 'sin red')).toBe('sin red');
  });
});
