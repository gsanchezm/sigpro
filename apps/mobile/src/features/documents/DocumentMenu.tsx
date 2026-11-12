import { DOCUMENTOS_TESTIDS } from '@sigpro/shared';
import { StyleSheet, View } from 'react-native';
import { useI18n } from '../../state/i18n';
import { SPACING } from '../../theme/tokens';
import { Button } from '../../ui/Button';
import { Sheet } from '../../ui/Sheet';

interface Props {
  /** Código del documento de la fila abierta; `null` = menú cerrado. */
  readonly id: string | null;
  readonly onClose: () => void;
  readonly onView: (id: string) => void;
  /** Descarga el PDF de la última versión. */
  readonly onDownload: (id: string) => void;
}

/**
 * Menú ⋯ de una fila de la lista, en una hoja inferior (`RowMenuButton` de la web): ver el documento y descargar el PDF de su
 * última versión. «Abrir en nueva pestaña» no existe en el móvil (no hay pestañas del navegador). Cada acción cierra la hoja
 * y hace su trabajo.
 */
export const DocumentMenu = ({ id, onClose, onView, onDownload }: Props) => {
  const { t } = useI18n();
  const run = (action: (code: string) => void) => () => {
    if (id === null) return;
    onClose();
    action(id);
  };
  return (
    <Sheet visible={id !== null} title={t('documentos', 'rowActions', { code: id ?? '' })} onClose={onClose} testID={DOCUMENTOS_TESTIDS.DOCUMENT_MENU}>
      <View style={styles.list}>
        <Button label={t('documentos', 'menuView')} testID={DOCUMENTOS_TESTIDS.DOCUMENT_MENU_VIEW} onPress={run(onView)} />
        <Button label={t('documentos', 'menuDownload')} testID={DOCUMENTOS_TESTIDS.DOCUMENT_MENU_DOWNLOAD} onPress={run(onDownload)} />
      </View>
    </Sheet>
  );
};

const styles = StyleSheet.create({
  list: { gap: SPACING.sm },
});
