import { SEARCH_MIN_CHARS, busquedaEn, busquedaEs, type SearchGroupDto, type SearchItemDto } from '@sigpro/shared';
import { describe, expect, it } from 'vitest';
import { SEARCH_DEBOUNCE_MS, canSearch, groupTotalText, hiddenCount, mobileHref, searchView, summaryKey, totalResults, type SearchOutcome } from './view';

const item = (id: string, href = `/x/${id}`): SearchItemDto => ({ id, title: id, subtitle: '', href });
const groups: readonly SearchGroupDto[] = [
  { kind: 'program', total: 24, items: [item('PRG-001'), item('PRG-002')] },
  { kind: 'nc', total: 1, items: [item('NC-001')] },
];
const found = (query: string, list: readonly SearchGroupDto[] = groups): SearchOutcome => ({ query, groups: list });

describe('canSearch', () => {
  it('exige 2 caracteres sin contar espacios de los extremos', () => {
    expect(SEARCH_MIN_CHARS).toBe(2);
    expect(canSearch('')).toBe(false);
    expect(canSearch('a')).toBe(false);
    expect(canSearch('  a ')).toBe(false);
    expect(canSearch('ab')).toBe(true);
    expect(canSearch(' ab ')).toBe(true);
  });

  it('el retraso es el de la web: 250 ms', () => {
    expect(SEARCH_DEBOUNCE_MS).toBe(250);
  });
});

describe('totales de grupo', () => {
  it('suma el total real de cada grupo, no los ítems enseñados', () => {
    expect(totalResults(groups)).toBe(25);
    expect(totalResults([])).toBe(0);
  });

  it('«5 / 24» si la API enseña menos ítems que coincidencias y el total a secas si los enseña todos', () => {
    expect(groupTotalText({ kind: 'program', total: 24, items: [item('a'), item('b'), item('c'), item('d'), item('e')] })).toBe('5 / 24');
    expect(groupTotalText({ kind: 'nc', total: 1, items: [item('NC-001')] })).toBe('1');
    expect(groupTotalText({ kind: 'document', total: 5, items: [item('a'), item('b'), item('c'), item('d'), item('e')] })).toBe('5');
  });

  it('el «N más» son las coincidencias que no se enseñan', () => {
    expect(hiddenCount({ kind: 'program', total: 24, items: [item('a'), item('b'), item('c'), item('d'), item('e')] })).toBe(19);
    expect(hiddenCount({ kind: 'nc', total: 1, items: [item('NC-001')] })).toBe(0);
  });

  it('el texto del «N más» y el del resumen existen en español y en inglés', () => {
    expect(busquedaEs.moreInGroup.replace('{count}', '19')).toBe('19 más');
    expect(busquedaEn.moreInGroup.replace('{count}', '19')).toBe('19 more');
    expect(summaryKey(1)).toBe('summaryOne');
    expect(summaryKey(9)).toBe('summary');
    expect(busquedaEs.summary).toContain('{groups}');
  });
});

describe('searchView', () => {
  it('con menos de 2 caracteres solo avisa del mínimo, aunque haya una respuesta anterior', () => {
    expect(searchView({ text: '', debounced: '', outcome: null })).toEqual({ kind: 'hint' });
    expect(searchView({ text: 'c', debounced: 'c', outcome: null })).toEqual({ kind: 'hint' });
    expect(searchView({ text: ' c ', debounced: 'c', outcome: found('cc') })).toEqual({ kind: 'hint' });
  });

  it('mientras se escribe no se enseñan los resultados de la consulta anterior', () => {
    expect(searchView({ text: 'ccm', debounced: 'cc', outcome: found('cc') })).toEqual({ kind: 'loading' });
  });

  it('con el texto ya pedido pero sin respuesta (o con la de otra consulta) sigue cargando', () => {
    expect(searchView({ text: 'ccm', debounced: 'ccm', outcome: null })).toEqual({ kind: 'loading' });
    expect(searchView({ text: 'ccm', debounced: 'ccm', outcome: found('cc') })).toEqual({ kind: 'loading' });
  });

  it('un fallo de la consulta actual es un error; el de otra consulta no cuenta', () => {
    expect(searchView({ text: 'fallo', debounced: 'fallo', outcome: { query: 'fallo', failed: true } })).toEqual({ kind: 'error' });
    expect(searchView({ text: 'ccm', debounced: 'ccm', outcome: { query: 'fallo', failed: true } })).toEqual({ kind: 'loading' });
  });

  it('sin grupos: vacío, con el texto buscado sin espacios de los extremos', () => {
    expect(searchView({ text: ' zzzzz ', debounced: 'zzzzz', outcome: found('zzzzz', []) })).toEqual({ kind: 'empty', query: 'zzzzz' });
  });

  it('con grupos: resultados y recuento total', () => {
    expect(searchView({ text: 'sistema', debounced: 'sistema', outcome: found('sistema') })).toEqual({ kind: 'results', groups, count: 25 });
  });
});

describe('mobileHref', () => {
  it('programa, requisito, caso de prueba y documento van a la misma ruta que en la web', () => {
    expect(mobileHref('program', item('PRG-005', '/programs/PRG-005'))).toBe('/programs/PRG-005');
    expect(mobileHref('requirement', item('REQ-017', '/programs/PRG-002/requirements?select=REQ-017'))).toBe('/programs/PRG-002/requirements?select=REQ-017');
    expect(mobileHref('testcase', item('TC-009', '/verification/TC-009'))).toBe('/verification/TC-009');
    expect(mobileHref('document', item('DOC-002', '/documents/DOC-002'))).toBe('/documents/DOC-002');
  });

  it('la NC abre su detalle en el tablero: `/nc?select=NC-003` (la web tiene `/nc/NC-003`)', () => {
    expect(mobileHref('nc', item('NC-003', '/nc/NC-003'))).toBe('/nc?select=NC-003');
  });

  it('una ruta que no es interna se descarta', () => {
    expect(mobileHref('program', item('PRG-001', 'https://example.com/x'))).toBeNull();
    expect(mobileHref('document', item('DOC-001', '//example.com/x'))).toBeNull();
    expect(mobileHref('testcase', item('TC-001', 'javascript:alert(1)'))).toBeNull();
  });
});
