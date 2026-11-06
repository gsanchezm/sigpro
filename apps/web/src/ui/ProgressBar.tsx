import { toProgressTitle } from '@sigpro/shared';
import { useI18n } from '../state/i18n';

interface ProgressBarProps {
  readonly percent: number;
  /** `aria-label` accesible: "Programa PRG-001: 11%". */
  readonly label: string;
  readonly cancelled?: boolean;
  readonly heightClass?: string;
  readonly testId?: string;
}

/** Barra de progreso: role=progressbar con aria-valuenow y `title="11 % completado"` (para getByTitle). */
export const ProgressBar = ({ percent, label, cancelled = false, heightClass = 'h-1.5', testId }: ProgressBarProps) => {
  const { lang } = useI18n();
  return (
    <div
      role="progressbar"
      data-testid={testId}
      aria-valuenow={percent}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
      title={toProgressTitle(percent, lang)}
      className={`flex-1 overflow-hidden rounded-[3px] bg-surface-2 ${heightClass}`}
    >
      <div className="h-full" style={{ width: `${percent}%`, background: cancelled ? 'var(--text-3)' : 'var(--accent)' }} />
    </div>
  );
};
