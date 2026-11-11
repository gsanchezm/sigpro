import {
  HITOS_DYNAMIC_TESTIDS,
  HITOS_TESTIDS,
  PROGRAMAS_TESTIDS,
  can,
  flattenIssues,
  formatDate,
  updateMilestoneSchema,
  type MessageKey,
  type MilestoneDto,
  type UpdateMilestoneInput,
} from '@sigpro/shared';
import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { formatTrace } from '../../lib/errors';
import { useAuth } from '../../state/auth';
import { useI18n } from '../../state/i18n';
import { useToast } from '../../state/toast';
import { RowMenuButton, type MenuItemSpec } from '../../ui/ActionMenu';
import { ConfirmDialog } from '../../ui/ConfirmDialog';
import { RangeSlider } from '../../ui/RangeSlider';
import { ToneBadge } from '../../ui/ToneBadge';
import { NewMilestoneDialog } from './MilestonesPanelNewDialog';
import { MILESTONE_STATUS_TONE, milestoneView, sortMilestones } from './milestones-view';

type LoadState = { readonly status: 'loading' } | { readonly status: 'error'; readonly error: unknown } | { readonly status: 'ready'; readonly items: readonly MilestoneDto[] };
type Field = 'name' | 'dueDate';

interface EditState {
  readonly id: string;
  readonly field: Field;
  readonly draft: string;
  /** Clave i18n del motivo por el que el valor no es válido (el campo sigue abierto). */
  readonly error: string | null;
}

const SKELETON_ROWS = 4;

interface MilestonesPanelProps {
  readonly programCode: string;
  /** Se invoca tras cada cambio guardado: el detalle del programa vuelve a pedir su avance (hitos cumplidos / total). */
  readonly onChanged: () => void;
}

/**
 * Hitos del programa: tabla con edición inline de celdas (doble clic o F2; Intro guarda, Esc o salir cancela) y un slider
 * de avance por fila. Con el 100 % el hito queda cumplido y el avance del programa se recalcula.
 */
export const MilestonesPanel = ({ programCode, onChanged }: MilestonesPanelProps) => {
  const { t, lang } = useI18n();
  const { api, user } = useAuth();
  const toast = useToast();
  const canEdit = user ? can(user.role, 'milestone.edit') : false;
  const canDelete = user ? can(user.role, 'milestone.delete') : false;
  const [state, setState] = useState<LoadState>({ status: 'loading' });
  const [edit, setEdit] = useState<EditState | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<MilestoneDto | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  const load = useCallback(() => {
    setState({ status: 'loading' });
    api.milestones.list(programCode).then(
      (items) => setState({ status: 'ready', items }),
      (error: unknown) => setState({ status: 'error', error }),
    );
  }, [api, programCode]);

  useEffect(load, [load]);

  const items = state.status === 'ready' ? state.items : [];
  const doneCount = items.filter((item) => item.done).length;

  const put = (milestone: MilestoneDto) =>
    setState((current) => (current.status === 'ready' ? { status: 'ready', items: sortMilestones(current.items.map((item) => (item.id === milestone.id ? milestone : item))) } : current));

  /**
   * Guarda un cambio; devuelve `true` si la API lo aceptó. Al fallar se avisa con un toast y se restaura el valor anterior.
   * `isLatest` evita que la respuesta de una petición vieja pise el valor optimista de otra posterior (flechas pulsadas deprisa).
   */
  const save = async (previous: MilestoneDto, patch: UpdateMilestoneInput, detail: string, isLatest: () => boolean = () => true): Promise<boolean> => {
    try {
      const saved = await api.milestones.update(previous.id, patch);
      if (isLatest()) {
        put(saved);
        toast.push('ok', t('hitos', 'updated'), t('hitos', 'updatedBody', { name: saved.name, detail }));
        onChanged();
      }
      return true;
    } catch (failure) {
      if (isLatest()) put(previous);
      toast.push('danger', t('hitos', 'saveErrorTitle'), formatTrace(failure) || t('common', 'networkError'));
      return false;
    }
  };

  const startEdit = (milestone: MilestoneDto, field: Field) => {
    if (!canEdit) return;
    setEdit({ id: milestone.id, field, draft: field === 'name' ? milestone.name : milestone.dueDate, error: null });
  };

  const commitEdit = async () => {
    if (!edit) return;
    const current = items.find((item) => item.id === edit.id);
    if (!current) return setEdit(null);
    const value = edit.draft.trim();
    if (value === (edit.field === 'name' ? current.name : current.dueDate)) return setEdit(null);
    const patch: UpdateMilestoneInput = edit.field === 'name' ? { name: value } : { dueDate: value };
    const parsed = updateMilestoneSchema.safeParse(patch);
    if (!parsed.success) {
      setEdit({ ...edit, error: Object.values(flattenIssues(parsed.error.issues))[0] ?? 'nothingToUpdate' });
      return;
    }
    setEdit(null);
    await save(current, parsed.data, edit.field === 'name' ? t('hitos', 'detailName') : t('hitos', 'detailDate', { value: formatDate(value, lang) }));
  };

  const progressSeq = useRef(new Map<string, number>());
  const commitProgress = async (milestone: MilestoneDto, progress: number) => {
    if (progress === milestone.progress) return;
    const seq = (progressSeq.current.get(milestone.id) ?? 0) + 1;
    progressSeq.current.set(milestone.id, seq);
    put({ ...milestone, progress });
    await save(milestone, { progress }, t('hitos', 'detailProgress', { value: progress }), () => progressSeq.current.get(milestone.id) === seq);
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    setDeleteBusy(true);
    try {
      await api.milestones.remove(deleting.id);
      setState((current) => (current.status === 'ready' ? { status: 'ready', items: current.items.filter((item) => item.id !== deleting.id) } : current));
      toast.push('ok', t('hitos', 'deleted'), deleting.name);
      setDeleting(null);
      onChanged();
    } catch (failure) {
      toast.push('danger', t('hitos', 'saveErrorTitle'), formatTrace(failure) || t('common', 'networkError'));
      setDeleting(null);
    } finally {
      setDeleteBusy(false);
    }
  };

  const loading = state.status === 'loading';
  const columns = ['colName', 'colDate', 'colProgress', 'colStatus'] as const;

  return (
    <section data-testid={HITOS_TESTIDS.MILESTONES_PANEL} aria-labelledby="milestones-title" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-col gap-0.5">
          <h2 id="milestones-title" className="section-title">
            {t('hitos', 'title')}
          </h2>
          <p data-testid={HITOS_TESTIDS.MILESTONES_COUNT} aria-live="polite" className="m-0 font-mono text-[12px] text-fg-2">
            {loading ? '…' : t('hitos', 'count', { done: doneCount, total: items.length })}
          </p>
        </div>
        <button
          type="button"
          data-testid={HITOS_TESTIDS.MILESTONES_NEW}
          disabled={!canEdit}
          title={canEdit ? undefined : t('hitos', 'newDenied')}
          onClick={() => setCreating(true)}
          className="btn btn-primary !h-8 !px-3"
        >
          {t('hitos', 'newButton')}
        </button>
      </div>
      <p className="m-0 text-[12px] text-fg-3">{canEdit ? t('hitos', 'editHint') : t('hitos', 'editDenied')}</p>

      {state.status === 'error' ? (
        <div role="alert" data-testid={HITOS_TESTIDS.MILESTONES_ERROR} className="alert alert-danger flex flex-wrap items-center justify-between gap-3 !px-3.5 !py-3">
          <div>
            <div className="font-semibold">{t('hitos', 'errorTitle')}</div>
            <div className="trace !text-[12.5px]">{formatTrace(state.error) || t('common', 'networkError')}</div>
          </div>
          <button type="button" data-testid={HITOS_TESTIDS.MILESTONES_ERROR_RETRY} onClick={load} className="btn btn-danger-outline !h-[30px] !px-3">
            {t('hitos', 'retry')}
          </button>
        </div>
      ) : (
        <div className="overflow-hidden rounded-card border border-border">
          <div className="overflow-x-auto">
            <table data-testid={HITOS_TESTIDS.MILESTONES_TABLE} aria-busy={loading} aria-label={t('hitos', 'table', { code: programCode })} className="data-table w-full min-w-[640px] border-collapse text-[12.5px]">
              <thead>
                <tr className="border-b border-border">
                  {columns.map((key) => (
                    <th key={key} scope="col" className="h-9 px-3 text-left text-[11.5px] font-medium text-fg-2">
                      {t('hitos', key)}
                    </th>
                  ))}
                  <th scope="col" className="w-12 px-2 text-left">
                    <span className="sr-only">{t('hitos', 'colActions')}</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {loading
                  ? Array.from({ length: SKELETON_ROWS }, (_, index) => (
                      <tr key={index} data-testid={PROGRAMAS_TESTIDS.SKELETON_ROW} className="border-b border-border">
                        {[0, 1, 2, 3, 4].map((cell) => (
                          <td key={cell} className="px-3 py-3">
                            <span className="skeleton block h-4 w-3/4" />
                          </td>
                        ))}
                      </tr>
                    ))
                  : items.map((milestone) => (
                      <MilestoneRow
                        key={milestone.id}
                        milestone={milestone}
                        edit={edit?.id === milestone.id ? edit : null}
                        canEdit={canEdit}
                        canDelete={canDelete}
                        onStartEdit={(field) => startEdit(milestone, field)}
                        onDraft={(draft) => setEdit((current) => (current ? { ...current, draft, error: null } : current))}
                        onCommitEdit={() => void commitEdit()}
                        onCancelEdit={() => setEdit(null)}
                        onProgress={(value) => void commitProgress(milestone, value)}
                        onDelete={() => setDeleting(milestone)}
                      />
                    ))}
              </tbody>
            </table>
          </div>
          {state.status === 'ready' && items.length === 0 ? (
            <p data-testid={HITOS_TESTIDS.MILESTONES_EMPTY} className="m-0 px-4 py-10 text-center text-[12.5px] text-fg-2">
              {t('hitos', 'empty')}
            </p>
          ) : null}
        </div>
      )}

      {creating ? (
        <NewMilestoneDialog
          programCode={programCode}
          onClose={() => setCreating(false)}
          onCreated={(milestone) => {
            setState((current) => (current.status === 'ready' ? { status: 'ready', items: sortMilestones([...current.items, milestone]) } : current));
            setCreating(false);
            toast.push('ok', t('hitos', 'created'), t('hitos', 'createdBody', { name: milestone.name, id: milestone.id }));
            onChanged();
          }}
        />
      ) : null}

      {deleting ? (
        <ConfirmDialog
          role="alertdialog"
          testId={HITOS_TESTIDS.MILESTONE_DELETE_DIALOG}
          title={t('hitos', 'deleteTitle')}
          body={t('hitos', 'deleteBody', { name: deleting.name })}
          confirmLabel={t('hitos', 'deleteConfirm')}
          cancelLabel={t('hitos', 'deleteCancel')}
          tone="danger"
          busy={deleteBusy}
          busyTitle={t('common', 'processing')}
          onCancel={() => setDeleting(null)}
          onConfirm={() => void confirmDelete()}
        />
      ) : null}
    </section>
  );
};

interface MilestoneRowProps {
  readonly milestone: MilestoneDto;
  readonly edit: EditState | null;
  readonly canEdit: boolean;
  readonly canDelete: boolean;
  readonly onStartEdit: (field: Field) => void;
  readonly onDraft: (draft: string) => void;
  readonly onCommitEdit: () => void;
  readonly onCancelEdit: () => void;
  readonly onProgress: (value: number) => void;
  readonly onDelete: () => void;
}

const MilestoneRow = ({ milestone, edit, canEdit, canDelete, onStartEdit, onDraft, onCommitEdit, onCancelEdit, onProgress, onDelete }: MilestoneRowProps) => {
  const { t, lang } = useI18n();
  const [drag, setDrag] = useState<number | null>(null);
  const shown = drag ?? milestone.progress;
  const status = milestoneView(milestone);

  const menuItems: readonly MenuItemSpec[] = useMemo(
    () => [
      { key: 'rename', label: t('hitos', 'menuRename'), testId: HITOS_TESTIDS.MILESTONE_MENU_RENAME, disabled: !canEdit, title: canEdit ? undefined : t('hitos', 'editDenied'), onSelect: () => onStartEdit('name') },
      {
        key: 'delete',
        label: t('hitos', 'menuDelete'),
        testId: HITOS_TESTIDS.MILESTONE_MENU_DELETE,
        disabled: !canDelete,
        title: canDelete ? undefined : t('hitos', 'deleteDenied'),
        danger: true,
        separatorBefore: true,
        onSelect: onDelete,
      },
    ],
    [t, canEdit, canDelete, onStartEdit, onDelete],
  );

  return (
    <tr data-testid={HITOS_DYNAMIC_TESTIDS.MILESTONE_ROW(milestone.id)} data-state={status} className="border-b border-border last:border-b-0 hover:bg-surface-2">
      <td className="px-3 py-1.5">
        <EditableCell
          field="name"
          edit={edit?.field === 'name' ? edit : null}
          canEdit={canEdit}
          display={milestone.name}
          buttonTestId={HITOS_DYNAMIC_TESTIDS.MILESTONE_NAME(milestone.id)}
          inputTestId={HITOS_DYNAMIC_TESTIDS.MILESTONE_NAME_INPUT(milestone.id)}
          inputLabel={t('hitos', 'nameLabel')}
          inputType="text"
          onStartEdit={onStartEdit}
          onDraft={onDraft}
          onCommitEdit={onCommitEdit}
          onCancelEdit={onCancelEdit}
        />
      </td>
      <td className="px-3 py-1.5">
        <EditableCell
          field="dueDate"
          edit={edit?.field === 'dueDate' ? edit : null}
          canEdit={canEdit}
          display={formatDate(milestone.dueDate, lang)}
          buttonTestId={HITOS_DYNAMIC_TESTIDS.MILESTONE_DATE(milestone.id)}
          inputTestId={HITOS_DYNAMIC_TESTIDS.MILESTONE_DATE_INPUT(milestone.id)}
          inputLabel={t('hitos', 'dateLabel')}
          inputType="date"
          mono
          onStartEdit={onStartEdit}
          onDraft={onDraft}
          onCommitEdit={onCommitEdit}
          onCancelEdit={onCancelEdit}
        />
      </td>
      <td className="px-3 py-1.5">
        <div className="flex items-center gap-2">
          <RangeSlider
            testId={HITOS_DYNAMIC_TESTIDS.MILESTONE_PROGRESS(milestone.id)}
            label={t('hitos', 'progressOf', { name: milestone.name })}
            min={0}
            max={100}
            step={5}
            value={shown}
            valueText={t('hitos', 'progressText', { value: shown })}
            disabled={!canEdit}
            title={canEdit ? undefined : t('hitos', 'editDenied')}
            onChange={setDrag}
            onCommit={(value) => {
              setDrag(null);
              onProgress(value);
            }}
            className="w-[140px]"
          />
          <span className="w-10 text-right font-mono text-[12px]" aria-hidden="true">
            {t('hitos', 'progressText', { value: shown })}
          </span>
        </div>
      </td>
      <td className="px-3 py-1.5">
        <ToneBadge state={status} tone={MILESTONE_STATUS_TONE[status]} label={t('hitos', `status_${status}`)} testId={HITOS_DYNAMIC_TESTIDS.MILESTONE_STATUS(milestone.id)} />
      </td>
      <td className="px-2 py-1.5">
        <RowMenuButton
          label={t('hitos', 'rowActions', { name: milestone.name })}
          buttonTestId={HITOS_DYNAMIC_TESTIDS.MILESTONE_ROW_MENU(milestone.id)}
          menuTestId={HITOS_TESTIDS.MILESTONE_MENU}
          items={menuItems}
        />
      </td>
    </tr>
  );
};

interface EditableCellProps {
  readonly field: Field;
  readonly edit: EditState | null;
  readonly canEdit: boolean;
  readonly display: string;
  readonly buttonTestId: string;
  readonly inputTestId: string;
  readonly inputLabel: string;
  readonly inputType: 'text' | 'date';
  readonly mono?: boolean;
  readonly onStartEdit: (field: Field) => void;
  readonly onDraft: (draft: string) => void;
  readonly onCommitEdit: () => void;
  readonly onCancelEdit: () => void;
}

/** Celda editable: el texto es un botón (doble clic, F2 o Intro abren la edición); en edición, Intro guarda y Esc o salir cancela. */
const EditableCell = ({ field, edit, canEdit, display, buttonTestId, inputTestId, inputLabel, inputType, mono = false, onStartEdit, onDraft, onCommitEdit, onCancelEdit }: EditableCellProps) => {
  const { t } = useI18n();
  const inputRef = useRef<HTMLInputElement>(null);
  const editing = edit !== null;

  useEffect(() => {
    if (!editing) return;
    inputRef.current?.focus();
    inputRef.current?.select?.();
  }, [editing]);

  if (edit) {
    const reason = edit.error ? t('hitos', edit.error as MessageKey<'hitos'>) : undefined;
    return (
      <input
        ref={inputRef}
        type={inputType}
        data-testid={inputTestId}
        aria-label={inputLabel}
        aria-invalid={edit.error ? true : undefined}
        title={reason}
        value={edit.draft}
        onChange={(event) => onDraft(event.target.value)}
        onKeyDown={(event: KeyboardEvent<HTMLInputElement>) => {
          if (event.key === 'Enter') {
            event.preventDefault();
            onCommitEdit();
          } else if (event.key === 'Escape') {
            event.preventDefault();
            event.stopPropagation();
            onCancelEdit();
          }
        }}
        // Salir del campo cancela: no se guarda nada por accidente (misma decisión que Requisitos)
        onBlur={onCancelEdit}
        className={`input !h-7 !bg-surface ${mono ? '!font-mono' : ''} ${edit.error ? '!border-danger' : ''}`}
      />
    );
  }

  return (
    <button
      type="button"
      data-testid={buttonTestId}
      title={canEdit ? t('hitos', 'editHint') : t('hitos', 'editDenied')}
      onDoubleClick={() => onStartEdit(field)}
      onKeyDown={(event) => {
        if (event.key === 'F2' || event.key === 'Enter') {
          event.preventDefault();
          onStartEdit(field);
        }
      }}
      className={`max-w-[260px] cursor-text truncate rounded-ctl border border-transparent bg-transparent px-1.5 py-0.5 text-left text-[12.5px] text-fg hover:border-border ${mono ? 'font-mono text-[12px]' : 'font-medium'}`}
    >
      {display}
    </button>
  );
};
