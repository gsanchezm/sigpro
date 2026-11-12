import { NC_TESTIDS } from '@sigpro/shared';
import { useIsMobileLayout } from '../../lib/layout';
import { useI18n } from '../../state/i18n';
import { Modal } from '../../ui/Modal';
import { CloseNcForm } from './CloseNcForm';

interface CloseNcDialogProps {
  readonly code: string;
  readonly onClose: () => void;
  readonly onSubmit: (comment: string) => Promise<void>;
}

/** Diálogo de cierre que abre el tablero al soltar una tarjeta en «Cerrada» (el detalle usa el formulario sin diálogo). */
export const CloseNcDialog = ({ code, onClose, onSubmit }: CloseNcDialogProps) => {
  const { t } = useI18n();
  const mobile = useIsMobileLayout();
  return (
    <Modal
      role="dialog"
      testId={NC_TESTIDS.NC_CLOSE_DIALOG}
      labelledBy="nc-close-heading"
      onClose={onClose}
      className={mobile ? 'inset-x-0 bottom-0 top-16 rounded-t-[10px]' : 'top-1/2 left-1/2 w-[min(520px,calc(100%-32px))] -translate-x-1/2 -translate-y-1/2 rounded-card'}
    >
      <div className="flex flex-1 flex-col gap-3 overflow-auto p-5">
        <h2 id="nc-close-heading" className="section-title">
          {t('nc', 'closeTitle', { code })}
        </h2>
        <CloseNcForm onSubmit={onSubmit} onCancel={onClose} />
      </div>
    </Modal>
  );
};
