import { NC_SEVERITY_TONE, NC_DYNAMIC_TESTIDS, type NcDto } from '@sigpro/shared';
import { Pressable, StyleSheet, View } from 'react-native';
import { useI18n } from '../../state/i18n';
import { useTheme } from '../../state/theme';
import { toneColors } from '../../theme/tokens';
import { Avatar } from '../../ui/Avatar';
import { Badge } from '../../ui/Badge';
import { Card } from '../../ui/Card';
import { Text } from '../../ui/Text';
import { summarize } from './board';
import { SEVERITY_LABEL_KEY } from './texts';
import { MOVIL_NC_DYNAMIC_TESTIDS } from './testids';

const SUMMARY_MAX = 110;

interface Props {
  readonly nc: NcDto;
  readonly onOpen: (code: string) => void;
}

/**
 * Tarjeta del tablero: `role="listitem"` con el código como nombre. Todo el cuerpo es pulsable (botón «Abrir …»):
 * tocar la tarjeta abre el detalle. La franja y el badge llevan la severidad (`data-severity`); el estado va en
 * `data-state` de la tarjeta.
 */
export const NcCard = ({ nc, onOpen }: Props) => {
  const { t } = useI18n();
  const { colors } = useTheme();
  const tone = NC_SEVERITY_TONE[nc.severity];
  const severityLabel = t('nc', SEVERITY_LABEL_KEY[nc.severity]);
  const comments = t('nc', nc.commentCount === 1 ? 'commentsOne' : 'comments', { count: nc.commentCount });

  return (
    <Card
      role="listitem"
      aria-label={nc.code}
      testID={NC_DYNAMIC_TESTIDS.NC_CARD(nc.code)}
      dataSet={{ state: nc.state, severity: nc.severity }}
      stripe={toneColors(colors, tone).fg}
    >
      <Pressable
        role="button"
        aria-label={t('nc', 'openCard', { code: nc.code })}
        testID={NC_DYNAMIC_TESTIDS.NC_CARD_OPEN(nc.code)}
        onPress={() => onOpen(nc.code)}
        style={styles.body}
      >
        <View style={styles.open}>
          <Text variant="mono" weight="500">
            {nc.code}
          </Text>
          <Text variant="small" tone="muted" numberOfLines={3} testID={MOVIL_NC_DYNAMIC_TESTIDS.CARD_SUMMARY(nc.code)}>
            {summarize(nc.description, SUMMARY_MAX)}
          </Text>
        </View>

        <View style={styles.meta}>
          <Badge label={severityLabel} tone={tone} severity={nc.severity} testID={NC_DYNAMIC_TESTIDS.NC_CARD_SEVERITY(nc.code)} />
          <Text variant="mono" tone="faint">
            {nc.programCode}
          </Text>
          <Text variant="small" tone="muted" style={styles.grow} testID={NC_DYNAMIC_TESTIDS.NC_CARD_COMMENTS(nc.code)}>
            {comments}
          </Text>
        </View>

        <View style={styles.assignee} testID={NC_DYNAMIC_TESTIDS.NC_CARD_ASSIGNEE(nc.code)}>
          {nc.assigneeName ? (
            <>
              <Avatar name={nc.assigneeName} size={22} />
              <Text variant="small" tone="muted" numberOfLines={1} style={styles.grow}>
                {nc.assigneeName}
              </Text>
            </>
          ) : (
            <Text variant="small" tone="faint">
              {t('nc', 'unassigned')}
            </Text>
          )}
        </View>
      </Pressable>
    </Card>
  );
};

const styles = StyleSheet.create({
  body: { gap: 8 },
  open: { gap: 4 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  grow: { flexShrink: 1 },
  assignee: { flexDirection: 'row', alignItems: 'center', gap: 6 },
});
