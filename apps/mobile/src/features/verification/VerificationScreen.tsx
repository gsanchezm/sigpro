import { ApiError, formatTrace, type TestCaseSortColumn } from '@sigpro/shared';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useAuth } from '../../state/auth';
import { useTheme } from '../../state/theme';
import { RADIUS, SPACING } from '../../theme/tokens';
import { useI18n, useTexts } from '../../state/i18n';
import { Button } from '../../ui/Button';
import { Screen } from '../../ui/Screen';
import { EmptyState, ErrorState, LoadingState } from '../../ui/States';
import { Text } from '../../ui/Text';
import { ToggleButton } from '../../ui/ToggleButton';
import { TestCaseCard } from './TestCaseCard';
import { TestCaseMenu } from './TestCaseMenu';
import { VerificationFilterBar } from './VerificationFilterBar';
import { clearedFilters, filtersToParams, firstParam, hasActiveFilters, hasMorePages, nextSort, parseFilters, rangeOf, type ResultFilter } from './params';
import { MOVIL_VERIFICATION_TESTIDS, VERIFICACION_TESTIDS } from './testids';
import { VERIFICATION_TEXTS } from './texts';
import { useProgramOptions } from './useProgramOptions';
import { usePagedTestCases } from './usePagedTestCases';
import { useReport } from './useReport';
import { useSearchDraft } from './useSearchDraft';
import { canExecute, pruneSelection, reportDisabled, reportScope, toggleAllSelection, toggleSelection } from './view';

/**
 * Lista de casos de prueba (`/verification`): tarjetas con buscador, filtro por programa y por último resultado y orden por
 * columna, como la tabla de la web. El estado vive en la URL (`?q=&program=&result=&sort=&dir=`); «Cargar más» añade la
 * página siguiente. Cada tarjeta tiene su menú ⋯ (detalle, registrar ejecución, informe); «Seleccionar» activa la selección
 * múltiple con el informe de la selección; «Descargar informe PDF» pide el del programa filtrado o el de todo el tenant.
 */
export const VerificationScreen = () => {
  const { t } = useI18n();
  const texts = useTexts(VERIFICATION_TEXTS);
  const router = useRouter();
  const { colors } = useTheme();
  const { user } = useAuth();
  // Sin sesión no se llega aquí; por seguridad se asume el rol con menos permisos de escritura
  const canRun = canExecute(user?.role ?? 'auditor');
  const params = useLocalSearchParams<{ q?: string; program?: string; result?: string; sort?: string; dir?: string }>();
  const urlQ = firstParam(params.q);
  const urlProgram = firstParam(params.program);
  const urlResult = firstParam(params.result);
  const urlSort = firstParam(params.sort);
  const urlDir = firstParam(params.dir);
  const filters = useMemo(() => parseFilters({ q: urlQ, program: urlProgram, result: urlResult, sort: urlSort, dir: urlDir }), [urlQ, urlProgram, urlResult, urlSort, urlDir]);

  const list = usePagedTestCases(filters);
  const programs = useProgramOptions();
  const report = useReport();
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<readonly string[]>([]);
  const [menuCode, setMenuCode] = useState<string | null>(null);

  const commitQuery = useCallback((value: string) => router.setParams({ q: value || undefined }), [router]);
  const search = useSearchDraft(filters.q, commitQuery);

  const { phase, items, meta, error, loadingMore, moreError } = list;
  const total = meta?.total ?? 0;
  const codes = useMemo(() => items.map((testCase) => testCase.code), [items]);
  const menuCase = items.find((testCase) => testCase.code === menuCode) ?? null;
  const filtered = hasActiveFilters(filters);
  const canLoadMore = meta !== null && hasMorePages(meta.page, meta.pages) && moreError === null;
  const loadingFirst = phase === 'loading' && items.length === 0;
  const refreshing = phase === 'loading' || loadingMore;
  const traceOf = (failure: unknown): string => (failure instanceof ApiError ? formatTrace(failure) : t('common', 'networkError'));
  const reportOff = reportDisabled(phase, total);
  const range = rangeOf(items.length, total);

  // Cambiar filtros u orden vacía la selección, como la web; al recargar solo se quita lo que ya no está
  useEffect(() => setSelected([]), [filters]);
  useEffect(() => setSelected((current) => pruneSelection(current, codes)), [codes]);

  // Al volver del detalle (donde se pudo registrar una ejecución) la lista se pide de nuevo: la web lo hace al remontar la ruta
  const focused = useRef(false);
  const { reload } = list;
  useFocusEffect(
    useCallback(() => {
      if (focused.current) reload();
      focused.current = true;
    }, [reload]),
  );

  const apply = (next: ReturnType<typeof parseFilters>) => router.setParams(filtersToParams(next));
  const chooseProgram = (program: string) => apply({ ...filters, program });
  const chooseResult = (result: ResultFilter) => apply({ ...filters, result });
  const chooseSort = (column: TestCaseSortColumn) => apply(nextSort(filters, column));
  const clearFilters = () => {
    search.reset();
    apply(clearedFilters(filters));
  };

  const openCase = (code: string) => router.push(`/verification/${encodeURIComponent(code)}`);
  const runCase = (code: string) => router.push(`/verification/${encodeURIComponent(code)}?run=1`);
  const toggleSelectMode = () => {
    setSelectMode((current) => !current);
    setSelected([]);
  };

  return (
    <Screen title={t('verificacion', 'title')} subtitle={meta ? t('verificacion', 'subtitle', { total: meta.total, runs: meta.totalRuns }) : '…'} testID={VERIFICACION_TESTIDS.VERIFICATION_PAGE}>
      <VerificationFilterBar
        filters={filters}
        query={search.draft}
        onQueryChange={search.setDraft}
        programs={programs}
        onProgram={chooseProgram}
        onResult={chooseResult}
        onSort={chooseSort}
        filtered={filtered}
        onClear={clearFilters}
      />

      <View style={styles.toolbar}>
        <ToggleButton label={texts.select} pressed={selectMode} onPress={toggleSelectMode} testID={MOVIL_VERIFICATION_TESTIDS.SELECT_MODE} />
        <View style={styles.reportBox}>
          <Button
            label={t('verificacion', 'report')}
            testID={VERIFICACION_TESTIDS.VERIFICATION_REPORT}
            variant="primary"
            disabled={reportOff}
            disabledReason={reportOff ? t('verificacion', 'reportDisabled') : undefined}
            busy={report.busy}
            onPress={() => void report.download(reportScope(filters.program))}
          />
          {reportOff ? (
            <Text variant="small" tone="faint" testID={MOVIL_VERIFICATION_TESTIDS.REPORT_REASON}>
              {t('verificacion', 'reportDisabled')}
            </Text>
          ) : null}
        </View>
      </View>

      {selectMode && items.length > 0 ? (
        <Button
          label={t('verificacion', 'selectAll')}
          testID={VERIFICACION_TESTIDS.VERIFICATION_SELECT_ALL}
          variant="ghost"
          accessibilityLabel={t('verificacion', 'selectAll')}
          onPress={() => setSelected((current) => toggleAllSelection(current, codes))}
        />
      ) : null}

      {selected.length > 0 ? (
        <View role="toolbar" aria-label={t('verificacion', 'bulkActions')} testID={VERIFICACION_TESTIDS.VERIFICATION_BULK_BAR} style={[styles.bulk, { borderColor: colors.accent, backgroundColor: colors.accentSoft }]}>
          <Text variant="label" testID={VERIFICACION_TESTIDS.VERIFICATION_BULK_COUNT}>
            {t('verificacion', 'bulkSelected', { n: selected.length })}
          </Text>
          <View style={styles.actions}>
            <Button label={t('verificacion', 'reportBulk')} testID={VERIFICACION_TESTIDS.VERIFICATION_BULK_REPORT} busy={report.busy} onPress={() => void report.download({ codes: selected.join(',') })} />
            <Button label={t('verificacion', 'clearSelection')} testID={VERIFICACION_TESTIDS.VERIFICATION_BULK_CLEAR} variant="ghost" onPress={() => setSelected([])} />
          </View>
        </View>
      ) : null}

      {loadingFirst ? <LoadingState testID={MOVIL_VERIFICATION_TESTIDS.LOADING} /> : null}

      {phase === 'error' ? (
        <ErrorState
          testID={VERIFICACION_TESTIDS.VERIFICATION_ERROR}
          retryTestID={VERIFICACION_TESTIDS.VERIFICATION_ERROR_RETRY}
          title={t('verificacion', 'errorTitle')}
          trace={traceOf(error)}
          onRetry={list.reload}
        />
      ) : null}

      {phase === 'ready' && items.length === 0 ? (
        <EmptyState
          testID={VERIFICACION_TESTIDS.VERIFICATION_EMPTY}
          title={t('verificacion', 'emptyTitle')}
          hint={filtered ? t('verificacion', 'emptyFiltered') : t('verificacion', 'emptyNone')}
          action={filtered ? { label: t('verificacion', 'clearFilters'), testID: VERIFICACION_TESTIDS.VERIFICATION_EMPTY_CLEAR, onPress: clearFilters } : undefined}
        />
      ) : null}

      {items.length > 0 ? (
        <View style={styles.block}>
          <Text variant="small" tone="muted" testID={VERIFICACION_TESTIDS.VERIFICATION_COUNT} aria-live="polite">
            {t('verificacion', 'count', range)}
          </Text>
          <View role="list" aria-busy={refreshing} style={styles.block}>
            {items.map((testCase) => (
              <TestCaseCard
                key={testCase.code}
                testCase={testCase}
                selectMode={selectMode}
                selected={selected.includes(testCase.code)}
                onOpen={openCase}
                onToggle={(code) => setSelected((current) => toggleSelection(current, code))}
                onMenu={setMenuCode}
              />
            ))}
          </View>
          {moreError !== null ? (
            <ErrorState
              testID={VERIFICACION_TESTIDS.VERIFICATION_ERROR}
              retryTestID={VERIFICACION_TESTIDS.VERIFICATION_ERROR_RETRY}
              title={t('verificacion', 'errorTitle')}
              trace={traceOf(moreError)}
              onRetry={list.loadMore}
            />
          ) : null}
          {canLoadMore ? <Button label={texts.loadMore} testID={MOVIL_VERIFICATION_TESTIDS.LOAD_MORE} busy={loadingMore} onPress={list.loadMore} /> : null}
        </View>
      ) : null}

      <TestCaseMenu
        testCase={menuCase}
        canRun={canRun}
        onClose={() => setMenuCode(null)}
        onView={openCase}
        onRun={runCase}
        onReport={(code) => void report.download({ codes: code })}
      />
    </Screen>
  );
};

const styles = StyleSheet.create({
  block: { gap: 8 },
  toolbar: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-start', gap: 8 },
  reportBox: { gap: 4, flexShrink: 1 },
  bulk: { gap: SPACING.sm, borderWidth: 1, borderRadius: RADIUS.lg, padding: SPACING.md },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'flex-start' },
});
