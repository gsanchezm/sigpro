import { useId } from 'react';
import { Link } from 'react-router-dom';
import { Modal } from './Modal';

export interface SheetAction {
  readonly key: string;
  readonly label: string;
  readonly testId: string;
  readonly onSelect?: () => void;
  /** Enlace interno (React Router): se pinta como `<a>` y se cierra la hoja al elegirlo. */
  readonly to?: string;
  readonly disabled?: boolean;
  /** Motivo por el que está deshabilitada (`title`). */
  readonly title?: string;
  readonly danger?: boolean;
}

interface ActionSheetProps {
  /** Nombre accesible del diálogo y título visible (p. ej. «Acciones para PRG-001»). */
  readonly title: string;
  readonly testId: string;
  readonly closeTestId: string;
  readonly closeLabel: string;
  readonly actions: readonly SheetAction[];
  readonly onClose: () => void;
}

const itemClass = 'flex min-h-11 w-full cursor-pointer items-center rounded-ctl border-0 bg-transparent px-3 text-left text-[14px] text-fg no-underline hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-50';

/**
 * Hoja inferior del DISEÑO RESPONSIVE: un `dialog` con botones. Sustituye al menú ⋯ de escritorio (`role="menu"` con
 * `menuitem`): las mismas acciones con los mismos nombres, pero como botones (y enlaces) de un diálogo modal.
 */
export const ActionSheet = ({ title, testId, closeTestId, closeLabel, actions, onClose }: ActionSheetProps) => {
  const titleId = useId();
  return (
    <Modal role="dialog" testId={testId} labelledBy={titleId} onClose={onClose} className="inset-x-0 bottom-0 max-h-[85vh] rounded-t-card !border-b-0">
      <h2 id={titleId} className="m-0 px-4 pt-4 pb-2 text-[13px] font-semibold">
        {title}
      </h2>
      <div className="flex min-h-0 flex-col gap-0.5 overflow-y-auto px-2 pb-1">
        {actions.map((action) => {
          const className = `${itemClass} ${action.danger ? '!text-danger hover:!bg-danger-soft' : ''}`;
          if (action.to && !action.disabled) {
            return (
              <Link key={action.key} to={action.to} data-testid={action.testId} onClick={onClose} className={className}>
                {action.label}
              </Link>
            );
          }
          return (
            <button
              key={action.key}
              type="button"
              data-testid={action.testId}
              disabled={action.disabled}
              title={action.title}
              onClick={() => {
                onClose();
                action.onSelect?.();
              }}
              className={className}
            >
              {action.label}
            </button>
          );
        })}
      </div>
      <div className="border-t border-border p-2">
        <button type="button" data-testid={closeTestId} onClick={onClose} className={`${itemClass} justify-center font-medium`}>
          {closeLabel}
        </button>
      </div>
    </Modal>
  );
};
