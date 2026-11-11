import { ApiError, DOCUMENTOS_TESTIDS, flattenIssues, publishVersionSchema, type DocumentDetailDto, type MessageKey, type PublishVersionInput } from '@sigpro/shared';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { formatTrace } from '../../lib/errors';
import { useBreakpoint } from '../../lib/hooks';
import { useAuth } from '../../state/auth';
import { useI18n } from '../../state/i18n';
import { Modal } from '../../ui/Modal';
import { Spinner } from '../../ui/Spinner';

interface PublishVersionDialogProps {
  readonly doc: DocumentDetailDto;
  readonly onClose: () => void;
  readonly onSubmit: (input: PublishVersionInput) => Promise<void>;
}

/** Diálogo «Publicar nueva versión»: el texto parte del contenido de la última versión (una línea por fila). */
export const PublishVersionDialog = ({ doc, onClose, onSubmit }: PublishVersionDialogProps) => {
  const { t } = useI18n();
  const { api } = useAuth();
  const mobile = useBreakpoint() === 'mobile';
  const [text, setText] = useState('');
  const [note, setNote] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [errors, setErrors] = useState<Readonly<Record<string, string>>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const textRef = useRef<HTMLTextAreaElement>(null);
  const message = (key: string) => t('documentos', key as MessageKey<'documentos'>);

  useEffect(() => {
    let cancelled = false;
    api.documents.content(doc.id).then(
      (content) => {
        if (cancelled) return;
        setText(content.pages.flat().join('\n'));
        setLoaded(true);
      },
      () => !cancelled && setLoaded(true),
    );
    return () => {
      cancelled = true;
    };
  }, [api, doc.id]);

  // El campo está deshabilitado mientras llega el contenido de la última versión: el foco inicial del modal no puede
  // quedarse en él, así que se le da en cuanto se habilita
  useEffect(() => {
    if (loaded) textRef.current?.focus();
  }, [loaded]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    // Una línea por fila; las filas vacías del final no cuentan
    const lines = text.split('\n').map((line) => line.replace(/\r$/, ''));
    while (lines.length > 0 && lines[lines.length - 1]?.trim() === '') lines.pop();
    const parsed = publishVersionSchema.safeParse({ lines, note });
    if (!parsed.success) {
      const flat = flattenIssues(parsed.error.issues);
      // Los errores de contenido llegan como `lines` (vacío, demasiadas líneas) o `lines.N` (línea demasiado larga)
      const linesKey = Object.keys(flat).find((key) => key === 'lines' || key.startsWith('lines.'));
      setErrors({ ...flat, ...(linesKey ? { text: flat[linesKey] ?? '' } : {}) });
      return;
    }
    setSubmitting(true);
    setServerError(null);
    try {
      await onSubmit(parsed.data);
    } catch (error) {
      const fieldErrors = error instanceof ApiError && error.status === 422 ? (error.body.errors ?? {}) : null;
      if (fieldErrors) setErrors({ ...fieldErrors, ...(fieldErrors.lines ? { text: fieldErrors.lines } : {}) });
      setServerError(fieldErrors ? message(Object.values(fieldErrors)[0] ?? 'linesRequired') : formatTrace(error) || t('common', 'genericError'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      role="dialog"
      testId={DOCUMENTOS_TESTIDS.DOCUMENT_PUBLISH_DIALOG}
      labelledBy="document-publish-heading"
      onClose={onClose}
      initialFocus={textRef}
      className={mobile ? 'inset-x-0 bottom-0 top-8 rounded-t-[10px]' : 'top-1/2 left-1/2 max-h-[calc(100%-48px)] w-[min(620px,calc(100%-32px))] -translate-x-1/2 -translate-y-1/2 rounded-card'}
    >
      <form noValidate onSubmit={(event) => void submit(event)} aria-busy={!loaded || submitting} className="flex flex-1 flex-col gap-3.5 overflow-auto p-5">
        <h2 id="document-publish-heading" className="section-title">
          {t('documentos', 'publishDialog', { code: doc.id })}
        </h2>

        {serverError ? (
          <div role="alert" data-testid={DOCUMENTOS_TESTIDS.DOCUMENT_PUBLISH_SERVER_ERROR} className="alert alert-danger text-[12.5px]">
            {serverError}
          </div>
        ) : null}

        <div className="flex flex-col gap-1">
          <label htmlFor="document-publish-text" className="label">
            {t('documentos', 'publishText')}
          </label>
          <textarea
            id="document-publish-text"
            ref={textRef}
            data-testid={DOCUMENTOS_TESTIDS.DOCUMENT_PUBLISH_TEXT}
            rows={12}
            value={text}
            disabled={!loaded}
            aria-invalid={errors.text ? true : undefined}
            aria-describedby={errors.text ? 'document-publish-text-error' : undefined}
            onChange={(event) => {
              setText(event.target.value);
              setErrors((current) => ({ ...current, text: '' }));
            }}
            className={`input !h-auto !bg-surface px-2.5 py-2 font-mono text-[12px] ${errors.text ? '!border-danger' : ''}`}
            style={{ resize: 'vertical' }}
          />
          {errors.text ? (
            <span id="document-publish-text-error" role="alert" data-testid={DOCUMENTOS_TESTIDS.DOCUMENT_PUBLISH_TEXT_ERROR} className="text-[12px] text-danger">
              {message(errors.text)}
            </span>
          ) : null}
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="document-publish-note" className="label">
            {t('documentos', 'publishNote')}
          </label>
          <input
            id="document-publish-note"
            data-testid={DOCUMENTOS_TESTIDS.DOCUMENT_PUBLISH_NOTE}
            value={note}
            placeholder={t('documentos', 'publishNotePlaceholder')}
            onChange={(event) => setNote(event.target.value)}
            className="input !h-8 !bg-surface"
          />
          {errors.note ? (
            <span role="alert" className="text-[12px] text-danger">
              {message(errors.note)}
            </span>
          ) : null}
        </div>

        <div className="mt-auto flex justify-end gap-2 border-t border-border pt-3">
          <button type="button" data-testid={DOCUMENTOS_TESTIDS.DOCUMENT_PUBLISH_CANCEL} onClick={onClose} className="btn btn-ghost">
            {t('documentos', 'publishCancel')}
          </button>
          <button
            type="submit"
            data-testid={DOCUMENTOS_TESTIDS.DOCUMENT_PUBLISH_SUBMIT}
            disabled={!loaded || submitting}
            aria-busy={submitting}
            title={submitting ? t('common', 'processing') : undefined}
            className="btn btn-primary"
          >
            {submitting ? <Spinner /> : null}
            {t('documentos', 'publishSubmit')}
          </button>
        </div>
      </form>
    </Modal>
  );
};
