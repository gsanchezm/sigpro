import { PROGRAM_STATUSES, PROGRAMAS_TESTIDS, RESPONSIVE_TESTIDS, type OwnerDto } from '@sigpro/shared';
import { useId, useState } from 'react';
import { useI18n } from '../../state/i18n';
import { Modal } from '../../ui/Modal';
import { OwnerCombobox } from '../../ui/OwnerCombobox';
import { hasActiveFilters, withFilter, type ListState } from './params';

interface FiltersMobileProps {
  readonly state: ListState;
  readonly owners: readonly OwnerDto[];
  readonly search: string;
  readonly onSearch: (value: string) => void;
  readonly onChange: (next: ListState) => void;
  readonly onClear: () => void;
}

/**
 * Filtros de Programas del DISEÑO RESPONSIVE (< 1024 px): el buscador, un botón «Filtros» con el número de filtros activos
 * y un panel inferior con los mismos campos (estado, fechas, responsable). Los campos conservan su id de escritorio
 * (`programs-filter-status`…): son campos de formulario y solo existen en una de las dos variantes.
 * En escritorio se monta `ProgramsFilters` (barra de chips en línea).
 */
export const ProgramsFiltersMobile = ({ state, owners, search, onSearch, onChange, onClear }: FiltersMobileProps) => {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const titleId = useId();
  const count = [state.status, state.from, state.to, state.owner].filter((value) => value !== '').length;
  const statusLabels = { draft: t('programas', 'st_draft'), active: t('programas', 'st_active'), on_hold: t('programas', 'st_on_hold'), closed: t('programas', 'st_closed'), cancelled: t('programas', 'st_cancelled') } as const;

  return (
    <div className="flex items-center gap-2">
      <div className="relative min-w-0 flex-1">
        <input
          type="search"
          data-testid={PROGRAMAS_TESTIDS.PROGRAMS_SEARCH}
          aria-label={t('programas', 'searchPrograms')}
          placeholder={t('programas', 'searchPlaceholder')}
          value={search}
          onChange={(event) => onSearch(event.target.value)}
          className="input"
        />
      </div>
      <button
        type="button"
        data-testid={RESPONSIVE_TESTIDS.PROGRAMS_FILTERS}
        data-count={count}
        aria-label={t('programas', 'filters')}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(true)}
        className="btn btn-secondary flex-none"
      >
        <span aria-hidden="true">{t('programas', 'filters')}</span>
        {count > 0 ? (
          <span aria-hidden="true" className="ml-1.5 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-accent px-1 font-mono text-[10.5px] text-on-accent">
            {count}
          </span>
        ) : null}
      </button>

      {open ? (
        <Modal role="dialog" testId={RESPONSIVE_TESTIDS.PROGRAMS_FILTERS_PANEL} labelledBy={titleId} onClose={() => setOpen(false)} className="inset-x-0 bottom-0 max-h-[85vh] rounded-t-card !border-b-0">
          <div className="flex items-center justify-between px-4 pt-4 pb-2">
            <h2 id={titleId} className="m-0 text-[14px] font-semibold">
              {t('programas', 'filters')}
            </h2>
            {hasActiveFilters(state) ? (
              <button type="button" data-testid={RESPONSIVE_TESTIDS.PROGRAMS_FILTERS_CLEAR} onClick={onClear} className="btn btn-ghost btn-sm !text-accent hover:!bg-accent-soft">
                {t('programas', 'clearFilters')}
              </button>
            ) : null}
          </div>
          <div className="flex min-h-0 flex-col gap-3 overflow-y-auto px-4 pb-3">
            <div className="flex flex-col gap-1">
              <label htmlFor="programs-filter-status" className="label">
                {t('programas', 'status')}
              </label>
              <select
                id="programs-filter-status"
                data-testid={PROGRAMAS_TESTIDS.PROGRAMS_FILTER_STATUS}
                value={state.status}
                onChange={(event) => onChange(withFilter(state, { status: event.target.value as ListState['status'] }))}
                className="input"
              >
                <option value="">{t('programas', 'status')}</option>
                {PROGRAM_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {statusLabels[status]}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="programs-filter-date-from" className="label">
                {t('programas', 'startFrom')}
              </label>
              <input id="programs-filter-date-from" type="date" data-testid={PROGRAMAS_TESTIDS.PROGRAMS_FILTER_DATE_FROM} value={state.from} onChange={(event) => onChange(withFilter(state, { from: event.target.value }))} className="input" />
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="programs-filter-date-to" className="label">
                {t('programas', 'endTo')}
              </label>
              <input id="programs-filter-date-to" type="date" data-testid={PROGRAMAS_TESTIDS.PROGRAMS_FILTER_DATE_TO} value={state.to} onChange={(event) => onChange(withFilter(state, { to: event.target.value }))} className="input" />
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="programs-filter-owner" className="label">
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
                placeholder={t('programas', 'owner')}
                listLabel={t('programas', 'owner')}
                clearLabel={t('programas', 'clearOwner')}
                noMatch={t('programas', 'noOwnerMatch')}
                showCounts
                inputClassName="input"
                rootClassName="w-full"
              />
            </div>
          </div>
          <div className="border-t border-border p-3">
            <button type="button" data-testid={RESPONSIVE_TESTIDS.PROGRAMS_FILTERS_APPLY} onClick={() => setOpen(false)} className="btn btn-primary w-full justify-center">
              {t('programas', 'filtersDone')}
            </button>
          </div>
        </Modal>
      ) : null}
    </div>
  );
};
