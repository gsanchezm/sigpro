import { describe, expect, it } from 'vitest';
import { LANGS, createTranslator, messages } from './index';

describe('i18n', () => {
  it('ES es el idioma por defecto y EN tiene exactamente las mismas claves', () => {
    expect(LANGS).toEqual(['es', 'en']);
    for (const ns of Object.keys(messages.es) as (keyof typeof messages.es)[]) {
      expect(Object.keys(messages.en[ns]).sort()).toEqual(Object.keys(messages.es[ns]).sort());
    }
  });

  it('el traductor resuelve por espacio de nombres y clave', () => {
    const t = createTranslator('es');
    expect(t('acceso', 'signIn')).toBe('Iniciar sesión');
    expect(createTranslator('en')('acceso', 'signIn')).toBe('Sign in');
    expect(t('programas', 'newProgram')).toBe('Nuevo programa');
  });

  it('interpola {variables} y deja intacto lo que no recibe', () => {
    expect(createTranslator('es')('lab', 'tenantInfo', { tenant: 'alumno07' })).toBe('Tenant activo: alumno07');
    expect(createTranslator('en')('lab', 'tenantInfo', { tenant: 'demo' })).toBe('Active tenant: demo');
    expect(createTranslator('es')('lab', 'tenantInfo')).toBe('Tenant activo: {tenant}');
  });

  it('las claves compartidas no tienen valores vacíos', () => {
    for (const lang of LANGS) {
      for (const dict of Object.values(messages[lang])) {
        expect(Object.values(dict).every((v) => typeof v === 'string' && v.length > 0)).toBe(true);
      }
    }
  });
});
