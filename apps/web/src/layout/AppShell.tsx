import { DETALLE_TESTIDS, LANGS, PROGRAMAS_DYNAMIC_TESTIDS, PROGRAMAS_TESTIDS, type Lang, type MessageKey } from '@sigpro/shared';
import { useEffect, useState, type ReactNode } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { useBreakpoint } from '../lib/hooks';
import { useAuth } from '../state/auth';
import { isSupportedLang, useI18n } from '../state/i18n';
import { useTheme } from '../state/theme';
import { Logo } from '../ui/Logo';
import { MenuIcon, MoonIcon, SearchIcon, SunIcon } from '../ui/icons';
import { CookieBanner } from './CookieBanner';
import { NotificationsMenu, UserMenu } from './HeaderMenus';
import { MOBILE_TABS, breadcrumbsFor, isNavCurrent, navFor, type NavItem } from './nav';
import { useGlobalSearch } from './useGlobalSearch';

type ProgramasKey = MessageKey<'programas'>;

/** Id de prueba de cada miga con enlace: Inicio · Programas · programa. */
const crumbTestId = (to: string): string => (to === '/' ? DETALLE_TESTIDS.LAYOUT_BREADCRUMB_HOME : to === '/programs' ? DETALLE_TESTIDS.LAYOUT_BREADCRUMB_PROGRAMS : DETALLE_TESTIDS.LAYOUT_BREADCRUMB_PROGRAM);
const navLabelKey = (item: NavItem): ProgramasKey => `nav_${item.key}`;

const NavGlyph = ({ glyph, size }: { glyph: string; size: number }) => (
  <span
    aria-hidden="true"
    className="grid flex-none place-items-center rounded-[4px] border-[1.5px] border-current text-[9px] font-semibold opacity-75"
    style={{ width: size, height: size }}
  >
    {glyph}
  </span>
);

/** Estructura común de las pantallas autenticadas: sidebar, cabecera, contenido, tabbar móvil y cookies. */
export const AppShell = ({ children }: { children?: ReactNode } = {}) => {
  const { t, lang, setLang } = useI18n();
  const { theme, toggleTheme } = useTheme();
  const { user } = useAuth();
  const location = useLocation();
  const breakpoint = useBreakpoint();
  const isMobile = breakpoint === 'mobile';
  const { draft, setDraft } = useGlobalSearch();

  const [userCollapsed, setUserCollapsed] = useState<boolean | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const collapsed = userCollapsed ?? breakpoint === 'tablet';
  const sidebarExpanded = isMobile ? drawerOpen : !collapsed;
  const showSidebar = !isMobile || drawerOpen;

  // El drawer móvil se cierra al navegar y al pasar a otro breakpoint
  useEffect(() => setDrawerOpen(false), [location.pathname, breakpoint]);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && setDrawerOpen(false);
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  if (!user) return null;

  const nav = navFor(user.role);
  const crumbs = breadcrumbsFor(location.pathname, {
    home: t('programas', 'home'),
    programs: t('programas', 'programs'),
    requirements: t('programas', 'nav_requirements'),
    other: (key) => {
      const item = nav.find((candidate) => candidate.key === key);
      return item ? t('programas', navLabelKey(item)) : key;
    },
  });
  const currentLabel = crumbs[crumbs.length - 1]?.label ?? '';
  const pagePadding = isMobile ? 'p-3 gap-3' : breakpoint === 'tablet' ? 'p-4 gap-4' : 'px-6 pt-5 pb-8 gap-4';

  return (
    <div className="relative flex min-h-screen bg-bg text-[13px] leading-[1.45] text-fg">
      <a
        href="#main-content"
        data-testid={DETALLE_TESTIDS.LAYOUT_SKIP_LINK}
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[80] focus:rounded-[4px] focus:bg-accent focus:px-3 focus:py-2 focus:text-on-accent"
      >
        {t('common', 'skipToContent')}
      </a>

      {showSidebar ? (
        <aside
          aria-label={t('programas', 'mainNav')}
          data-testid={PROGRAMAS_TESTIDS.LAYOUT_SIDEBAR}
          className={`flex flex-none flex-col border-r border-border bg-surface transition-[width] duration-150 ${
            isMobile ? 'fixed inset-y-0 left-0 z-[31] w-[260px]' : `sticky top-0 h-screen ${sidebarExpanded ? 'w-[224px]' : 'w-[56px]'}`
          }`}
        >
          <div className="flex h-[52px] items-center gap-2.5 overflow-hidden border-b border-border px-3.5">
            <Logo size={24} />
            {sidebarExpanded ? <span className="font-semibold tracking-[.01em] whitespace-nowrap">SIGPRO</span> : null}
          </div>
          <nav className="flex flex-1 flex-col gap-0.5 px-2 py-2.5">
            {nav.map((item) => {
              const current = isNavCurrent(location.pathname, item);
              return (
                <Link
                  key={item.key}
                  to={item.href}
                  data-testid={PROGRAMAS_DYNAMIC_TESTIDS.NAV(item.key)}
                  aria-current={current ? 'page' : undefined}
                  title={t('programas', navLabelKey(item))}
                  className={`flex h-8 items-center gap-2.5 rounded-[4px] text-[12.5px] no-underline hover:bg-surface-2 hover:text-fg ${
                    sidebarExpanded ? 'justify-start px-2' : 'justify-center'
                  } ${current ? 'bg-accent-soft font-medium text-fg' : 'text-fg-2'}`}
                >
                  <NavGlyph glyph={item.glyph} size={18} />
                  {sidebarExpanded ? <span className="flex-1 whitespace-nowrap">{t('programas', navLabelKey(item))}</span> : null}
                  {item.badge && sidebarExpanded ? <span className="rounded-full bg-danger-soft px-[5px] font-mono text-[10.5px] text-danger">{item.badge}</span> : null}
                </Link>
              );
            })}
          </nav>
          <div className="border-t border-border px-2 py-2.5">
            <button
              type="button"
              data-testid={PROGRAMAS_TESTIDS.LAYOUT_SIDEBAR_COLLAPSE}
              aria-label={t('programas', 'collapseSidebar')}
              aria-expanded={sidebarExpanded}
              onClick={() => (isMobile ? setDrawerOpen(false) : setUserCollapsed(!collapsed))}
              className="flex h-[30px] w-full cursor-pointer items-center gap-2 rounded-[4px] border-0 bg-transparent px-2 text-[12px] text-fg-2 hover:bg-surface-2"
            >
              <span aria-hidden="true" className="inline-block text-[14px]" style={{ transform: sidebarExpanded ? 'none' : 'rotate(180deg)' }}>
                «
              </span>
              {sidebarExpanded ? <span>{t('programas', 'collapse')}</span> : null}
            </button>
          </div>
        </aside>
      ) : null}
      {drawerOpen ? <div role="presentation" data-testid={PROGRAMAS_TESTIDS.LAYOUT_DRAWER_SCRIM} onClick={() => setDrawerOpen(false)} className="fixed inset-0 z-30 bg-[var(--scrim)]" /> : null}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-[52px] items-center gap-2 border-b border-border bg-surface py-0 pr-3 pl-2">
          <button
            type="button"
            data-testid={PROGRAMAS_TESTIDS.LAYOUT_SIDEBAR_TOGGLE}
            aria-label={t('programas', 'menu')}
            aria-expanded={isMobile ? drawerOpen : !collapsed}
            onClick={() => (isMobile ? setDrawerOpen((open) => !open) : setUserCollapsed(!collapsed))}
            className="grid size-8 flex-none cursor-pointer place-items-center rounded-[4px] border-0 bg-transparent text-fg-2 hover:bg-surface-2"
          >
            <MenuIcon size={16} />
          </button>
          {!isMobile ? (
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
          ) : (
            <span className="text-[15px] font-semibold">{currentLabel}</span>
          )}
          <div className="flex-1" />
          {!isMobile ? (
            <>
              <div className="relative w-[min(320px,30vw)]">
                <SearchIcon size={14} className="pointer-events-none absolute top-[9px] left-[9px] text-fg-3" />
                <input
                  type="search"
                  data-testid={PROGRAMAS_TESTIDS.LAYOUT_SEARCH}
                  aria-label={t('programas', 'globalSearch')}
                  placeholder={t('programas', 'searchPlaceholder')}
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  className="input input-header !bg-bg pr-2.5 pl-7 text-[12.5px]"
                  style={{ borderColor: 'var(--border)' }}
                />
                <kbd aria-hidden="true" className="kbd absolute top-2 right-2 bg-surface text-fg-3">
                  /
                </kbd>
              </div>
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
            </>
          ) : null}
          <button
            type="button"
            data-testid={PROGRAMAS_TESTIDS.LAYOUT_THEME}
            aria-label={t('programas', 'toggleTheme')}
            aria-pressed={theme === 'dark'}
            onClick={toggleTheme}
            className="icon-btn"
          >
            {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
          </button>
          <NotificationsMenu />
          <UserMenu breakpoint={breakpoint} />
        </header>

        <main id="main-content" tabIndex={-1} className={`flex min-w-0 flex-1 flex-col ${pagePadding}`}>
          {children ?? <Outlet />}
        </main>

        {isMobile ? (
          <nav
            aria-label={t('programas', 'mainNav')}
            data-testid={PROGRAMAS_TESTIDS.MOBILE_TABBAR}
            className="sticky bottom-0 z-20 grid h-14 grid-cols-4 border-t border-border bg-surface"
          >
            {MOBILE_TABS.map((item) => {
              const current = isNavCurrent(location.pathname, item);
              return (
                <Link
                  key={item.key}
                  to={item.href}
                  data-testid={PROGRAMAS_DYNAMIC_TESTIDS.MOBILE_TAB(item.key)}
                  aria-current={current ? 'page' : undefined}
                  className={`flex min-h-11 flex-col items-center justify-center gap-[3px] no-underline ${current ? 'text-accent' : 'text-fg-3'}`}
                >
                  <NavGlyph glyph={item.glyph} size={20} />
                  <span className="text-[10.5px] font-medium">{item.key === 'lab' ? t('programas', 'nav_more') : t('programas', navLabelKey(item))}</span>
                </Link>
              );
            })}
          </nav>
        ) : null}
      </div>

      <CookieBanner />
    </div>
  );
};
