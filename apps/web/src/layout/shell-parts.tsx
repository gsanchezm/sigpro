import { DETALLE_TESTIDS, PROGRAMAS_TESTIDS, type MessageKey } from '@sigpro/shared';
import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../state/auth';
import { useI18n } from '../state/i18n';
import { useTheme } from '../state/theme';
import { MoonIcon, SunIcon } from '../ui/icons';
import type { NavItem } from './nav';

// Piezas que comparten las dos variantes del shell (escritorio y responsive). Lo que cambia por tamaño vive en
// DesktopSidebar / MobileDrawer, DesktopHeader / MobileHeader, UserMenu / DrawerUserSection y GlobalSearch / GlobalSearchScreen.

type ProgramasKey = MessageKey<'programas'>;

/** Id de prueba de cada miga con enlace: Inicio · Programas · programa. */
export const crumbTestId = (to: string): string => {
  if (to === '/') return DETALLE_TESTIDS.LAYOUT_BREADCRUMB_HOME;
  if (to === '/programs') return DETALLE_TESTIDS.LAYOUT_BREADCRUMB_PROGRAMS;
  // /programs/PRG-001 → miga del programa; /verification, /documents… → miga de sección
  return to.startsWith('/programs/') ? DETALLE_TESTIDS.LAYOUT_BREADCRUMB_PROGRAM : DETALLE_TESTIDS.LAYOUT_BREADCRUMB_SECTION;
};

export const navLabelKey = (item: NavItem): ProgramasKey => `nav_${item.key}`;

export const NavGlyph = ({ glyph, size }: { glyph: string; size: number }) => (
  <span
    aria-hidden="true"
    className="grid flex-none place-items-center rounded-ctl border-[1.5px] border-current text-[9px] font-semibold opacity-75"
    style={{ width: size, height: size }}
  >
    {glyph}
  </span>
);

/** Botón de tema claro/oscuro: mismo id y mismo nombre en las dos variantes (no es una familia). */
export const ThemeToggle = () => {
  const { t } = useI18n();
  const { theme, toggleTheme } = useTheme();
  return (
    <button type="button" data-testid={PROGRAMAS_TESTIDS.LAYOUT_THEME} aria-label={t('programas', 'toggleTheme')} aria-pressed={theme === 'dark'} onClick={toggleTheme} className="icon-btn">
      {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
    </button>
  );
};

/** Cierra la sesión y lleva a `/login` con el aviso (la usan el menú de escritorio y la sección del drawer). */
export const useLogout = (): (() => Promise<void>) => {
  const { signOut } = useAuth();
  const navigate = useNavigate();
  return useCallback(async () => {
    // signOut vacía la sesión de forma síncrona; navegar justo después evita que RequireAuth redirija sin el aviso
    const done = signOut();
    navigate('/login', { state: { signedOut: true } });
    await done;
  }, [signOut, navigate]);
};
