import { ActivityIndicator, Pressable, StyleSheet } from 'react-native';
import { useTheme } from '../state/theme';
import { RADIUS } from '../theme/tokens';
import { Text } from './Text';

export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';

interface Props {
  readonly label: string;
  readonly onPress: () => void;
  /** `data-testid` en la web (tomado de `@sigpro/shared`, nunca un literal). */
  readonly testID: string;
  readonly variant?: ButtonVariant;
  readonly disabled?: boolean;
  /** Motivo de un botón deshabilitado: React Native no tiene `title`. Va en `data-reason` (web) y en `aria-description` (nativo); el que lo usa debe mostrarlo también como texto visible. */
  readonly disabledReason?: string;
  readonly busy?: boolean;
  /** Nombre accesible si difiere del texto visible (p. ej. «Acciones para NC-001»). */
  readonly accessibilityLabel?: string;
}

/** Botón con `role="button"`, nombre accesible y 44 px de alto mínimo (objetivo táctil). */
export const Button = ({ label, onPress, testID, variant = 'secondary', disabled = false, disabledReason, busy = false, accessibilityLabel }: Props) => {
  const { colors } = useTheme();
  const palette: Readonly<Record<ButtonVariant, { bg: string; fg: string; border: string }>> = {
    primary: { bg: colors.accent, fg: colors.onAccent, border: colors.accent },
    secondary: { bg: colors.surface, fg: colors.text, border: colors.borderStrong },
    danger: { bg: colors.danger, fg: colors.onAccent, border: colors.danger },
    ghost: { bg: 'transparent', fg: colors.accent, border: 'transparent' },
  };
  const style = palette[variant];
  const inactive = disabled || busy;
  return (
    <Pressable
      testID={testID}
      role="button"
      aria-label={accessibilityLabel ?? label}
      aria-disabled={inactive}
      aria-busy={busy}
      aria-description={disabled ? disabledReason : undefined}
      dataSet={{ reason: disabled ? disabledReason : undefined }}
      disabled={inactive}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        { backgroundColor: style.bg, borderColor: style.border, opacity: inactive ? 0.5 : pressed ? 0.85 : 1 },
      ]}
    >
      {busy ? <ActivityIndicator size="small" color={style.fg} /> : null}
      <Text variant="label" style={{ color: style.fg }}>
        {label}
      </Text>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  base: {
    minHeight: 44,
    paddingHorizontal: 16,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
});
