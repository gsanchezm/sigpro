import { describe, expect, it } from 'vitest';
import { tenantIds } from './data';
import { isLegacyStudentTenant, studentTenantId, tenantSuffix } from './tenant-suffix';

const SEED = 'semilla-de-prueba-0123456789';
const options = { seed: SEED, length: 4 } as const;

describe('tenantSuffix', () => {
  // Valores de referencia: si esta prueba falla, el algoritmo ha cambiado y los alumnos perderían el id que ya guardaron
  // en su .env (alumno07-hfva dejaría de existir). Un cambio así exige una migración, no solo actualizar estos valores.
  it('da siempre el mismo sufijo para la misma semilla y el mismo tenant (valores fijados)', () => {
    expect(tenantSuffix(SEED, 'alumno07', 4)).toBe('hfva');
    expect(tenantSuffix(SEED, 'alumno25', 4)).toBe('njhn');
    expect(tenantSuffix(SEED, 'alumno07', 8)).toBe('hfvak94o');
  });

  it('es estable en llamadas repetidas (redeploy, reseed y cada ejecución de sigpro-reset recalculan lo mismo)', () => {
    const first = tenantIds(25, options);
    for (let run = 0; run < 5; run += 1) expect(tenantIds(25, options)).toEqual(first);
  });

  it('cambia con la semilla y con el tenant', () => {
    expect(tenantSuffix('otra-semilla-de-prueba-9876', 'alumno07', 4)).toBe('f26n');
    expect(tenantSuffix(SEED, 'alumno07', 4)).not.toBe(tenantSuffix(SEED, 'alumno08', 4));
  });

  it('solo usa letras minúsculas y dígitos, y respeta la longitud pedida', () => {
    for (const length of [3, 4, 6, 12]) {
      const suffix = tenantSuffix(SEED, 'alumno07', length);
      expect(suffix).toHaveLength(length);
      expect(suffix).toMatch(/^[0-9a-z]+$/);
    }
  });

  it('no repite sufijo entre los 100 tenants posibles con 4 caracteres', () => {
    const suffixes = Array.from({ length: 100 }, (_, index) => tenantSuffix(SEED, `alumno${String(index + 1).padStart(2, '0')}`, 4));
    expect(new Set(suffixes).size).toBe(100);
  });
});

describe('studentTenantId', () => {
  it('sin semilla devuelve el id de siempre', () => {
    expect(studentTenantId('alumno07')).toBe('alumno07');
    expect(studentTenantId('alumno07', { seed: '', length: 4 })).toBe('alumno07');
  });

  it('con semilla añade el sufijo tras un guion', () => {
    expect(studentTenantId('alumno07', options)).toBe('alumno07-hfva');
  });
});

describe('tenantIds con sufijos', () => {
  it('demo no lleva sufijo y los alumnos sí', () => {
    const ids = tenantIds(3, options);
    expect(ids[0]).toBe('demo');
    expect(ids).toHaveLength(4);
    expect(ids.slice(1).every((id) => /^alumno0[1-3]-[0-9a-z]{4}$/.test(id))).toBe(true);
  });

  it('sin opciones los ids no cambian (mismo resultado que antes de añadir los sufijos)', () => {
    expect(tenantIds(3)).toEqual(['demo', 'alumno01', 'alumno02', 'alumno03']);
    expect(tenantIds(3, undefined)).toEqual(tenantIds(3));
  });
});

describe('isLegacyStudentTenant', () => {
  it('reconoce alumnoNN sin sufijo y nada más', () => {
    expect(['alumno01', 'alumno25', 'alumno100'].every(isLegacyStudentTenant)).toBe(true);
    expect(['demo', 'alumno07-hfva', 'alumno7', 'alumnoXX', 'alumno01 '].some(isLegacyStudentTenant)).toBe(false);
  });
});
