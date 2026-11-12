import {
  ApiError,
  PRIORITIES,
  REQUISITOS_DYNAMIC_TESTIDS,
  REQUISITOS_TESTIDS,
  RESPONSIVE_TESTIDS,
  FLOW_STATES,
  NC_SEVERITY_TONE,
  REQUIREMENT_STATE_TONE,
  REQUIREMENT_TAGS,
  TEST_RESULT_TONE,
  can,
  flattenIssues,
  flowStepStatus,
  isNcOpen,
  sanitizeRichText,
  transitionsFor,
  updateRequirementSchema,
  type MessageKey,
  type Priority,
  type RequirementDto,
  type RequirementState,
  type RequirementTag,
  type Role,
  type UpdateRequirementInput,
} from '@sigpro/shared';
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { formatTrace } from '../../lib/errors';
import { useSaveLabel } from '../../state/config';
import { useI18n } from '../../state/i18n';
import { RichTextEditor } from '../../ui/RichTextEditor';
import { Spinner } from '../../ui/Spinner';
import { TagPicker } from '../../ui/TagPicker';
import { ToneBadge } from '../../ui/ToneBadge';

interface RequirementDetailProps {
  readonly requirement: RequirementDto;
  readonly role: Role;
  readonly onClose: () => void;
  /** Guarda los campos cambiados; rechaza con el error de la API. */
  readonly onSave: (changes: UpdateRequirementInput) => Promise<void>;
  readonly onTransition: (to: RequirementState) => void;
  readonly onCopy: () => void;
}

type Errors = Readonly<Record<string, string>>;

const sameTags = (a: readonly string[], b: readonly string[]): boolean => a.length === b.length && a.every((tag) => b.includes(tag));

/** Panel de detalle: título, prioridad, etiquetas (chips), descripción enriquecida, transiciones de estado y casos enlazados. */
const RequirementDetail = ({ requirement, role, onClose, onSave, onTransition, onCopy, frame }: RequirementDetailProps & { readonly frame: 'panel' | 'screen' }) => {
  const { t } = useI18n();
  const saveLabel = useSaveLabel();
  const canEdit = can(role, 'requirement.edit');
  const [title, setTitle] = useState(requirement.title);
  const [priority, setPriority] = useState<Priority>(requirement.priority);
  const [tags, setTags] = useState<readonly string[]>(requirement.tags);
  const [html, setHtml] = useState(sanitizeRichText(requirement.description));
  const [errors, setErrors] = useState<Errors>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [saving, setSaving] = useState<'save' | 'close' | null>(null);
  const panelRef = useRef<HTMLElement>(null);
  const message = (key: string) => t('requisitos', key as MessageKey<'requisitos'>);

  // Foco en el panel al abrir (los atajos de teclado siguen funcionando y Esc lo cierra)
  useEffect(() => panelRef.current?.focus({ preventScroll: true }), []);

  const baselineHtml = useMemo(() => sanitizeRichText(requirement.description), [requirement.description]);
  const textChanged = title !== requirement.title || html !== baselineHtml;
  const dirty = textChanged || priority !== requirement.priority || !sameTags(tags, requirement.tags);
  const willRevert = textChanged && requirement.state !== 'draft';
  const stateLabel = t('requisitos', `st_${requirement.state}`);

  const save = async (closeAfter: boolean) => {
    const changes: UpdateRequirementInput = {
      ...(title === requirement.title ? {} : { title }),
      ...(html === baselineHtml ? {} : { description: html }),
      ...(priority === requirement.priority ? {} : { priority }),
      ...(sameTags(tags, requirement.tags) ? {} : { tags: tags as RequirementTag[] }),
    };
    const parsed = updateRequirementSchema.safeParse(changes);
    if (!parsed.success) {
      setErrors(flattenIssues(parsed.error.issues));
      return;
    }
    setSaving(closeAfter ? 'close' : 'save');
    setServerError(null);
    try {
      await onSave(parsed.data);
      setErrors({});
      if (closeAfter) onClose();
    } catch (error) {
      const fieldErrors = error instanceof ApiError && error.status === 422 ? (error.body.errors ?? {}) : null;
      if (fieldErrors) setErrors(fieldErrors);
      setServerError(fieldErrors ? message(Object.values(fieldErrors)[0] ?? 'required') : formatTrace(error) || t('common', 'genericError'));
    } finally {
      setSaving(null);
    }
  };

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    void save(false);
  };

  const noChangesTitle = !canEdit ? t('requisitos', 'roleNoEdit') : dirty ? undefined : t('programas', 'noChanges');
  const readOnlyTitle = canEdit ? undefined : t('requisitos', 'roleNoEdit');

  // El contenido es el mismo en las dos variantes; solo cambia el marco (panel junto al árbol / pantalla completa)
  const identity = (
    <div className="flex min-w-0 flex-col gap-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <span data-testid={REQUISITOS_TESTIDS.REQUIREMENT_CODE} className="font-mono text-[13px] font-medium">
              {requirement.code}
            </span>
            <button
              type="button"
              data-testid={REQUISITOS_TESTIDS.REQUIREMENT_COPY_CODE}
              aria-label={t('requisitos', 'copyCode', { code: requirement.code })}
              title={t('requisitos', 'copyCode', { code: requirement.code })}
              onClick={onCopy}
              className="btn btn-secondary !h-6 !gap-1 !px-2 !text-[11.5px]"
            >
              ⧉ {t('requisitos', 'menuCopy')}
            </button>
            <ToneBadge state={requirement.state} tone={REQUIREMENT_STATE_TONE[requirement.state]} label={stateLabel} testId={REQUISITOS_TESTIDS.REQUIREMENT_STATE_BADGE} />
          </div>
        </div>
  );

  const body = (
    <>
      {serverError ? (
        <div role="alert" data-testid={REQUISITOS_TESTIDS.REQUIREMENT_SERVER_ERROR} className="alert alert-danger text-[12.5px]">
          {serverError}
        </div>
      ) : null}

      <form noValidate onSubmit={onSubmit} aria-busy={saving !== null} className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <label htmlFor="requirement-title" className="sr-only">
            {t('requisitos', 'titleLabel')}
          </label>
          <input
            id="requirement-title"
            data-testid={REQUISITOS_TESTIDS.REQUIREMENT_TITLE}
            value={title}
            readOnly={!canEdit}
            title={readOnlyTitle}
            aria-invalid={errors.title ? true : undefined}
            aria-describedby={errors.title ? 'requirement-title-error' : undefined}
            placeholder={t('requisitos', 'titlePlaceholder')}
            onChange={(event) => {
              setTitle(event.target.value);
              setErrors((current) => ({ ...current, title: '' }));
            }}
            className={`input !h-auto !px-2 !py-1.5 !text-[18px] !font-semibold !leading-snug ${errors.title ? '!border-danger' : '!border-transparent hover:!border-border'}`}
          />
          {errors.title ? (
            <span id="requirement-title-error" role="alert" data-testid={REQUISITOS_TESTIDS.REQUIREMENT_TITLE_ERROR} className="text-[12px] text-danger">
              {message(errors.title)}
            </span>
          ) : null}
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="requirement-priority" className="label">
            {t('requisitos', 'priorityLabel')}
          </label>
          <select
            id="requirement-priority"
            data-testid={REQUISITOS_TESTIDS.REQUIREMENT_PRIORITY}
            value={priority}
            disabled={!canEdit}
            title={readOnlyTitle}
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

        <div className="flex flex-col gap-1">
          <label htmlFor="requirement-tags-input" className="label">
            {t('requisitos', 'tagsLabel')}
          </label>
          <TagPicker
            inputId="requirement-tags-input"
            selected={tags}
            options={REQUIREMENT_TAGS.map((tag) => ({ value: tag, label: t('requisitos', `tag_${tag}`) }))}
            onChange={setTags}
            placeholder={t('requisitos', 'tagsPlaceholder')}
            noneLabel={t('requisitos', 'tagsNone')}
            chipsLabel={t('requisitos', 'tagsLabel')}
            allUsedLabel={t('requisitos', 'tagsAllUsed')}
            removeLabel={(tag) => t('requisitos', 'tagRemove', { tag })}
            listLabel={t('requisitos', 'tagsLabel')}
            disabled={!canEdit}
            disabledTitle={readOnlyTitle}
            testIds={{
              group: REQUISITOS_TESTIDS.REQUIREMENT_TAGS,
              chips: REQUISITOS_TESTIDS.REQUIREMENT_TAGS_CHIPS,
              input: REQUISITOS_TESTIDS.REQUIREMENT_TAGS_INPUT,
              list: REQUISITOS_TESTIDS.REQUIREMENT_TAGS_LIST,
              chip: REQUISITOS_DYNAMIC_TESTIDS.REQUIREMENT_CHIP,
              remove: REQUISITOS_DYNAMIC_TESTIDS.REQUIREMENT_CHIP_REMOVE,
              option: REQUISITOS_DYNAMIC_TESTIDS.REQUIREMENT_TAG_OPTION,
            }}
          />
        </div>

        <div className="flex flex-col gap-1">
          <span id="requirement-description-label" className="label">
            {t('requisitos', 'descriptionLabel')}
          </span>
          <RichTextEditor
            id="requirement-description"
            labelledBy="requirement-description-label"
            testId={REQUISITOS_TESTIDS.REQUIREMENT_DESCRIPTION}
            placeholder={t('requisitos', 'descriptionPlaceholder')}
            // El editor no es controlado: se remonta al cambiar de requisito (la clave llega del padre)
            initialHtml={baselineHtml}
            readOnly={!canEdit}
            readOnlyTitle={readOnlyTitle}
            onChange={setHtml}
            toolbar={{
              label: t('requisitos', 'editorToolbar'),
              bold: t('requisitos', 'bold'),
              italic: t('requisitos', 'italic'),
              list: t('requisitos', 'bulletList'),
              testId: REQUISITOS_TESTIDS.REQUIREMENT_EDITOR_TOOLBAR,
              boldTestId: REQUISITOS_TESTIDS.REQUIREMENT_EDITOR_BOLD,
              italicTestId: REQUISITOS_TESTIDS.REQUIREMENT_EDITOR_ITALIC,
              listTestId: REQUISITOS_TESTIDS.REQUIREMENT_EDITOR_LIST,
            }}
          />
          {errors.description ? (
            <span role="alert" className="text-[12px] text-danger">
              {message(errors.description)}
            </span>
          ) : null}
        </div>

        {willRevert ? (
          <p role="note" data-testid={REQUISITOS_TESTIDS.REQUIREMENT_REVERT_NOTICE} className="alert alert-warn m-0 text-[12.5px]">
            {t('requisitos', 'revertNotice', { state: stateLabel.toLowerCase() })}
          </p>
        ) : null}

        <div className="flex flex-wrap justify-end gap-2">
          <button
            type="button"
            data-testid={REQUISITOS_TESTIDS.REQUIREMENT_SAVE_CLOSE}
            disabled={!canEdit || !dirty || saving !== null}
            title={saving ? t('common', 'processing') : noChangesTitle}
            aria-busy={saving === 'close'}
            onClick={() => void save(true)}
            className="btn btn-secondary"
          >
            {saving === 'close' ? <Spinner /> : null}
            {t('requisitos', 'saveClose')}
          </button>
          <button
            type="submit"
            data-testid={REQUISITOS_TESTIDS.REQUIREMENT_SAVE}
            disabled={!canEdit || !dirty || saving !== null}
            title={saving ? t('common', 'processing') : noChangesTitle}
            aria-busy={saving === 'save'}
            className="btn btn-primary"
          >
            {saving === 'save' ? <Spinner /> : null}
            {saveLabel}
          </button>
        </div>
      </form>

      <section aria-labelledby="requirement-transitions-title" data-testid={REQUISITOS_TESTIDS.REQUIREMENT_FLOW} className="flex flex-col gap-3 border-t border-border pt-4">
        <h3 id="requirement-transitions-title" className="section-title !text-[14px]">
          {t('requisitos', 'flowTitle')}
        </h3>
        <ol className="flow">
          {FLOW_STATES.map((step, index) => {
            const status = flowStepStatus(requirement.state, step);
            return (
              <li key={step} data-status={status} data-testid={REQUISITOS_DYNAMIC_TESTIDS.REQUIREMENT_FLOW_STEP(step)} aria-current={status === 'current' ? 'step' : undefined} className="flow-step">
                <span aria-hidden="true" className="flow-dot">
                  {status === 'done' ? '✓' : index + 1}
                </span>
                <div className="flex min-w-0 flex-col gap-2">
                  <span className="flow-name">
                    {t('requisitos', `flow_${step}`)}
                    <span className="sr-only"> ({t('requisitos', status === 'done' ? 'flowDone' : status === 'current' ? 'flowCurrent' : 'flowFuture')})</span>
                  </span>
                  {status === 'current' ? (
                    <div data-testid={REQUISITOS_TESTIDS.REQUIREMENT_TRANSITIONS} className="flex flex-wrap gap-2">
                      {transitionsFor(role, requirement.state).map((rule) => (
                        <button
                          key={rule.to}
                          type="button"
                          data-testid={REQUISITOS_DYNAMIC_TESTIDS.REQUIREMENT_TRANSITION(rule.to)}
                          disabled={!rule.allowed}
                          title={rule.allowed ? undefined : t('requisitos', `trDenied_${rule.to}`)}
                          onClick={() => onTransition(rule.to)}
                          className={`btn ${rule.to === 'draft' ? 'btn-secondary' : 'btn-primary'} !h-8`}
                        >
                          {t('requisitos', `tr_${rule.to}`)}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ol>
      </section>

      <section aria-labelledby="requirement-tests-title" data-testid={REQUISITOS_TESTIDS.REQUIREMENT_TRACE} className="flex flex-col gap-3 border-t border-border pt-4">
        <h3 id="requirement-tests-title" className="section-title !text-[14px]">
          {t('requisitos', 'traceTitle')}
        </h3>
        <div className="flex flex-col gap-1.5">
          <h4 className="m-0 text-[12px] font-medium text-fg-3">{t('requisitos', 'linkedTests')}</h4>
          {requirement.tests.length === 0 ? (
            <p className="m-0 text-[12.5px] text-fg-3">{t('requisitos', 'noTests')}</p>
          ) : (
            <ul data-testid={REQUISITOS_TESTIDS.REQUIREMENT_TESTS} className="m-0 flex list-none flex-col gap-1.5 p-0">
              {requirement.tests.map((test) => (
                <li key={test.code} className="flex items-center justify-between gap-2">
                  <Link to={`/verification/${test.code}`} data-testid={REQUISITOS_DYNAMIC_TESTIDS.REQUIREMENT_TEST_LINK(test.code)} className="mono text-[12.5px] font-medium no-underline hover:underline">
                    {test.code}
                  </Link>
                  <ToneBadge
                    state={test.lastResult ?? 'none'}
                    tone={test.lastResult ? TEST_RESULT_TONE[test.lastResult] : 'neutral'}
                    label={test.lastResult ? t('verificacion', `r_${test.lastResult}`) : t('verificacion', 'neverRun')}
                    testId={REQUISITOS_DYNAMIC_TESTIDS.REQUIREMENT_TRACE_TEST(test.code)}
                  />
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="flex flex-col gap-1.5">
          <h4 className="m-0 text-[12px] font-medium text-fg-3">{t('requisitos', 'traceNcs')}</h4>
          {requirement.ncs.length === 0 ? (
            <p className="m-0 text-[12.5px] text-fg-3">{t('requisitos', 'noNcs')}</p>
          ) : (
            <ul data-testid={REQUISITOS_TESTIDS.REQUIREMENT_TRACE_NCS} className="m-0 flex list-none flex-col gap-1.5 p-0">
              {requirement.ncs.map((nc) => (
                <li key={nc.code} className="flex items-center justify-between gap-2">
                  <Link to={`/nc/${nc.code}`} data-testid={REQUISITOS_DYNAMIC_TESTIDS.REQUIREMENT_TRACE_NC(nc.code)} className={`mono text-[12.5px] font-medium no-underline hover:underline ${isNcOpen(nc.state) ? '!text-danger' : '!text-fg-3'}`}>
                    {nc.code}
                  </Link>
                  <span className="flex items-center gap-2">
                    {isNcOpen(nc.state) ? null : <span className="text-[12px] text-fg-3">{t('requisitos', 'ncResolved')}</span>}
                    <ToneBadge state={nc.state} tone={NC_SEVERITY_TONE[nc.severity]} severity={nc.severity} label={t('nc', `sev_${nc.severity}`)} testId={REQUISITOS_DYNAMIC_TESTIDS.REQUIREMENT_TRACE_NC_BADGE(nc.code)} />
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </>
  );

  if (frame === 'screen') {
    return (
      <section
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={t('requisitos', 'detailTitle')}
        data-testid={RESPONSIVE_TESTIDS.REQUIREMENT_DETAIL}
        data-code={requirement.code}
        className="fixed inset-0 z-[35] flex flex-col overflow-y-auto bg-bg outline-none"
      >
        <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-border bg-surface px-3 py-2">
          <button
            type="button"
            data-testid={RESPONSIVE_TESTIDS.REQUIREMENT_DETAIL_CLOSE}
            aria-label={t('requisitos', 'backFromDetail')}
            onClick={onClose}
            className="btn btn-secondary !h-9 flex-none !gap-1.5 !px-3"
          >
            <span aria-hidden="true">←</span>
            {t('requisitos', 'backFromDetail')}
          </button>
          {identity}
        </header>
        <div className="flex flex-col gap-3 p-4">{body}</div>
      </section>
    );
  }

  return (
    <aside
      ref={panelRef}
      tabIndex={-1}
      aria-label={t('requisitos', 'detailTitle')}
      data-testid={REQUISITOS_TESTIDS.REQUIREMENT_DETAIL}
      data-code={requirement.code}
      className="card flex flex-col gap-3 p-4 outline-none"
    >
      <header className="flex items-start justify-between gap-2">
        {identity}
        <button
          type="button"
          data-testid={REQUISITOS_TESTIDS.REQUIREMENT_DETAIL_CLOSE}
          aria-label={t('requisitos', 'closeDetail', { code: requirement.code })}
          onClick={onClose}
          className="size-7 flex-none cursor-pointer rounded-ctl-sm border-0 bg-transparent text-[18px] leading-none text-fg-3 hover:bg-surface-2"
        >
          ×
        </button>
      </header>
      {body}
    </aside>
  );
};

/** Detalle de ESCRITORIO: panel junto al árbol (≥ 1024 px). */
export const RequirementDetailPanel = (props: RequirementDetailProps) => <RequirementDetail {...props} frame="panel" />;

/** Detalle del DISEÑO RESPONSIVE (< 1024 px): pantalla completa con «Volver». El contenido y sus ids de campo son los mismos. */
export const RequirementDetailScreen = (props: RequirementDetailProps) => <RequirementDetail {...props} frame="screen" />;
