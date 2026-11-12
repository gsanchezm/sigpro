import { ApiError, HITOS_TESTIDS, createMilestoneSchema, flattenIssues, type MessageKey, type MilestoneDto } from '@sigpro/shared';
import { useRef, useState, type FormEvent } from 'react';
import { formatTrace } from '../../lib/errors';
import { useIsMobileLayout } from '../../lib/layout';
import { useAuth } from '../../state/auth';
import { useI18n } from '../../state/i18n';
import { Modal } from '../../ui/Modal';
import { Spinner } from '../../ui/Spinner';

interface NewMilestoneDialogProps {
  readonly programCode: string;
  readonly onClose: () => void;
  readonly onCreated: (milestone: MilestoneDto) => void;
}

type Errors = Readonly<Record<string, string>>;

/** Alta de un hito: nombre y fecha límite, validados con el mismo esquema Zod que la API (422 → mensajes por campo). */
export const NewMilestoneDialog = ({ programCode, onClose, onCreated }: NewMilestoneDialogProps) => {
  const { t } = useI18n();
  const { api } = useAuth();
  const mobile = useIsMobileLayout();
  const nameRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [errors, setErrors] = useState<Errors>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const message = (key: string | undefined): string => (key ? t('hitos', key as MessageKey<'hitos'>) : '');

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (submitting) return;
    const parsed = createMilestoneSchema.safeParse({ name, dueDate });
    if (!parsed.success) {
      setErrors(flattenIssues(parsed.error.issues));
      return;
    }
    setErrors({});
    setServerError(null);
    setSubmitting(true);
    try {
      onCreated(await api.milestones.create(programCode, parsed.data));
    } catch (failure) {
      if (failure instanceof ApiError && failure.status === 422 && failure.body.errors) setErrors(failure.body.errors);
      else setServerError(formatTrace(failure) || t('common', 'networkError'));
      setSubmitting(false);
    }
  };

  return (
    <Modal
      role="dialog"
      testId={HITOS_TESTIDS.MILESTONE_NEW_DIALOG}
      labelledBy="milestone-new-heading"
      onClose={onClose}
      initialFocus={nameRef}
      className={mobile ? 'inset-x-0 bottom-0 top-16 rounded-t-[10px]' : 'top-1/2 left-1/2 w-[min(440px,calc(100%-32px))] -translate-x-1/2 -translate-y-1/2 rounded-card'}
    >
      <form noValidate onSubmit={(event) => void submit(event)} className="flex flex-1 flex-col gap-3.5 overflow-auto p-5">
        <h2 id="milestone-new-heading" className="section-title">
          {t('hitos', 'newTitle')}
        </h2>
        <p className="m-0 font-mono text-[12px] text-fg-3">{programCode}</p>

        {serverError ? (
          <div role="alert" data-testid={HITOS_TESTIDS.MILESTONE_NEW_SERVER_ERROR} className="alert alert-danger text-[12.5px]">
            {serverError}
          </div>
        ) : null}

        <div className="flex flex-col gap-1">
          <label htmlFor="milestone-new-name" className="label">
            {t('hitos', 'newName')} <span aria-hidden="true" className="text-danger">*</span>
          </label>
          <input
            id="milestone-new-name"
            ref={nameRef}
            data-testid={HITOS_TESTIDS.MILESTONE_NEW_NAME}
            required
            aria-required="true"
            aria-invalid={errors.name ? true : undefined}
            aria-describedby={errors.name ? 'milestone-new-name-error' : undefined}
            placeholder={t('hitos', 'newNamePlaceholder')}
            value={name}
            onChange={(event) => {
              setName(event.target.value);
              setErrors((current) => ({ ...current, name: '' }));
            }}
            className={`input !h-8 !bg-surface ${errors.name ? '!border-danger' : ''}`}
          />
          {errors.name ? (
            <span id="milestone-new-name-error" role="alert" data-testid={HITOS_TESTIDS.MILESTONE_NEW_NAME_ERROR} className="text-[12px] text-danger">
              {message(errors.name)}
            </span>
          ) : null}
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="milestone-new-date" className="label">
            {t('hitos', 'newDate')} <span aria-hidden="true" className="text-danger">*</span>
          </label>
          <input
            id="milestone-new-date"
            type="date"
            data-testid={HITOS_TESTIDS.MILESTONE_NEW_DATE}
            required
            aria-required="true"
            aria-invalid={errors.dueDate ? true : undefined}
            aria-describedby={errors.dueDate ? 'milestone-new-date-error' : undefined}
            value={dueDate}
            onChange={(event) => {
              setDueDate(event.target.value);
              setErrors((current) => ({ ...current, dueDate: '' }));
            }}
            className={`input !h-8 !bg-surface !font-mono ${errors.dueDate ? '!border-danger' : ''}`}
          />
          {errors.dueDate ? (
            <span id="milestone-new-date-error" role="alert" data-testid={HITOS_TESTIDS.MILESTONE_NEW_DATE_ERROR} className="text-[12px] text-danger">
              {message(errors.dueDate)}
            </span>
          ) : null}
        </div>

        <div className="mt-auto flex justify-end gap-2 border-t border-border pt-3">
          <button type="button" data-testid={HITOS_TESTIDS.MILESTONE_NEW_CANCEL} onClick={onClose} className="btn btn-ghost">
            {t('hitos', 'newCancel')}
          </button>
          <button
            type="submit"
            data-testid={HITOS_TESTIDS.MILESTONE_NEW_SUBMIT}
            disabled={submitting}
            aria-busy={submitting}
            title={submitting ? t('common', 'processing') : undefined}
            className="btn btn-primary"
          >
            {submitting ? <Spinner /> : null}
            {t('hitos', 'newSubmit')}
          </button>
        </div>
      </form>
    </Modal>
  );
};
