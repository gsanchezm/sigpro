import { describe, expect, it } from 'vitest';
import { REQUIREMENT_STATES, ROLES } from './domain';
import {
  buildTree,
  canTransition,
  descendantCodes,
  isValidTransition,
  moveInOrder,
  nextRequirementCode,
  parentCodes,
  siblingsOf,
  stepTarget,
  transitionsFor,
  visibleRows,
  type TreeItem,
} from './requirements';

const item = (code: string, parentCode: string | null, position = 0): TreeItem => ({ code, parentCode, position });

describe('máquina de estados del requisito', () => {
  it('solo existe el camino draft → approved → verified → validated y la vuelta a draft', () => {
    expect(isValidTransition('draft', 'approved')).toBe(true);
    expect(isValidTransition('approved', 'verified')).toBe(true);
    expect(isValidTransition('verified', 'validated')).toBe(true);
    expect(isValidTransition('validated', 'draft')).toBe(true);
    expect(isValidTransition('draft', 'validated')).toBe(false);
    expect(isValidTransition('draft', 'verified')).toBe(false);
    expect(isValidTransition('approved', 'validated')).toBe(false);
    expect(isValidTransition('draft', 'draft')).toBe(false);
  });

  it('solo el gestor aprueba, solo el auditor valida y el consultor verifica (admin puede todo)', () => {
    expect(canTransition('program_manager', 'draft', 'approved')).toBe(true);
    expect(canTransition('consultant', 'draft', 'approved')).toBe(false);
    expect(canTransition('auditor', 'draft', 'approved')).toBe(false);
    expect(canTransition('consultant', 'approved', 'verified')).toBe(true);
    expect(canTransition('program_manager', 'approved', 'verified')).toBe(false);
    expect(canTransition('auditor', 'verified', 'validated')).toBe(true);
    expect(canTransition('program_manager', 'verified', 'validated')).toBe(false);
    for (const [from, to] of [['draft', 'approved'], ['approved', 'verified'], ['verified', 'validated'], ['validated', 'draft']] as const) {
      expect(canTransition('admin', from, to)).toBe(true);
    }
  });

  it('volver a borrador lo hace quien aprueba', () => {
    expect(ROLES.filter((role) => canTransition(role, 'verified', 'draft'))).toEqual(['admin', 'program_manager']);
  });

  it('transitionsFor marca qué pasos puede dar el rol', () => {
    expect(transitionsFor('consultant', 'approved').map((t) => [t.to, t.allowed])).toEqual([
      ['verified', true],
      ['draft', false],
    ]);
    expect(REQUIREMENT_STATES.every((state) => transitionsFor('admin', state).every((t) => t.allowed))).toBe(true);
  });
});

describe('árbol de requisitos', () => {
  const items = [item('REQ-004', 'REQ-001', 1), item('REQ-001', null, 0), item('REQ-002', 'REQ-001', 0), item('REQ-003', null, 1), item('REQ-005', 'REQ-002', 0)];

  it('ordena por posición y construye la jerarquía', () => {
    const tree = buildTree(items);
    expect(tree.map((n) => n.item.code)).toEqual(['REQ-001', 'REQ-003']);
    expect(tree[0]?.children.map((n) => n.item.code)).toEqual(['REQ-002', 'REQ-004']);
    expect(tree[0]?.children[0]?.children[0]).toMatchObject({ depth: 2, item: { code: 'REQ-005' } });
  });

  it('un huérfano cuelga de la raíz', () => {
    expect(buildTree([item('REQ-009', 'REQ-404')]).map((n) => n.item.code)).toEqual(['REQ-009']);
  });

  it('visibleRows respeta los nodos plegados e informa de posinset/setsize', () => {
    const tree = buildTree(items);
    expect(visibleRows(tree, new Set()).map((r) => r.item.code)).toEqual(['REQ-001', 'REQ-002', 'REQ-005', 'REQ-004', 'REQ-003']);
    const folded = visibleRows(tree, new Set(['REQ-001']));
    expect(folded.map((r) => r.item.code)).toEqual(['REQ-001', 'REQ-003']);
    expect(folded[0]).toMatchObject({ hasChildren: true, expanded: false, posInSet: 1, setSize: 2 });
    expect(folded[1]).toMatchObject({ hasChildren: false, expanded: false });
  });

  it('parentCodes, descendantCodes y siblingsOf', () => {
    expect([...parentCodes(items)].sort()).toEqual(['REQ-001', 'REQ-002']);
    expect([...descendantCodes(items, 'REQ-001')].sort()).toEqual(['REQ-002', 'REQ-004', 'REQ-005']);
    expect(descendantCodes(items, 'REQ-003')).toEqual([]);
    expect(siblingsOf(items, 'REQ-001').map((i) => i.code)).toEqual(['REQ-002', 'REQ-004']);
  });
});

describe('reordenar entre hermanos', () => {
  const order = ['A', 'B', 'C', 'D'];

  it('mueve antes o después del destino', () => {
    expect(moveInOrder(order, 'D', 'A', 'before')).toEqual(['D', 'A', 'B', 'C']);
    expect(moveInOrder(order, 'A', 'C', 'after')).toEqual(['B', 'C', 'A', 'D']);
    expect(moveInOrder(order, 'B', 'C', 'before')).toEqual(['A', 'B', 'C', 'D']);
  });

  it('devuelve null si no hay nada que mover', () => {
    expect(moveInOrder(order, 'A', 'A', 'after')).toBeNull();
    expect(moveInOrder(order, 'A', 'Z', 'after')).toBeNull();
    expect(moveInOrder(order, 'Z', 'A', 'after')).toBeNull();
  });

  it('stepTarget da el vecino o null en los extremos', () => {
    expect(stepTarget(order, 'B', -1)).toEqual({ target: 'A', placement: 'before' });
    expect(stepTarget(order, 'B', 1)).toEqual({ target: 'C', placement: 'after' });
    expect(stepTarget(order, 'A', -1)).toBeNull();
    expect(stepTarget(order, 'D', 1)).toBeNull();
    expect(stepTarget(order, 'Z', 1)).toBeNull();
  });
});

describe('nextRequirementCode', () => {
  it('continúa tras el mayor código y admite huecos', () => {
    expect(nextRequirementCode([])).toBe('REQ-001');
    expect(nextRequirementCode(['REQ-001', 'REQ-040', 'REQ-017'])).toBe('REQ-041');
  });
});
