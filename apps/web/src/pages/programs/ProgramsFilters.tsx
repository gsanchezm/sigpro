import { PROGRAM_STATUSES, PROGRAMAS_TESTIDS, type OwnerDto } from '@sigpro/shared';
import { useI18n } from '../../state/i18n';
import { OwnerCombobox } from '../../ui/OwnerCombobox';
import { hasActiveFilters, withFilter, type ListState } from './params';

interface FiltersProps {
  readonly state: ListState;
  readonly owners: readonly OwnerDto[];
  readonly mobile: boolean;
  readonly search: string;
  readonly onSearch: (value: string) => void;
  readonly onChange: (next: ListState) => void;
  readonly onClear: () => void;
}

const labelClass = 'text-[11.5px] font-medium text-fg-2';
const filterControl = 'input input-filter';

/** Filtros: estado, rango de fechas, responsable (combobox) y limpiar. En móvil añade el buscador a ancho completo. */
export const ProgramsFilters = ({ state, owners, mobile, search, onSearch, onChange, onClear }: FiltersProps) => {
  const { t } = useI18n();
  const statusLabels = { draft: t('programas', 'st_draft'), active: t('programas', 'st_active'), on_hold: t('programas', 'st_on_hold'), closed: t('programas', 'st_closed'), cancelled: t('programas', 'st_cancelled') } as const;

  return (
    <div role="search" aria-label={t('programas', 'filters')} data-testid={PROGRAMAS_TESTIDS.PROGRAMS_FILTERS} className="flex flex-wrap items-end gap-2">
      {mobile ? (
        <div className="relative flex-[1_1_100%]">
          <input
            type="search"
            data-testid={PROGRAMAS_TESTIDS.PROGRAMS_SEARCH}
            aria-label={t('programas', 'searchPrograms')}
            placeholder={t('programas', 'searchPlaceholder')}
            value={search}
            onChange={(event) => onSearch(event.target.value)}
            className="input !bg-surface"
            style={{ borderColor: 'var(--border)' }}
          />
        </div>
      ) : null}
      <div className="flex max-w-[200px] flex-[1_1_140px] flex-col gap-[3px]">
        <label htmlFor="programs-filter-status" className={labelClass}>
          {t('programas', 'status')}
        </label>
        <select
          id="programs-filter-status"
          data-testid={PROGRAMAS_TESTIDS.PROGRAMS_FILTER_STATUS}
          value={state.status}
          onChange={(event) => onChange(withFilter(state, { status: event.target.value as ListState['status'] }))}
          className={filterControl}
        >
          <option value="">{t('programas', 'allStatuses')}</option>
          {PROGRAM_STATUSES.map((status) => (
            <option key={status} value={status}>
              {statusLabels[status]}
            </option>
          ))}
        </select>
      </div>
      <div className="flex max-w-[180px] flex-[1_1_150px] flex-col gap-[3px]">
        <label htmlFor="programs-filter-date-from" className={labelClass}>
          {t('programas', 'startFrom')}
        </label>
        <input
          id="programs-filter-date-from"
          type="date"
          data-testid={PROGRAMAS_TESTIDS.PROGRAMS_FILTER_DATE_FROM}
          value={state.from}
          onChange={(event) => onChange(withFilter(state, { from: event.target.value }))}
          className={`${filterControl} !font-mono !text-[12px]`}
        />
      </div>
      <div className="flex max-w-[180px] flex-[1_1_150px] flex-col gap-[3px]">
        <label htmlFor="programs-filter-date-to" className={labelClass}>
          {t('programas', 'endTo')}
        </label>
        <input
          id="programs-filter-date-to"
          type="date"
          data-testid={PROGRAMAS_TESTIDS.PROGRAMS_FILTER_DATE_TO}
          value={state.to}
          onChange={(event) => onChange(withFilter(state, { to: event.target.value }))}
          className={`${filterControl} !font-mono !text-[12px]`}
        />
      </div>
      <div className="relative flex max-w-[240px] flex-[1_1_180px] flex-col gap-[3px]">
        <label htmlFor="programs-filter-owner" className={labelClass}>
          {t('programas', 'owner')}
        </label>
        <OwnerCombobox
          inputId="programs-filter-owner"
          testIdPrefix="programs-filter-owner"
          inputTestId={PROGRAMAS_TESTIDS.PROGRAMS_FILTER_OWNER}
          listTestId={PROGRAMAS_TESTIDS.PROGRAMS_FILTER_OWNER_LIST}
          clearTestId={PROGRAMAS_TESTIDS.PROGRAMS_FILTER_OWNER_CLEAR}
          owners={owners}
          value={state.owner || null}
          onChange={(ownerId) => onChange(withFilter(state, { owner: ownerId ?? '' }))}
          placeholder={t('programas', 'anyOwner')}
          listLabel={t('programas', 'owner')}
          clearLabel={t('programas', 'clearOwner')}
          noMatch={t('programas', 'noOwnerMatch')}
          showCounts
          inputClassName="input-filter"
        />
      </div>
      {hasActiveFilters(state) ? (
        <button
          type="button"
          data-testid={PROGRAMAS_TESTIDS.PROGRAMS_FILTERS_CLEAR}
          onClick={onClear}
          className="h-[30px] cursor-pointer rounded-[4px] border-0 bg-transparent px-2.5 text-[12.5px] font-medium text-accent hover:bg-accent-soft"
        >
          {t('programas', 'clearFilters')}
        </button>
      ) : null}
    </div>
  );
};
