import { NC_TESTIDS, can, type CreateNcInput, type Role } from '@sigpro/shared';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useAuth } from '../../state/auth';
import { useI18n, useTexts } from '../../state/i18n';
import { useToast } from '../../state/toast';
import { SPACING } from '../../theme/tokens';
import { Button } from '../../ui/Button';
import { EmptyState, ErrorState } from '../../ui/States';
import { Screen } from '../../ui/Screen';
import { Text } from '../../ui/Text';
import { countOpen } from './board';
import { isFiltered, type NcFilters, type SeverityFilter } from './filters';
import { SEARCH_DEBOUNCE_MS, useDebouncedValue, useNcBoard } from './hooks';
import { NcBoard } from './NcBoard';
import { NcDetailSheet } from './NcDetailSheet';
import { NcNewDialog } from './NcNewDialog';
import { NcFilterBar } from './NcFilterBar';
import { NC_SCREEN_TEXTS } from './texts';
import { MOVIL_NC_TESTIDS } from './testids';

/**
 * No conformidades (`/nc`): tablero por estado con filtros del servidor, detalle en hoja y cambio de estado.
 * Los filtros viajan a `api.nc.list`; el texto se pide con un pequeño retardo para no lanzar una petición por tecla.
 */
export const NcScreen = () => {
  const { t } = useI18n();
  const texts = useTexts(NC_SCREEN_TEXTS);
  const { api, user } = useAuth();
  const toast = useToast();
  const role: Role = user?.role ?? 'auditor';
  const canCreate = can(role, 'nc.create');

  const [search, setSearch] = useState('');
  const [severity, setSeverity] = useState<SeverityFilter>('all');
  const q = useDebouncedValue(search.trim(), SEARCH_DEBOUNCE_MS);
  const filters: NcFilters = { q, severity };
  const board = useNcBoard(filters);
  const [selected, setSelected] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const router = useRouter();
  const { select } = useLocalSearchParams<{ select?: string }>();

  // `?select=NC-003` (un resultado de la búsqueda global) abre el detalle de esa NC y quita el parámetro: la pestaña sigue
  // montada y, sin quitarlo, el mismo resultado no volvería a abrirla
  useEffect(() => {
    if (typeof select !== 'string' || select === '') return;
    setSelected(select);
    router.setParams({ select: undefined });
  }, [select, router]);

  const items = board.data?.items ?? [];
  const filtered = isFiltered(filters);
  const countText =
    board.data === null
      ? '…'
      : filtered
        ? t('nc', 'countFiltered', { shown: items.length, total: board.data.totalAll })
        : t('nc', 'count', { total: board.data.total, open: countOpen(items) });

  /** Alta: el diálogo muestra el error si la API rechaza; con éxito se cierra y el tablero y el recuento se recargan. */
  const createNc = async (input: CreateNcInput) => {
    const created = await api.nc.create(input);
    setCreating(false);
    toast.push('ok', t('nc', 'created', { code: created.code }));
    board.reload();
  };

  const clearFilters = () => {
    setSearch('');
    setSeverity('all');
  };

  return (
    <Screen
      title={t('nc', 'title')}
      subtitle={texts.subtitle}
      testID={NC_TESTIDS.NC_PAGE}
      scroll={false}
      right={
        <Button
          label={t('nc', 'newButton')}
          testID={NC_TESTIDS.NC_NEW}
          variant="primary"
          disabled={!canCreate}
          disabledReason={canCreate ? undefined : t('nc', 'newDenied')}
          onPress={() => setCreating(true)}
        />
      }
    >
      {canCreate ? null : (
        <Text variant="small" tone="faint" testID={MOVIL_NC_TESTIDS.NEW_REASON}>
          {t('nc', 'newDenied')}
        </Text>
      )}
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

      {creating ? <NcNewDialog onClose={() => setCreating(false)} onSubmit={createNc} /> : null}
      {selected !== null ? <NcDetailSheet key={selected} code={selected} role={role} onClose={() => setSelected(null)} onChanged={board.reload} /> : null}
    </Screen>
  );
};

const styles = StyleSheet.create({
  grow: { flex: 1, gap: SPACING.sm },
});
