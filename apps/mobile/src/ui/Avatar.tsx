import { StyleSheet, View } from 'react-native';
import { initials } from '../lib/text';
import { useTheme } from '../state/theme';
import { Text } from './Text';

interface Props {
  readonly name: string;
  readonly size?: number;
}

/** Avatar de iniciales con `role="img"` y el nombre como etiqueta accesible (equivale al `<img alt>` de la web: `getByRole('img', { name })`). */
export const Avatar = ({ name, size = 28 }: Props) => {
  const { colors } = useTheme();
  return (
    <View role="img" aria-label={name} style={[styles.avatar, { width: size, height: size, borderRadius: size / 2, backgroundColor: colors.accentSoft }]}>
      <Text variant="small" tone="accent" weight="600" style={{ fontSize: Math.max(10, size * 0.4) }} aria-hidden>
        {initials(name)}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  avatar: { alignItems: 'center', justifyContent: 'center' },
});
