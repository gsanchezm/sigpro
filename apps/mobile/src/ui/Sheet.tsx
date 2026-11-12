import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, View } from 'react-native';
import { useI18n } from '../state/i18n';
import { useTheme } from '../state/theme';
import { Button } from './Button';
import { Text } from './Text';

interface Props {
  readonly visible: boolean;
  readonly title: string;
  readonly onClose: () => void;
  /** `data-testid` del panel. */
  readonly testID: string;
  /** `data-testid` del botón «Cerrar» por defecto (obligatorio si no se pasa `footer`). */
  readonly closeTestID?: string;
  /** Sustituye al botón «Cerrar» (acciones de un formulario o de una confirmación). */
  readonly footer?: ReactNode;
  readonly children: ReactNode;
}

/**
 * Hoja inferior modal (`role="dialog"`, `aria-modal`): la alternativa móvil a los menús ⋯ y a los modales de la web.
 * Se cierra con el botón «Cerrar», tocando el fondo o con Atrás (Android).
 */
export const Sheet = ({ visible, title, onClose, testID, closeTestID, footer, children }: Props) => {
  const { colors } = useTheme();
  const { t } = useI18n();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={[styles.scrim, { backgroundColor: colors.scrim }]}>
        <Pressable aria-hidden style={StyleSheet.absoluteFill} onPress={onClose} />
        <View testID={testID} role="dialog" aria-modal aria-label={title} style={[styles.sheet, { backgroundColor: colors.surface, borderColor: colors.border, boxShadow: colors.shadowPop }]}>
          <Text variant="heading">{title}</Text>
          <View style={styles.body}>{children}</View>
          {footer ?? <Button label={t('programas', 'close')} testID={closeTestID ?? `${testID}-close`} onPress={onClose} />}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  scrim: { flex: 1, justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 16, borderTopRightRadius: 16, borderWidth: 1, padding: 16, gap: 12, maxHeight: '85%' },
  body: { gap: 8 },
});
