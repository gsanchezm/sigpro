import {
  ApiError,
  PROGRAMAS_TESTIDS,
  RESPONSIVE_TESTIDS,
  can,
  nextProgramCode,
  permissionDeniedReason,
  programsToCsv,
  type CreateProgramInput,
  type ProgramDto,
  type ProgramSortColumn,
} from '@sigpro/shared';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { downloadCsv } from '../../lib/download';
import { formatTrace } from '../../lib/errors';
import { useDelayedFlag } from '../../lib/hooks';
import { useIsMobileLayout } from '../../lib/layout';
import { useAuth } from '../../state/auth';
import { useI18n } from '../../state/i18n';
import { useToast } from '../../state/toast';
import { DownloadIcon } from '../../ui/icons';
import { BulkBar } from './BulkBar';
import { DeleteDialog } from './DeleteDialog';
import { Pagination } from './Pagination';
import { ProgramCards } from './ProgramCards';
import { ProgramPanel } from './ProgramPanel';
import { ProgramWizard } from './ProgramWizard';
import { ProgramsFilters } from './ProgramsFilters';
import { ProgramsFiltersMobile } from './ProgramsFiltersMobile';
import { ProgramsMetrics } from './ProgramsMetrics';
import { ProgramsTable } from './ProgramsTable';
import { DEFAULT_LIST_STATE, hasActiveFilters, nextSort, parseListParams, toListQuery, toSearchString, type ListState } from './params';
import { useOwners, useProgramsList } from './useProgramsData';

const SKELETON_DELAY_MS = 250;

const isTypingTarget = (target: EventTarget | null): boolean => {
  const element = target as HTMLElement | null;
  const tag = element?.tagName?.toLowerCase() ?? '';
  return tag === 'input' || tag === 'textarea' || tag === 'select' || Boolean(element?.isContentEditable);
};

/** Módulo Programas: lista con filtros, orden, paginación de 10, selección múltiple y asistente de alta. */
export const ProgramsPage = () => {
  const { t } = useI18n();
  const { user, api } = useAuth();
  const toast = useToast();
  const mobile = useIsMobileLayout();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const state = useMemo(() => parseListParams(params), [params]);

  const { status, data, error, settledKey, currentKey, reload } = useProgramsList(toListQuery(state));
  const { owners, reload: reloadOwners } = useOwners();

  const [selected, setSelected] = useState<readonly string[]>([]);
  const [wizard, setWizard] = useState<{ nextCode: string } | null>(null);
  const [deleteCodes, setDeleteCodes] = useState<readonly string[] | null>(null);
  const [deleting, setDeleting] = useState(false);
  // Panel lateral de detalle (código de la fila abierta) y recarga de las tarjetas de métricas tras cada mutación
  const [panelCode, setPanelCode] = useState<string | null>(null);
  const [metricsKey, setMetricsKey] = useState(0);

  const role = user?.role ?? 'consultant';
  const canCreate = can(role, 'program.create');
  const loading = status === 'loading';
  const isError = status === 'error';
  const rows = data?.items ?? [];
  const panelProgram = rows.find((row) => row.code === panelCode) ?? null;
  const total = data?.total ?? 0;
  const pages = data?.pages ?? 1;
  const slow = useDelayedFlag(loading, SKELETON_DELAY_MS);
  const showSkeleton = loading && (data === null || slow);
  const isEmpty = !loading && !isError && total === 0;
  const filtered = hasActiveFilters(state);

  const setState = useCallback((next: ListState, options: { replace?: boolean } = {}) => setParams(new URLSearchParams(toSearchString(next).slice(1)), { replace: options.replace }), [setParams]);

  // El servidor acota la página; si difiere de la URL, la URL se corrige
  useEffect(() => {
    if (data && settledKey === currentKey && data.page !== state.page) setState({ ...state, page: data.page }, { replace: true });
  }, [data, settledKey, currentKey, state, setState]);

  /** Ejecuta una operación y, si falla, avisa con un toast de error que incluye la traza HTTP. */
  const attempt = useCallback(
    async (work: () => Promise<void>): Promise<void> => {
      try {
        await work();
      } catch (failure) {
        toast.push('danger', t('common', 'genericError'), formatTrace(failure) || t('common', 'networkError'));
      }
    },
    [toast, t],
  );

  const changeState = (next: ListState) => {
    setSelected([]);
    setPanelCode(null);
    setState(next);
  };

  const refresh = () => {
    setSelected([]);
    reload();
    reloadOwners();
    setMetricsKey((key) => key + 1);
  };

  const openWizard = useCallback(() => {
    setWizard({ nextCode: '…' });
    void api.programs.list({ sort: 'code', dir: 'desc', pageSize: 1 }).then(
      (latest) => setWizard((current) => (current ? { nextCode: nextProgramCode(latest.items.map((item) => item.code)) } : current)),
      () => undefined,
    );
  }, [api]);

  // Atajos: N nuevo programa · / buscar (Esc lo gestiona cada diálogo)
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey || event.altKey || isTypingTarget(event.target) || wizard || deleteCodes) return;
      if (event.key === '/') {
        event.preventDefault();
        document.querySelector<HTMLElement>(`[data-testid="${PROGRAMAS_TESTIDS.LAYOUT_SEARCH}"], [data-testid="${PROGRAMAS_TESTIDS.PROGRAMS_SEARCH}"]`)?.focus();
      } else if (event.key.toLowerCase() === 'n' && canCreate) {
        event.preventDefault();
        openWizard();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [canCreate, openWizard, wizard, deleteCodes]);

  // Esc cierra el panel lateral (salvo que haya un menú, lista o diálogo abierto: a ese le toca el Esc)
  useEffect(() => {
    if (!panelProgram) return;
    const onEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented || wizard || deleteCodes) return;
      if (document.querySelector('[role="menu"], [role="dialog"], [role="alertdialog"], [role="listbox"]')) return;
      setPanelCode(null);
    };
    document.addEventListener('keydown', onEscape);
    return () => document.removeEventListener('keydown', onEscape);
  }, [panelProgram, wizard, deleteCodes]);

  const exportFiltered = () =>
    attempt(async () => {
      downloadCsv(await api.programs.exportCsv(toListQuery(state)));
      toast.push('info', t('programas', 'csvReady'), `${total} ${t('programas', 'csvBody')}`);
    });

  const exportSelected = () => {
    const picked = rows.filter((row) => selected.includes(row.code));
    downloadCsv(programsToCsv(picked));
    toast.push('info', t('programas', 'csvReady'), `${picked.length} ${t('programas', 'csvBody')}`);
  };

  const archive = (codes: readonly string[]) =>
    attempt(async () => {
      await Promise.all(codes.map((code) => api.programs.archive(code)));
      toast.push('ok', codes.length === 1 ? `${codes[0]} ${t('programas', 'archived')}` : `${codes.length} ${t('programas', 'archivedN')}`);
      refresh();
    });

  const duplicate = (program: ProgramDto) =>
    attempt(async () => {
      const copy = await api.programs.duplicate(program.code);
      toast.push('ok', `${copy.code} ${t('programas', 'created').toLowerCase()}`, t('programas', 'duplicatedBody'));
      setSelected([]);
      setState({ ...state, sort: 'code', dir: 'desc', page: 1 });
      reload();
      reloadOwners();
      setMetricsKey((key) => key + 1);
    });

  const edit = (program: ProgramDto) => navigate(`/programs/${program.code}/edit`);

  const confirmDelete = async () => {
    if (!deleteCodes) return;
    setDeleting(true);
    await attempt(async () => {
      await Promise.all(deleteCodes.map((code) => api.programs.remove(code)));
      toast.push('ok', deleteCodes.length === 1 ? `${deleteCodes[0]} ${t('programas', 'deleted')}` : `${deleteCodes.length} ${t('programas', 'deletedN')}`);
      refresh();
    });
    setDeleting(false);
    setDeleteCodes(null);
  };

  const createProgram = async (input: CreateProgramInput) => {
    const created = await api.programs.create(input);
    setWizard(null);
    toast.push('ok', t('programas', 'created'), `${created.code} ${t('programas', 'addedToList')}`);
    setSelected([]);
    setState({ ...state, sort: 'code', dir: 'desc', page: 1 });
    reload();
    reloadOwners();
    setMetricsKey((key) => key + 1);
  };

  const onSort = (column: ProgramSortColumn) => changeState(nextSort(state, column));
  const toggleOne = (code: string) => setSelected((current) => (current.includes(code) ? current.filter((c) => c !== code) : [...current, code]));
  const toggleAll = () => {
    const codes = rows.map((row) => row.code);
    const all = codes.length > 0 && codes.every((code) => selected.includes(code));
    setSelected((current) => (all ? current.filter((code) => !codes.includes(code)) : Array.from(new Set([...current, ...codes]))));
  };

  const subtitle = loading && data === null ? '…' : `${data?.totalAll ?? 0} ${t('programas', 'programs').toLowerCase()} · ${data?.activeCount ?? 0} ${t('programas', 'st_active').toLowerCase()}`;
  const from = total === 0 ? 0 : ((data?.page ?? 1) - 1) * (data?.pageSize ?? 10) + 1;
  const to = Math.min((data?.page ?? 1) * (data?.pageSize ?? 10), total);
  const rangeLabel = loading && data === null ? '…' : `${from}–${to} ${t('programas', 'shown')} ${total}`;
  const exportDisabled = loading || isError || total === 0;
  const clearFilters = () => changeState({ ...DEFAULT_LIST_STATE, sort: state.sort, dir: state.dir });

  const emptyBlock = (
    <div
      data-testid={PROGRAMAS_TESTIDS.PROGRAMS_EMPTY}
      className={`flex flex-col items-center gap-1.5 text-center ${mobile ? 'rounded-card border border-dashed border-border-strong px-4 py-10' : 'border-t border-border px-4 py-12'}`}
    >
      <div className="font-medium">{t('programas', 'emptyTitle')}</div>
      <div className="text-[12.5px] text-fg-2">{filtered ? t('programas', 'emptyFiltered') : t('programas', 'emptyNone')}</div>
      {filtered ? (
        <button type="button" data-testid={PROGRAMAS_TESTIDS.PROGRAMS_EMPTY_CLEAR} onClick={clearFilters} className="btn btn-secondary mt-1.5 !h-7 !px-2.5 !text-[12px]">
          {t('programas', 'clearFilters')}
        </button>
      ) : null}
    </div>
  );

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          {!mobile ? <h1 className="page-title">{t('programas', 'programs')}</h1> : null}
          <p className="m-0 text-[12.5px] text-fg-2">
            {subtitle}
          </p>
        </div>
        {!mobile ? (
          <div className="flex gap-2">
            <button
              type="button"
              data-testid={PROGRAMAS_TESTIDS.PROGRAMS_EXPORT_CSV}
              onClick={() => void exportFiltered()}
              disabled={exportDisabled}
              title={exportDisabled ? t('common', 'exportDisabled') : undefined}
              className="btn btn-secondary"
            >
              <DownloadIcon size={12} />
              {t('programas', 'exportCsv')}
            </button>
            <button
              type="button"
              data-testid={PROGRAMAS_TESTIDS.PROGRAMS_NEW}
              onClick={openWizard}
              disabled={!canCreate}
              title={canCreate ? `${t('programas', 'newProgram')} (N)` : t('programas', permissionDeniedReason('program.create'))}
              className="btn btn-primary"
            >
              + {t('programas', 'newProgram')}
              <kbd aria-hidden="true" className="ml-1.5 inline-grid h-4 place-items-center rounded-ctl-sm border border-current/40 px-[5px] font-mono text-[10px]">
                N
              </kbd>
            </button>
          </div>
        ) : null}
      </div>

      <ProgramsMetrics refreshKey={metricsKey} />

      {mobile ? (
        <ProgramsFiltersMobile state={state} owners={owners} search={state.q} onSearch={(value) => changeState({ ...state, q: value, page: 1 })} onChange={changeState} onClear={clearFilters} />
      ) : (
        <ProgramsFilters state={state} owners={owners} onChange={changeState} onClear={clearFilters} />
      )}

      {selected.length > 0 ? (
        <BulkBar count={selected.length} role={role} onExport={exportSelected} onArchive={() => void archive(selected)} onDelete={() => setDeleteCodes([...selected])} onClear={() => setSelected([])} />
      ) : null}

      {isError ? (
        <div role="alert" data-testid={PROGRAMAS_TESTIDS.PROGRAMS_ERROR} className="alert alert-danger flex flex-wrap items-center justify-between gap-3 !px-3.5 !py-3">
          <div>
            <div className="font-semibold">{t('programas', 'errorTitle')}</div>
            <div className="trace !text-[12.5px]">{error instanceof ApiError ? formatTrace(error) : t('common', 'networkError')}</div>
          </div>
          <button
            type="button"
            data-testid={PROGRAMAS_TESTIDS.PROGRAMS_ERROR_RETRY}
            onClick={() => {
              reload();
              toast.push('info', t('programas', 'reloaded'));
            }}
            className="btn btn-danger-outline !h-[30px] !px-3"
          >
            {t('programas', 'retry')}
          </button>
        </div>
      ) : null}

      {!mobile ? (
        <div className="flex items-start gap-6">
          <div className="min-w-0 flex-1 overflow-hidden rounded-card border border-border bg-surface">
            <ProgramsTable
              rows={rows}
              loading={loading}
              showSkeleton={showSkeleton}
              state={state}
              role={role}
              selected={selected}
              openCode={panelProgram?.code ?? null}
              onOpen={setPanelCode}
              onSort={onSort}
              onToggle={toggleOne}
              onToggleAll={toggleAll}
              onEdit={edit}
              onDuplicate={(program) => void duplicate(program)}
              onArchive={(program) => void archive([program.code])}
              onDelete={(program) => setDeleteCodes([program.code])}
            />
            {isEmpty ? emptyBlock : null}
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border px-3 py-2 text-[12px] text-fg-2">
              <span id="programs-count" data-testid={PROGRAMAS_TESTIDS.PROGRAMS_COUNT} aria-live="polite">
                {rangeLabel}
              </span>
              <Pagination page={data?.page ?? 1} pages={pages} onPage={(page) => changeState({ ...state, page })} />
            </div>
          </div>
          {panelProgram ? <ProgramPanel program={panelProgram} onClose={() => setPanelCode(null)} /> : null}
        </div>
      ) : (
        <>
          <ProgramCards
            rows={rows}
            loading={loading}
            showSkeleton={showSkeleton}
            role={role}
            onEdit={edit}
            onDuplicate={(program) => void duplicate(program)}
            onArchive={(program) => void archive([program.code])}
            onDelete={(program) => setDeleteCodes([program.code])}
          />
          {isEmpty ? emptyBlock : null}
          {rows.length > 0 ? (
            <div className="flex items-center justify-between gap-2 pt-1 pb-2 text-[12px] text-fg-2">
              <span id="programs-count" data-testid={PROGRAMAS_TESTIDS.PROGRAMS_COUNT} aria-live="polite">
                {rangeLabel}
              </span>
              <Pagination compact page={data?.page ?? 1} pages={pages} onPage={(page) => changeState({ ...state, page })} />
            </div>
          ) : null}
          {canCreate ? (
            <button
              type="button"
              data-testid={RESPONSIVE_TESTIDS.PROGRAMS_NEW}
              aria-label={`+ ${t('programas', 'newProgram')}`}
              onClick={openWizard}
              className="fixed right-4 bottom-4 z-[21] grid size-[52px] cursor-pointer place-items-center rounded-full border-0 bg-accent text-[26px] leading-none text-on-accent shadow-pop"
            >
              +
            </button>
          ) : null}
        </>
      )}

      {wizard ? <ProgramWizard owners={owners} nextCode={wizard.nextCode} onClose={() => setWizard(null)} onSubmit={createProgram} /> : null}
      {deleteCodes ? <DeleteDialog codes={deleteCodes} busy={deleting} onCancel={() => setDeleteCodes(null)} onConfirm={() => void confirmDelete()} /> : null}
    </>
  );
};
