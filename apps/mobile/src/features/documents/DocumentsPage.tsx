import { CLASSIFICATION_TONE, DOCUMENTOS_DYNAMIC_TESTIDS, DOCUMENTOS_TESTIDS, ApiError, formatDate, formatTrace, type DocumentDto } from '@sigpro/shared';
import { Link, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useI18n } from '../../state/i18n';
import { useTheme } from '../../state/theme';
import { RADIUS } from '../../theme/tokens';
import { Badge } from '../../ui/Badge';
import { Button } from '../../ui/Button';
import { Card } from '../../ui/Card';
import { Screen } from '../../ui/Screen';
import { EmptyState, ErrorState, LoadingState } from '../../ui/States';
import { Text } from '../../ui/Text';
import { TextField } from '../../ui/TextField';
import { MOVIL_DOCUMENTS_TESTIDS } from './testids';
import { DocumentMenu } from './DocumentMenu';
import { useDocumentDownload } from './useDocumentDownload';
import { useDocumentsList } from './useDocumentsData';
import { filterDocuments, normalizeQuery } from './view';

const NO_DOCUMENTS: readonly DocumentDto[] = [];

/** Motivo de un error en una línea: la traza HTTP de la API o un texto de red. */
const traceOf = (failure: unknown, networkText: string): string => (failure instanceof ApiError ? formatTrace(failure) : networkText);

/**
 * `/documents`: tarjetas con clasificación. Los restringidos no llegan para el rol consultor; la API dice cuántos hay
 * ocultos y se avisa con ese recuento. El filtro de texto busca por código o por título.
 */
export const DocumentsPage = () => {
  const { t } = useI18n();
  const { colors } = useTheme();
  const list = useDocumentsList();
  const [search, setSearch] = useState('');
  const needle = normalizeQuery(search);
  const docs = list.data?.items ?? NO_DOCUMENTS;
  const rows = useMemo(() => filterDocuments(docs, needle), [docs, needle]);
  const hidden = list.data?.hiddenCount ?? 0;
  const loading = list.status === 'loading';
  const clear = useCallback(() => setSearch(''), []);
  const router = useRouter();
  const downloads = useDocumentDownload();
  const [menuId, setMenuId] = useState<string | null>(null);

  return (
    <Screen title={t('documentos', 'title')} testID={DOCUMENTOS_TESTIDS.DOCUMENTS_PAGE}>
      <TextField
        label={t('documentos', 'searchLabel')}
        placeholder={t('documentos', 'searchPlaceholder')}
        testID={DOCUMENTOS_TESTIDS.DOCUMENTS_SEARCH}
        value={search}
        onChangeText={setSearch}
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="search"
      />
      {needle !== '' ? (
        <View style={styles.clearRow}>
          <Button label={t('documentos', 'clearFilters')} variant="ghost" testID={DOCUMENTOS_TESTIDS.DOCUMENTS_FILTERS_CLEAR} onPress={clear} />
        </View>
      ) : null}

      {hidden > 0 ? (
        // Aviso informativo (tono «info», como el `alert-info` de la web)
        <Card role="note" testID={DOCUMENTOS_TESTIDS.DOCUMENTS_HIDDEN_NOTE} style={{ backgroundColor: colors.infoSoft, borderColor: colors.info }}>
          <Text variant="small" style={{ color: colors.info }}>
            {t('documentos', 'hiddenNote', { n: hidden })}
          </Text>
        </Card>
      ) : null}

      {list.status === 'error' ? (
        <ErrorState
          testID={DOCUMENTOS_TESTIDS.DOCUMENTS_ERROR}
          retryTestID={DOCUMENTOS_TESTIDS.DOCUMENTS_ERROR_RETRY}
          title={t('documentos', 'errorTitle')}
          trace={traceOf(list.failure, t('common', 'networkError'))}
          onRetry={list.reload}
        />
      ) : null}

      {loading && list.data === null ? <LoadingState testID={MOVIL_DOCUMENTS_TESTIDS.LIST_LOADING} /> : null}

      {list.data ? (
        <View aria-live="polite">
          <Text variant="small" tone="muted" testID={DOCUMENTOS_TESTIDS.DOCUMENTS_COUNT}>
            {t('documentos', 'count', { n: rows.length })}
          </Text>
        </View>
      ) : null}

      {rows.length > 0 ? (
        <View role="list" aria-label={t('documentos', 'title')} aria-busy={loading} testID={DOCUMENTOS_TESTIDS.DOCUMENTS_TABLE} style={styles.list}>
          {rows.map((doc) => (
            <DocumentCard key={doc.id} doc={doc} onMenu={setMenuId} />
          ))}
        </View>
      ) : null}

      {list.status === 'ready' && docs.length === 0 ? (
        <EmptyState testID={DOCUMENTOS_TESTIDS.DOCUMENTS_EMPTY} title={t('documentos', 'emptyTitle')} hint={t('documentos', 'emptyNone')} />
      ) : null}

      {list.status === 'ready' && docs.length > 0 && rows.length === 0 ? (
        <EmptyState
          testID={DOCUMENTOS_TESTIDS.DOCUMENTS_EMPTY}
          title={t('documentos', 'emptyTitle')}
          hint={t('documentos', 'emptyFiltered')}
          action={{ label: t('documentos', 'clearFilters'), testID: DOCUMENTOS_TESTIDS.DOCUMENTS_EMPTY_CLEAR, onPress: clear }}
        />
      ) : null}

      <DocumentMenu id={menuId} onClose={() => setMenuId(null)} onView={(id) => router.push(`/documents/${id}`)} onDownload={(id) => void downloads.download(id)} />
    </Screen>
  );
};

/** Tarjeta de un documento: `role="listitem"`; el código y el título son el enlace a la ficha y «⋯» abre su menú. */
const DocumentCard = ({ doc, onMenu }: { readonly doc: DocumentDto; readonly onMenu: (id: string) => void }) => {
  const { t, lang } = useI18n();
  const { colors } = useTheme();
  return (
    <Card role="listitem" aria-label={`${doc.id} ${doc.title}`} dataSet={{ state: doc.classification }} testID={DOCUMENTOS_DYNAMIC_TESTIDS.DOCUMENT_ROW(doc.id)}>
      <View style={styles.cardTop}>
        <Link href={`/documents/${doc.id}`} asChild>
          <Pressable role="link" testID={DOCUMENTOS_DYNAMIC_TESTIDS.DOCUMENT_LINK(doc.id)} style={styles.cardLink}>
            <Text variant="mono" tone="muted">
              {doc.id}
            </Text>
            <Text variant="heading">{doc.title}</Text>
          </Pressable>
        </Link>
        <Badge
          label={t('documentos', `c_${doc.classification}`)}
          tone={CLASSIFICATION_TONE[doc.classification]}
          state={doc.classification}
          testID={DOCUMENTOS_TESTIDS.DOCUMENT_CLASS_BADGE}
        />
      </View>
      <View style={[styles.cardFoot, { borderTopColor: colors.border }]}>
        <View style={styles.cardMeta}>
          <Text variant="small" tone="muted">
            {`${doc.programCode} · ${doc.programName}`}
          </Text>
          <Text variant="small" tone="muted">
            {`v${doc.version} · ${formatDate(doc.updatedAt.slice(0, 10), lang)}`}
          </Text>
        </View>
        <Pressable
          role="button"
          aria-label={t('documentos', 'rowActions', { code: doc.id })}
          testID={DOCUMENTOS_DYNAMIC_TESTIDS.DOCUMENT_ROW_MENU(doc.id)}
          onPress={() => onMenu(doc.id)}
          style={({ pressed }) => [styles.menu, { borderColor: colors.border, backgroundColor: pressed ? colors.surface2 : colors.surface }]}
        >
          <Text variant="heading" tone="muted" aria-hidden>
            ⋯
          </Text>
        </Pressable>
      </View>
    </Card>
  );
};

const styles = StyleSheet.create({
  clearRow: { alignItems: 'flex-start' },
  list: { gap: 10 },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 },
  cardLink: { flex: 1, gap: 2, minHeight: 44, justifyContent: 'center' },
  cardFoot: { flexDirection: 'row', alignItems: 'center', gap: 8, borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 8 },
  cardMeta: { flex: 1, flexDirection: 'row', justifyContent: 'space-between', flexWrap: 'wrap', gap: 4 },
  menu: { width: 44, height: 44, borderWidth: 1, borderRadius: RADIUS.md, alignItems: 'center', justifyContent: 'center' },
});
