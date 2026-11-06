import { Injectable, type CallHandler, type ExecutionContext, type NestInterceptor } from '@nestjs/common';
import { TENANT_HEADER } from '@sigpro/shared';
import type { Observable } from 'rxjs';
import type { AuthedRequest } from '../common/auth.types';
import { fail } from '../common/errors';
import { decideChaos, isChaosExempt } from './chaos';
import { ChaosService } from './chaos.service';

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/** Aplica latencia aleatoria y errores 500 en escrituras según los flags del tenant. */
@Injectable()
export class ChaosInterceptor implements NestInterceptor {
  constructor(private readonly chaos: ChaosService) {}

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<unknown>> {
    const request = context.switchToHttp().getRequest<AuthedRequest>();
    const path = request.originalUrl.split('?')[0] ?? request.path;
    const header = request.headers[TENANT_HEADER];
    const tenantId = request.user?.tenantId ?? (typeof header === 'string' ? header : undefined);
    if (!tenantId || isChaosExempt(path)) return next.handle();

    const config = await this.chaos.get(tenantId);
    if (config.latencyMs === 0 && config.errorRate === 0) return next.handle();

    const decision = decideChaos(config, request.method, path, Math.random);
    if (decision.delayMs > 0) await sleep(decision.delayMs);
    if (decision.fail) throw fail.internal('chaos_error', 'chaos_error');
    return next.handle();
  }
}
