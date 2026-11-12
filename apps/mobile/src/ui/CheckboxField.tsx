import { Pressable, StyleSheet, View } from 'react-native';
import { useTheme } from '../state/theme';
import { RADIUS } from '../theme/tokens';
import { Text } from './Text';

interface Props {
  /** Texto visible y nombre accesible de la casilla (`getByRole('checkbox', { name })`). */
  readonly label: string;
  readonly checked: boolean;
  readonly onChange: (checked: boolean) => void;
  /** `data-testid` tomado de `@sigpro/shared`. */
  readonly testID: string;
  /** Marca el campo como inválido (`aria-invalid`) y pinta el borde de error. */
  readonly invalid?: boolean;
}

/** Casilla con etiqueta (`role="checkbox"`, `aria-checked`): el `<input type=checkbox>` de la web. 44 px de alto mínimo. */
export const CheckboxField = ({ label, checked, onChange, testID, invalid = false }: Props) => {
  const { colors } = useTheme();
  const border = invalid ? colors.danger : checked ? colors.accent : colors.borderStrong;
  return (
    <Pressable testID={testID} role="checkbox" aria-label={label} aria-checked={checked} aria-invalid={invalid ? true : undefined} onPress={() => onChange(!checked)} style={styles.row}>
      <View style={[styles.box, { borderColor: border, backgroundColor: checked ? colors.accent : colors.surface }]}>
        {checked ? (
          <Text variant="small" weight="600" tone="onAccent" aria-hidden>
            ✓
          </Text>
        ) : null}
      </View>
      <Text variant="body" style={styles.label}>
        {label}
      </Text>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  row: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 10 },
  box: { width: 22, height: 22, borderWidth: 1.5, borderRadius: RADIUS.sm, alignItems: 'center', justifyContent: 'center' },
  label: { flex: 1 },
});
