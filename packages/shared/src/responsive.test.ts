import { describe, expect, it } from 'vitest';
import { DESKTOP_MEDIA_QUERY, RESPONSIVE_FAMILIES, layoutForWidth } from './responsive';
import * as ids from './testids';
import { LAYOUT_BREAKPOINT_PX, RESPONSIVE_DYNAMIC_TESTIDS, RESPONSIVE_SUFFIX, RESPONSIVE_TESTIDS, layoutTestId, responsiveId } from './testids';

/** Todos los ids estáticos que ya existían (los de escritorio y los heredados), sin los responsive nuevos. */
const staticIds = (): readonly string[] =>
  Object.entries(ids)
    .filter(([name, value]) => name.endsWith('_TESTIDS') && name !== 'RESPONSIVE_TESTIDS' && typeof value === 'object')
    .flatMap(([, group]) => Object.values(group as Record<string, unknown>))
    .filter((value): value is string => typeof value === 'string');

describe('layoutForWidth', () => {
  it('el corte es 1024 px: por debajo responsive, desde ahí escritorio', () => {
    expect(LAYOUT_BREAKPOINT_PX).toBe(1024);
    expect(layoutForWidth(390)).toBe('mobile');
    expect(layoutForWidth(810)).toBe('mobile');
    expect(layoutForWidth(1023)).toBe('mobile');
    expect(layoutForWidth(1024)).toBe('desktop');
    expect(layoutForWidth(1440)).toBe('desktop');
  });

  it('la consulta matchMedia usa el mismo corte', () => {
    expect(DESKTOP_MEDIA_QUERY).toBe('(min-width: 1024px)');
  });
});

describe('responsiveId', () => {
  it('añade el sufijo -mobile, también a los ids dinámicos', () => {
    expect(RESPONSIVE_SUFFIX).toBe('-mobile');
    expect(responsiveId('programs-new')).toBe('programs-new-mobile');
    expect(responsiveId(ids.PROGRAMAS_DYNAMIC_TESTIDS.PROGRAMS_ROW('PRG-001'))).toBe('programs-row-PRG-001-mobile');
  });

  it('layoutTestId devuelve el id de escritorio tal cual o el responsive', () => {
    expect(layoutTestId('programs-new', false)).toBe('programs-new');
    expect(layoutTestId('programs-new', true)).toBe('programs-new-mobile');
  });
});

describe('ids responsive', () => {
  const responsive = Object.values(RESPONSIVE_TESTIDS);

  it('todos acaban en -mobile y no se repiten', () => {
    expect(responsive.every((id) => id.endsWith(RESPONSIVE_SUFFIX))).toBe(true);
    expect(new Set(responsive).size).toBe(responsive.length);
  });

  it('ninguno coincide con un id que ya existía: los de escritorio no se renombran ni se pisan', () => {
    const existing = new Set(staticIds());
    expect(responsive.filter((id) => existing.has(id))).toEqual([]);
  });

  it('los dinámicos siguen el mismo patrón', () => {
    expect(RESPONSIVE_DYNAMIC_TESTIDS.PROGRAMS_ROW('PRG-001')).toBe('programs-row-PRG-001-mobile');
    expect(RESPONSIVE_DYNAMIC_TESTIDS.NAV('programs')).toBe('nav-programs-mobile');
    expect(RESPONSIVE_DYNAMIC_TESTIDS.NC_CARD_MOVE('NC-001')).toBe('nc-card-move-NC-001-mobile');
    expect(RESPONSIVE_DYNAMIC_TESTIDS.GLOBAL_SEARCH_ITEM('program', 'PRG-001')).toBe('global-search-item-program-PRG-001-mobile');
  });
});

describe('RESPONSIVE_FAMILIES', () => {
  it('son 10, con el id de escritorio intacto y el responsive con sufijo', () => {
    expect(RESPONSIVE_FAMILIES).toHaveLength(10);
    for (const family of RESPONSIVE_FAMILIES) {
      expect(family.desktop.testId.endsWith(RESPONSIVE_SUFFIX)).toBe(false);
      expect(family.responsive.testId).toBe(responsiveId(family.desktop.testId));
    }
  });
});
