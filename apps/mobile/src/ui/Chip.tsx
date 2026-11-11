import { Pressable, StyleSheet } from 'react-native';
import { useTheme } from '../state/theme';
import { RADIUS } from '../theme/tokens';
import { Text } from './Text';

interface Props {
  readonly label: string;
  readonly selected: boolean;
  readonly onPress: () => void;
  readonly testID: string;
}

/**
 * Chip de filtro de selección única: `role="radio"` con `aria-checked` (dentro de un contenedor `role="radiogroup"`).
 * Se localiza con `getByRole('radio', { name })`.
 */
export const Chip = ({ label, selected, onPress, testID }: Props) => {
  const { colors } = useTheme();
  return (
    <Pressable
      testID={testID}
      role="radio"
      aria-label={label}
      aria-checked={selected}
      onPress={onPress}
      style={[styles.chip, { backgroundColor: selected ? colors.accentSoft : colors.surface, borderColor: selected ? colors.accent : colors.borderStrong }]}
    >
      <Text variant="label" tone={selected ? 'accent' : 'muted'}>
        {label}
      </Text>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  chip: { minHeight: 36, justifyContent: 'center', paddingHorizontal: 12, borderRadius: RADIUS.pill, borderWidth: 1 },
});
