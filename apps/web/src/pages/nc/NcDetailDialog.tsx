import {
  ApiError,
  NC_DYNAMIC_TESTIDS,
  NC_SEVERITY_TONE,
  NC_STATE_TONE,
  NC_TESTIDS,
  can,
  canNcTransition,
  flattenIssues,
  formatDate,
  ncCommentSchema,
  updateNcSchema,
  type NcCommentDto,
  type NcDetailDto,
  type NcSeverity,
  type NcState,
  type OwnerDto,
} from '@sigpro/shared';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { formatTrace } from '../../lib/errors';
import { useBreakpoint } from '../../lib/hooks';
import { useAuth } from '../../state/auth';
import { useSaveLabel } from '../../state/config';
import { useI18n } from '../../state/i18n';
import { useToast } from '../../state/toast';
import { Avatar } from '../../ui/Avatar';
import { CloseIcon } from '../../ui/icons';
import { Modal } from '../../ui/Modal';
import { OwnerCombobox } from '../../ui/OwnerCombobox';
import { RichTextEditor } from '../../ui/RichTextEditor';
import { SeverityPicker } from '../../ui/SeverityPicker';
import { Spinner } from '../../ui/Spinner';
import { CloseNcForm } from './CloseNcForm';
import { diffNcDraft, fieldError } from './nc-view';
import { useNcLabels, useNcMessage } from './useNcLabels';

type Load = { readonly status: 'loading' } | { readonly status: 'notfound' } | { readonly status: 'error'; readonly error: unknown } | { readonly status: 'ready'; readonly detail: NcDetailDto };

interface Draft {
  readonly severity: NcSeverity;
  readonly description: string;
  readonly assigneeId: string | null;
}

const toDraft = (detail: NcDetailDto): Draft => ({ severity: detail.severity, description: detail.description, assigneeId: detail.assigneeId });

interface NcDetailDialogProps {
  readonly code: string;
  readonly onClose: () => void;
  /** Avisa de que algo cambió (la página recarga el tablero). */
  readonly onChanged: () => void;
}

/**
 * Detalle de una no conformidad en un modal: severidad (web component), descripción enriquecida, asignación con
 * combobox, cambio de estado (cerrar pide el comentario de ≥ 20 caracteres) y comentarios. Se abre con `/nc/:code`.
 */
export const NcDetailDialog = ({ code, onClose, onChanged }: NcDetailDialogProps) => {
  const { t, lang } = useI18n();
  const { api, user } = useAuth();
  const toast = useToast();
  const labels = useNcLabels();
  const message = useNcMessage();
  const saveLabel = useSaveLabel();
  const mobile = useBreakpoint() === 'mobile';
  const role = user?.role ?? 'auditor';
  const canEdit = can(role, 'nc.edit');

  const [load, setLoad] = useState<Load>({ status: 'loading' });
  const [owners, setOwners] = useState<readonly OwnerDto[]>([]);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [editorVersion, setEditorVersion] = useState(0);
  const [saving, setSaving] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Readonly<Record<string, string>>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [closing, setClosing] = useState(false);
  const [moving, setMoving] = useState<NcState | null>(null);
  const [commentText, setCommentText] = useState('');
  const [commentError, setCommentError] = useState<string | null>(null);
  const [commenting, setCommenting] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    let cancelled = false;
    setLoad({ status: 'loading' });
    api.nc.get(code).then(
      (detail) => {
        if (cancelled) return;
        setLoad({ status: 'ready', detail });
        setDraft(toDraft(detail));
        setEditorVersion((current) => current + 1);
      },
      (error: unknown) => !cancelled && setLoad(error instanceof ApiError && error.status === 404 ? { status: 'notfound' } : { status: 'error', error }),
    );
    return () => {
      cancelled = true;
    };
  }, [api, code, attempt]);

  useEffect(() => {
    let cancelled = false;
    api.users.owners().then(
      (list) => !cancelled && setOwners(list),
      () => undefined,
    );
    return () => {
      cancelled = true;
    };
  }, [api]);

  const detail = load.status === 'ready' ? load.detail : null;
  const diff = detail && draft ? diffNcDraft(detail, draft) : null;
  const dirty = diff !== null;

  /** Aplica la respuesta del servidor; si no hay ediciones pendientes también reinicia el borrador. */
  const applyDetail = useCallback((updated: NcDetailDto, resetDraft: boolean) => {
    setLoad({ status: 'ready', detail: updated });
    if (resetDraft) {
      setDraft(toDraft(updated));
      setEditorVersion((current) => current + 1);
    }
  }, []);

  const failure = (error: unknown): string => formatTrace(error) || t('common', 'genericError');

  const save = async (andClose: boolean) => {
    if (!detail || !diff) return;
    const parsed = updateNcSchema.safeParse(diff);
    if (!parsed.success) {
      setFieldErrors(flattenIssues(parsed.error.issues));
      return;
    }
    setSaving(true);
    setServerError(null);
    setFieldErrors({});
    try {
      const updated = await api.nc.update(code, parsed.data);
      applyDetail(updated, true);
      toast.push('ok', t('nc', 'saved', { code }));
      onChanged();
      if (andClose) onClose();
    } catch (error) {
      const errors = error instanceof ApiError && error.status === 422 ? (error.body.errors ?? {}) : null;
      if (errors) setFieldErrors(errors);
      setServerError(errors ? message(Object.values(errors)[0] ?? 'nothingToUpdate') : failure(error));
    } finally {
      setSaving(false);
    }
  };

  const moveTo = async (to: NcState) => {
    if (to === 'closed') {
      setClosing(true);
      return;
    }
    setMoving(to);
    setServerError(null);
    try {
      const updated = await api.nc.transition(code, { to });
      applyDetail(updated, false);
      toast.push('ok', t('nc', 'moved', { code, state: labels.state(to) }));
      onChanged();
    } catch (error) {
      setServerError(error instanceof ApiError && error.status === 409 ? t('nc', 'invalidTransition', { code, from: labels.state(detail?.state ?? 'open'), to: labels.state(to) }) : failure(error));
    } finally {
      setMoving(null);
    }
  };

  const closeWith = async (comment: string) => {
    const updated = await api.nc.transition(code, { to: 'closed', comment });
    applyDetail(updated, false);
    setClosing(false);
    toast.push('ok', t('nc', 'closed', { code }));
    onChanged();
  };

  const sendComment = async () => {
    const parsed = ncCommentSchema.safeParse({ body: commentText });
    if (!parsed.success) {
      setCommentError(flattenIssues(parsed.error.issues).body ?? 'commentRequired');
      return;
    }
    setCommenting(true);
    setCommentError(null);
    try {
      const created: NcCommentDto = await api.nc.comment(code, parsed.data);
      setLoad((current) => (current.status === 'ready' ? { status: 'ready', detail: { ...current.detail, comments: [...current.detail.comments, created], commentCount: current.detail.commentCount + 1 } } : current));
      setCommentText('');
      toast.push('ok', t('nc', 'commentSent'));
      onChanged();
    } catch (error) {
      const fromServer = error instanceof ApiError && error.status === 422 ? fieldError(error.body.errors, 'body') : null;
      setCommentError(fromServer ?? failure(error));
    } finally {
      setCommenting(false);
    }
  };

  const when = (iso: string): string => new Date(iso).toLocaleString(lang === 'es' ? 'es-ES' : 'en-GB', { dateStyle: 'short', timeStyle: 'short' });
  const saveDisabled = !canEdit || !dirty || saving;
  const saveTitle = !canEdit ? t('nc', 'editDenied') : !dirty ? t('nc', 'noChanges') : saving ? t('common', 'processing') : undefined;

  return (
    <Modal
      role="dialog"
      testId={NC_TESTIDS.NC_DETAIL}
      scrimTestId={NC_TESTIDS.NC_DETAIL_SCRIM}
      labelledBy="nc-detail-heading"
      onClose={onClose}
      initialFocus={closeRef}
      className={mobile ? 'inset-0 rounded-none' : 'top-1/2 left-1/2 max-h-[calc(100vh-48px)] w-[min(760px,calc(100%-32px))] -translate-x-1/2 -translate-y-1/2 rounded-card'}
    >
      <header className="flex flex-wrap items-center gap-2.5 border-b border-border px-5 py-3">
        <h2 id="nc-detail-heading" className="section-title">
          {t('nc', 'detailTitle', { code })}
        </h2>
        {detail ? (
          <>
            <span data-testid={NC_TESTIDS.NC_STATE_BADGE} data-state={detail.state} data-tone={NC_STATE_TONE[detail.state]} className="badge badge-row">
              {labels.state(detail.state)}
            </span>
            <span data-testid={NC_TESTIDS.NC_SEVERITY_BADGE} data-severity={detail.severity} data-tone={NC_SEVERITY_TONE[detail.severity]} className="badge badge-row">
              {labels.severity(detail.severity)}
            </span>
          </>
        ) : null}
        <span className="flex-1" />
        <button
          ref={closeRef}
          type="button"
          data-testid={NC_TESTIDS.NC_DETAIL_CLOSE}
          aria-label={t('nc', 'detailClose')}
          onClick={onClose}
          className="icon-btn"
        >
          <CloseIcon />
        </button>
      </header>

      <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-5 py-4">
        {load.status === 'loading' ? (
          <div role="status" aria-busy="true" data-testid={NC_TESTIDS.NC_DETAIL_LOADING} className="flex flex-col gap-3">
            <span className="sr-only">{t('nc', 'detailLoading')}</span>
            <span className="skeleton h-5 w-48" />
            <span className="skeleton h-24 w-full !rounded-card" />
            <span className="skeleton h-8 w-64" />
          </div>
        ) : null}

        {load.status === 'notfound' ? (
          <div role="alert" data-testid={NC_TESTIDS.NC_DETAIL_NOT_FOUND} className="alert alert-warn">
            {t('nc', 'detailNotFound')}
          </div>
        ) : null}

        {load.status === 'error' ? (
          <div role="alert" data-testid={NC_TESTIDS.NC_DETAIL_ERROR} className="alert alert-danger flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="font-semibold">{t('nc', 'detailError')}</div>
              <div className="trace">{formatTrace(load.error) || t('common', 'networkError')}</div>
            </div>
            <button type="button" data-testid={NC_TESTIDS.NC_DETAIL_ERROR_RETRY} onClick={() => setAttempt((current) => current + 1)} className="btn btn-danger-outline !h-[30px] !px-3">
              {t('nc', 'retry')}
            </button>
          </div>
        ) : null}

        {detail && draft ? (
          <>
            {!canEdit ? (
              <div role="status" data-testid={NC_TESTIDS.NC_DETAIL_DENIED} className="alert alert-info text-[12.5px]">
                {t('nc', 'editDenied')}
              </div>
            ) : null}
            {serverError ? (
              <div role="alert" data-testid={NC_TESTIDS.NC_SERVER_ERROR} className="alert alert-danger text-[12.5px]">
                {serverError}
              </div>
            ) : null}

            <dl className="m-0 grid grid-cols-[auto_1fr] items-center gap-x-6 gap-y-3 text-[12.5px]">
              <dt className="text-fg-3">{t('nc', 'program')}</dt>
              <dd className="m-0">
                <Link to={`/programs/${detail.programCode}`} data-testid={NC_TESTIDS.NC_DETAIL_PROGRAM} className="font-mono font-medium">
                  {detail.programCode}
                </Link>{' '}
                <span className="text-fg-2">{detail.programName}</span>
              </dd>
              <dt className="text-fg-3">{t('nc', 'state')}</dt>
              <dd className="m-0 text-fg-2">
                {labels.state(detail.state)} · {formatDate(detail.createdAt.slice(0, 10), lang)}
              </dd>
            </dl>

            <div className="flex flex-col gap-1.5">
              <span id="nc-severity-label" className="label">
                {t('nc', 'severity')}
              </span>
              <SeverityPicker
                value={draft.severity}
                onChange={(severity) => setDraft((current) => (current ? { ...current, severity } : current))}
                label={t('nc', 'severityPickerLabel')}
                labels={labels.severities}
                testId={NC_TESTIDS.NC_SEVERITY_PICKER}
                disabled={!canEdit}
                disabledTitle={t('nc', 'editDenied')}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <span id="nc-description-label" className="label">
                {t('nc', 'description')}
              </span>
              <RichTextEditor
                key={editorVersion}
                id="nc-description"
                labelledBy="nc-description-label"
                testId={NC_TESTIDS.NC_DESCRIPTION}
                placeholder={t('nc', 'descriptionPlaceholder')}
                initialHtml={draft.description}
                readOnly={!canEdit}
                readOnlyTitle={t('nc', 'editDenied')}
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
                onChange={(description) => {
                  setDraft((current) => (current ? { ...current, description } : current));
                  setFieldErrors((current) => ({ ...current, description: '' }));
                }}
              />
              {fieldErrors.description ? (
                <span role="alert" data-testid={NC_TESTIDS.NC_DESCRIPTION_ERROR} className="text-[12px] text-danger">
                  {message(fieldErrors.description)}
                </span>
              ) : null}
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="nc-assignee" className="label">
                {t('nc', 'assignee')}
              </label>
              {canEdit ? (
                <OwnerCombobox
                  inputId="nc-assignee"
                  testIdPrefix="nc-assignee"
                  inputTestId={NC_TESTIDS.NC_ASSIGNEE}
                  listTestId={NC_TESTIDS.NC_ASSIGNEE_LIST}
                  clearTestId={NC_TESTIDS.NC_ASSIGNEE_CLEAR}
                  owners={owners}
                  value={draft.assigneeId}
                  onChange={(assigneeId) => setDraft((current) => (current ? { ...current, assigneeId } : current))}
                  placeholder={t('nc', 'assigneePlaceholder')}
                  listLabel={t('nc', 'assigneeList')}
                  clearLabel={t('nc', 'assigneeClear')}
                  noMatch={t('nc', 'assigneeNoMatch')}
                  inputClassName="!h-8 !bg-surface"
                />
              ) : (
                <input id="nc-assignee" readOnly value={detail.assigneeName ?? t('nc', 'unassigned')} title={t('nc', 'editDenied')} data-testid={NC_TESTIDS.NC_ASSIGNEE} className="input !h-8 !bg-surface-2" />
              )}
            </div>

            <section aria-labelledby="nc-transitions-title" data-testid={NC_TESTIDS.NC_TRANSITIONS} className="flex flex-col gap-2">
              <h3 id="nc-transitions-title" className="m-0 text-[12.5px] font-semibold">
                {t('nc', 'transitions')}
              </h3>
              {closing ? (
                <CloseNcForm onSubmit={closeWith} onCancel={() => setClosing(false)} />
              ) : detail.transitions.length === 0 ? (
                <p className="m-0 text-[12.5px] text-fg-3">{t('nc', 'transitionNone')}</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {detail.transitions.map((state) => {
                    const allowed = canNcTransition(role, state);
                    return (
                      <button
                        key={state}
                        type="button"
                        data-testid={NC_DYNAMIC_TESTIDS.NC_TRANSITION(state)}
                        disabled={!allowed || moving !== null}
                        aria-busy={moving === state}
                        title={allowed ? undefined : t('nc', state === 'closed' ? 'closeDenied' : 'menuMoveDenied')}
                        onClick={() => void moveTo(state)}
                        className="btn btn-secondary !h-8"
                      >
                        {moving === state ? <Spinner /> : null}
                        {t('nc', 'transitionTo', { state: labels.state(state) })}
                      </button>
                    );
                  })}
                </div>
              )}
            </section>

            <section aria-labelledby="nc-comments-title" className="flex flex-col gap-2.5">
              <h3 id="nc-comments-title" className="m-0 text-[12.5px] font-semibold">
                {t('nc', 'commentsTitle')} ({detail.comments.length})
              </h3>
              {detail.comments.length === 0 ? (
                <p data-testid={NC_TESTIDS.NC_COMMENTS_EMPTY} className="m-0 text-[12.5px] text-fg-3">
                  {t('nc', 'commentsEmpty')}
                </p>
              ) : (
                <ul data-testid={NC_TESTIDS.NC_COMMENTS} className="m-0 flex list-none flex-col gap-2 p-0">
                  {detail.comments.map((comment) => (
                    <li key={comment.id} data-testid={NC_DYNAMIC_TESTIDS.NC_COMMENT(comment.id)} data-kind={comment.kind} className="flex gap-2.5 rounded-card border border-border bg-surface-2 p-2.5">
                      <Avatar name={comment.authorName ?? t('auditoria', 'system')} size={24} fontPx={9.5} />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2 text-[12px]">
                          <span className="font-medium">{comment.authorName ?? t('auditoria', 'system')}</span>
                          <time dateTime={comment.createdAt} className="font-mono text-[11px] text-fg-3">
                            {when(comment.createdAt)}
                          </time>
                          {comment.kind !== 'comment' ? (
                            <span className="rounded-full bg-neutral-soft px-1.5 font-mono text-[10px] text-neutral">{t('nc', comment.kind === 'quick' ? 'commentKindQuick' : 'commentKindClosure')}</span>
                          ) : null}
                        </div>
                        <p className="m-0 mt-0.5 text-[12.5px] break-words whitespace-pre-wrap">{comment.body}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              <div className="flex flex-col gap-1">
                <label htmlFor="nc-comment-input" className="label">
                  {t('nc', 'commentLabel')}
                </label>
                <textarea
                  id="nc-comment-input"
                  data-testid={NC_TESTIDS.NC_COMMENT_INPUT}
                  rows={2}
                  aria-invalid={commentError ? true : undefined}
                  aria-describedby={commentError ? 'nc-comment-error' : undefined}
                  placeholder={t('nc', 'commentPlaceholder')}
                  value={commentText}
                  onChange={(event) => {
                    setCommentText(event.target.value);
                    setCommentError(null);
                  }}
                  className={`input !h-auto resize-y px-2.5 py-2 leading-[1.5] ${commentError ? '!border-danger' : ''}`}
                />
                {commentError ? (
                  <span id="nc-comment-error" role="alert" data-testid={NC_TESTIDS.NC_COMMENT_ERROR} className="text-[12px] text-danger">
                    {message(commentError)}
                  </span>
                ) : null}
                <button
                  type="button"
                  data-testid={NC_TESTIDS.NC_COMMENT_SUBMIT}
                  disabled={commenting}
                  aria-busy={commenting}
                  title={commenting ? t('common', 'processing') : undefined}
                  onClick={() => void sendComment()}
                  className="btn btn-secondary mt-1 self-end !h-8"
                >
                  {commenting ? <Spinner /> : null}
                  {t('nc', 'commentSubmit')}
                </button>
              </div>
            </section>
          </>
        ) : null}
      </div>

      {detail ? (
        <footer className="flex justify-end gap-2 border-t border-border px-5 py-3">
          <button type="button" data-testid={NC_TESTIDS.NC_SAVE} disabled={saveDisabled} aria-busy={saving} title={saveTitle} onClick={() => void save(false)} className="btn btn-secondary">
            {saving ? <Spinner /> : null}
            {saveLabel}
          </button>
          <button type="button" data-testid={NC_TESTIDS.NC_SAVE_CLOSE} disabled={saveDisabled} title={saveTitle} onClick={() => void save(true)} className="btn btn-primary">
            {t('nc', 'saveAndClose')}
          </button>
        </footer>
      ) : null}
    </Modal>
  );
};
