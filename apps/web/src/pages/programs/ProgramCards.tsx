import { PROGRAMAS_TESTIDS, RESPONSIVE_DYNAMIC_TESTIDS, RESPONSIVE_TESTIDS, can, formatDate, permissionDeniedReason, type Permission, type ProgramDto, type Role } from '@sigpro/shared';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useI18n } from '../../state/i18n';
import { ActionSheet, type SheetAction } from '../../ui/ActionSheet';
import { DotsIcon } from '../../ui/icons';
import { ProgressBar } from '../../ui/ProgressBar';
import { StatusBadge } from '../../ui/StatusBadge';

interface CardsProps {
  readonly rows: readonly ProgramDto[];
  readonly loading: boolean;
  readonly showSkeleton: boolean;
  readonly role: Role;
  readonly onEdit: (program: ProgramDto) => void;
  readonly onDuplicate: (program: ProgramDto) => void;
  readonly onArchive: (program: ProgramDto) => void;
  readonly onDelete: (program: ProgramDto) => void;
}

interface CardMenuProps {
  readonly program: ProgramDto;
  readonly role: Role;
  readonly onEdit: (program: ProgramDto) => void;
  readonly onDuplicate: (program: ProgramDto) => void;
  readonly onArchive: (program: ProgramDto) => void;
  readonly onDelete: (program: ProgramDto) => void;
}

/** Botón ⋯ de la tarjeta: abre la hoja inferior con las mismas acciones que el menú de la fila de escritorio. */
const CardMenu = ({ program, role, onEdit, onDuplicate, onArchive, onDelete }: CardMenuProps) => {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const label = t('common', 'actionsFor', { code: program.code });
  const gate = (permission: Permission) => ({ disabled: !can(role, permission), title: can(role, permission) ? undefined : t('programas', permissionDeniedReason(permission)) });

  const actions: readonly SheetAction[] = [
    { key: 'view', label: t('programas', 'viewDetail'), testId: RESPONSIVE_TESTIDS.PROGRAMS_ROW_MENU_VIEW, to: `/programs/${program.code}` },
    { key: 'edit', label: t('programas', 'edit'), testId: RESPONSIVE_TESTIDS.PROGRAMS_ROW_MENU_EDIT, onSelect: () => onEdit(program), ...gate('program.edit') },
    { key: 'duplicate', label: t('programas', 'duplicate'), testId: RESPONSIVE_TESTIDS.PROGRAMS_ROW_MENU_DUPLICATE, onSelect: () => onDuplicate(program), ...gate('program.create') },
    { key: 'archive', label: t('programas', 'archive'), testId: RESPONSIVE_TESTIDS.PROGRAMS_ROW_MENU_ARCHIVE, onSelect: () => onArchive(program), ...gate('program.archive') },
    { key: 'delete', label: t('programas', 'delete'), testId: RESPONSIVE_TESTIDS.PROGRAMS_ROW_MENU_DELETE, onSelect: () => onDelete(program), danger: true, ...gate('program.delete') },
  ];

  return (
    <>
      <button
        type="button"
        data-testid={RESPONSIVE_DYNAMIC_TESTIDS.PROGRAMS_ROW_MENU(program.code)}
        aria-label={label}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(true)}
        className="grid size-11 cursor-pointer place-items-center rounded-ctl border-0 bg-transparent text-fg-2 hover:bg-surface-2"
      >
        <DotsIcon size={16} />
      </button>
      {open ? (
        <ActionSheet title={label} testId={RESPONSIVE_TESTIDS.PROGRAMS_ROW_MENU} closeTestId={RESPONSIVE_TESTIDS.PROGRAMS_ROW_MENU_CLOSE} closeLabel={t('programas', 'rowActionsClose')} actions={actions} onClose={() => setOpen(false)} />
      ) : null}
    </>
  );
};

/**
 * Lista de programas del DISEÑO RESPONSIVE (< 1024 px): una tarjeta (`listitem`) por programa, con el ⋯ que abre la hoja
 * de acciones. En escritorio se monta `ProgramsTable` (filas de tabla con selección múltiple y panel lateral).
 */
export const ProgramCards = ({ rows, loading, showSkeleton, role, onEdit, onDuplicate, onArchive, onDelete }: CardsProps) => {
  const { t, lang } = useI18n();
  return (
    <ul aria-label={t('programas', 'programs')} aria-busy={loading} aria-describedby="programs-count" data-testid={RESPONSIVE_TESTIDS.PROGRAMS_TABLE} className="m-0 flex list-none flex-col gap-2 p-0">
      {showSkeleton
        ? Array.from({ length: 4 }, (_, index) => <li key={index} data-testid={PROGRAMAS_TESTIDS.SKELETON_ROW} aria-hidden="true" className="skeleton h-[84px] !rounded-card" />)
        : rows.map((program) => (
            <li key={program.code} data-testid={RESPONSIVE_DYNAMIC_TESTIDS.PROGRAMS_ROW(program.code)} data-code={program.code} className="relative rounded-card border border-border bg-surface">
              <Link
                to={`/programs/${program.code}`}
                data-testid={RESPONSIVE_DYNAMIC_TESTIDS.PROGRAMS_LINK(program.code)}
                className="flex min-h-11 flex-col gap-2 p-3 pr-14 !text-fg no-underline"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-[12px] font-medium">{program.code}</span>
                  <StatusBadge status={program.status} />
                </div>
                <div className="leading-[1.3] font-medium">{program.name}</div>
                <div className="flex items-center justify-between gap-2 text-[11.5px] text-fg-2">
                  <span>{program.ownerName}</span>
                  <span className="font-mono">{formatDate(program.startDate, lang)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <ProgressBar
                    percent={program.progress}
                    label={t('common', 'progressLabel', { code: program.code, percent: program.progress })}
                    cancelled={program.status === 'cancelled'}
                    heightClass="h-[5px]"
                  />
                  <span className="w-8 text-right font-mono text-[11px]">{program.progress}%</span>
                </div>
              </Link>
              <div className="absolute top-1 right-1">
                <CardMenu program={program} role={role} onEdit={onEdit} onDuplicate={onDuplicate} onArchive={onArchive} onDelete={onDelete} />
              </div>
            </li>
          ))}
    </ul>
  );
};
