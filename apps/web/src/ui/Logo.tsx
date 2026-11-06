import { logoUri } from '../lib/images';
import { useTheme } from '../state/theme';

interface LogoProps {
  readonly size: number;
  /** El panel de marca es siempre oscuro y usa el acento oscuro. */
  readonly fixedDark?: boolean;
}

/** Logotipo como <img alt="SIGPRO"> (localizable con getByAltText). */
export const Logo = ({ size, fixedDark = false }: LogoProps) => {
  const { theme } = useTheme();
  const accent = fixedDark || theme === 'dark' ? '#5b8def' : '#2f6fed';
  return <img src={logoUri(accent)} alt="SIGPRO" width={size} height={size} className="flex-none" style={{ borderRadius: size > 26 ? 5 : 5 }} />;
};
