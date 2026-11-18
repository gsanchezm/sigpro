import { afterEach, describe, expect, it, vi } from 'vitest';

// Credenciales de demo que NO deben quedar en ningún texto de una compilación «laboratorio cerrado»
const SECRETS = ['123456', 'admin@sigpro.test', 'bloqueado@sigpro.test', 'Alumno1234!', 'Admin1234!'];

const loadI18n = async (labPublic: boolean | undefined) => {
  vi.resetModules();
  if (labPublic === undefined) vi.unstubAllGlobals();
  else vi.stubGlobal('__SIGPRO_LAB_PUBLIC__', labPublic);
  const [{ LAB_PUBLIC }, acceso, lab, legal] = await Promise.all([import('./lab-public'), import('./i18n/acceso'), import('./i18n/lab'), import('./i18n/legal')]);
  const strings = [acceso.accesoEs, acceso.accesoEn, lab.labEs, lab.labEn, legal.legalEs, legal.legalEn].flatMap((dictionary) => Object.values(dictionary).map(String));
  return { LAB_PUBLIC, strings, acceso, lab, legal };
};

afterEach(() => vi.unstubAllGlobals());

describe('LAB_PUBLIC (compilación del laboratorio)', () => {
  it('sin la constante de compilación vale true: API, app móvil y desarrollo local no cambian', async () => {
    const { LAB_PUBLIC, acceso, lab } = await loadI18n(undefined);
    expect(LAB_PUBLIC).toBe(true);
    expect(acceso.accesoEs.mfaDemo).toBe('Prototipo: el código válido es 123456.');
    expect(lab.labEs.noteMfa).toBe('MFA: 123456');
  });

  it('con __SIGPRO_LAB_PUBLIC__=true los textos son los de siempre', async () => {
    const { LAB_PUBLIC, strings } = await loadI18n(true);
    expect(LAB_PUBLIC).toBe(true);
    expect(strings.some((text) => text.includes('123456'))).toBe(true);
  });

  it('con __SIGPRO_LAB_PUBLIC__=false NINGÚN texto cita el código MFA, los correos de prueba ni las contraseñas', async () => {
    const { LAB_PUBLIC, strings } = await loadI18n(false);
    expect(LAB_PUBLIC).toBe(false);
    for (const secret of SECRETS) expect(strings.filter((text) => text.includes(secret)), secret).toEqual([]);
  });

  it('con __SIGPRO_LAB_PUBLIC__=false los textos neutros siguen existiendo en español e inglés', async () => {
    const { acceso, lab, legal } = await loadI18n(false);
    for (const text of [acceso.accesoEs.mfaDemo, acceso.accesoEn.mfaDemo, lab.labEs.faqA4, lab.labEn.faqA4, legal.legalEs.help1Body, legal.legalEn.help1Body]) {
      expect(text.length).toBeGreaterThan(20);
    }
  });
});
