import { MISION_DYNAMIC_TESTIDS, MISION_TESTIDS, type MessageKey, type MissionEventDto, type MissionSeverity } from '@sigpro/shared';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useI18n } from '../../state/i18n';
import { useTheme } from '../../state/theme';
import { Button } from '../../ui/Button';
import { Card } from '../../ui/Card';
import { EmptyState } from '../../ui/States';
import { Text } from '../../ui/Text';
import { ToggleButton } from '../../ui/ToggleButton';
import { RADIUS, toneColors } from '../../theme/tokens';
import { EVENT_GLYPH, SEVERITY_TONE, missionEventText } from './event-text';
import type { MissionConnection } from './mission-socket';
import { MOVIL_MISSION_TESTIDS } from './testids';

type MisionKey = MessageKey<'mision'>;

const SEVERITY_LABEL: Readonly<Record<MissionSeverity, MisionKey>> = {
  info: 'severity_info',
  ok: 'severity_ok',
  warn: 'severity_warn',
  danger: 'severity_danger',
};

const CONNECTION_TIP: Readonly<Record<MissionConnection, MisionKey>> = {
  connected: 'connectionTip_live',
  connecting: 'connectionTip_connecting',
  disconnected: 'connectionTip_offline',
};

interface Props {
  /** Eventos visibles (con el feed en pausa, los que había al pausar). */
  readonly events: readonly MissionEventDto[];
  readonly paused: boolean;
  /** Eventos recibidos durante la pausa. */
  readonly waiting: number;
  readonly loading: boolean;
  readonly connection: MissionConnection;
  readonly onTogglePause: () => void;
  readonly onReconnect: () => void;
}

/** Feed en directo: lista de eventos (más reciente primero), pausa/reanudar y el aviso de conexión con su reintento. */
export const EventFeed = ({ events, paused, waiting, loading, connection, onTogglePause, onReconnect }: Props) => {
  const { t } = useI18n();
  const { colors } = useTheme();

  return (
    <Card role="region" aria-label={t('mision', 'feedTitle')}>
      <View style={styles.head}>
        <View style={styles.headText}>
          <Text variant="heading">{t('mision', 'feedTitle')}</Text>
          <Text testID={MISION_TESTIDS.MISSION_FEED_COUNT} aria-live="polite" variant="mono" tone="faint">
            {t('mision', 'feedCount', { count: events.length })}
          </Text>
        </View>
        <ToggleButton testID={MISION_TESTIDS.MISSION_PAUSE} label={paused ? t('mision', 'resume') : t('mision', 'pause')} pressed={paused} onPress={onTogglePause} />
      </View>

      <Text testID={MISION_TESTIDS.MISSION_CONNECTION_TOOLTIP} variant="small" tone="muted">
        {t('mision', CONNECTION_TIP[connection])}
      </Text>
      {connection === 'disconnected' ? (
        <Button label={t('mision', 'retry')} testID={MOVIL_MISSION_TESTIDS.MISSION_CONNECTION_RETRY} variant="secondary" onPress={onReconnect} />
      ) : null}

      {paused ? (
        <Text testID={MISION_TESTIDS.MISSION_FEED_PAUSED_NOTE} role="status" variant="small" tone="muted">
          {waiting > 0 ? `${t('mision', 'pausedNote')} ${t('mision', 'buffered', { count: waiting })}` : t('mision', 'pausedNote')}
        </Text>
      ) : null}

      {events.length === 0 ? <EmptyState testID={MISION_TESTIDS.MISSION_FEED_EMPTY} title={t('mision', 'feedEmpty')} /> : null}
      <ScrollView style={[styles.scroll, { borderColor: colors.border }]} nestedScrollEnabled>
        <View testID={MISION_TESTIDS.MISSION_FEED} role="list" aria-label={t('mision', 'feedLabel')} aria-busy={loading}>
          {events.map((event) => (
            <EventRow key={event.id} event={event} />
          ))}
        </View>
      </ScrollView>
    </Card>
  );
};

/** Una línea del feed: icono con el tono de la severidad, texto, hora y número de secuencia. */
const EventRow = ({ event }: { readonly event: MissionEventDto }) => {
  const { t, lang } = useI18n();
  const { colors } = useTheme();
  const tone = toneColors(colors, SEVERITY_TONE[event.severity]);
  const time = new Date(event.at).toLocaleTimeString(lang === 'es' ? 'es-ES' : 'en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  return (
    <View
      testID={MISION_DYNAMIC_TESTIDS.MISSION_EVENT(event.seq)}
      role="listitem"
      dataSet={{ type: event.type, severity: event.severity, origin: event.origin }}
      style={[styles.row, { borderBottomColor: colors.border }]}
    >
      <View role="img" aria-label={t('mision', SEVERITY_LABEL[event.severity])} style={[styles.icon, { backgroundColor: tone.bg, borderColor: tone.fg }]}>
        <Text aria-hidden variant="label" style={{ color: tone.fg, lineHeight: 16 }}>
          {EVENT_GLYPH[event.type]}
        </Text>
      </View>
      <View style={styles.body}>
        <Text variant="body" style={styles.text}>
          {missionEventText(event, t)}
        </Text>
        <Text variant="small" tone="faint">
          {time}
        </Text>
      </View>
      <Text variant="mono" tone="faint" style={styles.seq}>
        {`#${event.seq}`}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  headText: { flex: 1, minWidth: 0, gap: 2 },
  scroll: { maxHeight: 360, borderWidth: 1, borderRadius: RADIUS.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 10, paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth },
  icon: { width: 26, height: 26, borderRadius: 13, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  body: { flex: 1, minWidth: 0, gap: 2 },
  text: { flexShrink: 1 },
  seq: { fontSize: 11 },
});
