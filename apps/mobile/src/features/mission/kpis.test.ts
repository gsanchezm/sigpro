import { createTranslator, type MissionKpis, type MissionEventDto } from '@sigpro/shared';
import { describe, expect, it } from 'vitest';
import { NO_LIVE_NC, applyNcEvent, displayedNc, kpiCards, type LiveNc } from './kpis';

const summary = {
  kpis: { activePrograms: 2, programsTotal: 5, programsProgress: 40, milestonesDone: 3, milestonesTotal: 8, ncOpen: 4, ncTotal: 10, verificationPass: 50, casesWithRuns: 6 } satisfies MissionKpis,
  ncBySeverity: { minor: 1, major: 2, critical: 1 },
};

const ncEvent = (overrides: Partial<Pick<MissionEventDto, 'type' | 'ncOpen' | 'ncBySeverity'>>): Pick<MissionEventDto, 'type' | 'ncOpen' | 'ncBySeverity'> => ({
  type: 'nc_moved',
  ...overrides,
});

describe('estado en vivo de las NC', () => {
  it('sin eventos el panel muestra el resumen', () => {
    expect(displayedNc(summary, NO_LIVE_NC)).toEqual({ ncOpen: 4, ncTotal: 10, ncBySeverity: { minor: 1, major: 2, critical: 1 } });
  });

  it('un evento nc_* con ncOpen y ncBySeverity manda sobre el resumen en cuanto llega', () => {
    const live = applyNcEvent(NO_LIVE_NC, ncEvent({ ncOpen: 3, ncBySeverity: { minor: 1, major: 1, critical: 1 } }));
    expect(displayedNc(summary, live)).toEqual({ ncOpen: 3, ncTotal: 10, ncBySeverity: { minor: 1, major: 1, critical: 1 } });
  });

  it('un evento sin esos campos no cambia lo que ya había', () => {
    const withOpen: LiveNc = applyNcEvent(NO_LIVE_NC, ncEvent({ ncOpen: 7 }));
    const after = applyNcEvent(withOpen, { type: 'heartbeat' });
    expect(after.ncOpen).toBe(7);
    expect(after.ncBySeverity).toBeNull();
  });

  it('una NC nueva suma al total y el total nunca baja de las abiertas', () => {
    const created = applyNcEvent(NO_LIVE_NC, ncEvent({ type: 'nc_created', ncOpen: 5 }));
    expect(displayedNc(summary, created).ncTotal).toBe(11);

    const onlyOpen = displayedNc({ ...summary, kpis: { ...summary.kpis, ncTotal: 2 } }, applyNcEvent(NO_LIVE_NC, ncEvent({ ncOpen: 6 })));
    expect(onlyOpen.ncTotal).toBe(6);
  });

  it('no muta el estado anterior', () => {
    const before = NO_LIVE_NC;
    applyNcEvent(before, ncEvent({ type: 'nc_created', ncOpen: 1 }));
    expect(before).toEqual({ ncOpen: null, ncBySeverity: null, created: 0 });
  });
});

describe('tarjetas de KPI', () => {
  it('muestra valores y textos en español, con el porcentaje de hitos redondeado', () => {
    const cards = kpiCards(summary.kpis, { ncOpen: 4, ncTotal: 10, ncBySeverity: summary.ncBySeverity }, createTranslator('es'));
    expect(cards.map((card) => card.key)).toEqual(['programs', 'milestones', 'nc', 'verification']);
    expect(cards.map((card) => card.value)).toEqual(['2', '38 %', '4', '50 %']);
    expect(cards[0]?.sub).toBe('de 5 programas');
    expect(cards[2]?.label).toBe('NC abiertas');
    expect(cards.every((card) => card.help.length > 0)).toBe(true);
  });

  it('usa el idioma activo', () => {
    const cards = kpiCards(summary.kpis, { ncOpen: 4, ncTotal: 10, ncBySeverity: summary.ncBySeverity }, createTranslator('en'));
    expect(cards[1]?.sub).toBe('3 of 8 milestones');
  });
});
