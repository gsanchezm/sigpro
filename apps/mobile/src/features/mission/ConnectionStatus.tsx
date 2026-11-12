import { MISION_TESTIDS, type MessageKey } from '@sigpro/shared';
import { StyleSheet, View } from 'react-native';
import { useI18n } from '../../state/i18n';
import { useTheme } from '../../state/theme';
import { Text } from '../../ui/Text';
import { toneColors, type Tone } from '../../theme/tokens';
import type { MissionConnection } from './mission-socket';

type MisionKey = MessageKey<'mision'>;

const CONNECTION_LABEL: Readonly<Record<MissionConnection, MisionKey>> = {
  connected: 'connection_live',
  connecting: 'connection_connecting',
  disconnected: 'connection_offline',
};

const CONNECTION_TONE: Readonly<Record<MissionConnection, Tone>> = {
  connected: 'ok',
  connecting: 'warn',
  disconnected: 'danger',
};

/** Indicador de conexión: `role="status"`, `data-state` = connected | connecting | disconnected y el texto visible. */
export const ConnectionStatus = ({ connection }: { readonly connection: MissionConnection }) => {
  const { t } = useI18n();
  const { colors } = useTheme();
  const dot = toneColors(colors, CONNECTION_TONE[connection]).fg;
  return (
    <View testID={MISION_TESTIDS.MISSION_CONNECTION} role="status" aria-live="polite" dataSet={{ state: connection }} style={[styles.pill, { borderColor: colors.border, backgroundColor: colors.surface }]}>
      <View aria-hidden style={[styles.dot, { backgroundColor: dot }]} />
      <Text variant="small" weight="500">
        {t('mision', CONNECTION_LABEL[connection])}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  pill: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderRadius: 999, paddingVertical: 4, paddingLeft: 8, paddingRight: 10 },
  dot: { width: 8, height: 8, borderRadius: 4 },
});
