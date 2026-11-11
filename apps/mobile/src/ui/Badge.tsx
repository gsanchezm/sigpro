import { StyleSheet, View } from 'react-native';
import { useTheme } from '../state/theme';
import { RADIUS, toneColors, type Tone } from '../theme/tokens';
import { Text } from './Text';

interface Props {
  readonly label: string;
  readonly tone?: Tone;
  readonly testID?: string;
  /** Se pinta como `data-state` en la web (`.badge[data-state="on_hold"]`). */
  readonly state?: string;
  /** Se pinta como `data-severity`. */
  readonly severity?: string;
}

/** Etiqueta de estado con color de tono y atributos `data-state` / `data-severity` para locators CSS. */
export const Badge = ({ label, tone = 'neutral', testID, state, severity }: Props) => {
  const { colors } = useTheme();
  const { fg, bg } = toneColors(colors, tone);
  return (
    <View testID={testID} dataSet={{ state, severity, tone }} style={[styles.badge, { backgroundColor: bg, borderColor: fg }]}>
      <Text variant="small" style={{ color: fg, fontWeight: '600' }}>
        {label}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: { alignSelf: 'flex-start', borderWidth: 1, borderRadius: RADIUS.pill, paddingHorizontal: 8, paddingVertical: 2 },
});
