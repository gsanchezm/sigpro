import { PROGRAM_STATUSES, PROGRAMAS_TESTIDS, type OwnerDto } from '@sigpro/shared';
import { useI18n } from '../../state/i18n';
import { FilterChip as Chip } from '../../ui/FilterChip';
import { OwnerCombobox } from '../../ui/OwnerCombobox';
import { hasActiveFilters, withFilter, type ListState } from './params';

interface FiltersProps {
  readonly state: ListState;
  readonly owners: readonly OwnerDto[];
  readonly onChange: (next: ListState) => void;
  readonly onClear: () => void;
}

interface DateChipProps {
  readonly id: string;
  readonly testId: string;
  readonly clearTestId: string;
  readonly label: string;
  readonly value: string;
  readonly removeLabel: string;
  readonly onChange: (value: string) => void;
}

/** Chip de fecha: vacío, la etiqueta «+ Inicio desde» y el campo (transparente) encima; activo, etiqueta + fecha en mono. */
const DateChip = ({ id, testId, clearTestId, label, value, removeLabel, onChange }: DateChipProps) => (
  <Chip active={value !== ''} clear={{ label: removeLabel, testId: clearTestId, onClear: () => onChange('') }}>
    <label htmlFor={id} className="sr-only">
      {label}
    </label>
    <span aria-hidden="true">{value === '' ? `+ ${label}` : label}</span>
    <input
      id={id}
      type="date"
      data-testid={testId}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      onClick={(event) => event.currentTarget.showPicker?.()}
      className="chip-date mono text-[12px]"
    />
  </Chip>
);

/** Filtros de ESCRITORIO como chips en línea: estado, rango de fechas y responsable (combobox) + «Limpiar filtros». En responsive se monta `ProgramsFiltersMobile`. */
export const ProgramsFilters = ({ state, owners, onChange, onClear }: FiltersProps) => {
  const { t } = useI18n();
  const statusLabels = { draft: t('programas', 'st_draft'), active: t('programas', 'st_active'), on_hold: t('programas', 'st_on_hold'), closed: t('programas', 'st_closed'), cancelled: t('programas', 'st_cancelled') } as const;
  const remove = (value: string) => t('programas', 'removeFilter', { value });

  return (
    <div role="search" aria-label={t('programas', 'filters')} data-testid={PROGRAMAS_TESTIDS.PROGRAMS_FILTERS} className="flex flex-wrap items-center gap-2">
      <Chip
        active={state.status !== ''}
        caret
        clear={state.status === '' ? undefined : { label: remove(statusLabels[state.status]), testId: PROGRAMAS_TESTIDS.PROGRAMS_FILTER_STATUS_CLEAR, onClear: () => onChange(withFilter(state, { status: '' })) }}
      >
        <label htmlFor="programs-filter-status" className="sr-only">
          {t('programas', 'status')}
        </label>
        <select
          id="programs-filter-status"
          data-testid={PROGRAMAS_TESTIDS.PROGRAMS_FILTER_STATUS}
          value={state.status}
          onChange={(event) => onChange(withFilter(state, { status: event.target.value as ListState['status'] }))}
        >
          <option value="">+ {t('programas', 'status')}</option>
          {PROGRAM_STATUSES.map((status) => (
            <option key={status} value={status}>
              {statusLabels[status]}
            </option>
          ))}
        </select>
      </Chip>

      <DateChip
        id="programs-filter-date-from"
        testId={PROGRAMAS_TESTIDS.PROGRAMS_FILTER_DATE_FROM}
        clearTestId={PROGRAMAS_TESTIDS.PROGRAMS_FILTER_DATE_FROM_CLEAR}
        label={t('programas', 'startFrom')}
        value={state.from}
        removeLabel={remove(state.from)}
        onChange={(from) => onChange(withFilter(state, { from }))}
      />
      <DateChip
        id="programs-filter-date-to"
        testId={PROGRAMAS_TESTIDS.PROGRAMS_FILTER_DATE_TO}
        clearTestId={PROGRAMAS_TESTIDS.PROGRAMS_FILTER_DATE_TO_CLEAR}
        label={t('programas', 'endTo')}
        value={state.to}
        removeLabel={remove(state.to)}
        onChange={(to) => onChange(withFilter(state, { to }))}
      />

      <Chip active={state.owner !== ''}>
        <label htmlFor="programs-filter-owner" className="sr-only">
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
          placeholder={`+ ${t('programas', 'owner')}`}
          listLabel={t('programas', 'owner')}
          clearLabel={t('programas', 'clearOwner')}
          noMatch={t('programas', 'noOwnerMatch')}
          showCounts
          inputClassName="chip-owner"
          rootClassName="min-w-[168px] flex-1"
        />
      </Chip>

      {hasActiveFilters(state) ? (
        <button type="button" data-testid={PROGRAMAS_TESTIDS.PROGRAMS_FILTERS_CLEAR} onClick={onClear} className="btn btn-ghost btn-sm !text-accent hover:!bg-accent-soft">
          {t('programas', 'clearFilters')}
        </button>
      ) : null}
    </div>
  );
};
