import { describe, expect, it } from 'vitest';
import { isNotifiable } from '@sigpro/shared';
import { SIMULATOR_CYCLE, simulatorEvent } from './simulator';

const PROGRAMS = ['PRG-001', 'PRG-002', 'PRG-003', 'PRG-005'];

describe('simulatorEvent', () => {
  it('es determinista: el mismo índice da siempre el mismo evento', () => {
    expect(simulatorEvent(11, PROGRAMS)).toEqual(simulatorEvent(11, PROGRAMS));
  });

  it('recorre un ciclo de 8 tipos con exactamente 2 avisos que llegan a la campana', () => {
    const cycle = Array.from({ length: SIMULATOR_CYCLE }, (_, i) => simulatorEvent(i, PROGRAMS));
    expect(SIMULATOR_CYCLE).toBe(8);
    expect(cycle.map((event) => event.type)).toEqual(['link', 'milestone', 'thermal', 'telemetry', 'test_pass', 'link_lost', 'telemetry', 'heartbeat']);
    expect(cycle.filter(isNotifiable).map((event) => event.type)).toEqual(['thermal', 'link_lost']);
  });

  it('el ciclo se repite', () => {
    expect(simulatorEvent(2, PROGRAMS).type).toBe(simulatorEvent(2 + SIMULATOR_CYCLE, PROGRAMS).type);
  });

  it('usa programas del tenant y todos los eventos salen del simulador', () => {
    for (let i = 0; i < 40; i += 1) {
      const event = simulatorEvent(i, PROGRAMS);
      expect(event.origin).toBe('simulator');
      if (event.type !== 'heartbeat') expect(PROGRAMS).toContain(event.programCode);
      expect(Object.values(event.vars).every((value) => value !== undefined && value !== '')).toBe(true);
    }
  });

  it('sin programas cae en PRG-001', () => {
    expect(simulatorEvent(0, []).programCode).toBe('PRG-001');
  });
});
