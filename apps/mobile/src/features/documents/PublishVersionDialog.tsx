import { DOCUMENTOS_TESTIDS, formatTrace, type DocumentDetailDto, type MessageKey, type PublishVersionInput } from '@sigpro/shared';
import { useEffect, useState } from 'react';
import { useAuth } from '../../state/auth';
import { useI18n } from '../../state/i18n';
import { FormDialog } from '../../ui/FormDialog';
import { Text } from '../../ui/Text';
import { TextField } from '../../ui/TextField';
import { MOVIL_DOCUMENTS_TESTIDS } from './testids';
import { fieldErrorsOf, textOfPages, validatePublish, withoutError, type Errors } from './publish';

interface Props {
  readonly doc: DocumentDetailDto;
  readonly onClose: () => void;
  /** Publica la versión; rechaza con el error de la API para que el diálogo lo muestre. */
  readonly onSubmit: (input: PublishVersionInput) => Promise<void>;
}

/**
 * «Publicar nueva versión» (la alternativa móvil al diálogo de la web). Mismos campos y límites: el contenido, una línea por
 * fila y precargado con el de la última versión (de 1 a 80 líneas de hasta 200 caracteres), y la nota de cambios (hasta
 * 200). **No hay archivo que adjuntar:** la API recibe el contenido como JSON `{ lines, note }`, igual que la web. Valida con
 * el esquema compartido; un 422 se muestra bajo el campo y cualquier otro fallo, arriba con su traza.
 */
export const PublishVersionDialog = ({ doc, onClose, onSubmit }: Props) => {
  const { t } = useI18n();
  const { api } = useAuth();
  const [text, setText] = useState('');
  const [note, setNote] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const message = (key: string) => t('documentos', key as MessageKey<'documentos'>);

  // El campo espera a que llegue el contenido de la última versión; si no llega, se puede escribir desde cero (como la web)
  useEffect(() => {
    let cancelled = false;
    api.documents.content(doc.id).then(
      (content) => {
        if (cancelled) return;
        setText(textOfPages(content.pages));
        setLoaded(true);
      },
      () => !cancelled && setLoaded(true),
    );
    return () => {
      cancelled = true;
    };
  }, [api, doc.id]);

  const submit = async () => {
    const result = validatePublish(text, note);
    if (!result.success) {
      setErrors(result.errors);
      return;
    }
    setSubmitting(true);
    setServerError(null);
    try {
      await onSubmit(result.data);
    } catch (failure) {
      const fields = fieldErrorsOf(failure);
      if (fields) setErrors(fields);
      setServerError(fields ? message(Object.values(fields)[0] ?? 'linesRequired') : formatTrace(failure) || t('common', 'genericError'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <FormDialog
      visible
      title={t('documentos', 'publishDialog', { code: doc.id })}
      submitLabel={t('documentos', 'publishSubmit')}
      cancelLabel={t('documentos', 'publishCancel')}
      onSubmit={() => void submit()}
      onClose={onClose}
      busy={submitting}
      submitDisabled={!loaded}
      submitDisabledReason={loaded ? undefined : t('common', 'loading')}
      testID={DOCUMENTOS_TESTIDS.DOCUMENT_PUBLISH_DIALOG}
      submitTestID={DOCUMENTOS_TESTIDS.DOCUMENT_PUBLISH_SUBMIT}
      cancelTestID={DOCUMENTOS_TESTIDS.DOCUMENT_PUBLISH_CANCEL}
    >
      {serverError ? (
        <Text variant="small" tone="danger" role="alert" testID={DOCUMENTOS_TESTIDS.DOCUMENT_PUBLISH_SERVER_ERROR}>
          {serverError}
        </Text>
      ) : null}
      {loaded ? null : (
        <Text variant="small" tone="muted" role="status" aria-busy testID={MOVIL_DOCUMENTS_TESTIDS.PUBLISH_LOADING}>
          {t('common', 'loading')}
        </Text>
      )}

      <TextField
        label={t('documentos', 'publishText')}
        testID={DOCUMENTOS_TESTIDS.DOCUMENT_PUBLISH_TEXT}
        errorTestID={DOCUMENTOS_TESTIDS.DOCUMENT_PUBLISH_TEXT_ERROR}
        value={text}
        onChangeText={(value) => {
          setText(value);
          setErrors((current) => withoutError(current, 'text'));
        }}
        editable={loaded}
        multiline
        rows={10}
        autoCapitalize="sentences"
        error={errors.text ? message(errors.text) : undefined}
      />
      <TextField
        label={t('documentos', 'publishNote')}
        placeholder={t('documentos', 'publishNotePlaceholder')}
        testID={DOCUMENTOS_TESTIDS.DOCUMENT_PUBLISH_NOTE}
        value={note}
        onChangeText={(value) => {
          setNote(value);
          setErrors((current) => withoutError(current, 'note'));
        }}
        error={errors.note ? message(errors.note) : undefined}
      />
    </FormDialog>
  );
};
