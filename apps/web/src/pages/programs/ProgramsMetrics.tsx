import { PROGRAMAS_TESTIDS, percentOf, type MissionKpis } from '@sigpro/shared';
import { useEffect, useState } from 'react';
import { useAuth } from '../../state/auth';
import { useI18n } from '../../state/i18n';
import { useLiveCore } from '../../state/live';
import { Metric } from '../../ui/Metric';

/**
 * Cuatro tarjetas con las cifras del tenant: programas, activos, avance medio y NC abiertas. No dependen de los filtros de
 * la tabla. Salen del resumen de Misión (una petición); las NC abiertas se mantienen al día con el tiempo real.
 * `refreshKey` cambia cuando la tabla muta datos (alta, archivar, borrar…).
 */
export const ProgramsMetrics = ({ refreshKey }: { readonly refreshKey: number }) => {
  const { t } = useI18n();
  const { api } = useAuth();
  const { ncOpen } = useLiveCore();
  const [kpis, setKpis] = useState<MissionKpis | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    setFailed(false);
    api.mission.summary().then(
      (summary) => alive && setKpis(summary.kpis),
      () => alive && setFailed(true),
    );
    return () => {
      alive = false;
    };
  }, [api, refreshKey]);

  // Cargando: «…»; si el resumen falla, «—» (la tabla de debajo sigue funcionando)
  const placeholder = failed ? '—' : '…';
  const num = (value: number | undefined): string => (value === undefined ? placeholder : String(value));
  const total = kpis?.programsTotal;
  const active = kpis?.activePrograms;
  const progress = kpis?.programsProgress;
  const open = ncOpen ?? kpis?.ncOpen;

  return (
    <section aria-label={t('programas', 'metricsLabel')} aria-busy={kpis === null && !failed} data-testid={PROGRAMAS_TESTIDS.PROGRAMS_METRICS} className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      <Metric
        testId={PROGRAMAS_TESTIDS.PROGRAMS_METRIC_TOTAL}
        label={t('programas', 'metricTotal')}
        value={num(total)}
        aux={active === undefined ? placeholder : t('programas', 'metricTotalAux', { n: active })}
      />
      <Metric
        testId={PROGRAMAS_TESTIDS.PROGRAMS_METRIC_ACTIVE}
        label={t('programas', 'metricActive')}
        value={num(active)}
        aux={active === undefined || total === undefined ? placeholder : t('programas', 'metricActiveAux', { pct: percentOf(active, total) })}
      />
      <Metric
        testId={PROGRAMAS_TESTIDS.PROGRAMS_METRIC_PROGRESS}
        label={t('programas', 'metricProgress')}
        value={progress === undefined ? placeholder : `${progress} %`}
        percent={progress}
        aux={kpis === null ? placeholder : t('programas', 'metricProgressAux', { done: kpis.milestonesDone, total: kpis.milestonesTotal })}
      />
      <Metric
        testId={PROGRAMAS_TESTIDS.PROGRAMS_METRIC_NC}
        label={t('programas', 'metricNc')}
        value={num(open)}
        aux={kpis === null ? placeholder : t('programas', 'metricNcAux', { total: kpis.ncTotal })}
      />
    </section>
  );
};
