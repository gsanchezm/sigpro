import { ADMIN_TESTIDS, type ChaosConfig } from '@sigpro/shared';
import { useCallback, useEffect, useState } from 'react';
import { formatTrace } from '../../lib/errors';
import { useAuth } from '../../state/auth';
import { useConfig, useSaveLabel } from '../../state/config';
import { useI18n } from '../../state/i18n';
import { useToast } from '../../state/toast';
import { RangeSlider } from '../../ui/RangeSlider';
import { Spinner } from '../../ui/Spinner';
import { Switch } from '../../ui/Switch';
import { isChaosActive, toPercent } from './admin-view';

const LATENCY_MAX = 5000;
const LATENCY_STEP = 100;
const ERROR_STEP = 5;
const NO_CHAOS: ChaosConfig = { latencyMs: 0, errorRate: 0, flakyLabels: false };

const sameConfig = (a: ChaosConfig, b: ChaosConfig): boolean => a.latencyMs === b.latencyMs && toPercent(a.errorRate) === toPercent(b.errorRate) && a.flakyLabels === b.flakyLabels;

type LoadState = { readonly status: 'loading' } | { readonly status: 'error'; readonly error: unknown } | { readonly status: 'ready' };

/**
 * Modo caos del tenant: latencia aleatoria 0–N ms, % de errores 500 en escrituras y textos de botón alternos.
 * Se guarda por tenant con `PATCH /api/admin/chaos`; tras aplicar, la web relee la configuración para alternar etiquetas.
 */
export const ChaosPanel = () => {
  const { t } = useI18n();
  const { api } = useAuth();
  const { refresh } = useConfig();
  const toast = useToast();
  const previewLabel = useSaveLabel();
  const [load, setLoad] = useState<LoadState>({ status: 'loading' });
  const [saved, setSaved] = useState<ChaosConfig>(NO_CHAOS);
  const [draft, setDraft] = useState<ChaosConfig>(NO_CHAOS);
  const [busy, setBusy] = useState(false);

  const read = useCallback(() => {
    setLoad({ status: 'loading' });
    api.admin.getChaos().then(
      (config) => {
        setSaved(config);
        setDraft(config);
        setLoad({ status: 'ready' });
      },
      (error: unknown) => setLoad({ status: 'error', error }),
    );
  }, [api]);

  useEffect(read, [read]);

  const persist = async (next: ChaosConfig) => {
    setBusy(true);
    try {
      const stored = await api.admin.setChaos(next);
      setSaved(stored);
      setDraft(stored);
      await refresh();
      toast.push('ok', t('admin', 'chaosApplied'), t('admin', 'chaosAppliedBody', { latency: stored.latencyMs, errors: toPercent(stored.errorRate), flaky: t('admin', stored.flakyLabels ? 'yes' : 'no') }));
    } catch (failure) {
      toast.push('danger', t('common', 'genericError'), formatTrace(failure) || t('common', 'networkError'));
    } finally {
      setBusy(false);
    }
  };

  if (load.status === 'loading') {
    return (
      <section aria-busy="true" role="status" className="card flex max-w-[640px] flex-col gap-3 p-4">
        <span className="skeleton h-5 w-40" />
        <span className="skeleton h-8 w-full" />
        <span className="skeleton h-8 w-full" />
        <span className="sr-only">{t('admin', 'chaosLoading')}</span>
      </section>
    );
  }

  if (load.status === 'error') {
    return (
      <div role="alert" className="alert alert-danger flex max-w-[640px] flex-wrap items-center justify-between gap-3 !px-3.5 !py-3">
        <div>
          <div className="font-semibold">{t('admin', 'chaosErrorTitle')}</div>
          <div className="trace !text-[12.5px]">{formatTrace(load.error) || t('common', 'networkError')}</div>
        </div>
        <button type="button" onClick={read} className="btn btn-danger-outline !h-[30px] !px-3">
          {t('admin', 'retry')}
        </button>
      </div>
    );
  }

  const dirty = !sameConfig(draft, saved);
  const active = isChaosActive(saved);
  const errorPercent = toPercent(draft.errorRate);

  return (
    <section data-testid={ADMIN_TESTIDS.ADMIN_CHAOS_PANEL} aria-labelledby="admin-chaos-title" className="card flex max-w-[640px] flex-col gap-4 p-4">
      <div className="flex flex-col gap-1">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="admin-chaos-title" className="m-0 text-[15px] font-semibold">
            {t('admin', 'chaosTitle')}
          </h2>
          <span data-testid={ADMIN_TESTIDS.ADMIN_CHAOS_STATUS} data-active={active} className="badge badge-row" data-tone={active ? 'warn' : 'neutral'}>
            {t('admin', active ? 'chaosStatusOn' : 'chaosStatusOff')}
          </span>
        </div>
        <p className="m-0 text-[12.5px] text-fg-2">{t('admin', 'chaosHint')}</p>
      </div>

      <div className="flex flex-col gap-1.5">
        <div className="flex items-baseline justify-between">
          <label htmlFor="admin-chaos-latency" className="label">
            {t('admin', 'chaosLatency')}
          </label>
          <span data-testid={ADMIN_TESTIDS.ADMIN_CHAOS_LATENCY_VALUE} className="font-mono text-[12px]">
            {t('admin', 'chaosLatencyValue', { value: draft.latencyMs })}
          </span>
        </div>
        <RangeSlider
          id="admin-chaos-latency"
          testId={ADMIN_TESTIDS.ADMIN_CHAOS_LATENCY}
          min={0}
          max={LATENCY_MAX}
          step={LATENCY_STEP}
          value={draft.latencyMs}
          valueText={t('admin', 'chaosLatencyValue', { value: draft.latencyMs })}
          disabled={busy}
          title={busy ? t('common', 'processing') : undefined}
          onChange={(latencyMs) => setDraft((current) => ({ ...current, latencyMs }))}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <div className="flex items-baseline justify-between">
          <label htmlFor="admin-chaos-errors" className="label">
            {t('admin', 'chaosErrors')}
          </label>
          <span data-testid={ADMIN_TESTIDS.ADMIN_CHAOS_ERRORS_VALUE} className="font-mono text-[12px]">
            {t('admin', 'chaosErrorsValue', { value: errorPercent })}
          </span>
        </div>
        <RangeSlider
          id="admin-chaos-errors"
          testId={ADMIN_TESTIDS.ADMIN_CHAOS_ERRORS}
          min={0}
          max={100}
          step={ERROR_STEP}
          value={errorPercent}
          valueText={t('admin', 'chaosErrorsValue', { value: errorPercent })}
          disabled={busy}
          title={busy ? t('common', 'processing') : undefined}
          onChange={(percent) => setDraft((current) => ({ ...current, errorRate: percent / 100 }))}
        />
      </div>

      <div className="flex items-center gap-3">
        <Switch
          id="admin-chaos-flaky"
          testId={ADMIN_TESTIDS.ADMIN_CHAOS_FLAKY}
          labelledBy="admin-chaos-flaky-label"
          checked={draft.flakyLabels}
          disabled={busy}
          title={busy ? t('common', 'processing') : undefined}
          onChange={(flakyLabels) => setDraft((current) => ({ ...current, flakyLabels }))}
        />
        <span id="admin-chaos-flaky-label" className="text-[12.5px]">
          {t('admin', 'chaosFlaky')}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          data-testid={ADMIN_TESTIDS.ADMIN_CHAOS_APPLY}
          onClick={() => void persist(draft)}
          disabled={!dirty || busy}
          aria-busy={busy}
          title={busy ? t('common', 'processing') : !dirty ? t('perfil', 'noChanges') : undefined}
          className="btn btn-primary"
        >
          {busy ? <Spinner /> : null}
          {t('admin', 'chaosApply')}
        </button>
        <button
          type="button"
          data-testid={ADMIN_TESTIDS.ADMIN_CHAOS_OFF}
          onClick={() => void persist(NO_CHAOS)}
          disabled={(!active && !dirty) || busy}
          title={busy ? t('common', 'processing') : !active && !dirty ? t('admin', 'chaosStatusOff') : undefined}
          className="btn btn-secondary"
        >
          {t('admin', 'chaosOff')}
        </button>
        {dirty ? <span className="text-[12px] text-warn">{t('admin', 'chaosUnsaved')}</span> : null}
      </div>

      <div className="flex flex-col gap-1.5 border-t border-border pt-3">
        <div className="label">{t('admin', 'chaosPreview')}</div>
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            data-testid={ADMIN_TESTIDS.ADMIN_CHAOS_PREVIEW}
            onClick={() => toast.push('info', t('admin', 'chaosPreviewClicked', { label: previewLabel }))}
            className="btn btn-primary"
          >
            {previewLabel}
          </button>
          <span className="text-[12px] text-fg-3">{t('admin', 'chaosPreviewHint')}</span>
        </div>
      </div>
    </section>
  );
};
