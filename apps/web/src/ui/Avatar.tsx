import { initials } from '@sigpro/shared';
import { avatarUri, type AvatarShape } from '../lib/images';
import { useTheme } from '../state/theme';

interface AvatarProps {
  readonly name: string;
  readonly size: number;
  readonly shape?: AvatarShape;
}

/** Avatar de iniciales como <img alt="Nombre"> (SVG data-URI), no como <div>. */
export const Avatar = ({ name, size, shape = 'square' }: AvatarProps) => {
  const { theme } = useTheme();
  return <img src={avatarUri(initials(name), theme, shape)} alt={name} width={size} height={size} className="flex-none" />;
};
