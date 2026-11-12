import { ApiError, AUDIT_ENTITIES, formatTrace, type AuditEntryDto, type Lang, type MessageKey } from '@sigpro/shared';
import { useEffect, type RefObject } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useI18n, useTexts } from '../../state/i18n';
import { useTheme } from '../../state/theme';
import { RADIUS } from '../../theme/tokens';
import { Avatar } from '../../ui/Avatar';
import { Button } from '../../ui/Button';
import { Card } from '../../ui/Card';
import { SelectField, type SelectOption } from '../../ui/SelectField';
import { EmptyState, ErrorState, LoadingState } from '../../ui/States';
import { Text } from '../../ui/Text';
import { TextField } from '../../ui/TextField';
import { commentTime } from '../nc/comments';
import { AUDITORIA_DYNAMIC_TESTIDS, AUDITORIA_TESTIDS, MOVIL_AUDIT_TESTIDS } from './testids';
import { AUDIT_TEXTS } from './texts';
import { useAuditFeed } from './useAuditFeed';
import { useAuditFilters } from './useAuditFilters';
import { actionKey, diffSummary, entityKey, hasActiveFilters, type DateIssue } from './view';

interface Props {
  /**
   * La pantalla que contiene el feed (`Screen`) avisa aquí de que el scroll llegó al final: el feed pide entonces la página
   * siguiente. Sin carga continua (p. ej. dentro de un diálogo) basta con el botón «Cargar más».
   */
  readonly nearEndRef?: RefObject<(() => void) | null>;
}

/**
 * Feed de auditoría (web: `AuditFeed`): filtros por entidad, rango de fechas (Desde–Hasta, escritas como AAAA-MM-DD) y texto,
 * y la lista de eventos con carga continua al llegar al final y el botón «Cargar más» (el único camino si falla una página).
 * Lo comparten la pantalla Auditoría y la sección «Auditoría» de Administración; quien lo monta ya comprobó el permiso
 * `audit.view`.
 */
export const AuditFeed = ({ nearEndRef }: Props) => {
  const { t, lang } = useI18n();
  const texts = useTexts(AUDIT_TEXTS);
  const controls = useAuditFilters();
  const { status, items, nextCursor, total, error, loadingMore, moreError, loadMore, reload } = useAuditFeed(controls.applied);
  const hasMore = nextCursor !== null;
  const loading = status === 'loading';
  const filtered = hasActiveFilters(controls.applied);

  // La carga continua no reintenta tras un fallo: lo hace el botón «Cargar más»
  useEffect(() => {
    if (!nearEndRef) return;
    nearEndRef.current = () => loadMore();
    return () => {
      nearEndRef.current = null;
    };
  }, [nearEndRef, loadMore]);

  const entityOptions: readonly SelectOption<string>[] = [
    { value: '', label: t('auditoria', 'allEntities') },
    ...AUDIT_ENTITIES.map((value) => ({ value, label: t('auditoria', entityKey(value) as MessageKey<'auditoria'>) })),
  ];
  const dateError = (issue: DateIssue | null): string | undefined => (issue === null ? undefined : issue === 'invalid' ? t('hitos', 'dateInvalid') : texts.rangeInvalid);
  const traceOf = (failure: unknown): string => (failure instanceof ApiError ? formatTrace(failure) : t('common', 'networkError'));

  return (
    <View style={styles.root}>
      <View style={styles.filters}>
        <SelectField
          label={t('auditoria', 'filterEntity')}
          value={controls.entity}
          options={entityOptions}
          onChange={controls.setEntity}
          testID={AUDITORIA_TESTIDS.AUDIT_FILTER_ENTITY}
        />
        <View style={styles.dates}>
          <View style={styles.date}>
            <TextField
              label={t('auditoria', 'filterFrom')}
              placeholder={texts.dateFormat}
              testID={AUDITORIA_TESTIDS.AUDIT_FILTER_FROM}
              value={controls.from}
              onChangeText={controls.setFrom}
              autoCapitalize="none"
              autoCorrect={false}
              maxLength={10}
              error={dateError(controls.range.fromIssue)}
              errorTestID={MOVIL_AUDIT_TESTIDS.FILTER_FROM_ERROR}
            />
          </View>
          <View style={styles.date}>
            <TextField
              label={t('auditoria', 'filterTo')}
              placeholder={texts.dateFormat}
              testID={AUDITORIA_TESTIDS.AUDIT_FILTER_TO}
              value={controls.to}
              onChangeText={controls.setTo}
              autoCapitalize="none"
              autoCorrect={false}
              maxLength={10}
              error={dateError(controls.range.toIssue)}
              errorTestID={MOVIL_AUDIT_TESTIDS.FILTER_TO_ERROR}
            />
          </View>
        </View>
        <TextField
          label={t('auditoria', 'searchLabel')}
          placeholder={t('auditoria', 'searchPlaceholder')}
          testID={AUDITORIA_TESTIDS.AUDIT_SEARCH}
          value={controls.search}
          onChangeText={controls.setSearch}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
        />
        {controls.dirty ? (
          <View style={styles.clear}>
            <Button label={t('auditoria', 'clearFilters')} variant="ghost" testID={AUDITORIA_TESTIDS.AUDIT_FILTERS_CLEAR} onPress={controls.clear} />
          </View>
        ) : null}
      </View>

      <View aria-live="polite">
        <Text variant="mono" tone="muted" testID={AUDITORIA_TESTIDS.AUDIT_COUNT}>
          {loading ? '…' : t('auditoria', 'count', { shown: items.length, total })}
        </Text>
      </View>

      {status === 'error' ? (
        <ErrorState testID={AUDITORIA_TESTIDS.AUDIT_ERROR} retryTestID={AUDITORIA_TESTIDS.AUDIT_ERROR_RETRY} title={t('auditoria', 'errorTitle')} trace={traceOf(error)} onRetry={reload} />
      ) : (
        <View role="feed" aria-label={t('auditoria', 'feedLabel')} aria-busy={loading || loadingMore} testID={AUDITORIA_TESTIDS.AUDIT_FEED} style={styles.feed}>
          {loading ? <LoadingState testID={MOVIL_AUDIT_TESTIDS.LOADING} /> : null}

          {loading
            ? null
            : items.map((item, index) => <AuditRow key={item.id} item={item} position={index + 1} total={total} lang={lang} />)}

          {status === 'ready' && items.length === 0 ? (
            <EmptyState testID={AUDITORIA_TESTIDS.AUDIT_EMPTY} title={t('auditoria', 'emptyTitle')} hint={filtered ? t('auditoria', 'emptyFiltered') : t('auditoria', 'emptyNone')} />
          ) : null}

          {loadingMore ? (
            <View role="status" testID={MOVIL_AUDIT_TESTIDS.LOADING_MORE} style={styles.more}>
              <ActivityIndicator />
              <Text variant="small" tone="muted">
                {t('auditoria', 'loadingMore')}
              </Text>
            </View>
          ) : null}

          {moreError ? <MoreError trace={traceOf(moreError)} /> : null}

          {hasMore && !loadingMore ? <Button label={t('auditoria', 'loadMore')} testID={AUDITORIA_TESTIDS.AUDIT_LOAD_MORE} onPress={() => loadMore(true)} /> : null}

          {!hasMore && !loading && items.length > 0 ? (
            <Text variant="small" tone="faint" testID={AUDITORIA_TESTIDS.AUDIT_END} style={styles.end}>
              {t('auditoria', 'end')}
            </Text>
          ) : null}
        </View>
      )}
    </View>
  );
};

/** Aviso de que la página siguiente no llegó: lo ya cargado se conserva y el botón «Cargar más» (debajo) la pide de nuevo. */
const MoreError = ({ trace }: { readonly trace: string }) => {
  const { colors } = useTheme();
  return (
    <View role="alert" testID={MOVIL_AUDIT_TESTIDS.MORE_ERROR} style={[styles.moreError, { backgroundColor: colors.dangerSoft, borderColor: colors.danger }]}>
      <Text variant="mono" tone="danger">
        {trace}
      </Text>
    </View>
  );
};

interface RowProps {
  readonly item: AuditEntryDto;
  readonly position: number;
  readonly total: number;
  readonly lang: Lang;
}

/** Evento: fecha y hora, quién, qué (texto y código de la acción), sobre qué entidad y el resumen del cambio. */
const AuditRow = ({ item, position, total, lang }: RowProps) => {
  const { t } = useI18n();
  const actor = item.actorName ?? t('auditoria', 'system');
  const key = actionKey(item.action) as MessageKey<'auditoria'>;
  const translated = t('auditoria', key);
  const summary = diffSummary(item.diff);
  return (
    <Card role="article" aria-posinset={position} aria-setsize={total} testID={AUDITORIA_DYNAMIC_TESTIDS.AUDIT_ROW(item.id)} dataSet={{ entity: item.entity, action: item.action }}>
      <View style={styles.rowTop}>
        <Text variant="mono" tone="muted">
          {commentTime(item.at, lang)}
        </Text>
        <View style={styles.actor}>
          <Avatar name={actor} size={22} />
          <Text variant="small" numberOfLines={1} style={styles.actorName}>
            {actor}
          </Text>
        </View>
      </View>
      <Text variant="label">{translated === key ? item.action : translated}</Text>
      <Text variant="mono" tone="faint">
        {item.action}
      </Text>
      <View style={styles.entity}>
        <Text variant="small" tone="muted">
          {t('auditoria', entityKey(item.entity) as MessageKey<'auditoria'>)}
        </Text>
        <Text variant="mono" weight="500">
          {item.entityId}
        </Text>
      </View>
      {summary ? (
        <Text variant="small" tone="faint">
          {summary}
        </Text>
      ) : null}
    </Card>
  );
};

const styles = StyleSheet.create({
  root: { gap: 16 },
  filters: { gap: 12 },
  dates: { flexDirection: 'row', gap: 12 },
  date: { flex: 1 },
  clear: { alignItems: 'flex-start' },
  feed: { gap: 10 },
  more: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 12 },
  moreError: { borderWidth: 1, borderRadius: RADIUS.sm, padding: 10 },
  end: { textAlign: 'center', paddingVertical: 8 },
  rowTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  actor: { flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1 },
  actorName: { flexShrink: 1 },
  entity: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
});
