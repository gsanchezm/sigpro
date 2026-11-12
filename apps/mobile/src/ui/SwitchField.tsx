import { StyleSheet, Switch, View } from 'react-native';
import { useTheme } from '../state/theme';
import { Text } from './Text';

interface Props {
  /** Etiqueta visible y nombre accesible. */
  readonly label: string;
  readonly value: boolean;
  readonly onChange: (value: boolean) => void;
  readonly testID: string;
  readonly disabled?: boolean;
  /** Texto de ayuda bajo la etiqueta. */
  readonly hint?: string;
}

/** Interruptor con etiqueta (`role="switch"`, `aria-checked`): el `<input type=checkbox role=switch>` de la web. */
export const SwitchField = ({ label, value, onChange, testID, disabled = false, hint }: Props) => {
  const { colors } = useTheme();
  return (
    <View style={styles.row}>
      <View style={styles.text}>
        <Text variant="label">{label}</Text>
        {hint ? (
          <Text variant="small" tone="faint">
            {hint}
          </Text>
        ) : null}
      </View>
      <Switch
        testID={testID}
        role="switch"
        aria-label={label}
        aria-checked={value}
        aria-disabled={disabled}
        value={value}
        disabled={disabled}
        onValueChange={onChange}
        trackColor={{ false: colors.borderStrong, true: colors.accent }}
        thumbColor={colors.surface}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, minHeight: 44 },
  text: { flex: 1, gap: 2 },
});
