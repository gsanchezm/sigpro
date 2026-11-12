import { REQUISITOS_TESTIDS, requirementMetrics, type RequirementDto } from '@sigpro/shared';
import { useMemo } from 'react';
import { useI18n } from '../../state/i18n';
import { Metric, MetricGrid } from '../../ui/Metric';

/**
 * Las cuatro tarjetas de la web (requisitos, cobertura de verificación, pendientes de aprobación y NC abiertas) en una
 * rejilla de 2×2. Salen de la lista ya cargada (sin peticiones), no dependen de la búsqueda y usan los mismos ids y textos.
 */
export const RequirementsMetrics = ({ items, loading }: { readonly items: readonly RequirementDto[]; readonly loading: boolean }) => {
  const { t } = useI18n();
  const metrics = useMemo(() => requirementMetrics(items), [items]);
  const validated = useMemo(() => items.filter((item) => item.state === 'validated').length, [items]);
  const num = (value: number): string => (loading ? '…' : String(value));
  const aux = (text: string): string => (loading ? '…' : text);

  return (
    <MetricGrid testID={REQUISITOS_TESTIDS.REQUIREMENTS_METRICS} label={t('requisitos', 'metricsLabel')} busy={loading}>
      <Metric testID={REQUISITOS_TESTIDS.REQUIREMENTS_METRIC_TOTAL} label={t('requisitos', 'metricTotal')} value={num(metrics.total)} aux={aux(t('requisitos', 'metricTotalAux', { n: validated }))} />
      <Metric
        testID={REQUISITOS_TESTIDS.REQUIREMENTS_METRIC_COVERAGE}
        label={t('requisitos', 'metricCoverage')}
        value={loading ? '…' : `${metrics.coveragePercent} %`}
        percent={loading ? undefined : metrics.coveragePercent}
        aux={aux(t('requisitos', 'metricCoverageAux', { covered: metrics.covered, total: metrics.total }))}
      />
      <Metric testID={REQUISITOS_TESTIDS.REQUIREMENTS_METRIC_PENDING} label={t('requisitos', 'metricPending')} value={num(metrics.pending)} aux={aux(t('requisitos', 'metricPendingAux'))} />
      <Metric
        testID={REQUISITOS_TESTIDS.REQUIREMENTS_METRIC_NC}
        label={t('requisitos', 'metricNc')}
        value={num(metrics.ncOpen)}
        aux={aux(t('requisitos', 'metricNcAux', { n: metrics.ncRequirements }))}
      />
    </MetricGrid>
  );
};
