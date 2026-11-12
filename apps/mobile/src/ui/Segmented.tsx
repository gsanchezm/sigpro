import { Pressable, StyleSheet, View } from 'react-native';
import { useTheme } from '../state/theme';
import { RADIUS } from '../theme/tokens';
import { Text } from './Text';

export interface SegmentedOption<T extends string> {
  readonly value: T;
  readonly label: string;
  /** `data-testid` tomado de `@sigpro/shared`. */
  readonly testID: string;
}

interface Props<T extends string> {
  /** Nombre accesible del grupo. */
  readonly label: string;
  readonly options: readonly SegmentedOption<T>[];
  readonly value: T;
  readonly onChange: (value: T) => void;
  readonly testID?: string;
}

/**
 * Conmutador segmentado (`.segmented` de la web): `--surface-2`, radio 10, y la opción activa es una pastilla `--surface` con sombra.
 * Cada opción es `role="radio"` con `aria-checked` dentro de un `role="radiogroup"` (como los chips de filtro).
 */
export const Segmented = <T extends string>({ label, options, value, onChange, testID }: Props<T>) => {
  const { colors } = useTheme();
  return (
    <View testID={testID} role="radiogroup" aria-label={label} style={[styles.track, { backgroundColor: colors.surface2 }]}>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            testID={option.testID}
            role="radio"
            aria-label={option.label}
            aria-checked={selected}
            onPress={() => onChange(option.value)}
            style={[styles.option, selected ? { backgroundColor: colors.surface, boxShadow: colors.shadow } : null]}
          >
            <Text variant="label" tone={selected ? 'default' : 'muted'}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  track: { flexDirection: 'row', borderRadius: RADIUS.md, padding: 3, gap: 2 },
  option: { flex: 1, minHeight: 38, alignItems: 'center', justifyContent: 'center', borderRadius: RADIUS.md - 3, paddingHorizontal: 8 },
});
