import { PROGRAMAS_TESTIDS, can, permissionDeniedReason, type Role } from '@sigpro/shared';
import { useI18n } from '../../state/i18n';

interface BulkBarProps {
  readonly count: number;
  readonly role: Role;
  readonly onExport: () => void;
  readonly onArchive: () => void;
  readonly onDelete: () => void;
  readonly onClear: () => void;
}

const small = 'btn btn-secondary !h-[26px] !px-2.5 !text-[12px]';

/** Barra de acciones masivas sobre la selección (exportar, archivar, eliminar). */
export const BulkBar = ({ count, role, onExport, onArchive, onDelete, onClear }: BulkBarProps) => {
  const { t } = useI18n();
  const canArchive = can(role, 'program.archive');
  const canDelete = can(role, 'program.delete');
  return (
    <div
      role="toolbar"
      aria-label={t('programas', 'bulkActions')}
      data-testid={PROGRAMAS_TESTIDS.PROGRAMS_BULK_BAR}
      className="flex flex-wrap items-center gap-2 rounded-card border border-accent bg-accent-soft px-3 py-2"
    >
      <span data-testid={PROGRAMAS_TESTIDS.PROGRAMS_BULK_COUNT} className="text-[12.5px] font-medium">
        {count} {t('programas', 'selected')}
      </span>
      <div className="flex-1" />
      <button type="button" data-testid={PROGRAMAS_TESTIDS.PROGRAMS_BULK_EXPORT} onClick={onExport} className={small}>
        {t('programas', 'exportSelection')}
      </button>
      <button
        type="button"
        data-testid={PROGRAMAS_TESTIDS.PROGRAMS_BULK_ARCHIVE}
        onClick={onArchive}
        disabled={!canArchive}
        title={canArchive ? undefined : t('programas', permissionDeniedReason('program.archive'))}
        className={small}
      >
        {t('programas', 'archive')}
      </button>
      <button
        type="button"
        data-testid={PROGRAMAS_TESTIDS.PROGRAMS_BULK_DELETE}
        onClick={onDelete}
        disabled={!canDelete}
        title={canDelete ? undefined : t('programas', permissionDeniedReason('program.delete'))}
        className="btn btn-danger-outline !h-[26px] !px-2.5 !text-[12px]"
      >
        {t('programas', 'delete')}
      </button>
      <button
        type="button"
        data-testid={PROGRAMAS_TESTIDS.PROGRAMS_BULK_CLEAR}
        aria-label={t('programas', 'clearSelection')}
        onClick={onClear}
        className="size-[26px] cursor-pointer rounded-ctl border-0 bg-transparent text-base leading-none text-fg-2"
      >
        ×
      </button>
    </div>
  );
};
