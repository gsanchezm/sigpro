import { PROGRAMAS_TESTIDS, STATUS_TONE, type ProgramStatus } from '@sigpro/shared';
import { useI18n } from '../state/i18n';

interface StatusBadgeProps {
  readonly status: ProgramStatus;
  /** `data-testid` del badge (por defecto el de las filas de la tabla). */
  readonly testId?: string;
}

/** Badge de estado con `data-state`/`data-tone` (CSS: `.badge[data-state="on_hold"]`). Punto + etiqueta, borde del tono. */
export const StatusBadge = ({ status, testId = PROGRAMAS_TESTIDS.PROGRAMS_STATE_BADGE }: StatusBadgeProps) => {
  const { t } = useI18n();
  const labels = { draft: t('programas', 'st_draft'), active: t('programas', 'st_active'), on_hold: t('programas', 'st_on_hold'), closed: t('programas', 'st_closed'), cancelled: t('programas', 'st_cancelled') } as const;
  return (
    <span data-testid={testId} data-state={status} data-tone={STATUS_TONE[status]} className="badge badge-row">
      {labels[status]}
    </span>
  );
};
