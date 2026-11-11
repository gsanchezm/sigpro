import { describe, expect, it } from 'vitest';
import { accountBlock, registerFailure, resolveTenantId, unknownUserAttempts } from './lockout';

describe('accountBlock', () => {
  const ok = { lockedAt: null, pendingApproval: false, active: true };

  it('una cuenta activa, aprobada y sin bloquear puede abrir sesión', () => {
    expect(accountBlock(ok)).toBeNull();
  });

  it('devuelve el motivo que ya usa el login: bloqueada, pendiente de aprobación o desactivada', () => {
    expect(accountBlock({ ...ok, lockedAt: new Date() })).toBe('account_locked');
    expect(accountBlock({ ...ok, pendingApproval: true })).toBe('pending_approval');
    expect(accountBlock({ ...ok, active: false })).toBe('account_disabled');
  });

  it('si hay varios motivos manda el mismo orden que el login: bloqueada, pendiente, desactivada', () => {
    expect(accountBlock({ lockedAt: new Date(), pendingApproval: true, active: false })).toBe('account_locked');
    expect(accountBlock({ lockedAt: null, pendingApproval: true, active: false })).toBe('pending_approval');
  });
});

describe('registerFailure', () => {
  it('cuenta los intentos fallidos y no bloquea antes del quinto', () => {
    expect(registerFailure(0)).toEqual({ attempts: 1, locked: false });
    expect(registerFailure(3)).toEqual({ attempts: 4, locked: false });
  });

  it('bloquea en el 5.º intento fallido', () => {
    expect(registerFailure(4)).toEqual({ attempts: 5, locked: true });
  });

  it('sigue bloqueado si ya había superado el umbral', () => {
    expect(registerFailure(9)).toEqual({ attempts: 10, locked: true });
  });
});

describe('unknownUserAttempts', () => {
  it('lleva la cuenta en memoria por tenant+correo y la reinicia al llegar al umbral', () => {
    const counter = unknownUserAttempts();
    expect(counter.fail('demo', 'x@y.es')).toBe(1);
    expect(counter.fail('demo', 'x@y.es')).toBe(2);
    expect(counter.fail('demo', 'otro@y.es')).toBe(1);
    expect(counter.fail('alumno01', 'x@y.es')).toBe(1);
    counter.clear('demo', 'x@y.es');
    expect(counter.fail('demo', 'x@y.es')).toBe(1);
  });

  it('no distingue mayúsculas en el correo', () => {
    const counter = unknownUserAttempts();
    counter.fail('demo', 'A@B.es');
    expect(counter.fail('demo', 'a@b.es')).toBe(2);
  });
});

describe('resolveTenantId', () => {
  it('prioriza la cabecera x-tenant', () => {
    expect(resolveTenantId('alumno03', ['demo'])).toBe('alumno03');
  });

  it('sin cabecera usa el único tenant que tiene ese correo', () => {
    expect(resolveTenantId(undefined, ['alumno09'])).toBe('alumno09');
  });

  it('sin cabecera y correo ambiguo o desconocido cae en demo', () => {
    expect(resolveTenantId(undefined, ['demo', 'alumno01'])).toBe('demo');
    expect(resolveTenantId(undefined, [])).toBe('demo');
    expect(resolveTenantId('  ', [])).toBe('demo');
  });
});
