import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTheme } from '../state/theme';
import { RADIUS, SPACING } from '../theme/tokens';
import { ProgressBar } from './ProgressBar';
import { Text } from './Text';

interface Props {
  /** `data-testid` tomado de `@sigpro/shared` (los mismos ids que la tarjeta de la web). */
  readonly testID: string;
  readonly label: string;
  readonly value: string;
  readonly aux: string;
  /** Si se indica, la tarjeta lleva una barra de progreso de 6 px con `aria-valuenow`. */
  readonly percent?: number;
}

/** Tarjeta de métrica del design system: etiqueta, cifra grande, barra opcional y línea auxiliar. Un grupo con nombre accesible. */
export const Metric = ({ testID, label, value, aux, percent }: Props) => {
  const { colors } = useTheme();
  return (
    <View testID={testID} role="group" aria-label={label} style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border, boxShadow: colors.shadow }]}>
      <Text variant="label" tone="muted" numberOfLines={2}>
        {label}
      </Text>
      <Text variant="metric">{value}</Text>
      {percent === undefined ? null : <ProgressBar value={percent} label={`${percent} %`} />}
      <Text variant="small" tone="faint" numberOfLines={2}>
        {aux}
      </Text>
    </View>
  );
};

/** Rejilla de 2 columnas para un grupo de tarjetas de métricas (4 en una fila no caben a 390 px). */
export const MetricGrid = ({ testID, label, busy, children }: { readonly testID: string; readonly label: string; readonly busy?: boolean; readonly children: ReactNode }) => (
  <View testID={testID} role="group" aria-label={label} aria-busy={busy} style={styles.grid}>
    {children}
  </View>
);

const styles = StyleSheet.create({
  // `flexBasis` por debajo del 50 % para que quepan dos por fila con el hueco (gap) entre ellas
  card: { flexBasis: '47%', flexGrow: 1, borderWidth: 1, borderRadius: RADIUS.lg, padding: SPACING.md, gap: 6 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.md },
});
