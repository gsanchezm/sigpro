import { NC_COMMENT_MAX_LENGTH, NC_TESTIDS } from '@sigpro/shared';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useI18n } from '../../state/i18n';
import { SPACING } from '../../theme/tokens';
import { Button } from '../../ui/Button';
import { Text } from '../../ui/Text';
import { TextField } from '../../ui/TextField';
import { CLOSURE_MIN_LENGTH, closureCount, closureIssue, type ClosureIssue } from './closure';

interface Props {
  /** Error del 422 para el campo `comment`, ya traducido. */
  readonly fieldError: string | null;
  /** Error de la petición (403, red…), ya traducido. */
  readonly serverError: string | null;
  readonly submitting: boolean;
  readonly onSubmit: (comment: string) => void;
  readonly onCancel: () => void;
}

/**
 * Comentario de cierre (modo del propio detalle, no un `Modal` dentro de otro). Valida antes de enviar: el campo
 * muestra el error con `role="alert"` y `aria-invalid`, y el contador «n / 20» se actualiza al escribir.
 */
export const NcCloseForm = ({ fieldError, serverError, submitting, onSubmit, onCancel }: Props) => {
  const { t } = useI18n();
  const [text, setText] = useState('');
  const [issue, setIssue] = useState<ClosureIssue | null>(null);

  const submit = () => {
    const found = closureIssue(text);
    setIssue(found);
    if (found === null) onSubmit(text.trim());
  };

  const message = issue ? t('nc', issue) : fieldError;

  return (
    <View testID={NC_TESTIDS.NC_CLOSE_DIALOG} style={styles.form}>
      <Text variant="small" tone="muted">
        {t('nc', 'closeIntro', { min: CLOSURE_MIN_LENGTH })}
      </Text>
      <TextField
        label={t('nc', 'closeLabel')}
        placeholder={t('nc', 'closePlaceholder')}
        testID={NC_TESTIDS.NC_CLOSE_COMMENT}
        errorTestID={NC_TESTIDS.NC_CLOSE_ERROR}
        error={message ?? undefined}
        value={text}
        onChangeText={(value) => {
          setText(value);
          setIssue(null);
        }}
        multiline
        maxLength={NC_COMMENT_MAX_LENGTH}
      />
      <Text variant="small" tone="muted" testID={NC_TESTIDS.NC_CLOSE_COUNTER}>
        {t('nc', 'closeCounter', { count: closureCount(text), min: CLOSURE_MIN_LENGTH })}
      </Text>
      {serverError ? (
        <Text variant="small" tone="danger" role="alert" testID={NC_TESTIDS.NC_CLOSE_SERVER_ERROR}>
          {serverError}
        </Text>
      ) : null}
      <View style={styles.actions}>
        <Button
          label={t('nc', 'closeCancel')}
          testID={NC_TESTIDS.NC_CLOSE_CANCEL}
          variant="ghost"
          disabled={submitting}
          disabledReason={submitting ? t('common', 'processing') : undefined}
          onPress={onCancel}
        />
        <Button label={t('nc', 'closeSubmit')} testID={NC_TESTIDS.NC_CLOSE_SUBMIT} variant="primary" busy={submitting} onPress={submit} />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  form: { gap: SPACING.sm, paddingTop: SPACING.xs },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: SPACING.sm, flexWrap: 'wrap' },
});
