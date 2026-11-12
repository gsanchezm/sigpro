import { StyleSheet, View } from 'react-native';
import { useI18n } from '../state/i18n';
import { Button } from './Button';
import { Sheet } from './Sheet';
import { Text } from './Text';

interface Props {
  readonly visible: boolean;
  readonly title: string;
  readonly message: string;
  readonly confirmLabel: string;
  /** Por defecto «Cancelar». */
  readonly cancelLabel?: string;
  /** Acción destructiva: el botón de confirmar va en rojo. */
  readonly danger?: boolean;
  readonly busy?: boolean;
  /** Fallo de la acción: se muestra dentro del diálogo, que queda abierto (como la web). */
  readonly error?: string | null;
  readonly onConfirm: () => void;
  readonly onCancel: () => void;
  /** `data-testid` del diálogo; los botones son `<testID>-confirm` y `<testID>-cancel`, y el error `<testID>-error`. */
  readonly testID: string;
}

/**
 * Diálogo de confirmación (`role="dialog"`): sustituye al `confirm()` nativo de la web, que no existe en iOS ni en Android.
 * Se cierra con «Cancelar», tocando el fondo o con Atrás (Android).
 */
export const ConfirmSheet = ({ visible, title, message, confirmLabel, cancelLabel, danger = false, busy = false, error, onConfirm, onCancel, testID }: Props) => {
  const { t } = useI18n();
  return (
    <Sheet
      visible={visible}
      title={title}
      onClose={onCancel}
      testID={testID}
      footer={
        <View style={styles.actions}>
          <Button label={cancelLabel ?? t('programas', 'cancel')} testID={`${testID}-cancel`} onPress={onCancel} disabled={busy} />
          <Button label={confirmLabel} testID={`${testID}-confirm`} variant={danger ? 'danger' : 'primary'} onPress={onConfirm} busy={busy} />
        </View>
      }
    >
      <Text variant="body" tone="muted">
        {message}
      </Text>
      {error ? (
        <Text variant="small" tone="danger" role="alert" testID={`${testID}-error`}>
          {error}
        </Text>
      ) : null}
    </Sheet>
  );
};

const styles = StyleSheet.create({
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, flexWrap: 'wrap' },
});
