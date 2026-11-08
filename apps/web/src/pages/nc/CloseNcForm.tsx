import { ApiError, NC_CLOSE_MIN_LENGTH, NC_COMMENT_MAX_LENGTH, NC_TESTIDS } from '@sigpro/shared';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { formatTrace } from '../../lib/errors';
import { useConfig } from '../../state/config';
import { useI18n } from '../../state/i18n';
import { Spinner } from '../../ui/Spinner';
import { closureErrorKey, fieldError } from './nc-view';
import { useNcMessage } from './useNcLabels';

interface CloseNcFormProps {
  /** Cierra la NC con el comentario; si rechaza con un 422 el motivo se muestra bajo el campo. */
  readonly onSubmit: (comment: string) => Promise<void>;
  readonly onCancel: () => void;
}

/**
 * Formulario del comentario de cierre (mínimo 20 caracteres). Lo usan el diálogo del tablero (al soltar una tarjeta en
 * «Cerrada») y el detalle. Valida al enviar y muestra también el 422 del servidor.
 */
export const CloseNcForm = ({ onSubmit, onCancel }: CloseNcFormProps) => {
  const { t } = useI18n();
  const { plantedBugs } = useConfig();
  const message = useNcMessage();
  const [text, setText] = useState('');
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const areaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => areaRef.current?.focus(), []);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    // El servidor aplica la misma regla (`PLANTED_BUGS` degrada ambos lados a 19 caracteres)
    const invalid = closureErrorKey(text, plantedBugs);
    if (invalid) {
      setErrorKey(invalid);
      areaRef.current?.focus();
      return;
    }
    setSubmitting(true);
    setServerError(null);
    try {
      await onSubmit(text.trim());
    } catch (error) {
      const fromServer = error instanceof ApiError && error.status === 422 ? fieldError(error.body.errors, 'comment') : null;
      if (fromServer) setErrorKey(fromServer);
      else setServerError(formatTrace(error) || t('common', 'genericError'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form noValidate onSubmit={(event) => void submit(event)} className="flex flex-col gap-3">
      <p className="m-0 text-fg-2">{t('nc', 'closeIntro', { min: NC_CLOSE_MIN_LENGTH })}</p>
      {serverError ? (
        <div role="alert" data-testid={NC_TESTIDS.NC_CLOSE_SERVER_ERROR} className="alert alert-danger text-[12.5px]">
          {serverError}
        </div>
      ) : null}
      <div className="flex flex-col gap-1">
        <label htmlFor="nc-close-comment" className="label">
          {t('nc', 'closeLabel')} <span aria-hidden="true" className="text-danger">*</span>
        </label>
        <textarea
          id="nc-close-comment"
          ref={areaRef}
          data-testid={NC_TESTIDS.NC_CLOSE_COMMENT}
          rows={4}
          maxLength={NC_COMMENT_MAX_LENGTH}
          required
          aria-required="true"
          aria-invalid={errorKey ? true : undefined}
          aria-describedby={errorKey ? 'nc-close-error nc-close-counter' : 'nc-close-counter'}
          placeholder={t('nc', 'closePlaceholder')}
          value={text}
          onChange={(event) => {
            setText(event.target.value);
            setErrorKey(null);
          }}
          className={`input !h-auto resize-y px-2.5 py-2 leading-[1.5] ${errorKey ? '!border-danger' : ''}`}
        />
        <div className="flex items-start justify-between gap-3">
          {errorKey ? (
            <span id="nc-close-error" role="alert" data-testid={NC_TESTIDS.NC_CLOSE_ERROR} className="text-[12px] text-danger">
              {message(errorKey)}
            </span>
          ) : (
            <span />
          )}
          <span id="nc-close-counter" data-testid={NC_TESTIDS.NC_CLOSE_COUNTER} className="flex-none font-mono text-[11.5px] text-fg-3">
            {t('nc', 'closeCounter', { count: text.trim().length, min: NC_CLOSE_MIN_LENGTH })}
          </span>
        </div>
      </div>
      <div className="flex justify-end gap-2 border-t border-border pt-3">
        <button type="button" data-testid={NC_TESTIDS.NC_CLOSE_CANCEL} onClick={onCancel} className="btn btn-ghost">
          {t('nc', 'closeCancel')}
        </button>
        <button
          type="submit"
          data-testid={NC_TESTIDS.NC_CLOSE_SUBMIT}
          disabled={submitting}
          aria-busy={submitting}
          title={submitting ? t('common', 'processing') : undefined}
          className="btn btn-primary"
        >
          {submitting ? <Spinner /> : null}
          {t('nc', 'closeSubmit')}
        </button>
      </div>
    </form>
  );
};
