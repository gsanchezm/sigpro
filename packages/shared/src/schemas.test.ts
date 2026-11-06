import { describe, expect, it } from 'vitest';
import { accesoEs } from './i18n/acceso';
import { programasEs } from './i18n/programas';
import {
  createProgramSchema,
  forgotSchema,
  loginSchema,
  mfaSchema,
  programStep1Schema,
  programStep2Schema,
  registerSchema,
} from './schemas';

/** Devuelve { campo: mensaje } del primer error de cada campo. */
const errorsOf = (result: { success: boolean; error?: { issues: { path: (string | number)[]; message: string }[] } }) =>
  Object.fromEntries((result.error?.issues ?? []).map((i) => [i.path.join('.'), i.message]));

describe('loginSchema', () => {
  it('acepta credenciales con formato válido', () => {
    expect(loginSchema.safeParse({ email: 'admin@sigpro.test', password: 'Admin1234!' }).success).toBe(true);
  });

  it('reporta campo obligatorio y formato de correo con claves i18n', () => {
    expect(errorsOf(loginSchema.safeParse({ email: '', password: '' }))).toEqual({ email: 'required', password: 'required' });
    expect(errorsOf(loginSchema.safeParse({ email: 'no-es-correo', password: 'x' }))).toEqual({ email: 'badEmail' });
  });

  it('recuerda la sesión por defecto', () => {
    expect(loginSchema.parse({ email: 'a@b.co', password: 'x' }).remember).toBe(true);
  });
});

describe('mfaSchema', () => {
  it('exige exactamente 6 dígitos', () => {
    expect(mfaSchema.safeParse({ mfaToken: 't', code: '123456' }).success).toBe(true);
    expect(mfaSchema.safeParse({ mfaToken: 't', code: '12345' }).success).toBe(false);
    expect(mfaSchema.safeParse({ mfaToken: 't', code: '12345a' }).success).toBe(false);
  });
});

describe('forgotSchema', () => {
  it('valida el correo', () => {
    expect(errorsOf(forgotSchema.safeParse({ email: '' }))).toEqual({ email: 'required' });
    expect(forgotSchema.safeParse({ email: 'x@y.es' }).success).toBe(true);
  });
});

describe('registerSchema', () => {
  const valid = {
    first: 'Ana',
    last: 'Pérez',
    email: 'ana@org.es',
    org: 'Unidad 1',
    role: 'consultant',
    password: 'Abcdefghij1!',
    confirm: 'Abcdefghij1!',
    terms: true,
  };

  it('acepta un registro completo', () => {
    expect(registerSchema.safeParse(valid).success).toBe(true);
  });

  it('exige confirmar la contraseña y aceptar los términos', () => {
    expect(errorsOf(registerSchema.safeParse({ ...valid, confirm: 'otra' }))).toEqual({ confirm: 'pwMismatch' });
    expect(errorsOf(registerSchema.safeParse({ ...valid, terms: false }))).toEqual({ terms: 'termsReq' });
  });

  it('rechaza contraseñas que incumplen alguna regla', () => {
    expect(errorsOf(registerSchema.safeParse({ ...valid, password: 'corta', confirm: 'corta' }))).toEqual({ password: 'pwShort' });
  });

  it('no permite pedir el rol admin', () => {
    expect(registerSchema.safeParse({ ...valid, role: 'admin' }).success).toBe(false);
  });

  it('marca todos los campos de texto vacíos como obligatorios', () => {
    const errors = errorsOf(registerSchema.safeParse({ ...valid, first: ' ', last: '', org: '', email: '' }));
    expect(errors).toEqual({ first: 'required', last: 'required', org: 'required', email: 'required' });
  });
});

describe('createProgramSchema', () => {
  const valid = {
    name: 'Radar de prueba',
    description: '',
    ownerId: 'u1',
    status: 'draft',
    startDate: '2026-01-15',
    endDate: '2027-03-01',
    budget: 500000,
    priority: 'medium',
    classified: false,
    notify: true,
  };

  it('acepta un programa válido', () => {
    expect(createProgramSchema.safeParse(valid).success).toBe(true);
  });

  it('exige nombre de al menos 3 caracteres', () => {
    expect(errorsOf(programStep1Schema.safeParse({ ...valid, name: 'ab' }))).toEqual({ name: 'requiredName' });
  });

  it('exige responsable', () => {
    expect(errorsOf(programStep1Schema.safeParse({ ...valid, ownerId: '' }))).toEqual({ ownerId: 'requiredOwner' });
  });

  it('exige fechas coherentes: fin posterior al inicio', () => {
    expect(errorsOf(programStep2Schema.safeParse({ ...valid, endDate: '2026-01-15' }))).toEqual({ endDate: 'endAfterStart' });
    expect(errorsOf(programStep2Schema.safeParse({ ...valid, endDate: '2025-12-31' }))).toEqual({ endDate: 'endAfterStart' });
  });

  it('exige fecha de inicio', () => {
    expect(errorsOf(programStep2Schema.safeParse({ ...valid, startDate: '' }))).toEqual({ startDate: 'requiredStart' });
  });

  it('exige presupuesto mayor que 0', () => {
    expect(errorsOf(programStep2Schema.safeParse({ ...valid, budget: 0 }))).toEqual({ budget: 'budgetPositive' });
    expect(errorsOf(programStep2Schema.safeParse({ ...valid, budget: -5 }))).toEqual({ budget: 'budgetPositive' });
  });
});

describe('claves de error', () => {
  it('todas las claves de mensaje existen en los diccionarios i18n', () => {
    const accesoKeys = ['required', 'badEmail', 'pwShort', 'pwMismatch', 'termsReq'];
    const programKeys = ['requiredName', 'requiredOwner', 'requiredStart', 'endAfterStart', 'budgetPositive'];
    expect(accesoKeys.every((k) => k in accesoEs)).toBe(true);
    expect(programKeys.every((k) => k in programasEs)).toBe(true);
  });
});
