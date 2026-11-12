import { PROGRAMAS_TESTIDS, RESPONSIVE_DYNAMIC_TESTIDS, RESPONSIVE_TESTIDS } from '@sigpro/shared';
import { useEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../state/auth';
import { useI18n } from '../state/i18n';
import { useToast } from '../state/toast';
import { Avatar } from '../ui/Avatar';
import { CloseIcon } from '../ui/icons';
import { Logo } from '../ui/Logo';
import { isNavCurrent, type NavItem } from './nav';
import { NavGlyph, navLabelKey, useLogout } from './shell-parts';

/**
 * Menú de usuario del DISEÑO RESPONSIVE: una sección al pie del drawer (en escritorio es el popover de la cabecera,
 * `UserMenu`). Mismos nombres accesibles —Perfil, Atajos, Cerrar sesión— con roles de enlace y botón en lugar de `menuitem`.
 */
const DrawerUserSection = ({ onNavigate }: { onNavigate: () => void }) => {
  const { t } = useI18n();
  const { user } = useAuth();
  const toast = useToast();
  const logout = useLogout();
  if (!user) return null;

  const itemClass = 'flex h-11 w-full cursor-pointer items-center justify-between rounded-ctl border-0 bg-transparent px-2 text-left text-[13px] text-fg no-underline hover:bg-surface-2';
  return (
    <div role="group" aria-label={t('programas', 'userMenu')} data-testid={RESPONSIVE_TESTIDS.LAYOUT_USER_MENU} className="flex flex-col gap-0.5 border-t border-border px-2 py-2.5">
      <div className="flex items-center gap-2.5 px-2 pb-1.5">
        <Avatar name={user.name} size={32} fontPx={12} />
        <span className="flex min-w-0 flex-col leading-[1.2]">
          <span className="truncate text-[13px] font-medium">{user.name}</span>
          <span className="font-mono text-[11px] text-fg-3">{user.role}</span>
        </span>
      </div>
      <Link to="/profile" data-testid={RESPONSIVE_TESTIDS.LAYOUT_USER_PROFILE} onClick={onNavigate} className={itemClass}>
        {t('programas', 'profile')}
      </Link>
      <button
        type="button"
        data-testid={RESPONSIVE_TESTIDS.LAYOUT_USER_SHORTCUTS}
        onClick={() => {
          onNavigate();
          toast.push('info', t('common', 'shortcutsTitle'), t('common', 'shortcutsBody'));
        }}
        className={itemClass}
      >
        {t('programas', 'shortcuts')}
        <kbd aria-hidden="true" className="font-mono text-[10.5px] text-fg-3">
          ?
        </kbd>
      </button>
      <button
        type="button"
        data-testid={RESPONSIVE_TESTIDS.LAYOUT_USER_LOGOUT}
        onClick={() => {
          onNavigate();
          void logout();
        }}
        className={`${itemClass} !text-danger hover:!bg-danger-soft`}
      >
        {t('programas', 'logout')}
      </button>
    </div>
  );
};

interface MobileDrawerProps {
  readonly nav: readonly NavItem[];
  readonly ncOpen: number | null;
  readonly onClose: () => void;
}

/**
 * Navegación principal del DISEÑO RESPONSIVE (< 1024 px, móvil y tablet): un drawer que abre la hamburguesa, con el menú
 * de usuario al pie. Solo existe en el DOM mientras está abierto. En escritorio se monta `DesktopSidebar`.
 */
export const MobileDrawer = ({ nav, ncOpen, onClose }: MobileDrawerProps) => {
  const { t } = useI18n();
  const location = useLocation();
  const closeRef = useRef<HTMLButtonElement>(null);
  // El foco entra en el drawer al abrirse (el botón de cierre es lo primero que se alcanza)
  useEffect(() => closeRef.current?.focus(), []);

  return (
    <>
      <aside
        aria-label={t('programas', 'mainNav')}
        data-testid={RESPONSIVE_TESTIDS.LAYOUT_SIDEBAR}
        className="fixed inset-y-0 left-0 z-[31] flex w-[min(280px,86vw)] flex-col border-r border-border bg-surface"
      >
        <div className="flex h-[var(--topbar-h)] flex-none items-center gap-2.5 border-b border-border px-3.5">
          <Logo size={24} />
          <span className="flex-1 font-semibold tracking-[.01em] whitespace-nowrap">SIGPRO</span>
          <button
            ref={closeRef}
            type="button"
            data-testid={RESPONSIVE_TESTIDS.LAYOUT_SIDEBAR_COLLAPSE}
            aria-label={t('programas', 'collapseSidebar')}
            onClick={onClose}
            className="icon-btn"
          >
            <CloseIcon />
          </button>
        </div>
        <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto px-2 py-2.5">
          {nav.map((item) => {
            const current = isNavCurrent(location.pathname, item);
            return (
              <Link
                key={item.key}
                to={item.href}
                data-testid={RESPONSIVE_DYNAMIC_TESTIDS.NAV(item.key)}
                aria-current={current ? 'page' : undefined}
                title={t('programas', navLabelKey(item))}
                className={`flex h-11 items-center gap-2.5 rounded-ctl px-2 text-[14px] no-underline hover:bg-surface-2 hover:text-fg ${current ? 'bg-accent-soft font-medium text-fg' : 'text-fg-2'}`}
              >
                <NavGlyph glyph={item.glyph} size={20} />
                <span className="flex-1 whitespace-nowrap">{t('programas', navLabelKey(item))}</span>
                {item.key === 'nc' && ncOpen !== null ? (
                  <span data-testid={RESPONSIVE_DYNAMIC_TESTIDS.NAV_BADGE('nc')} className="rounded-full bg-danger-soft px-[5px] font-mono text-[10.5px] text-danger">
                    {ncOpen}
                  </span>
                ) : null}
              </Link>
            );
          })}
        </nav>
        <DrawerUserSection onNavigate={onClose} />
      </aside>
      <div role="presentation" data-testid={PROGRAMAS_TESTIDS.LAYOUT_DRAWER_SCRIM} onClick={onClose} className="fixed inset-0 z-30 bg-[var(--scrim)]" />
    </>
  );
};
