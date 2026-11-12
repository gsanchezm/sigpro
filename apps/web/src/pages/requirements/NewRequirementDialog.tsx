import {
  ApiError,
  PRIORITIES,
  REQUISITOS_TESTIDS,
  createRequirementSchema,
  flattenIssues,
  type CreateRequirementInput,
  type MessageKey,
  type Priority,
  type RequirementDto,
} from '@sigpro/shared';
import { useRef, useState, type FormEvent } from 'react';
import { formatTrace } from '../../lib/errors';
import { useIsMobileLayout } from '../../lib/layout';
import { useI18n } from '../../state/i18n';
import { Modal } from '../../ui/Modal';
import { Spinner } from '../../ui/Spinner';

interface NewRequirementDialogProps {
  readonly programCode: string;
  readonly items: readonly RequirementDto[];
  /** Requisito padre preseleccionado (menú «Añadir hijo»). */
  readonly parentCode: string | null;
  readonly onClose: () => void;
  readonly onSubmit: (input: CreateRequirementInput) => Promise<void>;
}

/** Diálogo de alta: título, requisito padre (`<select>` nativo) y prioridad. Valida con el mismo esquema Zod que la API. */
export const NewRequirementDialog = ({ programCode, items, parentCode, onClose, onSubmit }: NewRequirementDialogProps) => {
  const { t } = useI18n();
  const mobile = useIsMobileLayout();
  const [title, setTitle] = useState('');
  const [parent, setParent] = useState(parentCode ?? '');
  const [priority, setPriority] = useState<Priority>('medium');
  const [errors, setErrors] = useState<Readonly<Record<string, string>>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const titleRef = useRef<HTMLInputElement>(null);
  const message = (key: string) => t('requisitos', key as MessageKey<'requisitos'>);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const parsed = createRequirementSchema.safeParse({ programCode, title, parentCode: parent || null, priority });
    if (!parsed.success) {
      setErrors(flattenIssues(parsed.error.issues));
      return;
    }
    setSubmitting(true);
    setServerError(null);
    try {
      await onSubmit(parsed.data);
    } catch (error) {
      const fieldErrors = error instanceof ApiError && error.status === 422 ? (error.body.errors ?? {}) : null;
      if (fieldErrors) setErrors(fieldErrors);
      setServerError(fieldErrors ? message(Object.values(fieldErrors)[0] ?? 'required') : formatTrace(error) || t('common', 'genericError'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      role="dialog"
      testId={REQUISITOS_TESTIDS.REQUIREMENT_NEW_DIALOG}
      labelledBy="requirement-new-heading"
      onClose={onClose}
      initialFocus={titleRef}
      className={mobile ? 'inset-x-0 bottom-0 top-16 rounded-t-[10px]' : 'top-1/2 left-1/2 w-[min(480px,calc(100%-32px))] -translate-x-1/2 -translate-y-1/2 rounded-card'}
    >
      <form noValidate onSubmit={(event) => void submit(event)} className="flex flex-1 flex-col gap-3.5 overflow-auto p-5">
        <h2 id="requirement-new-heading" className="section-title">
          {t('requisitos', 'newDialog')}
        </h2>
        <p className="m-0 font-mono text-[12px] text-fg-3">{programCode}</p>

        {serverError ? (
          <div role="alert" data-testid={REQUISITOS_TESTIDS.REQUIREMENT_NEW_SERVER_ERROR} className="alert alert-danger text-[12.5px]">
            {serverError}
          </div>
        ) : null}

        <div className="flex flex-col gap-1">
          <label htmlFor="requirement-new-title" className="label">
            {t('requisitos', 'titleLabel')} <span aria-hidden="true" className="text-danger">*</span>
          </label>
          <input
            id="requirement-new-title"
            ref={titleRef}
            data-testid={REQUISITOS_TESTIDS.REQUIREMENT_NEW_TITLE}
            required
            aria-required="true"
            aria-invalid={errors.title ? true : undefined}
            aria-describedby={errors.title ? 'requirement-new-title-error' : undefined}
            placeholder={t('requisitos', 'titlePlaceholder')}
            value={title}
            onChange={(event) => {
              setTitle(event.target.value);
              setErrors((current) => ({ ...current, title: '' }));
            }}
            className={`input !h-8 !bg-surface ${errors.title ? '!border-danger' : ''}`}
          />
          {errors.title ? (
            <span id="requirement-new-title-error" role="alert" data-testid={REQUISITOS_TESTIDS.REQUIREMENT_NEW_TITLE_ERROR} className="text-[12px] text-danger">
              {message(errors.title)}
            </span>
          ) : null}
        </div>

        <div className="grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-3">
          <div className="flex flex-col gap-1">
            <label htmlFor="requirement-new-parent" className="label">
              {t('requisitos', 'newParent')}
            </label>
            <select
              id="requirement-new-parent"
              data-testid={REQUISITOS_TESTIDS.REQUIREMENT_NEW_PARENT}
              value={parent}
              onChange={(event) => setParent(event.target.value)}
              className="input !h-8 !bg-surface"
            >
              <option value="">{t('requisitos', 'noParent')}</option>
              {items.map((item) => (
                <option key={item.code} value={item.code}>
                  {item.code} · {item.title}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="requirement-new-priority" className="label">
              {t('requisitos', 'priorityLabel')}
            </label>
            <select
              id="requirement-new-priority"
              data-testid={REQUISITOS_TESTIDS.REQUIREMENT_NEW_PRIORITY}
              value={priority}
              onChange={(event) => setPriority(event.target.value as Priority)}
              className="input !h-8 !bg-surface"
            >
              {PRIORITIES.map((value) => (
                <option key={value} value={value}>
                  {t('programas', value)}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-auto flex justify-end gap-2 border-t border-border pt-3">
          <button type="button" data-testid={REQUISITOS_TESTIDS.REQUIREMENT_NEW_CANCEL} onClick={onClose} className="btn btn-ghost">
            {t('requisitos', 'cancel')}
          </button>
          <button
            type="submit"
            data-testid={REQUISITOS_TESTIDS.REQUIREMENT_NEW_SUBMIT}
            disabled={submitting}
            aria-busy={submitting}
            title={submitting ? t('common', 'processing') : undefined}
            className="btn btn-primary"
          >
            {submitting ? <Spinner /> : null}
            {t('requisitos', 'create')}
          </button>
        </div>
      </form>
    </Modal>
  );
};
