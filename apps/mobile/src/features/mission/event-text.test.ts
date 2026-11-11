import { MISSION_EVENT_TYPES, createTranslator, messages, type MissionEventDto } from '@sigpro/shared';
import { describe, expect, it } from 'vitest';
import { EVENT_GLYPH, SEVERITY_TONE, missionEventText } from './event-text';

const es = createTranslator('es');
const en = createTranslator('en');

const eventOf = (partial: Pick<MissionEventDto, 'type' | 'vars'>): Pick<MissionEventDto, 'type' | 'vars'> => partial;

describe('missionEventText', () => {
  it('interpola los valores numéricos tal cual', () => {
    expect(missionEventText(eventOf({ type: 'link', vars: { program: 'PRG-001', value: 12 } }), es)).toBe('Enlace de datos PRG-001: latencia 12 ms');
  });

  it('traduce estado y severidad en bruto antes de interpolar (es y en)', () => {
    const moved = eventOf({ type: 'nc_moved', vars: { code: 'NC-001', from: 'open', to: 'in_analysis' } });
    expect(missionEventText(moved, es)).toBe('NC-001 pasó de «Abierta» a «En análisis»');
    expect(missionEventText(moved, en)).toBe('NC-001 moved from “Open” to “In analysis”');

    const created = eventOf({ type: 'nc_created', vars: { code: 'NC-002', severity: 'critical', program: 'PRG-003' } });
    expect(missionEventText(created, es)).toBe('NC-002 abierta (Crítica) en PRG-003');
  });

  it('deja intacto lo que no es estado ni severidad', () => {
    expect(missionEventText(eventOf({ type: 'milestone', vars: { program: 'PRG-002', name: 'PDR' } }), en)).toBe('Milestone “PDR” of PRG-002 met');
  });
});

describe('presentación del evento', () => {
  it('cada tipo tiene glifo y su texto en los dos idiomas', () => {
    for (const type of MISSION_EVENT_TYPES) {
      expect(EVENT_GLYPH[type], type).toBeTruthy();
      expect(messages.es.mision[`ev_${type}` as 'ev_link']).toBeTruthy();
      expect(messages.en.mision[`ev_${type}` as 'ev_link']).toBeTruthy();
    }
  });

  it('cada severidad tiene tono del design system', () => {
    expect(SEVERITY_TONE).toEqual({ info: 'info', ok: 'ok', warn: 'warn', danger: 'danger' });
  });
});
