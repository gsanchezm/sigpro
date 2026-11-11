import { ApiError, CLASSIFICATION_TONE, DOCUMENTOS_DYNAMIC_TESTIDS, DOCUMENTOS_TESTIDS, MOVIL_TESTIDS, formatDate, formatTrace } from '@sigpro/shared';
import { Link } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { useI18n } from '../../state/i18n';
import { useTheme } from '../../state/theme';
import { Badge } from '../../ui/Badge';
import { Card } from '../../ui/Card';
import { Chip } from '../../ui/Chip';
import { Screen } from '../../ui/Screen';
import { ErrorState, LoadingState } from '../../ui/States';
import { Text } from '../../ui/Text';
import { DocumentViewer } from './DocumentViewer';
import { MOVIL_DOCUMENTS_TESTIDS } from './testids';
import { useDocumentDetail } from './useDocumentsData';
import { failureKind, sortVersions, versionInfo } from './view';

/**
 * `/documents/:id`: metadatos, selector de versión (chips `role="radio"`) y contenido de la versión elegida.
 * Un restringido sin permiso da 403 («No tienes permiso para ver este documento»); un código que no existe, 404.
 */
export const DocumentDetailPage = ({ id }: { readonly id: string }) => {
  const { t, lang } = useI18n();
  const { colors } = useTheme();
  const detail = useDocumentDetail(id);
  const [chosen, setChosen] = useState<number | null>(null);
  const doc = detail.data;

  if (detail.status === 'error') return <DetailFailure failure={detail.failure} onRetry={detail.reload} />;

  if (doc === null) {
    return (
      <Screen title={t('documentos', 'title')} testID={MOVIL_TESTIDS.DOCUMENT_DETAIL_PAGE}>
        <LoadingState testID={MOVIL_DOCUMENTS_TESTIDS.DETAIL_LOADING} />
      </Screen>
    );
  }

  const shown = chosen ?? doc.version;
  const info = versionInfo(doc.versions, shown);
  const linkStyle = { color: colors.accent, fontSize: 13 };

  return (
    <Screen title={t('documentos', 'title')} testID={MOVIL_TESTIDS.DOCUMENT_DETAIL_PAGE}>
      <Link href="/documents" testID={DOCUMENTOS_TESTIDS.DOCUMENT_BACK} style={linkStyle}>
        {t('documentos', 'back')}
      </Link>

      <View testID={DOCUMENTOS_TESTIDS.DOCUMENT_DETAIL} style={styles.column}>
        <Card>
          <Text variant="heading" testID={DOCUMENTOS_TESTIDS.DOCUMENT_TITLE}>
            {doc.title}
          </Text>
          <View style={styles.row}>
            <Text variant="mono" tone="muted" testID={MOVIL_DOCUMENTS_TESTIDS.DOCUMENT_CODE}>
              {doc.id}
            </Text>
            <Badge
              label={t('documentos', `c_${doc.classification}`)}
              tone={CLASSIFICATION_TONE[doc.classification]}
              state={doc.classification}
              testID={DOCUMENTOS_TESTIDS.DOCUMENT_CLASS_BADGE}
            />
          </View>
          <Link href={`/programs/${doc.programCode}`} testID={DOCUMENTOS_TESTIDS.DOCUMENT_PROGRAM_LINK} style={linkStyle}>
            {`${doc.programCode} · ${doc.programName}`}
          </Link>
          <Text variant="small" tone="muted" testID={MOVIL_DOCUMENTS_TESTIDS.UPDATED}>
            {`${t('documentos', 'colUpdated')}: ${formatDate(doc.updatedAt.slice(0, 10), lang)}`}
          </Text>
        </Card>

        <View style={styles.column}>
          <Text variant="label" tone="muted">
            {t('documentos', 'versionLabel')}
          </Text>
          <View role="radiogroup" aria-label={t('documentos', 'versionLabel')} testID={DOCUMENTOS_TESTIDS.DOCUMENT_VERSION_SELECT} style={styles.chips}>
            {sortVersions(doc.versions).map((candidate) => {
              const latest = candidate.version === doc.version;
              const label = `${t('documentos', 'versionN', { n: candidate.version })}${latest ? ` · ${t('documentos', 'latest')}` : ''}`;
              return (
                <Chip
                  key={candidate.version}
                  label={label}
                  selected={candidate.version === shown}
                  testID={DOCUMENTOS_DYNAMIC_TESTIDS.DOCUMENT_VERSION_ROW(candidate.version)}
                  onPress={() => setChosen(candidate.version)}
                />
              );
            })}
          </View>
          {info ? <VersionFacts author={info.authorName} createdAt={info.createdAt} note={info.note} /> : null}
        </View>

        {/* Un componente por versión (`key`): al cambiar de versión, el visor vuelve a su primera página */}
        <DocumentViewer key={`${doc.id}-${shown}`} id={doc.id} version={shown} />
      </View>
    </Screen>
  );
};

/** Autor, fecha y nota de la versión elegida (si existen). */
const VersionFacts = ({ author, createdAt, note }: { readonly author: string | null; readonly createdAt: string; readonly note: string }) => {
  const { t, lang } = useI18n();
  const date = formatDate(createdAt.slice(0, 10), lang);
  return (
    <View style={styles.column}>
      <Text variant="small" tone="muted" testID={MOVIL_DOCUMENTS_TESTIDS.VERSION_META}>
        {author ? `${t('documentos', 'byAuthor', { name: author })} · ${date}` : date}
      </Text>
      {note ? (
        <View style={styles.column}>
          <Text variant="label" tone="muted">
            {t('documentos', 'publishNote')}
          </Text>
          <Text variant="body" testID={MOVIL_DOCUMENTS_TESTIDS.VERSION_NOTE}>
            {note}
          </Text>
        </View>
      ) : null}
    </View>
  );
};

/** Alerta sin reintento (403 y 404): título, explicación opcional y traza. Colores de error del tema. */
const Notice = ({ testID, title, children, trace }: { readonly testID: string; readonly title: string; readonly children?: ReactNode; readonly trace: string }) => {
  const { colors } = useTheme();
  return (
    <View role="alert" testID={testID} style={[styles.notice, { backgroundColor: colors.dangerSoft, borderColor: colors.danger }]}>
      <Text variant="heading" tone="danger">
        {title}
      </Text>
      {children}
      <Text variant="mono" tone="muted">
        {trace}
      </Text>
    </View>
  );
};

/** Error de la ficha: 403 y 404 tienen su propio mensaje; el resto, traza y «Reintentar». */
const DetailFailure = ({ failure, onRetry }: { readonly failure: unknown; readonly onRetry: () => void }) => {
  const { t } = useI18n();
  const { colors } = useTheme();
  const kind = failureKind(failure);
  const trace = failure instanceof ApiError ? formatTrace(failure) : t('common', 'networkError');
  const back = (
    <Link href="/documents" testID={DOCUMENTOS_TESTIDS.DOCUMENT_BACK} style={{ color: colors.accent, fontSize: 13 }}>
      {t('documentos', 'back')}
    </Link>
  );

  if (kind === 'forbidden') {
    return (
      <Screen title={t('documentos', 'title')} testID={MOVIL_TESTIDS.DOCUMENT_DETAIL_PAGE}>
        <Notice testID={DOCUMENTOS_TESTIDS.DOCUMENT_FORBIDDEN} title={t('documentos', 'forbidden')} trace={trace}>
          <Text variant="small" tone="muted">
            {t('documentos', 'forbiddenBody')}
          </Text>
        </Notice>
        {back}
      </Screen>
    );
  }

  if (kind === 'notFound') {
    return (
      <Screen title={t('documentos', 'title')} testID={MOVIL_TESTIDS.DOCUMENT_DETAIL_PAGE}>
        <Notice testID={DOCUMENTOS_TESTIDS.DOCUMENT_NOT_FOUND} title={t('documentos', 'notFound')} trace={trace} />
        {back}
      </Screen>
    );
  }

  return (
    <Screen title={t('documentos', 'title')} testID={MOVIL_TESTIDS.DOCUMENT_DETAIL_PAGE}>
      <ErrorState testID={MOVIL_DOCUMENTS_TESTIDS.DETAIL_ERROR} retryTestID={MOVIL_DOCUMENTS_TESTIDS.DETAIL_ERROR_RETRY} title={t('common', 'genericError')} trace={trace} onRetry={onRetry} />
      {back}
    </Screen>
  );
};

const styles = StyleSheet.create({
  column: { gap: 8 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  notice: { gap: 8, borderRadius: 10, borderWidth: 1, padding: 14, alignItems: 'flex-start' },
});
