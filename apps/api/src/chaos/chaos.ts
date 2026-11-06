import type { ChaosConfig } from '@sigpro/shared';

export const NO_CHAOS: ChaosConfig = { latencyMs: 0, errorRate: 0, flakyLabels: false };

const EXEMPT_PREFIXES = ['/api/admin', '/api/auth', '/api/health', '/api/docs', '/api/config'] as const;
const WRITE_METHODS: ReadonlySet<string> = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/** Rutas que el caos nunca toca: así el instructor siempre puede apagarlo y el login sigue siendo estable. */
export const isChaosExempt = (path: string): boolean => EXEMPT_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));

export interface ChaosDecision {
  readonly delayMs: number;
  readonly fail: boolean;
}

/** Función pura: el azar se inyecta (`rand`) para poder probarla de forma determinista. */
export const decideChaos = (config: ChaosConfig, method: string, path: string, rand: () => number): ChaosDecision => {
  if (isChaosExempt(path)) return { delayMs: 0, fail: false };
  const delayMs = config.latencyMs > 0 ? Math.round(rand() * config.latencyMs) : 0;
  const fail = config.errorRate > 0 && WRITE_METHODS.has(method.toUpperCase()) && rand() < config.errorRate;
  return { delayMs, fail };
};
