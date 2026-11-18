import { describe, expect, it } from 'vitest';
import type { AccessPayload } from './auth.types';
import { hasAdminKey, hasSession } from './request-access';

const env = { ADMIN_KEY: 'clave-de-administracion' };
const access = { type: 'access' } as AccessPayload;
const jwt = {
  verify: (token: string): AccessPayload => {
    if (token === 'valido') return access;
    if (token === 'refresco') return { ...access, type: 'refresh' } as unknown as AccessPayload;
    throw new Error('jwt malformed');
  },
};

describe('hasAdminKey', () => {
  it('acepta solo la clave exacta', () => {
    expect(hasAdminKey({ 'x-admin-key': 'clave-de-administracion' }, env)).toBe(true);
    expect(hasAdminKey({ 'x-admin-key': 'clave-de-administracio' }, env)).toBe(false);
    expect(hasAdminKey({ 'x-admin-key': 'CLAVE-DE-ADMINISTRACION' }, env)).toBe(false);
  });

  it('rechaza la cabecera ausente, vacía o repetida', () => {
    expect(hasAdminKey({}, env)).toBe(false);
    expect(hasAdminKey({ 'x-admin-key': '' }, env)).toBe(false);
    expect(hasAdminKey({ 'x-admin-key': ['clave-de-administracion', 'otra'] }, env)).toBe(false);
  });
});

describe('hasSession', () => {
  it('acepta un bearer con un access token válido', () => {
    expect(hasSession({ authorization: 'Bearer valido' }, jwt)).toBe(true);
    expect(hasSession({ authorization: 'bearer valido' }, jwt)).toBe(true);
  });

  it('rechaza sin cabecera, con otro esquema, con un token inválido o con un token que no es de acceso', () => {
    expect(hasSession({}, jwt)).toBe(false);
    expect(hasSession({ authorization: 'Basic valido' }, jwt)).toBe(false);
    expect(hasSession({ authorization: 'Bearer roto' }, jwt)).toBe(false);
    expect(hasSession({ authorization: 'Bearer refresco' }, jwt)).toBe(false);
    expect(hasSession({ authorization: 'Bearer' }, jwt)).toBe(false);
  });
});
