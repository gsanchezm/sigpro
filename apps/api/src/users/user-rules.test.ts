import { describe, expect, it } from 'vitest';
import { decideUserUpdate, type UserFacts } from './user-rules';

const admin: UserFacts = { id: 'u1', role: 'admin', active: true };
const consultant: UserFacts = { id: 'u3', role: 'consultant', active: true };

describe('decideUserUpdate', () => {
  it('permite desactivar o cambiar el rol de otra persona', () => {
    expect(decideUserUpdate('u1', consultant, { active: false }, 1)).toEqual({ ok: true });
    expect(decideUserUpdate('u1', consultant, { role: 'auditor' }, 1)).toEqual({ ok: true });
  });

  it('409 self_change si te desactivas o te cambias el rol', () => {
    expect(decideUserUpdate('u1', admin, { active: false }, 2)).toEqual({ ok: false, code: 'self_change' });
    expect(decideUserUpdate('u1', admin, { role: 'consultant' }, 2)).toEqual({ ok: false, code: 'self_change' });
  });

  it('no es self_change repetir el mismo valor', () => {
    expect(decideUserUpdate('u1', admin, { active: true, role: 'admin' }, 2)).toEqual({ ok: true });
  });

  it('409 last_admin si dejaría el tenant sin ningún admin activo', () => {
    expect(decideUserUpdate('u9', admin, { active: false }, 1)).toEqual({ ok: false, code: 'last_admin' });
    expect(decideUserUpdate('u9', admin, { role: 'auditor' }, 1)).toEqual({ ok: false, code: 'last_admin' });
    expect(decideUserUpdate('u9', admin, { active: false }, 2)).toEqual({ ok: true });
  });

  it('reactivar o ascender a admin nunca es problema', () => {
    expect(decideUserUpdate('u1', { ...consultant, active: false }, { active: true }, 1)).toEqual({ ok: true });
    expect(decideUserUpdate('u1', consultant, { role: 'admin' }, 1)).toEqual({ ok: true });
  });
});
