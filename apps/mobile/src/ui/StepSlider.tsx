import { Pressable, StyleSheet, View } from 'react-native';
import { useTheme } from '../state/theme';
import { RADIUS } from '../theme/tokens';
import { ProgressBar } from './ProgressBar';
import { Text } from './Text';

interface Props {
  /** Nombre accesible del control (`getByRole('slider', { name })`). */
  readonly label: string;
  readonly value: number;
  readonly onChange: (value: number) => void;
  /** `data-testid` del control; los botones son `<testID>-dec` y `<testID>-inc`. */
  readonly testID: string;
  readonly min?: number;
  readonly max?: number;
  readonly step?: number;
  readonly disabled?: boolean;
  /** Texto del valor (p. ej. «45 %»); por defecto el número. */
  readonly valueText?: string;
}

const clamp = (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value));

/**
 * Deslizador por pasos (el `<input type=range>` de la web): React Native no trae uno, así que se maneja con «−» y «+»
 * (cada pulsación mueve `step`). El contenedor es `role="slider"` con `aria-valuenow/min/max`; la barra es solo de lectura.
 */
export const StepSlider = ({ label, value, onChange, testID, min = 0, max = 100, step = 5, disabled = false, valueText }: Props) => {
  const { colors } = useTheme();
  const shown = valueText ?? String(value);
  const button = (symbol: string, name: string, next: number, suffix: string, off: boolean) => (
    <Pressable
      testID={`${testID}-${suffix}`}
      role="button"
      aria-label={name}
      aria-disabled={off}
      disabled={off}
      hitSlop={6}
      onPress={() => onChange(clamp(next, min, max))}
      style={[styles.button, { backgroundColor: colors.surface, borderColor: colors.border, opacity: off ? 0.4 : 1 }]}
    >
      <Text variant="heading" aria-hidden>
        {symbol}
      </Text>
    </Pressable>
  );

  return (
    <View testID={testID} role="slider" aria-label={label} aria-valuemin={min} aria-valuemax={max} aria-valuenow={value} aria-valuetext={shown} aria-disabled={disabled} style={styles.wrap}>
      <View style={styles.head}>
        <Text variant="label" tone="muted">
          {label}
        </Text>
        <Text variant="label">{shown}</Text>
      </View>
      <View style={styles.row}>
        {button('−', `${label} −${step}`, value - step, 'dec', disabled || value <= min)}
        <View style={styles.bar}>
          <ProgressBar value={((value - min) / (max - min)) * 100} label={shown} />
        </View>
        {button('+', `${label} +${step}`, value + step, 'inc', disabled || value >= max)}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: { gap: 6 },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  bar: { flex: 1 },
  button: { width: 44, height: 44, borderRadius: RADIUS.md, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
});
