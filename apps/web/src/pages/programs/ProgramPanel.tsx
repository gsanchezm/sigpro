import { PROGRAMAS_TESTIDS, formatDate, formatMoney, type ProgramDto } from '@sigpro/shared';
import { useEffect, useRef, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useI18n } from '../../state/i18n';
import { Avatar } from '../../ui/Avatar';
import { ProgressBar } from '../../ui/ProgressBar';
import { StatusBadge } from '../../ui/StatusBadge';

const Field = ({ label, testId, children }: { readonly label: string; readonly testId: string; readonly children: ReactNode }) => (
  <div className="flex flex-col gap-1">
    <dt className="text-[12px] font-medium text-fg-3">{label}</dt>
    <dd data-testid={testId} className="m-0 text-[14px]">
      {children}
    </dd>
  </div>
);

/**
 * Panel lateral de detalle de un programa (380 px, dentro de la rejilla, no modal). Por debajo de 1024 px pasa a ser un drawer
 * a ancho completo. Se cierra con «×» o con Esc (lo gestiona la página); no hace peticiones: usa los datos de la fila.
 */
export const ProgramPanel = ({ program, onClose }: { readonly program: ProgramDto; readonly onClose: () => void }) => {
  const { t, lang } = useI18n();
  const panelRef = useRef<HTMLElement>(null);

  // El foco pasa al panel al abrirlo (sin desplazar la página): un usuario de teclado puede cerrarlo con Esc o ir al enlace
  useEffect(() => panelRef.current?.focus({ preventScroll: true }), [program.code]);

  return (
    <aside
      ref={panelRef}
      tabIndex={-1}
      aria-label={t('programas', 'panelTitle', { code: program.code })}
      data-testid={PROGRAMAS_TESTIDS.PROGRAMS_PANEL}
      className="fixed inset-0 z-[35] flex flex-col gap-5 overflow-y-auto bg-surface p-5 outline-none lg:sticky lg:inset-auto lg:top-[calc(var(--topbar-h)+16px)] lg:z-auto lg:max-h-[calc(100vh-var(--topbar-h)-32px)] lg:w-[380px] lg:flex-none lg:self-start lg:rounded-card lg:border lg:border-border lg:p-[var(--card-pad)] lg:shadow-card"
    >
      <div className="flex items-center justify-between gap-3">
        <span data-testid={PROGRAMAS_TESTIDS.PROGRAMS_PANEL_CODE} className="mono text-[13px] font-medium text-fg-2">
          {program.code}
        </span>
        <button type="button" data-testid={PROGRAMAS_TESTIDS.PROGRAMS_PANEL_CLOSE} aria-label={t('programas', 'panelClose')} onClick={onClose} className="icon-btn !size-8 !border-transparent text-[20px] leading-none">
          ×
        </button>
      </div>

      <div className="flex flex-col gap-2.5">
        <h2 data-testid={PROGRAMAS_TESTIDS.PROGRAMS_PANEL_NAME} className="section-title">
          {program.name}
        </h2>
        <div>
          <StatusBadge status={program.status} testId={PROGRAMAS_TESTIDS.PROGRAMS_PANEL_STATUS} />
        </div>
      </div>

      <dl className="m-0 grid gap-4">
        <Field label={t('programas', 'owner')} testId={PROGRAMAS_TESTIDS.PROGRAMS_PANEL_OWNER}>
          <span className="inline-flex items-center gap-2">
            <Avatar name={program.ownerName} size={24} fontPx={10} shape="circle" decorative />
            {program.ownerName}
          </span>
        </Field>
        <Field label={t('programas', 'dates')} testId={PROGRAMAS_TESTIDS.PROGRAMS_PANEL_DATES}>
          <span className="mono text-[13px]">
            {formatDate(program.startDate, lang)} → {formatDate(program.endDate, lang)}
          </span>
        </Field>
        <Field label={t('programas', 'budget')} testId={PROGRAMAS_TESTIDS.PROGRAMS_PANEL_BUDGET}>
          <span className="mono text-[13px]">{formatMoney(program.budgetEur, lang)}</span>
        </Field>
        <Field label={t('common', 'progressColumn')} testId={PROGRAMAS_TESTIDS.PROGRAMS_PANEL_PROGRESS}>
          <span className="flex items-center gap-3">
            <ProgressBar percent={program.progress} label={t('common', 'progressLabel', { code: program.code, percent: program.progress })} cancelled={program.status === 'cancelled'} />
            <span className="mono w-10 text-right text-[13px]">{program.progress}%</span>
          </span>
        </Field>
      </dl>

      <Link to={`/programs/${program.code}`} data-testid={PROGRAMAS_TESTIDS.PROGRAMS_PANEL_OPEN_FULL} className="btn btn-secondary btn-wide mt-auto !text-fg no-underline">
        {t('programas', 'panelOpenFull')}
      </Link>
    </aside>
  );
};
