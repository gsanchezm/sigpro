import { ApiError, DOCUMENTOS_DYNAMIC_TESTIDS, DOCUMENTOS_TESTIDS, formatTrace } from '@sigpro/shared';
import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useI18n, useTexts } from '../../state/i18n';
import { Button } from '../../ui/Button';
import { Card } from '../../ui/Card';
import { EmptyState, ErrorState, LoadingState } from '../../ui/States';
import { Text } from '../../ui/Text';
import { DOCUMENTS_TEXTS } from './texts';
import { MOVIL_DOCUMENTS_TESTIDS } from './testids';
import { PAGE_BATCH, lineKind, nextRequest, pageWindow } from './view';
import { useDocumentContent } from './useDocumentsData';

interface Props {
  readonly id: string;
  /** Versión elegida en la ficha (siempre un número concreto). */
  readonly version: number;
}

/**
 * Contenido de una versión: sus páginas de líneas, de `PAGE_BATCH` en `PAGE_BATCH`, con «Cargar más» para el resto.
 * Se monta con `key` por versión, así cada versión empieza en su primera página.
 */
export const DocumentViewer = ({ id, version }: Props) => {
  const { t } = useI18n();
  const texts = useTexts(DOCUMENTS_TEXTS);
  const content = useDocumentContent(id, version);
  const [requested, setRequested] = useState(PAGE_BATCH);
  const loadMore = useCallback(() => setRequested(nextRequest), []);

  if (content.data === null) {
    if (content.status !== 'error') return <LoadingState testID={DOCUMENTOS_TESTIDS.VIEWER_LOADING} />;
    const trace = content.failure instanceof ApiError ? formatTrace(content.failure) : t('common', 'networkError');
    return (
      <ErrorState
        testID={DOCUMENTOS_TESTIDS.VIEWER_ERROR}
        retryTestID={MOVIL_DOCUMENTS_TESTIDS.VIEWER_ERROR_RETRY}
        title={t('documentos', 'viewerError')}
        trace={trace}
        onRetry={content.reload}
      />
    );
  }

  const { pages } = content.data;
  if (pages.length === 0) return <EmptyState testID={MOVIL_DOCUMENTS_TESTIDS.VIEWER_EMPTY} title={texts.contentEmpty} />;

  const windowed = pageWindow(pages, requested);
  return (
    <View testID={DOCUMENTOS_TESTIDS.DOCUMENT_VIEWER} aria-label={t('documentos', 'viewerTitle')} style={styles.pages}>
      {windowed.shown.map((lines, index) => (
        <PageCard key={index} n={index + 1} total={pages.length} lines={lines} />
      ))}
      {windowed.hasMore ? (
        <Button label={t('auditoria', 'loadMore')} testID={MOVIL_DOCUMENTS_TESTIDS.VIEWER_LOAD_MORE} onPress={loadMore} />
      ) : null}
    </View>
  );
};

/** Una página del documento (`Página 1 de 3`) con sus líneas. */
const PageCard = ({ n, total, lines }: { readonly n: number; readonly total: number; readonly lines: readonly string[] }) => {
  const { t } = useI18n();
  const label = t('documentos', 'pageOf', { n, total });
  return (
    <Card aria-label={label} testID={DOCUMENTOS_DYNAMIC_TESTIDS.VIEWER_PAGE_N(n)} style={styles.page}>
      <Text variant="mono" tone="faint">
        {label}
      </Text>
      {lines.map((line, index) => (
        <PageLine key={index} line={line} />
      ))}
    </Card>
  );
};

/** Una línea: vacía (un hueco), encabezado numerado en negrita o texto normal. */
const PageLine = ({ line }: { readonly line: string }) => {
  const kind = lineKind(line);
  if (kind === 'blank') return <View style={styles.blank} aria-hidden />;
  if (kind === 'heading') return <Text variant="heading">{line}</Text>;
  return <Text variant="body">{line}</Text>;
};

const styles = StyleSheet.create({
  pages: { gap: 12 },
  page: { gap: 6, minHeight: 160, paddingHorizontal: 14, paddingVertical: 12 },
  blank: { height: 8 },
});
