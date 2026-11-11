import { Pressable, StyleSheet } from 'react-native';
import { useTheme } from '../state/theme';
import { RADIUS } from '../theme/tokens';
import { Text } from './Text';

interface Props {
  /** Texto visible y nombre accesible (cambia con el estado, como los botones de la web). */
  readonly label: string;
  /** Estado activado: se pinta como `aria-pressed`. */
  readonly pressed: boolean;
  readonly onPress: () => void;
  /** `data-testid` tomado de `@sigpro/shared`. */
  readonly testID: string;
}

/** Botón de alternancia con `role="button"` y `aria-pressed` (pausa del feed, vista tabla/gráfica). 44 px de alto mínimo. */
export const ToggleButton = ({ label, pressed, onPress, testID }: Props) => {
  const { colors } = useTheme();
  return (
    <Pressable
      testID={testID}
      role="button"
      aria-label={label}
      aria-pressed={pressed}
      onPress={onPress}
      style={({ pressed: isPressed }) => [
        styles.base,
        { backgroundColor: pressed ? colors.accentSoft : colors.surface, borderColor: pressed ? colors.accent : colors.borderStrong, opacity: isPressed ? 0.85 : 1 },
      ]}
    >
      <Text variant="label" tone="accent">
        {label}
      </Text>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  base: { minHeight: 44, minWidth: 44, justifyContent: 'center', paddingHorizontal: 12, borderRadius: RADIUS.md, borderWidth: 1 },
});
