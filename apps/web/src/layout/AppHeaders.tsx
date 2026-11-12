import { LANGS, PROGRAMAS_TESTIDS, RESPONSIVE_TESTIDS, type Lang } from '@sigpro/shared';
import { forwardRef } from 'react';
import { Link } from 'react-router-dom';
import { isSupportedLang, useI18n } from '../state/i18n';
import { MenuIcon } from '../ui/icons';
import { GlobalSearch } from './GlobalSearch';
import { GlobalSearchScreen } from './GlobalSearchScreen';
import { NotificationsMenu, UserMenu } from './HeaderMenus';
import type { Crumb } from './nav';
import { ThemeToggle, crumbTestId } from './shell-parts';

const hamburgerClass = 'grid size-8 flex-none cursor-pointer place-items-center rounded-ctl-sm border-0 bg-transparent text-fg-2 hover:bg-surface-2';
const headerClass = 'sticky top-0 z-20 flex h-[var(--topbar-h)] items-center gap-2 border-b border-border bg-surface py-0 pr-4 pl-3';

interface DesktopHeaderProps {
  readonly crumbs: readonly Crumb[];
  readonly collapsed: boolean;
  readonly onToggle: () => void;
}

/** Cabecera de ESCRITORIO: pliega la barra lateral, migas, búsqueda global en línea, idioma, tema, notificaciones y menú de usuario. */
export const DesktopHeader = ({ crumbs, collapsed, onToggle }: DesktopHeaderProps) => {
  const { t, lang, setLang } = useI18n();
  return (
    <header className={headerClass}>
      <button type="button" data-testid={PROGRAMAS_TESTIDS.LAYOUT_SIDEBAR_TOGGLE} aria-label={t('programas', 'menu')} aria-expanded={!collapsed} onClick={onToggle} className={hamburgerClass}>
        <MenuIcon size={16} />
      </button>
      <nav aria-label={t('programas', 'breadcrumbs')} data-testid={PROGRAMAS_TESTIDS.LAYOUT_BREADCRUMBS} className="flex items-center gap-1.5 text-[12.5px] whitespace-nowrap text-fg-3">
        {crumbs.map((crumb, index) => (
          <span key={`${crumb.label}-${index}`} className="flex items-center gap-1.5">
            {index > 0 ? <span aria-hidden="true">/</span> : null}
            {crumb.to ? (
              <Link to={crumb.to} data-testid={crumbTestId(crumb.to)} className="!text-fg-2 no-underline hover:!text-fg">
                {crumb.label}
              </Link>
            ) : (
              <span aria-current="page" className="font-medium text-fg">
                {crumb.label}
              </span>
            )}
          </span>
        ))}
      </nav>
      <div className="flex-1" />
      <GlobalSearch />
      <select
        data-testid={PROGRAMAS_TESTIDS.LAYOUT_LANG}
        aria-label={t('programas', 'language')}
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
      <ThemeToggle />
      <NotificationsMenu />
      <UserMenu />
    </header>
  );
};

interface MobileHeaderProps {
  readonly title: string;
  readonly drawerOpen: boolean;
  /** En `/programs` la propia página trae su buscador: la cabecera no ofrece el icono. */
  readonly showSearch: boolean;
  readonly onToggleDrawer: () => void;
}

/** Cabecera del DISEÑO RESPONSIVE: hamburguesa que abre el drawer, título de la sección, icono de búsqueda, tema y notificaciones. */
export const MobileHeader = forwardRef<HTMLButtonElement, MobileHeaderProps>(({ title, drawerOpen, showSearch, onToggleDrawer }, ref) => {
  const { t } = useI18n();
  return (
    <header className={headerClass}>
      <button
        ref={ref}
        type="button"
        data-testid={RESPONSIVE_TESTIDS.LAYOUT_SIDEBAR_TOGGLE}
        aria-label={t('programas', 'menu')}
        aria-expanded={drawerOpen}
        onClick={onToggleDrawer}
        className={hamburgerClass}
      >
        <MenuIcon size={16} />
      </button>
      <span className="min-w-0 flex-1 truncate text-[15px] font-semibold">{title}</span>
      {showSearch ? <GlobalSearchScreen /> : null}
      <ThemeToggle />
      <NotificationsMenu />
    </header>
  );
});
MobileHeader.displayName = 'MobileHeader';
