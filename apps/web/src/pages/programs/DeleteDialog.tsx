import { PROGRAMAS_TESTIDS } from '@sigpro/shared';
import { useRef } from 'react';
import { useI18n } from '../../state/i18n';
import { Modal } from '../../ui/Modal';

interface DeleteDialogProps {
  /** Códigos a eliminar. */
  readonly codes: readonly string[];
  readonly busy: boolean;
  readonly onCancel: () => void;
  readonly onConfirm: () => void;
}

/** `alertdialog` custom (a propósito distinto del `confirm()` nativo del reset en /lab). Foco inicial en "Eliminar". */
export const DeleteDialog = ({ codes, busy, onCancel, onConfirm }: DeleteDialogProps) => {
  const { t } = useI18n();
  const confirmRef = useRef<HTMLButtonElement>(null);
  const description = codes.length === 1 ? `${codes[0]} ${t('programas', 'deleteDescOne')}` : `${codes.length} ${t('programas', 'deleteDescMany')}`;

  return (
    <Modal
      role="alertdialog"
      testId={PROGRAMAS_TESTIDS.PROGRAMS_DELETE_DIALOG}
      labelledBy="delete-title"
      describedBy="delete-desc"
      onClose={onCancel}
      initialFocus={confirmRef}
      className="top-[40%] left-1/2 w-[min(420px,calc(100%-32px))] -translate-x-1/2 -translate-y-1/2 gap-3 rounded-card p-5"
    >
      <h2 id="delete-title" className="section-title">
        {t('programas', 'deleteTitle')}
      </h2>
      <p id="delete-desc" className="m-0 text-fg-2">
        {description}
      </p>
      <div className="flex justify-end gap-2">
        <button type="button" data-testid={PROGRAMAS_TESTIDS.MODAL_CANCEL} onClick={onCancel} className="btn btn-secondary">
          {t('programas', 'cancel')}
        </button>
        <button
          ref={confirmRef}
          type="button"
          data-testid={PROGRAMAS_TESTIDS.MODAL_CONFIRM}
          onClick={onConfirm}
          disabled={busy}
          title={busy ? t('common', 'processing') : undefined}
          className="btn btn-danger"
        >
          {t('programas', 'delete')}
        </button>
      </div>
    </Modal>
  );
};
