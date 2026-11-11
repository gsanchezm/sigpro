import { ApiError, NC_SEVERITIES, NC_TESTIDS, can, isNcOpen, type CreateNcInput, type NcSeverity, type NcState } from '@sigpro/shared';
import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { formatTrace } from '../../lib/errors';
import { useDebouncedValue } from '../../lib/hooks';
import { useAuth } from '../../state/auth';
import { useConfig } from '../../state/config';
import { useI18n } from '../../state/i18n';
import { useToast } from '../../state/toast';
import { CloseNcDialog } from './CloseNcDialog';
import { NcBoard } from './NcBoard';
import { NcDetailDialog } from './NcDetailDialog';
import { NewNcDialog } from './NewNcDialog';
import { moveItemTo } from './nc-view';
import { hasFilters, useNcBoard, type NcFilters } from './useNcBoard';
import { useNcLabels } from './useNcLabels';

interface ProgramOption {
  readonly code: string;
  readonly name: string;
}

/**
 * No conformidades: tablero kanban con drag & drop entre columnas, filtros, alta, detalle en modal (`/nc/:code`),
 * cierre con comentario obligatorio y comentario rápido con el `prompt()` NATIVO del navegador.
 */
export const NcPage = () => {
  const { t } = useI18n();
  const { api, user } = useAuth();
  const toast = useToast();
  const { plantedBugs } = useConfig();
  const labels = useNcLabels();
  const navigate = useNavigate();
  const { code: openCode } = useParams();
  const role = user?.role ?? 'auditor';
  const canCreate = can(role, 'nc.create');
  const canMove = can(role, 'nc.transition');

  const [search, setSearch] = useState('');
  const [program, setProgram] = useState('');
  const [severity, setSeverity] = useState<NcSeverity | ''>('');
  const [unassigned, setUnassigned] = useState(false);
  const q = useDebouncedValue(search.trim(), 250);
  const filters: NcFilters = { q, program, severity, unassigned };
  const filtered = hasFilters({ q: search.trim(), program, severity, unassigned });
  const board = useNcBoard(filters);
  const [programs, setPrograms] = useState<readonly ProgramOption[]>([]);
  const [creating, setCreating] = useState(false);
  const [closing, setClosing] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    api.programs.list({ pageSize: 100 }).then(
      (list) => !cancelled && setPrograms(list.items.map((item) => ({ code: item.code, name: item.name }))),
      () => undefined,
    );
    return () => {
      cancelled = true;
    };
  }, [api]);

  const items = board.data?.items ?? [];
  const loading = board.status === 'loading';
  const openCount = items.filter((item) => isNcOpen(item.state)).length;
  const clearFilters = () => {
    setSearch('');
    setProgram('');
    setSeverity('');
    setUnassigned(false);
  };

  const failure = (error: unknown): string => formatTrace(error) || t('common', 'genericError');

  /** Mueve una tarjeta. Cerrar abre el diálogo del comentario; el resto es optimista y se revierte si el servidor lo rechaza. */
  const moveCard = async (code: string, to: NcState) => {
    const nc = items.find((item) => item.code === code);
    if (!nc || nc.state === to) return;
    if (!canMove) return void toast.push('warn', t('nc', 'dragDenied'));
    if (to === 'closed') {
      if (!can(role, 'nc.close')) return void toast.push('warn', t('nc', 'closeDenied'));
      // Solo la acción correctiva puede cerrarse; cualquier otro origen lo rechaza el servidor (409) sin pedir comentario
      if (nc.state === 'corrective_action') return void setClosing(code);
    }
    const previous = items;
    board.setItems(moveItemTo(items, code, to));
    try {
      await api.nc.transition(code, { to });
      toast.push('ok', t('nc', 'moved', { code, state: labels.state(to) }));
      board.reload();
    } catch (error) {
      board.setItems(previous);
      const invalid = error instanceof ApiError && error.status === 409;
      const denied = error instanceof ApiError && error.status === 403;
      toast.push('danger', invalid ? t('nc', 'invalidTransition', { code, from: labels.state(nc.state), to: labels.state(to) }) : denied ? t('nc', 'menuMoveDenied') : t('nc', 'moveFailed', { code }), invalid || denied ? undefined : failure(error));
    }
  };

  const closeCard = async (code: string, comment: string) => {
    await api.nc.transition(code, { to: 'closed', comment });
    setClosing(null);
    toast.push('ok', t('nc', 'closed', { code }));
    board.reload();
  };

  /** Comentario rápido con el diálogo NATIVO `prompt()` (a propósito: se prueba con `page.on('dialog')`). */
  const quickComment = async (code: string) => {
    const text = window.prompt(t('nc', 'quickPrompt', { code }), '');
    if (text === null) return;
    if (text.trim() === '') return void toast.push('warn', t('nc', 'quickEmpty'));
    try {
      await api.nc.comment(code, { body: text.trim(), kind: 'quick' });
      toast.push('ok', t('nc', 'quickSaved', { code }));
      board.reload();
    } catch (error) {
      toast.push('danger', t('common', 'genericError'), failure(error));
    }
  };

  const createNc = async (input: CreateNcInput) => {
    const created = await api.nc.create(input);
    setCreating(false);
    toast.push('ok', t('nc', 'created', { code: created.code }));
    board.reload();
  };

  const closeDetail = useCallback(() => navigate('/nc'), [navigate]);
  const openDetail = useCallback((code: string) => navigate(`/nc/${code}`), [navigate]);

  return (
    <div data-testid={NC_TESTIDS.NC_PAGE} className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <h1 className="page-title">{t('nc', 'title')}</h1>
          <p className="m-0 text-[12.5px] text-fg-2">{t('nc', 'subtitle')}</p>
        </div>
        <button
          type="button"
          data-testid={NC_TESTIDS.NC_NEW}
          disabled={!canCreate}
          title={canCreate ? undefined : t('nc', 'newDenied')}
          onClick={() => setCreating(true)}
          className="btn btn-primary"
        >
          {t('nc', 'newButton')}
        </button>
      </div>

      <div className="flex flex-wrap items-end gap-2">
        <div className="flex min-w-[180px] flex-1 flex-col gap-1 sm:max-w-[300px]">
          <label htmlFor="nc-search" className="label">
            {t('nc', 'searchLabel')}
          </label>
          <input
            id="nc-search"
            type="search"
            data-testid={NC_TESTIDS.NC_SEARCH}
            placeholder={t('nc', 'searchPlaceholder')}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="input input-filter !h-8"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="nc-filter-program" className="label">
            {t('nc', 'filterProgram')}
          </label>
          <select id="nc-filter-program" data-testid={NC_TESTIDS.NC_FILTER_PROGRAM} value={program} onChange={(event) => setProgram(event.target.value)} className="input input-filter !h-8 !w-auto max-w-[220px]">
            <option value="">{t('nc', 'allPrograms')}</option>
            {programs.map((option) => (
              <option key={option.code} value={option.code}>
                {option.code} · {option.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="nc-filter-severity" className="label">
            {t('nc', 'filterSeverity')}
          </label>
          <select
            id="nc-filter-severity"
            data-testid={NC_TESTIDS.NC_FILTER_SEVERITY}
            value={severity}
            onChange={(event) => setSeverity(event.target.value as NcSeverity | '')}
            className="input input-filter !h-8 !w-auto"
          >
            <option value="">{t('nc', 'allSeverities')}</option>
            {NC_SEVERITIES.map((value) => (
              <option key={value} value={value}>
                {labels.severity(value)}
              </option>
            ))}
          </select>
        </div>
        <label htmlFor="nc-filter-unassigned" className="flex h-8 cursor-pointer items-center gap-2 text-[12.5px]">
          <input id="nc-filter-unassigned" type="checkbox" data-testid={NC_TESTIDS.NC_FILTER_UNASSIGNED} checked={unassigned} onChange={(event) => setUnassigned(event.target.checked)} />
          {t('nc', 'filterUnassigned')}
        </label>
        {filtered ? (
          <button type="button" data-testid={NC_TESTIDS.NC_FILTERS_CLEAR} onClick={clearFilters} className="btn btn-ghost !h-8 !px-2.5">
            {t('nc', 'clearFilters')}
          </button>
        ) : null}
      </div>

      <p data-testid={NC_TESTIDS.NC_COUNT} aria-live="polite" className="m-0 font-mono text-[12px] text-fg-2">
        {board.data
          ? filtered
            ? t('nc', 'countFiltered', { shown: items.length, total: board.data.totalAll })
            : t('nc', 'count', { total: board.data.total, open: openCount })
          : '…'}
      </p>

      {board.status === 'error' ? (
        <div role="alert" data-testid={NC_TESTIDS.NC_ERROR} className="alert alert-danger flex flex-wrap items-center justify-between gap-3 !px-3.5 !py-3">
          <div>
            <div className="font-semibold">{t('nc', 'errorTitle')}</div>
            <div className="trace !text-[12.5px]">{board.error instanceof ApiError ? formatTrace(board.error) : t('common', 'networkError')}</div>
          </div>
          <button type="button" data-testid={NC_TESTIDS.NC_ERROR_RETRY} onClick={board.reload} className="btn btn-danger-outline !h-[30px] !px-3">
            {t('nc', 'retry')}
          </button>
        </div>
      ) : board.status === 'ready' && items.length === 0 ? (
        <div data-testid={NC_TESTIDS.NC_EMPTY} className="card flex flex-col items-center gap-1.5 px-4 py-12 text-center">
          <div className="font-medium">{t('nc', 'emptyTitle')}</div>
          <div className="text-[12.5px] text-fg-2">{filtered ? t('nc', 'emptyFiltered') : t('nc', 'emptyNone')}</div>
          {filtered ? (
            <button type="button" data-testid={NC_TESTIDS.NC_EMPTY_CLEAR} onClick={clearFilters} className="btn btn-secondary mt-2 !h-8">
              {t('nc', 'clearFilters')}
            </button>
          ) : null}
        </div>
      ) : (
        <NcBoard items={items} loading={loading} role={role} canMove={canMove} plantedBugs={plantedBugs} onOpen={openDetail} onQuick={(code) => void quickComment(code)} onMove={(code, to) => void moveCard(code, to)} />
      )}

      {openCode ? <NcDetailDialog key={openCode} code={openCode} onClose={closeDetail} onChanged={board.reload} /> : null}
      {creating ? <NewNcDialog programs={programs} onClose={() => setCreating(false)} onSubmit={createNc} /> : null}
      {closing ? <CloseNcDialog code={closing} onClose={() => setClosing(null)} onSubmit={(comment) => closeCard(closing, comment)} /> : null}
    </div>
  );
};
