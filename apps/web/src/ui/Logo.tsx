import { LOGO_COLORS, logoUri } from '../lib/images';
import { useTheme } from '../state/theme';

interface LogoProps {
  readonly size: number;
  /** El panel de marca es siempre oscuro y usa el acento oscuro. */
  readonly fixedDark?: boolean;
}

/** Logotipo como <img alt="SIGPRO"> (localizable con getByAltText). */
export const Logo = ({ size, fixedDark = false }: LogoProps) => {
  const { theme } = useTheme();
  const colors = LOGO_COLORS[fixedDark || theme === 'dark' ? 'dark' : 'light'];
  return <img src={logoUri(colors)} alt="SIGPRO" width={size} height={size} className="flex-none" />;
};
