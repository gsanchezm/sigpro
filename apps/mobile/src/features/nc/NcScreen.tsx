import { NC_TESTIDS, type Role } from '@sigpro/shared';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useAuth } from '../../state/auth';
import { useI18n, useTexts } from '../../state/i18n';
import { SPACING } from '../../theme/tokens';
import { EmptyState, ErrorState } from '../../ui/States';
import { Screen } from '../../ui/Screen';
import { Text } from '../../ui/Text';
import { countOpen } from './board';
import { isFiltered, type NcFilters, type SeverityFilter } from './filters';
import { SEARCH_DEBOUNCE_MS, useDebouncedValue, useNcBoard } from './hooks';
import { NcBoard } from './NcBoard';
import { NcDetailSheet } from './NcDetailSheet';
import { NcFilterBar } from './NcFilterBar';
import { NC_SCREEN_TEXTS } from './texts';

/**
 * No conformidades (`/nc`): tablero por estado con filtros del servidor, detalle en hoja y cambio de estado.
 * Los filtros viajan a `api.nc.list`; el texto se pide con un pequeño retardo para no lanzar una petición por tecla.
 */
export const NcScreen = () => {
  const { t } = useI18n();
  const texts = useTexts(NC_SCREEN_TEXTS);
  const { user } = useAuth();
  const role: Role = user?.role ?? 'auditor';

  const [search, setSearch] = useState('');
  const [severity, setSeverity] = useState<SeverityFilter>('all');
  const q = useDebouncedValue(search.trim(), SEARCH_DEBOUNCE_MS);
  const filters: NcFilters = { q, severity };
  const board = useNcBoard(filters);
  const [selected, setSelected] = useState<string | null>(null);

  const items = board.data?.items ?? [];
  const filtered = isFiltered(filters);
  const countText =
    board.data === null
      ? '…'
      : filtered
        ? t('nc', 'countFiltered', { shown: items.length, total: board.data.totalAll })
        : t('nc', 'count', { total: board.data.total, open: countOpen(items) });

  const clearFilters = () => {
    setSearch('');
    setSeverity('all');
  };

  return (
    <Screen title={t('nc', 'title')} subtitle={texts.subtitle} testID={NC_TESTIDS.NC_PAGE} scroll={false}>
      <NcFilterBar search={search} onSearch={setSearch} severity={severity} onSeverity={setSeverity} />

      <Text variant="small" tone="muted" testID={NC_TESTIDS.NC_COUNT}>
        {countText}
      </Text>

      {board.error !== null ? (
        <ErrorState testID={NC_TESTIDS.NC_ERROR} retryTestID={NC_TESTIDS.NC_ERROR_RETRY} title={t('nc', 'errorTitle')} trace={board.error} onRetry={board.reload} />
      ) : (
        <View style={styles.grow}>
          {board.data !== null && items.length === 0 ? (
            <EmptyState
              testID={NC_TESTIDS.NC_EMPTY}
              title={t('nc', 'emptyTitle')}
              hint={filtered ? t('nc', 'emptyFiltered') : t('nc', 'emptyNone')}
              action={filtered ? { label: t('nc', 'clearFilters'), testID: NC_TESTIDS.NC_EMPTY_CLEAR, onPress: clearFilters } : undefined}
            />
          ) : null}
          <NcBoard data={board.data} loading={board.loading} onOpen={setSelected} />
        </View>
      )}

      {selected !== null ? <NcDetailSheet key={selected} code={selected} role={role} onClose={() => setSelected(null)} onChanged={board.reload} /> : null}
    </Screen>
  );
};

const styles = StyleSheet.create({
  grow: { flex: 1, gap: SPACING.sm },
});
