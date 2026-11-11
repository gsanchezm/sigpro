import { HITOS_DYNAMIC_TESTIDS, HITOS_TESTIDS, formatDate, type MilestoneDto } from '@sigpro/shared';
import { StyleSheet, View } from 'react-native';
import { useI18n } from '../../state/i18n';
import { Badge } from '../../ui/Badge';
import { Card } from '../../ui/Card';
import { ProgressBar } from '../../ui/ProgressBar';
import { Text } from '../../ui/Text';
import { MILESTONE_STATUS_TONE, milestoneStatusOf, sortMilestones } from './view';

interface Props {
  readonly code: string;
  readonly milestones: readonly MilestoneDto[];
}

/** Hitos del programa en solo lectura: lista de tarjetas (fecha, estado y avance). Sin edición: esta app no crea ni cambia hitos. */
export const MilestonesList = ({ code, milestones }: Props) => {
  const { t } = useI18n();
  return (
    <View role="list" aria-label={t('hitos', 'table', { code })} testID={HITOS_TESTIDS.MILESTONES_TABLE} style={styles.list}>
      {sortMilestones(milestones).map((milestone) => (
        <MilestoneRow key={milestone.id} milestone={milestone} />
      ))}
    </View>
  );
};

const MilestoneRow = ({ milestone }: { readonly milestone: MilestoneDto }) => {
  const { t, lang } = useI18n();
  const { id, name, dueDate, progress } = milestone;
  const status = milestoneStatusOf(milestone);
  return (
    <Card role="listitem" aria-label={name} testID={HITOS_DYNAMIC_TESTIDS.MILESTONE_ROW(id)} dataSet={{ state: status }} style={styles.item}>
      <View style={styles.row}>
        <Text variant="label" testID={HITOS_DYNAMIC_TESTIDS.MILESTONE_NAME(id)} style={styles.grow}>
          {name}
        </Text>
        <Badge label={t('hitos', `status_${status}`)} tone={MILESTONE_STATUS_TONE[status]} state={status} testID={HITOS_DYNAMIC_TESTIDS.MILESTONE_STATUS(id)} />
      </View>
      <Text variant="small" tone="muted" testID={HITOS_DYNAMIC_TESTIDS.MILESTONE_DATE(id)}>
        {formatDate(dueDate, lang)}
      </Text>
      <View style={styles.row}>
        <View style={styles.grow}>
          <ProgressBar testID={HITOS_DYNAMIC_TESTIDS.MILESTONE_PROGRESS(id)} value={progress} label={t('hitos', 'progressOf', { name })} />
        </View>
        <Text variant="small" tone="muted" aria-hidden>
          {t('hitos', 'progressText', { value: progress })}
        </Text>
      </View>
    </Card>
  );
};

const styles = StyleSheet.create({
  list: { gap: 8 },
  item: { gap: 6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  grow: { flex: 1 },
});
