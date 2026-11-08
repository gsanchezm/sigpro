import { ApiError, DETALLE_DYNAMIC_TESTIDS, DETALLE_TESTIDS, EDITAR_PROGRAMA_TESTIDS, REQUISITOS_TESTIDS, can, formatDate, formatMoney, type ProgramDto } from '@sigpro/shared';
import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { formatTrace } from '../../lib/errors';
import { useAuth } from '../../state/auth';
import { useI18n } from '../../state/i18n';
import { ProgressBar } from '../../ui/ProgressBar';
import { StatusBadge } from '../../ui/StatusBadge';
import { MilestonesPanel } from './MilestonesPanel';
import { SuppliersPanel } from './SuppliersPanel';

type TabKey = 'summary' | 'milestones' | 'requirements';
const TABS: readonly TabKey[] = ['summary', 'milestones', 'requirements'];

/** Detalle mínimo de un programa con pestañas (hitos y requisitos llegan en la fase 2). */
export const ProgramDetailPage = () => {
  const { code = '' } = useParams();
  const { t, lang } = useI18n();
  const { api, user } = useAuth();
  const [program, setProgram] = useState<ProgramDto | null>(null);
  const [failure, setFailure] = useState<unknown>(null);
  const [tab, setTab] = useState<TabKey>('summary');
  const canEdit = user ? can(user.role, 'program.edit') : false;

  /** Vuelve a pedir el programa sin vaciarlo: tras editar un hito cambian el avance y los hitos cumplidos de la cabecera. */
  const reloadProgram = useCallback(() => {
    api.programs.get(code).then(setProgram, () => undefined);
  }, [api, code]);

  useEffect(() => {
    let cancelled = false;
    setProgram(null);
    setFailure(null);
    api.programs.get(code).then(
      (found) => !cancelled && setProgram(found),
      (error: unknown) => !cancelled && setFailure(error),
    );
    return () => {
      cancelled = true;
    };
  }, [api, code]);

  const tabLabels: Readonly<Record<TabKey, string>> = {
    summary: t('common', 'tabSummary'),
    milestones: t('common', 'tabMilestones'),
    requirements: t('common', 'tabRequirements'),
  };

  if (failure) {
    const missing = failure instanceof ApiError && failure.status === 404;
    return (
      <section role="alert" data-testid={DETALLE_TESTIDS.PROGRAM_DETAIL_NOT_FOUND} className="alert alert-danger flex max-w-[560px] flex-col gap-1">
        <h1 className="m-0 text-[16px] font-semibold">{missing ? t('common', 'notFound') : t('common', 'genericError')}</h1>
        <span className="trace">{formatTrace(failure)}</span>
        <Link to="/programs" data-testid={DETALLE_TESTIDS.PROGRAM_DETAIL_BACK} className="mt-1 self-start text-[12.5px] font-medium">
          {t('common', 'backToPrograms')}
        </Link>
      </section>
    );
  }

  if (!program) {
    return (
      <div aria-busy="true" role="status" className="flex flex-col gap-3">
        <span className="skeleton h-6 w-64" />
        <span className="skeleton h-24 w-full max-w-[640px] !rounded-[6px]" />
      </div>
    );
  }

  const rows: readonly (readonly [string, string])[] = [
    [t('programas', 'owner'), program.ownerName],
    [t('programas', 'dates'), `${formatDate(program.startDate, lang)} → ${formatDate(program.endDate, lang)}`],
    [t('common', 'budgetLabel'), formatMoney(program.budgetEur, lang)],
    [t('common', 'priorityLabel'), t('programas', program.priority)],
    [t('common', 'classifiedLabel'), program.classified ? t('programas', 'yes') : t('programas', 'no')],
    [t('common', 'milestonesLabel'), `${program.milestonesDone} / ${program.milestonesTotal}`],
  ];

  return (
    <article data-testid={DETALLE_TESTIDS.PROGRAM_DETAIL} className="flex max-w-[860px] flex-col gap-4">
      <header className="flex flex-col gap-1.5">
        <div className="flex flex-wrap items-center gap-2.5">
          <span className="font-mono text-[13px] font-medium text-fg-2">{program.code}</span>
          <StatusBadge status={program.status} testId={DETALLE_TESTIDS.PROGRAM_DETAIL_STATE_BADGE} />
          {canEdit ? (
            <Link to={`/programs/${program.code}/edit`} data-testid={EDITAR_PROGRAMA_TESTIDS.PROGRAM_DETAIL_EDIT} className="btn btn-secondary ml-auto no-underline !h-8 !px-3">
              {t('programas', 'editButton')}
            </Link>
          ) : (
            <button
              type="button"
              disabled
              data-testid={EDITAR_PROGRAMA_TESTIDS.PROGRAM_DETAIL_EDIT}
              title={t('programas', 'editButtonDisabled')}
              className="btn btn-secondary ml-auto !h-8 !px-3"
            >
              {t('programas', 'editButton')}
            </button>
          )}
        </div>
        <h1 className="m-0 text-[20px] font-semibold tracking-[-.01em]">{program.name}</h1>
        {program.description ? <p className="m-0 text-fg-2">{program.description}</p> : null}
      </header>

      <div className="flex items-center gap-2.5 text-[12.5px] text-fg-2">
        {t('common', 'progressLabelShort')}
        <div className="flex max-w-[320px] flex-1 items-center gap-2">
          <ProgressBar
            testId={DETALLE_TESTIDS.PROGRAM_DETAIL_PROGRESS}
            percent={program.progress}
            label={t('common', 'progressLabel', { code: program.code, percent: program.progress })}
            cancelled={program.status === 'cancelled'}
          />
          <span className="w-9 text-right font-mono text-[11.5px] text-fg">{program.progress}%</span>
        </div>
      </div>

      <div className="flex flex-col">
        <div role="tablist" aria-label={t('common', 'detailTitle')} data-testid={DETALLE_TESTIDS.PROGRAM_DETAIL_TABS} className="flex gap-1 border-b border-border">
          {TABS.map((key) => (
            <button
              key={key}
              type="button"
              role="tab"
              id={`tab-${key}`}
              aria-selected={tab === key}
              aria-controls={`panel-${key}`}
              tabIndex={tab === key ? 0 : -1}
              data-testid={DETALLE_DYNAMIC_TESTIDS.PROGRAM_DETAIL_TAB(key)}
              onClick={() => setTab(key)}
              onKeyDown={(event) => {
                const index = TABS.indexOf(key);
                const next = event.key === 'ArrowRight' ? TABS[(index + 1) % TABS.length] : event.key === 'ArrowLeft' ? TABS[(index + TABS.length - 1) % TABS.length] : undefined;
                if (next) {
                  event.preventDefault();
                  setTab(next);
                  document.getElementById(`tab-${next}`)?.focus();
                }
              }}
              className={`-mb-px cursor-pointer border-0 border-b-2 bg-transparent px-3.5 py-2 text-[12.5px] ${tab === key ? 'border-accent font-medium text-fg' : 'border-transparent text-fg-2 hover:text-fg'}`}
            >
              {tabLabels[key]}
            </button>
          ))}
        </div>
        <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`} data-testid={DETALLE_DYNAMIC_TESTIDS.PROGRAM_DETAIL_PANEL(tab)} className="card mt-3 p-4">
          {tab === 'summary' ? (
            <>
              <dl className="m-0 grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-[12.5px]">
                {rows.map(([label, value]) => (
                  <div key={label} className="contents">
                    <dt className="text-fg-3">{label}</dt>
                    <dd className="m-0">{value}</dd>
                  </div>
                ))}
              </dl>
              <SuppliersPanel programCode={program.code} />
            </>
          ) : tab === 'requirements' ? (
            <Link to={`/programs/${program.code}/requirements`} data-testid={REQUISITOS_TESTIDS.PROGRAM_DETAIL_OPEN_REQUIREMENTS} className="font-medium">
              {t('requisitos', 'openFromProgram')}
            </Link>
          ) : (
            <MilestonesPanel programCode={program.code} onChanged={reloadProgram} />
          )}
        </div>
      </div>

      <Link to="/programs" data-testid={DETALLE_TESTIDS.PROGRAM_DETAIL_BACK} className="self-start text-[12.5px] font-medium">
        {t('common', 'backToPrograms')}
      </Link>
    </article>
  );
};
