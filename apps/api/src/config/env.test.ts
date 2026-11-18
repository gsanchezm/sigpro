import { describe, expect, it } from 'vitest';
import { allowedEmailDomains, hasTestUsers, loadEnv, showsTestUsers, tenantListIsPrivate, tenantSuffixOptions } from './env';

const base = { DATABASE_URL: 'postgresql://x' };

describe('endurecimiento: sin variables todo sigue como antes', () => {
  const env = loadEnv(base);

  it('los valores por defecto no activan ninguna medida', () => {
    expect(env.TENANT_SUFFIX_SEED).toBe('');
    expect(env.LAB_PUBLIC).toBe(true);
    expect(env.RESTRICT_EMAIL_DOMAINS).toBe(false);
    expect(env.ROBOTS_NOINDEX).toBe(false);
  });

  it('los defaults de longitud y de dominios son los de los despliegues del curso (los blueprints los declaran igual)', () => {
    expect(env.TENANT_SUFFIX_LENGTH).toBe(6);
    // Los tres dominios que usa el propio seed: alumnos (<tenant>@sigpro.lab), demo (@sigpro.test) y el reservado para ejemplos
    expect([...allowedEmailDomains(env)].sort()).toEqual(['example.com', 'sigpro.lab', 'sigpro.test']);
  });

  it('sin semilla no hay opciones de sufijo, la lista de tenants es pública y los usuarios de prueba se muestran', () => {
    expect(tenantSuffixOptions(env)).toBeUndefined();
    expect(tenantListIsPrivate(env)).toBe(false);
    expect(showsTestUsers(env)).toBe(true);
    expect(hasTestUsers(env)).toBe(true);
  });

  it('los valores previos (APP_ENV, SEED_STUDENT_TENANTS…) conservan su default', () => {
    expect(env.APP_ENV).toBe('dev');
    expect(env.SEED_STUDENT_TENANTS).toBe(25);
    expect(env.PLANTED_BUGS).toBe(true);
  });
});

describe('APP_ENV', () => {
  // QA declara APP_ENV=qa y Staging, staging: el esquema acepta cualquier texto y solo `production` cambia el comportamiento
  it.each(['qa', 'staging', 'dev'])('%s se acepta y se trata como entorno de pruebas (usuarios de prueba disponibles)', (name) => {
    const env = loadEnv({ ...base, APP_ENV: name });
    expect(env.APP_ENV).toBe(name);
    expect(hasTestUsers(env)).toBe(true);
    expect(showsTestUsers(env)).toBe(true);
  });

  it('production no ofrece usuarios de prueba a nadie', () => {
    expect(hasTestUsers(loadEnv({ ...base, APP_ENV: 'production' }))).toBe(false);
  });
});

describe('TENANT_SUFFIX_SEED', () => {
  it('admite una semilla de 16 caracteres o más', () => {
    const env = loadEnv({ ...base, TENANT_SUFFIX_SEED: '0123456789abcdef', TENANT_SUFFIX_LENGTH: '6' });
    expect(tenantSuffixOptions(env)).toEqual({ seed: '0123456789abcdef', length: 6 });
    expect(tenantListIsPrivate(env)).toBe(true);
  });

  it('rechaza una semilla corta y el error no incluye su valor', () => {
    const secret = 'corta-secreta';
    let message = '';
    try {
      loadEnv({ ...base, TENANT_SUFFIX_SEED: secret });
    } catch (error) {
      message = (error as Error).message;
    }
    expect(message).toContain('TENANT_SUFFIX_SEED');
    expect(message).not.toContain(secret);
  });

  it('rechaza una longitud fuera de 3–12', () => {
    expect(() => loadEnv({ ...base, TENANT_SUFFIX_SEED: '0123456789abcdef', TENANT_SUFFIX_LENGTH: '2' })).toThrow(/TENANT_SUFFIX_LENGTH/);
    expect(() => loadEnv({ ...base, TENANT_SUFFIX_SEED: '0123456789abcdef', TENANT_SUFFIX_LENGTH: '13' })).toThrow(/TENANT_SUFFIX_LENGTH/);
  });
});

describe('LAB_PUBLIC=false', () => {
  const env = loadEnv({ ...base, LAB_PUBLIC: 'false' });

  it('oculta los usuarios de prueba a los anónimos pero no los elimina para quien tenga sesión', () => {
    expect(showsTestUsers(env)).toBe(false);
    expect(hasTestUsers(env)).toBe(true);
  });

  it('vuelve privada la lista de tenants', () => {
    expect(tenantListIsPrivate(env)).toBe(true);
  });

  it('en producción no hay usuarios de prueba para nadie', () => {
    expect(hasTestUsers(loadEnv({ ...base, APP_ENV: 'production' }))).toBe(false);
  });
});

describe('allowedEmailDomains', () => {
  it('normaliza mayúsculas, espacios y entradas vacías', () => {
    expect([...allowedEmailDomains({ ALLOWED_EMAIL_DOMAINS: ' Curso.TEST , example.org ,, ' })]).toEqual(['curso.test', 'example.org']);
  });
});
