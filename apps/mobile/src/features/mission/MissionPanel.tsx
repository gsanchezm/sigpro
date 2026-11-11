import { MISION_TESTIDS, can, formatTrace, type MissionEventDto } from '@sigpro/shared';
import { useCallback, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useResource } from '../../lib/resource';
import { useAuth } from '../../state/auth';
import { useI18n } from '../../state/i18n';
import { useToast } from '../../state/toast';
import { Button } from '../../ui/Button';
import { Screen } from '../../ui/Screen';
import { ErrorState, LoadingState } from '../../ui/States';
import { Text } from '../../ui/Text';
import { ConnectionStatus } from './ConnectionStatus';
import { EventFeed } from './EventFeed';
import { KpiCards } from './KpiCards';
import { MissionCharts } from './MissionCharts';
import { bufferedCount, mergeFeed, pushLiveEvent, visibleFeed } from './feed';
import { EMPTY_KPIS, EMPTY_NC, NO_LIVE_NC, applyNcEvent, displayedNc, kpiCards, type LiveNc } from './kpis';
import { MOVIL_MISSION_TESTIDS } from './testids';
import { useMissionTexts } from './texts';
import { useMissionSocket } from './use-mission-socket';

/**
 * Panel de misión (`/mission`): KPIs, gráficas del resumen y feed en directo por Socket.IO. Los `nc_*` aplican sus cifras
 * en cuanto llegan; la pausa solo congela el feed (los KPIs y la gráfica de NC siguen al día).
 */
export const MissionPanel = () => {
  const { t } = useI18n();
  const { api, user } = useAuth();
  const toast = useToast();
  const texts = useMissionTexts();
  const summary = useResource(() => api.mission.summary(), [api]);
  const [ring, setRing] = useState<readonly MissionEventDto[]>([]);
  const [live, setLive] = useState<LiveNc>(NO_LIVE_NC);
  const [pausedAtSeq, setPausedAtSeq] = useState<number | null>(null);
  const [simulating, setSimulating] = useState(false);
  const { reload: reloadSummary } = summary;

  const ingest = useCallback(
    (event: MissionEventDto) => {
      setRing((current) => pushLiveEvent(current, event));
      setLive((current) => applyNcEvent(current, event));
      // Un hito real cambia el KPI y la barra de su programa; el evento no trae esas cifras, así que se piden de nuevo
      if (event.type === 'milestone' && event.origin === 'system') reloadSummary();
    },
    [reloadSummary],
  );

  // Tras una caída, el resumen es la fuente de verdad: se pide de nuevo y se descartan las cifras en vivo anteriores
  const resync = useCallback(() => {
    setLive(NO_LIVE_NC);
    reloadSummary();
  }, [reloadSummary]);

  const { connection, reconnect } = useMissionSocket(ingest, resync);

  const data = summary.data;
  const failed = summary.error !== null && data === null;
  const nc = data ? displayedNc(data, live) : null;
  const feed = useMemo(() => mergeFeed(ring, data?.recent ?? []), [ring, data]);
  const shown = visibleFeed(feed, pausedAtSeq);
  const waiting = bufferedCount(feed, pausedAtSeq);
  const latestSeq = feed[0]?.seq ?? 0;
  const canSimulate = user ? can(user.role, 'users.manage') : false;

  const togglePause = () => setPausedAtSeq((current) => (current === null ? latestSeq : null));

  const simulate = async () => {
    setSimulating(true);
    try {
      const { event } = await api.mission.tick();
      ingest(event);
      toast.push('ok', t('mision', 'simulated'));
    } catch (failure) {
      toast.push('danger', t('common', 'genericError'), formatTrace(failure) || t('common', 'networkError'));
    } finally {
      setSimulating(false);
    }
  };

  return (
    <Screen title={t('mision', 'title')} subtitle={t('mision', 'subtitle')} testID={MISION_TESTIDS.MISSION_PAGE} right={<ConnectionStatus connection={connection} />}>
      {summary.error !== null ? (
        <ErrorState testID={MISION_TESTIDS.MISSION_ERROR} retryTestID={MISION_TESTIDS.MISSION_ERROR_RETRY} title={t('mision', 'errorTitle')} trace={summary.error} onRetry={summary.reload} />
      ) : null}

      {failed ? null : <KpiCards cards={kpiCards(data?.kpis ?? EMPTY_KPIS, nc ?? EMPTY_NC, t)} busy={summary.loading} pending={data === null} />}
      {data && nc ? <MissionCharts bars={data.milestonesByProgram} ncBySeverity={nc.ncBySeverity} /> : null}
      {!data && !failed ? <LoadingState testID={MOVIL_MISSION_TESTIDS.MISSION_CHARTS_LOADING} /> : null}

      <View testID={MOVIL_MISSION_TESTIDS.MISSION_CONTROLS} style={styles.controls}>
        <Button
          label={texts.emit}
          testID={MISION_TESTIDS.MISSION_SIMULATE}
          variant="primary"
          busy={simulating}
          disabled={!canSimulate}
          disabledReason={t('mision', 'simulateDenied')}
          onPress={() => void simulate()}
        />
        {canSimulate ? null : (
          <Text testID={MOVIL_MISSION_TESTIDS.MISSION_SIMULATE_REASON} variant="small" tone="muted">
            {t('mision', 'simulateDenied')}
          </Text>
        )}
      </View>

      <EventFeed
        events={shown}
        paused={pausedAtSeq !== null}
        waiting={waiting}
        loading={summary.loading}
        connection={connection}
        onTogglePause={togglePause}
        onReconnect={reconnect}
      />
    </Screen>
  );
};

const styles = StyleSheet.create({
  controls: { gap: 6 },
});
