import { LANGS, LEGAL_TESTIDS, type Lang, type MessageKey } from '@sigpro/shared';
import { Link } from 'react-router-dom';
import { useAuth } from '../../state/auth';
import { isSupportedLang, useI18n } from '../../state/i18n';
import { useTheme } from '../../state/theme';
import { Logo } from '../../ui/Logo';
import { MoonIcon, SunIcon } from '../../ui/icons';

export type LegalKind = 'terms' | 'privacy' | 'help';

type LegalKey = MessageKey<'legal'>;

interface Section {
  readonly title: LegalKey;
  readonly body: LegalKey;
}

interface Content {
  readonly title: LegalKey;
  readonly intro: LegalKey;
  readonly sections: readonly Section[];
  readonly pageTestId: string;
}

/** Contenido de cada página pública (mapa de despacho por tipo). */
const CONTENT: Readonly<Record<LegalKind, Content>> = {
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

/** Términos, privacidad y ayuda: páginas públicas (sin sesión) con cabecera mínima, idioma y tema. */
export const LegalPage = ({ kind }: { kind: LegalKind }) => {
  const { t, lang, setLang } = useI18n();
  const { theme, toggleTheme } = useTheme();
  const { status } = useAuth();
  const content = CONTENT[kind];
  const signedIn = status === 'authenticated';

  return (
    <div className="flex min-h-screen flex-col bg-bg text-[13px] leading-[1.45] text-fg">
      <header className="flex h-[52px] items-center gap-2 border-b border-border bg-surface px-4">
        <Logo size={24} />
        <span className="font-semibold">SIGPRO</span>
        <div className="flex-1" />
        <select
          data-testid={LEGAL_TESTIDS.LEGAL_LANG}
          aria-label={t('legal', 'language')}
          value={lang}
          onChange={(event) => isSupportedLang(event.target.value) && setLang(event.target.value as Lang)}
          className="h-8 cursor-pointer rounded-ctl border border-border bg-surface px-1.5 text-[12px] font-medium text-fg-2"
        >
          {LANGS.map((code) => (
            <option key={code} value={code}>
              {code.toUpperCase()}
            </option>
          ))}
        </select>
        <button type="button" data-testid={LEGAL_TESTIDS.LEGAL_THEME} aria-label={t('legal', 'toggleTheme')} aria-pressed={theme === 'dark'} onClick={toggleTheme} className="icon-btn">
          {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
        </button>
      </header>

      <main id="main-content" className="mx-auto flex w-full max-w-[720px] flex-1 flex-col gap-4 px-4 py-8">
        <article data-testid={content.pageTestId} aria-labelledby="legal-heading" className="flex flex-col gap-4">
          <header className="flex flex-col gap-1.5">
            <h1 id="legal-heading" data-testid={LEGAL_TESTIDS.LEGAL_TITLE} className="m-0 text-[22px] font-semibold tracking-[-.01em]">
              {t('legal', content.title)}
            </h1>
            <p className="m-0 text-fg-2">{t('legal', content.intro)}</p>
            <p className="m-0 font-mono text-[11.5px] text-fg-3">{t('legal', 'updated')}</p>
          </header>
          {content.sections.map((section) => (
            <section key={section.title} className="card flex flex-col gap-1 p-4">
              <h2 className="section-title">{t('legal', section.title)}</h2>
              <p className="m-0 text-fg-2">{t('legal', section.body)}</p>
            </section>
          ))}
          {kind === 'help' ? (
            <Link to="/lab" data-testid={LEGAL_TESTIDS.HELP_LAB_LINK} className="self-start font-medium">
              {t('legal', 'helpLab')}
            </Link>
          ) : null}
        </article>
        <Link to={signedIn ? '/programs' : '/login'} data-testid={LEGAL_TESTIDS.LEGAL_BACK} className="self-start text-[12.5px] font-medium">
          {signedIn ? t('legal', 'back') : t('legal', 'backToLogin')}
        </Link>
      </main>
    </div>
  );
};
