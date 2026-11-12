import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useI18n } from '../state/i18n';
import { Button } from './Button';
import { Sheet } from './Sheet';

interface Props {
  readonly visible: boolean;
  readonly title: string;
  readonly submitLabel: string;
  readonly onSubmit: () => void;
  readonly onClose: () => void;
  readonly busy?: boolean;
  /** Si es `true`, «Guardar» queda deshabilitado (usa `submitDisabledReason` para explicar por qué, regla de testabilidad). */
  readonly submitDisabled?: boolean;
  readonly submitDisabledReason?: string;
  /** Por defecto «Cancelar». */
  readonly cancelLabel?: string;
  /** `data-testid` del diálogo; los botones son `<testID>-submit` y `<testID>-cancel` salvo que se indiquen los suyos. */
  readonly testID: string;
  /** Ids propios de los botones (los de la web, p. ej. `requirement-new-submit`). */
  readonly submitTestID?: string;
  readonly cancelTestID?: string;
  readonly children: ReactNode;
}

/**
 * Formulario en una hoja modal (`role="dialog"`): la alternativa móvil a los diálogos y asistentes de la web. El cuerpo hace
 * scroll (el teclado empuja la hoja) y las acciones quedan fijas abajo: «Cancelar» y la principal.
 */
export const FormDialog = ({
  visible,
  title,
  submitLabel,
  onSubmit,
  onClose,
  busy = false,
  submitDisabled = false,
  submitDisabledReason,
  cancelLabel,
  testID,
  submitTestID,
  cancelTestID,
  children,
}: Props) => {
  const { t } = useI18n();
  return (
    <Sheet
      visible={visible}
      title={title}
      onClose={onClose}
      testID={testID}
      footer={
        <View style={styles.actions}>
          <Button label={cancelLabel ?? t('programas', 'cancel')} testID={cancelTestID ?? `${testID}-cancel`} onPress={onClose} disabled={busy} />
          <Button
            label={submitLabel}
            testID={submitTestID ?? `${testID}-submit`}
            variant="primary"
            onPress={onSubmit}
            busy={busy}
            disabled={submitDisabled}
            disabledReason={submitDisabledReason}
          />
        </View>
      }
    >
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {children}
      </ScrollView>
    </Sheet>
  );
};

const styles = StyleSheet.create({
  scroll: { flexShrink: 1 },
  content: { gap: 12, paddingBottom: 4 },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, flexWrap: 'wrap' },
});
