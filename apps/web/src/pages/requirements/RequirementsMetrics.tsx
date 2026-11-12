import { REQUISITOS_TESTIDS, requirementMetrics, type RequirementDto } from '@sigpro/shared';
import { useMemo } from 'react';
import { useI18n } from '../../state/i18n';
import { Metric } from '../../ui/Metric';

/**
 * Cuatro tarjetas con las cifras del programa: requisitos, cobertura de verificación, pendientes de aprobación y NC abiertas.
 * Salen de la lista ya cargada (sin peticiones) y no dependen de los filtros de la tabla. Los textos auxiliares evitan
 * repetir «N de M requisitos…», que otras partes de la pantalla (contador, leyenda de la matriz) ya usan.
 */
export const RequirementsMetrics = ({ items, loading }: { readonly items: readonly RequirementDto[]; readonly loading: boolean }) => {
  const { t } = useI18n();
  const metrics = useMemo(() => requirementMetrics(items), [items]);
  const validated = useMemo(() => items.filter((item) => item.state === 'validated').length, [items]);
  const pending = loading ? '…' : '';
  const num = (value: number): string => (loading ? '…' : String(value));

  return (
    <section aria-label={t('requisitos', 'metricsLabel')} aria-busy={loading} data-testid={REQUISITOS_TESTIDS.REQUIREMENTS_METRICS} className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      <Metric testId={REQUISITOS_TESTIDS.REQUIREMENTS_METRIC_TOTAL} label={t('requisitos', 'metricTotal')} value={num(metrics.total)} aux={loading ? pending : t('requisitos', 'metricTotalAux', { n: validated })} />
      <Metric
        testId={REQUISITOS_TESTIDS.REQUIREMENTS_METRIC_COVERAGE}
        label={t('requisitos', 'metricCoverage')}
        value={loading ? '…' : `${metrics.coveragePercent} %`}
        percent={loading ? undefined : metrics.coveragePercent}
        aux={loading ? pending : t('requisitos', 'metricCoverageAux', { covered: metrics.covered, total: metrics.total })}
      />
      <Metric testId={REQUISITOS_TESTIDS.REQUIREMENTS_METRIC_PENDING} label={t('requisitos', 'metricPending')} value={num(metrics.pending)} aux={loading ? pending : t('requisitos', 'metricPendingAux')} />
      <Metric
        testId={REQUISITOS_TESTIDS.REQUIREMENTS_METRIC_NC}
        label={t('requisitos', 'metricNc')}
        value={num(metrics.ncOpen)}
        aux={loading ? pending : t('requisitos', 'metricNcAux', { n: metrics.ncRequirements })}
      />
    </section>
  );
};
