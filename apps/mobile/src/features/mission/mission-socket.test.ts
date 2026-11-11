import { describe, expect, it } from 'vitest';
import { CONNECTION_AFTER, MAX_TOKEN_RETRIES, shouldRenewToken } from './mission-socket';

describe('estado de conexión', () => {
  it('cada fase del socket deja el indicador en su estado', () => {
    expect(CONNECTION_AFTER.connect).toBe('connected');
    expect(CONNECTION_AFTER.disconnect).toBe('disconnected');
    expect(CONNECTION_AFTER.connect_error).toBe('disconnected');
    expect(CONNECTION_AFTER.reconnect_attempt).toBe('connecting');
    expect(CONNECTION_AFTER.manual_retry).toBe('connecting');
  });
});

describe('renovación del token', () => {
  it('solo renueva ante invalid_token y mientras queden reintentos', () => {
    expect(shouldRenewToken('invalid_token', 0)).toBe(true);
    expect(shouldRenewToken('invalid_token', MAX_TOKEN_RETRIES - 1)).toBe(true);
    expect(shouldRenewToken('invalid_token', MAX_TOKEN_RETRIES)).toBe(false);
  });

  it('otros errores (red, servidor caído) los reintenta Socket.IO solo', () => {
    expect(shouldRenewToken('xhr poll error', 0)).toBe(false);
    expect(shouldRenewToken('websocket error', 0)).toBe(false);
  });
});
