import { Injectable } from '@nestjs/common';
import { FEED_MAX_ITEMS, type MissionEventDto } from '@sigpro/shared';
import { simulatorEvent } from './simulator';

export type MissionEventDraft = Omit<MissionEventDto, 'id' | 'seq' | 'at'>;
type Emitter = (tenantId: string, event: MissionEventDto) => void;

const BOOTSTRAP_EVENTS = 6;
const BOOTSTRAP_STEP_MS = 45_000;
const BOOTSTRAP_PROGRAMS = ['PRG-001', 'PRG-002', 'PRG-003', 'PRG-004', 'PRG-005', 'PRG-006'] as const;

/**
 * Eventos de misión de cada tenant, en memoria (un anillo de los últimos 50): numera cada evento con un `seq` creciente,
 * lo guarda y lo difunde al room del tenant. El emisor lo conecta el gateway de Socket.IO al arrancar.
 */
@Injectable()
export class MissionEventsService {
  private readonly buffers = new Map<string, readonly MissionEventDto[]>();
  private readonly counters = new Map<string, number>();
  private readonly simulated = new Map<string, number>();
  private emitter: Emitter | null = null;

  attach(emitter: Emitter): void {
    this.emitter = emitter;
  }

  /** Historia inicial determinista (6 eventos del simulador, uno cada 45 s) para que el feed no empiece vacío. */
  private ensureBootstrapped(tenantId: string): void {
    if (this.buffers.has(tenantId)) return;
    this.buffers.set(tenantId, []);
    const now = Date.now();
    Array.from({ length: BOOTSTRAP_EVENTS }, (_, i) => i).forEach((i) => {
      const at = new Date(now - (BOOTSTRAP_EVENTS - i) * BOOTSTRAP_STEP_MS);
      this.store(tenantId, { ...simulatorEvent(this.nextSimulatedIndex(tenantId), BOOTSTRAP_PROGRAMS) }, at);
    });
  }

  private nextSimulatedIndex(tenantId: string): number {
    const index = this.simulated.get(tenantId) ?? 0;
    this.simulated.set(tenantId, index + 1);
    return index;
  }

  private store(tenantId: string, draft: MissionEventDraft, at: Date): MissionEventDto {
    const seq = (this.counters.get(tenantId) ?? 0) + 1;
    this.counters.set(tenantId, seq);
    const event: MissionEventDto = { ...draft, id: `EV-${String(seq).padStart(4, '0')}`, seq, at: at.toISOString() };
    this.buffers.set(tenantId, [event, ...(this.buffers.get(tenantId) ?? [])].slice(0, FEED_MAX_ITEMS));
    return event;
  }

  /** Registra y difunde un evento (real: lo emite la API tras una mutación; o del simulador). */
  emit(tenantId: string, draft: MissionEventDraft): MissionEventDto {
    this.ensureBootstrapped(tenantId);
    const event = this.store(tenantId, draft, new Date());
    this.emitter?.(tenantId, event);
    return event;
  }

  /** Siguiente evento del simulador de este tenant (determinista: su contador solo avanza con el simulador). */
  emitSimulated(tenantId: string, programCodes: readonly string[]): MissionEventDto {
    this.ensureBootstrapped(tenantId);
    return this.emit(tenantId, simulatorEvent(this.nextSimulatedIndex(tenantId), programCodes));
  }

  /** Olvida los eventos de un tenant (al restaurar sus datos el feed no debe mostrar sucesos de datos que ya no existen). */
  clear(tenantId: string): void {
    this.buffers.delete(tenantId);
    this.counters.delete(tenantId);
    this.simulated.delete(tenantId);
  }

  /** Últimos eventos, el más reciente primero. */
  recent(tenantId: string, limit = FEED_MAX_ITEMS): readonly MissionEventDto[] {
    this.ensureBootstrapped(tenantId);
    return (this.buffers.get(tenantId) ?? []).slice(0, limit);
  }
}
