import { ACCESO_TESTIDS, DETALLE_TESTIDS, type Lang, LANGS } from '@sigpro/shared';
import { useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../state/auth';
import { isSupportedLang, useI18n } from '../../state/i18n';
import { useTheme } from '../../state/theme';
import { Logo } from '../../ui/Logo';
import { MoonIcon, SunIcon } from '../../ui/icons';

/** Panel de marca (siempre oscuro) + columna de formulario con cabecera y pie. */
export const AuthLayout = ({ children, overlay }: { children: ReactNode; overlay?: ReactNode }) => {
  const { lang, setLang, t } = useI18n();
  const { theme, toggleTheme } = useTheme();
  const { publicApi } = useAuth();
  const [env, setEnv] = useState<{ env: string; version: string } | null>(null);

  useEffect(() => {
    let alive = true;
    publicApi.config
      .get()
      .then((config) => alive && setEnv({ env: config.env, version: config.version }))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [publicApi]);

  return (
    <div className="relative flex min-h-screen overflow-hidden bg-bg text-fg">
      {/* Panel de marca: decorativo (aria-hidden), siempre oscuro: data-theme="dark" vuelve a resolver los tokens a oscuro, sin hex */}
      <aside aria-hidden="true" data-theme="dark" className="hidden w-[min(40%,460px)] flex-none flex-col justify-between border-r border-border bg-bg p-10 text-fg sm:flex">
        <div className="flex items-center gap-2.5">
          <Logo size={28} fixedDark />
          <span className="text-[15px] font-semibold tracking-[.01em]">SIGPRO</span>
        </div>
        <div className="flex flex-col gap-3.5">
          <div className="font-mono text-[11px] tracking-[.08em] text-fg-3">{t('common', 'brandTag')}</div>
          <p className="m-0 max-w-[22ch] text-[22px] leading-[1.3] font-medium tracking-[-.01em] text-pretty">{t('common', 'brandClaim')}</p>
          <dl className="mt-2 mb-0 grid grid-cols-[auto_1fr] gap-x-3.5 gap-y-1.5 font-mono text-[12px] text-fg-2">
            <dt className="text-fg-3">{t('common', 'brandEnv')}</dt>
            <dd className="m-0">{env?.env ?? '—'}</dd>
            <dt className="text-fg-3">{t('common', 'brandVersion')}</dt>
            <dd className="m-0">{env ? `v${env.version}` : '—'}</dd>
            <dt className="text-fg-3">{t('common', 'brandClassification')}</dt>
            <dd className="m-0">{t('common', 'brandClassificationValue')}</dd>
          </dl>
        </div>
        <div className="text-[11.5px] text-fg-3">{t('common', 'brandLegal')}</div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-[var(--topbar-h)] items-center gap-2 border-b border-border bg-surface px-4">
          <div className="flex items-center gap-2 sm:hidden">
            <Logo size={24} />
            <span className="font-semibold">SIGPRO</span>
          </div>
          <div className="flex-1" />
          <select
            data-testid={ACCESO_TESTIDS.AUTH_LANG}
            aria-label={t('acceso', 'language')}
            value={lang}
            onChange={(event) => isSupportedLang(event.target.value) && setLang(event.target.value as Lang)}
            className="h-9 cursor-pointer rounded-ctl border border-border bg-surface px-2 text-[12px] font-medium text-fg-2"
          >
            {LANGS.map((code) => (
              <option key={code} value={code}>
                {code.toUpperCase()}
              </option>
            ))}
          </select>
          <button
            type="button"
            data-testid={ACCESO_TESTIDS.AUTH_THEME}
            aria-label={t('acceso', 'toggleTheme')}
            aria-pressed={theme === 'dark'}
            onClick={toggleTheme}
            className="icon-btn"
          >
            {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
          </button>
        </header>

        <main className="flex flex-1 flex-col items-center justify-center gap-5 px-4 py-8">{children}</main>

        <footer className="flex flex-wrap justify-center gap-x-4 gap-y-1.5 border-t border-border px-4 py-3 text-[11.5px] text-fg-3">
          <span className="font-mono">© 2026 SIGPRO</span>
          <Link to="/legal/privacy" data-testid={DETALLE_TESTIDS.AUTH_FOOTER_PRIVACY} className="!text-fg-3">
            {t('acceso', 'privacy')}
          </Link>
          <Link to="/legal/terms" data-testid={DETALLE_TESTIDS.AUTH_FOOTER_TERMS} className="!text-fg-3">
            {t('acceso', 'termsFooter')}
          </Link>
          <Link to="/help" data-testid={DETALLE_TESTIDS.AUTH_FOOTER_HELP} className="!text-fg-3">
            {t('acceso', 'help')}
          </Link>
        </footer>
      </div>
      {overlay}
    </div>
  );
};
