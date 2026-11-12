// Lógica pura de las páginas públicas (web: `LegalPage.tsx`): el contenido de cada una y a dónde lleva su enlace de retorno.
// Sin imports de react-native: se prueba con Vitest en Node (`view.test.ts`).
import { LEGAL_TESTIDS, type MessageKey } from '@sigpro/shared';

export type LegalKind = 'terms' | 'privacy' | 'help';

type LegalKey = MessageKey<'legal'>;

export interface LegalSection {
  readonly title: LegalKey;
  readonly body: LegalKey;
}

export interface LegalContent {
  readonly title: LegalKey;
  readonly intro: LegalKey;
  readonly sections: readonly LegalSection[];
  /** `data-testid` del artículo: términos y privacidad comparten el de la web (`legal-page`); la ayuda tiene el suyo. */
  readonly pageTestId: string;
}

/** Contenido de cada página pública (mapa de despacho por tipo, los mismos textos y secciones que la web). */
export const LEGAL_CONTENT: Readonly<Record<LegalKind, LegalContent>> = {
  terms: {
    title: 'termsTitle',
    intro: 'termsIntro',
    pageTestId: LEGAL_TESTIDS.LEGAL_PAGE,
    sections: [
      { title: 'terms1Title', body: 'terms1Body' },
      { title: 'terms2Title', body: 'terms2Body' },
      { title: 'terms3Title', body: 'terms3Body' },
    ],
  },
  privacy: {
    title: 'privacyTitle',
    intro: 'privacyIntro',
    pageTestId: LEGAL_TESTIDS.LEGAL_PAGE,
    sections: [
      { title: 'privacy1Title', body: 'privacy1Body' },
      { title: 'privacy2Title', body: 'privacy2Body' },
      { title: 'privacy3Title', body: 'privacy3Body' },
    ],
  },
  help: {
    title: 'helpTitle',
    intro: 'helpIntro',
    pageTestId: LEGAL_TESTIDS.HELP_PAGE,
    sections: [
      { title: 'help1Title', body: 'help1Body' },
      { title: 'help2Title', body: 'help2Body' },
      { title: 'help3Title', body: 'help3Body' },
      { title: 'help4Title', body: 'help4Body' },
    ],
  },
};

export interface BackTarget {
  /** Ruta de la web a la que vuelve el enlace: Programas con sesión, Acceso sin ella. */
  readonly href: '/programs' | '/login';
  readonly label: Extract<LegalKey, 'back' | 'backToLogin'>;
}

/** Enlace de retorno de las páginas públicas (como la web): «Volver» a Programas con sesión o «Volver al acceso» sin ella. */
export const backTarget = (signedIn: boolean): BackTarget => (signedIn ? { href: '/programs', label: 'back' } : { href: '/login', label: 'backToLogin' });
