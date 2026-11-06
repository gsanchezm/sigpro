import {
  ApiError,
  PRIORITIES,
  PROGRAMAS_DYNAMIC_TESTIDS,
  PROGRAMAS_TESTIDS,
  DETALLE_TESTIDS,
  createProgramSchema,
  flattenIssues,
  formatDate,
  formatMoney,
  programStep1Schema,
  programStep2Schema,
  type CreateProgramInput,
  type MessageKey,
  type OwnerDto,
  type Priority,
} from '@sigpro/shared';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useBreakpoint } from '../../lib/hooks';
import { useI18n } from '../../state/i18n';
import { Modal } from '../../ui/Modal';
import { OwnerCombobox } from '../../ui/OwnerCombobox';
import { Spinner } from '../../ui/Spinner';

interface WizardForm {
  readonly name: string;
  readonly description: string;
  readonly ownerId: string;
  readonly status: 'draft' | 'active';
  readonly startDate: string;
  readonly endDate: string;
  readonly budget: string;
  readonly priority: Priority;
  readonly classified: boolean;
  readonly notify: boolean;
}

const BLANK: WizardForm = { name: '', description: '', ownerId: '', status: 'draft', startDate: '', endDate: '', budget: '', priority: 'medium', classified: false, notify: true };
type Errors = Readonly<Record<string, string>>;
type Step = 1 | 2 | 3;

interface WizardProps {
  readonly owners: readonly OwnerDto[];
  readonly nextCode: string;
  readonly onClose: () => void;
  /** Crea el programa; rechaza con ApiError (422 → errores por campo). */
  readonly onSubmit: (input: CreateProgramInput) => Promise<void>;
}

const validate = (step: Step, form: WizardForm): Errors => {
  if (step === 1) {
    const result = programStep1Schema.safeParse(form);
    return result.success ? {} : flattenIssues(result.error.issues);
  }
  if (step === 2) {
    const result = programStep2Schema.safeParse({ ...form, budget: Number(form.budget) });
    return result.success ? {} : flattenIssues(result.error.issues);
  }
  return {};
};

const fieldClass = (invalid: boolean) => `input !h-8 !bg-surface ${invalid ? '!border-danger' : ''}`;
const labelClass = 'label';

/** Asistente de 3 pasos para crear un programa: datos · planificación · resumen. Modal centrado (hoja inferior en móvil). */
export const ProgramWizard = ({ owners, nextCode, onClose, onSubmit }: WizardProps) => {
  const { t, lang } = useI18n();
  const mobile = useBreakpoint() === 'mobile';
  const [step, setStep] = useState<Step>(1);
  const [form, setForm] = useState<WizardForm>(BLANK);
  const [errors, setErrors] = useState<Errors>({});
  const [serverError, setServerError] = useState<{ status: string; text: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);
  const startRef = useRef<HTMLInputElement>(null);
  const message = (key: string) => t('programas', key as MessageKey<'programas'>);

  const set = <K extends keyof WizardForm>(key: K, value: WizardForm[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: '' }));
  };
  const errorOf = (field: string): string | undefined => (errors[field] ? message(errors[field]) : undefined);

  // Cada paso deja el foco en su primer campo
  useEffect(() => {
    if (step === 1) nameRef.current?.focus();
    if (step === 2) startRef.current?.focus();
  }, [step]);

  const ownerName = owners.find((owner) => owner.id === form.ownerId)?.name ?? '';

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const found = validate(step, form);
    if (Object.keys(found).length > 0) {
      setErrors(found);
      return;
    }
    if (step < 3) {
      setErrors({});
      setStep((step + 1) as Step);
      return;
    }
    const parsed = createProgramSchema.safeParse({ ...form, budget: Number(form.budget) });
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
      if (fieldErrors) {
        setErrors(fieldErrors);
        setServerError({ status: '422', text: message(Object.values(fieldErrors)[0] ?? 'dupName') });
        setStep(1);
      } else {
        setServerError({ status: error instanceof ApiError ? String(error.status || '—') : '—', text: t('common', 'genericError') });
      }
    } finally {
      setSubmitting(false);
    }
  };

  const stepNames = [t('programas', 'step1'), t('programas', 'step2'), t('programas', 'step3')];
  const priorityLabels: Readonly<Record<Priority, string>> = { low: t('programas', 'low'), medium: t('programas', 'medium'), high: t('programas', 'high') };

  return (
    <Modal
      role="dialog"
      testId={PROGRAMAS_TESTIDS.PROGRAMS_WIZARD}
      scrimTestId={PROGRAMAS_TESTIDS.PROGRAMS_WIZARD_SCRIM}
      labelledBy="wizard-title"
      onClose={onClose}
      initialFocus={nameRef}
      className={mobile ? 'inset-x-0 bottom-0 top-6 rounded-t-[10px]' : 'top-1/2 left-1/2 max-h-[calc(100%-48px)] w-[min(560px,calc(100%-32px))] -translate-x-1/2 -translate-y-1/2 rounded-[6px]'}
    >
      <div className="flex items-start justify-between px-5 pt-4">
        <div>
          <h2 id="wizard-title" className="m-0 text-[16px] font-semibold">
            {t('programas', 'newProgram')}
          </h2>
          <div className="font-mono text-[12px] text-fg-3">{`${t('programas', 'step')} ${step} ${t('programas', 'of')} 3`}</div>
        </div>
        <button
          type="button"
          data-testid={PROGRAMAS_TESTIDS.PROGRAMS_WIZARD_CLOSE}
          aria-label={t('programas', 'close')}
          onClick={onClose}
          className="size-7 cursor-pointer rounded-[4px] border-0 bg-transparent text-[18px] leading-none text-fg-3 hover:bg-surface-2"
        >
          ×
        </button>
      </div>

      <ol aria-label={t('programas', 'steps')} className="m-0 flex list-none items-center gap-2 px-5 py-3.5">
        {stepNames.map((name, index) => {
          const n = (index + 1) as Step;
          const current = n === step;
          const done = n < step;
          return (
            <li key={n} data-testid={PROGRAMAS_DYNAMIC_TESTIDS.PROGRAMS_WIZARD_STEP(n)} aria-current={current ? 'step' : undefined} className="flex min-w-0 flex-1 items-center gap-2">
              <span
                aria-hidden="true"
                className="grid size-[22px] flex-none place-items-center rounded-full border text-[11px] font-semibold"
                style={{
                  background: current || done ? 'var(--accent)' : 'var(--surface-2)',
                  color: current || done ? '#fff' : 'var(--text-3)',
                  borderColor: current || done ? 'var(--accent)' : 'var(--border-strong)',
                }}
              >
                {done ? '✓' : n}
              </span>
              <span className={`text-[12.5px] whitespace-nowrap ${current ? 'font-semibold text-fg' : 'text-fg-3'}`}>{name}</span>
              {n < 3 ? <span aria-hidden="true" className="h-px flex-1 bg-border" /> : null}
            </li>
          );
        })}
      </ol>

      {serverError ? (
        <div role="alert" data-testid={PROGRAMAS_TESTIDS.PROGRAMS_WIZARD_SERVER_ERROR} className="alert alert-danger mx-5 text-[12.5px]">
          <strong className="font-mono">{serverError.status}</strong> · {serverError.text}
        </div>
      ) : null}

      <form data-testid={PROGRAMAS_TESTIDS.PROGRAMS_WIZARD_FORM} noValidate onSubmit={(event) => void submit(event)} className="flex flex-1 flex-col gap-3.5 overflow-auto px-5 pt-3.5 pb-5">
        {step === 1 ? (
          <>
            <div className="flex flex-col gap-1">
              <label htmlFor="wizard-code" className={labelClass}>
                {t('programas', 'code')}
              </label>
              <input
                id="wizard-code"
                data-testid={PROGRAMAS_TESTIDS.PROGRAMS_WIZARD_CODE}
                value={nextCode}
                readOnly
                className="input !h-8 !border-border !bg-surface-2 !font-mono !text-fg-2"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="wizard-name" className={labelClass}>
                {t('programas', 'name')} <span aria-hidden="true" className="text-danger">*</span>
              </label>
              <input
                id="wizard-name"
                ref={nameRef}
                data-testid={PROGRAMAS_TESTIDS.PROGRAMS_WIZARD_NAME}
                required
                aria-required="true"
                aria-invalid={errors.name ? true : undefined}
                aria-describedby={errors.name ? 'wizard-name-error' : undefined}
                value={form.name}
                onChange={(event) => set('name', event.target.value)}
                placeholder={t('programas', 'namePlaceholder')}
                className={fieldClass(Boolean(errors.name))}
              />
              {errors.name ? (
                <span id="wizard-name-error" role="alert" data-testid={PROGRAMAS_TESTIDS.PROGRAMS_WIZARD_NAME_ERROR} className="text-[12px] text-danger">
                  {errorOf('name')}
                </span>
              ) : null}
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="wizard-description" className={labelClass}>
                {t('programas', 'description')}
              </label>
              <textarea
                id="wizard-description"
                data-testid={PROGRAMAS_TESTIDS.PROGRAMS_WIZARD_DESCRIPTION}
                rows={3}
                value={form.description}
                onChange={(event) => set('description', event.target.value)}
                className="input !h-auto !bg-surface px-2.5 py-2"
                style={{ resize: 'vertical' }}
              />
            </div>
            <div className="grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-3">
              <div className="relative flex flex-col gap-1">
                <label htmlFor="wizard-owner" className={labelClass}>
                  {t('programas', 'owner')} <span aria-hidden="true" className="text-danger">*</span>
                </label>
                <OwnerCombobox
                  inputId="wizard-owner"
                  testIdPrefix="programs-wizard-owner"
                  inputTestId={PROGRAMAS_TESTIDS.PROGRAMS_WIZARD_OWNER}
                  listTestId={PROGRAMAS_TESTIDS.PROGRAMS_WIZARD_OWNER_LIST}
                  owners={owners}
                  value={form.ownerId || null}
                  onChange={(ownerId) => set('ownerId', ownerId ?? '')}
                  placeholder={t('programas', 'searchPerson')}
                  listLabel={t('programas', 'owner')}
                  noMatch={t('programas', 'noOwnerMatch')}
                  invalid={Boolean(errors.ownerId)}
                  describedBy={errors.ownerId ? 'wizard-owner-error' : undefined}
                  inputClassName={`!h-8 !bg-surface ${errors.ownerId ? '!border-danger' : ''}`}
                />
                {errors.ownerId ? (
                  <span id="wizard-owner-error" role="alert" data-testid={PROGRAMAS_TESTIDS.PROGRAMS_WIZARD_OWNER_ERROR} className="text-[12px] text-danger">
                    {errorOf('ownerId')}
                  </span>
                ) : null}
              </div>
              <div className="flex flex-col gap-1">
                <label htmlFor="wizard-status" className={labelClass}>
                  {t('programas', 'initialStatus')}
                </label>
                <select
                  id="wizard-status"
                  data-testid={PROGRAMAS_TESTIDS.PROGRAMS_WIZARD_STATUS}
                  value={form.status}
                  onChange={(event) => set('status', event.target.value as WizardForm['status'])}
                  className="input !h-8 !bg-surface"
                >
                  <option value="draft">{t('programas', 'st_draft')}</option>
                  <option value="active">{t('programas', 'st_active')}</option>
                </select>
              </div>
            </div>
          </>
        ) : null}

        {step === 2 ? (
          <>
            <div className="grid grid-cols-[repeat(auto-fit,minmax(160px,1fr))] gap-3">
              <div className="flex flex-col gap-1">
                <label htmlFor="wizard-start" className={labelClass}>
                  {t('programas', 'startDate')} <span aria-hidden="true" className="text-danger">*</span>
                </label>
                <input
                  id="wizard-start"
                  ref={startRef}
                  type="date"
                  data-testid={PROGRAMAS_TESTIDS.PROGRAMS_WIZARD_START}
                  aria-invalid={errors.startDate ? true : undefined}
                  aria-describedby={errors.startDate ? 'wizard-start-error' : undefined}
                  value={form.startDate}
                  onChange={(event) => set('startDate', event.target.value)}
                  className={`${fieldClass(Boolean(errors.startDate))} !font-mono !text-[12px]`}
                />
                {errors.startDate ? (
                  <span id="wizard-start-error" role="alert" data-testid={PROGRAMAS_TESTIDS.PROGRAMS_WIZARD_START_ERROR} className="text-[12px] text-danger">
                    {errorOf('startDate')}
                  </span>
                ) : null}
              </div>
              <div className="flex flex-col gap-1">
                <label htmlFor="wizard-end" className={labelClass}>
                  {t('programas', 'endDate')} <span aria-hidden="true" className="text-danger">*</span>
                </label>
                <input
                  id="wizard-end"
                  type="date"
                  data-testid={PROGRAMAS_TESTIDS.PROGRAMS_WIZARD_END}
                  aria-invalid={errors.endDate ? true : undefined}
                  aria-describedby={errors.endDate ? 'wizard-end-error' : undefined}
                  value={form.endDate}
                  onChange={(event) => set('endDate', event.target.value)}
                  className={`${fieldClass(Boolean(errors.endDate))} !font-mono !text-[12px]`}
                />
                {errors.endDate ? (
                  <span id="wizard-end-error" role="alert" data-testid={PROGRAMAS_TESTIDS.PROGRAMS_WIZARD_END_ERROR} className="text-[12px] text-danger">
                    {errorOf('endDate')}
                  </span>
                ) : null}
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="wizard-budget" className={labelClass}>
                {t('programas', 'budget')} (€) <span aria-hidden="true" className="text-danger">*</span>
              </label>
              <input
                id="wizard-budget"
                type="number"
                min={0}
                step={1000}
                inputMode="numeric"
                data-testid={PROGRAMAS_TESTIDS.PROGRAMS_WIZARD_BUDGET}
                aria-invalid={errors.budget ? true : undefined}
                aria-describedby={errors.budget ? 'wizard-budget-error' : undefined}
                value={form.budget}
                onChange={(event) => set('budget', event.target.value)}
                placeholder="0"
                className={`${fieldClass(Boolean(errors.budget))} !font-mono !text-[12px]`}
              />
              {errors.budget ? (
                <span id="wizard-budget-error" role="alert" data-testid={PROGRAMAS_TESTIDS.PROGRAMS_WIZARD_BUDGET_ERROR} className="text-[12px] text-danger">
                  {errorOf('budget')}
                </span>
              ) : null}
            </div>
            <fieldset className="m-0 flex flex-col gap-1.5 border-0 p-0">
              <legend className="mb-1 p-0 text-[12px] font-medium text-fg-2">{t('programas', 'priority')}</legend>
              <div className="flex flex-wrap gap-4">
                {PRIORITIES.map((priority) => (
                  <label key={priority} className="flex min-h-6 cursor-pointer items-center gap-1.5">
                    <input
                      type="radio"
                      name="wizard-priority"
                      value={priority}
                      data-testid={{ low: PROGRAMAS_TESTIDS.PROGRAMS_WIZARD_PRIORITY_LOW, medium: PROGRAMAS_TESTIDS.PROGRAMS_WIZARD_PRIORITY_MEDIUM, high: PROGRAMAS_TESTIDS.PROGRAMS_WIZARD_PRIORITY_HIGH }[priority]}
                      checked={form.priority === priority}
                      onChange={() => set('priority', priority)}
                      className="m-0 accent-accent"
                    />
                    {priorityLabels[priority]}
                  </label>
                ))}
              </div>
            </fieldset>
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                data-testid={PROGRAMAS_TESTIDS.PROGRAMS_WIZARD_CLASSIFIED}
                checked={form.classified}
                onChange={(event) => set('classified', event.target.checked)}
                className="m-0 size-4 accent-accent"
              />
              {t('programas', 'classified')}
            </label>
          </>
        ) : null}

        {step === 3 ? (
          <>
            <dl
              data-testid={PROGRAMAS_TESTIDS.PROGRAMS_WIZARD_SUMMARY}
              className="m-0 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 rounded-[6px] border border-border bg-surface-2 p-3 text-[12.5px]"
            >
              <dt className="text-fg-3">{t('programas', 'code')}</dt>
              <dd className="m-0 font-mono font-medium">{nextCode}</dd>
              <dt className="text-fg-3">{t('programas', 'name')}</dt>
              <dd className="m-0">{form.name}</dd>
              <dt className="text-fg-3">{t('programas', 'owner')}</dt>
              <dd className="m-0">{ownerName}</dd>
              <dt className="text-fg-3">{t('programas', 'dates')}</dt>
              <dd className="m-0 font-mono">{`${formatDate(form.startDate, lang)} → ${formatDate(form.endDate, lang)}`}</dd>
              <dt className="text-fg-3">{t('programas', 'budget')}</dt>
              <dd className="m-0 font-mono">{form.budget ? formatMoney(Number(form.budget), lang) : '—'}</dd>
              <dt className="text-fg-3">{t('programas', 'priority')}</dt>
              <dd className="m-0">{priorityLabels[form.priority]}</dd>
              <dt className="text-fg-3">{t('programas', 'classified')}</dt>
              <dd className="m-0">{form.classified ? t('programas', 'yes') : t('programas', 'no')}</dd>
            </dl>
            <div className="flex items-center justify-between gap-3">
              <span id="wizard-notify-label">{t('programas', 'notifyTeam')}</span>
              <button
                type="button"
                role="switch"
                aria-checked={form.notify}
                aria-labelledby="wizard-notify-label"
                data-testid={PROGRAMAS_TESTIDS.PROGRAMS_WIZARD_NOTIFY}
                onClick={() => set('notify', !form.notify)}
                className="flex h-5 w-9 flex-none cursor-pointer rounded-full border-0 p-0.5"
                style={{ background: form.notify ? 'var(--accent)' : 'var(--border-strong)' }}
              >
                <span className="block size-4 rounded-full bg-white transition-transform duration-150" style={{ transform: form.notify ? 'translateX(16px)' : 'none' }} />
              </button>
            </div>
            <p className="m-0 text-[12px] text-fg-3">{t('programas', 'serverHint')}</p>
          </>
        ) : null}

        <div className="mt-auto flex justify-between gap-2 border-t border-border pt-2">
          <button
            type="button"
            data-testid={PROGRAMAS_TESTIDS.PROGRAMS_WIZARD_BACK}
            onClick={() => {
              setStep((Math.max(1, step - 1)) as Step);
              setErrors({});
              setServerError(null);
            }}
            disabled={step === 1}
            title={step === 1 ? t('common', 'wizardFirstStep') : undefined}
            className="btn btn-secondary"
          >
            {t('programas', 'back')}
          </button>
          <div className="flex gap-2">
            <button type="button" data-testid={PROGRAMAS_TESTIDS.PROGRAMS_WIZARD_CANCEL} onClick={onClose} className="btn btn-ghost">
              {t('programas', 'cancel')}
            </button>
            <button
              type="submit"
              data-testid={step === 3 ? DETALLE_TESTIDS.PROGRAMS_WIZARD_SUBMIT : DETALLE_TESTIDS.PROGRAMS_WIZARD_NEXT}
              disabled={submitting}
              aria-busy={submitting}
              title={submitting ? t('common', 'processing') : undefined}
              className="btn btn-primary"
            >
              {submitting ? <Spinner /> : null}
              {step === 3 ? t('programas', 'create') : t('programas', 'next')}
            </button>
          </div>
        </div>
      </form>
    </Modal>
  );
};
