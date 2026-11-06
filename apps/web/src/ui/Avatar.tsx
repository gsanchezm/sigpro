import { initials } from '@sigpro/shared';
import { avatarUri, type AvatarShape, type AvatarTone } from '../lib/images';
import { useTheme } from '../state/theme';

interface AvatarProps {
  readonly name: string;
  readonly size: number;
  /** Tamaño de letra en px (por defecto 11, el de los avatares de 28 px). */
  readonly fontPx?: number;
  readonly shape?: AvatarShape;
  readonly tone?: AvatarTone;
  /** Avatar decorativo (alt vacío): úsalo cuando el nombre ya está en el texto contiguo y evita duplicar el nombre accesible. */
  readonly decorative?: boolean;
}

/** Avatar de iniciales como <img alt="Nombre"> (SVG data-URI), no como <div>. */
export const Avatar = ({ name, size, fontPx = 11, shape = 'square', tone = 'soft', decorative = false }: AvatarProps) => {
  const { theme } = useTheme();
  return <img src={avatarUri(initials(name), theme, { shape, tone, size, fontPx })} alt={decorative ? '' : name} width={size} height={size} className="flex-none" />;
};
