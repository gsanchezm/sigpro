import { PROGRAMAS_DYNAMIC_TESTIDS, PROGRAMAS_TESTIDS, formatDate, formatMoney, toProgressTitle, type ProgramDto } from '@sigpro/shared';
import { Pressable, StyleSheet, View } from 'react-native';
import { useI18n } from '../../state/i18n';
import { Avatar } from '../../ui/Avatar';
import { Card } from '../../ui/Card';
import { ProgressBar } from '../../ui/ProgressBar';
import { Text } from '../../ui/Text';
import { ProgramStatusBadge } from './ProgramStatusBadge';

interface Props {
  readonly program: ProgramDto;
  readonly onOpen: (code: string) => void;
}

/**
 * Tarjeta de programa. El `listitem` lleva el id de la fila y el código como nombre; dentro, un enlace ocupa toda la tarjeta
 * (tocarla abre el detalle) y tiene nombre accesible «PRG-001 · nombre».
 */
export const ProgramCard = ({ program, onOpen }: Props) => {
  const { t, lang } = useI18n();
  const { code, name, ownerName, progress, budgetEur, startDate, endDate, status } = program;
  return (
    <Card role="listitem" aria-label={code} testID={PROGRAMAS_DYNAMIC_TESTIDS.PROGRAMS_ROW(code)} style={styles.item}>
      <Pressable role="link" aria-label={`${code} · ${name}`} onPress={() => onOpen(code)} style={({ pressed }) => [styles.press, pressed ? styles.pressed : null]}>
        <View style={styles.row}>
          <Text variant="mono" tone="muted" aria-hidden>
            {code}
          </Text>
          <ProgramStatusBadge status={status} testID={PROGRAMAS_TESTIDS.PROGRAMS_STATE_BADGE} />
        </View>
        <Text variant="heading">{name}</Text>
        <View style={styles.row}>
          <Avatar name={ownerName} size={24} />
          <Text variant="small" tone="muted" style={styles.grow}>
            {ownerName}
          </Text>
        </View>
        <View style={styles.row}>
          <View style={styles.grow}>
            <ProgressBar value={progress} label={toProgressTitle(progress, lang)} />
          </View>
          <Text variant="small" tone="muted" aria-hidden>
            {t('hitos', 'progressText', { value: progress })}
          </Text>
        </View>
        <Text variant="small" tone="muted">
          {`${formatMoney(budgetEur, lang)} · ${formatDate(startDate, lang)} → ${formatDate(endDate, lang)}`}
        </Text>
      </Pressable>
    </Card>
  );
};

const styles = StyleSheet.create({
  item: { padding: 0, gap: 0, overflow: 'hidden' },
  press: { padding: 16, gap: 10 },
  pressed: { opacity: 0.85 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  grow: { flex: 1 },
});
