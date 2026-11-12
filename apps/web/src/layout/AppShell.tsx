import { DETALLE_TESTIDS, type MessageKey } from '@sigpro/shared';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { useLayout } from '../lib/layout';
import { useAuth } from '../state/auth';
import { useI18n } from '../state/i18n';
import { useLiveCore } from '../state/live';
import { DesktopHeader, MobileHeader } from './AppHeaders';
import { CookieBanner } from './CookieBanner';
import { DesktopSidebar } from './DesktopSidebar';
import { isProgramsRoute } from './global-search';
import { MobileDrawer } from './MobileDrawer';
import { breadcrumbsFor, navFor } from './nav';
import { navLabelKey } from './shell-parts';

/**
 * Estructura común de las pantallas autenticadas. Un solo corte a 1024 px (`useLayout`): en escritorio se monta la barra
 * lateral y la cabecera con búsqueda en línea y menú de usuario; por debajo (móvil y tablet), el drawer con hamburguesa y
 * el menú de usuario al pie, y una cabecera con el icono de búsqueda. React monta una variante u otra, nunca las dos.
 */
export const AppShell = ({ children }: { children?: ReactNode } = {}) => {
  const { t } = useI18n();
  const { user } = useAuth();
  const location = useLocation();
  const layout = useLayout();
  const isMobile = layout === 'mobile';
  const { ncOpen } = useLiveCore();
  const hamburgerRef = useRef<HTMLButtonElement>(null);

  const [collapsed, setCollapsed] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // El drawer se cierra al navegar y al cambiar de diseño; al cerrarlo con Esc el foco vuelve a la hamburguesa
  useEffect(() => setDrawerOpen(false), [location.pathname, layout]);
  useEffect(() => {
    if (!isMobile || !drawerOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setDrawerOpen(false);
      hamburgerRef.current?.focus();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isMobile, drawerOpen]);

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
      return item ? t('programas', navLabelKey(item) as MessageKey<'programas'>) : key;
    },
  });
  const currentLabel = crumbs[crumbs.length - 1]?.label ?? '';
  const pagePadding = isMobile ? 'p-4 gap-4' : 'p-[var(--page-pad)] pb-10 gap-[var(--block-gap)]';

  return (
    <div className="relative flex min-h-screen bg-bg text-[13px] leading-[1.45] text-fg">
      <a
        href="#main-content"
        data-testid={DETALLE_TESTIDS.LAYOUT_SKIP_LINK}
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[80] focus:rounded-ctl focus:bg-accent focus:px-3 focus:py-2 focus:text-on-accent"
      >
        {t('common', 'skipToContent')}
      </a>

      {isMobile ? (
        drawerOpen ? <MobileDrawer nav={nav} ncOpen={ncOpen} onClose={() => setDrawerOpen(false)} /> : null
      ) : (
        <DesktopSidebar nav={nav} collapsed={collapsed} ncOpen={ncOpen} onToggle={() => setCollapsed((current) => !current)} />
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        {isMobile ? (
          <MobileHeader
            ref={hamburgerRef}
            title={currentLabel}
            drawerOpen={drawerOpen}
            // En /programs la propia página trae su buscador (`programs-search`): la cabecera no ofrece el icono
            showSearch={!isProgramsRoute(location.pathname)}
            onToggleDrawer={() => setDrawerOpen((open) => !open)}
          />
        ) : (
          <DesktopHeader crumbs={crumbs} collapsed={collapsed} onToggle={() => setCollapsed((current) => !current)} />
        )}

        <main id="main-content" tabIndex={-1} className={`flex min-w-0 flex-1 flex-col ${pagePadding}`}>
          {children ?? <Outlet />}
        </main>
      </div>

      <CookieBanner />
    </div>
  );
};
