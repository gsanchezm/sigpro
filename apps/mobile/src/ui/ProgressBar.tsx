import { StyleSheet, View } from 'react-native';
import { useTheme } from '../state/theme';
import { RADIUS } from '../theme/tokens';

interface Props {
  /** 0–100. */
  readonly value: number;
  /** Nombre accesible y texto del valor, p. ej. «11 % completado». */
  readonly label: string;
  readonly testID?: string;
}

/** Barra de progreso con `role="progressbar"` y `aria-valuenow` (regla de testabilidad). */
export const ProgressBar = ({ value, label, testID }: Props) => {
  const { colors } = useTheme();
  const clamped = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <View
      testID={testID}
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={clamped}
      aria-valuetext={label}
      style={[styles.track, { backgroundColor: colors.neutralSoft }]}
    >
      <View style={[styles.fill, { width: `${clamped}%`, backgroundColor: colors.accent }]} />
    </View>
  );
};

const styles = StyleSheet.create({
  track: { height: 6, borderRadius: RADIUS.pill, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: RADIUS.pill },
});
