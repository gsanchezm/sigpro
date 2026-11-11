import { ApiError, NC_TESTIDS, createNcSchema, flattenIssues, type CreateNcInput, type NcSeverity } from '@sigpro/shared';
import { useRef, useState, type FormEvent } from 'react';
import { formatTrace } from '../../lib/errors';
import { useBreakpoint } from '../../lib/hooks';
import { useI18n } from '../../state/i18n';
import { Modal } from '../../ui/Modal';
import { RichTextEditor } from '../../ui/RichTextEditor';
import { SeverityPicker } from '../../ui/SeverityPicker';
import { Spinner } from '../../ui/Spinner';
import { useNcLabels, useNcMessage } from './useNcLabels';

interface NewNcDialogProps {
  readonly programs: readonly { readonly code: string; readonly name: string }[];
  readonly onClose: () => void;
  readonly onSubmit: (input: CreateNcInput) => Promise<void>;
}

/** Alta de una no conformidad: programa (`<select>`), severidad (web component Shadow DOM) y descripción enriquecida. */
export const NewNcDialog = ({ programs, onClose, onSubmit }: NewNcDialogProps) => {
  const { t } = useI18n();
  const labels = useNcLabels();
  const message = useNcMessage();
  const mobile = useBreakpoint() === 'mobile';
  const [programCode, setProgramCode] = useState('');
  const [severity, setSeverity] = useState<NcSeverity | null>(null);
  const [description, setDescription] = useState('');
  const [errors, setErrors] = useState<Readonly<Record<string, string>>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const programRef = useRef<HTMLSelectElement>(null);
  const clear = (field: string) => setErrors((current) => ({ ...current, [field]: '' }));

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const parsed = createNcSchema.safeParse({ programCode, severity: severity ?? '', description });
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
      setServerError(fieldErrors ? message(Object.values(fieldErrors)[0] ?? 'programRequired') : formatTrace(error) || t('common', 'genericError'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      role="dialog"
      testId={NC_TESTIDS.NC_NEW_DIALOG}
      labelledBy="nc-new-heading"
      onClose={onClose}
      initialFocus={programRef}
      className={mobile ? 'inset-0 rounded-none' : 'top-1/2 left-1/2 max-h-[calc(100vh-48px)] w-[min(560px,calc(100%-32px))] -translate-x-1/2 -translate-y-1/2 rounded-card'}
    >
      <form noValidate onSubmit={(event) => void submit(event)} className="flex flex-1 flex-col gap-3.5 overflow-auto p-5">
        <h2 id="nc-new-heading" className="section-title">
          {t('nc', 'newTitle')}
        </h2>

        {serverError ? (
          <div role="alert" data-testid={NC_TESTIDS.NC_NEW_SERVER_ERROR} className="alert alert-danger text-[12.5px]">
            {serverError}
          </div>
        ) : null}

        <div className="flex flex-col gap-1">
          <label htmlFor="nc-new-program" className="label">
            {t('nc', 'newProgram')} <span aria-hidden="true" className="text-danger">*</span>
          </label>
          <select
            id="nc-new-program"
            ref={programRef}
            data-testid={NC_TESTIDS.NC_NEW_PROGRAM}
            required
            aria-required="true"
            aria-invalid={errors.programCode ? true : undefined}
            aria-describedby={errors.programCode ? 'nc-new-program-error' : undefined}
            value={programCode}
            onChange={(event) => {
              setProgramCode(event.target.value);
              clear('programCode');
            }}
            className={`input !h-8 !bg-surface ${errors.programCode ? '!border-danger' : ''}`}
          >
            <option value="">{t('nc', 'newProgramPlaceholder')}</option>
            {programs.map((program) => (
              <option key={program.code} value={program.code}>
                {program.code} · {program.name}
              </option>
            ))}
          </select>
          {errors.programCode ? (
            <span id="nc-new-program-error" role="alert" data-testid={NC_TESTIDS.NC_NEW_PROGRAM_ERROR} className="text-[12px] text-danger">
              {message(errors.programCode)}
            </span>
          ) : null}
        </div>

        <div className="flex flex-col gap-1">
          <span id="nc-new-severity-label" className="label">
            {t('nc', 'newSeverity')} <span aria-hidden="true" className="text-danger">*</span>
          </span>
          <SeverityPicker
            value={severity}
            onChange={(next) => {
              setSeverity(next);
              clear('severity');
            }}
            label={t('nc', 'newSeverity')}
            labels={labels.severities}
            testId={NC_TESTIDS.NC_NEW_SEVERITY}
          />
          {errors.severity ? (
            <span role="alert" data-testid={NC_TESTIDS.NC_NEW_SEVERITY_ERROR} className="text-[12px] text-danger">
              {message(errors.severity)}
            </span>
          ) : null}
        </div>

        <div className="flex flex-col gap-1">
          <span id="nc-new-description-label" className="label">
            {t('nc', 'newDescription')} <span aria-hidden="true" className="text-danger">*</span>
          </span>
          <RichTextEditor
            id="nc-new-description"
            labelledBy="nc-new-description-label"
            testId={NC_TESTIDS.NC_NEW_DESCRIPTION}
            placeholder={t('nc', 'descriptionPlaceholder')}
            initialHtml=""
            toolbar={{
              label: t('nc', 'editorToolbar'),
              bold: t('nc', 'editorBold'),
              italic: t('nc', 'editorItalic'),
              list: t('nc', 'editorList'),
              testId: NC_TESTIDS.NC_EDITOR_TOOLBAR,
              boldTestId: NC_TESTIDS.NC_EDITOR_BOLD,
              italicTestId: NC_TESTIDS.NC_EDITOR_ITALIC,
              listTestId: NC_TESTIDS.NC_EDITOR_LIST,
            }}
            onChange={(html) => {
              setDescription(html);
              clear('description');
            }}
          />
          {errors.description ? (
            <span role="alert" data-testid={NC_TESTIDS.NC_NEW_DESCRIPTION_ERROR} className="text-[12px] text-danger">
              {message(errors.description)}
            </span>
          ) : null}
        </div>

        <div className="mt-auto flex justify-end gap-2 border-t border-border pt-3">
          <button type="button" data-testid={NC_TESTIDS.NC_NEW_CANCEL} onClick={onClose} className="btn btn-ghost">
            {t('nc', 'newCancel')}
          </button>
          <button
            type="submit"
            data-testid={NC_TESTIDS.NC_NEW_SUBMIT}
            disabled={submitting}
            aria-busy={submitting}
            title={submitting ? t('common', 'processing') : undefined}
            className="btn btn-primary"
          >
            {submitting ? <Spinner /> : null}
            {t('nc', 'newSubmit')}
          </button>
        </div>
      </form>
    </Modal>
  );
};
