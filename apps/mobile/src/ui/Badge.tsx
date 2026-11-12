import { StyleSheet, View } from 'react-native';
import { useTheme } from '../state/theme';
import { RADIUS, toneColors, type Tone } from '../theme/tokens';
import { Text } from './Text';

interface Props {
  readonly label: string;
  readonly tone?: Tone;
  readonly testID?: string;
  /** Se pinta como `data-state` en la web (`.badge[data-state="on_hold"]`). `validated` va en color pleno, como en la web. */
  readonly state?: string;
  /** Se pinta como `data-severity`. */
  readonly severity?: string;
}

/** Etiqueta de estado: píldora de 22 px sin borde, con punto de 6 px, y `data-state` / `data-severity` para locators CSS. */
export const Badge = ({ label, tone = 'neutral', testID, state, severity }: Props) => {
  const { colors } = useTheme();
  const soft = toneColors(colors, tone);
  const solid = state === 'validated';
  const fg = solid ? colors.surface : soft.fg;
  const bg = solid ? colors.ok : soft.bg;
  return (
    <View testID={testID} dataSet={{ state, severity, tone }} style={[styles.badge, { backgroundColor: bg }]}>
      <View aria-hidden style={[styles.dot, { backgroundColor: fg }]} />
      <Text variant="small" weight="500" style={{ color: fg }}>
        {label}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6, height: 22, borderRadius: RADIUS.pill, paddingHorizontal: 9 },
  dot: { width: 6, height: 6, borderRadius: RADIUS.pill },
});
