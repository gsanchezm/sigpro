import { PROGRAMAS_TESTIDS, percentOf } from '@sigpro/shared';
import { useResource } from '../../lib/resource';
import { useAuth } from '../../state/auth';
import { useI18n } from '../../state/i18n';
import { Metric, MetricGrid } from '../../ui/Metric';

/**
 * Las cuatro tarjetas de la web (programas, activos, avance medio y NC abiertas), en una rejilla de 2×2. No dependen de los
 * filtros de la lista: salen del resumen de Misión (una petición, los mismos ids que la web). Si el resumen falla, «—»:
 * la lista de debajo sigue funcionando.
 */
export const ProgramsMetrics = () => {
  const { t } = useI18n();
  const { api } = useAuth();
  const summary = useResource(() => api.mission.summary(), [api]);

  const kpis = summary.data?.kpis;
  const placeholder = summary.error !== null ? '—' : '…';
  const num = (value: number | undefined): string => (value === undefined ? placeholder : String(value));
  const total = kpis?.programsTotal;
  const active = kpis?.activePrograms;
  const progress = kpis?.programsProgress;

  return (
    <MetricGrid testID={PROGRAMAS_TESTIDS.PROGRAMS_METRICS} label={t('programas', 'metricsLabel')} busy={summary.loading}>
      <Metric
        testID={PROGRAMAS_TESTIDS.PROGRAMS_METRIC_TOTAL}
        label={t('programas', 'metricTotal')}
        value={num(total)}
        aux={active === undefined ? placeholder : t('programas', 'metricTotalAux', { n: active })}
      />
      <Metric
        testID={PROGRAMAS_TESTIDS.PROGRAMS_METRIC_ACTIVE}
        label={t('programas', 'metricActive')}
        value={num(active)}
        aux={active === undefined || total === undefined ? placeholder : t('programas', 'metricActiveAux', { pct: percentOf(active, total) })}
      />
      <Metric
        testID={PROGRAMAS_TESTIDS.PROGRAMS_METRIC_PROGRESS}
        label={t('programas', 'metricProgress')}
        value={progress === undefined ? placeholder : `${progress} %`}
        percent={progress}
        aux={kpis === undefined ? placeholder : t('programas', 'metricProgressAux', { done: kpis.milestonesDone, total: kpis.milestonesTotal })}
      />
      <Metric
        testID={PROGRAMAS_TESTIDS.PROGRAMS_METRIC_NC}
        label={t('programas', 'metricNc')}
        value={num(kpis?.ncOpen)}
        aux={kpis === undefined ? placeholder : t('programas', 'metricNcAux', { total: kpis.ncTotal })}
      />
    </MetricGrid>
  );
};
