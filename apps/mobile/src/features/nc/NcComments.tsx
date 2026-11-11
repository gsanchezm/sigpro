import { NC_COMMENT_MAX_LENGTH, NC_DYNAMIC_TESTIDS, NC_TESTIDS, formatTrace, ncCommentSchema, type NcCommentDto } from '@sigpro/shared';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useAuth } from '../../state/auth';
import { useI18n } from '../../state/i18n';
import { SPACING } from '../../theme/tokens';
import { Button } from '../../ui/Button';
import { Text } from '../../ui/Text';
import { TextField } from '../../ui/TextField';
import { commentTime } from './comments';
import { isNcMessageKey } from './texts';

interface Props {
  readonly code: string;
  readonly comments: readonly NcCommentDto[];
  /** Añade el comentario que devuelve la API a la lista local (sin recargar). */
  readonly onAdded: (comment: NcCommentDto) => void;
}

/** Comentarios (de más antiguo a más reciente) y compositor. Todos los roles pueden comentar (`nc.comment`). */
export const NcComments = ({ code, comments, onAdded }: Props) => {
  const { t, lang } = useI18n();
  const { api } = useAuth();
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  /** Clave de validación del esquema compartido → texto; una clave desconocida cae en el genérico. */
  const messageFor = (key: string | undefined): string => (key !== undefined && isNcMessageKey(key) ? t('nc', key) : t('common', 'genericError'));

  const send = async () => {
    const parsed = ncCommentSchema.safeParse({ body: draft });
    if (!parsed.success) {
      setError(messageFor(parsed.error.issues[0]?.message));
      return;
    }
    setSending(true);
    setError(null);
    try {
      const created = await api.nc.comment(code, parsed.data);
      onAdded(created);
      setDraft('');
    } catch (failure) {
      setError(formatTrace(failure) || t('common', 'genericError'));
    } finally {
      setSending(false);
    }
  };

  return (
    <View style={styles.wrap}>
      <Text variant="heading">{`${t('nc', 'commentsTitle')} (${comments.length})`}</Text>
      {comments.length === 0 ? (
        <Text variant="small" tone="muted" testID={NC_TESTIDS.NC_COMMENTS_EMPTY}>
          {t('nc', 'commentsEmpty')}
        </Text>
      ) : (
        <View role="list" aria-label={t('nc', 'commentsTitle')} testID={NC_TESTIDS.NC_COMMENTS} style={styles.list}>
          {comments.map((comment) => (
            <View key={comment.id} role="listitem" testID={NC_DYNAMIC_TESTIDS.NC_COMMENT(comment.id)} dataSet={{ kind: comment.kind }} style={styles.comment}>
              <View style={styles.head}>
                <Text variant="label">{comment.authorName ?? t('auditoria', 'system')}</Text>
                <Text variant="small" tone="faint">
                  {commentTime(comment.createdAt, lang)}
                </Text>
                {comment.kind === 'comment' ? null : (
                  <Text variant="small" tone="accent">
                    {t('nc', comment.kind === 'quick' ? 'commentKindQuick' : 'commentKindClosure')}
                  </Text>
                )}
              </View>
              <Text variant="body">{comment.body}</Text>
            </View>
          ))}
        </View>
      )}

      <TextField
        label={t('nc', 'commentLabel')}
        placeholder={t('nc', 'commentPlaceholder')}
        testID={NC_TESTIDS.NC_COMMENT_INPUT}
        errorTestID={NC_TESTIDS.NC_COMMENT_ERROR}
        error={error ?? undefined}
        value={draft}
        onChangeText={(value) => {
          setDraft(value);
          setError(null);
        }}
        multiline
        maxLength={NC_COMMENT_MAX_LENGTH}
      />
      <Button label={t('nc', 'commentSubmit')} testID={NC_TESTIDS.NC_COMMENT_SUBMIT} variant="primary" busy={sending} onPress={() => void send()} />
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: { gap: SPACING.sm },
  list: { gap: SPACING.sm },
  comment: { gap: SPACING.xs, borderLeftWidth: 2, paddingLeft: SPACING.sm },
  head: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: SPACING.sm },
});
