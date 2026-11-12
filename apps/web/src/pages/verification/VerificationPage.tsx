import {
  ApiError,
  PROGRAMAS_TESTIDS,
  TEST_RESULTS,
  TEST_RESULT_TONE,
  VERIFICACION_DYNAMIC_TESTIDS,
  VERIFICACION_TESTIDS,
  can,
  type Role,
  type TestCaseDto,
  type TestCaseSortColumn,
  type TestResult,
} from '@sigpro/shared';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { downloadBlob } from '../../lib/download';
import { formatTrace } from '../../lib/errors';
import { useDebouncedValue, useDelayedFlag } from '../../lib/hooks';
import { useIsMobileLayout } from '../../lib/layout';
import { useAuth } from '../../state/auth';
import { useI18n } from '../../state/i18n';
import { useToast } from '../../state/toast';
import { RowMenuButton, type MenuItemSpec } from '../../ui/ActionMenu';
import { DownloadIcon, SearchIcon, SortIcon } from '../../ui/icons';
import { ToneBadge } from '../../ui/ToneBadge';
import { Pagination } from '../programs/Pagination';
import { useProgramOptions } from '../requirements/useRequirementsData';
import { DEFAULT_STATE, hasActiveFilters, nextSort, parseState, toQuery, toSearchString, type VerificationState } from './params';
import { useTestCasesList } from './useVerificationData';

const SKELETON_DELAY_MS = 250;
const SKELETON_ROWS = 6;

const COLUMNS: readonly { readonly key: TestCaseSortColumn; readonly width?: number; readonly right?: boolean }[] = [
  { key: 'code', width: 100 },
  { key: 'title' },
  { key: 'program', width: 110 },
  { key: 'result', width: 150 },
  { key: 'runs', width: 120, right: true },
];

/** Badge del último resultado (`data-state` pass/fail/blocked) o «Sin ejecutar». */
export const ResultBadge = ({ result, testId = VERIFICACION_TESTIDS.TESTCASE_RESULT_BADGE }: { result: TestResult | null; testId?: string }) => {
  const { t } = useI18n();
  if (!result) return <span className="text-fg-3">{t('verificacion', 'neverRun')}</span>;
  return <ToneBadge state={result} tone={TEST_RESULT_TONE[result]} label={t('verificacion', `r_${result}`)} testId={testId} />;
};

const pagination = (t: ReturnType<typeof useI18n>['t']) => ({
  ids: { nav: VERIFICACION_TESTIDS.VERIFICATION_PAGINATION, prev: VERIFICACION_TESTIDS.VERIFICATION_PAGE_PREV, next: VERIFICACION_TESTIDS.VERIFICATION_PAGE_NEXT, page: VERIFICACION_DYNAMIC_TESTIDS.VERIFICATION_PAGE_N },
  labels: { nav: t('verificacion', 'pagination'), prev: t('verificacion', 'prevPage'), next: t('verificacion', 'nextPage'), page: t('verificacion', 'page') },
});

/** Módulo Verificación: casos de prueba con filtros, orden, paginación de 10, selección múltiple e informe PDF. */
export const VerificationPage = () => {
  const { t } = useI18n();
  const { user, api } = useAuth();
  const toast = useToast();
  const mobile = useIsMobileLayout();
  const [params, setParams] = useSearchParams();
  const state = useMemo(() => parseState(params), [params]);
  const role: Role = user?.role ?? 'auditor';
  const canRun = can(role, 'testrun.execute');

  const { status, data, error, settledKey, currentKey, reload } = useTestCasesList(toQuery(state));
  const programs = useProgramOptions();
  const [selected, setSelected] = useState<readonly string[]>([]);
  const [searchDraft, setSearchDraft] = useState(state.q);
  const debouncedSearch = useDebouncedValue(searchDraft, 250);
  const selectAllRef = useRef<HTMLInputElement>(null);

  const rows = data?.items ?? [];
  const total = data?.total ?? 0;
  const loading = status === 'loading';
  const isError = status === 'error';
  const slow = useDelayedFlag(loading, SKELETON_DELAY_MS);
  const showSkeleton = loading && (data === null || slow);
  const isEmpty = !loading && !isError && total === 0;
  const filtered = hasActiveFilters(state);
  const allSelected = rows.length > 0 && rows.every((row) => selected.includes(row.code));
  const someSelected = rows.some((row) => selected.includes(row.code));

  const setState = useCallback((next: VerificationState, options: { replace?: boolean } = {}) => setParams(new URLSearchParams(toSearchString(next).slice(1)), { replace: options.replace }), [setParams]);
  const change = (next: VerificationState) => {
    setSelected([]);
    setState(next);
  };

  // El texto de la búsqueda se aplica con debounce (250 ms)
  useEffect(() => {
    if (debouncedSearch.trim() !== state.q) change({ ...state, q: debouncedSearch.trim(), page: 1 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch]);
  useEffect(() => setSearchDraft(state.q), [state.q]);

  // El servidor acota la página; si difiere de la URL, la URL se corrige
  useEffect(() => {
    if (data && settledKey === currentKey && data.page !== state.page) setState({ ...state, page: data.page }, { replace: true });
  }, [data, settledKey, currentKey, state, setState]);

  useEffect(() => {
    if (selectAllRef.current) selectAllRef.current.indeterminate = someSelected && !allSelected;
  }, [someSelected, allSelected]);

  const downloadReport = async (scope: { program?: string; codes?: string }) => {
    try {
      const { blob, filename } = await api.testCases.report(scope);
      const name = filename ?? 'informe-verificacion.pdf';
      downloadBlob(blob, name);
      toast.push('info', t('verificacion', 'reportReady'), t('verificacion', 'reportReadyBody', { name }));
    } catch (failure) {
      toast.push('danger', t('verificacion', 'reportFailed'), formatTrace(failure) || t('common', 'networkError'));
    }
  };

  const toggleOne = (code: string) => setSelected((current) => (current.includes(code) ? current.filter((c) => c !== code) : [...current, code]));
  const toggleAll = () => {
    const codes = rows.map((row) => row.code);
    setSelected((current) => (allSelected ? current.filter((code) => !codes.includes(code)) : Array.from(new Set([...current, ...codes]))));
  };

  const menuItems = (testCase: TestCaseDto): readonly MenuItemSpec[] => [
    { key: 'view', label: t('verificacion', 'menuView'), testId: VERIFICACION_TESTIDS.TESTCASE_MENU_VIEW, to: `/verification/${testCase.code}` },
    {
      key: 'run',
      label: t('verificacion', 'menuRun'),
      testId: VERIFICACION_TESTIDS.TESTCASE_MENU_RUN,
      to: `/verification/${testCase.code}#run`,
      disabled: !canRun,
      title: canRun ? undefined : t('verificacion', 'denied'),
    },
    { key: 'report', label: t('verificacion', 'menuReport'), testId: VERIFICACION_TESTIDS.TESTCASE_MENU_REPORT, onSelect: () => void downloadReport({ codes: testCase.code }) },
  ];

  const headerLabels: Readonly<Record<TestCaseSortColumn, string>> = {
    code: t('verificacion', 'colCode'),
    title: t('verificacion', 'colTitle'),
    program: t('verificacion', 'colProgram'),
    result: t('verificacion', 'colResult'),
    runs: t('verificacion', 'colRuns'),
  };

  const from = total === 0 ? 0 : ((data?.page ?? 1) - 1) * (data?.pageSize ?? 10) + 1;
  const to = Math.min((data?.page ?? 1) * (data?.pageSize ?? 10), total);
  const rangeLabel = loading && data === null ? '…' : t('verificacion', 'count', { from, to, total });
  const reportDisabled = loading || isError || total === 0;
  const clearFilters = () => change({ ...DEFAULT_STATE, sort: state.sort, dir: state.dir });
  const pager = pagination(t);

  const emptyBlock = (
    <div data-testid={VERIFICACION_TESTIDS.VERIFICATION_EMPTY} className="flex flex-col items-center gap-1.5 border-t border-border px-4 py-12 text-center">
      <div className="font-medium">{t('verificacion', 'emptyTitle')}</div>
      <div className="text-[12.5px] text-fg-2">{filtered ? t('verificacion', 'emptyFiltered') : t('verificacion', 'emptyNone')}</div>
      {filtered ? (
        <button type="button" data-testid={VERIFICACION_TESTIDS.VERIFICATION_EMPTY_CLEAR} onClick={clearFilters} className="btn btn-secondary mt-1.5 !h-7 !px-2.5 !text-[12px]">
          {t('verificacion', 'clearFilters')}
        </button>
      ) : null}
    </div>
  );

  return (
    <div data-testid={VERIFICACION_TESTIDS.VERIFICATION_PAGE} className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          {!mobile ? <h1 className="page-title">{t('verificacion', 'title')}</h1> : null}
          <p className="m-0 text-[12.5px] text-fg-2" aria-live="polite">
            {data ? t('verificacion', 'subtitle', { total: data.total, runs: data.totalRuns }) : '…'}
          </p>
        </div>
        <button
          type="button"
          data-testid={VERIFICACION_TESTIDS.VERIFICATION_REPORT}
          disabled={reportDisabled}
          title={reportDisabled ? t('verificacion', 'reportDisabled') : undefined}
          onClick={() => void downloadReport(state.program ? { program: state.program } : {})}
          className="btn btn-primary !h-8 !px-3"
        >
          <DownloadIcon size={12} />
          {t('verificacion', 'report')}
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[200px] flex-1 sm:max-w-[320px]">
          <SearchIcon size={13} className="pointer-events-none absolute top-[10px] left-[9px] text-fg-3" />
          <input
            type="search"
            data-testid={VERIFICACION_TESTIDS.VERIFICATION_SEARCH}
            aria-label={t('verificacion', 'searchLabel')}
            placeholder={t('verificacion', 'searchPlaceholder')}
            value={searchDraft}
            onChange={(event) => setSearchDraft(event.target.value)}
            className="input input-filter !h-8 pl-7"
          />
        </div>
        <div className="flex items-center gap-1.5 text-[12px] text-fg-2">
          <label htmlFor="verification-program">{t('verificacion', 'filterProgram')}</label>
          <select
            id="verification-program"
            data-testid={VERIFICACION_TESTIDS.VERIFICATION_FILTER_PROGRAM}
            value={state.program}
            onChange={(event) => change({ ...state, program: event.target.value, page: 1 })}
            className="input input-filter !h-8 !w-auto max-w-[220px]"
          >
            <option value="">{t('verificacion', 'allPrograms')}</option>
            {programs.map((program) => (
              <option key={program.code} value={program.code}>
                {program.code}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-1.5 text-[12px] text-fg-2">
          <label htmlFor="verification-result">{t('verificacion', 'filterResult')}</label>
          <select
            id="verification-result"
            data-testid={VERIFICACION_TESTIDS.VERIFICATION_FILTER_RESULT}
            value={state.result}
            onChange={(event) => change({ ...state, result: event.target.value as VerificationState['result'], page: 1 })}
            className="input input-filter !h-8 !w-auto"
          >
            <option value="">{t('verificacion', 'allResults')}</option>
            {TEST_RESULTS.map((result) => (
              <option key={result} value={result}>
                {t('verificacion', `r_${result}`)}
              </option>
            ))}
            <option value="none">{t('verificacion', 'neverRun')}</option>
          </select>
        </div>
        {filtered ? (
          <button type="button" data-testid={VERIFICACION_TESTIDS.VERIFICATION_FILTERS_CLEAR} onClick={clearFilters} className="btn btn-ghost !h-8 !px-2.5">
            {t('verificacion', 'clearFilters')}
          </button>
        ) : null}
      </div>

      {selected.length > 0 && !mobile ? (
        <div role="region" aria-label={t('verificacion', 'bulkActions')} data-testid={VERIFICACION_TESTIDS.VERIFICATION_BULK_BAR} className="flex flex-wrap items-center gap-2 rounded-card border border-accent bg-accent-soft px-3 py-2">
          <span data-testid={VERIFICACION_TESTIDS.VERIFICATION_BULK_COUNT} className="font-medium">
            {t('verificacion', 'bulkSelected', { n: selected.length })}
          </span>
          <button type="button" data-testid={VERIFICACION_TESTIDS.VERIFICATION_BULK_REPORT} onClick={() => void downloadReport({ codes: selected.join(',') })} className="btn btn-secondary !h-7 !px-2.5 !text-[12px]">
            <DownloadIcon size={12} />
            {t('verificacion', 'reportBulk')}
          </button>
          <button type="button" data-testid={VERIFICACION_TESTIDS.VERIFICATION_BULK_CLEAR} onClick={() => setSelected([])} className="btn btn-ghost !h-7 !px-2.5 !text-[12px]">
            {t('verificacion', 'clearSelection')}
          </button>
        </div>
      ) : null}

      {isError ? (
        <div role="alert" data-testid={VERIFICACION_TESTIDS.VERIFICATION_ERROR} className="alert alert-danger flex flex-wrap items-center justify-between gap-3 !px-3.5 !py-3">
          <div>
            <div className="font-semibold">{t('verificacion', 'errorTitle')}</div>
            <div className="trace !text-[12.5px]">{error instanceof ApiError ? formatTrace(error) : t('common', 'networkError')}</div>
          </div>
          <button type="button" data-testid={VERIFICACION_TESTIDS.VERIFICATION_ERROR_RETRY} onClick={reload} className="btn btn-danger-outline !h-[30px] !px-3">
            {t('verificacion', 'retry')}
          </button>
        </div>
      ) : null}

      {!mobile ? (
        <div className="overflow-hidden rounded-card border border-border bg-surface">
          <div className="overflow-x-auto">
            <table data-testid={VERIFICACION_TESTIDS.VERIFICATION_TABLE} aria-busy={loading} aria-describedby="verification-count" className="data-table w-full min-w-[760px] border-collapse text-[12.5px]">
              <thead>
                <tr className="border-b border-border">
                  <th scope="col" className="w-9 py-0 pr-2 pl-3 text-left">
                    <input
                      ref={selectAllRef}
                      type="checkbox"
                      data-testid={VERIFICACION_TESTIDS.VERIFICATION_SELECT_ALL}
                      aria-label={t('verificacion', 'selectAll')}
                      checked={allSelected}
                      onChange={toggleAll}
                      disabled={rows.length === 0}
                      className="size-4 cursor-pointer accent-accent"
                    />
                  </th>
                  {COLUMNS.map((column) => {
                    const active = state.sort === column.key;
                    return (
                      <th key={column.key} scope="col" aria-sort={active ? (state.dir === 'asc' ? 'ascending' : 'descending') : 'none'} style={{ width: column.width }} className={`h-9 px-2 text-[11.5px] font-medium text-fg-2 ${column.right ? 'text-right' : 'text-left'}`}>
                        <button
                          type="button"
                          data-testid={VERIFICACION_DYNAMIC_TESTIDS.TESTCASE_SORT(column.key)}
                          onClick={() => change(nextSort(state, column.key))}
                          className="inline-flex cursor-pointer items-center gap-1 border-0 bg-transparent p-0 font-medium text-inherit hover:text-fg"
                        >
                          {headerLabels[column.key]}
                          <SortIcon size={9} className={active ? 'text-accent' : 'text-fg-3'} />
                        </button>
                      </th>
                    );
                  })}
                  <th scope="col" className="w-12 px-2 text-left">
                    <span className="sr-only">{t('verificacion', 'colActions')}</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {showSkeleton
                  ? Array.from({ length: SKELETON_ROWS }, (_, index) => (
                      <tr key={index} data-testid={PROGRAMAS_TESTIDS.SKELETON_ROW} className="border-b border-border">
                        <td className="py-3 pl-3">
                          <span className="skeleton block size-4" />
                        </td>
                        {COLUMNS.map((column) => (
                          <td key={column.key} className="px-2 py-3">
                            <span className="skeleton block h-4 w-3/4" />
                          </td>
                        ))}
                        <td />
                      </tr>
                    ))
                  : rows.map((testCase) => (
                      <tr key={testCase.code} data-testid={VERIFICACION_DYNAMIC_TESTIDS.TESTCASE_ROW(testCase.code)} data-state={testCase.lastResult ?? 'none'} aria-selected={selected.includes(testCase.code)} className="border-b border-border last:border-b-0 hover:bg-surface-2 aria-selected:bg-accent-soft">
                        <td className="py-1.5 pr-2 pl-3">
                          <input
                            type="checkbox"
                            data-testid={VERIFICACION_DYNAMIC_TESTIDS.TESTCASE_SELECT(testCase.code)}
                            aria-label={t('verificacion', 'selectRow', { code: testCase.code })}
                            checked={selected.includes(testCase.code)}
                            onChange={() => toggleOne(testCase.code)}
                            className="size-4 cursor-pointer accent-accent"
                          />
                        </td>
                        <td className="px-2 py-1.5 font-mono text-[12px] font-medium">
                          <Link to={`/verification/${testCase.code}`} data-testid={VERIFICACION_DYNAMIC_TESTIDS.TESTCASE_LINK(testCase.code)}>
                            {testCase.code}
                          </Link>
                        </td>
                        <td className="max-w-[320px] truncate px-2 py-1.5" title={testCase.title}>
                          {testCase.title}
                        </td>
                        <td className="px-2 py-1.5 font-mono text-[12px] text-fg-2" title={testCase.programName}>
                          {testCase.programCode}
                        </td>
                        <td className="px-2 py-1.5">
                          <ResultBadge result={testCase.lastResult} />
                        </td>
                        <td className="px-2 py-1.5 text-right font-mono text-[12px]">{testCase.runCount}</td>
                        <td className="px-2 py-1.5">
                          <RowMenuButton
                            label={t('verificacion', 'rowActions', { code: testCase.code })}
                            buttonTestId={VERIFICACION_DYNAMIC_TESTIDS.TESTCASE_ROW_MENU(testCase.code)}
                            menuTestId={VERIFICACION_TESTIDS.TESTCASE_MENU}
                            items={menuItems(testCase)}
                          />
                        </td>
                      </tr>
                    ))}
              </tbody>
            </table>
          </div>
          {isEmpty ? emptyBlock : null}
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border px-3 py-2 text-[12px] text-fg-2">
            <span id="verification-count" data-testid={VERIFICACION_TESTIDS.VERIFICATION_COUNT} aria-live="polite">
              {rangeLabel}
            </span>
            <Pagination page={data?.page ?? 1} pages={data?.pages ?? 1} onPage={(page) => change({ ...state, page })} ids={pager.ids} labels={pager.labels} />
          </div>
        </div>
      ) : (
        <>
          <ul aria-busy={loading} className="m-0 flex list-none flex-col gap-2 p-0">
            {showSkeleton
              ? Array.from({ length: 4 }, (_, index) => (
                  <li key={index} data-testid={PROGRAMAS_TESTIDS.SKELETON_ROW} className="card flex flex-col gap-2 p-3">
                    <span className="skeleton h-4 w-1/3" />
                    <span className="skeleton h-4 w-full" />
                  </li>
                ))
              : rows.map((testCase) => (
                  <li key={testCase.code} data-testid={VERIFICACION_DYNAMIC_TESTIDS.TESTCASE_ROW(testCase.code)} data-state={testCase.lastResult ?? 'none'} className="card flex flex-col gap-1.5 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <Link to={`/verification/${testCase.code}`} data-testid={VERIFICACION_DYNAMIC_TESTIDS.TESTCASE_LINK(testCase.code)} className="font-mono text-[12.5px] font-medium">
                        {testCase.code}
                      </Link>
                      <ResultBadge result={testCase.lastResult} />
                    </div>
                    <div>{testCase.title}</div>
                    <div className="flex items-center justify-between text-[12px] text-fg-2">
                      <span className="font-mono">{testCase.programCode}</span>
                      <span>
                        {testCase.runCount} {t('verificacion', 'colRuns').toLowerCase()}
                      </span>
                    </div>
                  </li>
                ))}
          </ul>
          {isEmpty ? emptyBlock : null}
          {rows.length > 0 ? (
            <div className="flex items-center justify-between gap-2 pt-1 pb-2 text-[12px] text-fg-2">
              <span data-testid={VERIFICACION_TESTIDS.VERIFICATION_COUNT}>{rangeLabel}</span>
              <Pagination compact page={data?.page ?? 1} pages={data?.pages ?? 1} onPage={(page) => change({ ...state, page })} ids={pager.ids} labels={pager.labels} />
            </div>
          ) : null}
        </>
      )}
    </div>
  );
};
