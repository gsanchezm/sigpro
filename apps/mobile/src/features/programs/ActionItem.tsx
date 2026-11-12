import { StyleSheet, View } from 'react-native';
import { SPACING } from '../../theme/tokens';
import { Button, type ButtonVariant } from '../../ui/Button';
import { Text } from '../../ui/Text';

interface Props {
  /** Texto y nombre accesible de la acción (el de la web). */
  readonly label: string;
  /** `data-testid` de la acción, tomado de `@sigpro/shared`. */
  readonly testID: string;
  /** Motivo por el que el rol no puede: deshabilita la acción y se muestra como texto debajo. `null` = permitida. */
  readonly reason: string | null;
  /** `data-testid` del motivo visible (`MOVIL_PROGRAMS_DYNAMIC_TESTIDS.ACTION_REASON`). */
  readonly reasonTestID: string;
  readonly onPress: () => void;
  readonly variant?: ButtonVariant;
}

/**
 * Acción de un menú o de una barra: botón de 44 px y, si no está permitida, su motivo como texto visible (la regla de
 * testabilidad pide texto, no solo `title`). Sustituye a los `menuitem` deshabilitados de la web.
 */
export const ActionItem = ({ label, testID, reason, reasonTestID, onPress, variant = 'secondary' }: Props) => (
  <View style={styles.item}>
    <Button label={label} testID={testID} variant={variant} disabled={reason !== null} disabledReason={reason ?? undefined} onPress={onPress} />
    {reason ? (
      <Text variant="small" tone="faint" testID={reasonTestID}>
        {reason}
      </Text>
    ) : null}
  </View>
);

const styles = StyleSheet.create({
  item: { gap: SPACING.xs },
});
