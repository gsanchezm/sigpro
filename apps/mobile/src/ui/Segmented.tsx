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
  /** `tabs`: pestañas (`role="tablist"` con `tab` y `aria-selected`, como las de la web); por defecto un grupo de opciones. */
  readonly semantics?: 'options' | 'tabs';
}

/**
 * Conmutador segmentado (`.segmented` de la web): `--surface-2`, radio 10, y la opción activa es una pastilla `--surface` con sombra.
 * Cada opción es `role="radio"` con `aria-checked` dentro de un `role="radiogroup"` (como los chips de filtro); con
 * `semantics="tabs"`, `role="tab"` con `aria-selected` dentro de un `role="tablist"`.
 */
export const Segmented = <T extends string>({ label, options, value, onChange, testID, semantics = 'options' }: Props<T>) => {
  const { colors } = useTheme();
  const tabs = semantics === 'tabs';
  return (
    <View testID={testID} role={tabs ? 'tablist' : 'radiogroup'} aria-label={label} style={[styles.track, { backgroundColor: colors.surface2 }]}>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            testID={option.testID}
            role={tabs ? 'tab' : 'radio'}
            aria-label={option.label}
            aria-checked={tabs ? undefined : selected}
            aria-selected={tabs ? selected : undefined}
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
