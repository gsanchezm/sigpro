import { MISION_DYNAMIC_TESTIDS, MISION_TESTIDS, NC_SEVERITIES, NC_SEVERITY_TONE, type MessageKey, type MilestoneBar, type NcSeverity } from '@sigpro/shared';
import { useState } from 'react';
import { useI18n } from '../../state/i18n';
import { Tooltip } from '../../ui/Tooltip';
import { columnHeights, milestoneBarViews } from './mission-view';

// Gráficas del panel de misión, a mano en HTML/CSS (sin librería): barras finas (≤ 24 px), extremo de datos redondeado
// 4 px y base recta, hueco de 2 px entre segmentos, texto con tokens de texto (nunca con el color de la serie), leyenda
// para 2+ series, tooltip por barra (hover y foco) y vista de tabla alternativa. Cada barra expone su valor en el
// nombre accesible, así que el tooltip mejora pero nunca bloquea.

const SEVERITY_COLOR: Readonly<Record<NcSeverity, string>> = {
  minor: 'var(--info)',
  major: 'var(--warn)',
  critical: 'var(--danger)',
};

const TOGGLE = 'btn btn-ghost !h-7 !px-2 !text-[12px]';
const COLUMN_AREA_PX = 120;
const BAR_RADIUS = 4;

interface ChartCardProps {
  readonly testId: string;
  readonly titleId: string;
  readonly title: string;
  readonly toggleTestId: string;
  readonly asTable: boolean;
  readonly onToggle: () => void;
  readonly children: React.ReactNode;
}

const ChartCard = ({ testId, titleId, title, toggleTestId, asTable, onToggle, children }: ChartCardProps) => {
  const { t } = useI18n();
  return (
    <figure data-testid={testId} aria-labelledby={titleId} className="card m-0 flex min-w-0 flex-col gap-3 p-4">
      <div className="flex items-center justify-between gap-2">
        <figcaption id={titleId} className="text-[13px] font-semibold">
          {title}
        </figcaption>
        <button type="button" data-testid={toggleTestId} aria-pressed={asTable} onClick={onToggle} className={TOGGLE}>
          {asTable ? t('mision', 'viewChart') : t('mision', 'viewTable')}
        </button>
      </div>
      {children}
    </figure>
  );
};

const LegendKey = ({ color, label }: { color: string; label: string }) => (
  <span className="flex items-center gap-1.5 text-[12px] text-fg-2">
    <span aria-hidden="true" className="inline-block h-[3px] w-3.5 rounded-full" style={{ background: color }} />
    {label}
  </span>
);

const Empty = () => {
  const { t } = useI18n();
  return (
    <p data-testid={MISION_TESTIDS.MISSION_CHART_EMPTY} className="m-0 py-8 text-center text-[12.5px] text-fg-3">
      {t('mision', 'chartEmpty')}
    </p>
  );
};

/** Hitos cumplidos frente al total en los programas activos: una barra horizontal partida en cumplidos | pendientes. */
export const MilestonesChart = ({ bars }: { bars: readonly MilestoneBar[] }) => {
  const { t } = useI18n();
  const [asTable, setAsTable] = useState(false);
  const views = milestoneBarViews(bars);

  return (
    <ChartCard
      testId={MISION_TESTIDS.MISSION_CHART_MILESTONES}
      titleId="mission-chart-milestones-title"
      title={t('mision', 'chartMilestonesTitle')}
      toggleTestId={MISION_TESTIDS.MISSION_CHART_MILESTONES_TOGGLE}
      asTable={asTable}
      onToggle={() => setAsTable((current) => !current)}
    >
      {views.length === 0 ? (
        <Empty />
      ) : asTable ? (
        <table data-testid={MISION_TESTIDS.MISSION_CHART_MILESTONES_TABLE} className="w-full border-collapse text-[12.5px]">
          <caption className="sr-only">{t('mision', 'chartMilestonesLabel', { count: views.length })}</caption>
          <thead>
            <tr className="text-left text-fg-3">
              <th scope="col" className="py-1 font-medium">{t('mision', 'tableProgram')}</th>
              <th scope="col" className="py-1 text-right font-medium">{t('mision', 'tableDone')}</th>
              <th scope="col" className="py-1 text-right font-medium">{t('mision', 'tableTotal')}</th>
            </tr>
          </thead>
          <tbody>
            {views.map((bar) => (
              <tr key={bar.programCode} className="border-t border-border">
                <th scope="row" className="py-1 text-left font-mono text-[11.5px] font-normal">{bar.programCode}</th>
                <td className="py-1 text-right font-mono">{bar.done}</td>
                <td className="py-1 text-right font-mono">{bar.total}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <>
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            <LegendKey color="var(--accent)" label={t('mision', 'chartMilestonesDone')} />
            <LegendKey color="var(--border-strong)" label={t('mision', 'chartMilestonesRest')} />
          </div>
          <ul aria-label={t('mision', 'chartMilestonesLabel', { count: views.length })} className="m-0 flex list-none flex-col gap-1 p-0">
            {views.map((bar) => {
              const tip = t('mision', 'barTipMilestones', { program: bar.programCode, done: bar.done, total: bar.total });
              const pending = bar.total - bar.done;
              return (
                <li key={bar.programCode} data-testid={MISION_DYNAMIC_TESTIDS.MISSION_BAR_MILESTONES(bar.programCode)} data-done={bar.done} data-total={bar.total} className="flex items-center gap-3">
                  <span aria-hidden="true" className="w-[58px] flex-none font-mono text-[11.5px] text-fg-2">
                    {bar.programCode}
                  </span>
                  <Tooltip id={`tip-ms-${bar.programCode}`} text={tip} testId={MISION_DYNAMIC_TESTIDS.MISSION_BAR_TOOLTIP(`milestones-${bar.programCode}`)} placement="top" className="flex min-w-0 flex-1">
                    <button type="button" aria-label={tip} className="flex h-6 min-w-0 cursor-default items-center border-0 bg-transparent p-0" style={{ width: `${bar.widthPct}%` }}>
                      <span aria-hidden="true" className="flex h-3.5 w-full gap-[2px]">
                        {bar.done > 0 ? <span style={{ flex: `${bar.done} 1 0`, background: 'var(--accent)', borderRadius: pending === 0 ? `0 ${BAR_RADIUS}px ${BAR_RADIUS}px 0` : 0 }} /> : null}
                        {pending > 0 ? <span style={{ flex: `${pending} 1 0`, background: 'var(--border-strong)', borderRadius: `0 ${BAR_RADIUS}px ${BAR_RADIUS}px 0` }} /> : null}
                      </span>
                    </button>
                  </Tooltip>
                  <span aria-hidden="true" className="w-9 flex-none font-mono text-[11.5px] text-fg-2">
                    {bar.done}/{bar.total}
                  </span>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </ChartCard>
  );
};

/** NC abiertas por severidad: tres columnas con el color de la severidad (el mismo de las tarjetas del tablero). */
export const NcSeverityChart = ({ counts }: { counts: Readonly<Record<NcSeverity, number>> }) => {
  const { t } = useI18n();
  const [asTable, setAsTable] = useState(false);
  const heights = columnHeights(counts, COLUMN_AREA_PX);
  const total = NC_SEVERITIES.reduce((sum, severity) => sum + counts[severity], 0);
  const label = (severity: NcSeverity): string => t('nc', `sev_${severity}` as MessageKey<'nc'>);

  return (
    <ChartCard
      testId={MISION_TESTIDS.MISSION_CHART_NC}
      titleId="mission-chart-nc-title"
      title={t('mision', 'chartNcTitle')}
      toggleTestId={MISION_TESTIDS.MISSION_CHART_NC_TOGGLE}
      asTable={asTable}
      onToggle={() => setAsTable((current) => !current)}
    >
      {asTable ? (
        <table data-testid={MISION_TESTIDS.MISSION_CHART_NC_TABLE} className="w-full border-collapse text-[12.5px]">
          <caption className="sr-only">{t('mision', 'chartNcLabel', { minor: counts.minor, major: counts.major, critical: counts.critical })}</caption>
          <thead>
            <tr className="text-left text-fg-3">
              <th scope="col" className="py-1 font-medium">{t('mision', 'tableSeverity')}</th>
              <th scope="col" className="py-1 text-right font-medium">{t('mision', 'tableCount')}</th>
            </tr>
          </thead>
          <tbody>
            {NC_SEVERITIES.map((severity) => (
              <tr key={severity} data-severity={severity} className="border-t border-border">
                <th scope="row" className="py-1 text-left font-normal">{label(severity)}</th>
                <td className="py-1 text-right font-mono">{counts[severity]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : total === 0 ? (
        <Empty />
      ) : (
        <ul aria-label={t('mision', 'chartNcLabel', { minor: counts.minor, major: counts.major, critical: counts.critical })} className="m-0 flex list-none items-end justify-around gap-4 p-0 pt-2">
          {NC_SEVERITIES.map((severity) => {
            const tip = t('mision', 'barTipNc', { severity: label(severity), count: counts[severity] });
            return (
              <li key={severity} data-testid={MISION_DYNAMIC_TESTIDS.MISSION_BAR_NC(severity)} data-severity={severity} data-tone={NC_SEVERITY_TONE[severity]} data-value={counts[severity]} className="flex flex-col items-center gap-1.5">
                <span aria-hidden="true" className="font-mono text-[12px] font-medium">
                  {counts[severity]}
                </span>
                <Tooltip id={`tip-nc-${severity}`} text={tip} testId={MISION_DYNAMIC_TESTIDS.MISSION_BAR_TOOLTIP(`nc-${severity}`)} placement="top">
                  <button type="button" aria-label={tip} className="flex cursor-default items-end justify-center border-0 bg-transparent p-0" style={{ height: COLUMN_AREA_PX, width: 40 }}>
                    <span aria-hidden="true" style={{ display: 'block', height: heights[severity], width: 24, background: SEVERITY_COLOR[severity], borderRadius: `${BAR_RADIUS}px ${BAR_RADIUS}px 0 0` }} />
                  </button>
                </Tooltip>
                <span aria-hidden="true" className="border-t border-border pt-1.5 text-[12px] text-fg-2">
                  {label(severity)}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </ChartCard>
  );
};
