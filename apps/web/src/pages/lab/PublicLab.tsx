import { LAB_TESTIDS, LANGS, PROGRAMAS_TESTIDS, type Lang } from '@sigpro/shared';
import { Link } from 'react-router-dom';
import { isSupportedLang, useI18n } from '../../state/i18n';
import { useTheme } from '../../state/theme';
import { Logo } from '../../ui/Logo';
import { MoonIcon, SunIcon } from '../../ui/icons';
import { LabPage } from './LabPage';

/** /lab antes de iniciar sesión: cabecera mínima + la página de laboratorio. */
export const PublicLab = () => {
  const { t, lang, setLang } = useI18n();
  const { theme, toggleTheme } = useTheme();
  return (
    <div className="flex min-h-screen flex-col bg-bg text-[13px] leading-[1.45] text-fg">
      <header className="flex h-[52px] items-center gap-2 border-b border-border bg-surface px-4">
        <Logo size={24} />
        <span className="font-semibold">SIGPRO</span>
        <div className="flex-1" />
        <select
          data-testid={PROGRAMAS_TESTIDS.LAYOUT_LANG}
          aria-label={t('programas', 'language')}
          value={lang}
          onChange={(event) => isSupportedLang(event.target.value) && setLang(event.target.value as Lang)}
          className="h-8 cursor-pointer rounded-[4px] border border-border bg-surface px-1.5 text-[12px] font-medium text-fg-2"
        >
          {LANGS.map((code) => (
            <option key={code} value={code}>
              {code.toUpperCase()}
            </option>
          ))}
        </select>
        <button type="button" data-testid={PROGRAMAS_TESTIDS.LAYOUT_THEME} aria-label={t('programas', 'toggleTheme')} aria-pressed={theme === 'dark'} onClick={toggleTheme} className="icon-btn">
          {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
        </button>
        <Link to="/login" data-testid={LAB_TESTIDS.LAB_LOGIN_LINK} className="btn btn-primary no-underline !text-on-accent">
          {t('acceso', 'signInBtn')}
        </Link>
      </header>
      <main className="flex-1 px-4 py-5 sm:px-6">
        <LabPage />
      </main>
    </div>
  );
};
