import { describe, expect, it } from 'vitest';
import { decideChaos, isChaosExempt } from './chaos';

const config = { latencyMs: 400, errorRate: 0.5, flakyLabels: false };

describe('isChaosExempt', () => {
  it('no aplica caos a admin, auth, health ni docs (para poder apagarlo)', () => {
    expect(isChaosExempt('/api/admin/chaos')).toBe(true);
    expect(isChaosExempt('/api/auth/login')).toBe(true);
    expect(isChaosExempt('/api/health')).toBe(true);
    expect(isChaosExempt('/api/docs')).toBe(true);
    expect(isChaosExempt('/api/config')).toBe(true);
    expect(isChaosExempt('/api/programs')).toBe(false);
  });
});

describe('decideChaos', () => {
  it('sin caos configurado no retrasa ni falla', () => {
    expect(decideChaos({ latencyMs: 0, errorRate: 0, flakyLabels: false }, 'POST', '/api/programs', () => 0)).toEqual({ delayMs: 0, fail: false });
  });

  it('la latencia es aleatoria entre 0 y latencyMs', () => {
    expect(decideChaos(config, 'GET', '/api/programs', () => 0.5).delayMs).toBe(200);
    expect(decideChaos(config, 'GET', '/api/programs', () => 0).delayMs).toBe(0);
  });

  it('los errores 500 solo afectan a escrituras', () => {
    expect(decideChaos(config, 'GET', '/api/programs', () => 0).fail).toBe(false);
    expect(decideChaos(config, 'POST', '/api/programs', () => 0.1).fail).toBe(true);
    expect(decideChaos(config, 'DELETE', '/api/programs/PRG-001', () => 0.1).fail).toBe(true);
  });

  it('falla solo cuando el azar cae por debajo de errorRate', () => {
    expect(decideChaos(config, 'PATCH', '/api/programs/x', () => 0.49).fail).toBe(true);
    expect(decideChaos(config, 'PATCH', '/api/programs/x', () => 0.5).fail).toBe(false);
  });

  it('las rutas exentas nunca se alteran', () => {
    expect(decideChaos(config, 'PATCH', '/api/admin/chaos', () => 0)).toEqual({ delayMs: 0, fail: false });
  });
});
