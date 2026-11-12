import { formatTrace, type ChaosConfig } from '@sigpro/shared';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useResource } from '../../lib/resource';
import { useAuth } from '../../state/auth';
import { useI18n } from '../../state/i18n';
import { useTheme } from '../../state/theme';
import { useToast } from '../../state/toast';
import { Badge } from '../../ui/Badge';
import { Button } from '../../ui/Button';
import { Card } from '../../ui/Card';
import { ErrorState, LoadingState } from '../../ui/States';
import { StepSlider } from '../../ui/StepSlider';
import { SwitchField } from '../../ui/SwitchField';
import { Text } from '../../ui/Text';
import { useFlakyPhase } from './hooks';
import { ADMIN_TESTIDS, MOVIL_ADMIN_TESTIDS } from './testids';
import { ERROR_STEP, LATENCY_MAX, LATENCY_STEP, NO_CHAOS, isChaosActive, rateOf, sameConfig, toPercent, traceOr } from './view';

/**
 * Modo caos del tenant (web: `ChaosPanel`): latencia aleatoria 0–N ms, % de errores 500 en escrituras y textos de botón
 * alternos. Se guarda por tenant con `PATCH /api/admin/chaos` al pulsar «Aplicar» o «Apagar caos». Los deslizadores son de
 * pasos (− y +) con el rango y el paso de la web.
 */
export const ChaosPanel = () => {
  const { t } = useI18n();
  const { colors } = useTheme();
  const { api } = useAuth();
  const toast = useToast();
  const config = useResource(() => api.admin.getChaos(), [api]);
  const [saved, setSaved] = useState<ChaosConfig>(NO_CHAOS);
  const [draft, setDraft] = useState<ChaosConfig>(NO_CHAOS);
  const [busy, setBusy] = useState(false);
  const phase = useFlakyPhase(saved.flakyLabels);
  const { data } = config;

  // Cada lectura de la API fija lo guardado y el borrador
  useEffect(() => {
    if (!data) return;
    setSaved(data);
    setDraft(data);
  }, [data]);

  const persist = async (next: ChaosConfig) => {
    setBusy(true);
    try {
      const stored = await api.admin.setChaos(next);
      setSaved(stored);
      setDraft(stored);
      toast.push('ok', t('admin', 'chaosApplied'), t('admin', 'chaosAppliedBody', { latency: stored.latencyMs, errors: toPercent(stored.errorRate), flaky: t('admin', stored.flakyLabels ? 'yes' : 'no') }));
    } catch (failure) {
      toast.push('danger', t('common', 'genericError'), traceOr(formatTrace(failure), t('common', 'networkError')));
    } finally {
      setBusy(false);
    }
  };

  if (data === null && config.error === null) return <LoadingState testID={MOVIL_ADMIN_TESTIDS.CHAOS_LOADING} />;

  if (data === null) {
    return (
      <ErrorState
        testID={MOVIL_ADMIN_TESTIDS.CHAOS_ERROR}
        retryTestID={MOVIL_ADMIN_TESTIDS.CHAOS_ERROR_RETRY}
        title={t('admin', 'chaosErrorTitle')}
        trace={traceOr(config.error ?? '', t('common', 'networkError'))}
        onRetry={config.reload}
      />
    );
  }

  const dirty = !sameConfig(draft, saved);
  const active = isChaosActive(saved);
  const errorPercent = toPercent(draft.errorRate);
  // Motivo visible de un botón deshabilitado (la web lo lleva en `title`)
  const applyReason = busy ? t('common', 'processing') : !dirty ? t('perfil', 'noChanges') : undefined;
  const offReason = busy ? t('common', 'processing') : !active && !dirty ? t('admin', 'chaosStatusOff') : undefined;
  const previewLabel = saved.flakyLabels && phase === 1 ? t('common', 'saveAlt') : t('programas', 'save');

  return (
    <Card role="region" aria-label={t('admin', 'chaosTitle')} testID={ADMIN_TESTIDS.ADMIN_CHAOS_PANEL} style={styles.panel}>
      <View style={styles.head}>
        <Text variant="heading" role="heading" aria-level={2} style={styles.title}>
          {t('admin', 'chaosTitle')}
        </Text>
        <View testID={ADMIN_TESTIDS.ADMIN_CHAOS_STATUS} dataSet={{ active: String(active) }}>
          <Badge label={t('admin', active ? 'chaosStatusOn' : 'chaosStatusOff')} tone={active ? 'warn' : 'neutral'} />
        </View>
      </View>
      <Text variant="small" tone="muted">
        {t('admin', 'chaosHint')}
      </Text>

      <StepSlider
        label={t('admin', 'chaosLatency')}
        testID={ADMIN_TESTIDS.ADMIN_CHAOS_LATENCY}
        valueTestID={ADMIN_TESTIDS.ADMIN_CHAOS_LATENCY_VALUE}
        min={0}
        max={LATENCY_MAX}
        step={LATENCY_STEP}
        value={draft.latencyMs}
        valueText={t('admin', 'chaosLatencyValue', { value: draft.latencyMs })}
        disabled={busy}
        onChange={(latencyMs) => setDraft((current) => ({ ...current, latencyMs }))}
      />
      <StepSlider
        label={t('admin', 'chaosErrors')}
        testID={ADMIN_TESTIDS.ADMIN_CHAOS_ERRORS}
        valueTestID={ADMIN_TESTIDS.ADMIN_CHAOS_ERRORS_VALUE}
        min={0}
        max={100}
        step={ERROR_STEP}
        value={errorPercent}
        valueText={t('admin', 'chaosErrorsValue', { value: errorPercent })}
        disabled={busy}
        onChange={(percent) => setDraft((current) => ({ ...current, errorRate: rateOf(percent) }))}
      />
      <SwitchField
        label={t('admin', 'chaosFlaky')}
        value={draft.flakyLabels}
        onChange={(flakyLabels) => setDraft((current) => ({ ...current, flakyLabels }))}
        testID={ADMIN_TESTIDS.ADMIN_CHAOS_FLAKY}
        disabled={busy}
      />

      <View style={styles.actions}>
        <Button
          label={t('admin', 'chaosApply')}
          testID={ADMIN_TESTIDS.ADMIN_CHAOS_APPLY}
          variant="primary"
          onPress={() => void persist(draft)}
          disabled={!dirty || busy}
          disabledReason={applyReason}
          busy={busy}
        />
        <Button
          label={t('admin', 'chaosOff')}
          testID={ADMIN_TESTIDS.ADMIN_CHAOS_OFF}
          onPress={() => void persist(NO_CHAOS)}
          disabled={(!active && !dirty) || busy}
          disabledReason={offReason}
        />
      </View>
      {applyReason ? (
        <Text variant="small" tone="faint" testID={MOVIL_ADMIN_TESTIDS.CHAOS_APPLY_REASON}>
          {applyReason}
        </Text>
      ) : null}
      {offReason ? (
        <Text variant="small" tone="faint" testID={MOVIL_ADMIN_TESTIDS.CHAOS_OFF_REASON}>
          {offReason}
        </Text>
      ) : null}
      {dirty ? (
        <Text variant="small" testID={MOVIL_ADMIN_TESTIDS.CHAOS_UNSAVED} style={{ color: colors.warn }}>
          {t('admin', 'chaosUnsaved')}
        </Text>
      ) : null}

      <View style={[styles.preview, { borderTopColor: colors.border }]}>
        <Text variant="label" tone="muted">
          {t('admin', 'chaosPreview')}
        </Text>
        <Button
          label={previewLabel}
          testID={ADMIN_TESTIDS.ADMIN_CHAOS_PREVIEW}
          variant="primary"
          onPress={() => toast.push('info', t('admin', 'chaosPreviewClicked', { label: previewLabel }))}
        />
        <Text variant="small" tone="faint">
          {t('admin', 'chaosPreviewHint')}
        </Text>
      </View>
    </Card>
  );
};

const styles = StyleSheet.create({
  panel: { gap: 16 },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  title: { flex: 1 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  preview: { gap: 8, borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 12, alignItems: 'flex-start' },
});
