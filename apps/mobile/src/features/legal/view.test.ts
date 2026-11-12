import { LEGAL_TESTIDS, accesoEn, accesoEs, legalEn, legalEs } from '@sigpro/shared';
import { describe, expect, it } from 'vitest';
import { LEGAL_CONTENT, backTarget, type LegalKind } from './view';

const KINDS: readonly LegalKind[] = ['terms', 'privacy', 'help'];

describe('LEGAL_CONTENT', () => {
  it('cada página tiene las secciones de la web: 3 los términos, 3 la privacidad y 4 la ayuda', () => {
    expect(LEGAL_CONTENT.terms.sections).toHaveLength(3);
    expect(LEGAL_CONTENT.privacy.sections).toHaveLength(3);
    expect(LEGAL_CONTENT.help.sections).toHaveLength(4);
  });

  it('todas las claves existen en los textos compartidos, en español y en inglés', () => {
    for (const kind of KINDS) {
      const content = LEGAL_CONTENT[kind];
      const keys = [content.title, content.intro, ...content.sections.flatMap((section) => [section.title, section.body])];
      for (const key of keys) {
        expect(legalEs[key], `${kind}.${key} (es)`).toBeTruthy();
        expect(legalEn[key], `${kind}.${key} (en)`).toBeTruthy();
      }
    }
  });

  it('usa los ids de la web: `legal-page` para términos y privacidad y `help-page` para la ayuda', () => {
    expect(LEGAL_CONTENT.terms.pageTestId).toBe(LEGAL_TESTIDS.LEGAL_PAGE);
    expect(LEGAL_CONTENT.privacy.pageTestId).toBe(LEGAL_TESTIDS.LEGAL_PAGE);
    expect(LEGAL_CONTENT.help.pageTestId).toBe(LEGAL_TESTIDS.HELP_PAGE);
  });

  it('los títulos coinciden con los de los enlaces del pie de Acceso', () => {
    expect(legalEs[LEGAL_CONTENT.privacy.title]).toBe('Política de privacidad');
    expect(accesoEs.termsFooter).toBe('Condiciones');
    expect(accesoEn.help).toBe('Help');
  });
});

describe('backTarget', () => {
  it('con sesión vuelve a Programas; sin ella, al acceso', () => {
    expect(backTarget(true)).toEqual({ href: '/programs', label: 'back' });
    expect(backTarget(false)).toEqual({ href: '/login', label: 'backToLogin' });
  });
});
