import type { AuditEntryDto } from '@sigpro/shared';
import { describe, expect, it } from 'vitest';
import { NO_FILTERS, actionKey, appendUnique, diffSummary, effectiveFilters, entityKey, hasActiveFilters, hasDraftFilters, isCalendarDate, parseDateRange, sameFilters, toQuery } from './view';

const entry = (id: string, diff: AuditEntryDto['diff'] = null): AuditEntryDto => ({
  id,
  at: '2026-01-06T10:00:00.000Z',
  actorId: 'u1',
  actorName: 'Marta Ruiz',
  action: 'requirement.created',
  entity: 'requirement',
  entityId: 'REQ-001',
  diff,
});

describe('isCalendarDate', () => {
  it('acepta fechas reales, bisiestos incluidos', () => {
    expect(isCalendarDate('2026-01-06')).toBe(true);
    expect(isCalendarDate('2028-02-29')).toBe(true);
  });

  it('rechaza formatos incompletos, meses y días imposibles y el 29 de febrero de un año no bisiesto', () => {
    for (const value of ['', '2026', '2026-1-6', '2026-01-6', '06/01/2026', '2026-13-01', '2026-00-10', '2026-02-30', '2027-02-29', '2026-04-31', 'abcd-ef-gh']) {
      expect(isCalendarDate(value), value).toBe(false);
    }
  });
});

describe('parseDateRange', () => {
  it('vacío no es un error y no filtra', () => {
    expect(parseDateRange('', '')).toEqual({ from: '', to: '', fromIssue: null, toIssue: null });
    expect(parseDateRange('   ', ' ')).toEqual({ from: '', to: '', fromIssue: null, toIssue: null });
  });

  it('aplica las fechas completas y reales, con los espacios de los extremos recortados', () => {
    expect(parseDateRange(' 2026-01-06 ', '2026-01-31')).toEqual({ from: '2026-01-06', to: '2026-01-31', fromIssue: null, toIssue: null });
    expect(parseDateRange('2026-01-06', '2026-01-06')).toMatchObject({ from: '2026-01-06', to: '2026-01-06', toIssue: null });
  });

  it('una fecha a medio escribir o inexistente no se aplica y se marca como inválida; la otra sí', () => {
    expect(parseDateRange('2026-01', '2026-02-10')).toEqual({ from: '', to: '2026-02-10', fromIssue: 'invalid', toIssue: null });
    expect(parseDateRange('2026-01-06', '2026-02-30')).toEqual({ from: '2026-01-06', to: '', fromIssue: null, toIssue: 'invalid' });
    expect(parseDateRange('2026-13-01', 'mañana')).toMatchObject({ from: '', to: '', fromIssue: 'invalid', toIssue: 'invalid' });
  });

  it('«Hasta» anterior a «Desde» no aplica ninguna de las dos y avisa en «Hasta»', () => {
    expect(parseDateRange('2026-02-10', '2026-01-06')).toEqual({ from: '', to: '', fromIssue: null, toIssue: 'order' });
  });

  it('con un solo extremo no hay orden que comprobar', () => {
    expect(parseDateRange('2026-02-10', '')).toMatchObject({ from: '2026-02-10', toIssue: null });
    expect(parseDateRange('', '2026-01-06')).toMatchObject({ to: '2026-01-06', fromIssue: null });
  });
});

describe('filtros', () => {
  it('effectiveFilters recorta el texto y toma el rango válido', () => {
    expect(effectiveFilters('nc', '  state_changed ', parseDateRange('2026-01-06', ''))).toEqual({ entity: 'nc', q: 'state_changed', from: '2026-01-06', to: '' });
  });

  it('hasActiveFilters mira lo aplicado y hasDraftFilters, lo escrito (aunque no valga)', () => {
    expect(hasActiveFilters(NO_FILTERS)).toBe(false);
    expect(hasActiveFilters({ ...NO_FILTERS, to: '2026-01-06' })).toBe(true);
    expect(hasDraftFilters('', '  ', '', '')).toBe(false);
    expect(hasDraftFilters('', '', '2026-0', '')).toBe(true);
    expect(hasDraftFilters('user', '', '', '')).toBe(true);
  });

  it('sameFilters compara por valor', () => {
    expect(sameFilters(NO_FILTERS, { entity: '', q: '', from: '', to: '' })).toBe(true);
    expect(sameFilters(NO_FILTERS, { ...NO_FILTERS, q: 'a' })).toBe(false);
  });

  it('toQuery añade el cursor solo si lo hay', () => {
    expect(toQuery(NO_FILTERS)).toEqual(NO_FILTERS);
    expect(toQuery(NO_FILTERS, 'abc')).toEqual({ ...NO_FILTERS, cursor: 'abc' });
  });
});

describe('diffSummary', () => {
  it('sin diff, cadena vacía', () => {
    expect(diffSummary(null)).toBe('');
  });

  it('une «campo: valor» con « · » y formatea listas y objetos', () => {
    expect(diffSummary({ title: 'Nuevo', tags: ['a', 'b'], range: { from: 1 }, n: 3, ok: false })).toBe('title: Nuevo · tags: a, b · range: {"from":1} · n: 3 · ok: false');
  });
});

describe('claves de texto', () => {
  it('actionKey cambia los puntos por guiones bajos y entityKey antepone e_', () => {
    expect(actionKey('requirement.state_changed')).toBe('a_requirement_state_changed');
    expect(actionKey('chaos.updated')).toBe('a_chaos_updated');
    expect(entityKey('testrun')).toBe('e_testrun');
  });
});

describe('appendUnique', () => {
  it('añade al final sin repetir los eventos ya cargados ni mutar la lista', () => {
    const current = [entry('AL-3'), entry('AL-2')];
    const merged = appendUnique(current, [entry('AL-2'), entry('AL-1')]);
    expect(merged.map((item) => item.id)).toEqual(['AL-3', 'AL-2', 'AL-1']);
    expect(current).toHaveLength(2);
  });
});
