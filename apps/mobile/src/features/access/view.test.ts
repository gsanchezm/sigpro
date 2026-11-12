import { describe, expect, it, vi } from 'vitest';
import { EMPTY_REGISTER, MIN_BUSY_MS, REGISTER_ROLE_OPTIONS, forgotErrors, parseForgot, parseRegister, passwordMeter, registerErrors, withMinDelay, type RegisterValues } from './view';

const valid: RegisterValues = {
  first: 'Ana',
  last: 'Prueba',
  email: 'ana@organizacion.es',
  org: 'Unidad de pruebas',
  role: 'auditor',
  password: 'Abcdefghij1!',
  confirm: 'Abcdefghij1!',
  terms: true,
};

describe('registerErrors', () => {
  it('un formulario completo no tiene errores', () => {
    expect(registerErrors(valid)).toEqual({});
  });

  it('el formulario vacío marca los obligatorios y los términos, con claves de `acceso`', () => {
    expect(registerErrors(EMPTY_REGISTER)).toEqual({
      first: 'required',
      last: 'required',
      email: 'required',
      org: 'required',
      password: 'required',
      terms: 'termsReq',
    });
  });

  it('formato de correo, contraseña corta y confirmación distinta', () => {
    expect(registerErrors({ ...valid, email: 'no-es-un-correo' })).toEqual({ email: 'badEmail' });
    expect(registerErrors({ ...valid, password: 'corta', confirm: 'corta' })).toEqual({ password: 'pwShort' });
    expect(registerErrors({ ...valid, confirm: 'otra' })).toEqual({ confirm: 'pwMismatch' });
  });

  it('los espacios no cuentan como nombre', () => {
    expect(registerErrors({ ...valid, first: '   ' })).toEqual({ first: 'required' });
  });
});

describe('parseRegister', () => {
  it('devuelve los datos normalizados: sin espacios en los extremos de los textos', () => {
    const parsed = parseRegister({ ...valid, first: '  Ana ', email: ' ana@organizacion.es ' });
    expect(parsed).toMatchObject({ ok: true, data: { first: 'Ana', email: 'ana@organizacion.es', role: 'auditor' } });
  });

  it('con errores no hay datos que enviar', () => {
    expect(parseRegister(EMPTY_REGISTER)).toMatchObject({ ok: false });
  });
});

describe('parseForgot', () => {
  it('normaliza el correo y rechaza el vacío', () => {
    expect(parseForgot(' a@b.es ')).toEqual({ ok: true, data: { email: 'a@b.es' } });
    expect(parseForgot('')).toEqual({ ok: false, errors: { email: 'required' } });
  });
});

describe('forgotErrors', () => {
  it('exige un correo con formato válido', () => {
    expect(forgotErrors('')).toEqual({ email: 'required' });
    expect(forgotErrors('x')).toEqual({ email: 'badEmail' });
    expect(forgotErrors('cualquiera@sigpro.test')).toEqual({});
  });
});

describe('REGISTER_ROLE_OPTIONS', () => {
  it('ofrece los tres roles registrables y nunca admin', () => {
    expect(REGISTER_ROLE_OPTIONS.map((option) => option.value)).toEqual(['consultant', 'program_manager', 'auditor']);
  });
});

describe('passwordMeter', () => {
  it('sin contraseña: fuerza «none», ninguna regla y barras vacías', () => {
    const meter = passwordMeter('');
    expect(meter.strength).toBe('none');
    expect(meter.score).toBe(0);
    expect(meter.tone).toBe('border');
    expect(meter.segments).toEqual([false, false, false, false]);
  });

  it('cada regla cumplida rellena una barra y cambia el color', () => {
    expect(passwordMeter('abcdefghij')).toMatchObject({ strength: 'weak', score: 1, tone: 'danger', rules: [true, false, false, false] });
    expect(passwordMeter('Abcdefghij')).toMatchObject({ strength: 'fair', score: 2, tone: 'warn' });
    expect(passwordMeter('Abcdefghij1')).toMatchObject({ strength: 'good', score: 3, tone: 'info', segments: [true, true, true, false] });
    expect(passwordMeter('Abcdefghij1!')).toMatchObject({ strength: 'strong', score: 4, tone: 'ok', rules: [true, true, true, true] });
  });

  it('una contraseña corta pero con mayúscula, minúscula, número y símbolo cumple tres reglas', () => {
    expect(passwordMeter('Ab1!').rules).toEqual([false, true, true, true]);
  });
});

describe('withMinDelay', () => {
  it('no resuelve antes del mínimo aunque la petición ya haya terminado', async () => {
    vi.useFakeTimers();
    try {
      let done = false;
      const pending = withMinDelay(Promise.resolve('ok')).then((value) => {
        done = true;
        return value;
      });
      await vi.advanceTimersByTimeAsync(MIN_BUSY_MS - 1);
      expect(done).toBe(false);
      await vi.advanceTimersByTimeAsync(1);
      await expect(pending).resolves.toBe('ok');
    } finally {
      vi.useRealTimers();
    }
  });

  it('propaga el error de la petición', async () => {
    vi.useFakeTimers();
    try {
      const failing = withMinDelay(Promise.reject(new Error('boom')));
      const caught = expect(failing).rejects.toThrow('boom');
      await vi.advanceTimersByTimeAsync(MIN_BUSY_MS);
      await caught;
    } finally {
      vi.useRealTimers();
    }
  });
});
