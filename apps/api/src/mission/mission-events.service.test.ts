import type { MissionEventDto } from '@sigpro/shared';
import { describe, expect, it } from 'vitest';
import { MissionEventsService } from './mission-events.service';

const draft = { type: 'nc_created', severity: 'warn', programCode: 'PRG-001', vars: { code: 'NC-013' }, origin: 'system', ncOpen: 9 } as const;

describe('MissionEventsService', () => {
  it('cada tenant arranca con 6 eventos de historia, numerados del 1 al 6 y del más reciente al más antiguo', () => {
    const service = new MissionEventsService();
    const recent = service.recent('demo');
    expect(recent.map((event) => event.seq)).toEqual([6, 5, 4, 3, 2, 1]);
    expect(recent.every((event) => event.origin === 'simulator')).toBe(true);
    const times = recent.map((event) => Date.parse(event.at));
    expect(times).toEqual([...times].sort((a, b) => b - a));
  });

  it('emitir numera, guarda al principio y difunde solo al emisor conectado', () => {
    const service = new MissionEventsService();
    const sent: { tenant: string; event: MissionEventDto }[] = [];
    service.attach((tenant, event) => sent.push({ tenant, event }));
    const event = service.emit('demo', draft);
    expect(event.seq).toBe(7);
    expect(event.id).toBe('EV-0007');
    expect(service.recent('demo')[0]).toEqual(event);
    expect(sent).toEqual([{ tenant: 'demo', event }]);
  });

  it('los tenants tienen numeración y buffers independientes', () => {
    const service = new MissionEventsService();
    service.emit('demo', draft);
    expect(service.recent('alumno01')[0]?.seq).toBe(6);
    expect(service.emit('alumno01', draft).seq).toBe(7);
  });

  it('el anillo no pasa de 50 eventos', () => {
    const service = new MissionEventsService();
    for (let i = 0; i < 70; i += 1) service.emit('demo', draft);
    expect(service.recent('demo')).toHaveLength(50);
    expect(service.recent('demo')[0]?.seq).toBe(76);
  });

  it('el simulador avanza con su propio contador (los eventos reales no desplazan el ciclo)', () => {
    const service = new MissionEventsService();
    service.emit('demo', draft);
    const first = service.emitSimulated('demo', ['PRG-001']);
    const second = service.emitSimulated('demo', ['PRG-001']);
    expect(first.origin).toBe('simulator');
    expect([first.type, second.type]).toEqual(['telemetry', 'heartbeat']); // posiciones 6 y 7 del ciclo de 8 (0-5 son la historia)
  });

  it('clear olvida el tenant: al volver a pedirlo se reinicia la historia y la numeración', () => {
    const service = new MissionEventsService();
    service.emit('demo', draft);
    service.clear('demo');
    expect(service.recent('demo').map((event) => event.seq)).toEqual([6, 5, 4, 3, 2, 1]);
  });
});
