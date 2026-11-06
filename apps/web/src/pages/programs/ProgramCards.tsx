import { PROGRAMAS_DYNAMIC_TESTIDS, PROGRAMAS_TESTIDS, formatDate, type ProgramDto } from '@sigpro/shared';
import { Link } from 'react-router-dom';
import { useI18n } from '../../state/i18n';
import { ProgressBar } from '../../ui/ProgressBar';
import { StatusBadge } from '../../ui/StatusBadge';

interface CardsProps {
  readonly rows: readonly ProgramDto[];
  readonly loading: boolean;
  readonly showSkeleton: boolean;
}

/** Lista de tarjetas (< 640 px) en lugar de la tabla. */
export const ProgramCards = ({ rows, loading, showSkeleton }: CardsProps) => {
  const { t, lang } = useI18n();
  return (
    <div data-testid={PROGRAMAS_TESTIDS.PROGRAMS_LIST} aria-busy={loading} className="flex flex-col gap-2">
      {showSkeleton
        ? Array.from({ length: 4 }, (_, index) => <div key={index} data-testid={PROGRAMAS_TESTIDS.SKELETON_ROW} aria-hidden="true" className="skeleton h-[84px] !rounded-[6px]" />)
        : rows.map((program) => (
            <Link
              key={program.code}
              to={`/programs/${program.code}`}
              data-testid={PROGRAMAS_DYNAMIC_TESTIDS.PROGRAMS_ROW(program.code)}
              className="flex min-h-11 flex-col gap-2 rounded-[6px] border border-border bg-surface p-3 !text-fg no-underline"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-[12px] font-medium">{program.code}</span>
                <StatusBadge status={program.status} />
              </div>
              <div className="leading-[1.3] font-medium">{program.name}</div>
              <div className="flex items-center justify-between gap-2 text-[11.5px] text-fg-2">
                <span>{program.ownerName}</span>
                <span className="font-mono">{formatDate(program.startDate, lang)}</span>
              </div>
              <div className="flex items-center gap-2">
                <ProgressBar
                  percent={program.progress}
                  label={t('common', 'progressLabel', { code: program.code, percent: program.progress })}
                  cancelled={program.status === 'cancelled'}
                  heightClass="h-[5px]"
                />
                <span className="w-8 text-right font-mono text-[11px]">{program.progress}%</span>
              </div>
            </Link>
          ))}
    </div>
  );
};
