import {
  NC_SEVERITY_TONE,
  NC_STATE_TONE,
  NC_TESTIDS,
  formatTrace,
  richTextToPlain,
  type NcCommentDto,
  type NcDetailDto,
  type NcState,
  type Role,
} from '@sigpro/shared';
import { useState, type ReactNode } from 'react';
import { ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useAuth } from '../../state/auth';
import { useI18n, useTexts } from '../../state/i18n';
import { useToast } from '../../state/toast';
import { SPACING } from '../../theme/tokens';
import { Badge } from '../../ui/Badge';
import { ErrorState, LoadingState } from '../../ui/States';
import { Sheet } from '../../ui/Sheet';
import { Text } from '../../ui/Text';
import { commentErrorKey, failureKind, type FailureKind } from './failures';
import { useNcDetail } from './hooks';
import { NcComments } from './NcComments';
import { NcTransitions } from './NcTransitions';
import { NC_SCREEN_TEXTS, SEVERITY_LABEL_KEY, STATE_LABEL_KEY, isNcMessageKey } from './texts';
import { MOVIL_NC_TESTIDS } from './testids';

interface Props {
  readonly code: string;
  readonly role: Role;
  readonly onClose: () => void;
  /** Recarga el tablero (la tarjeta cambia de columna o cambia su recuento de comentarios). */
  readonly onChanged: () => void;
}

/**
 * Detalle de una NC en una hoja modal. Se monta con `key={code}`: cada apertura empieza limpia.
 * Al mover con éxito la hoja se cierra y el tablero se recarga: la tarjeta aparece en su nueva columna.
 */
export const NcDetailSheet = ({ code, role, onClose, onChanged }: Props) => {
  const { t } = useI18n();
  const texts = useTexts(NC_SCREEN_TEXTS);
  const { api } = useAuth();
  const toast = useToast();
  const { height } = useWindowDimensions();
  const { detail, setDetail, loading, failure, retry } = useNcDetail(code);
  const [closing, setClosing] = useState(false);
  const [moving, setMoving] = useState<NcState | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [closureError, setClosureError] = useState<string | null>(null);

  // El `Sheet` no tiene scroll propio: el contenido se desplaza dentro de una altura máxima explícita.
  const bodyHeight = Math.max(240, height * 0.85 - 120);

  /** Texto del fallo según su tipo (mapa de despacho). `to` es el destino que se intentaba. */
  const failureText = (kind: FailureKind, to: NcState, error: unknown, current: NcDetailDto): string => {
    const messages: Readonly<Record<FailureKind, () => string>> = {
      denied: () => t('nc', 'menuMoveDenied'),
      invalid: () => t('nc', 'invalidTransition', { code, from: t('nc', STATE_LABEL_KEY[current.state]), to: t('nc', STATE_LABEL_KEY[to]) }),
      validation: () => {
        const key = commentErrorKey(error);
        return key !== null && isNcMessageKey(key) ? t('nc', key) : t('common', 'genericError');
      },
      notFound: () => t('nc', 'detailNotFound'),
      other: () => t('nc', 'moveFailed', { code }),
    };
    return messages[kind]();
  };

  const move = async (to: NcState, comment?: string) => {
    if (!detail) return;
    setMoving(to);
    setServerError(null);
    setClosureError(null);
    try {
      await api.nc.transition(code, comment === undefined ? { to } : { to, comment });
      toast.push('ok', to === 'closed' ? t('nc', 'closed', { code }) : t('nc', 'moved', { code, state: t('nc', STATE_LABEL_KEY[to]) }));
      onChanged();
      onClose();
    } catch (error) {
      const kind = failureKind(error);
      const text = failureText(kind, to, error, detail);
      const trace = kind === 'other' ? formatTrace(error) || undefined : undefined;
      // Un 422 del comentario de cierre se muestra bajo su campo; el resto de fallos, en línea en el detalle
      if (kind === 'validation' && to === 'closed') setClosureError(text);
      else setServerError(text);
      toast.push('danger', text, trace);
    } finally {
      setMoving(null);
    }
  };

  const addComment = (comment: NcCommentDto) => {
    setDetail((current) => (current ? { ...current, comments: [...current.comments, comment], commentCount: current.commentCount + 1 } : current));
    onChanged();
  };

  return (
    <Sheet visible title={t('nc', 'detailTitle', { code })} onClose={onClose} testID={NC_TESTIDS.NC_DETAIL} closeTestID={NC_TESTIDS.NC_DETAIL_CLOSE}>
      <ScrollView testID={MOVIL_NC_TESTIDS.DETAIL_SCROLL} style={{ maxHeight: bodyHeight }} contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        {loading && detail === null && failure === null ? <LoadingState testID={NC_TESTIDS.NC_DETAIL_LOADING} /> : null}
        {failure !== null && detail === null ? <DetailFailure error={failure.error} onRetry={retry} deniedText={texts.deniedDetail} /> : null}
        {detail !== null ? (
          <>
            <Text variant="mono" tone="muted" testID={NC_TESTIDS.NC_DETAIL_CODE}>
              {detail.code}
            </Text>
            <View style={styles.badges}>
              <Badge label={t('nc', STATE_LABEL_KEY[detail.state])} tone={NC_STATE_TONE[detail.state]} state={detail.state} testID={NC_TESTIDS.NC_STATE_BADGE} />
              <Badge
                label={t('nc', SEVERITY_LABEL_KEY[detail.severity])}
                tone={NC_SEVERITY_TONE[detail.severity]}
                severity={detail.severity}
                testID={NC_TESTIDS.NC_SEVERITY_BADGE}
              />
            </View>

            <Field label={t('nc', 'program')} testID={NC_TESTIDS.NC_DETAIL_PROGRAM}>{`${detail.programCode} · ${detail.programName}`}</Field>
            <Field label={t('nc', 'description')} testID={NC_TESTIDS.NC_DESCRIPTION}>
              {richTextToPlain(detail.description)}
            </Field>
            <Field label={t('nc', 'assignee')} testID={NC_TESTIDS.NC_ASSIGNEE}>
              {detail.assigneeName ?? t('nc', 'unassigned')}
            </Field>

            <NcTransitions
              state={detail.state}
              role={role}
              moving={moving}
              closing={closing}
              closureFieldError={closureError}
              serverError={serverError}
              onMove={(to) => void move(to)}
              onOpenClosure={() => setClosing(true)}
              onCancelClosure={() => {
                setClosing(false);
                setClosureError(null);
              }}
              onSubmitClosure={(comment) => void move('closed', comment)}
            />

            <NcComments code={code} comments={detail.comments} onAdded={addComment} />
          </>
        ) : null}
      </ScrollView>
    </Sheet>
  );
};

interface FieldProps {
  readonly label: string;
  readonly testID: string;
  readonly children: ReactNode;
}

/** Par etiqueta / valor del detalle. */
const Field = ({ label, testID, children }: FieldProps) => (
  <View style={styles.field}>
    <Text variant="label" tone="muted">
      {label}
    </Text>
    <Text variant="body" testID={testID}>
      {children}
    </Text>
  </View>
);

interface FailureProps {
  readonly error: unknown;
  readonly deniedText: string;
  readonly onRetry: () => void;
}

/** Fallo al cargar el detalle: 404 «no encontrada», 403 «no puedes verla», el resto con traza y reintento. */
const DetailFailure = ({ error, deniedText, onRetry }: FailureProps) => {
  const { t } = useI18n();
  const kind = failureKind(error);
  if (kind === 'notFound') {
    return (
      <Text variant="body" tone="muted" testID={NC_TESTIDS.NC_DETAIL_NOT_FOUND}>
        {t('nc', 'detailNotFound')}
      </Text>
    );
  }
  if (kind === 'denied') {
    return (
      <Text variant="body" tone="muted" testID={NC_TESTIDS.NC_DETAIL_DENIED}>
        {deniedText}
      </Text>
    );
  }
  return (
    <ErrorState
      testID={NC_TESTIDS.NC_DETAIL_ERROR}
      retryTestID={NC_TESTIDS.NC_DETAIL_ERROR_RETRY}
      title={t('nc', 'detailError')}
      trace={formatTrace(error) || undefined}
      onRetry={onRetry}
    />
  );
};

const styles = StyleSheet.create({
  body: { gap: SPACING.md, paddingBottom: SPACING.sm },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
  field: { gap: SPACING.xs },
});
