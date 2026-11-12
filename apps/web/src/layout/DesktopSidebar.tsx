import { MISION_DYNAMIC_TESTIDS, PROGRAMAS_DYNAMIC_TESTIDS, PROGRAMAS_TESTIDS } from '@sigpro/shared';
import { Link, useLocation } from 'react-router-dom';
import { useI18n } from '../state/i18n';
import { Logo } from '../ui/Logo';
import { isNavCurrent, type NavItem } from './nav';
import { NavGlyph, navLabelKey } from './shell-parts';

interface DesktopSidebarProps {
  readonly nav: readonly NavItem[];
  readonly collapsed: boolean;
  readonly ncOpen: number | null;
  readonly onToggle: () => void;
}

/** Navegación principal de ESCRITORIO (≥ 1024 px): barra lateral fija, plegable a solo iconos. En responsive se monta `MobileDrawer`. */
export const DesktopSidebar = ({ nav, collapsed, ncOpen, onToggle }: DesktopSidebarProps) => {
  const { t } = useI18n();
  const location = useLocation();
  const expanded = !collapsed;

  return (
    <aside
      aria-label={t('programas', 'mainNav')}
      data-testid={PROGRAMAS_TESTIDS.LAYOUT_SIDEBAR}
      className={`sticky top-0 flex h-screen flex-none flex-col border-r border-border bg-surface transition-[width] duration-150 ${expanded ? 'w-[224px]' : 'w-[56px]'}`}
    >
      <div className="flex h-[var(--topbar-h)] items-center gap-2.5 overflow-hidden border-b border-border px-3.5">
        <Logo size={24} />
        {expanded ? <span className="font-semibold tracking-[.01em] whitespace-nowrap">SIGPRO</span> : null}
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
                expanded ? 'justify-start px-2' : 'justify-center'
              } ${current ? 'bg-accent-soft font-medium text-fg' : 'text-fg-2'}`}
            >
              <NavGlyph glyph={item.glyph} size={18} />
              {expanded ? <span className="flex-1 whitespace-nowrap">{t('programas', navLabelKey(item))}</span> : null}
              {item.key === 'nc' && ncOpen !== null && expanded ? (
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
          aria-expanded={expanded}
          onClick={onToggle}
          className="flex h-[30px] w-full cursor-pointer items-center gap-2 rounded-ctl border-0 bg-transparent px-2 text-[12px] text-fg-2 hover:bg-surface-2"
        >
          <span aria-hidden="true" className="inline-block text-[14px]" style={{ transform: expanded ? 'none' : 'rotate(180deg)' }}>
            «
          </span>
          {expanded ? <span>{t('programas', 'collapse')}</span> : null}
        </button>
      </div>
    </aside>
  );
};
