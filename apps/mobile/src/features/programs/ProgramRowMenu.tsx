import { MOVIL_PROGRAMS_DYNAMIC_TESTIDS, PROGRAMAS_TESTIDS, permissionDeniedReason, type Permission, type ProgramDto } from '@sigpro/shared';
import { StyleSheet, View } from 'react-native';
import { useI18n } from '../../state/i18n';
import { SPACING } from '../../theme/tokens';
import { Sheet } from '../../ui/Sheet';
import { ActionItem } from './ActionItem';
import type { ProgramPermissions } from './view';

interface Props {
  /** Programa de la fila abierta; `null` = menú cerrado. */
  readonly program: ProgramDto | null;
  readonly permissions: ProgramPermissions;
  readonly onClose: () => void;
  readonly onOpen: (code: string) => void;
  readonly onEdit: (code: string) => void;
  readonly onDuplicate: (program: ProgramDto) => void;
  readonly onArchive: (code: string) => void;
  readonly onDelete: (code: string) => void;
}

/**
 * Menú ⋯ de una fila, en una hoja inferior (`RowMenu` de la web). Las acciones que el rol no puede van deshabilitadas con su
 * motivo visible; las demás cierran la hoja y hacen su trabajo (archivar y duplicar sin confirmar, eliminar con diálogo).
 */
export const ProgramRowMenu = ({ program, permissions, onClose, onOpen, onEdit, onDuplicate, onArchive, onDelete }: Props) => {
  const { t } = useI18n();
  // Motivo de un permiso denegado, con la clave de la web (`permissionDeniedReason`); `null` si el rol puede
  const reasonOf = (allowed: boolean, permission: Permission): string | null => (allowed ? null : t('programas', permissionDeniedReason(permission)));
  const run = (action: () => void) => () => {
    onClose();
    action();
  };

  return (
    <Sheet visible={program !== null} title={t('common', 'actionsFor', { code: program?.code ?? '' })} onClose={onClose} testID={PROGRAMAS_TESTIDS.PROGRAMS_ROW_MENU}>
      {program ? (
        <View style={styles.list}>
          <ActionItem
            label={t('programas', 'viewDetail')}
            testID={PROGRAMAS_TESTIDS.PROGRAMS_ROW_MENU_VIEW}
            reason={null}
            reasonTestID={MOVIL_PROGRAMS_DYNAMIC_TESTIDS.ACTION_REASON('view')}
            onPress={run(() => onOpen(program.code))}
          />
          <ActionItem
            label={t('programas', 'edit')}
            testID={PROGRAMAS_TESTIDS.PROGRAMS_ROW_MENU_EDIT}
            reason={reasonOf(permissions.edit, 'program.edit')}
            reasonTestID={MOVIL_PROGRAMS_DYNAMIC_TESTIDS.ACTION_REASON('edit')}
            onPress={run(() => onEdit(program.code))}
          />
          <ActionItem
            label={t('programas', 'duplicate')}
            testID={PROGRAMAS_TESTIDS.PROGRAMS_ROW_MENU_DUPLICATE}
            reason={reasonOf(permissions.create, 'program.create')}
            reasonTestID={MOVIL_PROGRAMS_DYNAMIC_TESTIDS.ACTION_REASON('duplicate')}
            onPress={run(() => onDuplicate(program))}
          />
          <ActionItem
            label={t('programas', 'archive')}
            testID={PROGRAMAS_TESTIDS.PROGRAMS_ROW_MENU_ARCHIVE}
            reason={reasonOf(permissions.archive, 'program.archive')}
            reasonTestID={MOVIL_PROGRAMS_DYNAMIC_TESTIDS.ACTION_REASON('archive')}
            onPress={run(() => onArchive(program.code))}
          />
          <ActionItem
            label={t('programas', 'delete')}
            testID={PROGRAMAS_TESTIDS.PROGRAMS_ROW_MENU_DELETE}
            variant="danger"
            reason={reasonOf(permissions.delete, 'program.delete')}
            reasonTestID={MOVIL_PROGRAMS_DYNAMIC_TESTIDS.ACTION_REASON('delete')}
            onPress={run(() => onDelete(program.code))}
          />
        </View>
      ) : null}
    </Sheet>
  );
};

const styles = StyleSheet.create({
  list: { gap: SPACING.sm },
});
