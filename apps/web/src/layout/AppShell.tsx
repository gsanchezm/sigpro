import { DETALLE_TESTIDS, LANGS, MISION_DYNAMIC_TESTIDS, PROGRAMAS_DYNAMIC_TESTIDS, PROGRAMAS_TESTIDS, type Lang, type MessageKey } from '@sigpro/shared';
import { useEffect, useState, type ReactNode } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { useBreakpoint } from '../lib/hooks';
import { useAuth } from '../state/auth';
import { isSupportedLang, useI18n } from '../state/i18n';
import { useLiveCore } from '../state/live';
import { useTheme } from '../state/theme';
import { Logo } from '../ui/Logo';
import { CloseIcon, MenuIcon, MoonIcon, SearchIcon, SunIcon } from '../ui/icons';
import { CookieBanner } from './CookieBanner';
import { NotificationsMenu, UserMenu } from './HeaderMenus';
import { MOBILE_TABS, breadcrumbsFor, isNavCurrent, navFor, type NavItem } from './nav';
import { GlobalSearch } from './GlobalSearch';
import { isProgramsRoute } from './global-search';

type ProgramasKey = MessageKey<'programas'>;

/** Id de prueba de cada miga con enlace: Inicio · Programas · programa. */
const crumbTestId = (to: string): string => {
  if (to === '/') return DETALLE_TESTIDS.LAYOUT_BREADCRUMB_HOME;
  if (to === '/programs') return DETALLE_TESTIDS.LAYOUT_BREADCRUMB_PROGRAMS;
  // /programs/PRG-001 → miga del programa; /verification, /documents… → miga de sección
  return to.startsWith('/programs/') ? DETALLE_TESTIDS.LAYOUT_BREADCRUMB_PROGRAM : DETALLE_TESTIDS.LAYOUT_BREADCRUMB_SECTION;
};
const navLabelKey = (item: NavItem): ProgramasKey => `nav_${item.key}`;

const NavGlyph = ({ glyph, size }: { glyph: string; size: number }) => (
  <span
    aria-hidden="true"
    className="grid flex-none place-items-center rounded-ctl border-[1.5px] border-current text-[9px] font-semibold opacity-75"
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
  // Móvil: la búsqueda global se abre desde un icono y ocupa la cabecera (en /programs la propia página ya trae su buscador)
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const { ncOpen } = useLiveCore();

  const [userCollapsed, setUserCollapsed] = useState<boolean | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const collapsed = userCollapsed ?? breakpoint === 'tablet';
  const sidebarExpanded = isMobile ? drawerOpen : !collapsed;
  const showSidebar = !isMobile || drawerOpen;

  // El drawer móvil se cierra al navegar y al pasar a otro breakpoint
  useEffect(() => setDrawerOpen(false), [location.pathname, breakpoint]);
  useEffect(() => setMobileSearchOpen(false), [location.pathname, location.search, breakpoint]);
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
    edit: t('programas', 'edit'),
    other: (key) => {
      if (key === 'profile') return t('perfil', 'title');
      const item = nav.find((candidate) => candidate.key === key);
      return item ? t('programas', navLabelKey(item)) : key;
    },
  });
  const currentLabel = crumbs[crumbs.length - 1]?.label ?? '';
  const pagePadding = isMobile ? 'p-4 gap-4' : breakpoint === 'tablet' ? 'p-5 gap-5' : 'p-[var(--page-pad)] pb-10 gap-[var(--block-gap)]';

  return (
    <div className="relative flex min-h-screen bg-bg text-[13px] leading-[1.45] text-fg">
      <a
        href="#main-content"
        data-testid={DETALLE_TESTIDS.LAYOUT_SKIP_LINK}
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[80] focus:rounded-ctl focus:bg-accent focus:px-3 focus:py-2 focus:text-on-accent"
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
          <div className="flex h-[var(--topbar-h)] items-center gap-2.5 overflow-hidden border-b border-border px-3.5">
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
                  className={`flex h-9 items-center gap-2.5 rounded-ctl text-[13px] no-underline hover:bg-surface-2 hover:text-fg ${
                    sidebarExpanded ? 'justify-start px-2' : 'justify-center'
                  } ${current ? 'bg-accent-soft font-medium text-fg' : 'text-fg-2'}`}
                >
                  <NavGlyph glyph={item.glyph} size={18} />
                  {sidebarExpanded ? <span className="flex-1 whitespace-nowrap">{t('programas', navLabelKey(item))}</span> : null}
                  {item.key === 'nc' && ncOpen !== null && sidebarExpanded ? (
                    <span data-testid={MISION_DYNAMIC_TESTIDS.NAV_BADGE('nc')} className="rounded-full bg-danger-soft px-[5px] font-mono text-[10.5px] text-danger">
                      {ncOpen}
                    </span>
                  ) : null}
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
              className="flex h-[30px] w-full cursor-pointer items-center gap-2 rounded-ctl border-0 bg-transparent px-2 text-[12px] text-fg-2 hover:bg-surface-2"
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
        <header className="sticky top-0 z-20 flex h-[var(--topbar-h)] items-center gap-2 border-b border-border bg-surface py-0 pr-4 pl-3">
          <button
            type="button"
            data-testid={PROGRAMAS_TESTIDS.LAYOUT_SIDEBAR_TOGGLE}
            aria-label={t('programas', 'menu')}
            aria-expanded={isMobile ? drawerOpen : !collapsed}
            onClick={() => (isMobile ? setDrawerOpen((open) => !open) : setUserCollapsed(!collapsed))}
            className="grid size-8 flex-none cursor-pointer place-items-center rounded-ctl-sm border-0 bg-transparent text-fg-2 hover:bg-surface-2"
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
          ) : mobileSearchOpen ? null : (
            <span className="text-[15px] font-semibold">{currentLabel}</span>
          )}
          {mobileSearchOpen ? (
            <>
              <div className="min-w-0 flex-1">
                <GlobalSearch variant="mobile" />
              </div>
              <button type="button" aria-label={t('programas', 'close')} onClick={() => setMobileSearchOpen(false)} className="icon-btn">
                <CloseIcon />
              </button>
            </>
          ) : (
            <div className="flex-1" />
          )}
          {!isMobile ? (
            <>
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
            </>
          ) : null}
          {mobileSearchOpen ? null : (
            <>
              {isMobile && !isProgramsRoute(location.pathname) ? (
                <button type="button" data-testid={PROGRAMAS_TESTIDS.LAYOUT_SEARCH_TOGGLE} aria-label={t('programas', 'globalSearch')} onClick={() => setMobileSearchOpen(true)} className="icon-btn">
                  <SearchIcon size={16} />
                </button>
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
            </>
          )}
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
