import { expect } from '@playwright/test';
import type { Api } from './api';

// Ayudas para el Panel de misión por API (sesiones 10 y 11). Solo emiten eventos del simulador: no escriben en la base
// de datos, así que no cambian los datos que otros specs leen del mismo tenant.

export type MissionSeverity = 'info' | 'ok' | 'warn' | 'danger';

/** Evento del feed tal como lo devuelve `POST /api/mission/tick` (el mismo que llega por Socket.IO). */
export interface MissionEvent {
  readonly seq: number;
  readonly type: string;
  readonly severity: MissionSeverity;
  readonly origin: string;
  readonly at: string;
}

/**
 * Emite UN evento del simulador (`POST /api/mission/tick`, solo admin) sin esperar a su temporizador. El evento sale
 * por el socket del tenant al instante: el test puede esperarlo en la pantalla en lugar de esperar tiempo.
 */
export const emitMissionEvent = async (api: Api): Promise<MissionEvent> => {
  const response = await api.post('/mission/tick');
  expect(response.status(), 'POST /mission/tick').toBe(200);
  return ((await response.json()) as { event: MissionEvent }).event;
};
