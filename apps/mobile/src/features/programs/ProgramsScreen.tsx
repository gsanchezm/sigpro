import { MOVIL_TESTIDS, PROGRAMAS_TESTIDS, formatTrace } from '@sigpro/shared';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useI18n, useTexts } from '../../state/i18n';
import { Button } from '../../ui/Button';
import { Screen } from '../../ui/Screen';
import { EmptyState, ErrorState, LoadingState } from '../../ui/States';
import { Text } from '../../ui/Text';
import { ProgramCard } from './ProgramCard';
import { ProgramsFilterBar } from './ProgramsFilterBar';
import { NO_FILTERS, SEARCH_DEBOUNCE_MS, choiceOf, choiceToStatus, filtersToParams, firstParam, hasActiveFilters, hasMorePages, parseProgramsFilters, rangeLabel, type StatusChoice } from './params';
import { PROGRAMS_TEXTS } from './texts';
import { MOVIL_PROGRAMS_TESTIDS } from './testids';
import { usePagedPrograms } from './usePagedPrograms';

/**
 * Lista de programas (`/programs`): tarjetas con filtros por estado y búsqueda. El estado de los filtros vive en la URL
 * (`/programs?status=on_hold&q=gestión`); el buscador va con un borrador y escribe en la URL tras 250 ms sin teclear.
 */
export const ProgramsScreen = () => {
  const { t } = useI18n();
  const texts = useTexts(PROGRAMS_TEXTS);
  const router = useRouter();
  const params = useLocalSearchParams<{ status?: string; q?: string }>();
  const urlQ = firstParam(params.q) ?? '';
  const urlStatus = firstParam(params.status) ?? '';
  const filters = useMemo(() => parseProgramsFilters(urlQ, urlStatus), [urlQ, urlStatus]);
  const list = usePagedPrograms(filters);

  // Buscador: `draft` es lo que se ve; `pushed` recuerda el último texto que se escribió en la URL.
  // Así, la URL que vuelve tras un `setParams` no pisa lo que el usuario sigue escribiendo.
  const [draft, setDraft] = useState(filters.q);
  const pushed = useRef(filters.q);

  // La URL cambió por otro lado (atrás/adelante): el buscador sigue a la URL
  useEffect(() => {
    if (filters.q === pushed.current) return;
    pushed.current = filters.q;
    setDraft(filters.q);
  }, [filters.q]);

  // Tras 250 ms sin teclear, el texto va a la URL (la lista se vuelve a pedir con el nuevo `q`)
  useEffect(() => {
    const value = draft.trim();
    if (value === pushed.current) return;
    const timer = setTimeout(() => {
      pushed.current = value;
      router.setParams({ q: value || undefined });
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [draft, router]);

  const choice = choiceOf(filters);
  const filtered = hasActiveFilters(filters);

  const chooseStatus = (option: StatusChoice) => router.setParams({ status: choiceToStatus(option) || undefined });

  const clearFilters = () => {
    pushed.current = '';
    setDraft('');
    router.setParams(filtersToParams(NO_FILTERS));
  };

  const openProgram = (code: string) => router.push(`/programs/${encodeURIComponent(code)}`);

  const traceOf = (failure: unknown): string => formatTrace(failure) || t('common', 'networkError');

  const { phase, items, meta, error, loadingMore, moreError } = list;
  const canLoadMore = meta !== null && hasMorePages(meta.page, meta.pages) && moreError === null;
  const subtitle = meta ? `${meta.totalAll} ${t('programas', 'programs').toLowerCase()} · ${meta.activeCount} ${t('programas', 'st_active').toLowerCase()}` : '…';

  return (
    <Screen title={t('programas', 'programs')} subtitle={subtitle} testID={MOVIL_TESTIDS.PROGRAMS_PAGE}>
      <ProgramsFilterBar query={draft} onQueryChange={setDraft} choice={choice} onChoice={chooseStatus} filtered={filtered} onClear={clearFilters} />

      {phase === 'loading' ? <LoadingState testID={MOVIL_PROGRAMS_TESTIDS.PROGRAMS_LOADING} /> : null}

      {phase === 'error' ? (
        <ErrorState
          testID={PROGRAMAS_TESTIDS.PROGRAMS_ERROR}
          retryTestID={PROGRAMAS_TESTIDS.PROGRAMS_ERROR_RETRY}
          title={t('programas', 'errorTitle')}
          trace={traceOf(error)}
          onRetry={list.reload}
        />
      ) : null}

      {phase === 'ready' && items.length === 0 ? (
        <EmptyState
          testID={PROGRAMAS_TESTIDS.PROGRAMS_EMPTY}
          title={t('programas', 'emptyTitle')}
          hint={filtered ? t('programas', 'emptyFiltered') : t('programas', 'emptyNone')}
          action={filtered ? { label: t('programas', 'clearFilters'), testID: PROGRAMAS_TESTIDS.PROGRAMS_EMPTY_CLEAR, onPress: clearFilters } : undefined}
        />
      ) : null}

      {phase === 'ready' && items.length > 0 ? (
        <View style={styles.block}>
          <Text variant="small" tone="muted" testID={PROGRAMAS_TESTIDS.PROGRAMS_COUNT} aria-live="polite">
            {rangeLabel(items.length, meta?.total ?? 0, t('programas', 'shown'))}
          </Text>
          <View role="list" testID={MOVIL_TESTIDS.PROGRAMS_CARDS} aria-busy={loadingMore} style={styles.block}>
            {items.map((program) => (
              <ProgramCard key={program.code} program={program} onOpen={openProgram} />
            ))}
          </View>
          {moreError !== null ? (
            <ErrorState
              testID={PROGRAMAS_TESTIDS.PROGRAMS_ERROR}
              retryTestID={PROGRAMAS_TESTIDS.PROGRAMS_ERROR_RETRY}
              title={t('programas', 'errorTitle')}
              trace={traceOf(moreError)}
              onRetry={list.loadMore}
            />
          ) : null}
          {canLoadMore ? <Button label={texts.loadMore} testID={MOVIL_TESTIDS.PROGRAMS_LOAD_MORE} busy={loadingMore} onPress={list.loadMore} /> : null}
        </View>
      ) : null}
    </Screen>
  );
};

const styles = StyleSheet.create({
  block: { gap: 8 },
});
