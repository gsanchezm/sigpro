import { PROGRAMAS_TESTIDS } from '@sigpro/shared';
import { useRef, type ReactNode } from 'react';
import { Modal } from './Modal';

interface ConfirmDialogProps {
  /** `alertdialog` para acciones destructivas; `dialog` para confirmaciones normales (cambio de estado). */
  readonly role: 'dialog' | 'alertdialog';
  readonly testId: string;
  readonly title: string;
  readonly body: ReactNode;
  readonly confirmLabel: string;
  readonly cancelLabel: string;
  readonly tone?: 'primary' | 'danger';
  readonly busy?: boolean;
  readonly busyTitle?: string;
  /** Error de servidor que se muestra bajo el texto. */
  readonly error?: string | null;
  readonly onCancel: () => void;
  readonly onConfirm: () => void;
}

/** Modal de confirmación con aceptar y cancelar (`modal-confirm` / `modal-cancel`). El foco inicial va al botón de confirmar. */
export const ConfirmDialog = ({ role, testId, title, body, confirmLabel, cancelLabel, tone = 'primary', busy = false, busyTitle, error, onCancel, onConfirm }: ConfirmDialogProps) => {
  const confirmRef = useRef<HTMLButtonElement>(null);
  return (
    <Modal
      role={role}
      testId={testId}
      labelledBy={`${testId}-title`}
      describedBy={`${testId}-desc`}
      onClose={onCancel}
      initialFocus={confirmRef}
      className="top-[40%] left-1/2 w-[min(440px,calc(100%-32px))] -translate-x-1/2 -translate-y-1/2 gap-3 rounded-card p-5"
    >
      <h2 id={`${testId}-title`} className="section-title">
        {title}
      </h2>
      <div id={`${testId}-desc`} className="text-fg-2">
        {body}
      </div>
      {error ? (
        <div role="alert" className="alert alert-danger text-[12.5px]">
          {error}
        </div>
      ) : null}
      <div className="flex justify-end gap-2">
        <button type="button" data-testid={PROGRAMAS_TESTIDS.MODAL_CANCEL} onClick={onCancel} className="btn btn-secondary">
          {cancelLabel}
        </button>
        <button
          ref={confirmRef}
          type="button"
          data-testid={PROGRAMAS_TESTIDS.MODAL_CONFIRM}
          onClick={onConfirm}
          disabled={busy}
          aria-busy={busy}
          title={busy ? busyTitle : undefined}
          className={`btn ${tone === 'danger' ? 'btn-danger' : 'btn-primary'}`}
        >
          {confirmLabel}
        </button>
      </div>
    </Modal>
  );
};
