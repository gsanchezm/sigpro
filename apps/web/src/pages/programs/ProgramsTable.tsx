import {
  PROGRAMAS_DYNAMIC_TESTIDS,
  PROGRAMAS_TESTIDS,
  formatDate,
  formatMoney,
  type ProgramDto,
  type ProgramSortColumn,
  type Role,
} from '@sigpro/shared';
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useI18n } from '../../state/i18n';
import { Avatar } from '../../ui/Avatar';
import { ProgressBar } from '../../ui/ProgressBar';
import { StatusBadge } from '../../ui/StatusBadge';
import type { ListState } from './params';
import { RowMenu } from './RowMenu';

interface TableProps {
  readonly rows: readonly ProgramDto[];
  readonly loading: boolean;
  readonly showSkeleton: boolean;
  readonly state: ListState;
  readonly role: Role;
  readonly selected: readonly string[];
  readonly onSort: (column: ProgramSortColumn) => void;
  readonly onToggle: (code: string) => void;
  readonly onToggleAll: () => void;
  readonly onEdit: (program: ProgramDto) => void;
  readonly onDuplicate: (program: ProgramDto) => void;
  readonly onArchive: (program: ProgramDto) => void;
  readonly onDelete: (program: ProgramDto) => void;
}

interface Column {
  readonly key: ProgramSortColumn | 'progress';
  readonly width?: number;
  readonly right?: boolean;
}

const COLUMNS: readonly Column[] = [
  { key: 'code', width: 100 },
  { key: 'name' },
  { key: 'status', width: 120 },
  { key: 'owner', width: 170 },
  { key: 'dates', width: 200 },
  { key: 'budget', width: 120, right: true },
  { key: 'progress', width: 160 },
];

const SKELETON_ROWS = 6;
const skeleton = (className: string) => <span className={`skeleton ${className}`} />;

/** Cabecera "Avance" con botón "i" y tooltip (hover y foco). */
const ProgressHeader = ({ label }: { label: string }) => {
  const { t } = useI18n();
  const [tip, setTip] = useState(false);
  return (
    <span className="relative inline-flex items-center gap-1.5">
      {label}
      <button
        type="button"
        data-testid={PROGRAMAS_TESTIDS.PROGRAMS_PROGRESS_INFO}
        aria-label={t('programas', 'progressHelp')}
        aria-describedby="tip-progress"
        onMouseEnter={() => setTip(true)}
        onMouseLeave={() => setTip(false)}
        onFocus={() => setTip(true)}
        onBlur={() => setTip(false)}
        className="grid size-4 cursor-help place-items-center rounded-full border border-border-strong bg-transparent p-0 text-[10px] text-fg-2"
      >
        i
      </button>
      {tip ? (
        <span
          role="tooltip"
          id="tip-progress"
          data-testid={PROGRAMAS_TESTIDS.PROGRAMS_PROGRESS_TOOLTIP}
          className="absolute top-6 right-0 z-[15] rounded-ctl-sm bg-fg px-2 py-[5px] text-[11.5px] font-normal tracking-normal whitespace-nowrap text-bg normal-case"
        >
          {t('programas', 'progressHelp')}
        </span>
      ) : null}
    </span>
  );
};

/** Tabla de programas (≥ 640 px): orden por columna con aria-sort, selección múltiple, menú ⋯ por fila. */
export const ProgramsTable = ({ rows, loading, showSkeleton, state, role, selected, onSort, onToggle, onToggleAll, onEdit, onDuplicate, onArchive, onDelete }: TableProps) => {
  const { t, lang } = useI18n();
  const selectAllRef = useRef<HTMLInputElement>(null);
  const allSelected = rows.length > 0 && rows.every((row) => selected.includes(row.code));
  const someSelected = rows.some((row) => selected.includes(row.code));

  useEffect(() => {
    if (selectAllRef.current) selectAllRef.current.indeterminate = someSelected && !allSelected;
  }, [someSelected, allSelected]);

  const headerLabels: Readonly<Record<Column['key'], string>> = {
    code: t('programas', 'code'),
    name: t('programas', 'name'),
    status: t('programas', 'status'),
    owner: t('programas', 'owner'),
    dates: t('programas', 'dates'),
    budget: t('programas', 'budget'),
    progress: t('common', 'progressColumn'),
  };

  return (
    <div className="overflow-x-auto">
      <table
        data-testid={PROGRAMAS_TESTIDS.PROGRAMS_TABLE}
        aria-busy={loading}
        aria-describedby="programs-count"
        className="data-table w-full min-w-[860px] border-collapse text-[12.5px]"
      >
        <thead>
          <tr className="border-b border-border">
            <th scope="col" className="w-9 py-0 pr-2 pl-3 text-left">
              <input
                ref={selectAllRef}
                type="checkbox"
                data-testid={PROGRAMAS_TESTIDS.PROGRAMS_SELECT_ALL}
                aria-label={t('programas', 'selectAll')}
                checked={allSelected}
                onChange={onToggleAll}
                disabled={loading && rows.length === 0}
                title={loading && rows.length === 0 ? t('common', 'loading') : undefined}
                className="m-0 size-3.5 align-middle accent-accent"
              />
            </th>
            {COLUMNS.map((column) => {
              const active = state.sort === column.key;
              const sortable = column.key !== 'progress';
              return (
                <th
                  key={column.key}
                  scope="col"
                  aria-sort={sortable ? (active ? (state.dir === 'asc' ? 'ascending' : 'descending') : 'none') : undefined}
                  className={`h-9 px-2 text-[11.5px] font-medium tracking-[.04em] whitespace-nowrap uppercase ${column.right ? 'text-right' : 'text-left'} ${active ? 'text-fg' : 'text-fg-2'}`}
                  style={{ width: column.width }}
                >
                  {sortable ? (
                    <button
                      type="button"
                      data-testid={PROGRAMAS_DYNAMIC_TESTIDS.PROGRAMS_SORT(column.key as ProgramSortColumn)}
                      onClick={() => onSort(column.key as ProgramSortColumn)}
                      className="inline-flex cursor-pointer items-center gap-1 border-0 bg-transparent p-0 tracking-[inherit] text-inherit uppercase hover:text-fg"
                    >
                      {headerLabels[column.key]}
                      <span aria-hidden="true" className="text-[11px]" style={{ color: active ? 'var(--accent)' : 'var(--text-3)' }}>
                        {active ? (state.dir === 'asc' ? '↑' : '↓') : '↕'}
                      </span>
                    </button>
                  ) : (
                    <ProgressHeader label={headerLabels.progress} />
                  )}
                </th>
              );
            })}
            <th scope="col" className="w-11">
              <span className="sr-only">{t('programas', 'actions')}</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {showSkeleton
            ? Array.from({ length: SKELETON_ROWS }, (_, index) => (
                <tr key={`skeleton-${index}`} data-testid={PROGRAMAS_TESTIDS.SKELETON_ROW} aria-hidden="true" className="h-10 border-b border-border">
                  <td className="py-0 pr-2 pl-3">{skeleton('size-3.5')}</td>
                  <td className="px-2">{skeleton('h-3 w-[60px]')}</td>
                  <td className="px-2">
                    <span className="skeleton h-3" style={{ width: `${55 + ((index * 17) % 40)}%` }} />
                  </td>
                  <td className="px-2">{skeleton('h-5 w-16 !rounded-ctl')}</td>
                  <td className="px-2">{skeleton('h-3 w-[110px]')}</td>
                  <td className="px-2">{skeleton('h-3 w-[150px]')}</td>
                  <td className="px-2">{skeleton('ml-auto h-3 w-20')}</td>
                  <td className="px-2">{skeleton('h-1.5 w-[100px]')}</td>
                  <td />
                </tr>
              ))
            : rows.map((program) => {
                const isSelected = selected.includes(program.code);
                return (
                  <tr
                    key={program.code}
                    data-testid={PROGRAMAS_DYNAMIC_TESTIDS.PROGRAMS_ROW(program.code)}
                    data-code={program.code}
                    aria-selected={isSelected}
                    className={`h-10 border-b border-border hover:bg-surface-2 ${isSelected ? 'bg-accent-soft' : ''}`}
                  >
                    <td className="py-0 pr-2 pl-3">
                      <input
                        type="checkbox"
                        data-testid={PROGRAMAS_DYNAMIC_TESTIDS.PROGRAMS_SELECT(program.code)}
                        aria-label={t('common', 'selectRow', { code: program.code })}
                        checked={isSelected}
                        onChange={() => onToggle(program.code)}
                        className="m-0 size-3.5 align-middle accent-accent"
                      />
                    </td>
                    <td className="px-2 font-mono font-medium whitespace-nowrap">
                      <Link to={`/programs/${program.code}`} data-testid={PROGRAMAS_DYNAMIC_TESTIDS.PROGRAMS_LINK(program.code)} className="rounded-[2px] no-underline hover:underline">
                        {program.code}
                      </Link>
                    </td>
                    <td className="max-w-[320px] px-2">
                      <div className="truncate" title={program.name}>
                        {program.name}
                      </div>
                    </td>
                    <td className="px-2">
                      <StatusBadge status={program.status} />
                    </td>
                    <td className="px-2 whitespace-nowrap">
                      <span className="inline-flex items-center gap-1.5">
                        <Avatar name={program.ownerName} size={20} fontPx={9} shape="circle" />
                        {program.ownerName}
                      </span>
                    </td>
                    <td className="px-2 font-mono text-[12px] whitespace-nowrap text-fg-2">
                      {formatDate(program.startDate, lang)} → {formatDate(program.endDate, lang)}
                    </td>
                    <td className="px-2 text-right font-mono text-[12px] whitespace-nowrap">{formatMoney(program.budgetEur, lang)}</td>
                    <td className="min-w-[140px] px-2">
                      <div className="flex items-center gap-2">
                        <ProgressBar percent={program.progress} label={t('common', 'progressLabel', { code: program.code, percent: program.progress })} cancelled={program.status === 'cancelled'} />
                        <span className="w-8 text-right font-mono text-[11.5px]">{program.progress}%</span>
                      </div>
                    </td>
                    <td className="px-2">
                      <RowMenu program={program} role={role} onEdit={onEdit} onDuplicate={onDuplicate} onArchive={onArchive} onDelete={onDelete} />
                    </td>
                  </tr>
                );
              })}
        </tbody>
      </table>
    </div>
  );
};
