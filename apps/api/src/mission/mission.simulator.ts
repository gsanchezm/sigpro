import { Inject, Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { ENV, type Env } from '../config/env';
import { MissionEventsService } from './mission-events.service';
import { MissionGateway } from './mission.gateway';
import { MissionService } from './mission.service';

/**
 * Simulador de misión: cada `SIMULATOR_MS` emite un evento del catálogo a los tenants que tienen algún cliente
 * conectado. No toca la base de datos (los datos de los tests no cambian solos); `SIMULATOR_MS=0` lo desactiva.
 */
@Injectable()
export class MissionSimulator implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MissionSimulator.name);
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly gateway: MissionGateway,
    private readonly events: MissionEventsService,
    private readonly mission: MissionService,
    @Inject(ENV) private readonly env: Pick<Env, 'SIMULATOR_MS'>,
  ) {}

  onModuleInit(): void {
    if (this.env.SIMULATOR_MS <= 0) return;
    this.timer = setInterval(() => void this.tick(), this.env.SIMULATOR_MS);
    this.timer.unref();
    this.logger.log(`Simulador de misión cada ${this.env.SIMULATOR_MS} ms`);
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  private async tick(): Promise<void> {
    for (const tenantId of this.gateway.connectedTenants()) {
      try {
        this.events.emitSimulated(tenantId, await this.mission.activeProgramCodes(tenantId));
      } catch (error) {
        this.logger.warn(`Simulador: ${error instanceof Error ? error.message : 'error desconocido'}`);
      }
    }
  }
}
