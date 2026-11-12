import { MOVIL_PROGRAMS_DYNAMIC_TESTIDS, PROGRAMAS_TESTIDS, permissionDeniedReason } from '@sigpro/shared';
import { StyleSheet, View } from 'react-native';
import { useI18n } from '../../state/i18n';
import { useTheme } from '../../state/theme';
import { RADIUS, SPACING } from '../../theme/tokens';
import { Button } from '../../ui/Button';
import { Text } from '../../ui/Text';
import { ActionItem } from './ActionItem';
import type { ProgramPermissions } from './view';

interface Props {
  readonly count: number;
  readonly permissions: ProgramPermissions;
  readonly onExport: () => void;
  readonly onArchive: () => void;
  readonly onDelete: () => void;
  readonly onClear: () => void;
}

/**
 * Barra de acciones masivas sobre la selección (`BulkBar` de la web): exportar, archivar (sin confirmar, como la web) y
 * eliminar (con diálogo). Archivar y eliminar siguen los mismos permisos; el motivo de lo que el rol no puede se ve debajo.
 */
export const ProgramsBulkBar = ({ count, permissions, onExport, onArchive, onDelete, onClear }: Props) => {
  const { t } = useI18n();
  const { colors } = useTheme();
  const archiveReason = permissions.archive ? null : t('programas', permissionDeniedReason('program.archive'));
  const deleteReason = permissions.delete ? null : t('programas', permissionDeniedReason('program.delete'));

  return (
    <View role="toolbar" aria-label={t('programas', 'bulkActions')} testID={PROGRAMAS_TESTIDS.PROGRAMS_BULK_BAR} style={[styles.bar, { borderColor: colors.accent, backgroundColor: colors.accentSoft }]}>
      <Text variant="label" testID={PROGRAMAS_TESTIDS.PROGRAMS_BULK_COUNT}>
        {`${count} ${t('programas', 'selected')}`}
      </Text>
      <View style={styles.actions}>
        <Button label={t('programas', 'exportSelection')} testID={PROGRAMAS_TESTIDS.PROGRAMS_BULK_EXPORT} onPress={onExport} />
        <ActionItem
          label={t('programas', 'archive')}
          testID={PROGRAMAS_TESTIDS.PROGRAMS_BULK_ARCHIVE}
          reason={archiveReason}
          reasonTestID={MOVIL_PROGRAMS_DYNAMIC_TESTIDS.ACTION_REASON('bulk-archive')}
          onPress={onArchive}
        />
        <ActionItem
          label={t('programas', 'delete')}
          testID={PROGRAMAS_TESTIDS.PROGRAMS_BULK_DELETE}
          variant="danger"
          reason={deleteReason}
          reasonTestID={MOVIL_PROGRAMS_DYNAMIC_TESTIDS.ACTION_REASON('bulk-delete')}
          onPress={onDelete}
        />
        <Button label={t('programas', 'clearSelection')} testID={PROGRAMAS_TESTIDS.PROGRAMS_BULK_CLEAR} variant="ghost" onPress={onClear} />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  bar: { borderWidth: 1, borderRadius: RADIUS.lg, padding: SPACING.md, gap: SPACING.sm },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm, alignItems: 'flex-start' },
});
