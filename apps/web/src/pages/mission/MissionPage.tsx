import { ApiError, MISION_DYNAMIC_TESTIDS, MISION_TESTIDS, can, percentOf, type MessageKey, type MissionEventDto, type MissionSummaryDto } from '@sigpro/shared';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { formatTrace } from '../../lib/errors';
import { useAuth } from '../../state/auth';
import { useConfig } from '../../state/config';
import { useI18n } from '../../state/i18n';
import { useLive, type LiveConnection } from '../../state/live';
import { useToast } from '../../state/toast';
import { InfoIcon } from '../../ui/icons';
import { Tooltip } from '../../ui/Tooltip';
import { MilestonesChart, NcSeverityChart } from './MissionCharts';
import { missionEventText } from './event-text';
import { bufferedCount, mergeFeed, visibleFeed } from './mission-view';

type MisionKey = MessageKey<'mision'>;
type KpiKey = 'programs' | 'milestones' | 'nc' | 'verification';

const SEVERITY_COLOR: Readonly<Record<MissionEventDto['severity'], string>> = {
  info: 'var(--info)',
  ok: 'var(--ok)',
  warn: 'var(--warn)',
  danger: 'var(--danger)',
};

const CONNECTION_COLOR: Readonly<Record<LiveConnection, string>> = { live: 'var(--ok)', connecting: 'var(--warn)', offline: 'var(--danger)' };

type SummaryState = { readonly status: 'loading' } | { readonly status: 'error'; readonly error: unknown } | { readonly status: 'ready'; readonly summary: MissionSummaryDto };

/** Resumen del panel (KPIs, gráficas e historial del feed). Se pide al entrar y al reintentar. */
const useMissionSummary = (): { state: SummaryState; reload: () => void } => {
  const { api } = useAuth();
  const [state, setState] = useState<SummaryState>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let alive = true;
    setState((current) => (current.status === 'ready' ? current : { status: 'loading' }));
    api.mission.summary().then(
      (summary) => alive && setState({ status: 'ready', summary }),
      (error: unknown) => alive && setState({ status: 'error', error }),
    );
    return () => {
      alive = false;
    };
  }, [api, attempt]);

  return { state, reload: useCallback(() => setAttempt((n) => n + 1), []) };
};

interface KpiProps {
  readonly id: KpiKey;
  readonly value: string;
  readonly sub: string;
  readonly loading: boolean;
}

/** Indicador clave: etiqueta, valor grande, detalle y un icono de información con tooltip que explica la métrica. */
const Kpi = ({ id, value, sub, loading }: KpiProps) => {
  const { t } = useI18n();
  const label = t('mision', `kpi_${id}` as MisionKey);
  return (
    <article data-testid={MISION_DYNAMIC_TESTIDS.MISSION_KPI(id)} aria-labelledby={`kpi-${id}-label`} aria-busy={loading} className="card flex min-w-0 flex-col gap-1.5 p-4">
      <div className="flex items-center gap-1.5">
        <h3 id={`kpi-${id}-label`} className="m-0 text-[12.5px] font-medium text-fg-2">
          {label}
        </h3>
        <Tooltip id={`kpi-${id}-tip`} text={t('mision', `kpiTip_${id}` as MisionKey)} testId={MISION_DYNAMIC_TESTIDS.MISSION_KPI_TOOLTIP(id)}>
          <button type="button" data-testid={MISION_DYNAMIC_TESTIDS.MISSION_KPI_INFO(id)} aria-label={t('mision', 'kpiInfo', { kpi: label })} className="icon-btn !size-5 !text-fg-3">
            <InfoIcon size={12} />
          </button>
        </Tooltip>
      </div>
      {loading ? (
        <span className="skeleton h-8 w-20" />
      ) : (
        <div data-testid={MISION_DYNAMIC_TESTIDS.MISSION_KPI_VALUE(id)} aria-live="polite" className="text-[30px] leading-none font-semibold tracking-[-.01em]">
          {value}
        </div>
      )}
      <div className="text-[12px] text-fg-3">{loading ? ' ' : sub}</div>
    </article>
  );
};

/** Indicador de conexión en tiempo real con tooltip (icono de estado). */
const ConnectionBadge = ({ connection }: { connection: LiveConnection }) => {
  const { t } = useI18n();
  const label = t('mision', `connection_${connection}` as MisionKey);
  return (
    <div role="status" data-testid={MISION_TESTIDS.MISSION_CONNECTION} data-state={connection} className="flex items-center gap-1.5 rounded-full border border-border bg-surface py-0.5 pr-2.5 pl-1.5 text-[12px] font-medium">
      <Tooltip id="mission-connection-tip" text={t('mision', `connectionTip_${connection}` as MisionKey)} testId={MISION_TESTIDS.MISSION_CONNECTION_TOOLTIP}>
        <button type="button" aria-label={label} className="grid size-5 cursor-help place-items-center border-0 bg-transparent p-0">
          <span aria-hidden="true" className="size-2 rounded-full" style={{ background: CONNECTION_COLOR[connection], boxShadow: connection === 'live' ? '0 0 0 3px var(--ok-soft)' : undefined }} />
        </button>
      </Tooltip>
      {label}
    </div>
  );
};

export const MissionPage = () => {
  const { t, lang } = useI18n();
  const { api, user } = useAuth();
  const toast = useToast();
  const { plantedBugs } = useConfig();
  const live = useLive();
  const { state, reload } = useMissionSummary();
  const [pausedAtSeq, setPausedAtSeq] = useState<number | null>(null);
  const [simulating, setSimulating] = useState(false);

  const summary = state.status === 'ready' ? state.summary : null;
  const feed = useMemo(() => mergeFeed(live.events, summary?.recent ?? []), [live.events, summary]);
  const shown = visibleFeed(feed, pausedAtSeq);
  const waiting = bufferedCount(feed, pausedAtSeq);
  const canSimulate = user ? can(user.role, 'users.manage') : false;
  const loading = state.status === 'loading';

  const simulate = async () => {
    setSimulating(true);
    try {
      await api.mission.tick();
    } catch (failure) {
      toast.push('danger', t('common', 'genericError'), formatTrace(failure) || (failure instanceof ApiError ? failure.message : t('common', 'networkError')));
    } finally {
      setSimulating(false);
    }
  };

  const time = (iso: string): string => new Date(iso).toLocaleTimeString(lang === 'es' ? 'es-ES' : 'en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  // KPI de NC abiertas: sigue los eventos `nc_*` que llegan por WebSocket. Defecto plantado (PLANTED_BUGS): el contador
  // del panel ignora esos eventos y solo se actualiza al recargar.
  const ncOpen = summary ? (plantedBugs ? summary.kpis.ncOpen : (live.ncOpen ?? summary.kpis.ncOpen)) : 0;
  const kpis = summary?.kpis;
  const milestonesPct = kpis ? percentOf(kpis.milestonesDone, kpis.milestonesTotal) : 0;

  return (
    <div data-testid={MISION_TESTIDS.MISSION_PAGE} className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <h1 className="page-title">{t('mision', 'title')}</h1>
          <p className="m-0 text-[12.5px] text-fg-2">{t('mision', 'subtitle')}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ConnectionBadge connection={live.connection} />
          <button
            type="button"
            data-testid={MISION_TESTIDS.MISSION_SIMULATE}
            onClick={() => void simulate()}
            disabled={!canSimulate || simulating}
            aria-busy={simulating}
            title={canSimulate ? undefined : t('mision', 'simulateDenied')}
            className="btn btn-secondary !h-8 !px-3"
          >
            {t('mision', 'simulate')}
          </button>
        </div>
      </div>

      {state.status === 'error' ? (
        <div role="alert" data-testid={MISION_TESTIDS.MISSION_ERROR} className="alert alert-danger flex flex-wrap items-center justify-between gap-3 !px-3.5 !py-3">
          <div>
            <div className="font-semibold">{t('mision', 'errorTitle')}</div>
            <div className="trace !text-[12.5px]">{state.error instanceof ApiError ? formatTrace(state.error) : t('common', 'networkError')}</div>
          </div>
          <button type="button" data-testid={MISION_TESTIDS.MISSION_ERROR_RETRY} onClick={reload} className="btn btn-danger-outline !h-[30px] !px-3">
            {t('mision', 'retry')}
          </button>
        </div>
      ) : null}

      <section aria-label={t('mision', 'kpisLabel')} data-testid={MISION_TESTIDS.MISSION_KPIS} aria-busy={loading} className="grid grid-cols-2 gap-3 min-[1100px]:grid-cols-4">
        <Kpi id="programs" loading={loading} value={String(kpis?.activePrograms ?? 0)} sub={t('mision', 'kpi_programs_sub', { total: kpis?.programsTotal ?? 0 })} />
        <Kpi id="milestones" loading={loading} value={`${milestonesPct} %`} sub={t('mision', 'kpi_milestones_sub', { done: kpis?.milestonesDone ?? 0, total: kpis?.milestonesTotal ?? 0 })} />
        <Kpi id="nc" loading={loading} value={String(ncOpen)} sub={t('mision', 'kpi_nc_sub', { total: kpis?.ncTotal ?? 0 })} />
        <Kpi id="verification" loading={loading} value={`${kpis?.verificationPass ?? 0} %`} sub={t('mision', 'kpi_verification_sub', { cases: kpis?.casesWithRuns ?? 0 })} />
      </section>

      {summary ? (
        <div className="grid gap-3 min-[1100px]:grid-cols-[3fr_2fr]">
          <MilestonesChart bars={summary.milestonesByProgram} />
          <NcSeverityChart counts={live.ncBySeverity ?? summary.ncBySeverity} />
        </div>
      ) : loading ? (
        <div aria-busy="true" className="grid gap-3 min-[1100px]:grid-cols-[3fr_2fr]">
          <span className="skeleton h-[250px] !rounded-card" />
          <span className="skeleton h-[250px] !rounded-card" />
        </div>
      ) : null}

      <section aria-labelledby="mission-feed-title" className="card flex min-w-0 flex-col gap-2 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-baseline gap-3">
            <h2 id="mission-feed-title" className="section-title">
              {t('mision', 'feedTitle')}
            </h2>
            <span data-testid={MISION_TESTIDS.MISSION_FEED_COUNT} aria-live="polite" className="font-mono text-[12px] text-fg-3">
              {t('mision', 'feedCount', { count: shown.length })}
            </span>
          </div>
          <button
            type="button"
            data-testid={MISION_TESTIDS.MISSION_PAUSE}
            aria-pressed={pausedAtSeq !== null}
            onClick={() => setPausedAtSeq((current) => (current === null ? (feed[0]?.seq ?? 0) : null))}
            className="btn btn-ghost !h-7 !px-2.5 !text-[12px]"
          >
            {pausedAtSeq === null ? t('mision', 'pause') : t('mision', 'resume')}
          </button>
        </div>
        {pausedAtSeq !== null ? (
          <p data-testid={MISION_TESTIDS.MISSION_FEED_PAUSED_NOTE} role="status" className="m-0 text-[12px] text-fg-2">
            {t('mision', 'pausedNote')} {waiting > 0 ? t('mision', 'buffered', { count: waiting }) : null}
          </p>
        ) : null}
        <ol aria-label={t('mision', 'feedLabel')} data-testid={MISION_TESTIDS.MISSION_FEED} aria-busy={loading} className="m-0 flex max-h-[360px] list-none flex-col overflow-y-auto rounded-card border border-border p-0">
          {shown.length === 0 ? (
            <li data-testid={MISION_TESTIDS.MISSION_FEED_EMPTY} className="px-3 py-8 text-center text-[12.5px] text-fg-3">
              {t('mision', 'feedEmpty')}
            </li>
          ) : (
            shown.map((event) => {
              const severityLabel = t('mision', `severity_${event.severity}` as MisionKey);
              return (
                <li
                  key={event.id}
                  data-testid={MISION_DYNAMIC_TESTIDS.MISSION_EVENT(event.seq)}
                  data-type={event.type}
                  data-severity={event.severity}
                  data-origin={event.origin}
                  className="flex items-center gap-3 border-b border-border px-3 py-2 last:border-b-0"
                  style={{ animation: 'toastIn .18s ease-out' }}
                >
                  <time dateTime={event.at} className="w-[68px] flex-none font-mono text-[11.5px] text-fg-3">
                    {time(event.at)}
                  </time>
                  <span title={severityLabel} className="flex flex-none items-center">
                    <span aria-hidden="true" className="size-2 rounded-full" style={{ background: SEVERITY_COLOR[event.severity] }} />
                    <span className="sr-only">{severityLabel}</span>
                  </span>
                  <span className="min-w-0 flex-1 text-[12.5px]">{missionEventText(event, t)}</span>
                  <span className="hidden flex-none rounded-full border border-border px-2 py-px text-[11px] text-fg-3 sm:inline">{t('mision', `origin_${event.origin}` as MisionKey)}</span>
                </li>
              );
            })
          )}
        </ol>
      </section>
    </div>
  );
};
