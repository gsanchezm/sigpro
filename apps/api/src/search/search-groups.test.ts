import { SEARCH_GROUP_KINDS, type SearchGroupKind, type SearchItemDto } from '@sigpro/shared';
import { describe, expect, it } from 'vitest';
import { buildGroups, documentEntry, matchEntries, ncEntry, normalizeQuery, programEntry, requirementEntry, summarize, testCaseEntry } from './search-groups';

const item = (id: string): SearchItemDto => ({ id, title: id, subtitle: '', href: `/x/${id}` });
const empty = Object.fromEntries(SEARCH_GROUP_KINDS.map((kind) => [kind, []])) as Record<SearchGroupKind, SearchItemDto[]>;

describe('normalizeQuery', () => {
  it('recorta y exige al menos 2 caracteres', () => {
    expect(normalizeQuery('  radar ')).toBe('radar');
    expect(normalizeQuery('ab')).toBe('ab');
    expect(normalizeQuery('a')).toBeNull();
    expect(normalizeQuery('   a   ')).toBeNull();
    expect(normalizeQuery('')).toBeNull();
    expect(normalizeQuery(undefined)).toBeNull();
  });
});

describe('matchEntries', () => {
  const entries = [
    programEntry({ code: 'PRG-001', name: 'Centro de control de misión CCM', description: 'alcance', owner: { name: 'Marta Ruiz' } }),
    programEntry({ code: 'PRG-002', name: 'Simulador naval', description: 'Incluye el módulo CCM de adiestramiento', owner: { name: 'Javier Ortega' } }),
    programEntry({ code: 'PRG-003', name: 'Sensor EO-7', description: '', owner: { name: 'Marta Ruiz' } }),
  ];

  it('busca sin distinguir mayúsculas en código, nombre y descripción, conservando el orden', () => {
    expect(matchEntries('ccm', entries).map((i) => i.id)).toEqual(['PRG-001', 'PRG-002']);
    expect(matchEntries('prg-003', entries).map((i) => i.id)).toEqual(['PRG-003']);
    expect(matchEntries('SENSOR', entries).map((i) => i.id)).toEqual(['PRG-003']);
  });

  it('sin coincidencias devuelve vacío', () => {
    expect(matchEntries('zzzz', entries)).toEqual([]);
  });
});

describe('entradas por tipo', () => {
  it('los requisitos buscan en el texto plano de la descripción, no en las etiquetas HTML', () => {
    const entry = requirementEntry({ code: 'REQ-001', programCode: 'PRG-001', title: 'Disponibilidad', description: '<p>Alta <strong>disponibilidad</strong></p><ul><li>uno</li></ul>' });
    expect(matchEntries('strong', [entry])).toEqual([]);
    expect(matchEntries('li>', [entry])).toEqual([]);
    expect(matchEntries('alta disponibilidad', [entry])).toHaveLength(1);
    expect(entry.item.href).toBe('/programs/PRG-001/requirements?select=REQ-001');
  });

  it('cada tipo enlaza a su pantalla', () => {
    expect(programEntry({ code: 'PRG-001', name: 'A', description: '', owner: { name: 'M' } }).item.href).toBe('/programs/PRG-001');
    expect(testCaseEntry({ code: 'TC-004', programCode: 'PRG-001', title: 'Prueba' }).item.href).toBe('/verification/TC-004');
    expect(ncEntry({ code: 'NC-003', programCode: 'PRG-001', description: 'Texto' }).item.href).toBe('/nc/NC-003');
    expect(documentEntry({ id: 'DOC-002', programCode: 'PRG-001', title: 'Plan' }).item.href).toBe('/documents/DOC-002');
  });

  it('la NC usa un resumen de su descripción como título', () => {
    const long = `<p>${'a'.repeat(200)}</p>`;
    const entry = ncEntry({ code: 'NC-001', programCode: 'PRG-001', description: long });
    expect(entry.item.title).toHaveLength(90);
    expect(entry.item.title.endsWith('…')).toBe(true);
    expect(summarize('<p>corta</p>')).toBe('corta');
  });
});

describe('buildGroups', () => {
  it('solo devuelve los grupos con resultados y en orden fijo', () => {
    const groups = buildGroups({ ...empty, document: [item('DOC-1')], program: [item('PRG-1')], nc: [item('NC-1')] });
    expect(groups.map((group) => group.kind)).toEqual(['program', 'nc', 'document']);
  });

  it('limita a 5 ítems por grupo y cuenta el total real', () => {
    const many = Array.from({ length: 8 }, (_, i) => item(`REQ-${i + 1}`));
    const [group] = buildGroups({ ...empty, requirement: many });
    expect(group?.items).toHaveLength(5);
    expect(group?.total).toBe(8);
    expect(group?.items.map((i) => i.id)).toEqual(['REQ-1', 'REQ-2', 'REQ-3', 'REQ-4', 'REQ-5']);
  });

  it('sin coincidencias no hay grupos', () => {
    expect(buildGroups(empty)).toEqual([]);
  });
});
