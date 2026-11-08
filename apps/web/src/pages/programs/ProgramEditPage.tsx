import {
  ApiError,
  DETALLE_TESTIDS,
  EDITAR_PROGRAMA_TESTIDS,
  PRIORITIES,
  PROGRAM_STATUSES,
  can,
  flattenIssues,
  updateProgramSchema,
  type MessageKey,
  type Priority,
  type ProgramDto,
  type ProgramStatus,
} from '@sigpro/shared';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { formatTrace } from '../../lib/errors';
import { useAuth } from '../../state/auth';
import { useSaveLabel } from '../../state/config';
import { useI18n } from '../../state/i18n';
import { useToast } from '../../state/toast';
import { OwnerCombobox } from '../../ui/OwnerCombobox';
import { Spinner } from '../../ui/Spinner';
import { useOwners } from './useProgramsData';

interface EditForm {
  readonly name: string;
  readonly description: string;
  readonly ownerId: string;
  readonly status: ProgramStatus;
  readonly startDate: string;
  readonly endDate: string;
  readonly budget: string;
  readonly priority: Priority;
  readonly classified: boolean;
}

type Errors = Readonly<Record<string, string>>;

const toForm = (program: ProgramDto): EditForm => ({
  name: program.name,
  description: program.description,
  ownerId: program.ownerId,
  status: program.status,
  startDate: program.startDate,
  endDate: program.endDate,
  budget: String(program.budgetEur),
  priority: program.priority,
  classified: program.classified,
});

const PRIORITY_TESTIDS: Readonly<Record<Priority, string>> = {
  low: EDITAR_PROGRAMA_TESTIDS.PROGRAM_EDIT_PRIORITY_LOW,
  medium: EDITAR_PROGRAMA_TESTIDS.PROGRAM_EDIT_PRIORITY_MEDIUM,
  high: EDITAR_PROGRAMA_TESTIDS.PROGRAM_EDIT_PRIORITY_HIGH,
};

const fieldClass = (invalid: boolean) => `input !h-8 !bg-surface ${invalid ? '!border-danger' : ''}`;

/** Edición de un programa (`/programs/:code/edit`): PATCH parcial con las mismas validaciones que el alta. */
export const ProgramEditPage = () => {
  const { code = '' } = useParams();
  const { t } = useI18n();
  const saveLabel = useSaveLabel();
  const { api, user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const { owners } = useOwners();
  const [program, setProgram] = useState<ProgramDto | null>(null);
  const [failure, setFailure] = useState<unknown>(null);
  const [form, setForm] = useState<EditForm | null>(null);
  const [errors, setErrors] = useState<Errors>({});
  const [serverError, setServerError] = useState<{ status: string; text: string } | null>(null);
  const [saving, setSaving] = useState<'save' | 'close' | null>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const message = (key: string) => t('programas', key as MessageKey<'programas'>);
  const canEdit = user ? can(user.role, 'program.edit') : false;

  useEffect(() => {
    let cancelled = false;
    setProgram(null);
    setFailure(null);
    api.programs.get(code).then(
      (found) => {
        if (cancelled) return;
        setProgram(found);
        setForm(toForm(found));
      },
      (error: unknown) => !cancelled && setFailure(error),
    );
    return () => {
      cancelled = true;
    };
  }, [api, code]);

  if (failure) {
    const missing = failure instanceof ApiError && failure.status === 404;
    return (
      <section role="alert" data-testid={EDITAR_PROGRAMA_TESTIDS.PROGRAM_EDIT_NOT_FOUND} className="alert alert-danger flex max-w-[560px] flex-col gap-1">
        <h1 className="m-0 text-[16px] font-semibold">{missing ? t('common', 'notFound') : t('common', 'genericError')}</h1>
        <span className="trace">{formatTrace(failure)}</span>
        <Link to="/programs" data-testid={DETALLE_TESTIDS.PROGRAM_DETAIL_BACK} className="mt-1 self-start text-[12.5px] font-medium">
          {t('common', 'backToPrograms')}
        </Link>
      </section>
    );
  }

  if (!program || !form) {
    return (
      <div aria-busy="true" role="status" className="flex flex-col gap-3">
        <span className="skeleton h-6 w-64" />
        <span className="skeleton h-40 w-full max-w-[720px] !rounded-[6px]" />
      </div>
    );
  }

  if (!canEdit) {
    return (
      <section role="alert" data-testid={EDITAR_PROGRAMA_TESTIDS.PROGRAM_EDIT_DENIED} className="alert alert-warn flex max-w-[560px] flex-col gap-1">
        <h1 className="m-0 text-[16px] font-semibold">{t('programas', 'editProgram')}</h1>
        <p className="m-0">{t('programas', 'editDenied')}</p>
        <Link to={`/programs/${program.code}`} data-testid={EDITAR_PROGRAMA_TESTIDS.PROGRAM_EDIT_BACK} className="mt-1 self-start text-[12.5px] font-medium">
          {t('programas', 'backToDetail')}
        </Link>
      </section>
    );
  }

  const baseline = toForm(program);
  const dirty = (Object.keys(form) as (keyof EditForm)[]).some((key) => form[key] !== baseline[key]);
  const set = <K extends keyof EditForm>(key: K, value: EditForm[K]) => {
    setForm((current) => (current ? { ...current, [key]: value } : current));
    setErrors((current) => ({ ...current, [key]: '' }));
  };
  const errorOf = (field: string): string | undefined => (errors[field] ? message(errors[field]) : undefined);

  const save = async (closeAfter: boolean) => {
    const parsed = updateProgramSchema.safeParse({ ...form, budget: Number(form.budget) });
    if (!parsed.success) {
      setErrors(flattenIssues(parsed.error.issues));
      return;
    }
    setSaving(closeAfter ? 'close' : 'save');
    setServerError(null);
    try {
      const updated = await api.programs.update(program.code, parsed.data);
      setProgram(updated);
      setForm(toForm(updated));
      setErrors({});
      toast.push('ok', t('programas', 'updated'), t('programas', 'updatedBody', { code: updated.code }));
      if (closeAfter) navigate(`/programs/${updated.code}`);
    } catch (error) {
      const fieldErrors = error instanceof ApiError && error.status === 422 ? (error.body.errors ?? {}) : null;
      if (fieldErrors) {
        setErrors(fieldErrors);
        setServerError({ status: '422', text: message(Object.values(fieldErrors)[0] ?? 'dupName') });
      } else {
        setServerError({ status: error instanceof ApiError ? String(error.status || '—') : '—', text: formatTrace(error) || t('common', 'genericError') });
      }
    } finally {
      setSaving(null);
    }
  };

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    void save(false);
  };

  const noChangesTitle = dirty ? undefined : t('programas', 'noChanges');

  return (
    <div data-testid={EDITAR_PROGRAMA_TESTIDS.PROGRAM_EDIT_PAGE} className="flex max-w-[720px] flex-col gap-4">
      <header className="flex flex-col gap-1">
        <h1 className="m-0 text-[20px] font-semibold tracking-[-.01em]">{t('programas', 'editProgram')}</h1>
        <p className="m-0 text-[12.5px] text-fg-2">
          <span className="font-mono">{program.code}</span> · {program.name}
        </p>
      </header>

      {serverError ? (
        <div role="alert" data-testid={EDITAR_PROGRAMA_TESTIDS.PROGRAM_EDIT_SERVER_ERROR} className="alert alert-danger text-[12.5px]">
          <strong className="font-mono">{serverError.status}</strong> · {serverError.text}
        </div>
      ) : null}

      <form data-testid={EDITAR_PROGRAMA_TESTIDS.PROGRAM_EDIT_FORM} noValidate onSubmit={onSubmit} aria-busy={saving !== null} className="card flex flex-col gap-3.5 p-5">
        <div className="flex flex-col gap-1">
          <label htmlFor="edit-code" className="label">
            {t('programas', 'code')}
          </label>
          <input
            id="edit-code"
            data-testid={EDITAR_PROGRAMA_TESTIDS.PROGRAM_EDIT_CODE}
            value={program.code}
            readOnly
            title={t('programas', 'codeReadonly')}
            className="input !h-8 !border-border !bg-surface-2 !font-mono !text-fg-2"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="edit-name" className="label">
            {t('programas', 'name')} <span aria-hidden="true" className="text-danger">*</span>
          </label>
          <input
            id="edit-name"
            ref={nameRef}
            data-testid={EDITAR_PROGRAMA_TESTIDS.PROGRAM_EDIT_NAME}
            required
            aria-required="true"
            aria-invalid={errors.name ? true : undefined}
            aria-describedby={errors.name ? 'edit-name-error' : undefined}
            value={form.name}
            onChange={(event) => set('name', event.target.value)}
            placeholder={t('programas', 'namePlaceholder')}
            className={fieldClass(Boolean(errors.name))}
          />
          {errors.name ? (
            <span id="edit-name-error" role="alert" data-testid={EDITAR_PROGRAMA_TESTIDS.PROGRAM_EDIT_NAME_ERROR} className="text-[12px] text-danger">
              {errorOf('name')}
            </span>
          ) : null}
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="edit-description" className="label">
            {t('programas', 'description')}
          </label>
          <textarea
            id="edit-description"
            data-testid={EDITAR_PROGRAMA_TESTIDS.PROGRAM_EDIT_DESCRIPTION}
            rows={3}
            value={form.description}
            onChange={(event) => set('description', event.target.value)}
            className="input !h-auto !bg-surface px-2.5 py-2"
            style={{ resize: 'vertical' }}
          />
        </div>

        <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-3">
          <div className="relative flex flex-col gap-1">
            <label htmlFor="edit-owner" className="label">
              {t('programas', 'owner')} <span aria-hidden="true" className="text-danger">*</span>
            </label>
            <OwnerCombobox
              inputId="edit-owner"
              testIdPrefix="program-edit-owner"
              inputTestId={EDITAR_PROGRAMA_TESTIDS.PROGRAM_EDIT_OWNER}
              listTestId={EDITAR_PROGRAMA_TESTIDS.PROGRAM_EDIT_OWNER_LIST}
              owners={owners}
              value={form.ownerId || null}
              onChange={(ownerId) => set('ownerId', ownerId ?? '')}
              placeholder={t('programas', 'searchPerson')}
              listLabel={t('programas', 'owner')}
              noMatch={t('programas', 'noOwnerMatch')}
              invalid={Boolean(errors.ownerId)}
              describedBy={errors.ownerId ? 'edit-owner-error' : undefined}
              inputClassName={`!h-8 !bg-surface ${errors.ownerId ? '!border-danger' : ''}`}
            />
            {errors.ownerId ? (
              <span id="edit-owner-error" role="alert" data-testid={EDITAR_PROGRAMA_TESTIDS.PROGRAM_EDIT_OWNER_ERROR} className="text-[12px] text-danger">
                {errorOf('ownerId')}
              </span>
            ) : null}
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="edit-status" className="label">
              {t('programas', 'status')}
            </label>
            <select
              id="edit-status"
              data-testid={EDITAR_PROGRAMA_TESTIDS.PROGRAM_EDIT_STATUS}
              value={form.status}
              onChange={(event) => set('status', event.target.value as ProgramStatus)}
              className="input !h-8 !bg-surface"
            >
              {PROGRAM_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {message(`st_${status}`)}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-[repeat(auto-fit,minmax(160px,1fr))] gap-3">
          <div className="flex flex-col gap-1">
            <label htmlFor="edit-start" className="label">
              {t('programas', 'startDate')} <span aria-hidden="true" className="text-danger">*</span>
            </label>
            <input
              id="edit-start"
              type="date"
              data-testid={EDITAR_PROGRAMA_TESTIDS.PROGRAM_EDIT_START}
              aria-invalid={errors.startDate ? true : undefined}
              aria-describedby={errors.startDate ? 'edit-start-error' : undefined}
              value={form.startDate}
              onChange={(event) => set('startDate', event.target.value)}
              className={`${fieldClass(Boolean(errors.startDate))} !font-mono !text-[12px]`}
            />
            {errors.startDate ? (
              <span id="edit-start-error" role="alert" data-testid={EDITAR_PROGRAMA_TESTIDS.PROGRAM_EDIT_START_ERROR} className="text-[12px] text-danger">
                {errorOf('startDate')}
              </span>
            ) : null}
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="edit-end" className="label">
              {t('programas', 'endDate')} <span aria-hidden="true" className="text-danger">*</span>
            </label>
            <input
              id="edit-end"
              type="date"
              data-testid={EDITAR_PROGRAMA_TESTIDS.PROGRAM_EDIT_END}
              aria-invalid={errors.endDate ? true : undefined}
              aria-describedby={errors.endDate ? 'edit-end-error' : undefined}
              value={form.endDate}
              onChange={(event) => set('endDate', event.target.value)}
              className={`${fieldClass(Boolean(errors.endDate))} !font-mono !text-[12px]`}
            />
            {errors.endDate ? (
              <span id="edit-end-error" role="alert" data-testid={EDITAR_PROGRAMA_TESTIDS.PROGRAM_EDIT_END_ERROR} className="text-[12px] text-danger">
                {errorOf('endDate')}
              </span>
            ) : null}
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="edit-budget" className="label">
              {t('programas', 'budget')} (€) <span aria-hidden="true" className="text-danger">*</span>
            </label>
            <input
              id="edit-budget"
              type="number"
              min={0}
              step={1000}
              inputMode="numeric"
              data-testid={EDITAR_PROGRAMA_TESTIDS.PROGRAM_EDIT_BUDGET}
              aria-invalid={errors.budget ? true : undefined}
              aria-describedby={errors.budget ? 'edit-budget-error' : undefined}
              value={form.budget}
              onChange={(event) => set('budget', event.target.value)}
              placeholder="0"
              className={`${fieldClass(Boolean(errors.budget))} !font-mono !text-[12px]`}
            />
            {errors.budget ? (
              <span id="edit-budget-error" role="alert" data-testid={EDITAR_PROGRAMA_TESTIDS.PROGRAM_EDIT_BUDGET_ERROR} className="text-[12px] text-danger">
                {errorOf('budget')}
              </span>
            ) : null}
          </div>
        </div>

        <fieldset className="m-0 flex flex-col gap-1.5 border-0 p-0">
          <legend className="mb-1 p-0 text-[12px] font-medium text-fg-2">{t('programas', 'priority')}</legend>
          <div className="flex flex-wrap gap-4">
            {PRIORITIES.map((priority) => (
              <label key={priority} className="flex min-h-6 cursor-pointer items-center gap-1.5">
                <input
                  type="radio"
                  name="edit-priority"
                  value={priority}
                  data-testid={PRIORITY_TESTIDS[priority]}
                  checked={form.priority === priority}
                  onChange={() => set('priority', priority)}
                  className="m-0 accent-accent"
                />
                {message(priority)}
              </label>
            ))}
          </div>
        </fieldset>

        <label className="flex cursor-pointer items-center gap-2">
          <input
            type="checkbox"
            data-testid={EDITAR_PROGRAMA_TESTIDS.PROGRAM_EDIT_CLASSIFIED}
            checked={form.classified}
            onChange={(event) => set('classified', event.target.checked)}
            className="m-0 size-4 accent-accent"
          />
          {t('programas', 'classified')}
        </label>

        <div className="mt-1 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
          <Link to={`/programs/${program.code}`} data-testid={EDITAR_PROGRAMA_TESTIDS.PROGRAM_EDIT_CANCEL} className="btn btn-ghost no-underline">
            {t('programas', 'cancel')}
          </Link>
          <div className="flex gap-2">
            <button
              type="button"
              data-testid={EDITAR_PROGRAMA_TESTIDS.PROGRAM_EDIT_SAVE_CLOSE}
              disabled={!dirty || saving !== null}
              title={saving ? t('common', 'processing') : noChangesTitle}
              aria-busy={saving === 'close'}
              onClick={() => void save(true)}
              className="btn btn-secondary"
            >
              {saving === 'close' ? <Spinner /> : null}
              {t('programas', 'saveAndClose')}
            </button>
            <button
              type="submit"
              data-testid={EDITAR_PROGRAMA_TESTIDS.PROGRAM_EDIT_SAVE}
              disabled={!dirty || saving !== null}
              title={saving ? t('common', 'processing') : noChangesTitle}
              aria-busy={saving === 'save'}
              className="btn btn-primary"
            >
              {saving === 'save' ? <Spinner /> : null}
              {saveLabel}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};
