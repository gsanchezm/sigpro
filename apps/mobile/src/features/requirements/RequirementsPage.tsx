import { ApiError, REQUISITOS_TESTIDS, formatTrace, type RequirementDto } from '@sigpro/shared';
import { Link } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useI18n } from '../../state/i18n';
import { useTheme } from '../../state/theme';
import { FONT_FAMILY } from '../../theme/fonts';
import { RADIUS } from '../../theme/tokens';
import { Card } from '../../ui/Card';
import { Screen } from '../../ui/Screen';
import { Segmented } from '../../ui/Segmented';
import { EmptyState, ErrorState, LoadingState } from '../../ui/States';
import { Text } from '../../ui/Text';
import { TextField } from '../../ui/TextField';
import { RequirementRow } from './RequirementRow';
import { RequirementsDocument } from './RequirementsDocument';
import { RequirementsMetrics } from './RequirementsMetrics';
import { RequirementSheet } from './RequirementSheet';
import { MOVIL_REQUIREMENTS_TESTIDS } from './testids';
import { useRequirementsData } from './useRequirementsData';
import { NO_CODES, filterRequirements, normalizeQuery, requirementRows, toggleCollapsed } from './view';

const NO_ITEMS: readonly RequirementDto[] = [];

type ViewMode = 'tree' | 'document';

/** Motivo de un error en una línea: la traza HTTP de la API o un texto de red. */
const traceOf = (failure: unknown, networkText: string): string => (failure instanceof ApiError ? formatTrace(failure) : networkText);

/**
 * `/programs/:code/requirements`: árbol de solo lectura con sangría, plegado y búsqueda (conserva los ancestros de cada
 * coincidencia). Tocar una fila abre el detalle en una hoja. Sin edición, reordenación, matriz ni CSV.
 */
export const RequirementsPage = ({ programCode }: { readonly programCode: string }) => {
  const { t } = useI18n();
  const { colors } = useTheme();
  const { status, data, failure, reload } = useRequirementsData(programCode);
  const [query, setQuery] = useState('');
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(NO_CODES);
  const [selected, setSelected] = useState<string | null>(null);
  const [view, setView] = useState<ViewMode>('tree');

  const items = data?.items ?? NO_ITEMS;
  const needle = normalizeQuery(query);
  const rows = useMemo(() => requirementRows(items, needle, collapsed), [items, needle, collapsed]);
  const filtered = useMemo(() => filterRequirements(items, needle), [items, needle]);
  const shown = filtered.length;
  const selectedItem = useMemo(() => items.find((item) => item.code === selected) ?? null, [items, selected]);
  const toggle = useCallback((code: string) => setCollapsed((current) => toggleCollapsed(current, code)), []);
  const open = useCallback((code: string) => setSelected(code), []);
  const close = useCallback(() => setSelected(null), []);

  const loading = status === 'loading';
  const notFound = status === 'error' && failure instanceof ApiError && failure.status === 404;
  const title = t('requisitos', 'title');
  const programName = data?.program.name ?? '';

  if (notFound) {
    return (
      <Screen title={title} testID={REQUISITOS_TESTIDS.REQUIREMENTS_PAGE}>
        <View role="alert" testID={REQUISITOS_TESTIDS.REQUIREMENTS_NOT_FOUND} style={styles.notFound}>
          <Text variant="heading" tone="danger">
            {t('requisitos', 'programNotFound')}
          </Text>
          <Text variant="mono" tone="muted" style={styles.centered}>
            {formatTrace(failure)}
          </Text>
          <Link href="/programs" testID={MOVIL_REQUIREMENTS_TESTIDS.NOT_FOUND_BACK} style={{ color: colors.accent }}>
            {t('common', 'backToPrograms')}
          </Link>
        </View>
      </Screen>
    );
  }

  return (
    <Screen title={title} testID={REQUISITOS_TESTIDS.REQUIREMENTS_PAGE}>
      <Card aria-label={`${t('requisitos', 'programLabel')} ${programCode}`} style={styles.header}>
        <Text variant="mono" tone="muted" testID={REQUISITOS_TESTIDS.REQUIREMENTS_PROGRAM}>
          {programCode}
        </Text>
        {programName ? (
          <Text variant="heading" testID={MOVIL_REQUIREMENTS_TESTIDS.PROGRAM_NAME}>
            {programName}
          </Text>
        ) : null}
        <Link href={`/programs/${programCode}`} testID={MOVIL_REQUIREMENTS_TESTIDS.BACK_TO_PROGRAM} style={{ color: colors.accent, fontSize: 13, fontFamily: FONT_FAMILY.medium }}>
          {t('programas', 'backToDetail')}
        </Link>
      </Card>

      {status === 'error' ? null : <RequirementsMetrics items={items} loading={loading} />}

      <Segmented
        testID={REQUISITOS_TESTIDS.REQUIREMENTS_TABS}
        label={t('requisitos', 'tabsLabel')}
        value={view}
        onChange={setView}
        options={[
          { value: 'tree', label: t('requisitos', 'tabTree'), testID: REQUISITOS_TESTIDS.REQUIREMENTS_TAB_TREE },
          { value: 'document', label: t('requisitos', 'tabDocument'), testID: REQUISITOS_TESTIDS.REQUIREMENTS_TAB_DOCUMENT },
        ]}
      />

      <TextField
        label={t('requisitos', 'searchLabel')}
        placeholder={t('requisitos', 'searchPlaceholder')}
        testID={REQUISITOS_TESTIDS.REQUIREMENTS_SEARCH}
        value={query}
        onChangeText={setQuery}
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="search"
      />

      <View aria-live="polite">
        <Text variant="small" tone="muted" testID={REQUISITOS_TESTIDS.REQUIREMENTS_COUNT}>
          {data ? t('requisitos', 'count', { shown, total: items.length }) : ''}
        </Text>
      </View>

      {loading && data === null ? <LoadingState testID={MOVIL_REQUIREMENTS_TESTIDS.LOADING} /> : null}

      {status === 'error' ? (
        <ErrorState
          testID={REQUISITOS_TESTIDS.REQUIREMENTS_ERROR}
          retryTestID={REQUISITOS_TESTIDS.REQUIREMENTS_ERROR_RETRY}
          title={t('requisitos', 'errorTitle')}
          trace={traceOf(failure, t('common', 'networkError'))}
          onRetry={reload}
        />
      ) : null}

      {status === 'ready' && items.length === 0 ? (
        <EmptyState testID={REQUISITOS_TESTIDS.REQUIREMENTS_EMPTY} title={t('requisitos', 'emptyTitle')} hint={t('requisitos', 'emptyBody')} />
      ) : null}

      {status === 'ready' && items.length > 0 && shown === 0 ? (
        <EmptyState testID={REQUISITOS_TESTIDS.REQUIREMENTS_NO_MATCH} title={t('requisitos', 'noMatchTitle')} hint={t('requisitos', 'noMatchBody')} />
      ) : null}

      {view === 'document' && shown > 0 ? <RequirementsDocument items={filtered} onOpen={open} /> : null}

      {view === 'tree' && rows.length > 0 ? (
        <View role="list" aria-label={t('requisitos', 'treeLabel')} aria-busy={loading} testID={REQUISITOS_TESTIDS.REQUIREMENTS_TREE} style={[styles.tree, { borderColor: colors.border, backgroundColor: colors.surface, boxShadow: colors.shadow }]}>
          {rows.map((row) => (
            <RequirementRow key={row.item.code} row={row} onToggle={toggle} onOpen={open} />
          ))}
        </View>
      ) : null}

      <RequirementSheet item={selectedItem} onClose={close} />
    </Screen>
  );
};

const styles = StyleSheet.create({
  header: { gap: 4 },
  tree: { borderWidth: 1, borderRadius: RADIUS.lg, overflow: 'hidden' },
  notFound: { alignItems: 'center', gap: 8, paddingVertical: 32, paddingHorizontal: 16 },
  centered: { textAlign: 'center' },
});
