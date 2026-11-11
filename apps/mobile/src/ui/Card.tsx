import { StyleSheet, View, type ViewProps } from 'react-native';
import { useTheme } from '../state/theme';
import { RADIUS } from '../theme/tokens';

interface Props extends ViewProps {
  /** Franja de color a la izquierda (p. ej. la severidad de una no conformidad). */
  readonly stripe?: string;
}

/** Tarjeta con borde y fondo del tema. Para una lista: `role="listitem"` y `aria-label` con el código de la entidad. */
export const Card = ({ stripe, style, children, ...rest }: Props) => {
  const { colors } = useTheme();
  return (
    <View
      {...rest}
      style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }, stripe ? { borderLeftColor: stripe, borderLeftWidth: 4 } : null, style]}
    >
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: RADIUS.lg, padding: 12, gap: 8 },
});
